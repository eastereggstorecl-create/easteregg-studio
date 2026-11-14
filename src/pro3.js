/* ==================================================================
   PRO 3 · editor de velocidad con zoom, transiciones, zoom suave, máscaras
   ================================================================== */
(()=>{
const LSg=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}};

/* ------------------------------------------------------------------
   1. EDITOR DE VELOCIDAD CON ZOOM (reemplaza al gráfico de 290 px)
   ------------------------------------------------------------------ */
const SV={id:null,u0:0,u1:1,follow:true,lastT:-1,lastKey:''};
function sCv(){return $('#speedGraphCv')}
function view(c){
  if(SV.id!==c.id){SV.id=c.id;SV.u0=0;SV.u1=1}
  return [SV.u0,SV.u1];
}
function setView(u0,u1){
  const span=clamp(u1-u0,.004,1);
  u0=clamp(u0,0,1-span);SV.u0=u0;SV.u1=u0+span;PRO.drawSpeed();
  const sb=$('#spdScroll');if(sb){sb.max=Math.max(0,1-span);sb.step=span/50;sb.value=u0;sb.style.visibility=span<.999?'visible':'hidden'}
}
PRO.drawSpeed=()=>{
  const cvg=sCv();if(!cvg)return;
  const dpr=Math.min(2,devicePixelRatio||1),cw=Math.max(200,cvg.clientWidth|0),chh=Math.max(120,cvg.clientHeight|0);
  if(cvg.width!==Math.round(cw*dpr)||cvg.height!==Math.round(chh*dpr)){cvg.width=Math.round(cw*dpr);cvg.height=Math.round(chh*dpr)}
  const g=cvg.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const W=cw,H=chh,top=18,bot=14;g.clearRect(0,0,W,H);
  const yOf=v=>H-bot-((clamp(v,.1,4)-.1)/3.9)*(H-top-bot),vOf=y=>clamp(.1+((H-bot-y)/(H-top-bot))*3.9,.1,4);
  const c=selClip();
  g.font='10px JetBrains Mono';
  [.25,.5,1,2,3,4].forEach(v=>{const y=yOf(v);g.strokeStyle=v===1?'#2f9bff44':'#ffffff10';g.lineWidth=1;g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();
    g.fillStyle=v===1?'#6cc0ff':'#77777f';g.fillText(v+'x',4,y-3)});
  if(!c||(c.type!=='video'&&c.type!=='audio')){g.fillStyle='#8a8a93';g.font='12px Inter';g.textAlign='center';g.fillText('Selecciona un clip de video o audio',W/2,H/2);g.textAlign='left';cvg._h=null;return}
  const [u0,u1]=view(c),X=u=>(u-u0)/(u1-u0)*W,U=x=>u0+x/W*(u1-u0);
  // regla de tiempo y fotogramas
  const fps=S.fps||30,pxPerSec=W/((u1-u0)*c.dur),pxPerF=pxPerSec/fps;
  g.fillStyle='#ffffff08';g.fillRect(0,0,W,top-4);
  const steps=[1/fps,2/fps,5/fps,.1,.25,.5,1,2,5,10,30,60];let st=steps.find(s=>s*pxPerSec>=70)||60;
  const t0=u0*c.dur,t1=u1*c.dur;
  for(let t=Math.ceil(t0/st)*st;t<=t1+1e-9;t+=st){const x=X(t/c.dur);g.strokeStyle='#ffffff22';g.beginPath();g.moveTo(x,top-6);g.lineTo(x,H-bot);g.stroke();
    g.fillStyle='#9a9aa3';g.fillText(st<1?(t.toFixed(st<.1?3:2)+'s'):fmt(t).slice(3,8),x+3,10)}
  if(pxPerF>=7){g.strokeStyle='#ffffff0d';for(let f=Math.ceil(t0*fps);f<=t1*fps;f++){const x=X(f/fps/c.dur);g.beginPath();g.moveTo(x,top-4);g.lineTo(x,H-bot);g.stroke()}
    g.fillStyle='#6cc0ff';g.fillText('fotograma a fotograma',W-130,H-3)}
  // curva
  g.beginPath();
  for(let x=0;x<=W;x+=2){const u=clamp(U(x),0,1),v=clamp(c.speed*speedCurveMultiplierAt(c,u),.1,4),y=yOf(v);if(x===0)g.moveTo(x,y);else g.lineTo(x,y)}
  g.strokeStyle='#2f9bff';g.lineWidth=2.4;g.stroke();g.lineTo(W,H-bot);g.lineTo(0,H-bot);g.closePath();g.fillStyle='#2f9bff1c';g.fill();
  // línea de tiempo (sincronizada con el timeline y el visor)
  if(active(c,S.t)||Math.abs(S.t-c.start-c.dur)<1e-3){
    const u=clamp((S.t-c.start)/Math.max(1e-5,c.dur),0,1),x=X(u);
    if(x>=-1&&x<=W+1){g.strokeStyle='#ff4d6d';g.lineWidth=2;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();
      g.fillStyle='#ff4d6d';g.beginPath();g.moveTo(x-5,0);g.lineTo(x+5,0);g.lineTo(x,7);g.fill()}
    const lbl=$('#speedGraphLabel');if(lbl)lbl.textContent=`Velocidad: ${clipInstantSpeedAt(c,S.t-c.start).toFixed(2)}x · ${fmt(S.t-c.start).slice(0,8)} · zoom ${(1/(u1-u0)).toFixed(1)}x`;
  }
  const sc=c.speedCurve&&c.speedCurve.length>=2?c.speedCurve:null;
  if(sc)sc.forEach(p=>{const x=X(p.u);if(x<-8||x>W+8)return;const y=yOf(clamp(p.v*c.speed,.1,4));
    g.fillStyle='#fff';g.strokeStyle='#2f9bff';g.lineWidth=2.5;g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.fill();g.stroke()});
  cvg._h={X,U,yOf,vOf,W,H,c};
};
function speedTick(){
  const cvg=sCv();if(!cvg||!cvg.offsetParent)return;
  const c=selClip();const key=(c?c.id+'|'+c.dur+'|'+JSON.stringify(c.speedCurve||[])+'|'+c.speed:'')+'|'+cvg.clientWidth;
  if(S.t===SV.lastT&&key===SV.lastKey)return;
  SV.lastT=S.t;SV.lastKey=key;
  // la vista sigue a la línea mientras reproduces
  if(c&&SV.follow&&SV.id===c.id&&S.playing&&SV.u1-SV.u0<.999){const u=(S.t-c.start)/c.dur;if(u>SV.u1-.02||u<SV.u0){const s=SV.u1-SV.u0;setView(u-s*.1,u+s*.9);return}}
  PRO.drawSpeed();
}
PRO.speedTick=speedTick;
function wireSpeed(){
  const old=sCv();if(!old)return;
  const cvg=old.cloneNode(false);old.replaceWith(cvg);   // quita los controles antiguos
  cvg.style.height='190px';
  const bar=document.createElement('div');bar.className='row';bar.style.cssText='margin-top:6px;gap:6px;align-items:center';
  bar.innerHTML=`<button id="spdZo" title="Alejar">－</button><button id="spdZi" title="Acercar">＋</button><button id="spdFit" title="Ver todo el clip">Todo</button>
    <button id="spdHere" title="Acercar alrededor de la línea de tiempo">◎ En la línea</button>
    <input type="range" id="spdScroll" min="0" max="0" step="0.001" value="0" style="flex:1;visibility:hidden" title="Desplazar">`;
  cvg.after(bar);
  const hint=bar.nextElementSibling;
  if(hint&&hint.classList.contains('hint'))hint.innerHTML='<b>Rueda</b> (o pellizco) = zoom en el tiempo · <b>Shift + rueda</b> o arrastrar con clic derecho = desplazar · <b>clic</b> en el gráfico = mover la línea de tiempo ahí · arrastra los puntos · <b>doble clic</b> añade o borra un punto. Con mucho zoom ves cada fotograma.';
  const zoomAt=(u,f)=>{const s=clamp((SV.u1-SV.u0)*f,.004,1),r=(u-SV.u0)/(SV.u1-SV.u0);setView(u-r*s,u-r*s+s)};
  const curU=()=>{const c=selClip();return c?clamp((S.t-c.start)/c.dur,0,1):.5};
  $('#spdZi').onclick=()=>zoomAt(curU(),.5);$('#spdZo').onclick=()=>zoomAt(curU(),2);$('#spdFit').onclick=()=>setView(0,1);
  $('#spdHere').onclick=()=>{const c=selClip();if(!c)return;const u=curU(),s=Math.min(1,1.5/c.dur);setView(u-s/2,u+s/2)};
  $('#spdScroll').oninput=e=>{const s=SV.u1-SV.u0;setView(+e.target.value,+e.target.value+s)};
  const pos=e=>{const r=cvg.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  cvg.addEventListener('wheel',e=>{const h=cvg._h;if(!h)return;e.preventDefault();
    if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){const s=SV.u1-SV.u0,d=(e.shiftKey?e.deltaY:e.deltaX)/h.W*s;setView(SV.u0+d,SV.u1+d);return}
    const [x]=pos(e);zoomAt(h.U(x),Math.exp(e.deltaY*.0018))},{passive:false});
  cvg.addEventListener('contextmenu',e=>e.preventDefault());
  let pinch=null;const ptrs=new Map();
  cvg.addEventListener('pointerdown',e=>{
    const h=cvg._h;if(!h)return;const c=h.c;e.preventDefault();
    ptrs.set(e.pointerId,e);try{cvg.setPointerCapture(e.pointerId)}catch(_){}
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],r=cvg.getBoundingClientRect();pinch={d:Math.abs(a.clientX-b.clientX)||1,u:h.U((a.clientX+b.clientX)/2-r.left),s:SV.u1-SV.u0};return}
    const [x,y]=pos(e);
    if(e.button===2||e.button===1){const x0=e.clientX,a0=SV.u0,s=SV.u1-SV.u0;
      const mv=ev=>setView(a0-(ev.clientX-x0)/h.W*s,a0-(ev.clientX-x0)/h.W*s+s);
      const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up)};addEventListener('pointermove',mv);addEventListener('pointerup',up);return}
    if(!c.speedCurve||c.speedCurve.length<2)c.speedCurve=[{u:0,v:1},{u:1,v:1}];
    const sc=c.speedCurve;
    const hit=sc.findIndex(p=>Math.hypot(h.X(p.u)-x,h.yOf(clamp(p.v*c.speed,.1,4))-y)<12);
    const now=performance.now(),dbl=cvg._last&&now-cvg._last<330;cvg._last=now;
    if(dbl){cvg._last=0;
      if(hit>0&&hit<sc.length-1){sc.splice(hit,1)}
      else if(hit<0){sc.push({u:clamp(h.U(x),.001,.999),v:clamp(h.vOf(y)/c.speed,.1,4)});sc.sort((a,b)=>a.u-b.u)}
      commit();renderAll();PRO.drawSpeed();return}
    if(hit<0){ // clic en el gráfico = mover la línea de tiempo (y arrastrar = recorrer)
      const go=ev=>{const [xx]=pos(ev);seek(c.start+clamp(h.U(xx),0,1)*(c.dur-1e-4))};go(e);
      const mv=ev=>{if(ptrs.size<2)go(ev)};const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up)};
      addEventListener('pointermove',mv);addEventListener('pointerup',up);return}
    const oldAvg=speedCurveAvg(c),srcSpan=c.dur*c.speed*oldAvg;
    const mv=ev=>{if(ptrs.size>1)return;const [mx,my]=pos(ev);
      if(hit===0)sc[hit].u=0;else if(hit===sc.length-1)sc[hit].u=1;
      else{const gap=Math.min(.03,(SV.u1-SV.u0)*.02);sc[hit].u=clamp(h.U(mx),sc[hit-1].u+gap,sc[hit+1].u-gap)}
      sc[hit].v=clamp(h.vOf(my)/c.speed,.12,4);
      c.dur=Math.max(.15,srcSpan/(c.speed*speedCurveAvg(c)));PRO.drawSpeed();renderTimeline();renderFrame()};
    const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);commit();renderAll()};
    addEventListener('pointermove',mv);addEventListener('pointerup',up);
  });
  cvg.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,e);
    if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()],d=Math.abs(a.clientX-b.clientX)||1,s=clamp(pinch.s*pinch.d/d,.004,1);setView(pinch.u-s/2,pinch.u+s/2)}});
  const end=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null};
  cvg.addEventListener('pointerup',end);cvg.addEventListener('pointercancel',end);
  addEventListener('resize',()=>PRO.drawSpeed());
}

/* ------------------------------------------------------------------
   bucle: el gráfico de velocidad sigue a la línea en tiempo real
   ------------------------------------------------------------------ */
function loop(){try{speedTick()}catch(e){console.error(e)}requestAnimationFrame(loop)}

/* la línea de tiempo se arrastra: desde la línea misma, la regla o el espacio vacío del timeline */
function wireScrub(){
  const tin=$('#tlin'),ph=$('#ph');
  const scrub=e=>{
    e.preventDefault();e.stopPropagation();
    const wasPlaying=S.playing;if(wasPlaying)pause();
    const go=ev=>{const r=tin.getBoundingClientRect();seek(clamp((ev.clientX-r.left)/S.pps,0,Math.max(total(),.01)))};
    go(e);document.body.classList.add('scrubbing');
    const up=()=>{removeEventListener('pointermove',go);removeEventListener('pointerup',up);document.body.classList.remove('scrubbing');if(wasPlaying)play()};
    addEventListener('pointermove',go);addEventListener('pointerup',up);
  };
  ph.addEventListener('pointerdown',e=>{if(e.button===0)scrub(e)});
  $('#tracks').addEventListener('pointerdown',e=>{
    if(e.button!==0||e.shiftKey||e.ctrlKey||e.metaKey||e.pointerType==='touch'||!e.target.classList.contains('trk'))return;
    S.sel=null;MS.clear();renderAll();scrub(e);
  },true);
}
/* ------------------------------------------------------------------
   VISTA PREVIA LIVIANA: el visor se dibuja más chico, la exportación sale completa
   ------------------------------------------------------------------ */
const PREV_KEY='ee-pro-prev';
PRO.prevCap=()=>{const v=LSg(PREV_KEY,MOB?720:0);return +v||0};
function wirePrev(){
  const res=$('#res');if(!res)return;
  const l=document.createElement('label');l.title='Solo cambia lo que ves mientras editas. La exportación sale a la resolución elegida en «Resolución».';
  l.innerHTML=`Vista previa <select id="prevRes"><option value="0">Completa</option><option value="1080">1080p</option><option value="720">720p</option><option value="540">540p (más rápida)</option></select>`;
  res.parentElement.after(l);
  const sel=$('#prevRes');sel.value=String(PRO.prevCap());
  sel.onchange=()=>{try{localStorage.setItem(PREV_KEY,JSON.stringify(+sel.value))}catch(_){}
    setSize();renderAll();
    toast(+sel.value?`Vista previa a ${sel.value}p: el editor va más liviano. Al exportar sale a ${S.w>S.h?'la resolución completa':'resolución completa'} igual.`:'Vista previa completa.',5000)};
  // en el celular el menú de Proyecto ya existe: mover el selector ahí
  if(MOB&&$('#mProj'))$('#mProj').insertBefore(l,$('#mProj').querySelector('.hint'));
}
/* ------------------------------------------------------------------
   RESOLUCIÓN NATIVA: la del video más grande del proyecto
   ------------------------------------------------------------------ */
function nativeOf(){
  let best=null;
  const used=new Set(S.clips.filter(c=>c.type==='video').map(c=>c.mediaId));
  M.forEach((m,id)=>{if(m.type!=='video'||!m.w||!m.h)return;if(used.size&&!used.has(id))return;if(!best||m.w*m.h>best.w*best.h)best=m});
  return best;
}
function nativeLabel(){const o=$('#res option[value=n]'),oa=$('#res option[value=a]');if(!o)return;const m=nativeOf();
  o.textContent=m?`⭐ Nativa (${m.w}×${m.h})`:'⭐ Nativa (igual al video)';
  if(oa)oa.textContent=m?`🧬 Adaptación nativa (todo a ${m.w}×${m.h})`:'🧬 Adaptación nativa (sube los demás al más grande)'}
/* ------------------------------------------------------------------
   ✂ CUTDROP: cada corte del timeline sale como su propio video
   ------------------------------------------------------------------ */
PRO.sliceAudio=(buf,a,b)=>{
  const sr=buf.sampleRate,i0=Math.max(0,Math.round(a*sr)),i1=Math.min(buf.length,Math.round(b*sr)),n=Math.max(1,i1-i0);
  const out=new AudioBuffer({numberOfChannels:buf.numberOfChannels,length:n,sampleRate:sr});
  for(let ch=0;ch<buf.numberOfChannels;ch++)out.copyToChannel(buf.getChannelData(ch).subarray(i0,i0+n),ch);
  return out;
};
PRO.exSave=null;
function cutList(){
  const vis=c=>c.type==='video'||c.type==='image';
  let list=MS.size>1?[...MS].map(id=>S.clips.find(c=>c.id===id)).filter(c=>c&&vis(c)):[];
  if(!list.length){list=S.clips.filter(c=>c.track==='V1'&&vis(c));if(!list.length)list=S.clips.filter(c=>c.track==='V2'&&vis(c))}
  return list.sort((a,b)=>a.start-b.start);
}
async function cutDrop(){
  const cuts=cutList();if(!cuts.length)return toast('No hay cortes de video en el timeline.');
  const base=(S.name||'proyecto').replace(/[^\w\- ]+/g,'').trim()||'proyecto';
  let dir=null;
  if(PRO.nat){
    const d=await eeNative.pickFolder();if(!d)return;
    return cutDropNat(cuts,base,d);
  }
  if(window.showDirectoryPicker){
    try{dir=await showDirectoryPicker({mode:'readwrite',id:'ee-cutdrop'})}catch(e){if(e&&e.name==='AbortError')return}
  }
  PRO.exSave=dir?async(blob,name)=>{const fh=await dir.getFileHandle(name,{create:true});const w=await fh.createWritable();await w.write(blob);await w.close()}:null;
  const eng=$('#exEngine'),oldEng=eng.value;eng.value='webcodecs';
  let done=0;
  try{
    for(let i=0;i<cuts.length;i++){
      const c=cuts[i],m=M.get(c.mediaId),nm=((m&&m.name)||'corte').replace(/\.[^.]+$/,'').replace(/[^\w\- ]+/g,'').slice(0,40);
      PRO.exRange={a:c.start,b:c.start+c.dur,name:`${base}-corte-${String(i+1).padStart(2,'0')}-${nm}`};
      toast(`✂ CutDrop: corte ${i+1} de ${cuts.length}…`,4000);
      await doExport();
      if(exCancel||PRO.encErr)break;
      done++;
    }
  }finally{PRO.exRange=null;PRO.exSave=null;eng.value=oldEng}
  toast(done===cuts.length?`✂ CutDrop listo: ${done} videos${dir?' guardados en la carpeta que elegiste':' en Descargas'}.`:`✂ CutDrop se detuvo: ${done} de ${cuts.length} videos exportados.`,9000);
}
/* en la app: cada corte se exporta con FFmpeg directo a la carpeta elegida */
async function cutDropNat(cuts,base,d){
  const eng=$('#exEngine'),oldEng=eng.value;eng.value='ffmpeg';PRO.exDir=d;
  let done=0;const t0=performance.now();
  try{
    for(let i=0;i<cuts.length;i++){
      const c=cuts[i],m=M.get(c.mediaId),nm=((m&&m.name)||'corte').replace(/\.[^.]+$/,'').replace(/[^\w\- ]+/g,'').slice(0,40);
      PRO.exRange={a:c.start,b:c.start+c.dur,name:`${base}-corte-${String(i+1).padStart(2,'0')}-${nm}`};
      toast(`✂ CutDrop: corte ${i+1} de ${cuts.length}…`,4000);
      await doExport();
      if(exCancel||PRO.encErr)break;
      done++;
    }
  }finally{PRO.exRange=null;PRO.exDir=null;eng.value=oldEng}
  toast(done===cuts.length?`✂ CutDrop listo: ${done} videos en ${d} (${Math.round((performance.now()-t0)/1000)} s).`:`✂ CutDrop se detuvo: ${done} de ${cuts.length} videos exportados.`,10000);
  if(done)eeNative.reveal(d);
}
function wireCutDrop(){
  const go=$('#bStartRender');if(!go)return;
  const b=document.createElement('button');b.id='bCutDrop';b.type='button';
  b.title='Exporta cada corte del timeline como su propio video, con todos sus efectos, textos y audio. Si seleccionas varios clips, solo esos.';
  b.innerHTML='✂ CutDrop · cada corte en su video';
  go.parentElement.insertBefore(b,go);
  b.onclick=()=>{$('#exportModal').style.display='none';cutDrop()};
}
PRO.resChange=v=>{
  if(v==='n'||v==='a'){
    const m=nativeOf();if(!m){toast('Pon primero un video en el timeline.');$('#res').value=String(S.res);return}
    S.res=Math.min(m.w,m.h);S.resNative=true;S.resAdapt=v==='a';
    if(S.resAdapt){
      // los videos más chicos se escalan con ULTIMATE al tamaño del grande; el grande queda intacto
      S.upMode='ultimate';const um=$('#upscaleMode');if(um)um.value='ultimate';
      const small=S.clips.filter(c=>c.type==='video').map(c=>M.get(c.mediaId)).filter(x=>x&&x.w&&Math.min(x.w,x.h)<S.res-8);
      const names=[...new Set(small.map(x=>`${x.w}×${x.h}`))].join(', ');
      toast(`🧬 Adaptación nativa: todo sale a ${m.w}×${m.h}. ${small.length?`Los videos más chicos (${names}) se escalan con 👑 ULTIMATE; `:''}el video grande no se toca.`,9000);
      setSize();commit();renderAll();nativeLabel();return;
    }
    // el formato sigue al video si es horizontal o vertical
    const ar=m.w/m.h;const asp=Math.abs(ar-16/9)<.03?'16:9':Math.abs(ar-9/16)<.03?'9:16':Math.abs(ar-1)<.03?'1:1':Math.abs(ar-.8)<.03?'4:5':null;
    if(asp&&asp!==S.aspect){S.aspect=asp;$('#aspect').value=asp}
    toast(`Resolución nativa: ${m.w}×${m.h}, igual a tu video. Para que no pierda nada, en Exportar elige «🏆 Máxima nativa».`,8000);
  }else{S.res=+v;S.resNative=false;S.resAdapt=false}
  setSize();commit();renderAll();nativeLabel();
};
PRO.init3=()=>{
  wireSpeed();wireScrub();wirePrev();wireCutDrop();nativeLabel();setSize();
  $('#res').addEventListener('focus',nativeLabel);$('#res').addEventListener('pointerdown',nativeLabel);
  requestAnimationFrame(loop);
  PRO.initFx3&&PRO.initFx3();
};
PRO._t3={SV,setView};
})();
