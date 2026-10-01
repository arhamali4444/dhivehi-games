/* Dhivehi Games offline support: always try the network first (so updates show at once),
   fall back to the saved copy when there is no connection. Only PAGES fall back to a saved page;
   images, scripts and other files fall back to their own saved copy or fail normally. */
const CACHE='dg-v29';
const CORE=['/','/digu/','/dhogu/','/privacy.html','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 const fonts=u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';
 if(u.origin!==location.origin&&!fonts)return;           /* Firebase, voice, etc. always go to the network */
 const nav=r.mode==='navigate';
 e.respondWith(fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(nav?new Request(u.pathname):r,cp));}return res;})
  .catch(()=>caches.match(nav?u.pathname:r).then(m=>{
   if(m)return m;
   if(!nav)return Response.error();                          /* never hand back a page in place of an image or script */
   return caches.match(u.pathname.startsWith('/digu')?'/digu/':u.pathname.startsWith('/dhogu')?'/dhogu/':'/');})));});
