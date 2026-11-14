// Prueba HDR + proxy automático + reabrir proyecto. Se usa desde harness.js con EE_HDRTEST=1.
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const FF=require('ffmpeg-static');
module.exports=async function({js,log,files,out,R}){
  const t0=Date.now();
  // 1) el proxy debe crearse solo al importar
  R.autoProxy=await js(`new Promise(r=>{const t0=Date.now();const w=()=>{const a=[...__EE.M.values()].filter(m=>m.type==='video'&&m.nativePath);
    if(a.length&&a.every(m=>m.proxyUrl))r({ok:true,secs:(Date.now()-t0)/1000,media:a.map(m=>({n:m.name,ninfo:m.ninfo,w:m.w,h:m.h}))});
    else if(Date.now()-t0>400000)r({ok:false,info:$('#pxInfo').textContent});else setTimeout(w,500)};w()})`);
  log('proxy automático',JSON.stringify(R.autoProxy));
  // color del proxy: fotograma del medio
  for(const f of files){
    const px=(await js(`eeNative.proxyCached(${JSON.stringify(f)})`));
    if(px)spawnSync(FF,['-y','-loglevel','error','-ss','1','-i',px.file,'-frames:v','1','-vf','scale=640:-2',path.join(out,'proxy-'+path.basename(f)+'.jpg')]);
  }
  // 2) saltos en el proxy vs original
  R.seek=await js(`(async()=>{const m=[...__EE.M.values()].find(x=>x.type==='video'&&x.nativePath);const out={};
    for(const [k,u] of [['original',m.url],['proxy',m.proxyUrl]]){const v=document.createElement('video');v.muted=true;v.preload='auto';v.src=u;
      await new Promise(r=>{v.onloadeddata=r;setTimeout(r,15000)});const ts=[];
      for(let i=0;i<8;i++){const p=(i%2?0.2:0.6)*m.dur+i*0.05;const t0=performance.now();v.currentTime=p;await new Promise(r=>{v.onseeked=r;setTimeout(r,8000)});ts.push(performance.now()-t0)}
      ts.sort((a,b)=>a-b);out[k]={medianaMs:Math.round(ts[4]),peorMs:Math.round(ts[7])};v.src=''}
    return out})()`);
  log('saltos',JSON.stringify(R.seek));
  // 3) reabrir el proyecto: debe encontrar los archivos solo
  R.relink=await js(`(async()=>{const j=JSON.parse(projJSON());const paths=j.media.map(m=>m.path);
    for(const k in EL){try{EL[k].pause()}catch(e){}delete EL[k]}
    j.media=j.media.filter(m=>m.path);__EE.M.clear();__EE.S.clips.length=0;loadProj(j,true);
    const t0=Date.now();await new Promise(r=>{const w=()=>{if([...__EE.M.values()].every(m=>!m.offline&&m.url))r();else if(Date.now()-t0>30000)r();else setTimeout(w,200)};w()});
    return {paths,ok:[...__EE.M.values()].map(m=>({n:m.name,offline:!!m.offline,proxy:!!m.proxyUrl,file:!!m.file})),secs:(Date.now()-t0)/1000}})()`);
  log('reabrir',JSON.stringify(R.relink));
};
