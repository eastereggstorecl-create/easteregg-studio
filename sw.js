/* EasterEgg Studio · funciona sin internet una vez abierto.
   Archivos propios: se sirven al instante desde la caché y se actualizan por detrás.
   Librerías y fuentes de CDN: se guardan la primera vez que se usan.
   Los modelos de IA no se guardan aquí (tienen su propia caché). */
const C='ee-studio-v1';
const CORE=['./index.html','./','./EDITOR.html','./PRO.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png'];
const CDN=/^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.pathname.includes('/models/')||u.hostname.includes('huggingface')||r.headers.has('range'))return;
  if(u.origin===location.origin&&(r.mode==='navigate'||/\.html$|\/$/.test(u.pathname))){
    // páginas: primero internet (siempre la versión nueva), sin conexión la guardada
    e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})
      .catch(()=>caches.match(r,{ignoreSearch:true})));
  }else if(u.origin===location.origin){
    e.respondWith(caches.open(C).then(async c=>{
      const hit=await c.match(r,{ignoreSearch:true});
      const net=fetch(r).then(res=>{if(res.ok&&res.type==='basic')c.put(r,res.clone());return res}).catch(()=>hit);
      return hit||net;
    }));
  }else if(CDN.test(r.url)&&!/\.(wasm|onnx)$/.test(u.pathname)){
    e.respondWith(caches.open(C).then(async c=>(await c.match(r))||fetch(r).then(res=>{if(res.ok||res.type==='opaque')c.put(r,res.clone());return res})));
  }
});
