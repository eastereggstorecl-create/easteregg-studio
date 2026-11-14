// Ensambla PRO.html = LEGACY.html + parches + src/pro.css + src/look.html + src/pro.js
// Uso:  node src/build.mjs   (desde la carpeta editor-pro)
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'..');
let h=readFileSync(join(root,'LEGACY.html'),'utf8').replace(/\r\n/g,'\n');
const css=readFileSync(join(here,'pro.css'),'utf8')+'\n'+readFileSync(join(here,'mobile.css'),'utf8');
const look=readFileSync(join(here,'look.html'),'utf8');
const js=readFileSync(join(here,'pro.js'),'utf8')+'\n'+readFileSync(join(here,'pro2.js'),'utf8')+'\n'+readFileSync(join(here,'pro3.js'),'utf8')+'\n'+readFileSync(join(here,'pro4.js'),'utf8')+'\n'+readFileSync(join(here,'ai.js'),'utf8')+'\n'+readFileSync(join(here,'proxy.js'),'utf8')+'\n'+readFileSync(join(here,'mobile.js'),'utf8');
const tabs2=readFileSync(join(here,'tabs2.html'),'utf8')+readFileSync(join(here,'tabs3.html'),'utf8');
const subs=readFileSync(join(here,'subs.html'),'utf8');
let n=0;
function rep(a,b,count=1){
  const parts=h.split(a);
  if(parts.length-1!==count)throw new Error(`Parche ${n+1}: esperaba ${count} coincidencia(s), hay ${parts.length-1} →\n${a.slice(0,120)}`);
  h=parts.join(b);n++;
}
function between(a,b,repl){
  const i=h.indexOf(a),j=h.indexOf(b,i);
  if(i<0||j<0||h.indexOf(a,i+1)>=0)throw new Error('Bloque no encontrado o ambiguo: '+a.slice(0,80));
  h=h.slice(0,i)+repl+h.slice(j+b.length);n++;
}

/* ---------- cabecera y estructura ---------- */
rep('<title>EasterEgg Studio Pro — CapCut & Premiere Web Editor</title>','<title>EasterEgg Studio PRO</title>');
rep('</style>\n</head>','</style>\n<link rel="manifest" href="manifest.json"><link rel="icon" href="icons/icon-192.png"><link rel="apple-touch-icon" href="icons/icon-192.png">\n<script>if(\'serviceWorker\' in navigator&&(location.protocol===\'https:\'||location.hostname===\'localhost\'))addEventListener(\'load\',()=>navigator.serviceWorker.register(\'sw.js\').catch(()=>{}))</script>\n<style id="pro-css">\n'+css+'</style>\n<script id="sam2-runtime">\n/* SAM 2.1 web runtime · sam2-from-scratch (github.com/smurley6/sam2-from-scratch) · Apache License 2.0 */\n'+readFileSync(join(here,'sam2.bundle.js'),'utf8')+'</script>\n</head>');
rep('<div class="brand"><span class="egg"></span>EASTEREGG <span class="pro">CAPCUT·PRO</span></div>',
    '<a id="bHome" href="EDITOR.html" title="Volver al inicio (LEGACY / PRO)">⌂</a>\n    <div class="brand"><span class="egg"></span>EASTEREGG <span class="pro">PRO</span></div>\n    <div class="wsbar"><button id="wsEdit" class="on" title="Espacio de trabajo para cortar y montar">Edición</button><button id="wsColor" title="Espacio de trabajo para el color y los filtros">Color</button></div>');
rep('<input id="pname" type="text" value="Ad nuevo"','<input id="pname" type="text" value="Proyecto nuevo"');
rep(`      <option value="0">Estándar</option>
      <option value="0.35" selected>✨ AI UpscaleNitidez (CAS)</option>
      <option value="0.7">🔥 Ultra Upscale 4K Pro</option>`,
`      <option value="0">Sin mejora</option>
      <option value="0.35" selected>✨ Nitidez suave</option>
      <option value="0.7">🔥 Nitidez fuerte</option>
      <option value="ultimate">👑 ULTIMATE UPSCALER</option>`);
rep('<button data-tab="media" class="on">Media</button>','<button data-tab="short">📱 Short</button>\n      <button data-tab="media" class="on">Media</button>\n      <button data-tab="look">🎨 Look</button>\n      <button data-tab="audio">🎙 Voz</button>');
rep('<button data-tab="speed">⚡ Velocidad/Curvas</button>','<button data-tab="speed">Velocidad</button>');
rep('<button data-tab="zoom">🔍 Zoom/Keyframes</button>','<button data-tab="zoom">Zoom</button>');
rep('<button data-tab="fx">Efectos</button>','<button data-tab="fx">FX</button>\n      <button data-tab="trans">🎬 Transición</button>\n      <button data-tab="mask">◐ Máscara</button>');
/* ---------- capas: transiciones, máscaras, zoom suave ---------- */
rep("function drawClip(c){\n  const g=cx,","function drawClip(c){\n  const g=PRO._ctx||cx,");
rep("    list.forEach(drawClip);","    list.forEach(c=>PRO.drawLayer(c,drawClip));");
rep("  d.onpointerdown=e=>clipDown(e,c,e.target===hl?'l':e.target===hr?'r':'m');","  d.onpointerdown=e=>clipDown(e,c,e.target===hl?'l':e.target===hr?'r':'m');PRO.clipDeco(d,c);");
rep(`        <button id="bFolder" style="flex:1">📁 Abrir carpeta</button>
      </div>`,
`        <button id="bFolder" style="flex:1">📁 Abrir carpeta</button>
      </div>
      <div class="row"><button id="bBinAdd" style="flex:1" title="Pone en el timeline, uno tras otro, los archivos que tengas marcados">⤵ Poner los marcados en el timeline</button></div>
      <div class="hint" style="margin-bottom:8px">Marca varios con <b>Ctrl+clic</b> o <b>Shift+clic</b> y arrástralos juntos al timeline.</div>`);
rep('    <!-- TAB VELOCIDAD / SPEED RAMP & BULLET TIME -->',look+tabs2+'    <!-- TAB VELOCIDAD / SPEED RAMP & BULLET TIME -->');
rep('<div id="stage"><canvas id="cv" width="2560" height="1440"></canvas></div>',
    '<div id="stage"><canvas id="cv" width="2560" height="1440"></canvas><div id="stageEmpty"><div><b>Empieza aquí</b>Arrastra tus videos a la ventana<br>o pulsa «+ Importar archivos» a la izquierda</div></div></div>');
rep('<section id="tl">\n    <div id="tlbar">','<section id="tl">\n    <div id="tlSplit" title="Arrastra para agrandar o achicar el timeline"></div>\n    <div id="tlbar">');
rep('<input type="file" id="projIn"','<input type="file" id="refIn" multiple accept="image/*" hidden>\n<input type="file" id="projIn"');

rep('⚡ Cargar Edición Cyberpunk</button>','Mi edición Cyberpunk</button>');
/* ---------- modal de exportación ---------- */
rep(`        <option value="nativecopy" selected>⚡ TODO IGUAL · Copia Directa Nativa (Sin recodificar · Instantáneo 0.5s · 0% frames comidos · Solo guarda tus cortes)</option>
        <option value="webcodecs">💎 Renderizador Pro con FX/Zoom/Upscaler (WebCodecs VideoDecoder + 60.00 fps CFR Exactos)</option>
        <option value="realtime">🎬 Grabación en Vivo Segmentada (MediaRecorder Fallback)</option>`,
`        <option value="webcodecs" selected>💎 Exacto, fotograma a fotograma (recomendado · incluye filtros, texto, zoom y upscaler)</option>
        <option value="nativecopy">⚡ Copia rápida sin recodificar (solo cortes · sin filtros ni texto · el corte cae en el keyframe más cercano)</option>
        <option value="realtime">🎬 Grabación en vivo (solo si los otros fallan)</option>`);
rep(`        <option value="0.45" selected>✨ Activar AI Contrast-Adaptive Sharpening (CAS) + Lanczos</option>
        <option value="0.75">🔥 Nitidez Ultra (Para escalar 1080p → 1440p / 4K)</option>
        <option value="0">Sin filtro extra (Solo escalado nativo High-Quality)</option>`,
`        <option value="ultimate">👑 ULTIMATE UPSCALER (reescalado por bordes + nitidez · el mejor para subir a 2K/4K)</option>
        <option value="0.45" selected>✨ Nitidez suave</option>
        <option value="0.75">🔥 Nitidez fuerte</option>
        <option value="0">Sin mejora</option>`);


/* ---------- PRO 2 ---------- */
rep("'use strict';","'use strict';\nconst SHORTS=new URLSearchParams(location.search).get('mode')==='shorts';\nconst PROJ_KEY=SHORTS?'ee-shorts-proj':'ee-pro-proj';\nconst MOB=/[?&]movil=1/.test(location.search)||(!/[?&]pc=1/.test(location.search)&&matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<820);\ndocument.documentElement.classList.toggle('mob',MOB);");
rep("try{const src=AC.createMediaElementSource(v);const g=AC.createGain();src.connect(g);","try{const src=AC.createMediaElementSource(v);const g=AC.createGain();PRO.elChain(v,src).connect(g);");
rep("if(el._g)el._g.gain.value=g;else el.volume=clamp(g,0,1);","if(el._g)el._g.gain.value=g;else el.volume=clamp(g,0,1);\n    PRO.elFx(el,c);");
rep("src.connect(g);g.connect(oac.destination);","PRO.afx(oac,c,src).connect(g);g.connect(oac.destination);");
rep("function evalClipTransform(c,t){\n","function evalClipTransform(c,t){\n  {const _cam=PRO.camT(c,t);if(_cam)return _cam}\n");
rep("function evalClipTransform(c,t){\n  {const _cam=","function evalClipTransform(c,t){return PRO.zfx(c,t,evalClipTransform0(c,t))}\nfunction evalClipTransform0(c,t){\n  {const _cam=");
rep("  if(c.type==='text'){\n    const tx=c.tx;let text=tx.text","  if(c.type==='text'&&c.tx&&c.tx.sub){PRO.drawSub(g,c,cxp,cyp,tf,u)}\n  else if(c.type==='text'){\n    const tx=c.tx;let text=tx.text");
rep("function renderFrame(customSharp=null){\n","function renderFrame(customSharp=null){\n  if(PRO.split(customSharp))return;\n");
rep("if(hasVisual&&sharp>0.01){","if(hasVisual&&sharp>0.01&&!S.bypass){");
rep("  }\n}\n\n/* ---------- reproducción ---------- */","  }\n  if(!S.exporting)PRO.overlay(g);\n}\n\n/* ---------- reproducción ---------- */");
rep("const hasZoom=(c.zoomKfs&&c.zoomKfs.length)||","const hasZoom=(c.cam&&c.cam.raw&&c.cam.raw.length)||(c.zoomKfs&&c.zoomKfs.length)||");
rep(`<button id="bStageAddKf" title="Añadir Keyframe de Zoom/Posición en el fotograma actual">◆ +Keyframe Zoom</button>
      </div>`,`<button id="bStageAddKf" title="Añadir Keyframe de Zoom/Posición en el fotograma actual">◆ +Keyframe Zoom</button>
        <button id="bStageZoomRec" title="Abre el Editor de Zoom: graba tu zoom y el puntero mientras se reproduce">🎬 Editor de Zoom</button>
      </div>
      <div class="row" style="margin:0">
        <button id="bBefore" title="Mantén pulsado (o la tecla B) para ver el video sin ningún efecto">👁 Antes</button>
        <button id="bCmp" title="Pantalla dividida: original a la izquierda, con efectos a la derecha">◧ Comparar</button>
        <input type="range" id="cmpX" min="0.05" max="0.95" step="0.01" value="0.5" style="display:none" title="Mueve la línea de comparación">
        <button id="bShot" title="Captura el fotograma actual en PNG a resolución completa (tecla P)">📸 Captura</button>
        <button id="bSafe" title="Muestra dónde tapan los botones de TikTok/Reels/Shorts (formato vertical)">▣ Zonas</button>
      </div>`);
rep('      <div id="bin"></div>\n    </div>','      <div id="bin"></div>\n      <h4 id="shotHead" style="display:none"><span>📸 Capturas</span><span class="row" style="margin:0;gap:4px"><label class="hint chk" style="margin:0"><input type="checkbox" id="shotRaw"> sin efectos</label><button id="bShotAll" class="mini" title="Descargar todas otra vez">⬇ todas</button></span></h4>\n      <div id="shotGrid"></div>\n    </div>');
rep('      <div class="hint">El texto se añade en la posición del cursor rojo y se edita en el panel derecho.</div>',subs+'      <div class="hint">El texto se añade en la posición del cursor rojo y se edita en el panel derecho.</div>');
rep('      <h4>Keyframes de Zoom y Posición (Premiere Pro)</h4>','      <h4>🎬 Grabar zoom en vivo</h4>\n      <button id="bZoomRec" class="big2 pri"><b>Abrir Editor de Zoom</b><small>Reproduce el clip y graba tu zoom y el puntero huevito en tiempo real.</small></button>\n      <h4>Keyframes de Zoom y Posición (Premiere Pro)</h4>');
rep('<button id="bSep" title="Separar el audio del video">🎵 Separar audio</button>','<button id="bSep" title="Separar el audio del video">🎵 Separar audio</button>\n      <button id="bApplyAll" title="Copia los efectos del clip seleccionado a todo el video">⇉ Efectos a todo</button>');


/* ---------- al mover la línea: nunca negro, se queda el último fotograma ---------- */
rep("      else if(el&&el.readyState>=2&&el.videoWidth){src=el;sw=el.videoWidth;sh=el.videoHeight}\n      else if(m&&m.offline){",
    "      else if(el&&el.readyState>=2&&el.videoWidth){src=el;sw=el.videoWidth;sh=el.videoHeight;if(!S.exporting)PRO.holdSave(el)}\n      else if(el&&el._hold&&!S.exporting){src=el._hold;sw=el._holdW;sh=el._holdH}\n      else if(m&&m.offline){");
rep("function drawSpeedGraph(){\n","function drawSpeedGraph(){\n  if(PRO.drawSpeed)return PRO.drawSpeed();\n");
/* ---------- sesiones grabadas ---------- */
rep("function clipSourceTimeAt(c,lt){\n  lt=clamp(lt,0,c.dur);","function clipSourceTimeAt(c,lt){\n  if(c.sess)return PRO.sessSrc(c,lt);\n  lt=clamp(lt,0,c.dur);");
rep("function clipInstantSpeedAt(c,lt){\n","function clipInstantSpeedAt(c,lt){\n  if(c.sess)return clamp(PRO.sessRate(c,lt),0.0625,8);\n");
rep("    if(S.playing){\n      if(el.paused){","    if(S.playing&&!(c.sess&&PRO.sessRate(c,lt)<0.05)){\n      if(el.paused){");
rep("src.start(c.start,c.in||0,c.dur*src.playbackRate.value);","if(c.sess)PRO.sessAudio(oac,c,m._abuf,g);else src.start(c.start,c.in||0,c.dur*src.playbackRate.value);");
rep("    c.env=cutEnv(e0,lt);c.dur=lt;c.fadeOut=0;S.clips.push(b);","    if(c.sess)b.in=(c.in||0)+lt;\n    c.env=cutEnv(e0,lt);c.dur=lt;c.fadeOut=0;S.clips.push(b);");
rep("const maxSrc=(c.type==='video'||c.type==='audio')&&m&&m.dur?m.dur:Infinity;","const maxSrc=(c.type==='video'||c.type==='audio')&&m&&m.dur&&!c.sess?m.dur:Infinity;");

/* ---------- estado, guardado ---------- */
rep("name:'Ad nuevo',aspect:'16:9',res:1440,fps:60,upscale:0.35,","name:'Proyecto nuevo',aspect:'16:9',res:1440,fps:60,upscale:0.35,upMode:'cas',");
rep('fps:S.fps,upscale:S.upscale,bpm:S.bpm','fps:S.fps,upscale:S.upscale,upMode:S.upMode,bpm:S.bpm',2);
rep('S.upscale=o.upscale??0.35;S.bpm=o.bpm;',"S.upscale=o.upscale??0.35;S.upMode=o.upMode||'cas';S.bpm=o.bpm;");
rep('S.upscale=o.upscale??0.35;S.bpm=o.bpm||0;',"S.upscale=o.upscale??0.35;S.upMode=o.upMode||'cas';S.bpm=o.bpm||0;");
rep("'ee-editor-proj'","PROJ_KEY",2);
rep("const upTxt=S.upscale>0?","const upTxt=S.upMode==='ultimate'?'ULTIMATE UPSCALER':S.upscale>0?");
rep("$('#upscaleMode').value=String(S.upscale??0.35);","$('#upscaleMode').value=S.upMode==='ultimate'?'ultimate':String(S.upscale??0.35);");
rep("$('#upscaleMode').onchange=e=>{S.upscale=+e.target.value;","$('#upscaleMode').onchange=e=>{if(e.target.value==='ultimate'){S.upMode='ultimate';S.upscale=0.3}else{S.upMode='cas';S.upscale=+e.target.value}");

/* ---------- dibujo: color + upscaler por clip ---------- */
rep(`      g.filter=fl.length?fl.join(' '):'none';
      g.drawImage(src,-sw*k/2,-sh*k/2,sw*k,sh*k);`,
`      g.filter=fl.length&&!S.bypass?fl.join(' '):'none';
      {const pr=PRO.process(c,src,sw,sh,k);if(pr)src=pr}
      {const am=PRO.aiSrc(c,src,sw,sh);if(am)src=am}
      g.drawImage(src,-sw*k/2,-sh*k/2,sw*k,sh*k);
      g.filter='none';PRO.ptr(g,c,sw*k,sh*k,u);`);

/* ---------- selección múltiple ---------- */
rep("function renderTimeline(){\n","function renderTimeline(){\n  msSync();\n");
rep("d.className='clip '+cl+(c.id===S.sel?' sel':'');","d.className='clip '+cl+((c.id===S.sel||MS.has(c.id))?' sel':'');");
rep(`  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  S.sel=c.id;const x0=e.clientX,y0=e.clientY;`,
`  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  if(PRO.touchGate(e,c))return;
  if(PRO.clipPick(e,c,mode))return;
  S.sel=c.id;const x0=e.clientX,y0=e.clientY;`);
rep("function del(ripple){\n  const c=selClip();if(!c)return;","function del(ripple){\n  if(MS.size>1){PRO.delMulti();return}\n  const c=selClip();if(!c)return;");
rep("function dup(){\n  const c=selClip();if(!c)return;","function dup(){\n  if(MS.size>1){PRO.dupMulti();return}\n  const c=selClip();if(!c)return;");
rep("function slowDownSelected(factor){\n  const c=selClip();","function slowDownSelected(factor,_c){\n  if(!_c&&MS.size>1){PRO.each(x=>slowDownSelected(factor,x));return}\n  const c=_c||selClip();");
rep("const root=$('#insp');root.innerHTML='';const c=selClip();","const root=$('#insp');root.innerHTML='';const c=selClip();PRO.onSel(c,root);");

/* ---------- media: varios archivos ---------- */
rep("addMediaClip(mid,t.id,x/S.pps)};","PRO.dropMedia(mid,t.id,x/S.pps)};");
rep("d.ondragstart=e=>{e.dataTransfer.setData('text/x-media',m.id);","d.ondragstart=e=>{e.dataTransfer.setData('text/x-media',PRO.dragIds(m.id));");
rep("    b.appendChild(d);\n  }\n}\n\n/* ---------- clips ---------- */","    PRO.binItem(d,m);\n    b.appendChild(d);\n  }\n}\n\n/* ---------- clips ---------- */");

/* ---------- exportación ---------- */
rep("const exportSharp=+$('#exUpscale').value;","const _exU=$('#exUpscale').value,exportSharp=_exU==='ultimate'?0.3:+_exU,oldMode=S.upMode;S.upMode=_exU==='ultimate'?'ultimate':'cas';PRO.encErr=null;");
rep("S.upscale=oldUp;","S.upscale=oldUp;S.upMode=oldMode;",3);
rep("const vEnc=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>console.error(e)});",
    "const vEnc=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{console.error(e);PRO.encErr=e}});");
between("    let cachedClipId=null,cachedFrames=null;","      activeVids.forEach(c=>{c._overrideCanvas=null});",
`    const FS=PRO.frameSources();
    for(let f=0;f<totalFrames;f++){
      if(exCancel||PRO.encErr)break;
      const t=PRO.bridgeGap(f/fps,fps);
      S.t=t;
      const activeVids=S.clips.filter(c=>c.type==='video'&&active(c,t));
      for(const c of activeVids){
        const target=clipSourceTimeAt(c,clamp(t-c.start,0,c.dur));
        const fr=await FS.get(c,target);
        if(fr){c._overrideCanvas=fr}
        else{c._overrideCanvas=null;const el=getEl(c);if(el)await seekVideoExact(el,target)}
      }
      FS.prune(activeVids);
      renderFrame(exportSharp);
      activeVids.forEach(c=>{c._overrideCanvas=null});`);
rep("    await vEnc.flush();vEnc.close();","    FS.close();try{await vEnc.flush();vEnc.close()}catch(e){PRO.encErr=PRO.encErr||e}");
rep("if(exCancel){toast('Exportación cancelada.');return}",
    "if(PRO.encErr){const _m=PRO.encErr.message||PRO.encErr;PRO.encErr=null;seek(0);renderAll();toast('El codificador de video falló ('+_m+'). Prueba con una resolución menor o con «Grabación en vivo».',10000);return}if(exCancel){toast('Exportación cancelada.');return}",2);

/* ---------- inicio ---------- */
between("  if(!restored){","  }\n  syncUI();renderBin();renderAll();updUndo();",
`  if(!restored){
    loadProj(SHORTS?{name:'Short nuevo',aspect:'9:16',res:1080,clips:[],media:[]}:{name:'Proyecto nuevo',aspect:'16:9',res:MOB?1080:1440,clips:[],media:[]},true);
  }
  syncUI();renderBin();renderAll();updUndo();
  PRO.init();PRO.init2();PRO.init3();PRO.initAi();PRO.initMob();`);
rep("/* ---------- inicio: carga automática",js+"\n/* ---------- inicio: carga automática");
rep("window.__EE={S,M,","window.__EE={PRO,MS,S,M,");

/* ---------- proxies: el visor usa la copia liviana, la exportación el original ---------- */
rep("const key=(c.track||'V')+'_'+c.mediaId;","const _px=PRO.pxOn(m);const key=(_px?'P':'')+(c.track||'V')+'_'+c.mediaId;");
rep("v.src=m.url;v.preload='auto';v.playsInline=true;","v.src=_px?m.proxyUrl:m.url;if(_px)v.muted=true;v.preload='auto';v.playsInline=true;");
rep("v.currentTime=c.in||0;EL[key]=v;attachAudio(v);return v;","v.currentTime=c.in||0;EL[key]=v;if(_px)PRO.pxAudio(v,m);else attachAudio(v);return v;");
rep("if(el._g)el._g.gain.value=g;else el.volume=clamp(g,0,1);","if(el._g)el._g.gain.value=g;else (el._aud||el).volume=clamp(g,0,1);PRO.audSync(el,target);");
rep("if(el._g)el._g.gain.value=0;else el.volume=0;","if(el._g)el._g.gain.value=0;else el.volume=0;if(el._aud){el._aud.pause();el._aud.volume=0}");
rep("PRO.init3();PRO.initAi();","PRO.init3();PRO.initAi();PRO.initPx();");
rep("m.file=f;m.url=URL.createObjectURL(f);m.offline=false;","m.file=f;m.url=URL.createObjectURL(f);m.offline=false;PRO.pxRestore&&PRO.pxRestore(m);");
/* ---------- vista previa liviana + resolución nativa ---------- */
rep("  w=Math.round(w/2)*2;h=Math.round(h/2)*2;\n","  w=Math.round(w/2)*2;h=Math.round(h/2)*2;\n  {const pv=PRO.prevCap&&!S.exporting?PRO.prevCap():0,sh=Math.min(w,h);if(pv&&pv<sh){const k=pv/sh;w=Math.round(w*k/2)*2;h=Math.round(h*k/2)*2}}\n");
rep("S.upMode=oldMode;S.exporting=false;","S.upMode=oldMode;S.exporting=false;setSize();",3);
rep("$('#res').onchange=e=>{S.res=+e.target.value;setSize();commit();renderAll()};","$('#res').onchange=e=>PRO.resChange(e.target.value);");
rep("$('#res').value=S.res;","$('#res').value=S.resAdapt?'a':S.resNative||![720,1080,1440,2160].includes(+S.res)?'n':S.res;");
rep('<option value="2160">2160p 4K UHD</option>','<option value="2160">2160p 4K UHD</option>\n      <option value="n">⭐ Nativa (igual al video)</option>\n      <option value="a">🧬 Adaptación nativa (sube los demás al más grande)</option>');
rep("upMode:S.upMode,bpm:S.bpm","upMode:S.upMode,resNative:S.resNative,resAdapt:S.resAdapt,bpm:S.bpm",2);
rep("S.res=o.res||1440;","S.res=o.res||1440;S.resNative=!!o.resNative;S.resAdapt=!!o.resAdapt;");
/* en Adaptación nativa el video grande no se toca: solo se escalan los más chicos (ULTIMATE por clip) */
rep("exportSharp=_exU==='ultimate'?0.3:+_exU","exportSharp=_exU==='ultimate'?(S.resAdapt?0:0.3):+_exU");
/* ---------- CutDrop: exportar un tramo (cada corte como su propio video) ---------- */
rep("const T=total(),totalFrames=Math.max(1,Math.round(T*fps));","const _R=PRO.exRange,T0=total(),T=_R?_R.b-_R.a:T0,totalFrames=Math.max(1,Math.round(T*fps));");
rep("const t=PRO.bridgeGap(f/fps,fps);","const t=PRO.bridgeGap(f/fps+(_R?_R.a:0),fps);");
rep("const sr=48000,len=Math.max(1,Math.ceil(T*sr));","const sr=48000,len=Math.max(1,Math.ceil(T0*sr));");
rep("audioBuffer=await oac.startRendering();","audioBuffer=await oac.startRendering();if(_R)audioBuffer=PRO.sliceAudio(audioBuffer,_R.a,_R.b);");
rep("    document.body.appendChild(a);a.click();a.remove();\n    toast(`✅ Exportado sin pérdida","    if(_R&&_R.name)a.download=_R.name+'.'+ext;\n    if(PRO.exSave)await PRO.exSave(blob,a.download);else{document.body.appendChild(a);a.click();a.remove()}\n    if(!_R)toast(`✅ Exportado sin pérdida");
rep('<option value="65000000" selected>','<option value="120000000">🏆 Máxima nativa (~120 Mbps · para 4K sin perder nada)</option>\n        <option value="65000000" selected>');

writeFileSync(join(root,'PRO.html'),h);
console.log(`PRO.html listo: ${n} parches, ${(h.length/1024).toFixed(0)} KB`);
