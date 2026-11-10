/* sw.js (اختياري) — ارفعه جنب index.html عشان التطبيق يشتغل أوفلاين */
const CACHE='khotty-single-v13';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','index.html']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{
    const net=fetch(r).then(res=>{if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r.mode==='navigate'?'index.html':r,c));}return res}).catch(()=>hit||caches.match('index.html'));
    return hit||net;}));
});
