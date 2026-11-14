// FFmpeg para EasterEgg Studio: proxies con la GPU, audio, lectura de fotogramas y exportación.
// Todo trabaja directo con los archivos del disco: nada de cargar un video de 4 GB en memoria.
const {app,ipcMain,dialog,shell}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');

const FFMPEG=require('ffmpeg-static').replace('app.asar','app.asar.unpacked');
let BASE='',win=null;
const running=new Set(); // procesos de FFmpeg vivos (para cancelar o cerrar)

/* ajustes guardados (por ahora: dónde van los proxies y el audio) */
const CFG=()=>path.join(app.getPath('userData'),'ee-config.json');
function readCfg(){try{return JSON.parse(fs.readFileSync(CFG(),'utf8'))}catch(e){return {}}}
function writeCfg(c){fs.mkdirSync(path.dirname(CFG()),{recursive:true});fs.writeFileSync(CFG(),JSON.stringify(c,null,1))}
const defCache=()=>path.join(app.getPath('userData'),'ee-cache');
function cacheDir(){const c=readCfg().cacheDir;let d=c||defCache();try{fs.mkdirSync(d,{recursive:true})}catch(e){d=defCache();fs.mkdirSync(d,{recursive:true})}return d}
function dirSize(d){let n=0;try{for(const f of fs.readdirSync(d)){try{const st=fs.statSync(path.join(d,f));if(st.isFile())n+=st.size}catch(e){}}}catch(e){}return n}
function clearDir(d){let n=0;try{for(const f of fs.readdirSync(d))if(/^(px-|au-|tmp-)/.test(f)){try{n+=fs.statSync(path.join(d,f)).size;fs.unlinkSync(path.join(d,f))}catch(e){}}}catch(e){}return n}
const MBs=b=>b>1e9?(b/1e9).toFixed(1)+' GB':Math.round(b/1e6)+' MB';
async function settings(){
  for(;;){
    const d=cacheDir(),sz=dirSize(d);
    const r=await dialog.showMessageBox(win,{type:'info',title:'Ajustes de EasterEgg Studio',
      message:'Copias livianas (proxies) y audio',
      detail:`Se guardan en:
${d}

Ocupan ahora: ${MBs(sz)}

Puedes moverlas a otro disco (por ejemplo D:) o borrarlas. Si las borras, la app las vuelve a crear cuando las necesite.`,
      buttons:['Cambiar de disco o carpeta…',`Borrar las copias (${MBs(sz)})`,'Abrir la carpeta','Cerrar'],defaultId:0,cancelId:3,noLink:true});
    if(r.response===0){
      const o=await dialog.showOpenDialog(win,{title:'Elige dónde guardar las copias (mejor en un disco con espacio)',properties:['openDirectory','createDirectory']});
      if(o.canceled)continue;
      const nd=path.join(o.filePaths[0],'EasterEgg Studio cache');
      try{fs.mkdirSync(nd,{recursive:true});fs.writeFileSync(path.join(nd,'.prueba'),'');fs.unlinkSync(path.join(nd,'.prueba'))}
      catch(e){await dialog.showMessageBox(win,{type:'error',message:'No puedo escribir en esa carpeta.',detail:String(e.message)});continue}
      const c=readCfg();c.cacheDir=nd;writeCfg(c);
      if(sz&&path.resolve(nd)!==path.resolve(d)){
        const q=await dialog.showMessageBox(win,{type:'question',message:`¿Borrar las copias de la carpeta anterior para liberar ${MBs(sz)}?`,detail:d,buttons:['Sí, borrarlas','No'],defaultId:0,cancelId:1,noLink:true});
        if(q.response===0)clearDir(d);
      }
      await dialog.showMessageBox(win,{type:'info',message:'Listo.',detail:`Desde ahora las copias se guardan en:
${nd}`});
      continue;
    }
    if(r.response===1){const q=await dialog.showMessageBox(win,{type:'warning',message:`¿Borrar ${MBs(sz)} de copias?`,detail:'Tus videos originales y tus proyectos no se tocan.',buttons:['Borrar','Cancelar'],defaultId:0,cancelId:1,noLink:true});if(q.response===0)clearDir(d);continue}
    if(r.response===2){shell.openPath(d);continue}
    return cacheDir();
  }
}
const urlOf=f=>`${BASE}/__cache/${encodeURIComponent(path.basename(f))}`;
function keyOf(p){const st=fs.statSync(p);return crypto.createHash('sha1').update(`${p}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0,20)}

/* ejecuta FFmpeg; onLine recibe cada línea de -progress */
function run(args,{onLine,track=true}={}){
  const pr=spawn(FFMPEG,args,{windowsHide:true});
  if(track){running.add(pr);pr.on('exit',()=>running.delete(pr))}
  let err='',buf='';
  pr.stderr.on('data',d=>{err=(err+d).slice(-4000)});
  if(onLine)pr.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){onLine(buf.slice(0,i).trim());buf=buf.slice(i+1)}});
  const done=new Promise(ok=>pr.on('exit',code=>ok({code,err})));
  return {pr,done};
}

/* ---------- información del archivo ---------- */
async function probe(p){
  const {done}=run(['-hide_banner','-i',p],{track:false});
  const {err}=await done;
  const o={path:p,size:fs.statSync(p).size,dur:0,w:0,h:0,fps:0,vcodec:null,acodec:null};
  let m=/Duration: (\d+):(\d+):([\d.]+)/.exec(err);if(m)o.dur=(+m[1])*3600+(+m[2])*60+(+m[3]);
  const vl=(err.match(/Stream #.*?Video: .*/)||[])[0];
  if(vl){
    o.vcodec=(/Video: (\w+)/.exec(vl)||[])[1]||null;
    m=/, (\d{2,5})x(\d{2,5})[ ,]/.exec(vl);if(m){o.w=+m[1];o.h=+m[2]}
    m=/([\d.]+) fps/.exec(vl)||/([\d.]+) tbr/.exec(vl);if(m)o.fps=+m[1];
    if(/rotate\s*:\s*-?90|displaymatrix: rotation of -?90/.test(err)){const t=o.w;o.w=o.h;o.h=t}
  }
  const al=(err.match(/Stream #.*?Audio: .*/)||[])[0];if(al)o.acodec=(/Audio: (\w+)/.exec(al)||[])[1]||null;
  return o;
}

/* ---------- ¿qué codificador de video tiene esta PC? NVIDIA → Intel → AMD → CPU ---------- */
let encP=null;
function detectEncoders(){
  if(encP)return encP;
  encP=(async()=>{
    const ok=[];
    for(const e of ['h264_nvenc','h264_qsv','h264_amf']){
      const {done}=run(['-hide_banner','-loglevel','error','-f','lavfi','-i','color=size=320x240:rate=30','-frames:v','3','-pix_fmt','yuv420p','-c:v',e,'-f','null','-'],{track:false});
      if((await done).code===0)ok.push(e);
    }
    ok.push('libx264');return ok;
  })();
  return encP;
}
const GPU_NAME={h264_nvenc:'NVIDIA (NVENC)',h264_qsv:'Intel (QuickSync)',h264_amf:'AMD (AMF)',libx264:'procesador (CPU)'};
function vArgs(enc,{bitrate,fps,fast}){
  const br=Math.round(bitrate),g=String(Math.round(fps||30)*(fast?1:2));
  if(enc==='h264_nvenc')return ['-c:v','h264_nvenc','-preset',fast?'p2':'p5','-rc','vbr','-b:v',br,'-maxrate',Math.round(br*1.5),'-bufsize',br*2,'-profile:v','high','-g',g,'-bf',fast?'0':'2'];
  if(enc==='h264_qsv')return ['-c:v','h264_qsv','-preset',fast?'veryfast':'medium','-b:v',br,'-maxrate',Math.round(br*1.5),'-g',g];
  if(enc==='h264_amf')return ['-c:v','h264_amf','-quality',fast?'speed':'quality','-rc','vbr_peak','-b:v',br,'-maxrate',Math.round(br*1.5),'-g',g];
  return ['-c:v','libx264','-preset',fast?'veryfast':'medium','-b:v',br,'-maxrate',Math.round(br*1.5),'-bufsize',br*2,'-g',g].concat(fast?['-tune','fastdecode']:[]);
}

/* ---------- proxy 720p ---------- */
function prog(job,frac,info){if(win&&!win.isDestroyed()&&job)win.webContents.send('ee:progress',job,frac,info||{})}
function proxyFile(p){return path.join(cacheDir(),'px-'+keyOf(p)+'.mp4')}
async function makeProxy({path:p,job}){
  const out=proxyFile(p);if(fs.existsSync(out))return {url:urlOf(out),file:out,cached:true};
  const info=await probe(p),encs=await detectEncoders();
  const portrait=info.h>info.w;
  const scale=portrait?'scale=720:-2:flags=bilinear':'scale=-2:720:flags=bilinear';
  const tmp=out+'.part.mp4',t0=Date.now();
  let last=null;
  // 1º todo dentro de la tarjeta NVIDIA (decodifica, achica y codifica sin pasar por el procesador), luego con ayuda del procesador
  const tries=[];
  if(encs[0]==='h264_nvenc')tries.push({enc:'h264_nvenc',pre:['-hwaccel','cuda','-hwaccel_output_format','cuda'],vf:(portrait?'scale_cuda=720:-2':'scale_cuda=-2:720')+':format=yuv420p'});
  for(const enc of [encs[0],'libx264'].filter((e,i,a)=>a.indexOf(e)===i))tries.push({enc,pre:['-hwaccel','auto'],vf:scale+',format=yuv420p'});
  for(const {enc,pre,vf} of tries){
    const args=['-y','-hide_banner','-loglevel','error','-nostats','-progress','pipe:1',...pre,'-i',p,
      '-map','0:v:0','-map','0:a:0?','-vf',vf,...vArgs(enc,{bitrate:5e6,fps:info.fps||30,fast:true}),
      '-c:a','aac','-b:a','128k','-ac','2','-movflags','+faststart',tmp];
    const {done}=run(args,{onLine:l=>{const m=/^out_time_us=(\d+)/.exec(l);if(m&&info.dur)prog(job,Math.min(1,+m[1]/1e6/info.dur),{enc:GPU_NAME[enc],secs:(Date.now()-t0)/1000})}});
    last=await done;
    if(last.code===0){fs.renameSync(tmp,out);return {url:urlOf(out),file:out,enc:GPU_NAME[enc],secs:(Date.now()-t0)/1000,info}}
    try{fs.unlinkSync(tmp)}catch(e){}
    if(last.code===null||cancelled)break; // cancelado
  }
  throw new Error(cancelled?'cancelado':'FFmpeg no pudo crear el proxy: '+last.err.split('\n').filter(Boolean).slice(-2).join(' '));
}
let cancelled=false;

/* ---------- audio del original (WAV 48 kHz estéreo) ---------- */
async function extractAudio({path:p,job}){
  const out=path.join(cacheDir(),'au-'+keyOf(p)+'.wav');if(fs.existsSync(out))return {url:urlOf(out),file:out};
  const info=await probe(p);if(!info.acodec)return null;
  const tmp=out+'.part.wav';
  const {done}=run(['-y','-hide_banner','-loglevel','error','-nostats','-progress','pipe:1','-i',p,'-map','0:a:0','-vn','-ac','2','-ar','48000','-c:a','pcm_s16le',tmp],
    {onLine:l=>{const m=/^out_time_us=(\d+)/.exec(l);if(m&&info.dur)prog(job,Math.min(1,+m[1]/1e6/info.dur))}});
  const r=await done;
  if(r.code!==0){try{fs.unlinkSync(tmp)}catch(e){}throw new Error('No pude leer el audio: '+r.err.slice(-300))}
  fs.renameSync(tmp,out);return {url:urlOf(out),file:out};
}

/* ---------- lector de fotogramas (para exportar desde el original sin cargarlo entero) ---------- */
const readers=new Map();let rid=0;
async function frOpen({path:p,start,w,h,fps,scale}){
  const id=++rid,FS=w*h*3/2; // YUV 4:2:0: 2,7 veces menos datos que RGBA
  const nv=(await detectEncoders())[0]==='h264_nvenc';
  // sin reescalar si el tamaño ya es el del video: así FFmpeg lee 4K a ~75 fps con la NVIDIA
  const vf=`fps=${fps}`+(scale?`,scale=${w}:${h}:flags=bicubic:out_color_matrix=bt709:out_range=tv`:'')+',format=yuv420p';
  const args=['-hide_banner','-loglevel','error','-hwaccel',nv?'cuda':'auto','-ss',String(Math.max(0,start)),'-i',p,'-map','0:v:0',
    '-vf',vf,'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','yuv420p','pipe:1']; // passthrough: sin duplicar el primer fotograma
  const {pr,done}=run(args);
  const st={pr,FS,q:[],cur:null,curLen:0,idx:0,ended:false,waiters:[],err:''};
  const wake=()=>{const w=st.waiters;st.waiters=[];w.forEach(f=>f())};
  pr.stdout.on('data',d=>{
    let off=0;
    while(off<d.length){
      if(!st.cur){st.cur=Buffer.allocUnsafe(FS);st.curLen=0}
      const n=Math.min(FS-st.curLen,d.length-off);d.copy(st.cur,st.curLen,off,off+n);st.curLen+=n;off+=n;
      if(st.curLen===FS){st.q.push(st.cur);st.cur=null}
    }
    if(st.q.length>=3)pr.stdout.pause();
    wake();
  });
  done.then(r=>{st.ended=true;st.err=r.err;wake()});
  readers.set(id,st);return id;
}
async function frRead(id,want){if(process.env.EE_TEST)console.log('[fr] read',id,want,readers.has(id));
  const st=readers.get(id);if(!st)return null;
  for(;;){
    while(st.q.length&&st.idx<want){st.q.shift();st.idx++}
    if(st.q.length&&st.idx>=want){const b=st.q.shift(),i=st.idx++;if(st.q.length<3)st.pr.stdout.resume();return {i,data:b}}
    st.pr.stdout.resume();
    if(st.ended&&!st.q.length)return null;
    await new Promise(r=>st.waiters.push(r));
  }
}
function frClose(id){const st=readers.get(id);if(!st)return;readers.delete(id);try{st.pr.kill()}catch(e){}}

/* ---------- codificador: fotogramas RGBA → MP4 directo al disco ---------- */
const encoders=new Map();let eid=0;
async function encOpen({path:out,w,h,fps,bitrate,audio}){
  const encs=await detectEncoders(),enc=encs[0];
  const args=['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',`${w}x${h}`,'-r',String(fps),'-i','pipe:0'];
  if(audio)args.push('-i',audio);
  args.push('-map','0:v:0');if(audio)args.push('-map','1:a:0');
  args.push('-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
    ...vArgs(enc,{bitrate,fps}));
  if(audio)args.push('-c:a','aac','-b:a','192k');
  args.push('-movflags','+faststart',out);
  const {pr,done}=run(args);
  const id=++eid,st={pr,done,out,enc,dead:null,t0:Date.now()};
  pr.stdin.on('error',()=>{});
  done.then(r=>{st.dead=r});
  encoders.set(id,st);
  return {id,enc:GPU_NAME[enc]};
}
function encWrite(id,u8){
  const st=encoders.get(id);if(!st)throw new Error('codificador cerrado');
  if(st.dead)throw new Error('FFmpeg se detuvo: '+st.dead.err.slice(-300));
  const b=Buffer.from(u8.buffer,u8.byteOffset,u8.byteLength);
  return new Promise((ok,ko)=>{
    if(st.pr.stdin.write(b))return ok(true);
    const fin=()=>{clearInterval(iv);ok(true)};
    const iv=setInterval(()=>{if(st.dead){clearInterval(iv);st.pr.stdin.off('drain',fin);ko(new Error('FFmpeg se detuvo: '+st.dead.err.slice(-300)))}},250);
    st.pr.stdin.once('drain',fin);
  });
}
async function encClose(id){
  const st=encoders.get(id);if(!st)return null;encoders.delete(id);
  st.pr.stdin.end();const r=await st.done;
  let size=0;try{size=fs.statSync(st.out).size}catch(e){}
  return {ok:r.code===0,size,path:st.out,secs:(Date.now()-st.t0)/1000,err:r.code===0?'':r.err.slice(-500)};
}
function encAbort(id){const st=encoders.get(id);if(!st)return;encoders.delete(id);try{st.pr.kill()}catch(e){}setTimeout(()=>{try{fs.unlinkSync(st.out)}catch(e){}},500)}

/* ---------- conexión con el editor ---------- */
function register(w){
  win=w;
  const DBG=process.env.EE_TEST?(ch,a)=>{if(!/encWrite|frRead/.test(ch)||(DBG.n=(DBG.n||0)+1)<8)console.log('[ipc]',ch,JSON.stringify(a.map(x=>x&&x.byteLength?'bytes:'+x.byteLength:x)).slice(0,200))}:()=>{};
  const H=(ch,fn)=>{ipcMain.removeHandler(ch);ipcMain.handle(ch,(_e,...a)=>{DBG(ch,a);return fn(...a)})};
  H('ee:info',async()=>{const e=await detectEncoders();return {ffmpeg:FFMPEG,encoders:e,gpu:GPU_NAME[e[0]],cache:cacheDir()}});
  H('ee:probe',probe);
  H('ee:proxy',async a=>{cancelled=false;return makeProxy(a)});
  H('ee:proxyCached',p=>{try{const f=proxyFile(p);return fs.existsSync(f)?{url:urlOf(f),file:f}:null}catch(e){return null}});
  H('ee:cancel',()=>{cancelled=true;for(const pr of running){if(![...readers.values()].some(s=>s.pr===pr)&&![...encoders.values()].some(s=>s.pr===pr))try{pr.kill()}catch(e){}}});
  H('ee:audio',a=>extractAudio(a));
  H('ee:frOpen',frOpen);H('ee:frRead',frRead);H('ee:frClose',frClose);
  H('ee:encOpen',encOpen);H('ee:encWrite',encWrite);H('ee:encClose',encClose);H('ee:encAbort',encAbort);
  H('ee:writeTemp',(u8,ext)=>{const f=path.join(cacheDir(),'tmp-'+crypto.randomBytes(6).toString('hex')+'.'+(ext||'bin'));fs.writeFileSync(f,u8);return f});
  H('ee:writeFile',(p,u8)=>{fs.writeFileSync(p,u8);return p});
  H('ee:saveDialog',async name=>{const r=await dialog.showSaveDialog(win,{title:'Guardar video',defaultPath:path.join(app.getPath('videos'),name),filters:[{name:'Video MP4',extensions:['mp4']}]});return r.canceled?null:r.filePath});
  H('ee:pickFolder',async()=>{const r=await dialog.showOpenDialog(win,{title:'Elige la carpeta',properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0]});
  H('ee:join',(d,n)=>path.join(d,n));
  H('ee:settings',settings);
  H('ee:reveal',p=>shell.showItemInFolder(p));
  detectEncoders();
  // limpia temporales de exportaciones anteriores
  try{for(const f of fs.readdirSync(cacheDir()))if(/^tmp-|\.part\./.test(f))fs.unlinkSync(path.join(cacheDir(),f))}catch(e){}
}
function killAll(){for(const pr of running)try{pr.kill()}catch(e){}}
module.exports={register,killAll,cacheDir,readCfg,setBase:b=>{BASE=b},probe,detectEncoders,makeProxy,frOpen,frRead,frClose,encOpen,encWrite,encClose};
