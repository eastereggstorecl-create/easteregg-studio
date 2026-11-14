// Prueba automática (no va en el instalador). Uso:
//   set EE_TEST=1&& set EE_FILES=ruta1;ruta2&& set EE_OUT=carpeta&& npx electron .
// Importa los videos como si los eligieras, crea proxies, exporta 10 s con FFmpeg y compara fotogramas.
const {app}=require('electron');
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const FF=require('ffmpeg-static');
const log=(...a)=>{console.log('[TEST]',...a);try{fs.appendFileSync(path.join(process.env.EE_OUT,'log.txt'),a.join(' ')+'\n')}catch(e){}};
module.exports=async function(win,port){
  const files=(process.env.EE_FILES||'').split(';').filter(Boolean),out=process.env.EE_OUT,secs=+(process.env.EE_SECS||10),from=+(process.env.EE_FROM||30);
  const R={};
  const js=s=>win.webContents.executeJavaScript(s,true);
  win.webContents.on('render-process-gone',(e,d)=>log('RENDER GONE',JSON.stringify(d)));app.on('child-process-gone',(e,d)=>log('CHILD GONE',JSON.stringify(d)));win.on('closed',()=>log('WIN CLOSED'));win.webContents.on('did-start-navigation',(e)=>log('NAV',e.url||''));
  win.webContents.on('console-message',e=>{if(e.level==='error'||e.level==='warning')log('consola:',e.level,String(e.message).slice(0,300))});
  try{
    await win.loadURL(`http://localhost:${port}/PRO.html`);
    for(let i=0;i<60;i++){const st=await js(`({ee:typeof eeNative,isApp:window.eeNative&&eeNative.isApp,pro:typeof PRO,nat:typeof PRO!=='undefined'&&!!PRO.nat,EE:!!window.__EE})`);if(st.nat&&st.EE)break;if(i%5===0)log('esperando',JSON.stringify(st));await new Promise(r=>setTimeout(r,500))}
    R.app=await js(`({nat:!!PRO.nat,engine:$('#exEngine').value,gpu:PRO.nat.info&&PRO.nat.info.gpu})`);
    log('editor listo',JSON.stringify(R.app));
    const dbg=win.webContents.debugger;dbg.attach('1.3');
    const doc=await dbg.sendCommand('DOM.getDocument');
    const {nodeId}=await dbg.sendCommand('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#fileIn'});
    let t=Date.now();
    await dbg.sendCommand('DOM.setFileInputFiles',{nodeId,files});
    R.media=await js(`new Promise(r=>{const t0=Date.now();const w=()=>{const a=[...__EE.M.values()];if(a.length>=${files.length}&&a.every(m=>m.dur>0&&(m.type!=='video'||m.w)))r(a.map(m=>({name:m.name,w:m.w,h:m.h,dur:+m.dur.toFixed(2),nat:!!m.nativePath,viaProxy:!!m.viaProxy,codec:m.ninfo&&m.ninfo.vcodec})));else if(Date.now()-t0>90000)r({timeout:a.map(m=>({n:m.name,dur:m.dur,w:m.w,off:m.offline,nat:m.nativePath}))});else setTimeout(w,250)};w()})`);
    R.importSecs=(Date.now()-t)/1000;log('importados en',R.importSecs,'s',JSON.stringify(R.media));
    // proxies con la GPU (sin caché: se borran antes)
    R.proxies=[];
    for(const f of process.env.EE_SKIPPX?[]:files){
      const c=await js(`eeNative.proxyCached(${JSON.stringify(f)})`);if(c)fs.unlinkSync(c.file);
      t=Date.now();const r=await js(`eeNative.proxy(${JSON.stringify(f)}).then(r=>({enc:r.enc,secs:r.secs,url:r.url,file:r.file}))`);
      const sz=fs.statSync(r.file).size;
      R.proxies.push({file:path.basename(f),enc:r.enc,secs:+((Date.now()-t)/1000).toFixed(1),mb:+(sz/1e6).toFixed(1)});log('proxy',JSON.stringify(R.proxies.at(-1)));
    }
    if(process.env.EE_HDRTEST){await require('./hdr-test')({js,log,files,out,R});fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(R,null,1));log('paso: exportar HDR')}
    if(process.env.EE_SEEKTEST){
      R.seek=await js(`(async()=>{const m=[...__EE.M.values()].find(x=>x.nativePath===${JSON.stringify(files[0])});const out={};
        const pos=[];let x=7;for(let i=0;i<12;i++){x=(x*9301+49297)%233280;pos.push(5+(x/233280)*(Math.min(m.dur,200)-10))}
        for(const [k,u] of [['original',m.url],['proxy',m.proxyUrl]]){if(!u)continue;const v=document.createElement('video');v.muted=true;v.preload='auto';v.src=u;
          await new Promise(r=>{v.onloadeddata=r;setTimeout(r,15000)});const ts=[];
          for(const p of pos){const t0=performance.now();v.currentTime=p;await new Promise(r=>{v.onseeked=r;setTimeout(r,8000)});ts.push(performance.now()-t0)}
          ts.sort((a,b)=>a-b);out[k]={medianaMs:Math.round(ts[6]),peorMs:Math.round(ts[11])};v.src=''}
        return out})()`);
      log('saltos',JSON.stringify(R.seek));
      const F=require('ffmpeg-static');const px=(await js(`eeNative.proxyCached(${JSON.stringify(files[0])})`)).file;
      const kf=spawnSync(F,['-hide_banner','-skip_frame','nokey','-i',px,'-t','10','-vf','showinfo','-f','null','-'],{encoding:'utf8'}).stderr.split(String.fromCharCode(10)).filter(l=>/showinfo.*n:/.test(l)).length;
      R.keyframesEn10s=kf;log('fotogramas clave del proxy en 10 s:',kf);
      fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(R,null,1));return app.exit(0);
    }
    log('paso: timeline');
    // timeline: primer video, recortado a [from, from+secs]
    await js(`(()=>{const m=[...__EE.M.values()].find(x=>x.nativePath===${JSON.stringify(files[0])});__EE.S.clips.length=0;__EE.addMediaClip(m.id,'V1',0);const c=__EE.S.clips[0];c.in=Math.min(${from},Math.max(0,m.dur-${secs}-1));c.dur=${secs};__EE.renderAll&&0;return c.in})()`);
    const cIn=await js(`__EE.S.clips[0].in`);
    await js(`$('#prevRes')&&($('#prevRes').value='720',$('#prevRes').onchange&&$('#prevRes').onchange())`);
    // exportar con FFmpeg a la carpeta de prueba (resolución nativa si existe)
    await js(`(()=>{const r=$('#res');const RV=${JSON.stringify(process.env.EE_RES||'n')};if([...r.options].some(o=>o.value===RV)){r.value=RV;r.onchange({target:r})}PRO.exDir=${JSON.stringify(out)};PRO.exRange={a:0,b:${secs},name:'prueba-ffmpeg'};$('#exEngine').value=${JSON.stringify(process.env.EE_ENGINE||'ffmpeg')};PRO.exSave=async(blob,name)=>{const f=${JSON.stringify(out)}+'/'+name;await eeNative.writeFile(f,new Uint8Array(await blob.arrayBuffer()));PRO.nat.last={file:f,size:blob.size,engine:'webcodecs'}};})()`);
    log('paso: exportar');t=Date.now();
    await js(`window.__T={done:false};__EE.doExport().then(()=>{__T.done=true;PRO.exDir=null;PRO.exRange=null},e=>{__T.done=true;__T.err=String(e&&e.stack||e)});1`);
    for(let i=0;;i++){await new Promise(r=>setTimeout(r,1000));let st;try{st=await js(`({d:__T.done,e:__T.err,p:$('#exPct').textContent,m:$('#exMsg').textContent})`)}catch(e){log('poll falla',String(e));throw e}
      if(i%10===0)log('progreso',JSON.stringify(st));if(st.d){if(st.e)log('error export',st.e);break}}
    R.exportSecs=(Date.now()-t)/1000;R.export=await js(`PRO.nat.last||null`);R.encErr=await js(`String(PRO.encErr||'')`);
    log('exportado',R.exportSecs,'s',JSON.stringify(R.export),R.encErr);
    // comparar fotogramas: exportado (t=2.5 s) vs original (in+2.5 s)
    if(R.export){
      const o=R.export.file;
      const pr=spawnSync(FF,['-hide_banner','-i',o],{encoding:'utf8'}).stderr.split('\n').filter(l=>/Duration|Stream/.test(l)).map(s=>s.trim());
      R.exportInfo=pr;
      const ps=spawnSync(FF,['-hide_banner','-ss',String(cIn),'-t',String(secs),'-i',files[0],'-i',o,'-filter_complex','[0:v][1:v]scale2ref=flags=bicubic[a][b];[a][b]psnr','-f','null','-'],{encoding:'utf8'}).stderr;
      R.psnr=(ps.match(/PSNR .*/)||['?'])[0];
      for(const k of [0.5,secs/2,secs-0.5]){
        spawnSync(FF,['-y','-loglevel','error','-ss',String(k),'-i',o,'-frames:v','1','-vf','scale=640:-2',path.join(out,`export-${k}s.jpg`)]);
        spawnSync(FF,['-y','-loglevel','error','-ss',String(cIn+k),'-i',files[0],'-frames:v','1','-vf','scale=640:-2',path.join(out,`original-${k}s.jpg`)]);
      }
      log('PSNR',R.psnr);
    }
  }catch(e){R.error=String(e&&e.stack||e);log('ERROR',R.error)}
  fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(R,null,1));
  app.exit(0);
};
