/* Dhivehi Games offline support: always try the network first (so updates show at once),
   fall back to the saved copy when there is no connection. */
const CACHE='dg-v1';
const CORE=['/','/digu/','/privacy.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 const fonts=u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
 if(u.origin!==location.origin&&!fonts)return;           /* Firebase, voice, etc. always go to the network */
 e.respondWith(fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r.mode==='navigate'?new Request(u.pathname):r,cp));}return res;})
  .catch(()=>caches.match(r.mode==='navigate'?u.pathname:r).then(m=>m||caches.match(r.mode==='navigate'&&u.pathname.startsWith('/digu')?'/digu/':'/'))));});
