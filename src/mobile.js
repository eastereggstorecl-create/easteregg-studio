/* ------------------------------------------------------------------
   MODO MÓVIL (Android): barra inferior, hojas deslizables y gestos
   ------------------------------------------------------------------ */
PRO.multiTap=false;
// en el celular, tocar un clip no seleccionado solo lo selecciona (así deslizar el timeline no lo mueve)
PRO.touchGate=(e,c)=>{
  if(!MOB||e.pointerType!=='touch'||PRO.multiTap)return false;
  if(MS.has(c.id)&&(S.sel===c.id||MS.size>1))return false;
  e.preventDefault();e.stopPropagation();MS.clear();MS.add(c.id);S.sel=c.id;renderAll();return true;
};
PRO.initMob=()=>{
  if(!MOB)return;
  const vp=document.querySelector('meta[name=viewport]');
  if(vp)vp.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  // un gesto cancelado por el navegador cuenta como «soltar» (evita clips pegados al dedo)
  addEventListener('pointercancel',e=>dispatchEvent(new PointerEvent('pointerup',{clientX:e.clientX,clientY:e.clientY,pointerId:e.pointerId,pointerType:e.pointerType,bubbles:true})),true);

  /* --- hoja «Proyecto»: lo que en PC está en la barra de arriba --- */
  const pj=document.createElement('div');pj.id='mProj';
  pj.innerHTML='<div class="msh"><span>⚙ Proyecto</span><button data-x>✕</button></div>';
  const hdr=$('header');
  const row=document.createElement('div');row.className='row';
  ['#bNew','#bSave','#bOpen'].forEach(s=>{const b=$(s);if(b)row.appendChild(b)});
  const nm=$('#pname');if(nm){const l=document.createElement('label');l.textContent='Nombre';l.appendChild(nm);pj.appendChild(l)}
  pj.appendChild(row);
  ['#aspect','#res','#fps','#upscaleMode'].forEach(s=>{const el=$(s);if(el&&el.parentElement.tagName==='LABEL')pj.appendChild(el.parentElement)});
  const ws=hdr.querySelector('.wsbar');if(ws)pj.appendChild(ws);
  const tip=document.createElement('div');tip.className='hint';
  tip.innerHTML='Consejos para el celular: exporta en <b>1080p</b> (4K funciona pero tarda y calienta el teléfono). Usa audífonos al grabar tu voz. Para instalarlo como app: menú ⋮ de Chrome → <b>Agregar a la pantalla principal</b>.';
  pj.appendChild(tip);
  $('#app').appendChild(pj);

  /* --- hojas --- */
  const veil=document.createElement('div');veil.id='mVeil';$('#app').appendChild(veil);
  const left=$('#left'),right=$('#right');
  const lh=document.createElement('div');lh.className='msh';lh.innerHTML='<span id="mLeftT"></span><button data-x>✕</button>';left.prepend(lh);
  const rh=document.createElement('div');rh.className='msh';rh.innerHTML='<span>✎ Ajustes del clip</span><button data-x>✕</button>';right.prepend(rh);
  let cur=null;
  const close=()=>{[left,right,pj].forEach(x=>x.classList.remove('mon'));document.documentElement.classList.remove('msheet');cur=null;
    $$('#mNav button').forEach(b=>b.classList.remove('on'))};
  const open=(id)=>{
    if(cur===id){close();return}
    close();cur=id;const it=NAV.find(n=>n.id===id);
    if(it.tab){const tb=document.querySelector(`#left .tabs [data-tab="${it.tab}"]`);if(tb)tb.click();$('#mLeftT').textContent=it.i+' '+it.t;left.classList.add('mon')}
    else if(id==='clip'){if(!selClip()){toast('Toca primero un clip en el timeline.');cur=null;return}renderInspector();right.classList.add('mon')}
    else if(id==='proj')pj.classList.add('mon');
    document.documentElement.classList.add('msheet');
    const b=document.querySelector(`#mNav [data-m="${id}"]`);if(b)b.classList.add('on');
  };
  [veil,...document.querySelectorAll('.msh [data-x]')].forEach(x=>x.addEventListener('click',close));
  const NAV=[
    {id:'media',i:'📁',t:'Media',tab:'media'},{id:'clip',i:'✎',t:'Clip'},{id:'look',i:'🎨',t:'Color',tab:'look'},
    {id:'trans',i:'🎬',t:'Transición',tab:'trans'},{id:'text',i:'🔤',t:'Texto',tab:'text'},{id:'mask',i:'◐',t:'Máscara',tab:'mask'},{id:'audio',i:'🎙',t:'Voz',tab:'audio'},{id:'zoom',i:'🔍',t:'Zoom',tab:'zoom'},
    {id:'speed',i:'⏩',t:'Velocidad',tab:'speed'},{id:'fx',i:'✨',t:'FX',tab:'fx'},{id:'short',i:'📱',t:'Short',tab:'short'},{id:'proj',i:'⚙',t:'Proyecto'}];
  const nav=document.createElement('nav');nav.id='mNav';
  NAV.filter(n=>n.id!=='short'||SHORTS).forEach(n=>{const b=document.createElement('button');b.dataset.m=n.id;b.innerHTML=`<i>${n.i}</i>${n.t}`;b.onclick=()=>open(n.id);nav.appendChild(b)});
  $('#app').appendChild(nav);
  // abrir la hoja que corresponde cuando otra parte del editor cambia de pestaña (p. ej. la guía de Shorts)
  $$('#left .tabs [data-tab]').forEach(tb=>tb.addEventListener('click',()=>{
    const it=NAV.find(n=>n.tab===tb.dataset.tab);if(it&&cur&&cur!==it.id&&left.classList.contains('mon')){cur=it.id;$('#mLeftT').textContent=it.i+' '+it.t;
      $$('#mNav button').forEach(b=>b.classList.toggle('on',b.dataset.m===it.id))}}));
  PRO.mobOpen=open;PRO.mobClose=close;

  /* --- botón «Varios» para seleccionar varios clips tocándolos --- */
  const bm=document.createElement('button');bm.id='bMulti';bm.textContent='☑ Varios';bm.title='Activa y toca varios clips para seleccionarlos juntos';
  bm.onclick=()=>{PRO.multiTap=!PRO.multiTap;bm.classList.toggle('on',PRO.multiTap);toast(PRO.multiTap?'Toca los clips que quieras sumar a la selección.':'Selección normal.')};
  const tb=$('#tlbar');tb.insertBefore(bm,tb.children[2]||null);

  /* --- timeline: pellizcar con dos dedos = acercar / alejar --- */
  const sc=$('#tlscroll');let P=null;
  const mid=ts=>(ts[0].clientX+ts[1].clientX)/2,dist=ts=>Math.hypot(ts[0].clientX-ts[1].clientX,ts[0].clientY-ts[1].clientY);
  sc.addEventListener('touchstart',e=>{if(e.touches.length===2){const r=sc.getBoundingClientRect(),m=mid(e.touches);
    P={d0:dist(e.touches),p0:S.pps,t:(m-r.left+sc.scrollLeft)/S.pps}}},{passive:true});
  sc.addEventListener('touchmove',e=>{if(!P||e.touches.length<2)return;e.preventDefault();
    const r=sc.getBoundingClientRect(),m=mid(e.touches);setZoom(P.p0*dist(e.touches)/P.d0);sc.scrollLeft=P.t*S.pps-(m-r.left)},{passive:false});
  sc.addEventListener('touchend',e=>{if(e.touches.length<2)P=null});

  /* --- mover el borde del timeline con el dedo --- */
  const sp=$('#tlSplit'),app=$('#app');
  sp.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;e.stopImmediatePropagation();e.preventDefault();
    const mv=ev=>{app.style.setProperty('--mtlh',clamp(innerHeight-60-ev.clientY,120,innerHeight*.62)+'px');fitStage()};
    const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);fitStage();renderTimeline()};
    addEventListener('pointermove',mv);addEventListener('pointerup',up)},true);

  // textos pensados para el dedo
  const se=$('#stageEmpty b');if(se)se.parentElement.innerHTML='<b>Empieza aquí</b>Toca 📁 Media abajo<br>y luego «+ Importar archivos»';
  const zh=document.querySelector('.zrhint');
  if(zh)zh.innerHTML='<b>● Grabar sesión</b> graba todo lo que ves y dices. <b>Pellizca con dos dedos</b> para hacer zoom (y arrástralos para mover), <b>un dedo</b> mueve el huevito, <b>un toque</b> marca y <b>doble toque</b> vuelve a 1x. Mueve la barra para adelantar o retroceder; puedes pausar y seguir hablando.';
  addEventListener('resize',()=>setTimeout(fitStage,60));
  setTimeout(fitStage,50);
};
