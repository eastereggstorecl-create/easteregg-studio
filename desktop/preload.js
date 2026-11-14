// Puente seguro entre el editor (página web) y FFmpeg (programa de Windows).
// El editor lo detecta con `window.eeNative`; en Chrome, el celular o GitHub Pages no existe y todo sigue igual.
const {contextBridge,ipcRenderer,webUtils}=require('electron');
const inv=(ch,...a)=>ipcRenderer.invoke(ch,...a);
const progress=new Map();
ipcRenderer.on('ee:progress',(_e,job,frac,info)=>{const f=progress.get(job);if(f)f(frac,info)});
let jobN=0;
const withProg=async(ch,arg,onProg)=>{const job=`${ch}-${++jobN}`;if(onProg)progress.set(job,onProg);try{return await inv(ch,{...arg,job})}finally{progress.delete(job)}};

contextBridge.exposeInMainWorld('eeNative',{
  version:1,
  isApp:true,
  info:()=>inv('ee:info'),
  /* ruta en disco de un archivo elegido o arrastrado (null si no viene del disco) */
  pathOf:f=>{try{return webUtils.getPathForFile(f)||null}catch(e){return null}},
  probe:p=>inv('ee:probe',p),
  /* proxy 720p con la GPU; onProg(fracción 0..1, {speed}) */
  proxy:(p,onProg)=>withProg('ee:proxy',{path:p},onProg),
  proxyCached:p=>inv('ee:proxyCached',p),
  cancel:()=>inv('ee:cancel'),
  /* audio del original como WAV 48 kHz estéreo (URL local) */
  audio:(p,onProg)=>withProg('ee:audio',{path:p},onProg),
  /* lector de fotogramas: frames RGBA ya escalados, desde el segundo `start` */
  frOpen:(o)=>inv('ee:frOpen',o),
  frRead:(id,want)=>inv('ee:frRead',id,want|0),
  frClose:(id)=>inv('ee:frClose',id),
  /* codificador: recibe fotogramas RGBA y escribe el MP4 directo al disco */
  encOpen:(o)=>inv('ee:encOpen',o),
  encWrite:(id,u8)=>inv('ee:encWrite',id,u8),
  encClose:(id)=>inv('ee:encClose',id),
  encAbort:(id)=>inv('ee:encAbort',id),
  writeTemp:(u8,ext)=>inv('ee:writeTemp',u8,ext),
  writeFile:(p,u8)=>inv('ee:writeFile',p,u8),
  saveDialog:(name)=>inv('ee:saveDialog',name),
  pickFolder:()=>inv('ee:pickFolder'),
  join:(dir,name)=>inv('ee:join',dir,name),
  reveal:(p)=>inv('ee:reveal',p)
});
