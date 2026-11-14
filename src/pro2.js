/* =====================================================================
   EASTEREGG PRO 2 — comparar antes/después, capturas, aplicar a todo,
   voz, subtítulos desde guion, Editor de Zoom con puntero huevito, modo SHORTS
   ===================================================================== */
(()=>{
const isVis=c=>!!c&&(c.type==='video'||c.type==='image');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const selList=()=>[...MS].map(id=>S.clips.find(c=>c.id===id)).filter(Boolean);
function topVis(t){for(const tid of ['V2','V1']){const c=S.clips.find(x=>x.track===tid&&isVis(x)&&active(x,t));if(c)return c}return null}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),120000)}
const safeName=()=>(S.name||'proyecto').replace(/[^\w\- ]+/g,'').trim()||'proyecto';
const LSg=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
const LSs=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
function tag(g,txt,x,y,align,u,col){
  g.save();g.font=`700 ${22*u}px Inter, sans-serif`;g.textBaseline='top';
  const w=g.measureText(txt).width+18*u,x0=align==='right'?x-w:x;
  g.fillStyle='#000000b0';g.fillRect(x0,y,w,34*u);g.fillStyle=col||'#fff';g.fillText(txt,x0+9*u,y+6*u);g.restore();
}

/* ------------------------------------------------------------------
   1. ANTES / DESPUÉS
   ------------------------------------------------------------------ */
S.bypass=false;S.safe=SHORTS;
let cmp=false,cmpX=.5,inSplit=false;const tmp=document.createElement('canvas');
PRO.split=function(cs){
  if(!cmp||inSplit||S.exporting||S.bypass)return false;
  inSplit=true;
  try{
    S.bypass=true;renderFrame(cs);
    if(tmp.width!==cv.width||tmp.height!==cv.height){tmp.width=cv.width;tmp.height=cv.height}
    tmp.getContext('2d').drawImage(cv,0,0);
    S.bypass=false;renderFrame(cs);
    const g=cx,x=Math.round(cv.width*cmpX),u=Math.min(S.w,S.h)/1080;
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.filter='none';
    g.drawImage(tmp,0,0,x,cv.height,0,0,x,cv.height);
    g.fillStyle='#fff';g.fillRect(x-2*u,0,4*u,cv.height);
    tag(g,'ANTES',x-12*u,14*u,'right',u);tag(g,'DESPUÉS',x+12*u,14*u,'left',u,'#6cc0ff');
    g.restore();
  }finally{inSplit=false;S.bypass=false}
  return true;
};
function setBypass(v){if(S.bypass===v)return;S.bypass=v;$('#bBefore')?.classList.toggle('on',v);renderFrame()}
function setCmp(v){cmp=v;$('#bCmp').classList.toggle('on',v);$('#cmpX').style.display=v?'':'none';renderFrame()}

/* ------------------------------------------------------------------
   Capas encima del monitor (zonas seguras, avisos) — nunca se exportan
   ------------------------------------------------------------------ */
PRO.overlay=g=>{
  const u=Math.min(S.w,S.h)/1080;
  g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.filter='none';
  if(S.safe&&S.h>S.w*1.3&&!S.zr){
    const W=S.w,H=S.h;g.fillStyle='#ff3b3b38';g.strokeStyle='#ff5a5a';g.lineWidth=4*u;g.setLineDash([12*u,9*u]);
    [[0,0,W,H*.075],[0,H*.8,W,H*.2],[W*.855,H*.4,W*.145,H*.4]].forEach(r=>{g.fillRect(...r);g.strokeRect(...r)});
    g.setLineDash([]);g.fillStyle='#ffb0b0';g.font=`600 ${20*u}px Inter`;g.textBaseline='top';
    g.fillText('Zona tapada por la app (no pongas texto aquí)',14*u,H*.8+10*u);
  }
  if(S.bypass&&!cmp&&!inSplit)tag(g,'ANTES · SIN EFECTOS',14*u,14*u,'left',u,'#ffd166');
  g.restore();
};

/* ------------------------------------------------------------------
   2. CAPTURADOR DE SCREENSHOTS
   ------------------------------------------------------------------ */
const shots=[];
async function capture(){
  if(!S.clips.length)return toast('No hay nada en el timeline para capturar.');
  const raw=$('#shotRaw')?.checked;
  if(!S.playing){
    for(const c of S.clips.filter(c=>c.type==='video'&&active(c,S.t))){
      const el=getEl(c);if(el)await seekVideoExact(el,clipSourceTimeAt(c,clamp(S.t-c.start,0,c.dur)));
    }
  }
  const ex=S.exporting,bp=S.bypass,cm=cmp;
  S.exporting=true;S.bypass=!!raw;cmp=false;setSize();
  renderFrame();
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
  S.exporting=ex;S.bypass=bp;cmp=cm;setSize();renderFrame();
  if(!blob)return toast('No pude capturar el fotograma.');
  const name=`${safeName()}_${fmt(S.t).replace(':','m').replace('.','s')}${raw?'_original':''}.png`;
  const th=document.createElement('canvas'),k=150/Math.max(S.w,S.h);th.width=Math.round(S.w*k);th.height=Math.round(S.h*k);
  th.getContext('2d').drawImage(cv,0,0,th.width,th.height);
  shots.unshift({id:uid(),blob,name,thumb:th.toDataURL('image/jpeg',.8)});
  download(blob,name);renderShots();
  toast(`📸 Captura guardada (${S.w}×${S.h}): ${name}`,4000);
}
function renderShots(){
  const g=$('#shotGrid');if(!g)return;g.innerHTML='';
  $('#shotHead').style.display=shots.length?'':'none';
  for(const s of shots){
    const d=document.createElement('div');d.className='shot';d.style.backgroundImage=`url('${s.thumb}')`;d.title=s.name;
    d.innerHTML='<div class="sb"><button data-a="dl" title="Descargar otra vez">⬇</button><button data-a="ref" title="Usar como imagen de referencia de color">🎨</button><button data-a="rm" title="Quitar de la lista">✕</button></div>';
    d.onclick=async e=>{
      const a=e.target.dataset.a;
      if(a==='dl')download(s.blob,s.name);
      else if(a==='ref'){await PRO._t.addRefs([new File([s.blob],s.name,{type:'image/png'})]);$('.tabs button[data-tab="look"]').click()}
      else if(a==='rm'){shots.splice(shots.indexOf(s),1);renderShots()}
    };
    g.appendChild(d);
  }
}
async function downloadAllShots(){for(const s of [...shots].reverse()){download(s.blob,s.name);await sleep(350)}}

/* ------------------------------------------------------------------
   3. APLICAR LOS EFECTOS DE UN CLIP A TODO EL VIDEO
   ------------------------------------------------------------------ */
function modal(html){
  const bg=document.createElement('div');bg.className='modal-bg';bg.style.display='flex';
  bg.innerHTML=`<div class="modal-box">${html}</div>`;document.body.appendChild(bg);
  bg.addEventListener('pointerdown',e=>{if(e.target===bg)bg.remove()});
  return bg;
}
function applyAll(){
  const src=selClip();
  if(!isVis(src))return toast('Primero haz clic en el clip que tiene los efectos que quieres copiar.');
  const many=MS.size>1,calce=src.grade&&src.grade.look&&src.grade.look.mode==='calce';
  const bg=modal(`<h3 style="margin:0 0 6px">⇉ Copiar efectos a otros clips</h3>
    <div class="hint" style="margin-bottom:10px">Se copian los efectos del clip seleccionado.</div>
    <div class="chk-list">
      <label><input type="checkbox" data-k="color" checked> Filtro y ajustes de color</label>
      <label><input type="checkbox" data-k="zoom"> Zoom, encuadre y movimiento grabado</label>
      <label><input type="checkbox" data-k="fade"> Fundidos de entrada y salida</label>
      <label><input type="checkbox" data-k="vol"> Volumen</label>
    </div>
    <div class="chk-list" style="margin-top:10px">
      <label><input type="radio" name="aat" value="all" ${many?'':'checked'}> A todos los clips del video</label>
      <label><input type="radio" name="aat" value="sel" ${many?'checked':''}> Solo a los clips seleccionados</label>
    </div>
    ${calce?'<div class="hint" style="margin-top:8px;color:#ffd166">Este clip usa «Calzar en vivo», que se calculó para ese clip. Si los otros clips tienen otra luz, usa también ⚖ Igualar clips.</div>':''}
    <div class="row" style="justify-content:flex-end;margin:14px 0 0"><button data-x="no">Cancelar</button><button data-x="ok" class="pri">Copiar efectos</button></div>`);
  bg.querySelector('[data-x=no]').onclick=()=>bg.remove();
  bg.querySelector('[data-x=ok]').onclick=()=>{
    const on=k=>bg.querySelector(`[data-k=${k}]`).checked;
    const all=bg.querySelector('input[name=aat]:checked').value==='all';
    const list=(all?S.clips:selList()).filter(c=>isVis(c)&&c!==src);
    const cp=v=>v==null?v:JSON.parse(JSON.stringify(v));
    list.forEach(c=>{
      if(on('color')){c.grade=cp(src.grade);if(!c.grade)delete c.grade;['bright','contrast','sat','hue','blur'].forEach(k=>c[k]=src[k])}
      if(on('zoom')){['scale','x','y','fit','rot'].forEach(k=>c[k]=src[k]);c.zoomKfs=cp(src.zoomKfs)||[];c.zoomBezier=cp(src.zoomBezier);c.cam=cp(src.cam);if(!c.cam)delete c.cam}
      if(on('fade')){c.fadeIn=Math.min(src.fadeIn,c.dur);c.fadeOut=Math.min(src.fadeOut,c.dur)}
      if(on('vol')){c.vol=src.vol;c.mute=src.mute}
    });
    bg.remove();commit();renderAll();
    toast(list.length?`Efectos copiados a ${list.length} clip(s).`:'No había otros clips de video donde copiar.',5000);
  };
}

/* ------------------------------------------------------------------
   4. VOZ: grabar, subir volumen, limpiar, quitar silencios
   ------------------------------------------------------------------ */
PRO.elChain=(v,src)=>{
  const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=10;
  const cp=AC.createDynamicsCompressor();cp.threshold.value=0;cp.ratio.value=1;cp.knee.value=6;cp.attack.value=.005;cp.release.value=.15;
  src.connect(hp);hp.connect(cp);v._hp=hp;v._cp=cp;return cp;
};
PRO.elFx=(el,c)=>{
  if(!el._hp)return;const on=!!c.clean,f=on?90:10;
  if(el._hp.frequency.value!==f){el._hp.frequency.value=f;el._cp.threshold.value=on?-26:0;el._cp.ratio.value=on?3.5:1}
};
PRO.afx=(oac,c,src)=>{
  if(!c.clean)return src;
  const hp=oac.createBiquadFilter();hp.type='highpass';hp.frequency.value=90;
  const cp=oac.createDynamicsCompressor();cp.threshold.value=-26;cp.ratio.value=3.5;cp.knee.value=6;cp.attack.value=.005;cp.release.value=.15;
  src.connect(hp);hp.connect(cp);return cp;
};
async function getBuf(m){
  if(m._abuf)return m._abuf;
  if(!m.file)throw new Error('archivo sin vincular');
  const raw=await m.file.arrayBuffer();
  m._abuf=await new OfflineAudioContext(2,1,48000).decodeAudioData(raw.slice(0));
  return m._abuf;
}
function mono(buf,a,b){
  const s0=Math.max(0,Math.floor(a*buf.sampleRate)),s1=Math.min(buf.length,Math.ceil(b*buf.sampleRate)),n=Math.max(0,s1-s0);
  const out=new Float32Array(n),ch=buf.numberOfChannels;
  for(let k=0;k<ch;k++){const d=buf.getChannelData(k);for(let i=0;i<n;i++)out[i]+=d[s0+i]/ch}
  return out;
}
function rmsWin(x,sr,win){const n=Math.max(1,Math.round(sr*win)),m=Math.floor(x.length/n),r=new Float32Array(m);for(let i=0;i<m;i++){let s=0;for(let j=i*n;j<(i+1)*n;j++)s+=x[j]*x[j];r[i]=Math.sqrt(s/n)}return r}
const pct=(arr,p)=>{const a=Float32Array.from(arr).sort();return a.length?a[Math.min(a.length-1,Math.floor(p*a.length))]:0};
function soundClips(){
  const l=selList().filter(c=>c.type==='audio'||c.type==='video');
  return l.length?l:[];
}
async function normalize(){
  const l=soundClips();if(!l.length)return toast('Selecciona el clip de voz (pista de audio) primero.');
  let n=0;
  for(const c of l){
    const m=M.get(c.mediaId);if(!m)continue;
    try{
      const buf=await getBuf(m),x=mono(buf,c.in||0,(c.in||0)+c.dur*c.speed);
      let pk=0;for(let i=0;i<x.length;i++){const v=Math.abs(x[i]);if(v>pk)pk=v}
      const loud=pct(rmsWin(x,buf.sampleRate,.05),.95);
      if(pk<1e-4)continue;
      c.vol=+clamp(Math.min(.95/pk,.22/Math.max(loud,1e-4)),.1,8).toFixed(2);n++;
    }catch(e){toast('No pude leer el audio de '+m.name)}
  }
  if(n){commit();renderAll();toast(`Volumen ajustado en ${n} clip(s): ahora suena fuerte y sin saturar.`)}
}
function toggleClean(){
  const l=soundClips();if(!l.length)return toast('Selecciona el clip de voz primero.');
  const on=!l.every(c=>c.clean);l.forEach(c=>c.clean=on);commit();renderAll();
  toast(on?'✨ Voz limpia activada: quita ruido grave (aire, golpes) y empareja el volumen.':'Limpieza de voz desactivada.');
}
async function removeSilences(){
  const l=selList().filter(c=>c.type==='audio');
  if(!l.length)return toast('Selecciona un clip de la pista de audio (tu voz).');
  const minSil=+$('#silMin').value,pad=.12;let removedT=0,cuts=0;
  for(const c of l){
    if(c.speed!==1||(c.speedCurve&&c.speedCurve.length>=2)){toast('Quitar silencios funciona con clips a velocidad 1x.');continue}
    const m=M.get(c.mediaId);let buf;try{buf=await getBuf(m)}catch(e){toast('No pude leer el audio.');continue}
    const a=c.in||0,b=a+c.dur,x=mono(buf,a,b),win=.02,r=rmsWin(x,buf.sampleRate,win);
    const noise=pct(r,.15),speech=pct(r,.9),thr=Math.max(.004,noise+(speech-noise)*.16);
    const segs=[];let i=0;
    while(i<r.length){
      if(r[i]<thr){let j=i;while(j<r.length&&r[j]<thr)j++;
        const s0=i*win,s1=j*win;if(s1-s0>=minSil)segs.push([s0+(i===0?0:pad),s1-(j>=r.length?0:pad)]);i=j}
      else i++;
    }
    const sil=segs.filter(s=>s[1]-s[0]>.05);
    if(!sil.length)continue;
    const keep=[];let p=0;for(const s of sil){if(s[0]>p+.03)keep.push([p,s[0]]);p=s[1]}if(c.dur>p+.03)keep.push([p,c.dur]);
    if(!keep.length)continue;
    const total0=c.dur,kept=keep.reduce((s,k)=>s+k[1]-k[0],0),gap=total0-kept;
    const after=S.clips.filter(o=>o!==c&&o.track===c.track&&o.start>=c.start+c.dur-1e-6);
    S.clips=S.clips.filter(o=>o!==c);
    let pos=c.start;const ids=[];
    for(const k of keep){
      const n={...JSON.parse(JSON.stringify(c)),id:uid(),in:a+k[0],dur:k[1]-k[0],start:pos,env:[],fadeIn:.01,fadeOut:.01};
      S.clips.push(n);ids.push(n.id);pos+=n.dur;
    }
    after.forEach(o=>o.start-=gap);
    removedT+=gap;cuts+=sil.length;
    MS.clear();ids.forEach(id=>MS.add(id));S.sel=ids[ids.length-1];
  }
  if(!cuts)return toast('No encontré silencios largos. Prueba bajando el «Silencio mínimo».');
  commit();renderAll();
  toast(`✂ Quité ${cuts} silencio(s): ${removedT.toFixed(1)} s menos. Si cortó de más, Ctrl+Z.`,6000);
}
function toWav(buf){
  const ch=Math.min(2,buf.numberOfChannels),sr=buf.sampleRate,n=buf.length,bytes=n*ch*2,ab=new ArrayBuffer(44+bytes),dv=new DataView(ab);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i))};
  ws(0,'RIFF');dv.setUint32(4,36+bytes,true);ws(8,'WAVE');ws(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,ch,true);
  dv.setUint32(24,sr,true);dv.setUint32(28,sr*ch*2,true);dv.setUint16(32,ch*2,true);dv.setUint16(34,16,true);ws(36,'data');dv.setUint32(40,bytes,true);
  const d=[...Array(ch)].map((_,k)=>buf.getChannelData(k));let o=44;
  for(let i=0;i<n;i++)for(let k=0;k<ch;k++){const v=clamp(d[k][i],-1,1);dv.setInt16(o,v<0?v*32768:v*32767,true);o+=2}
  return new Blob([ab],{type:'audio/wav'});
}
let mic=null;
async function listMics(){
  const sel=$('#micSel');if(!sel||!navigator.mediaDevices)return;
  const devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
  const keep=sel.value||LSg('ee-pro-mic','');
  sel.innerHTML='<option value="">Micrófono predeterminado de Windows</option>'+devs.filter(d=>d.deviceId&&d.deviceId!=='default').map(d=>`<option value="${esc(d.deviceId)}">${esc(d.label||'Micrófono')}</option>`).join('');
  if([...sel.options].some(o=>o.value===keep))sel.value=keep;
}
async function ingestRecording(blob,t0){
  ensureAudio();
  const buf=await AC.decodeAudioData(await blob.arrayBuffer());
  const name='voz-'+new Date().toTimeString().slice(0,8).replace(/:/g,'')+'.wav';
  const before=new Set(M.keys());
  await addFiles([new File([toWav(buf)],name,{type:'audio/wav'})]);
  const m=[...M.values()].find(x=>!before.has(x.id));if(!m)return null;
  const dur=m.dur||buf.duration;
  const tid=['A1','A2'].find(t=>freeSlot(t,t0,dur)===t0)||'A1';
  addMediaClip(m.id,tid,t0);
  const c=S.clips[S.clips.length-1];
  if(Math.abs(c.start-t0)>.01)toast('El espacio estaba ocupado: dejé la voz en el hueco libre más cercano.',5000);
  return c;
}
async function toggleRec(){
  if(mic){ // detener
    const r=mic;mic=null;
    const done=new Promise(res=>r.rec.onstop=res);r.rec.stop();await done;
    r.stream.getTracks().forEach(t=>t.stop());cancelAnimationFrame(r.raf);
    if(S.playing)pause();
    $('#bRec').innerHTML='<b>● Grabar</b><small>Empieza en el cursor rojo. La voz queda en la pista Audio 1.</small>';$('#bRec').classList.remove('live');
    $('#micLvl').style.width='0%';
    try{
      const c=await ingestRecording(new Blob(r.chunks,{type:r.rec.mimeType}),r.t0);
      $('#recInfo').textContent=c?`Grabación lista (${c.dur.toFixed(1)} s). Ahora puedes subirle el volumen o quitarle los silencios.`:'';
      if(r.peak<.08)toast('Tu micrófono grabó muy bajito. Usa «🔊 Subir volumen» en el clip.',7000);
    }catch(e){console.error(e);toast('No pude guardar la grabación: '+e.message)}
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia)return toast('Este navegador no deja usar el micrófono.');
  ensureAudio();
  const id=$('#micSel').value;LSs('ee-pro-mic',id);
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:id?{exact:id}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
  catch(e){return toast('No tengo permiso para el micrófono. Acepta el permiso en el navegador y prueba otra vez.',7000)}
  listMics();
  const rec=new MediaRecorder(stream),r={rec,stream,chunks:[],t0:S.t,peak:0,raf:0,start:performance.now()};
  rec.ondataavailable=e=>{if(e.data&&e.data.size)r.chunks.push(e.data)};
  const an=AC.createAnalyser();an.fftSize=1024;AC.createMediaStreamSource(stream).connect(an);
  const buf=new Float32Array(an.fftSize);
  const meter=()=>{an.getFloatTimeDomainData(buf);let pk=0;for(const v of buf)pk=Math.max(pk,Math.abs(v));r.peak=Math.max(r.peak,pk);
    $('#micLvl').style.width=Math.min(100,pk*140)+'%';$('#micLvl').style.background=pk>.95?'#ff4d4f':pk<.08?'#8f8f99':'#3ccf7a';
    $('#recInfo').textContent='Grabando… '+((performance.now()-r.start)/1000).toFixed(1)+' s';r.raf=requestAnimationFrame(meter)};
  meter();
  rec.start(250);mic=r;
  $('#bRec').innerHTML='<b>■ Detener grabación</b><small>La voz se pondrá donde empezaste a grabar.</small>';$('#bRec').classList.add('live');
  if($('#recPlay').checked&&S.clips.length&&S.t<total()-.05)play();
}

/* ------------------------------------------------------------------
   5. SUBTÍTULOS DESDE UN GUION
   ------------------------------------------------------------------ */
const norm=w=>w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ]/g,'');
function scriptWords(){return ($('#subScript').value||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean)}
function group(words){
  const max=clamp(+$('#subWords').value||4,1,10),out=[];let cur=[];
  words.forEach((w,i)=>{cur.push(i);const end=/[.!?…:;]$/.test(w),comma=/,$/.test(w);
    if(cur.length>=max||end||(comma&&cur.length>=Math.ceil(max/2))){out.push(cur);cur=[]}});
  if(cur.length)out.push(cur);return out;
}
const wWeight=w=>norm(w).length+2+(/[.!?…]$/.test(w)?5:/[,;:]$/.test(w)?2:0);
function spread(words,ids,t0,t1,times){
  const W=ids.map(i=>wWeight(words[i])),tot=W.reduce((a,b)=>a+b,0)||1;let t=t0;
  ids.forEach((i,k)=>{const d=(t1-t0)*W[k]/tot;times[i]={t0:t,t1:t+d};t+=d});
}
function audioRange(){
  const sel=selList().filter(c=>c.type==='audio');
  let l=sel.length?sel:S.clips.filter(c=>c.type==='audio');
  if(!l.length)l=S.clips.filter(c=>c.type==='video'&&!c.mute);
  if(!l.length)return null;
  return {clips:l,t0:Math.min(...l.map(c=>c.start)),t1:Math.max(...l.map(c=>c.start+c.dur))};
}
function buildSubs(words,times){
  const st=$('#subStyle').value,font=$('#subFont').value,up=$('#subUpper').checked,hi=$('#subHi').value,pos=+$('#subPos').value;
  S.clips=S.clips.filter(c=>!(c.type==='text'&&c.tx&&c.tx.sub));
  const ph=group(words),vertical=S.h>S.w;
  ph.forEach((ids,k)=>{
    const a=times[ids[0]],b=times[ids[ids.length-1]],next=ph[k+1]?times[ph[k+1][0]].t0:Infinity;
    const start=Math.max(0,a.t0),end=Math.max(start+.3,Math.min(next,b.t1+.35));
    const ws=ids.map(i=>({w:words[i],t:+(times[i].t0-start).toFixed(3),e:+(times[i].t1-start).toFixed(3)}));
    S.clips.push({...DEF,env:[],speedCurve:[],zoomKfs:[],id:uid(),type:'text',track:'T2',start,dur:end-start,y:pos,
      tx:{text:ids.map(i=>words[i]).join(' '),font,size:vertical?96:68,color:'#ffffff',stroke:'#000000',strokeW:7,bgOn:st==='caja',bg:'#000000b8',
        ls:1,anim:'none',animDur:0,shadow:true,sub:true,style:st,hi,upper:up,words:ws}});
  });
  commit();renderAll();
  return ph.length;
}
function subStatus(t){$('#subStatus').textContent=t||''}
function subsEven(){
  const words=scriptWords();if(!words.length)return toast('Pega primero tu guion en el cuadro de texto.');
  const r=audioRange();const t0=r?r.t0:0,t1=r?r.t1:Math.max(total(),words.length*.38);
  const times=[];spread(words,words.map((_,i)=>i),t0,t1,times);
  const n=buildSubs(words,times);
  toast(`${n} subtítulos repartidos parejo entre ${fmt(t0)} y ${fmt(t1)}. Para calzarlos exacto usa 🤖 o ✋.`,6000);
}
/* --- sincronizar a mano: tocas K al comenzar cada frase --- */
const tap={on:false};
function subsTap(){
  if(tap.on)return tapFinish();
  const words=scriptWords();if(!words.length)return toast('Pega primero tu guion en el cuadro de texto.');
  const r=audioRange();
  Object.assign(tap,{on:true,words,ph:group(words),i:0,starts:[],end:r?r.t1:total()});
  seek(r?Math.max(0,r.t0-.3):S.t);play();
  $('#bSubTap').classList.add('on');tapShow();
}
function tapShow(){
  const p=tap.ph[tap.i];
  subStatus(p?`✋ Frase ${tap.i+1}/${tap.ph.length} — pulsa K cuando empiece: «${p.map(i=>tap.words[i]).join(' ')}»   (Esc = terminar)`:'Listo. Pulsa Esc o espera a que termine.');
}
function tapHit(){
  if(tap.i>=tap.ph.length)return;
  tap.starts[tap.i]=S.t;tap.i++;tapShow();
  if(tap.i>=tap.ph.length)setTimeout(()=>{if(tap.on)tapFinish()},2500);
}
function tapFinish(){
  if(!tap.on)return;tap.on=false;$('#bSubTap').classList.remove('on');if(S.playing)pause();
  const n=tap.starts.length;if(!n){subStatus('');return toast('No marcaste ninguna frase.')}
  const times=[],end=Math.max(tap.end,tap.starts[n-1]+.5);
  tap.ph.forEach((ids,k)=>{
    let a=tap.starts[k],b=tap.starts[k+1];
    if(a==null){const prev=tap.starts[n-1];const left=tap.ph.length-n,step=Math.max(.6,(end-prev)/Math.max(1,left+1));a=prev+step*(k-n+1);b=a+step}
    if(b==null)b=Math.min(end,a+Math.max(.8,ids.reduce((s,i)=>s+wWeight(tap.words[i]),0)*.065));
    spread(tap.words,ids,a,b,times);
  });
  const c=buildSubs(tap.words,times);subStatus('');
  toast(`${c} subtítulos sincronizados a mano.`);
}
/* --- automático con Whisper (corre en tu PC, gratis, sin internet tras la 1ª descarga) --- */
let asrP=null;
function getAsr(status){
  if(asrP)return asrP;
  asrP=(async()=>{
    const T=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1');
    T.env.allowLocalModels=false;
    // abierto con doble clic (file://) el navegador no permite guardar el modelo: se descarga en cada sesión
    if(location.protocol==='file:'){T.env.useBrowserCache=false;toast('Consejo: abre el editor con «ABRIR EDITOR.bat» para que el modelo de voz quede guardado y no se descargue cada vez.',9000)}
    const prog={};
    const cb=p=>{if(p.status==='progress'&&p.file){prog[p.file]=[p.loaded||0,p.total||0];
      let l=0,t=0;for(const k in prog){l+=prog[k][0];t+=prog[k][1]}
      status(`Descargando el modelo de voz (solo la primera vez)… ${t?Math.round(l/t*100):0}% · ${(l/1e6).toFixed(0)} MB`)}};
    const model='onnx-community/whisper-base_timestamped';
    if(navigator.gpu){
      try{const a=await T.pipeline('automatic-speech-recognition',model,{device:'webgpu',dtype:{encoder_model:'fp32',decoder_model_merged:'fp32'},progress_callback:cb});a._dev='GPU';return a}
      catch(e){console.warn('WebGPU no disponible para Whisper:',e)}
    }
    const a=await T.pipeline('automatic-speech-recognition',model,{device:'wasm',dtype:'q8',progress_callback:cb});a._dev='CPU';return a;
  })();
  asrP.catch(()=>{asrP=null});
  return asrP;
}
async function mix16k(r){
  const sr=16000,len=Math.max(1,Math.ceil((r.t1-r.t0)*sr)),oac=new OfflineAudioContext(1,len,sr);
  for(const c of r.clips){
    const m=M.get(c.mediaId);if(!m)continue;
    const buf=await getBuf(m),s=oac.createBufferSource();s.buffer=buf;
    const sp=clamp(c.speed*speedCurveAvg(c),.1,4);s.playbackRate.value=sp;
    const g=oac.createGain();g.gain.value=Math.min(4,c.vol||1);s.connect(g);g.connect(oac.destination);
    s.start(Math.max(0,c.start-r.t0),c.in||0,c.dur*sp);
  }
  const out=await oac.startRendering(),d=out.getChannelData(0);
  let pk=0;for(let i=0;i<d.length;i++)pk=Math.max(pk,Math.abs(d[i]));
  if(pk>1e-4&&pk<.5){const k=.7/pk;for(let i=0;i<d.length;i++)d[i]*=k}
  return d;
}
function align(words,hyp){
  // alinea cada palabra de TU guion con las palabras que oyó Whisper (perdona errores de ortografía)
  const A=words.map(norm),B=hyp.map(h=>norm(h.w)),n=A.length,m=B.length;
  const sim=(a,b)=>{if(!a||!b)return false;if(a===b)return true;if(a.length<4||b.length<4)return false;
    let p=0;while(p<a.length&&p<b.length&&a[p]===b[p])p++;return p>=Math.min(a.length,b.length)*.7};
  const D=new Array(n+1);for(let i=0;i<=n;i++)D[i]=new Int32Array(m+1);
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)D[i][j]=Math.max(D[i-1][j],D[i][j-1],D[i-1][j-1]+(sim(A[i-1],B[j-1])?1:0));
  const match=new Array(n).fill(-1);let i=n,j=m;
  while(i>0&&j>0){if(sim(A[i-1],B[j-1])&&D[i][j]===D[i-1][j-1]+1){match[i-1]=j-1;i--;j--}else if(D[i-1][j]>=D[i][j-1])i--;else j--}
  return match;
}
async function subsAuto(){
  const words=scriptWords();if(!words.length)return toast('Pega primero tu guion en el cuadro de texto.');
  const r=audioRange();if(!r)return toast('No hay audio en el timeline. Graba o importa tu voz primero.');
  const btn=$('#bSubAuto');if(btn.disabled)return;btn.disabled=true;
  try{
    subStatus('Preparando el reconocimiento de voz…');
    const asr=await getAsr(subStatus);
    subStatus(`Escuchando tu voz (${fmt(r.t1-r.t0)}) con la ${asr._dev}… puede tardar lo mismo que dura el audio.`);
    const audio=await mix16k(r);
    const es=/[áéíóúñ¿¡]|\b(que|de|el|la|los|las|y|en|es|una?|por|para|con)\b/i.test(words.join(' '));
    const opt={return_timestamps:'word',chunk_length_s:30,stride_length_s:5};
    if(es){opt.language='spanish';opt.task='transcribe'}
    const out=await asr(audio,opt);
    const hyp=(out.chunks||[]).map(ch=>({w:(ch.text||'').trim(),t0:(ch.timestamp?.[0]??0)+r.t0,t1:(ch.timestamp?.[1]??ch.timestamp?.[0]??0)+r.t0})).filter(h=>norm(h.w));
    if(!hyp.length){subStatus('');return toast('No escuché palabras en el audio. ¿Está silenciado?',6000)}
    const match=align(words,hyp),times=new Array(words.length);
    let hits=0;match.forEach((j,i)=>{if(j>=0){times[i]={t0:hyp[j].t0,t1:Math.max(hyp[j].t1,hyp[j].t0+.08)};hits++}});
    if(hits<Math.max(2,words.length*.15)){
      subStatus('');
      return toast('Casi no coincide lo que dices con el guion. Revisa que sea el guion correcto, o usa ✋ Sincronizar a mano.',8000);
    }
    // rellena las palabras que no se oyeron, entre sus vecinas
    let k=0;
    while(k<words.length){
      if(times[k]){k++;continue}
      let e=k;while(e<words.length&&!times[e])e++;
      const a=k>0?times[k-1].t1:Math.max(r.t0,times[e].t0-(e-k)*.35),b=e<words.length?times[e].t0:Math.min(r.t1,times[k-1].t1+(e-k)*.35);
      spread(words,[...Array(e-k)].map((_,q)=>k+q),a,Math.max(a+.05*(e-k),b),times);k=e;
    }
    const n=buildSubs(words,times);
    subStatus('');
    toast(`🤖 ${n} subtítulos sincronizados (${Math.round(hits/words.length*100)}% de las palabras calzadas con tu voz).`,7000);
  }catch(e){
    console.error(e);subStatus('');
    toast('No pude usar el reconocimiento automático ('+(e.message||e)+'). Necesita internet la primera vez. Puedes usar ✋ o ⇔.',9000);
  }finally{btn.disabled=false}
}
function subsDel(){const n=S.clips.length;S.clips=S.clips.filter(c=>!(c.type==='text'&&c.tx&&c.tx.sub));if(S.clips.length<n){commit();renderAll();toast('Subtítulos quitados.')}}
function restyleSubs(){
  const l=S.clips.filter(c=>c.type==='text'&&c.tx&&c.tx.sub);if(!l.length)return;
  const st=$('#subStyle').value;
  l.forEach(c=>Object.assign(c.tx,{style:st,bgOn:st==='caja',font:$('#subFont').value,upper:$('#subUpper').checked,hi:$('#subHi').value}));
  l.forEach(c=>c.y=+$('#subPos').value);
  renderFrame();
}
// Dibuja un subtítulo con la palabra que se está diciendo resaltada
PRO.drawSub=(g,c,cxp,cyp,tf,u)=>{
  const tx=c.tx,lt=S.t-c.start,toks=String(tx.text||'').split(/\s+/).filter(Boolean);
  let ws=tx.words;
  if(!ws||ws.length!==toks.length||ws.some((w,i)=>w.w!==toks[i])){
    const tm=[];spread(toks,toks.map((_,i)=>i),0,c.dur,tm);ws=toks.map((w,i)=>({w,t:tm[i].t0,e:tm[i].t1}));tx.words=ws;
  }
  if(!ws.length)return;
  const pop=Math.min(1,lt/.12),sc=tf.scale*(.86+.14*(1-Math.pow(1-pop,3)));
  g.translate(cxp,cyp);g.rotate(c.rot*Math.PI/180);g.scale(sc,sc);
  const fs=tx.size*u;g.font=`${tx.font==='Inter'?'800 ':''}${fs}px "${tx.font}", Impact, sans-serif`;g.textBaseline='middle';g.textAlign='left';
  const shown=ws.map(w=>tx.upper?w.w.toUpperCase():w.w),sp=g.measureText(' ').width,maxW=S.w*.86/Math.max(sc,.1);
  const lines=[];let cur=[],lw=0;
  shown.forEach((w,i)=>{const ww=g.measureText(w).width;if(cur.length&&lw+sp+ww>maxW){lines.push({ids:cur,w:lw});cur=[];lw=0}lw+=(cur.length?sp:0)+ww;cur.push(i)});
  if(cur.length)lines.push({ids:cur,w:lw});
  const lh=fs*1.15,H=lines.length*lh,W=Math.max(...lines.map(l=>l.w));
  if(tx.bgOn){const p=fs*.3;g.fillStyle=tx.bg;g.beginPath();g.roundRect?g.roundRect(-W/2-p,-H/2-p*.55,W+2*p,H+p*1.1,fs*.18):g.rect(-W/2-p,-H/2-p*.55,W+2*p,H+p*1.1);g.fill()}
  let now=-1;ws.forEach((w,i)=>{if(lt>=w.t-.02)now=i});
  lines.forEach((ln,li)=>{
    let x=-ln.w/2;const y=-H/2+lh*(li+.5);
    ln.ids.forEach(i=>{
      const w=shown[i],ww=g.measureText(w).width,hot=tx.style!=='frase'&&i===now;
      g.save();
      if(hot){g.translate(x+ww/2,y);g.scale(1.08,1.08);g.translate(-(x+ww/2),-y)}
      if(tx.shadow){g.shadowColor='#000c';g.shadowBlur=12*u;g.shadowOffsetY=4*u}
      if(tx.strokeW>0){g.lineJoin='round';g.lineWidth=tx.strokeW*2*u;g.strokeStyle=tx.stroke;g.strokeText(w,x,y)}
      g.shadowColor='transparent';g.fillStyle=hot?(tx.hi||'#ffd400'):tx.color;g.fillText(w,x,y);
      g.restore();x+=ww+sp;
    });
  });
  c._bb={cx:cxp,cy:cyp,w:(W+fs*.6)*sc,h:(H+fs*.6)*sc};
};

/* ------------------------------------------------------------------
   6. EDITOR DE ZOOM: graba tu zoom y el puntero huevito mientras ves el clip
   ------------------------------------------------------------------ */
const EGG=["....###....","...#CCC#...","..#CCCCC#..",".#CWCCCCC#.",".#WCCRRCC#.","#CCCCRRCCC#","#CCCCCCTTC#","#CTTCCCTTS#","#CTTCCCCCS#","#CCCCCCCSS#",".#CCCCCSS#.",".#SCCCSSS#.","..##SSS##..","....###...."];
const EGGC={'#':'#151515',C:'#efe4d0',S:'#cdbfa6',R:'#c4483e',T:'#3f8f8f',W:'#ffffff'};
function drawEgg(g,x,y,ps){
  const w=EGG[0].length*ps;
  g.save();g.translate(Math.round(x-w/2),Math.round(y));
  g.globalAlpha=.35;g.fillStyle='#000';
  EGG.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]!=='.')g.fillRect(i*ps+ps*.8,j*ps+ps*.9,ps,ps)});
  g.globalAlpha=1;
  EGG.forEach((row,j)=>{for(let i=0;i<row.length;i++){const k=row[i];if(k!=='.'){g.fillStyle=EGGC[k];g.fillRect(i*ps,j*ps,ps+.5,ps+.5)}}});
  g.restore();
}
function srcDims(c){const m=M.get(c.mediaId);return m&&m.w&&m.h?[m.w,m.h]:[S.w,S.h]}
function baseK(c,sw,sh){return c.fit==='contain'?Math.min(S.w/sw,S.h/sh):Math.max(S.w/sw,S.h/sh)}
function clampCam(c,z,cx,cy){const [sw,sh]=srcDims(c),k=baseK(c,sw,sh)*z,vw=S.w/(sw*k),vh=S.h/(sh*k);
  return [vw>=1?.5:clamp(cx,vw/2,1-vw/2),vh>=1?.5:clamp(cy,vh/2,1-vh/2)]}
function toTf(c,z,cx,cy){const [sw,sh]=srcDims(c),k=baseK(c,sw,sh)*z;return {scale:z,x:-(cx-.5)*sw*k/S.w*100,y:-(cy-.5)*sh*k/S.h*100}}
const camCache=new WeakMap();
function camPath(c){
  const cam=c.cam;if(!cam||!cam.raw||cam.raw.length<2)return null;
  const key=cam.smooth+'|'+cam.raw.length+'|'+(cam.raw[cam.raw.length-1].t);
  const hit=camCache.get(cam);if(hit&&hit.key===key)return hit.pts;
  const R=cam.raw,n=R.length,sg=cam.v>=2?.02+cam.smooth*.1:.04+cam.smooth*.45,sp=.025,out=new Array(n);
  for(let i=0;i<n;i++){
    let wz=0,z=0,x=0,y=0,wp=0,px=0,py=0;
    for(let j=i;j>=0&&R[i].t-R[j].t<sg*3;j--){const d=R[i].t-R[j].t,w=Math.exp(-d*d/(2*sg*sg));wz+=w;z+=w*R[j].z;x+=w*R[j].cx;y+=w*R[j].cy;
      if(R[j].px!=null&&d<sp*3){const v=Math.exp(-d*d/(2*sp*sp));wp+=v;px+=v*R[j].px;py+=v*R[j].py}}
    for(let j=i+1;j<n&&R[j].t-R[i].t<sg*3;j++){const d=R[j].t-R[i].t,w=Math.exp(-d*d/(2*sg*sg));wz+=w;z+=w*R[j].z;x+=w*R[j].cx;y+=w*R[j].cy;
      if(R[j].px!=null&&d<sp*3){const v=Math.exp(-d*d/(2*sp*sp));wp+=v;px+=v*R[j].px;py+=v*R[j].py}}
    out[i]={t:R[i].t,z:z/wz,cx:x/wz,cy:y/wz,px:R[i].px==null?null:px/wp,py:R[i].px==null?null:py/wp};
  }
  camCache.set(cam,{key,pts:out});return out;
}
function camAt(c,lt){
  const P=camPath(c);if(!P)return null;
  if(lt<=P[0].t)return P[0];if(lt>=P[P.length-1].t)return P[P.length-1];
  let lo=0,hi=P.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(P[m].t<=lt)lo=m;else hi=m}
  const a=P[lo],b=P[hi],f=(lt-a.t)/Math.max(1e-6,b.t-a.t),L=(p,q)=>p+(q-p)*f;
  return {z:L(a.z,b.z),cx:L(a.cx,b.cx),cy:L(a.cy,b.cy),px:a.px==null||b.px==null?(f<.5?a.px:b.px):L(a.px,b.px),py:a.py==null||b.py==null?(f<.5?a.py:b.py):L(a.py,b.py)};
}
const ZR={c:null,z:1,cx:.5,cy:.5,tz:1,tcx:.5,tcy:.5,anchor:null,mouse:null,px:null,py:null,rec:false,view:false,drag:null,liveClick:-1e9,n:0,lastStep:0};
/* cámara estabilizada: lo que ves (z,cx,cy) sigue suavemente al objetivo (tz,tcx,tcy).
   Mientras haces zoom, el punto que agarraste queda quieto bajo el puntero (anchor). */
function anchorCam(c,z,A){const [sw,sh]=srcDims(c),k=baseK(c,sw,sh)*z;return clampCam(c,z,A.u-(A.mx-S.w/2)/(sw*k),A.v-(A.my-S.h/2)/(sh*k))}
function zrStep(){
  const c=ZR.c;if(!c)return;
  const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-(ZR.lastStep||now))/1000));ZR.lastStep=now;
  const tau=.06+(+($('#zrSmooth')||{value:.5}).value)*.3,a=1-Math.exp(-dt/tau);
  ZR.z=Math.exp(Math.log(ZR.z)+(Math.log(ZR.tz)-Math.log(ZR.z))*a);
  if(Math.abs(ZR.z-ZR.tz)<1e-4)ZR.z=ZR.tz;
  if(ZR.anchor&&ZR.anchor.tmx!=null){const A=ZR.anchor;A.mx+=(A.tmx-A.mx)*a;A.my+=(A.tmy-A.my)*a}
  if(ZR.anchor){[ZR.cx,ZR.cy]=anchorCam(c,ZR.z,ZR.anchor);[ZR.tcx,ZR.tcy]=anchorCam(c,ZR.tz,ZR.anchor)}
  else{ZR.cx+=(ZR.tcx-ZR.cx)*a;ZR.cy+=(ZR.tcy-ZR.cy)*a}
  [ZR.cx,ZR.cy]=clampCam(c,ZR.z,ZR.cx,ZR.cy);
  if(ZR.mouse){const q=zrMouse(ZR.mouse);if(q.inside){ZR.px=clamp(q.u,0,1);ZR.py=clamp(q.v,0,1)}else{ZR.px=null;ZR.py=null}}
}
function dropAnchor(){if(!ZR.anchor)return;if(ZR.anchor.tmx!=null){ZR.anchor.mx=ZR.anchor.tmx;ZR.anchor.my=ZR.anchor.tmy}[ZR.tcx,ZR.tcy]=anchorCam(ZR.c,ZR.tz,ZR.anchor);ZR.anchor=null}
const offOf=c=>c.sess?(c.in||0):0;
PRO.camT=(c,t)=>{
  if(S.zr&&ZR.c===c){const [x,y]=clampCam(c,ZR.z,ZR.cx,ZR.cy);return toTf(c,ZR.z,x,y)}
  const p=camAt(c,t-c.start+offOf(c));if(!p)return null;
  const [x,y]=clampCam(c,p.z,p.cx,p.cy);return toTf(c,p.z,x,y);
};
PRO.ptr=(g,c,W,H,u)=>{
  let p=null,size=1,ripple=-1;
  if(S.zr&&ZR.c===c){if(!$('#zrPtr').checked)return;p={px:ZR.px,py:ZR.py};size=+$('#zrPtrSz').value;ripple=(performance.now()-ZR.liveClick)/1000}
  else if(c.cam&&c.cam.ptr!==false&&c.cam.raw&&c.cam.raw.length>1){
    const lt=S.t-c.start+offOf(c);p=camAt(c,lt);size=c.cam.size||1;
    for(const t of c.cam.clicks||[]){const d=lt-t;if(d>=0&&d<.45){ripple=d;break}}
  }
  if(!p||p.px==null)return;
  const x=-W/2+p.px*W,y=-H/2+p.py*H,ps=3*u*size;
  if(ripple>=0&&ripple<.45){const f=ripple/.45;g.save();g.globalAlpha=1-f;g.strokeStyle='#3f8f8f';g.lineWidth=5*u*size;
    g.beginPath();g.arc(x,y+ps*2,(12+60*f)*u*size,0,Math.PI*2);g.stroke();g.restore()}
  g.save();g.globalAlpha=1;g.filter='none';drawEgg(g,x,y,ps);g.restore();
};
/* --- fotograma de respaldo: mientras el video busca otro punto, se ve el último fotograma (nunca negro) --- */
PRO.holdSave=el=>{
  if(el.seeking)return;
  const now=performance.now();
  if(S.playing?now-(el._holdAt||0)<250:Math.abs((el._holdT??-1)-el.currentTime)<1e-4)return;
  const w=el.videoWidth,h=el.videoHeight,k=Math.min(1,1280/w);
  let cv2=el._hold;if(!cv2){cv2=el._hold=document.createElement('canvas')}
  const W=Math.round(w*k),H=Math.round(h*k);if(cv2.width!==W||cv2.height!==H){cv2.width=W;cv2.height=H}
  try{cv2.getContext('2d').drawImage(el,0,0,W,H);el._holdW=w;el._holdH=h;el._holdT=el.currentTime;el._holdAt=now}catch(_){}
};
/* --- clips «Sesión»: el tiempo del video sigue lo que hiciste (pausas, saltos, retrocesos) --- */
function sessIdx(T,x){let lo=0,hi=T.length-1;if(x<=T[0])return 0;if(x>=T[hi])return hi-1;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=x)lo=m;else hi=m}return lo}
PRO.sessSrc=(c,lt)=>{
  const T=c.sess.t,Sv=c.sess.s,x=clamp(lt,0,c.dur)+(c.in||0);
  if(T.length<2)return Sv[0]||0;
  const i=sessIdx(T,x),a=T[i],b=T[i+1],f=clamp((x-a)/Math.max(1e-6,b-a),0,1);
  // salto grande (arrastraste la barra): no inventar fotogramas intermedios
  if(Math.abs(Sv[i+1]-Sv[i])>(b-a)*3+.05)return f<.5?Sv[i]:Sv[i+1];
  return Sv[i]+(Sv[i+1]-Sv[i])*f;
};
PRO.sessRate=(c,lt)=>{const a=PRO.sessSrc(c,lt-.05),b=PRO.sessSrc(c,lt+.05);return (b-a)/.1};
PRO.sessAudio=(oac,c,buf,g)=>{
  // el audio del juego solo suena en los tramos donde el video corría normal
  const T=c.sess.t,Sv=c.sess.s,off=c.in||0;let i=0;
  while(i<T.length-1){
    const ok=k=>{const r=(Sv[k+1]-Sv[k])/Math.max(1e-6,T[k+1]-T[k]);return r>.85&&r<1.15};
    if(!ok(i)){i++;continue}
    let j=i;while(j<T.length-1&&ok(j))j++;
    let t0=T[i]-off,t1=T[j]-off,s0=Sv[i];
    if(t1>0&&t0<c.dur){
      if(t0<0){s0-=t0;t0=0}t1=Math.min(t1,c.dur);
      if(t1-t0>.05){const s=oac.createBufferSource();s.buffer=buf;s.connect(g);s.start(c.start+t0,Math.max(0,s0),t1-t0)}
    }
    i=j;
  }
};
function zrFit(){
  const st=$('#zrStage');if(!st||!S.zr)return;
  const aw=st.clientWidth-16,ah=st.clientHeight-16,ar=S.w/S.h;let w=aw,h=aw/ar;if(h>ah){h=ah;w=ah*ar}
  cv.style.width=Math.max(50,w)+'px';cv.style.height=Math.max(50,h)+'px';
}
function zrMouse(e){
  const c=ZR.c,r=cv.getBoundingClientRect();
  const mx=(e.clientX-r.left)*S.w/r.width,my=(e.clientY-r.top)*S.h/r.height;
  const [sw,sh]=srcDims(c),k=baseK(c,sw,sh)*ZR.z,[cx2,cy2]=clampCam(c,ZR.z,ZR.cx,ZR.cy);
  return {mx,my,k,sw,sh,u:cx2+(mx-S.w/2)/(sw*k),v:cy2+(my-S.h/2)/(sh*k),inside:mx>=0&&my>=0&&mx<=S.w&&my<=S.h};
}
function zrOpen(){
  let c=selClip();if(!isVis(c)||!active(c,S.t))c=(isVis(c)?c:null)||topVis(S.t);
  if(!c)c=S.clips.find(isVis);
  if(!c)return toast('Pon primero un clip de gameplay en el timeline.');
  if(c.sess)return toast('Ese clip ya es una sesión grabada. Para grabar otra, abre el clip de gameplay original.',6000);
  S.sel=c.id;MS.clear();MS.add(c.id);
  if(!active(c,S.t))seek(c.start);
  if(S.cropMode)toggleCropMode(false);
  {const z0=Math.max(1,c.scale||1);Object.assign(ZR,{c,z:z0,cx:.5,cy:.5,tz:z0,tcx:.5,tcy:.5,anchor:null,mouse:null,px:null,py:null,rec:false,view:false,drag:null,lastStep:performance.now()})}
  clearInterval(ZR.iv);ZR.iv=setInterval(()=>{if(!S.zr)return;zrStep();if(ZR.rec)zrSample(false)},33);
  S.zr=true;$('#zr').style.display='flex';$('#zrStage').appendChild(cv);
  const m=M.get(c.mediaId);$('#zrInfo').textContent=(m?m.name:'clip');
  zrFit();renderFrame();zrUi();
}
async function zrClose(){
  if(ZR.rec)await zrStopRec();
  if(S.playing)pause();
  clearInterval(ZR.iv);S.zr=false;$('#zr').style.display='none';$('#stage').prepend(cv);fitStage();
  ZR.c=null;renderAll();
}
async function zrStartRec(){
  if(ZR.rec||ZR.starting)return;ZR.starting=true;
  try{
    ZR.mic=null;
    if($('#zrMic').checked){
      try{
        const id=LSg('ee-pro-mic','');
        const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:id?{exact:id}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        const rec=new MediaRecorder(stream),r={rec,stream,chunks:[]};rec.ondataavailable=e=>{if(e.data&&e.data.size)r.chunks.push(e.data)};
        rec.start(250);ZR.mic=r;
      }catch(e){toast('No pude usar el micrófono: se grabará solo la imagen. Revisa el permiso del navegador.',7000)}
    }
    Object.assign(ZR,{rec:true,t0:performance.now(),T:[],Sv:[],raw:[],clicks:[],last:-1});
    $('#zrRec').classList.add('live');$('#zrRec').textContent='■ Terminar sesión';
    zrSample(true);
  }finally{ZR.starting=false}
}
function zrSample(force){
  const c=ZR.c,T=(performance.now()-ZR.t0)/1000;
  if(!force&&T-ZR.last<1/30)return;
  ZR.last=T;
  const [x,y]=clampCam(c,ZR.z,ZR.cx,ZR.cy),r4=v=>v==null?null:Math.round(v*1e4)/1e4;
  ZR.T.push(Math.round(T*1e4)/1e4);ZR.Sv.push(Math.round(clipSourceTimeAt(c,clamp(S.t-c.start,0,c.dur))*1e4)/1e4);
  ZR.raw.push({t:Math.round(T*1e4)/1e4,z:r4(ZR.z),cx:r4(x),cy:r4(y),px:r4(ZR.px),py:r4(ZR.py)});
}
async function zrStopRec(){
  if(!ZR.rec)return;
  zrSample(true);ZR.rec=false;
  $('#zrRec').classList.remove('live');$('#zrRec').textContent='● Grabar sesión';$('#zrRecInfo').textContent='';
  if(S.playing)pause();
  const src=ZR.c,dur=ZR.T[ZR.T.length-1];
  let voice=null;
  if(ZR.mic){const r=ZR.mic;ZR.mic=null;const done=new Promise(res=>r.rec.onstop=res);r.rec.stop();await done;r.stream.getTracks().forEach(t=>t.stop());voice=new Blob(r.chunks,{type:r.rec.mimeType})}
  if(dur<.3){toast('La sesión fue demasiado corta.');return}
  const start=total();
  const n={...JSON.parse(JSON.stringify(src)),id:uid(),start,dur,in:0,speed:1,speedCurve:[],zoomKfs:[],scale:1,x:0,y:0,env:[],fadeIn:0,fadeOut:0,
    vol:.6,sess:{t:ZR.T,s:ZR.Sv},cam:{v:2,raw:ZR.raw,clicks:ZR.clicks,smooth:+$('#zrSmooth').value,ptr:$('#zrPtr').checked,size:+$('#zrPtrSz').value}};
  n.track='V1';S.clips.push(n);
  let vc=null;
  if(voice){try{vc=await ingestRecording(voice,start)}catch(e){console.error(e);toast('No pude guardar tu voz: '+e.message,7000)}}
  MS.clear();MS.add(n.id);S.sel=n.id;commit();
  ZR.n++;
  await zrClose();
  seek(start);renderAll();
  toast(`🎬 Sesión grabada (${fmt(dur)})${vc?' con tu voz':''}. Quedó al final del timeline: pulsa ▶ para verla. Si ya no necesitas el clip original, bórralo.`,9000);
}
function zrUi(){
  if(!S.zr)return;const c=ZR.c;
  const f=clamp((S.t-c.start)/c.dur,0,1);$('#zrProg i').style.width=(f*100)+'%';$('#zrProg b').style.left=(f*100)+'%';
  $('#zrTime').textContent=fmt(S.t-c.start).slice(0,8)+' / '+fmt(c.dur).slice(0,8);
  $('#zrPlay').textContent=S.playing?'⏸ Pausa':'▶ Reproducir';
  $('#zrZoom').textContent=`zoom ${ZR.z.toFixed(2)}x`;
  if(ZR.rec)$('#zrRecInfo').textContent='● REC '+fmt((performance.now()-ZR.t0)/1000).slice(0,5);
}
function zrLoop(){
  if(S.zr&&ZR.c){
    const c=ZR.c;
    if(S.playing&&S.t-c.start>=c.dur-1e-3)pause();   // fin del clip: se pausa, pero la sesión sigue grabando
    zrStep();
    if(ZR.rec)zrSample(false);
    zrUi();
  }
  requestAnimationFrame(zrLoop);
}
function buildZr(){
  const d=document.createElement('div');d.id='zr';d.className='zr';
  d.innerHTML=`<div class="zrtop"><b>🎬 Editor de Zoom</b><span id="zrInfo" class="hint"></span><span class="pill" id="zrZoom"></span><span id="zrRecInfo" class="recinfo"></span><span style="flex:1"></span>
    <label class="hint">Suavizado <input type="range" id="zrSmooth" min="0" max="1" step="0.05" value="0.5" style="width:110px"></label>
    <label class="hint"><input type="checkbox" id="zrPtr" checked> Puntero huevito</label>
    <label class="hint">Tamaño <input type="range" id="zrPtrSz" min="0.5" max="2.5" step="0.1" value="1" style="width:90px"></label>
    <button id="zrClose" class="pri">Listo ✓</button></div>
    <div id="zrStage"></div>
    <div class="zrbar"><button id="zrStart" title="Ir al inicio del clip">⏮</button><button id="zrPlay">▶ Reproducir</button>
      <button id="zrRec" class="warn" title="Graba todo lo que haces y dices, aunque pauses o muevas la barra (tecla R)">● Grabar sesión</button>
      <label class="hint chk" style="margin:0"><input type="checkbox" id="zrMic" checked> 🎙 Grabar mi voz</label>
      <div id="zrProg" title="Arrastra para adelantar o retroceder el video"><i></i><b></b></div><span id="zrTime" class="hint" style="font-family:'JetBrains Mono',monospace"></span></div>
    <div class="zrhint"><b>● Grabar sesión</b> graba todo lo que ves y dices: puedes <b>pausar</b> (<kbd>Espacio</kbd>), <b>adelantar o retroceder</b> arrastrando la barra, <b>clic y arrastrar hacia arriba</b> = acercar sobre ese punto (hacia abajo = alejar; también con la rueda), <b>clic derecho y arrastrar</b> = mover el encuadre, apuntar con el huevito y hacer <b>clic</b> para marcar. «Suavizado» = qué tan estable va la cámara. Al terminar se crea un clip «Sesión» al final del timeline, con tu voz. <kbd>Doble clic</kbd> = volver a 1x · <kbd>R</kbd> grabar/terminar · <kbd>Esc</kbd> salir. El micrófono es el elegido en la pestaña 🎙 Voz; usa audífonos.</div>`;
  document.body.appendChild(d);
  const st=$('#zrStage');
  st.addEventListener('contextmenu',e=>{if(S.zr)e.preventDefault()},true);
  st.addEventListener('pointerdown',e=>{
    if(!S.zr||e.pointerType==='touch')return;e.stopPropagation();e.preventDefault();
    ZR.mouse={clientX:e.clientX,clientY:e.clientY};
    const p=zrMouse(e),pan=e.button===2||e.button===1||e.shiftKey;
    if(p.inside){ZR.px=clamp(p.u,0,1);ZR.py=clamp(p.v,0,1)}
    dropAnchor();
    // clic izquierdo + arrastrar = zoom sobre ese punto · derecho / Shift + arrastrar = mover el encuadre
    ZR.drag={pan,x:e.clientX,y:e.clientY,z0:ZR.tz,tcx:ZR.tcx,tcy:ZR.tcy,moved:false,k:p.k,sw:p.sw,sh:p.sh,r:cv.getBoundingClientRect(),
      A:{u:p.u,v:p.v,mx:p.mx,my:p.my}};
    try{st.setPointerCapture(e.pointerId)}catch(_){}
  },true);
  st.addEventListener('pointermove',e=>{
    if(!S.zr||e.pointerType==='touch')return;e.stopPropagation();
    ZR.mouse={clientX:e.clientX,clientY:e.clientY};
    const D=ZR.drag;
    if(D){const dx=e.clientX-D.x,dy=e.clientY-D.y;
      if(Math.abs(dx)+Math.abs(dy)>5)D.moved=true;
      if(D.moved){
        if(D.pan){const sx=S.w/D.r.width;[ZR.tcx,ZR.tcy]=clampCam(ZR.c,ZR.tz,D.tcx-dx*sx/(D.sw*D.k),D.tcy-dy*sx/(D.sh*D.k))}
        else{ // arriba o derecha = acercar · abajo o izquierda = alejar
          ZR.tz=clamp(D.z0*Math.exp((dx-dy)*.006),1,8);ZR.anchor=D.A}
      }
    }else if(ZR.anchor){const q=zrMouse(e);if(Math.hypot(q.mx-ZR.anchor.mx,q.my-ZR.anchor.my)>S.w*.03)dropAnchor()}
    const q=zrMouse(e);
    if(q.inside){ZR.px=clamp(q.u,0,1);ZR.py=clamp(q.v,0,1)}else{ZR.px=null;ZR.py=null}
  },true);
  st.addEventListener('pointerup',e=>{
    if(!S.zr||e.pointerType==='touch')return;e.stopPropagation();
    const D=ZR.drag;
    if(D&&!D.moved&&!D.pan&&ZR.px!=null){ZR.liveClick=performance.now();if(ZR.rec)ZR.clicks.push(Math.round((performance.now()-ZR.t0)/10)/100)}
    ZR.drag=null;
  },true);
  st.addEventListener('pointerleave',e=>{if(ZR.drag||e.pointerType==='touch')return;ZR.mouse=null;ZR.px=null;ZR.py=null});
  st.addEventListener('dblclick',e=>{if(!S.zr)return;e.stopPropagation();ZR.anchor=null;ZR.tz=1;ZR.tcx=.5;ZR.tcy=.5},true);
  st.addEventListener('wheel',e=>{
    if(!S.zr)return;e.preventDefault();e.stopPropagation();
    const p=zrMouse(e);
    if(!ZR.anchor||Math.hypot(p.mx-ZR.anchor.mx,p.my-ZR.anchor.my)>S.w*.03){dropAnchor();ZR.anchor={u:p.u,v:p.v,mx:p.mx,my:p.my}}
    ZR.tz=clamp(ZR.tz*Math.exp(-e.deltaY*.0016),1,8);
  },{passive:false,capture:true});

  /* --- dedos: pellizco = zoom (y mover con dos dedos), un dedo = huevito, toque = marca, doble toque = 1x --- */
  const TT={pinch:null,tap:null,last:0};
  const tch=(e,ph)=>{
    if(!S.zr)return;e.preventDefault();e.stopPropagation();
    const ts=e.touches;
    if(ts.length>=2){
      const a=ts[0],b=ts[1],m={clientX:(a.clientX+b.clientX)/2,clientY:(a.clientY+b.clientY)/2},d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),p=zrMouse(m);
      if(!TT.pinch){dropAnchor();TT.pinch={d0:Math.max(20,d),z0:ZR.tz,A:{u:p.u,v:p.v,mx:p.mx,my:p.my,tmx:p.mx,tmy:p.my}};ZR.anchor=TT.pinch.A}
      TT.tap=null;ZR.tz=clamp(TT.pinch.z0*d/TT.pinch.d0,1,8);TT.pinch.A.tmx=p.mx;TT.pinch.A.tmy=p.my;ZR.anchor=TT.pinch.A;
      return;
    }
    if(TT.pinch){TT.pinch=null;dropAnchor();TT.tap=null;if(ph!=='end')return}
    if(ts.length===1){
      const t=ts[0];if(ph==='start')TT.tap={x:t.clientX,y:t.clientY,t:performance.now()};
      else if(TT.tap&&Math.hypot(t.clientX-TT.tap.x,t.clientY-TT.tap.y)>12)TT.tap=null;
      ZR.mouse={clientX:t.clientX,clientY:t.clientY};const q=zrMouse(ZR.mouse);if(q.inside){ZR.px=clamp(q.u,0,1);ZR.py=clamp(q.v,0,1)}
    }
    if(ts.length===0){
      const now=performance.now();
      if(TT.tap&&now-TT.tap.t<350){
        if(now-TT.last<320){ZR.anchor=null;ZR.tz=1;ZR.tcx=.5;ZR.tcy=.5;TT.last=0}
        else{TT.last=now;if(ZR.px!=null){ZR.liveClick=now;if(ZR.rec)ZR.clicks.push(Math.round((now-ZR.t0)/10)/100)}}
      }
      TT.tap=null;ZR.mouse=null; // el huevito se queda donde apuntaste
    }
  };
  st.addEventListener('touchstart',e=>tch(e,'start'),{passive:false});
  st.addEventListener('touchmove',e=>tch(e,'move'),{passive:false});
  st.addEventListener('touchend',e=>tch(e,'end'),{passive:false});
  st.addEventListener('touchcancel',e=>tch(e,'end'),{passive:false});
  // barra del clip: arrastrar para mover el video (también mientras grabas)
  const pg=$('#zrProg');
  const goTo=ev=>{const r=pg.getBoundingClientRect(),f=clamp((ev.clientX-r.left)/r.width,0,1);seek(ZR.c.start+f*(ZR.c.dur-1/(S.fps||60)))};
  pg.addEventListener('pointerdown',e=>{if(!S.zr)return;e.preventDefault();try{pg.setPointerCapture(e.pointerId)}catch(_){}goTo(e);pg.classList.add('drag')});
  pg.addEventListener('pointermove',e=>{if(e.buttons&1&&pg.classList.contains('drag'))goTo(e)});
  pg.addEventListener('pointerup',()=>pg.classList.remove('drag'));
  $('#zrClose').onclick=()=>zrClose();
  $('#zrPlay').onclick=()=>{if(S.playing)pause();else{if(S.t>=ZR.c.start+ZR.c.dur-.05)seek(ZR.c.start);play()}};
  $('#zrStart').onclick=()=>seek(ZR.c.start);
  $('#zrRec').onclick=()=>ZR.rec?zrStopRec():zrStartRec();
  addEventListener('resize',()=>{if(S.zr)setTimeout(zrFit,10)});
}

/* ------------------------------------------------------------------
   TECLADO (va antes que los atajos del editor)
   ------------------------------------------------------------------ */
function wireKeys(){
  addEventListener('keydown',e=>{
    const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'&&e.target.type!=='range'&&e.target.type!=='checkbox'||tag==='textarea'||tag==='select')return;
    const k=e.key;
    if(S.zr){
      e.stopImmediatePropagation();
      if(k===' '){e.preventDefault();$('#zrPlay').click()}
      else if(k==='r'||k==='R'){e.preventDefault();$('#zrRec').click()}
      else if(k==='Escape'){zrClose()}
      else if(k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();seek(S.t+(k==='ArrowLeft'?-1:1)*(e.shiftKey?1:1/(S.fps||60)))}
      return;
    }
    if(tap.on&&(k==='k'||k==='K')){e.preventDefault();e.stopImmediatePropagation();tapHit();return}
    if(tap.on&&k==='Escape'){e.stopImmediatePropagation();tapFinish();return}
    if(k==='b'||k==='B'){e.stopImmediatePropagation();if(!e.repeat)setBypass(true);return}
    if((k==='p'||k==='P')&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();capture();return}
  },true);
  addEventListener('keyup',e=>{if(e.key==='b'||e.key==='B')setBypass(false)},true);
  addEventListener('blur',()=>setBypass(false));
}

/* ------------------------------------------------------------------
   INICIO
   ------------------------------------------------------------------ */
PRO.init2=()=>{
  buildZr();wireKeys();requestAnimationFrame(zrLoop);
  // antes / después
  const bb=$('#bBefore');
  bb.addEventListener('pointerdown',e=>{e.preventDefault();setBypass(true);const up=()=>{setBypass(false);removeEventListener('pointerup',up)};addEventListener('pointerup',up)});
  $('#bCmp').onclick=()=>setCmp(!cmp);
  $('#cmpX').oninput=e=>{cmpX=+e.target.value;renderFrame()};
  $('#bShot').onclick=capture;$('#bShotAll').onclick=downloadAllShots;
  $('#bSafe').onclick=()=>{S.safe=!S.safe;$('#bSafe').classList.toggle('on',S.safe);renderFrame();if(S.safe&&S.h<=S.w*1.3)toast('Las zonas seguras se ven en formato vertical 9:16.')};
  $('#bSafe').classList.toggle('on',S.safe);
  // aplicar a todo
  $('#bApplyAll').onclick=applyAll;$('#bApplyAll2').onclick=applyAll;
  // voz
  $('#bRec').onclick=toggleRec;$('#bNorm').onclick=normalize;$('#bClean').onclick=toggleClean;$('#bSil').onclick=removeSilences;
  $('#silMin').oninput=e=>$('#silLbl').textContent=(+e.target.value).toFixed(2)+' s';
  $('.tabs button[data-tab="audio"]').addEventListener('click',()=>listMics().catch(()=>{}));
  // subtítulos
  const key=SHORTS?'ee-shorts-script':'ee-pro-script';
  $('#subScript').value=LSg(key,'');$('#subScript').oninput=e=>LSs(key,e.target.value);
  if(SHORTS){$('#subWords').value=3;$('#subPos').value=22;$('#subFont').value='Anton'}
  $('#bSubAuto').onclick=subsAuto;$('#bSubTap').onclick=subsTap;$('#bSubEven').onclick=subsEven;$('#bSubDel').onclick=subsDel;
  ['subStyle','subFont','subUpper','subHi','subPos'].forEach(id=>{$('#'+id).addEventListener('input',restyleSubs);$('#'+id).addEventListener('change',()=>{restyleSubs();commit()})});
  // editor de zoom
  $('#bZoomRec').onclick=zrOpen;$('#bStageZoomRec').onclick=zrOpen;
  // shorts
  if(SHORTS){
    document.body.classList.add('mode-shorts');
    $('.brand span.pro').textContent='SHORTS';document.title='EasterEgg Studio SHORTS';
    $('.tabs button[data-tab="short"]').click();
    $$('#tab-short [data-go]').forEach(b=>b.onclick=()=>{
      const g=b.dataset.go;
      if(g==='zoomrec')zrOpen();
      else if(g==='export')$('#bExport').click();
      else $(`.tabs button[data-tab="${g}"]`).click();
    });
    if(S.aspect!=='9:16')toast('Este proyecto no está en vertical. Cambia Formato a 9:16 arriba.',6000);
  }
  renderShots();
};
PRO._t2={capture,applyAll,normalize,removeSilences,ingestRecording,toWav,subsEven,subsAuto,align,buildSubs,group,zrOpen,zrClose,zrStartRec,zrStopRec,zrSample,zrStep,ZR,camAt,shots,tap,tapHit,tapFinish,subsTap,setCmp,setBypass};
})();
