// EasterEgg Studio · app de escritorio (Electron)
// Abre el editor desde un servidor interno en 127.0.0.1 (no file://) para que funcionen
// la IA (models/sam2), el service worker, el guardado y los videos grandes por partes.
const {app,BrowserWindow,shell,session,dialog,Menu}=require('electron');
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const native=require('./native');

const PORT=(!app.isPackaged&&+process.env.EE_PORT)||47615; // puerto fijo: así el editor guarda sus ajustes y proxies siempre en el mismo «sitio»
const ROOT=app.isPackaged?path.join(process.resourcesPath,'editor'):path.join(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.wasm':'application/wasm',
  '.onnx':'application/octet-stream','.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.txt':'text/plain; charset=utf-8'};

// las pruebas automáticas usan datos aparte y no chocan con la app instalada
if(process.env.EE_TEST&&!app.isPackaged)app.setPath('userData',path.join(__dirname,'testdata','userdata'));
if(!app.requestSingleInstanceLock()){app.quit();process.exit(0)}
// la caché interna del navegador no pasa de 50 MB (los proxies van aparte, en la carpeta que elijas)
app.commandLine.appendSwitch('disk-cache-size',String(50*1024*1024));
app.setAppUserModelId('cl.easteregg.studio');

function sendFile(req,res,file){
  fs.stat(file,(err,st)=>{
    if(err||!st.isFile()){res.writeHead(404);return res.end('No encontrado')}
    const type=MIME[path.extname(file).toLowerCase()]||'application/octet-stream';
    const h={'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    const m=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
    if(m){
      let a=m[1]===''?st.size-(+m[2]):+m[1],b=m[2]===''||m[1]===''?st.size-1:Math.min(+m[2],st.size-1);
      if(a<0)a=0;
      if(a>b||a>=st.size){res.writeHead(416,{'Content-Range':`bytes */${st.size}`});return res.end()}
      res.writeHead(206,{...h,'Content-Range':`bytes ${a}-${b}/${st.size}`,'Content-Length':b-a+1});
      if(req.method==='HEAD')return res.end();
      fs.createReadStream(file,{start:a,end:b}).pipe(res);
    }else{
      res.writeHead(200,{...h,'Content-Length':st.size});
      if(req.method==='HEAD')return res.end();
      fs.createReadStream(file).pipe(res);
    }
  });
}

function startServer(){
  const srv=http.createServer((req,res)=>{
    let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch(e){res.writeHead(400);return res.end()}
    // archivos que crea FFmpeg (proxies, audio): /__cache/<nombre>
    if(p.startsWith('/__file/'))return native.serveFile(req,res,new URL(req.url,'http://x'),sendFile);
    if(p.startsWith('/__cache/'))return sendFile(req,res,path.join(native.cacheDir(),path.basename(p)));
    if(p==='/')p='/EDITOR.html';
    const file=path.normalize(path.join(ROOT,p));
    if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}
    sendFile(req,res,file);
  });
  return new Promise(ok=>{
    srv.once('error',()=>{const s2=srv.listen(0,'127.0.0.1',()=>ok(s2.address().port))});
    srv.listen(PORT,'127.0.0.1',()=>ok(PORT));
  });
}

let win=null;
async function createWindow(){
  const port=await startServer();
  native.setBase(`http://localhost:${port}`);
  const ses=session.defaultSession;
  ses.setPermissionRequestHandler((wc,perm,cb)=>cb(true)); // micrófono (Voz), portapapeles, carpetas
  ses.setPermissionCheckHandler(()=>true);
  win=new BrowserWindow({
    width:1600,height:950,minWidth:900,minHeight:600,show:false,backgroundColor:'#101012',
    title:'EasterEgg Studio',icon:path.join(__dirname,"build","icon.png"),autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false}
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show',()=>{win.maximize();win.show()});
  win.webContents.setWindowOpenHandler(({url})=>{
    if(url.startsWith(`http://localhost:${port}/`))return {action:'allow'};
    shell.openExternal(url);return {action:'deny'};
  });
  // el editor avisa al salir si hay cambios sin guardar: preguntamos aquí
  win.webContents.on('will-prevent-unload',e=>{
    const r=dialog.showMessageBoxSync(win,{type:'question',buttons:['Salir sin guardar','Quedarme'],defaultId:1,cancelId:1,
      title:'EasterEgg Studio',message:'¿Salir? Puede que tengas cambios sin guardar.'});
    if(r===0)e.preventDefault();
  });
  win.webContents.on('before-input-event',(e,inp)=>{
    if(inp.type!=='keyDown')return;
    if(inp.key==='F11'){win.setFullScreen(!win.isFullScreen());e.preventDefault()}
    else if(inp.key==='F12'||(inp.control&&inp.shift&&inp.key.toLowerCase()==='i')){win.webContents.toggleDevTools();e.preventDefault()}
    else if(inp.key==='F5'){win.webContents.reload();e.preventDefault()}
  });
  native.register(win);
  if(process.env.EE_TEST&&!app.isPackaged)return require('./test/harness')(win,port);
  win.loadURL(`http://localhost:${port}/EDITOR.html`);
}

app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.whenReady().then(createWindow);
app.on('window-all-closed',()=>{native.killAll();app.quit()});
