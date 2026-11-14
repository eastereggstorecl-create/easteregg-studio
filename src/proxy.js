/* ==================================================================
   PROXIES: copias livianas (720p) para editar fluido.
   El visor usa el proxy; la exportación, las capturas y la IA usan el original.
   ================================================================== */
(()=>{
const PX={busy:false,cancel:false,db:null};
const big=m=>m&&m.type==='video'&&m.w&&Math.min(m.w,m.h)>1100;
const keyOf=m=>m.file?`${m.name}|${m.file.size}|${m.file.lastModified}`:null;
/* el visor usa proxies cuando «Vista previa» no está en «Completa» */
PRO.pxOn=m=>!!(m&&m.proxyUrl&&!S.exporting&&PRO.prevCap&&PRO.prevCap()>0);
/* video del proxy (sin sonido) + audio del original en un elemento solo de audio (no decodifica la imagen 4K) */
PRO.pxAudio=(v,m)=>{
  const a=document.createElement('audio');a.src=m.url;a.preload='auto';
  attachAudio(a);v._aud=a;v._g=a._g;v._hp=a._hp;v._cp=a._cp;
};
PRO.audSync=(el,target)=>{
  const a=el._aud;if(!a)return;
  if(!el._g&&a._g){el._g=a._g;el._hp=a._hp;el._cp=a._cp}
  if(Math.abs(a.playbackRate-el.playbackRate)>.01)a.playbackRate=el.playbackRate;
  if(S.playing&&!el.paused){
    if(a.paused){if(Math.abs(a.currentTime-target)>.05)a.currentTime=target;a.play().catch(()=>{})}
    else if(Math.abs(a.currentTime-target)>.2&&!a.seeking)a.currentTime=target;
  }else if(!a.paused)a.pause();
};
/* ---------- guardado en el navegador ---------- */
function idb(){if(PX.db)return PX.db;PX.db=new Promise((ok,ko)=>{const r=indexedDB.open('ee-proxies',1);r.onupgradeneeded=()=>r.result.createObjectStore('p');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});return PX.db}
async function dbGet(k){const d=await idb();return new Promise((ok,ko)=>{const r=d.transaction('p').objectStore('p').get(k);r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)})}
async function dbPut(k,v){const d=await idb();return new Promise((ok,ko)=>{const t=d.transaction('p','readwrite');t.objectStore('p').put(v,k);t.oncomplete=ok;t.onerror=()=>ko(t.error)})}
async function restore(m){
  if(m.proxyUrl||m.type!=="video")return;
  if(PRO.nat&&m.nativePath){try{const r=await eeNative.proxyCached(m.nativePath);if(r){m.proxyUrl=r.url;m.proxyH=720;renderBin&&renderBin()}}catch(e){}return}
  const k=keyOf(m);if(!k)return;
  try{const b=await dbGet(k);if(b){m.proxyUrl=URL.createObjectURL(b);m.proxyH=720;renderBin&&renderBin()}}catch(e){console.warn('proxy',e)}
}
PRO.pxRestore=restore;
PRO.pxRestoreAll=()=>{M.forEach(m=>{if(m.file)restore(m)})};
/* ---------- crear el proxy: reproducir rápido, sin sonido, y codificar cada fotograma ---------- */
async function pickCodec(W,H){
  for(const codec of ['avc1.640028','avc1.4d0028','avc1.42E028','avc1.42E01F']){
    const cfg={codec,width:W,height:H,bitrate:3e6,framerate:30,latencyMode:'quality',avc:{format:'avc'}};
    try{if((await VideoEncoder.isConfigSupported(cfg)).supported)return cfg}catch(_){}
  }
  throw new Error('Tu navegador no puede codificar H.264');
}
async function makeProxy(m,onProg){
  const v=document.createElement('video');v.src=m.url;v.muted=true;v.playsInline=true;v.preload='auto';
  await new Promise((ok,ko)=>{v.onloadedmetadata=ok;v.onerror=()=>ko(new Error('no pude abrir el video'))});
  const k=720/Math.min(v.videoWidth,v.videoHeight),W=Math.round(v.videoWidth*k/2)*2,H=Math.round(v.videoHeight*k/2)*2,dur=v.duration||m.dur;
  const cv2=document.createElement('canvas');cv2.width=W;cv2.height=H;const g=cv2.getContext('2d');g.imageSmoothingQuality='medium';
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H},fastStart:'in-memory',firstTimestampBehavior:'offset'});
  let err=null;const enc=new VideoEncoder({output:(ch,meta)=>muxer.addVideoChunk(ch,meta),error:e=>err=e});
  enc.configure(await pickCodec(W,H));
  let lastTs=-1,lastKey=-9,first=true,frames=0,rate=3;
  v.playbackRate=rate;
  const done=new Promise(res=>{v.onended=res});
  const t0=performance.now();
  const step=(now,md)=>{
    if(PX.cancel||err){v.pause();return}
    const mt=first?0:md.mediaTime;first=false;
    const ts=Math.round(mt*1e6);
    if(ts>lastTs){
      g.drawImage(v,0,0,W,H);
      const fr=new VideoFrame(cv2,{timestamp:ts});const key=mt-lastKey>=1;if(key)lastKey=mt;
      enc.encode(fr,{keyFrame:key});fr.close();lastTs=ts;frames++;
    }
    // velocidad adaptable: más rápido si alcanza a captar ~24 fotogramas por segundo de video
    if(frames%30===0&&mt>1){const fps=frames/mt;rate=clamp(fps>27?rate*1.25:fps<20?rate*.8:rate,1,8);v.playbackRate=rate;
      if(enc.encodeQueueSize>40)v.playbackRate=Math.max(1,rate/2)}
    onProg(mt/dur,(performance.now()-t0)/1000);
    v.requestVideoFrameCallback(step);
  };
  v.requestVideoFrameCallback(step);
  await v.play();
  await Promise.race([done,new Promise(r=>{const iv=setInterval(()=>{if(PX.cancel||err){clearInterval(iv);r()}},200)})]);
  v.pause();
  if(err)throw err;if(PX.cancel){try{enc.close()}catch(_){}return null}
  await enc.flush();enc.close();muxer.finalize();
  v.removeAttribute('src');v.load();
  return new Blob([muxer.target.buffer],{type:'video/mp4'});
}
async function buildAll(){
  if(PX.busy){PX.cancel=true;if(PRO.nat)eeNative.cancel();return}
  const used=new Set(S.clips.map(c=>c.mediaId));
  const list=[...M.values()].filter(m=>big(m)&&!m.proxyUrl&&m.file&&used.has(m.id));
  const all=[...M.values()].filter(m=>big(m)&&!m.proxyUrl&&m.file);
  const todo=list.length?list:all;
  if(!todo.length)return toast([...M.values()].some(big)?'Tus videos grandes ya tienen proxy ⚡.':'No hay videos 4K o 2K que necesiten proxy.');
  PX.busy=true;PX.cancel=false;const btn=$('#bProxy');btn.textContent='■ Detener proxies';
  const info=$('#pxInfo');let ok=0;
  try{
    for(let i=0;i<todo.length;i++){
      const m=todo[i];
      const prog=(f,s)=>{info.innerHTML=`⚡ Creando proxy ${i+1}/${todo.length}: <b>${m.name}</b> · ${Math.round(f*100)}%${f>.02?` · faltan ~${Math.max(1,Math.round(s/f-s))} s`:''}<br>${PRO.nat?'FFmpeg con tu GPU: puedes seguir editando.':'Deja esta pestaña a la vista mientras trabaja.'}`;$('#pxBar').style.width=(f*100)+'%'};
      if(PRO.nat&&m.nativePath){
        let r=null;const t0=performance.now();
        try{r=await eeNative.proxy(m.nativePath,f=>prog(f,(performance.now()-t0)/1000))}catch(e){if(PX.cancel)break;throw e}
        m.proxyUrl=r.url;m.proxyH=720;ok++;
        for(const k in EL){if(EL[k].src===m.url&&k.indexOf('P')!==0){EL[k].pause()}}
        continue;
      }
      const blob=await makeProxy(m,prog);
      if(!blob)break;
      m.proxyUrl=URL.createObjectURL(blob);m.proxyH=720;ok++;
      try{await dbPut(keyOf(m),blob)}catch(e){console.warn('proxy save',e)}
      for(const k in EL){if(EL[k].src===m.url&&k.indexOf('P')!==0){EL[k].pause()}}
    }
  }catch(e){console.error(e);toast('No pude crear el proxy: '+e.message,8000)}
  finally{
    PX.busy=false;btn.textContent=PRO.nat?'⚡ Crear proxies con la GPU (segundos)':'⚡ Crear proxies (editar fluido)';$('#pxBar').style.width='0';
    info.innerHTML=ok?`✓ ${ok} proxy(s) listos. El visor ya los usa (con «Vista previa» en 720p/1080p/540p); al exportar se usan tus originales.`:(PX.cancel?'Detenido.':'');
    if(PRO.prevCap()===0&&ok){const s=$('#prevRes');if(s){s.value='720';s.onchange()}}
    renderBin&&renderBin();renderAll();
  }
}
PRO.initPx=()=>{
  const bin=$('#bin');if(!bin)return;
  const box=document.createElement('div');box.className='pxbox';
  box.innerHTML=`<button id="bProxy" title="Hace copias livianas en 720p de tus videos 4K para que el editor vaya fluido. Al exportar se usan los originales.">⚡ Crear proxies (editar fluido)</button>
    <div class="meter"><i id="pxBar" style="width:0"></i></div><div class="hint" id="pxInfo">¿Videos 4K lentos? Crea proxies: editas con copias livianas y exportas con los originales.</div>`;
  bin.before(box);
  if(PRO.nat){$('#bProxy').textContent='⚡ Crear proxies con la GPU (segundos)';$('#pxInfo').textContent='¿Videos 4K lentos? La app crea copias livianas 720p con FFmpeg y tu tarjeta de video. Exportas con los originales.'}
  $('#bProxy').onclick=buildAll;
  PRO.pxRestoreAll();
};
PRO._px={makeProxy,PX};
})();
