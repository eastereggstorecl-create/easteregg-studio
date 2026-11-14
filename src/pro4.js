/* ==================================================================
   PRO 4 · capas: transiciones, máscaras y zoom suave (tipo CapCut)
   ================================================================== */
(()=>{
const LC={};
function oc(k){let c=LC[k];if(!c){c=LC[k]=document.createElement('canvas')}if(c.width!==S.w||c.height!==S.h){c.width=S.w;c.height=S.h}return c}
function ctx2(c){const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.filter='none';g.globalCompositeOperation='source-over';return g}
const ez=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const ss=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
PRO._ctx=null;

/* ------------------------------------------------------------------
   TRANSICIONES
   ------------------------------------------------------------------ */
const TR=[
  {id:'fade',i:'◐',n:'Fundido'},{id:'black',i:'■',n:'Fundido a negro'},{id:'white',i:'□',n:'Fundido a blanco'},{id:'flash',i:'✦',n:'Destello'},
  {id:'wipe',i:'▶|',n:'Barrido',dir:1,soft:1},{id:'whip',i:'≫',n:'Barrido rápido',dir:1},{id:'push',i:'⇥',n:'Empuje',dir:1},
  {id:'zoomin',i:'⊕',n:'Zoom entrando'},{id:'zoomout',i:'⊖',n:'Zoom saliendo'},{id:'blur',i:'◌',n:'Desenfoque'},
  {id:'spin',i:'↻',n:'Giro'},{id:'glitch',i:'▚',n:'Glitch'},{id:'hidden',i:'⟋',n:'Corte oculto (poste)'}];
/* cada clip tiene una LISTA de transiciones (se apilan); los proyectos viejos (tr / trOut) se convierten solos */
let trSeq=0;const tid=()=>'t'+Date.now().toString(36)+(trSeq++);
function trs(c){
  if(c.tr){(c.trs=c.trs||[]).push({...c.tr,side:'in',id:c.tr.id||tid()});delete c.tr}
  if(c.trOut){(c.trs=c.trs||[]).push({...c.trOut,side:'out',id:c.trOut.id||tid()});delete c.trOut}
  return c.trs||[];
}
function trStateOf(c,T,t){
  const side=T.side||'in',d=Math.max(.05,Math.min(T.dur||.6,c.dur)),off=clamp(T.off||0,0,Math.max(0,c.dur-d));
  const p=side==='in'?(t-c.start-off)/d:(c.start+c.dur-off-t)/d;
  // antes del punto de inicio (o después del de salida) el clip aún no se ve
  if(p<0&&(side==='in'?t>=c.start:t<c.start+c.dur))return {T,p:0,side};
  if(p>=0&&p<1)return {T,p,side};
  return null;
}
function trStates(c,t){const out=[];for(const T of trs(c)){if(!T.type||T.mute)continue;const st=trStateOf(c,T,t);if(st)out.push(st)}return out}
function trState(c,t){return trStates(c,t)[0]||null}
function rnd(i,s){const x=Math.sin(i*12.9898+s*78.233)*43758.5453;return x-Math.floor(x)}
function dirV(d){return d==='l'?[-1,0]:d==='u'?[0,-1]:d==='d'?[0,1]:[1,0]}
function snapA(){const A=oc('a');ctx2(A).drawImage(cv,0,0);return A}
function drawT(g,img,sx,sy,rot,alpha,blur,dx=0,dy=0){
  const W=S.w,H=S.h;g.save();g.globalAlpha=clamp(alpha,0,1);if(blur>.3)g.filter=`blur(${blur}px)`;
  g.translate(W/2+dx,H/2+dy);if(rot)g.rotate(rot);g.scale(sx,sy);g.drawImage(img,-W/2,-H/2,W,H);g.restore();
}
function compose(tr,B){
  const g=cx,W=S.w,H=S.h,T=tr.T,AM=T.amt??1,OP=T.op??1,u=Math.min(W,H)/1080*AM,p=clamp(tr.p,0,1),e=ez(p);
  const fr=Math.round(S.t*(S.fps||30));
  g.save();g.setTransform(1,0,0,1,0,0);g.filter='none';g.globalAlpha=1;
  switch(T.type){
    case 'black':case 'white':{const col=T.type==='black'?'#000':'#fff';g.fillStyle=col;
      if(p<.5){g.globalAlpha=ez(p*2)*OP;g.fillRect(0,0,W,H)}
      else{g.drawImage(B,0,0);g.globalAlpha=(1-ez((p-.5)*2))*OP;g.fillRect(0,0,W,H)}break}
    case 'flash':{g.globalAlpha=ss(.3,.7,p);g.drawImage(B,0,0);g.globalAlpha=Math.min(1,Math.pow(Math.sin(Math.PI*p),2)*.9*OP);g.fillStyle='#fff';g.fillRect(0,0,W,H);break}
    case 'wipe':{
      const [vx,vy]=dirV(T.dir),L=vx?W:H,fw=Math.max(1,(T.soft??.15)*L),pos=e*(L+fw);
      const bg=B.getContext('2d');bg.save();bg.setTransform(1,0,0,1,0,0);bg.globalCompositeOperation='destination-in';
      // la coordenada crece en la dirección del barrido
      const a=vx>0?[0,0]:vx<0?[W,0]:vy>0?[0,0]:[0,H],dv=[vx,vy];
      const s0=[a[0]+dv[0]*(pos-fw),a[1]+dv[1]*(pos-fw)],s1=[a[0]+dv[0]*pos,a[1]+dv[1]*pos];
      const gr=bg.createLinearGradient(s0[0],s0[1],s1[0],s1[1]);gr.addColorStop(0,'#fff');gr.addColorStop(1,'rgba(255,255,255,0)');
      bg.fillStyle=gr;bg.fillRect(0,0,W,H);bg.restore();g.drawImage(B,0,0);break}
    case 'whip':case 'push':{
      const A=snapA(),[vx,vy]=dirV(T.dir),bl=T.type==='whip'?70*u*Math.sin(Math.PI*p):0;
      g.fillStyle='#000';g.fillRect(0,0,W,H);
      drawT(g,A,1,1,0,1,bl,-vx*e*W,-vy*e*H);drawT(g,B,1,1,0,1,bl,vx*(1-e)*W,vy*(1-e)*H);break}
    case 'zoomin':{const A=snapA(),bl=24*u*Math.sin(Math.PI*p);g.fillStyle='#000';g.fillRect(0,0,W,H);
      const sa=1+e*1.4*AM;drawT(g,A,sa,sa,0,1-ss(.35,.65,p),bl);const sb=1+.6*AM*(1-e);drawT(g,B,sb,sb,0,ss(.35,.65,p),bl);break}
    case 'zoomout':{const A=snapA(),bl=24*u*Math.sin(Math.PI*p);g.fillStyle='#000';g.fillRect(0,0,W,H);
      const sa=1-Math.min(.9,.45*AM)*e;drawT(g,A,sa,sa,0,1-ss(.35,.65,p),bl);const sb=1+1.2*AM*(1-e);drawT(g,B,sb,sb,0,ss(.35,.65,p),bl);break}
    case 'blur':{const A=snapA();g.fillStyle='#000';g.fillRect(0,0,W,H);
      drawT(g,A,1,1,0,1,34*u*ss(0,.55,p));drawT(g,B,1,1,0,ss(.3,.7,p),34*u*(1-ss(.45,1,p)));break}
    case 'spin':{const A=snapA(),bl=18*u*Math.sin(Math.PI*p);g.fillStyle='#000';g.fillRect(0,0,W,H);
      drawT(g,A,1+e*.8*AM,1+e*.8*AM,e*Math.PI*.6*AM,1-ss(.4,.6,p),bl);drawT(g,B,1+.8*AM*(1-e),1+.8*AM*(1-e),-(1-e)*Math.PI*.6*AM,ss(.4,.6,p),bl);break}
    case 'glitch':{const A=snapA();g.globalAlpha=ss(.4,.6,p);g.drawImage(B,0,0);g.globalAlpha=1;
      const amp=Math.sin(Math.PI*p),n=14;
      for(let i=0;i<n;i++){if(rnd(i,fr)>.35+.5*(1-amp))continue;const y=rnd(i+40,fr)*H,h=(.01+rnd(i+80,fr)*.07)*H,dx=(rnd(i+120,fr)-.5)*120*u*amp;
        const src=rnd(i+160,fr)<p?B:A;g.drawImage(src,0,y,W,h,dx,y,W,h)}
      if(amp>.2){g.globalCompositeOperation='lighter';g.globalAlpha=.25*amp*OP;g.fillStyle=rnd(7,fr)<.5?'#ff0040':'#00e5ff';g.fillRect(0,rnd(9,fr)*H,W,H*.04)}
      break}
    default:{g.globalAlpha=ez(p);g.drawImage(B,0,0)}
  }
  g.restore();
}

/* ------------------------------------------------------------------
   MÁSCARAS (forma con marcas en el tiempo)
   ------------------------------------------------------------------ */
function cr(p0,p1,p2,p3,f){const f2=f*f,f3=f2*f;return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f2+(-p0+3*p1-3*p2+p3)*f3)}
function maskShape(c,t){
  const M=c.mask;if(!M||!M.kfs||!M.kfs.length)return null;
  const K=M.kfs,lt=t-c.start;
  if(K.length===1||lt<=K[0].t)return K[0].pts;
  if(lt>=K[K.length-1].t)return K[K.length-1].pts;
  let i=0;while(i<K.length-2&&K[i+1].t<=lt)i++;
  const a=K[i],b=K[i+1],f=(lt-a.t)/Math.max(1e-6,b.t-a.t),A0=K[i-1]||a,B1=K[i+2]||b;
  if(a.pts.length!==b.pts.length)return f<.5?a.pts:b.pts;
  return a.pts.map((q,j)=>{const q0=(A0.pts[j]||q),q3=(B1.pts[j]||b.pts[j]);
    return [cr(q0[0],q[0],b.pts[j][0],q3[0],f),cr(q0[1],q[1],b.pts[j][1],q3[1],f)]});
}
function shapePath(g,type,pts,W,H){
  g.beginPath();
  if(type==='line'){
    const [x1,y1]=[pts[0][0]*W,pts[0][1]*H],[x2,y2]=[pts[1][0]*W,pts[1][1]*H];
    let dx=x2-x1,dy=y2-y1;const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const nx=dy,ny=-dx,B=(W+H)*4;
    // lado visible: a la derecha de la línea (según su dirección)
    g.moveTo(x1-dx*B,y1-dy*B);g.lineTo(x2+dx*B,y2+dy*B);g.lineTo(x2+dx*B-nx*B,y2+dy*B-ny*B);g.lineTo(x1-dx*B-nx*B,y1-dy*B-ny*B);g.closePath();
  }else if(type==='rect'){const x=Math.min(pts[0][0],pts[1][0])*W,y=Math.min(pts[0][1],pts[1][1])*H;g.rect(x,y,Math.abs(pts[1][0]-pts[0][0])*W,Math.abs(pts[1][1]-pts[0][1])*H)}
  else if(type==='ellipse'){const cxp=(pts[0][0]+pts[1][0])/2*W,cyp=(pts[0][1]+pts[1][1])/2*H;g.ellipse(cxp,cyp,Math.abs(pts[1][0]-pts[0][0])/2*W+.1,Math.abs(pts[1][1]-pts[0][1])/2*H+.1,0,0,Math.PI*2)}
  else{if(pts.length<3)return false;pts.forEach((q,i)=>i?g.lineTo(q[0]*W,q[1]*H):g.moveTo(q[0]*W,q[1]*H));g.closePath()}
  return true;
}
function applyMask(B,c,pts){
  const M=c.mask,W=S.w,H=S.h,m=oc('m'),mg=ctx2(m);mg.clearRect(0,0,W,H);
  const fe=(M.feather||0)*Math.min(W,H);if(fe>.5)mg.filter=`blur(${fe}px)`;
  mg.fillStyle='#fff';
  if(M.inv){mg.fillRect(0,0,W,H);mg.globalCompositeOperation='destination-out'}
  if(shapePath(mg,M.type,pts,W,H))mg.fill();
  const bg=B.getContext('2d');bg.save();bg.setTransform(1,0,0,1,0,0);bg.globalCompositeOperation='destination-in';bg.drawImage(m,0,0);bg.restore();
}
PRO.maskShape=maskShape;

/* ------------------------------------------------------------------
   dibujar un clip como capa (cuando tiene transición o máscara)
   ------------------------------------------------------------------ */
PRO.drawLayer=(c,draw)=>{
  if(c.type==='audio'){draw(c);return}
  const t=S.t,sts=trStates(c,t),mk=c.mask&&!c.mask.mute&&maskShape(c,t);
  if(!sts.length&&!mk){draw(c);return}
  const B=oc('b'),bg=ctx2(B);bg.clearRect(0,0,S.w,S.h);
  PRO._ctx=bg;try{draw(c)}finally{PRO._ctx=null}
  if(mk)applyMask(B,c,mk);
  if(sts.length)sts.forEach(st=>compose(st,B));else cx.drawImage(B,0,0);
};

/* ------------------------------------------------------------------
   ZOOM SUAVE (tipo CapCut)
   ------------------------------------------------------------------ */
const ZF=[{id:'in',n:'Acercar',i:'🔍+'},{id:'out',n:'Alejar',i:'🔍−'},{id:'inout',n:'Acercar y volver',i:'↗↘'},{id:'punch',n:'Golpe',i:'💥'},{id:'pulse',n:'Pulso',i:'💓'},{id:'shake',n:'Temblor',i:'〰'}];
const CURVE={suave:ez,rapida:x=>x===1?1:1-Math.pow(2,-10*x),rebote:x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)},lineal:x=>x};
PRO.zfx=(c,t,tf)=>{
  const Z=c.zfx;if(!Z||!Z.type||Z.mute||!tf)return tf;
  const lt=clamp(t-c.start,0,c.dur),d=Math.max(.05,Math.min(Z.dur||1,c.dur));
  let p;if(Z.at==='todo')p=lt/Math.max(1e-5,c.dur);else if(Z.at==='final')p=(lt-(c.dur-d))/d;else p=lt/d;
  p=clamp(p,0,1);const E=CURVE[Z.curve]||ez,a=Math.max(1.001,Z.amt||1.3);
  let m=1,sx=0,sy=0;
  switch(Z.type){
    case 'in':m=1+(a-1)*E(p);break;
    case 'out':m=a-(a-1)*E(p);break;
    case 'inout':m=1+(a-1)*Math.sin(Math.PI*E(p));break;
    case 'punch':m=1+(a-1)*(CURVE.rapida(clamp(p*3,0,1)));break;
    case 'pulse':m=1+(a-1)*Math.pow(Math.sin(Math.PI*clamp(p,0,1)),2)*(p<1?1:0);break;
    case 'shake':{const k=(a-1)*.06,f=t*28;sx=(Math.sin(f*1.7)+Math.sin(f*2.9)*.5)*k*100;sy=(Math.cos(f*2.3)+Math.sin(f*1.3)*.5)*k*100;m=1+(a-1)*.25;
      const fade=Z.at==='todo'?1:Math.sin(Math.PI*p);sx*=fade;sy*=fade;break}
  }
  if(Math.abs(m-1)<1e-6&&!sx&&!sy)return tf;
  // el punto elegido queda fijo en pantalla
  const fx=(Z.fx??.5)-.5,fy=(Z.fy??.5)-.5,X=tf.x/100,Y=tf.y/100;
  return {...tf,scale:tf.scale*m,x:(fx-(fx-X)*m)*100+sx,y:(fy-(fy-Y)*m)*100+sy};
};

/* ------------------------------------------------------------------
   UI: transiciones
   ------------------------------------------------------------------ */
let side='in',selTr=null;
function belowOf(c,t){const lower=c.track==='V2'?['V1']:c.track==='T2'?['T1','V2','V1']:c.track==='T1'?['V2','V1']:[];
  for(const tid of lower){const x=S.clips.find(o=>o.track===tid&&o.type!=='audio'&&t>=o.start-1e-4&&t<o.start+o.dur-1e-4);if(x)return x}return null}
function autoOverlap(c,d){
  // los dos clips están uno al lado del otro en la misma pista: sube el nuevo a Video 2 y los encima
  if(c.track!=='V1')return false;
  const A=S.clips.filter(o=>o.track==='V1'&&o!==c&&Math.abs(o.start+o.dur-c.start)<.06).sort((a,b)=>b.start-a.start)[0];
  if(!A)return false;
  const m=M.get(A.mediaId),need=(A.in||0)+(A.dur+d)*(A.speed||1)*(typeof speedCurveAvg==='function'?speedCurveAvg(A):1);
  const v2busy=S.clips.some(o=>o.track==='V2'&&o.start<c.start+c.dur&&o.start+o.dur>c.start-d);
  if(v2busy)return toast('Video 2 está ocupado en ese tramo: libera ese espacio o mueve el clip tú mismo.',7000),true;
  c.track='V2';
  if(A.sess||(m&&m.dur&&need<=m.dur+1e-3)){A.dur+=d;toast(`Subí el clip a Video 2 y alargué el anterior ${d.toFixed(2)} s para que se enciman.`,6000)}
  else{const old=c.start;c.start=Math.max(A.start,c.start-d);const sh=old-c.start;
    S.clips.forEach(o=>{if(o!==c&&o.start>=old+c.dur-1e-4)o.start-=sh});
    toast(`Subí el clip a Video 2 y lo adelanté ${sh.toFixed(2)} s para que se enciman (el clip anterior no tenía más video).`,7000)}
  return true;
}
function trApply(id){
  const c=selClip();if(!c||c.type==='audio')return toast('Selecciona primero el clip que entra (el nuevo).');
  if(id==='hidden'){
    if(!belowOf(c,c.start+.01))autoOverlap(c,Math.min(1,c.dur*.5));
    document.querySelector('.tabs [data-tab=mask]').click();mkNew('line');
    toast('Corte oculto: coloca la línea sobre el borde del poste y ve marcando mientras avanza.',8000);return;
  }
  const d=+$('#trDur').value;
  if(side==='in'&&!belowOf(c,c.start+.01))autoOverlap(c,d);
  const T={id:tid(),type:id,side,dur:d,dir:'r',soft:+$('#trSoft').value};
  (c.trs=trs(c)).push(T);selTr=T.id;
  commit();renderAll();trUi();trPreview(T);
  const n=trs(c).filter(x=>x.side===side).length;
  if(n>1)toast(`Ahora hay ${n} transiciones ${side==='in'?'de entrada':'de salida'} en este clip: se apilan. Ajusta cada una en «Capas de efectos» (barra derecha).`,7000);
}
function trCur(){const c=selClip();if(!c)return null;const L=trs(c);return L.find(x=>x.id===selTr)||[...L].reverse().find(x=>x.side===side)||null}
function trUi(){
  const c=selClip(),T=trCur(),def=TR.find(x=>T&&x.id===T.type),have=c?trs(c).filter(x=>x.side===side).map(x=>x.type):[];
  $$('#trGrid button').forEach(b=>b.classList.toggle('on',have.includes(b.dataset.t)));
  $('#trSideIn').classList.toggle('on',side==='in');$('#trSideOut').classList.toggle('on',side==='out');
  if(T){$('#trDur').value=T.dur;$('#trSoft').value=T.soft??.15;$$('#trDirF [data-d]').forEach(b=>b.classList.toggle('on',b.dataset.d===(T.dir||'r')))}
  $('#trDurV').textContent=(+$('#trDur').value).toFixed(2)+' s';$('#trSoftV').textContent=Math.round(+$('#trSoft').value*100)+'%';
  $('#trDirF').style.display=def&&def.dir?'':'none';$('#trSoftF').style.display=def&&def.soft?'':'none';
  let info='';
  if(!c)info='Selecciona el clip que entra.';
  else{const b=belowOf(c,c.start+.01);
    info=(have.length?`${side==='in'?'Entrada':'Salida'}: <b>${have.map(x=>(TR.find(y=>y.id===x)||{n:x}).n).join(' + ')}</b>. Pulsa otra para <b>apilarla</b>. `:'Elige una transición (puedes apilar varias). ')+
      (b?'Debajo está otro clip: la transición mezcla los dos.':'Debajo no hay otro clip: se mezclará con negro (o pulsa una transición y lo encimo por ti).')}
  $('#trInfo').innerHTML=info;
}
function trPreview(T0){const c=selClip(),T=T0||trCur();if(!c||!T)return;const sd=T.side||'in',o=T.off||0,st=sd==='in'?c.start+o-.4:c.start+c.dur-o-T.dur-.4;seek(Math.max(0,st));play();
  const end=(sd==='in'?c.start+o+T.dur:c.start+c.dur-o)+.4;const chk=()=>{if(!S.playing)return;if(S.t>=end){pause();return}requestAnimationFrame(chk)};requestAnimationFrame(chk)}
function wireTr(){
  const gr=$('#trGrid');
  gr.innerHTML=TR.map(x=>`<button data-t="${x.id}"><i>${x.i}</i>${x.n}</button>`).join('');
  gr.onclick=e=>{const b=e.target.closest('button');if(b)trApply(b.dataset.t)};
  $('#trSideIn').onclick=()=>{side='in';trUi()};$('#trSideOut').onclick=()=>{side='out';trUi()};
  const upd=()=>{const T=trCur();$('#trDurV').textContent=(+$('#trDur').value).toFixed(2)+' s';$('#trSoftV').textContent=Math.round(+$('#trSoft').value*100)+'%';
    if(T){T.dur=+$('#trDur').value;T.soft=+$('#trSoft').value;renderTimeline();renderFrame()}};
  $('#trDur').oninput=upd;$('#trSoft').oninput=upd;$('#trDur').onchange=$('#trSoft').onchange=()=>trCur()&&commit();
  $$('#trDirF [data-d]').forEach(b=>b.onclick=()=>{const T=trCur();if(T){T.dir=b.dataset.d;commit();renderFrame()}trUi()});
  $('#trPrev').onclick=()=>trPreview();
  $('#trDel').onclick=()=>{const c=selClip(),T=trCur();if(!c||!T)return;c.trs=trs(c).filter(x=>x!==T);selTr=null;commit();renderAll();trUi()};
}

/* ------------------------------------------------------------------
   UI: zoom suave (en la pestaña Zoom)
   ------------------------------------------------------------------ */
let zfPick=false;
function zfUi(){
  const c=selClip(),Z=c&&c.zfx;
  $$('#zfGrid button').forEach(b=>b.classList.toggle('on',!!Z&&b.dataset.z===Z.type));
  if(Z){$('#zfAmt').value=Z.amt;$('#zfDur').value=Z.dur;$('#zfAt').value=Z.at;$('#zfCurve').value=Z.curve}
  $('#zfAmtV').textContent=(+$('#zfAmt').value).toFixed(2)+'x';$('#zfDurV').textContent=(+$('#zfDur').value).toFixed(2)+' s';
  $('#zfPt').textContent=zfPick?'… toca el visor':(Z&&Z.fx!=null?`🎯 Punto: ${Math.round(Z.fx*100)}%, ${Math.round(Z.fy*100)}%`:'🎯 Elegir punto');
  $('#zfPt').classList.toggle('on',zfPick);
}
function zfSet(type){const c=selClip();if(!c||c.type==='audio'||c.type==='text'&&false)return toast('Selecciona un clip.');
  const old=c.zfx||{};c.zfx={type,amt:+$('#zfAmt').value,dur:+$('#zfDur').value,at:$('#zfAt').value,curve:$('#zfCurve').value,fx:old.fx??.5,fy:old.fy??.5};
  commit();renderAll();zfUi();const st=c.zfx.at==='final'?c.start+c.dur-c.zfx.dur-.2:c.start;seek(Math.max(c.start,st));play();
  const end=c.zfx.at==='todo'?c.start+c.dur:(c.zfx.at==='final'?c.start+c.dur:c.start+c.zfx.dur+.4);
  const chk=()=>{if(!S.playing)return;if(S.t>=Math.min(end,c.start+c.dur-.02)){pause();return}requestAnimationFrame(chk)};requestAnimationFrame(chk)}
function wireZf(){
  const pane=$('#tab-zoom');if(!pane)return;
  const d=document.createElement('div');d.id='zfBox';
  d.innerHTML=`<h4>Zoom suave (estilo CapCut)</h4>
    <div class="hint" style="margin-bottom:6px">Elige un efecto y se aplica al clip seleccionado con un movimiento suave. Puedes elegir <b>dónde</b> hacer zoom tocando el visor.</div>
    <div id="zfGrid" class="trgrid">${ZF.map(z=>`<button data-z="${z.id}"><i>${z.i}</i>${z.n}</button>`).join('')}</div>
    <div class="fld"><label>Intensidad <span id="zfAmtV" class="pill"></span></label><input type="range" id="zfAmt" min="1.05" max="2.5" step="0.01" value="1.3"></div>
    <div class="fld"><label>Duración <span id="zfDurV" class="pill"></span></label><input type="range" id="zfDur" min="0.2" max="6" step="0.05" value="1"></div>
    <div class="row" style="gap:6px"><label class="hint" style="flex:1">Dónde <select id="zfAt" style="width:100%"><option value="inicio">Al inicio</option><option value="todo">Todo el clip</option><option value="final">Al final</option></select></label>
      <label class="hint" style="flex:1">Curva <select id="zfCurve" style="width:100%"><option value="suave">Suave</option><option value="rapida">Rápida</option><option value="rebote">Rebote</option><option value="lineal">Constante</option></select></label></div>
    <div class="row" style="gap:6px;margin-top:6px"><button id="zfPt" style="flex:1"></button><button id="zfDel">✕ Quitar</button></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">`;
  pane.prepend(d);
  $('#zfGrid').onclick=e=>{const b=e.target.closest('button');if(b)zfSet(b.dataset.z)};
  const live=()=>{const c=selClip();$('#zfAmtV').textContent=(+$('#zfAmt').value).toFixed(2)+'x';$('#zfDurV').textContent=(+$('#zfDur').value).toFixed(2)+' s';
    if(c&&c.zfx){Object.assign(c.zfx,{amt:+$('#zfAmt').value,dur:+$('#zfDur').value,at:$('#zfAt').value,curve:$('#zfCurve').value});renderFrame()}};
  ['zfAmt','zfDur'].forEach(id=>{$('#'+id).oninput=live;$('#'+id).onchange=()=>selClip()&&selClip().zfx&&commit()});
  ['zfAt','zfCurve'].forEach(id=>$('#'+id).onchange=()=>{live();const c=selClip();if(c&&c.zfx){commit();zfSet(c.zfx.type)}});
  $('#zfPt').onclick=()=>{zfPick=!zfPick;zfUi();if(zfPick)toast('Toca en el visor el punto donde quieres el zoom.')};
  $('#zfDel').onclick=()=>{const c=selClip();if(c&&c.zfx){delete c.zfx;commit();renderAll()}zfUi()};
  zfUi();
}

/* ------------------------------------------------------------------
   UI: máscara (editar en el visor)
   ------------------------------------------------------------------ */
const MK={edit:false,drag:null};
function lt(c){return S.t-c.start}
function mkNew(type){
  const c=selClip();if(!c||c.type==='audio')return toast('Selecciona primero el clip al que le pondrás la máscara.');
  const P={line:[[.55,.05],[.55,.95]],rect:[[.25,.25],[.75,.75]],ellipse:[[.3,.25],[.7,.75]],poly:[]}[type];
  c.mask={type,feather:+$('#mkFeather').value,inv:$('#mkInv').checked,kfs:type==='poly'?[]:[{t:+lt(c).toFixed(4),pts:P}]};
  if(type==='poly')toast('Toca en el visor para poner los puntos de la forma (mínimo 3).',7000);
  MK.edit=true;commit();renderAll();mkUi();
}
function kfAt(c,make){
  const M=c.mask,t=lt(c),fps=S.fps||30;let k=M.kfs.find(k=>Math.abs(k.t-t)<.5/fps);
  if(!k&&make){const pts=(maskShape(c,S.t)||[]).map(q=>[q[0],q[1]]);k={t:+t.toFixed(4),pts};M.kfs.push(k);M.kfs.sort((a,b)=>a.t-b.t)}
  return k;
}
function mkUi(){
  const c=selClip(),M=c&&c.mask;
  $$('#mkShapes button').forEach(b=>b.classList.toggle('on',!!M&&b.dataset.s===M.type));
  $('#mkEdit').classList.toggle('on',MK.edit);$('#mkEdit').textContent=MK.edit?'✓ Listo (dejar de editar)':'✋ Editar en el visor';
  if(M){$('#mkFeather').value=M.feather||0;$('#mkInv').checked=!!M.inv}
  $('#mkFeatherV').textContent=Math.round(+$('#mkFeather').value*100)+'%';
  $('#mkInfo').innerHTML=!c?'Selecciona un clip.':!M?'Sin máscara.':`${M.kfs.length} marca(s) en el tiempo${c&&M&&kfAt(c,false)?' · <b>estás sobre una marca</b>':''}. Al mover la forma en otro fotograma se crea una marca nueva.`;
}
function toNorm(e){const r=cv.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,r]}
function handles(c,pts){
  const T=c.mask.type;if(!pts)return [];
  if(T==='line')return [{i:0,p:pts[0]},{i:1,p:pts[1]},{i:'mid',p:[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2]}];
  if(T==='rect'||T==='ellipse')return [{i:0,p:pts[0]},{i:1,p:pts[1]},{i:'mid',p:[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2]}];
  return pts.map((p,i)=>({i,p})).concat(pts.length>2?[{i:'mid',p:[pts.reduce((a,q)=>a+q[0],0)/pts.length,pts.reduce((a,q)=>a+q[1],0)/pts.length]}]:[]);
}
function mkDown(e){
  if(zfPick){const c=selClip();e.stopPropagation();e.preventDefault();if(c){const [x,y]=toNorm(e);c.zfx=c.zfx||{type:'in',amt:+$('#zfAmt').value,dur:+$('#zfDur').value,at:$('#zfAt').value,curve:$('#zfCurve').value};
    c.zfx.fx=clamp(x,0,1);c.zfx.fy=clamp(y,0,1);commit();renderAll()}zfPick=false;zfUi();return}
  if(!MK.edit||S.zr)return;const c=selClip();if(!c||!c.mask)return;
  e.stopPropagation();e.preventDefault();
  const [x,y,r]=toNorm(e),pts=maskShape(c,S.t),hs=handles(c,pts),rad=16/r.width;
  let h=hs.find(q=>Math.hypot((q.p[0]-x)*r.width,(q.p[1]-y)*r.height)<24);
  if(!h&&c.mask.type==='poly'){ // tocar = añadir punto
    const k=kfAt(c,true)||(c.mask.kfs.push({t:+lt(c).toFixed(4),pts:[]}),c.mask.kfs[c.mask.kfs.length-1]);
    if(c.mask.kfs.length>1&&k.pts.length>=3)return toast('Para cambiar la forma en este fotograma, arrastra sus puntos.');
    c.mask.kfs.forEach(K=>K.pts.push([x,y]));renderFrame();mkUi();return}
  if(!h)h={i:'mid'};
  const k=kfAt(c,true);const start=k.pts.map(q=>[q[0],q[1]]),x0=x,y0=y;
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  const mv=ev=>{const [xx,yy]=toNorm(ev),dx=xx-x0,dy=yy-y0;
    if(h.i==='mid')k.pts=start.map(q=>[q[0]+dx,q[1]+dy]);else k.pts[h.i]=[start[h.i][0]+dx,start[h.i][1]+dy];renderFrame()};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);commit();mkUi()};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);
}
function mkOverlay(g){
  const c=selClip();if(!c||!c.mask||!MK.edit||S.exporting||!active(c,S.t))return;
  const pts=maskShape(c,S.t);const W=S.w,H=S.h,u=Math.min(W,H)/1080;
  g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.filter='none';
  if(pts&&pts.length){g.strokeStyle='#ffd400';g.lineWidth=3*u;g.setLineDash([12*u,8*u]);
    if(c.mask.type==='line'){g.beginPath();const [a,b]=pts,dx=b[0]-a[0],dy=b[1]-a[1];g.moveTo((a[0]-dx*3)*W,(a[1]-dy*3)*H);g.lineTo((b[0]+dx*3)*W,(b[1]+dy*3)*H);g.stroke();
      // flecha: hacia qué lado queda el clip nuevo
      const mx=(a[0]+b[0])/2*W,my=(a[1]+b[1])/2*H,l=Math.hypot(dx*W,dy*H)||1,nx=-dy*H/l,ny=dx*W/l,s=c.mask.inv?-1:1;
      g.setLineDash([]);g.fillStyle='#ffd400';g.font=`700 ${22*u}px Inter`;g.textAlign='center';g.fillText('CLIP NUEVO',mx+nx*90*u*s,my+ny*90*u*s);
    }else{shapePath(g,c.mask.type,pts,W,H);g.stroke()}
    g.setLineDash([]);
    handles(c,pts).forEach(h=>{g.fillStyle=h.i==='mid'?'#2f9bff':'#fff';g.strokeStyle='#000';g.lineWidth=2*u;g.beginPath();g.arc(h.p[0]*W,h.p[1]*H,(h.i==='mid'?11:9)*u,0,Math.PI*2);g.fill();g.stroke()});
  }
  if(kfAt(c,false)){g.fillStyle='#ffd400';g.font=`700 ${20*u}px Inter`;g.textAlign='left';g.fillText('◆ marca',16*u,30*u)}
  g.restore();
}
function wireMask(){
  $('#mkShapes').onclick=e=>{const b=e.target.closest('button');if(b)mkNew(b.dataset.s)};
  $('#mkEdit').onclick=()=>{MK.edit=!MK.edit;mkUi();renderFrame()};
  $('#mkDel').onclick=()=>{const c=selClip();if(c&&c.mask){delete c.mask;commit();renderAll()}MK.edit=false;mkUi()};
  $('#mkFeather').oninput=()=>{const c=selClip();$('#mkFeatherV').textContent=Math.round(+$('#mkFeather').value*100)+'%';if(c&&c.mask){c.mask.feather=+$('#mkFeather').value;renderFrame()}};
  $('#mkFeather').onchange=()=>selClip()&&selClip().mask&&commit();
  $('#mkInv').onchange=()=>{const c=selClip();if(c&&c.mask){c.mask.inv=$('#mkInv').checked;commit();renderFrame()}};
  $('#mkAddK').onclick=()=>{const c=selClip();if(c&&c.mask){kfAt(c,true);commit();mkUi();renderFrame()}};
  $('#mkDelK').onclick=()=>{const c=selClip();if(!c||!c.mask)return;const k=kfAt(c,false);if(k&&c.mask.kfs.length>1){c.mask.kfs=c.mask.kfs.filter(x=>x!==k);commit();mkUi();renderFrame()}};
  const jump=dir=>{const c=selClip();if(!c||!c.mask)return;const t=lt(c),K=c.mask.kfs.map(k=>k.t);
    const n=dir>0?K.find(k=>k>t+1e-3):[...K].reverse().find(k=>k<t-1e-3);if(n!=null)seek(c.start+n)};
  $('#mkPrevK').onclick=()=>jump(-1);$('#mkNextK').onclick=()=>jump(1);
  $('#stage').addEventListener('pointerdown',mkDown,true);
  const o=PRO.overlay;PRO.overlay=g=>{o(g);mkOverlay(g)};
}

/* decoración en el timeline: transiciones, máscara y zoom suave */
PRO.clipDeco=(d,c)=>{
  const add=(T,right)=>{if(!T||!T.type)return;const w=Math.min(T.dur,c.dur)*S.pps,b=document.createElement('div');b.className='trband';
    b.style.cssText=`${right?'right':'left'}:${(T.off||0)*S.pps}px;width:${w}px`;b.title='Transición: '+((TR.find(x=>x.id===T.type)||{}).n||T.type);b.textContent=(TR.find(x=>x.id===T.type)||{}).i||'◐';d.appendChild(b)};
  trs(c).forEach(T=>{if(!T.mute)add(T,T.side==='out')});
  const tags=(c.mask?'◐':'')+(c.zfx?'🔍':'')+(c.ai?'🤖':'');
  if(tags){const s=document.createElement('span');s.className='cliptags';s.textContent=tags;d.appendChild(s)}
};

/* panel de la transición en la barra lateral derecha */
const NEEDOP=['black','white','flash','glitch'],NEEDAMT=['whip','zoomin','zoomout','blur','spin','glitch'];
function trPanel(c,root){
  if(!c||c.type==='audio')return;
  const T=trCur();if(!T||!T.type)return;
  const rSide=T.side||'in',def=TR.find(x=>x.id===T.type)||{n:T.type};
  const d=Math.min(T.dur||.6,c.dur),off=T.off||0;
  const box=document.createElement('div');box.className='trpanel';
  box.innerHTML=`<h4>🎬 ${def.n} · ${rSide==='in'?'entrada':'salida'}</h4>
   <div class="row" style="gap:4px;margin-bottom:6px"><button data-side="in" class="${rSide==='in'?'on':''}" style="flex:1">Al entrar</button><button data-side="out" class="${rSide==='out'?'on':''}" style="flex:1">Al salir</button></div>
   <div class="fld"><label>Tipo</label><select data-k="type" style="width:100%">${TR.filter(x=>x.id!=='hidden').map(x=>`<option value="${x.id}" ${x.id===T.type?'selected':''}>${x.n}</option>`).join('')}</select></div>
   <div class="fld"><label>${rSide==='in'?'Empieza a los':'Termina antes del final'} <span class="pill" data-v="off">${off.toFixed(2)} s</span></label><input type="range" data-k="off" min="0" max="${Math.max(0,c.dur-d).toFixed(3)}" step="0.01" value="${off}"></div>
   <div class="fld"><label>Duración <span class="pill" data-v="dur">${d.toFixed(2)} s</span></label><input type="range" data-k="dur" min="0.1" max="${Math.min(4,c.dur).toFixed(2)}" step="0.01" value="${d}"></div>
   <div class="row" style="gap:4px;margin-bottom:8px"><button data-at="start" style="flex:1" title="La transición empieza donde está la línea de tiempo">◆ Inicio aquí</button><button data-at="end" style="flex:1" title="La transición termina donde está la línea de tiempo">◆ Final aquí</button></div>
   ${NEEDAMT.includes(T.type)?`<div class="fld"><label>Intensidad <span class="pill" data-v="amt">${Math.round((T.amt??1)*100)}%</span></label><input type="range" data-k="amt" min="0.2" max="2" step="0.05" value="${T.amt??1}"></div>`:''}
   ${NEEDOP.includes(T.type)?`<div class="fld"><label>Opacidad del ${T.type==='black'?'negro':T.type==='glitch'?'color':'blanco'} <span class="pill" data-v="op">${Math.round((T.op??1)*100)}%</span></label><input type="range" data-k="op" min="0" max="1" step="0.01" value="${T.op??1}"></div>`:''}
   ${def.soft?`<div class="fld"><label>Borde suave <span class="pill" data-v="soft">${Math.round((T.soft??.15)*100)}%</span></label><input type="range" data-k="soft" min="0" max="0.6" step="0.01" value="${T.soft??.15}"></div>`:''}
   ${def.dir?`<div class="row" style="gap:4px;margin-bottom:8px">${['l','r','u','d'].map(k=>`<button data-dir="${k}" class="${(T.dir||'r')===k?'on':''}" style="flex:1">${{l:'←',r:'→',u:'↑',d:'↓'}[k]}</button>`).join('')}</div>`:''}
   <div class="row" style="gap:4px"><button data-act="prev" style="flex:1">👁 Ver</button><button data-act="del" style="flex:1">✕ Quitar</button></div>`;
  const fmtV={off:v=>v.toFixed(2)+' s',dur:v=>v.toFixed(2)+' s',amt:v=>Math.round(v*100)+'%',op:v=>Math.round(v*100)+'%',soft:v=>Math.round(v*100)+'%'};
  box.querySelectorAll('input[data-k]').forEach(inp=>{
    inp.oninput=()=>{const k=inp.dataset.k,v=+inp.value;T[k]=v;
      if(k==='dur'){const o=box.querySelector('[data-k=off]');o.max=Math.max(0,c.dur-v).toFixed(3);if((T.off||0)>c.dur-v){T.off=Math.max(0,c.dur-v);o.value=T.off}}
      const pill=box.querySelector(`[data-v=${k}]`);if(pill)pill.textContent=fmtV[k](v);
      const tt=rSide==='in'?c.start+(T.off||0)+T.dur*.5:c.start+c.dur-(T.off||0)-T.dur*.5;
      if(!S.playing&&(k==='dur'||k==='off'))seek(tt);else renderFrame();renderTimeline()};
    inp.onchange=()=>{commit();trUi()};
  });
  box.querySelector('[data-k=type]').onchange=e=>{T.type=e.target.value;commit();renderAll();trUi()};
  box.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{T.side=b.dataset.side;commit();renderAll()});
  box.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>{T.dir=b.dataset.dir;commit();renderAll()});
  box.querySelectorAll('[data-at]').forEach(b=>b.onclick=()=>{
    const lt=clamp(S.t-c.start,0,c.dur),dd=Math.min(T.dur||.6,c.dur);
    if(rSide==='in'){
      if(b.dataset.at==='start')T.off=clamp(lt,0,c.dur-dd);
      else{if(lt<=(T.off||0)+.05)T.off=Math.max(0,lt-dd);T.dur=clamp(lt-(T.off||0),.1,c.dur)}
    }else{ // salida: medido desde el final del clip
      const fromEnd=c.dur-lt;
      if(b.dataset.at==='end')T.off=clamp(fromEnd,0,c.dur-dd);
      else{if(fromEnd<=(T.off||0)+.05)T.off=Math.max(0,fromEnd-dd);T.dur=clamp(fromEnd-(T.off||0),.1,c.dur)}
    }
    commit();renderAll();trUi();
  });
  box.querySelector('[data-act=prev]').onclick=()=>trPreview(T);
  box.querySelector('[data-act=del]').onclick=()=>{c.trs=trs(c).filter(x=>x!==T);selTr=null;commit();renderAll();trUi()};
  root.appendChild(box);
}
/* quitar / copiar todos los efectos de un clip de una vez */
const FXDEF={bright:1,contrast:1,sat:1,hue:0,blur:0,fadeIn:0,fadeOut:0};
const FXDEL=['grade','tr','trOut','trs','mask','zfx','ai','zoomBezier'];
function hasFx(c){return FXDEL.some(k=>c[k]!=null&&!(k==='trs'&&!c[k].length))||Object.keys(FXDEF).some(k=>c[k]!=null&&c[k]!==FXDEF[k])||(c.zoomKfs&&c.zoomKfs.length>0)}
function clearFx(c){FXDEL.forEach(k=>delete c[k]);Object.assign(c,FXDEF);c.zoomKfs=[];delete c.filtMute}
const cpv=v=>v==null?v:JSON.parse(JSON.stringify(v));
function copyFx(src,c){
  clearFx(c);
  trs(src);['grade','zfx'].forEach(k=>{if(src[k]!=null)c[k]=cpv(src[k])});if(src.trs&&src.trs.length)c.trs=cpv(src.trs).map(T=>({...T,id:tid()}));
  ['bright','contrast','sat','hue','blur'].forEach(k=>c[k]=src[k]??FXDEF[k]);
  c.fadeIn=Math.min(src.fadeIn||0,c.dur);c.fadeOut=Math.min(src.fadeOut||0,c.dur);
  if(src.zoomKfs&&src.zoomKfs.length){c.zoomKfs=cpv(src.zoomKfs);c.zoomBezier=cpv(src.zoomBezier)}
}
const visual=c=>c.type!=='audio';
function fxClear(){
  const list=(MS.size>1?[...MS].map(id=>S.clips.find(x=>x.id===id)).filter(Boolean):[selClip()]).filter(c=>c&&visual(c));
  if(!list.length)return toast('Selecciona primero el clip.');
  list.forEach(clearFx);MK.edit=false;commit();renderAll();trUi();zfUi();mkUi();
  toast(list.length>1?`Quité todos los efectos de ${list.length} clips (Ctrl+Z para deshacer).`:'Quité todos los efectos del clip (Ctrl+Z para deshacer).');
}
function fxAddAll(){
  const src=selClip();if(!src||!visual(src))return toast('Selecciona primero el clip que tiene los efectos.');
  const list=S.clips.filter(c=>visual(c)&&c!==src&&c.type!=='text');
  list.forEach(c=>copyFx(src,c));commit();renderAll();
  toast(`Copié los efectos a ${list.length} clips: color, filtros, zoom suave, keyframes de zoom, fundidos y transiciones. Las máscaras no se copian (son de cada clip). Ctrl+Z para deshacer.`,9000);
}
function fxClearAll(){
  const list=S.clips.filter(c=>visual(c)&&hasFx(c));
  if(!list.length)return toast('Ningún clip tiene efectos.');
  list.forEach(clearFx);MK.edit=false;commit();renderAll();trUi();zfUi();mkUi();
  toast(`Quité los efectos de ${list.length} clips (Ctrl+Z para deshacer).`);
}
function fxBar(c,root){
  if(!c||!visual(c))return;
  const b=document.createElement('div');b.className='fxbar';
  b.innerHTML=`<button data-f="clear" title="Quita color, filtros, transiciones, máscara, zoom suave, keyframes de zoom y fundidos de ${MS.size>1?'los clips seleccionados':'este clip'}">✕ Quitar efectos${MS.size>1?` (${MS.size})`:''}</button>
    <button data-f="add" title="Copia los efectos de este clip a todos los clips del video">⇉ Añadir a todos</button>
    <button data-f="clearAll" title="Quita los efectos de todos los clips del video">✕ Quitar a todos</button>`;
  b.querySelector('[data-f=clear]').onclick=fxClear;b.querySelector('[data-f=add]').onclick=fxAddAll;b.querySelector('[data-f=clearAll]').onclick=fxClearAll;
  root.appendChild(b);
}
/* panel «Capas de efectos»: todo lo que tiene el clip, como capas */
const ZFN={in:'Acercar',out:'Alejar',inout:'Acercar y volver',punch:'Golpe',pulse:'Pulso',shake:'Temblor'};
const MKN={line:'Línea / corte oculto',rect:'Rectángulo',ellipse:'Óvalo',poly:'Forma libre'};
function layerRows(c){
  const rows=[];
  trs(c).forEach((T,i,L)=>{const d=TR.find(x=>x.id===T.type)||{n:T.type,i:'◐'};
    rows.push({k:'tr',T,icon:d.i,name:d.n,sub:`${T.side==='out'?'salida':'entrada'} · ${(+T.dur||.6).toFixed(2)} s${T.off?` · desde ${(+T.off).toFixed(2)} s`:''}`,
      on:!T.mute,sel:T.id===selTr,
      toggle:()=>{T.mute=!T.mute},del:()=>{c.trs=trs(c).filter(x=>x!==T);if(selTr===T.id)selTr=null},
      up:i>0?()=>{L.splice(i-1,0,L.splice(i,1)[0])}:null,down:i<L.length-1?()=>{L.splice(i+1,0,L.splice(i,1)[0])}:null,
      pick:()=>{selTr=T.id;side=T.side||'in'}})});
  if(c.mask)rows.push({k:'mask',icon:'◐',name:'Máscara',sub:`${MKN[c.mask.type]||c.mask.type} · ${c.mask.kfs.length} marca(s)`,on:!c.mask.mute,
    toggle:()=>{c.mask.mute=!c.mask.mute},del:()=>{delete c.mask;MK.edit=false},pick:()=>{const b=document.querySelector('.tabs [data-tab=mask]');if(b)b.click()}});
  if(c.ai)rows.push({k:'ai',icon:'🤖',name:'Máscara con IA',sub:c.ai.fg===false?'borra el objeto':'muestra solo el objeto',on:!c.ai.off,
    toggle:()=>{c.ai.off=!c.ai.off},del:()=>{delete c.ai},pick:()=>{const b=document.querySelector('.tabs [data-tab=mask]');if(b)b.click()}});
  if(c.zfx)rows.push({k:'zfx',icon:'🔍',name:'Zoom suave',sub:`${ZFN[c.zfx.type]||c.zfx.type} · ${Math.round((c.zfx.amt||1)*100)}%`,on:!c.zfx.mute,
    toggle:()=>{c.zfx.mute=!c.zfx.mute},del:()=>{delete c.zfx},pick:()=>{const b=document.querySelector('.tabs [data-tab=zoom]');if(b)b.click()}});
  if(c.grade)rows.push({k:'grade',icon:'🎨',name:'Color / look',sub:'filtro de color',on:!c.grade.mute,
    toggle:()=>{c.grade.mute=!c.grade.mute},del:()=>{delete c.grade},pick:()=>{const b=document.querySelector('.tabs [data-tab=look]');if(b)b.click()}});
  const fl=['bright','contrast','sat','hue','blur'].filter(k=>c[k]!=null&&c[k]!==FXDEF[k]);
  if(fl.length)rows.push({k:'filt',icon:'✨',name:'Ajustes',sub:fl.map(k=>({bright:'brillo',contrast:'contraste',sat:'saturación',hue:'tono',blur:'desenfoque'})[k]).join(', '),on:!c.filtMute,
    toggle:()=>{c.filtMute=!c.filtMute},del:()=>{fl.forEach(k=>c[k]=FXDEF[k]);delete c.filtMute}});
  if(c.fadeIn>0)rows.push({k:'fi',icon:'◑',name:'Fundido de entrada',sub:`${(+c.fadeIn).toFixed(2)} s`,on:true,del:()=>{c.fadeIn=0}});
  if(c.fadeOut>0)rows.push({k:'fo',icon:'◑',name:'Fundido de salida',sub:`${(+c.fadeOut).toFixed(2)} s`,on:true,del:()=>{c.fadeOut=0}});
  if(c.zoomKfs&&c.zoomKfs.length)rows.push({k:'kf',icon:'◆',name:'Keyframes de zoom',sub:`${c.zoomKfs.length} keyframe(s)`,on:true,del:()=>{c.zoomKfs=[]}});
  return rows;
}
function fxLayers(c,root){
  if(!c||!visual(c)||MS.size>1)return;
  const rows=layerRows(c);
  const box=document.createElement('div');box.className='layers';
  box.innerHTML=`<h4>🧱 Capas de efectos <span class="pill">${rows.length}</span></h4>`+(rows.length?'':'<div class="hint">Este clip no tiene efectos. Agrega transiciones, máscara, zoom suave o color desde las pestañas de la izquierda.</div>');
  rows.forEach((r,i)=>{
    const el=document.createElement('div');el.className='layer'+(r.on?'':' off')+(r.sel?' sel':'');
    el.innerHTML=`<span class="li">${r.icon}</span><span class="ln"><b>${r.name}</b><small>${r.sub}</small></span>
      ${r.toggle?`<button data-a="t" title="${r.on?'Ocultar (sin borrar)':'Mostrar'}">${r.on?'👁':'🚫'}</button>`:''}
      ${r.up?'<button data-a="u" title="Subir capa">↑</button>':''}${r.down?'<button data-a="d" title="Bajar capa">↓</button>':''}
      <button data-a="x" title="Quitar esta capa">✕</button>`;
    el.onclick=e=>{const a=e.target.closest('button');const act=a&&a.dataset.a;
      if(act==='t')r.toggle();else if(act==='u')r.up();else if(act==='d')r.down();else if(act==='x')r.del();else if(r.pick){r.pick();renderInspector();trUi();return}else return;
      commit();renderAll();trUi();zfUi();mkUi()};
    box.appendChild(el);
  });
  if(rows.some(r=>r.k==='tr'))box.insertAdjacentHTML('beforeend','<div class="hint" style="margin-top:4px">Las transiciones se aplican de arriba hacia abajo y se pueden mezclar (por ejemplo, Fundido + Fundido a blanco). Toca una para editarla abajo.</div>');
  root.appendChild(box);
}
PRO.fx={clearFx,copyFx,hasFx,fxClear,fxAddAll,fxClearAll};
PRO.initFx3=()=>{
  {const r0=PRO.onSel;PRO.onSel=(c,root)=>{try{r0&&r0(c,root)}finally{try{fxBar(c,root);fxLayers(c,root);trPanel(c,root)}catch(e){console.error(e)}}}}
  wireTr();wireZf();wireMask();
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>{trUi();zfUi();mkUi()}));
  const r=PRO.onSel;PRO.onSel=(c,root)=>{try{r&&r(c,root)}finally{trUi();zfUi();mkUi()}};
  trUi();mkUi();
};
PRO._t4={TR,trState,trStates,trs,maskShape,MK,compose,autoOverlap};
})();
