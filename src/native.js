/* ==================================================================
   APP DE ESCRITORIO (Electron + FFmpeg).
   Solo se activa dentro de la app (existe window.eeNative). En Chrome, el celular
   y GitHub Pages esto no hace nada y el editor funciona igual que siempre.
   ================================================================== */
(()=>{
PRO.nat=null;
const N=window.eeNative;if(!N||!N.isApp)return;
const NAT=PRO.nat={info:null};
document.documentElement.classList.add('ee-app');
const mb=b=>(b/1e6).toFixed(b>1e9?0:1)+' MB';
const tsec=s=>s<60?Math.round(s)+' s':Math.floor(s/60)+' min '+Math.round(s%60)+' s';

/* ---------- abrir cualquier formato: FFmpeg mira el archivo; si el navegador no puede verlo, se hace una copia compatible ---------- */
NAT.probe=async(m,probe0)=>{
  let info=null;try{info=await N.probe(m.nativePath)}catch(e){}
  m.ninfo=info;
  // códecs que Chromium no muestra (ProRes, DNxHD, MPEG-2…): se edita con la copia y se exporta con el original
  const okV=!info||!info.vcodec||/^(h264|vp8|vp9|av1|hevc)$/.test(info.vcodec);
  try{if(m.type==='video'&&!okV)throw new Error('codec');await probe0(m)}
  catch(e){
    if(!info)throw e;
    if(m.type==='video'&&info.vcodec){
      toast(`«${m.name}» (${info.vcodec}) no se ve directo: creando una copia compatible con FFmpeg…`,8000);
      const r=await N.proxy(m.nativePath,f=>{$('#toast').textContent=`Preparando «${m.name}»… ${Math.round(f*100)}%`});
      m.url=r.url;m.proxyUrl=r.url;m.proxyH=720;m.viaProxy=true;
    }else if(info.acodec){
      const r=await N.audio(m.nativePath);if(!r)throw e;m.url=r.url;m.viaProxy=true;
    }else throw e;
    await probe0(m);
  }
  if(info&&m.type==='video'&&info.w&&info.h){m.w=info.w;m.h=info.h}
  if(info&&info.dur&&!(m.dur>0&&isFinite(m.dur)))m.dur=info.dur;
};

/* ---------- audio de archivos enormes: FFmpeg lo saca a un WAV en el disco, sin leer el video entero ---------- */
NAT.rawAudio=async m=>{
  const r=await N.audio(m.nativePath);if(!r)return null;
  return (await fetch(r.url)).arrayBuffer();
};
async function abufOf(m,oac){
  if(m._abuf)return m._abuf;
  const raw=m.nativePath?await NAT.rawAudio(m):m.file?await m.file.arrayBuffer():null;
  if(!raw)return null;
  return m._abuf=await oac.decodeAudioData(raw);
}
async function mixAudio(T0,R){
  const clips=S.clips.filter(c=>(c.type==='audio'||(c.type==='video'&&!c.mute))&&c.vol>0);
  if(!clips.length)return null;
  const sr=48000,oac=new OfflineAudioContext(2,Math.max(1,Math.ceil(T0*sr)),sr);
  let any=false;
  for(const c of clips){
    const m=M.get(c.mediaId);if(!m)continue;
    let buf=null;try{buf=await abufOf(m,oac)}catch(e){console.warn('audio',m.name,e)}
    if(!buf)continue;any=true;
    const src=oac.createBufferSource();src.buffer=buf;
    src.playbackRate.value=clamp(c.speed*speedCurveAvg(c),0.1,4);
    const g=oac.createGain();g.gain.setValueAtTime(c.vol,c.start);
    if(c.fadeIn>0){g.gain.setValueAtTime(0.0001,c.start);g.gain.linearRampToValueAtTime(c.vol,c.start+c.fadeIn)}
    if(c.fadeOut>0){g.gain.setValueAtTime(c.vol,Math.max(c.start,c.start+c.dur-c.fadeOut));g.gain.linearRampToValueAtTime(0.0001,c.start+c.dur)}
    PRO.afx(oac,c,src).connect(g);g.connect(oac.destination);
    if(c.sess)PRO.sessAudio(oac,c,buf,g);else src.start(c.start,c.in||0,c.dur*src.playbackRate.value);
  }
  if(!any)return null;
  let ab=await oac.startRendering();if(R)ab=PRO.sliceAudio(ab,R.a,R.b);
  return N.writeTemp(wav(ab),'wav');
}
function wav(ab){
  const n=ab.length,ch=2,a=ab.getChannelData(0),b=ab.numberOfChannels>1?ab.getChannelData(1):a;
  const buf=new ArrayBuffer(44+n*ch*2),v=new DataView(buf);
  const s=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};
  s(0,'RIFF');v.setUint32(4,36+n*ch*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);
  v.setUint32(24,ab.sampleRate,true);v.setUint32(28,ab.sampleRate*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,n*ch*2,true);
  const o=new Int16Array(buf,44,n*ch);
  for(let i=0;i<n;i++){o[i*2]=Math.max(-1,Math.min(1,a[i]))*32767;o[i*2+1]=Math.max(-1,Math.min(1,b[i]))*32767}
  return new Uint8Array(buf);
}

/* ---------- fotogramas del original leídos por FFmpeg (con la GPU si puede), ya a la medida de la exportación ---------- */
function natFrames(W,H,fps){
  const map=new Map();
  async function open(st,m,t){
    if(st.id!=null)N.frClose(st.id);st.pre=null;
    st.start=Math.max(0,t);st.idx=-1;st.eof=false;
    st.id=await N.frOpen({path:m.nativePath,start:st.start,w:st.w,h:st.h,fps:st.fps,scale:st.w!==st.sw||st.h!==st.sh});
  }
  async function get(c,m,target){
    let st=map.get(c.id);
    if(!st){
      const i=m.ninfo||{},sw=i.w||m.w,sh=i.h||m.h;
      const k=Math.min(1,Math.max(W/sw,H/sh));
      st={id:null,sw,sh,w:Math.max(2,Math.round(sw*k/2)*2),h:Math.max(2,Math.round(sh*k/2)*2),fps:Math.min(120,i.fps>1?i.fps:fps),frame:null,idx:-1};
      map.set(c.id,st);
    }
    let want=Math.round((target-st.start)*st.fps);
    if(st.id==null||want<st.idx||want>st.idx+st.fps*3){await open(st,m,target);want=0}
    if(want!==st.idx&&!st.eof){
      // el siguiente fotograma ya se pidió mientras se dibujaba el anterior
      let r=st.pre?await st.pre:null;st.pre=null;
      if(!r||r.i<want)r=await N.frRead(st.id,want);
      if(r){if(st.frame)st.frame.close();st.frame=new VideoFrame(r.data,{format:'I420',codedWidth:st.w,codedHeight:st.h,timestamp:0,colorSpace:{matrix:'bt709',primaries:'bt709',transfer:'bt709',fullRange:false}});st.idx=r.i}
      else st.eof=true; // fin del archivo: se queda el último fotograma
      if(!st.eof){const id=st.id;st.pre=N.frRead(id,st.idx+1).catch(()=>null)}
    }
    return st.frame?{canvas:st.frame,w:st.w,h:st.h}:null;
  }
  function shut(st){if(st.id!=null)N.frClose(st.id);if(st.frame)st.frame.close()}
  function prune(act){const keep=new Set(act.map(c=>c.id));for(const [id,st] of map)if(!keep.has(id)){shut(st);map.delete(id)}}
  function close(){for(const st of map.values())shut(st);map.clear()}
  return {get,prune,close};
}

/* lectura del lienzo: VideoFrame.copyTo (asíncrona) y, si no se puede, getImageData */
let grabOk=true;
function grab(w,h){
  // la foto del lienzo se toma ya (síncrono); la copia a memoria termina después
  if(grabOk&&window.VideoFrame){
    let vf=null;
    try{vf=new VideoFrame(cv,{timestamp:0})}catch(e){grabOk=false}
    if(vf){
      const b=new Uint8Array(w*h*4);
      return vf.copyTo(b,{format:'RGBA',rect:{x:0,y:0,width:w,height:h},layout:[{offset:0,stride:w*4}]})
        .then(()=>b,e=>{console.warn('copyTo',e);grabOk=false;return null}).finally(()=>vf.close());
    }
  }
  return Promise.resolve(cx.getImageData(0,0,w,h).data);
}
/* ---------- exportar con FFmpeg: el editor dibuja cada fotograma y la GPU lo codifica directo al disco ---------- */
NAT.exportVideo=async({bitrate,exportSharp,oldMode,fps})=>{
  const R=PRO.exRange,T0=total(),T=R?R.b-R.a:T0,totalFrames=Math.max(1,Math.round(T*fps));
  const base=(S.name||'proyecto').replace(/[^\w\- ]+/g,'').trim()||'proyecto';
  S.exporting=true;setSize();const w=cv.width,h=cv.height;S.exporting=false;
  const fname=(R&&R.name?R.name:`${base}-${w}x${h}-${fps}fps`)+'.mp4';
  const out=PRO.exDir?await N.join(PRO.exDir,fname):await N.saveDialog(fname);
  if(!out){S.upMode=oldMode;setSize();renderAll();exCancel=true;return}
  exCancel=false;PRO.encErr=null;
  $('#exConfigBox').style.display='none';$('#exProgressBox').style.display='block';$('#exportModal').style.display='flex';
  $('#exBar').style.width='0%';$('#exPct').textContent='0%';
  $('#exTitle').textContent=`Exportando ${w}×${h} a ${fps} fps con FFmpeg…`;
  $('#exMsg').textContent='Mezclando el audio…';
  S.exporting=true;S.cropMode=false;S.sel=null;setSize();
  for(const id in EL)EL[id].pause();
  const oldUp=S.upscale;S.upscale=exportSharp;
  const NF=natFrames(w,h,fps),FS=PRO.frameSources(),t0=performance.now();
  let E=null,res=null;
  try{
    const audio=await mixAudio(T0,R);
    E=await N.encOpen({path:out,w,h,fps,bitrate,audio});
    $('#exMsg').textContent=`Codificando con tu GPU: ${E.enc}. Se guarda directo en el disco, sin ocupar memoria.`;
    let chain=Promise.resolve();const pend=[],P={get:0,render:0,read:0,wait:0};let q0=performance.now(),q1;
    for(let f=0;f<totalFrames;f++){
      if(exCancel)break;
      const t=PRO.bridgeGap(f/fps+(R?R.a:0),fps);S.t=t;
      const act=S.clips.filter(c=>c.type==='video'&&active(c,t));
      for(const c of act){
        const m=M.get(c.mediaId),target=clipSourceTimeAt(c,clamp(t-c.start,0,c.dur));
        const fr=m&&m.nativePath?await NF.get(c,m,target):await FS.get(c,target);
        if(fr)c._overrideCanvas=fr;
        else{c._overrideCanvas=null;const el=getEl(c);if(el)await seekVideoExact(el,target)}
      }
      NF.prune(act);FS.prune(act);q1=performance.now();P.get+=q1-q0;q0=q1;
      renderFrame(exportSharp);
      act.forEach(c=>{c._overrideCanvas=null});q1=performance.now();P.render+=q1-q0;q0=q1;
      // la lectura del lienzo y el envío a FFmpeg corren mientras se dibuja el siguiente (en orden)
      const g=grab(w,h);
      q1=performance.now();P.read+=q1-q0;q0=q1;
      chain=chain.then(async()=>{const px=await g;await N.encWrite(E.id,px instanceof Uint8Array?px:new Uint8Array(px.buffer))});
      pend.push(chain);
      if(pend.length>=3)await pend.shift();
      q1=performance.now();P.wait+=q1-q0;q0=q1;
      if(f%3===0||f===totalFrames-1){
        const pct=Math.round((f+1)/totalFrames*100),el=(performance.now()-t0)/1000,sp=(f+1)/el;
        $('#exBar').style.width=pct+'%';
        $('#exPct').textContent=`${pct}% · ${f+1}/${totalFrames} fotogramas · ${sp.toFixed(1)} fps · faltan ~${tsec((totalFrames-f-1)/sp)}`;
        await new Promise(r=>setTimeout(r,0));
      }
    }
    await Promise.all(pend);NAT.P=P;
    if(exCancel){await N.encAbort(E.id);E=null}
    else{res=await N.encClose(E.id);E=null;if(!res.ok)throw new Error(res.err||'FFmpeg falló')}
  }catch(e){
    console.error(e);PRO.encErr=e;if(E)N.encAbort(E.id);
    toast('La exportación con FFmpeg falló: '+(e.message||e)+'. Prueba con «💎 Exacto» (WebCodecs).',12000);
  }finally{
    NF.close();FS.close();
    S.upscale=oldUp;S.exporting=false;S.upMode=oldMode;setSize();
    $('#exportModal').style.display='none';seek(0);renderAll();
  }
  if(exCancel&&!res){toast('Exportación cancelada.');return}
  if(res){
    const secs=(performance.now()-t0)/1000;
    NAT.last={ms:Object.fromEntries(Object.entries(NAT.P||{}).map(([k,v])=>[k,Math.round(v/totalFrames)])),file:out,size:res.size,secs,frames:totalFrames,fps:totalFrames/secs};
    if(!R){toast(`✅ Guardado en ${out} (${mb(res.size)}) en ${tsec(secs)} · ${(totalFrames/secs).toFixed(1)} fps`,12000);N.reveal(out)}
  }
};

/* ---------- interfaz: opción de exportar con FFmpeg, aviso de GPU ---------- */
NAT.init=()=>{
  const sel=$('#exEngine');
  if(sel&&!sel.querySelector('option[value="ffmpeg"]')){
    const o=document.createElement('option');o.value='ffmpeg';
    o.textContent='🚀 FFmpeg con tu GPU (app de escritorio · incluye filtros, texto, zoom y upscaler · guarda directo en el disco)';
    sel.prepend(o);sel.value='ffmpeg';
  }
  const br=document.querySelector('.brand');
  if(br){const s=document.createElement('span');s.className='ee-app-badge';s.textContent='APP ⚙';s.title='Ajustes de la app: dónde se guardan las copias (proxies)';s.style.cursor='pointer';s.onclick=e=>{e.preventDefault();e.stopPropagation();N.settings&&N.settings()};br.appendChild(s)}
  N.info().then(i=>{NAT.info=i;if(br)br.lastChild.title='Ajustes de la app (dónde se guardan las copias) · FFmpeg con '+i.gpu;
    if(o2())o2().textContent=o2().textContent.replace('tu GPU',i.gpu)}).catch(()=>{});
  const o2=()=>sel&&sel.querySelector('option[value="ffmpeg"]');
  const st=document.createElement('style');st.textContent='.ee-app-badge{margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.1em;padding:2px 6px;border-radius:5px;background:#ffd166;color:#1f1700;vertical-align:middle}';
  document.head.appendChild(st);
};
})();
