/* ==================================================================
   MÁSCARA AUTOMÁTICA CON IA · SAM 2.1 (Meta, Apache-2.0)
   runtime: sam2-from-scratch/web (Apache-2.0), en src/sam2.bundle.js
   modelos: carpeta models/sam2/ (ver models/sam2/LEEME.txt)
   ================================================================== */
(()=>{
const ORT_V='1.22.0',BASE='models/sam2/',AI_FPS=15;
const A={sess:null,consts:null,loading:null,pick:false,run:null,trackers:new Map(),cache:new Map()};
const info=t=>{const e=$('#aiInfo');if(e)e.innerHTML=t};
const bar=f=>{const e=$('#aiBar');if(e)e.style.width=(clamp(f,0,1)*100)+'%'};
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('no pude cargar '+src));document.head.appendChild(s)})}
async function ready(){
  if(A.sess)return;
  if(A.loading)return A.loading;
  A.loading=(async()=>{
    const head=await fetch(BASE+'constants_512.json').catch(()=>null);
    if(!head||!head.ok)throw new Error('NOMODEL');
    A.consts=SAM2.parseConstants(await head.text());
    if(!window.ort)await loadScript(`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_V}/dist/ort.webgpu.min.js`);
    SAM2.configureOrt(window.ort,ORT_V);
    const provider=await SAM2.pickProvider();
    info(`Cargando la IA (${provider==='webgpu'?'tarjeta de video':'procesador'})…`);
    const prog={};
    A.sess=await SAM2.createSessions(SAM2.fetchLoader(BASE),{provider,size:512,onProgress:(f,x)=>{prog[f]=x;const v=Object.values(prog);bar(v.reduce((a,b)=>a+b,0)/6)}});
    A.provider=provider;bar(0);
  })();
  try{await A.loading}catch(e){A.loading=null;throw e}
}
/* fotogramas del clip en el tiempo del clip (respeta velocidad y recortes) */
function frameSource(c,m){
  const v=document.createElement('video');v.src=m.url;v.muted=true;v.preload='auto';v.playsInline=true;
  const n=Math.max(1,Math.ceil(c.dur*AI_FPS));
  const S=A.consts.image_size;
  return {count:n,video:v,srcAt:i=>clipSourceTimeAt(c,clamp(i/AI_FPS,0,c.dur-1e-3)),
    async get(i){
      const t=this.srcAt(i);
      if(v.readyState<1)await new Promise(r=>v.addEventListener('loadedmetadata',r,{once:true}));
      if(Math.abs(v.currentTime-t)>1e-3||v.readyState<2){await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=t})}
      return SAM2.normalize(SAM2.resizeToSquare(v,S),S,A.consts,4);
    }};
}
/* máscaras guardadas: por tiempo de la fuente, para que sobrevivan a recortes */
function store(c){let s=A.cache.get(c.id);if(!s){s={pts:[]};A.cache.set(c.id,s)}return s}
function putMask(c,srcT,lowRes,score){
  const m=A.consts.mask_size,cv2=document.createElement('canvas');cv2.width=m;cv2.height=m;
  const g=cv2.getContext('2d'),im=g.createImageData(m,m);
  for(let i=0;i<m*m;i++){const a=score>0?255/(1+Math.exp(-lowRes[i]*1.2)):0;im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=a}
  g.putImageData(im,0,0);
  const s=store(c);const k=Math.round(srcT*1000);const i=s.pts.findIndex(p=>p.k===k);
  const rec={k,s:srcT,cv:cv2};if(i>=0)s.pts[i]=rec;else{s.pts.push(rec);s.pts.sort((a,b)=>a.k-b.k)}
  saveLater(c);
}
PRO.aiMaskAt=(c,t)=>{
  const s=A.cache.get(c.id);if(!s||!s.pts.length)return null;
  const st=clipSourceTimeAt(c,clamp(t-c.start,0,c.dur)),P=s.pts;
  let lo=0,hi=P.length-1;while(hi-lo>1){const mm=(lo+hi)>>1;if(P[mm].s<=st)lo=mm;else hi=mm}
  const best=Math.abs(P[lo].s-st)<=Math.abs(P[hi].s-st)?P[lo]:P[hi];
  return Math.abs(best.s-st)<=1.6/AI_FPS?best.cv:null;
};
PRO.aiApply=()=>{};   // se aplica dentro del clip (PRO.aiSrc), no como capa
const tmp=document.createElement('canvas');
PRO.aiSrc=(c,src,sw,sh)=>{
  if(!c.ai||c.ai.off)return null;
  const mk=PRO.aiMaskAt(c,S.t);if(!mk)return c.ai.fg!==false?blank(sw,sh):null;
  const k=Math.min(1,1920/Math.max(sw,sh)),W=Math.round(sw*k),H=Math.round(sh*k);
  if(tmp.width!==W||tmp.height!==H){tmp.width=W;tmp.height=H}
  const g=tmp.getContext('2d');g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.drawImage(src,0,0,W,H);
  g.globalCompositeOperation=c.ai.fg===false?'destination-out':'destination-in';g.imageSmoothingQuality='high';g.drawImage(mk,0,0,W,H);
  g.globalCompositeOperation='source-over';return tmp;
};
function blank(w,h){if(tmp.width!==8){tmp.width=8;tmp.height=8}tmp.getContext('2d').clearRect(0,0,8,8);return tmp}
/* guardado en el navegador (IndexedDB) para no perder el trabajo al recargar */
let db=null;
function idb(){if(db)return db;db=new Promise((ok,ko)=>{const r=indexedDB.open('ee-ai-masks',1);r.onupgradeneeded=()=>r.result.createObjectStore('m');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});return db}
const saveT=new Map();
function saveLater(c){clearTimeout(saveT.get(c.id));saveT.set(c.id,setTimeout(async()=>{
  try{const s=store(c),d=await idb(),blobs=await Promise.all(s.pts.map(p=>new Promise(r=>p.cv.toBlob(b=>r({s:p.s,k:p.k,b}),'image/png'))));
    await new Promise((ok,ko)=>{const tx=d.transaction('m','readwrite');tx.objectStore('m').put(blobs,c.ai&&c.ai.key||c.id);tx.oncomplete=ok;tx.onerror=()=>ko(tx.error)})}catch(e){console.warn('ai save',e)}},800))}
async function loadSaved(c){
  if(!c.ai||A.cache.has(c.id))return;
  try{const d=await idb(),rows=await new Promise((ok,ko)=>{const r=d.transaction('m').objectStore('m').get(c.ai.key||c.id);r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});
    if(!rows)return;const s=store(c);
    for(const r of rows){const im=await createImageBitmap(r.b),cv2=document.createElement('canvas');cv2.width=im.width;cv2.height=im.height;cv2.getContext('2d').drawImage(im,0,0);s.pts.push({k:r.k,s:r.s,cv:cv2})}
    s.pts.sort((a,b)=>a.k-b.k);renderFrame();
  }catch(e){console.warn('ai load',e)}
}
/* ---- interacción ---- */
function tracker(c){
  let T=A.trackers.get(c.id);if(T&&T.dur===c.dur&&T.inn===(c.in||0))return T;
  const m=M.get(c.mediaId);const fs=frameSource(c,m);
  T={dur:c.dur,inn:c.in||0,fs,vt:null,pts:{},m};A.trackers.set(c.id,T);return T;
}
async function click(e){
  const c=selClip();if(!c||c.type!=='video')return toast('Selecciona un clip de video.');
  const bb=c._bb;if(!bb)return;
  const r=cv.getBoundingClientRect(),px=(e.clientX-r.left)*S.w/r.width,py=(e.clientY-r.top)*S.h/r.height;
  const u=(px-(bb.cx-bb.w/2))/bb.w,v=(py-(bb.cy-bb.h/2))/bb.h;
  if(u<0||u>1||v<0||v>1)return toast('Toca dentro del video.');
  const neg=e.button===2||e.altKey;
  try{
    info('Preparando la IA…');await ready();
    const T=tracker(c);const fs=T.fs;
    if(fs.video.readyState<1)await new Promise(r=>fs.video.addEventListener('loadedmetadata',r,{once:true}));
    const W=fs.video.videoWidth,H=fs.video.videoHeight;
    if(!T.vt)T.vt=new SAM2.VideoTracker(A.sess,A.consts,fs,{width:W,height:H});
    const f=clamp(Math.round((S.t-c.start)*AI_FPS),0,fs.count-1);
    (T.pts[f]=T.pts[f]||{p:[],l:[]});T.pts[f].p.push({x:u*W,y:v*H});T.pts[f].l.push(neg?0:1);
    info('La IA está mirando este fotograma…');
    const out=await T.vt.addClick(f,T.pts[f].p,T.pts[f].l);
    if(!c.ai)c.ai={key:c.id+'_'+Date.now().toString(36),fg:$('#aiFg').checked};
    putMask(c,fs.srcAt(f),out.lowRes,out.score);commit();renderAll();
    info(out.score>0?'✓ Objeto marcado. Toca más partes para sumarlas (clic derecho o Alt = quitar), o pulsa <b>▶ Seguir por el clip</b>.':'No encontré un objeto ahí; prueba tocando más al centro del objeto.');
  }catch(err){fail(err)}
}
function fail(err){
  console.error(err);
  if(err&&err.message==='NOMODEL')info('⚠ Falta el modelo de IA en <code>models/sam2/</code>. Abre <b>models/sam2/LEEME.txt</b> para instalarlo (una sola vez).');
  else info('⚠ La IA falló: '+(err&&err.message||err));
}
async function track(){
  const c=selClip();if(!c||!c.ai)return toast('Primero toca el objeto con 🎯.');
  if(A.run){A.run.stop=true;return}
  const T=A.trackers.get(c.id);if(!T||!T.vt||!T.vt.hasPrompts)return toast('Primero toca el objeto con 🎯 en este clip.');
  const run=A.run={stop:false};$('#aiTrack').textContent='■ Detener';
  try{
    const first=T.vt.promptedFrames[0],n=T.fs.count;let done=0;const t0=performance.now();
    const step=async(rev)=>{for await(const fr of T.vt.propagate(first,rev)){if(run.stop)break;
      putMask(c,T.fs.srcAt(fr.frame),fr.lowRes,fr.score);done++;bar(done/n);
      const sp=(performance.now()-t0)/done/1000;info(`Siguiendo el objeto… ${done}/${n} fotogramas · faltan ~${Math.ceil(sp*(n-done))} s`);
      if(done%3===0){seek(c.start+fr.frame/AI_FPS)}}};
    await step(false);if(!run.stop&&first>0)await step(true);
    info(run.stop?'Detenido. Lo seguido hasta aquí ya quedó aplicado.':`✓ Listo: ${done} fotogramas. Si en algún momento se equivoca, ve ahí, toca de nuevo y vuelve a seguir.`);
  }catch(err){fail(err)}
  finally{A.run=null;$('#aiTrack').textContent='▶ Seguir por el clip';bar(0);renderAll()}
}
PRO.initAi=()=>{
  if(!$('#aiPick'))return;
  $('#aiPick').onclick=()=>{A.pick=!A.pick;$('#aiPick').classList.toggle('on',A.pick);if(A.pick){toast('Toca el objeto en el visor.');ready().catch(fail)}};
  $('#aiTrack').onclick=track;
  $('#aiFg').onchange=()=>{const c=selClip();if(c&&c.ai){c.ai.fg=$('#aiFg').checked;commit();renderFrame()}};
  $('#stage').addEventListener('pointerdown',e=>{if(!A.pick||S.zr)return;e.stopPropagation();e.preventDefault();click(e)},true);
  $('#stage').addEventListener('contextmenu',e=>{if(A.pick)e.preventDefault()},true);
  S.clips.forEach(c=>c.ai&&loadSaved(c));
  const r=PRO.onSel;PRO.onSel=(c,root)=>{try{r&&r(c,root)}finally{if(c&&c.ai){loadSaved(c);$('#aiFg').checked=c.ai.fg!==false}}};
};
})();
