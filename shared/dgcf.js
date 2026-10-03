/* =====================================================================================
   DGCF · the Dhivehi Games play server (Cloudflare) client                 shared/dgcf.js  v1
   Load it BEFORE shared/net.js:   <script src="../shared/dgcf.js?v=1"></script>
   - DGCF.client(url, ns, opts): a tiny pub/sub client with the SAME interface as net.js's MQTT client (MQ):
       {connected, reconnecting, subscribe(topics), unsubscribe(topics), publish(topic, payload, retain), end(), reconnect()}
     opts: {will:{topic,payload}, onUp, onDown, onMsg(topic, bytes, retained), onObj(topic, json|null, retained), onErr(code)}
     A blind relay: payloads are the games' own (end-to-end encrypted) JSON. Protocol: see dg-play/src/room.js.
     Reconnects with backoff 0.5 -> 15 s (+ jitter); text "ping" every 20 s, gives up on a socket silent for 45 s.
   - DGCF.mode(game): 'mqtt' (old public servers only) | 'both' (old + ours) | 'cf' (ours first, old ones after 6 s
     or on a quota/version error). Read from the server's /cfg (2 s timeout), cached in localStorage, refreshed every
     10 minutes. Until /cfg has ever answered on this device the mode is DEFAULT_MODE.
   - Developer machines (localhost, never inside the app): ?cf=local (ws://localhost:8787, `npx wrangler dev`),
     ?cf=live (the real server), ?net=mqtt|cf|both forces the mode. Without ?cf= localhost stays on 'mqtt'.
   ===================================================================================== */
(function(){
'use strict';
if(window.DGCF)return;
const V=1;
const DEFAULT_MODE='both';   /* when /cfg cannot be reached: try our server and the public brokers together */
const BASES=['https://play.dhivehi.games','https://dg-play.rasewgaming.workers.dev'];
const CFG_MS=10*60*1000,CFG_TIMEOUT=2000;
const MODES=['mqtt','both','cf'];
const APP=!!(window.DG_APP||location.protocol==='capacitor:'||!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()));
const LOCAL=!APP&&(/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname)||/\.(localhost|test)$/.test(location.hostname));
const Q=new URLSearchParams(location.search);
const ls={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};
const TE=new TextEncoder(),TD=new TextDecoder();

/* ---------- where the server is, and which mode to use ---------- */
const qcf=LOCAL?String(Q.get('cf')||'').toLowerCase():'';
const qnet=LOCAL?String(Q.get('net')||'').toLowerCase():'';
const LOCAL_BASE='http://localhost:8787';
function bases(){if(LOCAL)return qcf==='live'?BASES:qcf?[LOCAL_BASE]:[];return BASES;}
const gkey=g=>String(g||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,24);
function cached(g){try{const c=JSON.parse(ls.get('dgcf-cfg-'+(LOCAL?'l'+qcf+'-':'')+gkey(g))||'null');return c&&MODES.includes(c.mode)?c:null;}catch(e){return null;}}
function mode(g){
 if(LOCAL&&MODES.includes(qnet))return qnet;
 if(LOCAL&&!qcf)return 'mqtt';
 const c=cached(g);return c?c.mode:(LOCAL?'both':DEFAULT_MODE);}
function wsUrl(g){const b=bases();
 if(LOCAL&&b.length===1)return b[0].replace(/^http/,'ws')+'/ws';
 const c=cached(g);if(c&&typeof c.url==='string'&&/^wss:\/\//.test(c.url))return c.url;
 return (b[0]||BASES[0]).replace(/^http/,'ws')+'/ws';}
const inflight={};
/* fetch /cfg (2 s timeout per address), cache it; resolves with the mode */
function refresh(g,force){const k=gkey(g);const c=cached(k);
 if(!force&&c&&Date.now()-(c.at||0)<CFG_MS)return Promise.resolve(c.mode);
 if(inflight[k])return inflight[k];
 const list=bases();if(!list.length||!window.fetch)return Promise.resolve(mode(k));
 inflight[k]=(async()=>{for(const b of list){
   const ac=window.AbortController?new AbortController():null;const t=setTimeout(()=>{try{ac&&ac.abort();}catch(e){}},CFG_TIMEOUT);
   try{const r=await fetch(b+'/cfg?g='+encodeURIComponent(k),{signal:ac?ac.signal:undefined,cache:'no-store',credentials:'omit'});clearTimeout(t);
    if(!r.ok)continue;const j=await r.json();if(!j||!MODES.includes(j.mode))continue;
    const url=typeof j.url==='string'?j.url:'';
    ls.set('dgcf-cfg-'+(LOCAL?'l'+qcf+'-':'')+k,JSON.stringify({mode:j.mode,url,at:Date.now()}));return j.mode;}
   catch(e){clearTimeout(t);}}
  return mode(k);})().finally(()=>{delete inflight[k];});
 return inflight[k];}
/* ready(game, ms): the mode, waiting at most ms for a first /cfg answer */
function ready(g,ms){return Promise.race([refresh(g),new Promise(r=>setTimeout(()=>r(mode(g)),ms==null?CFG_TIMEOUT:ms))]);}
let timer=0;function watch(g){refresh(g);if(!timer)timer=setInterval(()=>refresh(g),CFG_MS);}

/* ---------- the client (same shape as net.js MQ) ---------- */
function client(url,ns,opts){opts=opts||{};
 const self={connected:false,reconnecting:true,cf:true,lastErr:''};
 let ws=null,pingT=null,retryT=null,ctT=null,ended=false,delay=500,lastIn=0;
 const subs=new Set();
 const full=url+(url.indexOf('?')<0?'?':'&')+'ns='+encodeURIComponent(ns)+'&v='+V;
 function send(s){if(ws&&ws.readyState===1){try{ws.send(s);return true;}catch(e){}}return false;}
 function schedule(){if(ended)return;clearTimeout(retryT);self.reconnecting=true;
  const d=delay*(0.8+Math.random()*0.4);retryT=setTimeout(connect,d);delay=Math.min(15000,delay*2);}
 function drop(w){if(ws!==w)return;clearTimeout(ctT);clearInterval(pingT);ws=null;const was=self.connected;self.connected=false;if(was&&opts.onDown)opts.onDown();schedule();}
 function connect(){if(ended)return;let w;try{w=new WebSocket(full);}catch(e){schedule();return;}
  ws=w;
  ctT=setTimeout(()=>{if(ws===w&&!self.connected){try{w.close();}catch(e){}drop(w);}},9000);
  w.onopen=()=>{if(ws!==w)return;let will=null;const wl=opts.will;
   if(wl){let m=null;if(wl.payload){try{m=JSON.parse(wl.payload);}catch(e){m=null;}}will={t:wl.topic,m};}
   send(JSON.stringify({k:'hi',v:V,will}));};
  w.onmessage=e=>{if(ws!==w)return;lastIn=Date.now();const s=typeof e.data==='string'?e.data:'';if(!s||s==='pong')return;
   let f;try{f=JSON.parse(s);}catch(x){return;}if(!f)return;
   if(f.k==='msg'){const t=String(f.t||''),m=f.m===undefined?null:f.m,r=f.r?1:0;
    if(opts.onObj)opts.onObj(t,m,r);else if(opts.onMsg)opts.onMsg(t,m==null?new Uint8Array(0):TE.encode(JSON.stringify(m)),r);return;}
   if(f.k==='ok'){self.connected=true;self.reconnecting=false;delay=500;clearTimeout(ctT);
    if(subs.size)send(JSON.stringify({k:'sub',t:[...subs]}));
    clearInterval(pingT);pingT=setInterval(()=>{if(Date.now()-lastIn>45000){const x=ws;try{x&&x.close();}catch(er){}drop(x);return;}send('ping');},20000);
    opts.onUp&&opts.onUp();return;}
   if(f.k==='err'){const c=String(f.code||'');self.lastErr=c;
    /* the server is out of its daily allowance, too new/old for us, or switched off for this game: back off for
       a long time and let the game use the old servers */
    if(c==='quota'||c==='version'||c==='blocked'){delay=5*60*1000;}
    opts.onErr&&opts.onErr(c);}};
  w.onclose=()=>drop(w);w.onerror=()=>{try{w.close();}catch(e){}drop(w);};}
 /* the server takes at most 16 topics per frame */
 function chunks(a){const out=[];for(let i=0;i<a.length;i+=16)out.push(a.slice(i,i+16));return out;}
 function sub(topics){topics.forEach(t=>subs.add(t));if(!self.connected)return;chunks(topics).forEach(c=>send(JSON.stringify({k:'sub',t:c})));}
 function unsub(topics){topics.forEach(t=>subs.delete(t));if(!self.connected)return;chunks(topics).forEach(c=>send(JSON.stringify({k:'unsub',t:c})));}
 function publish(topic,payload,retain){if(!self.connected)return false;let m=payload;
  if(typeof m==='string'){if(m===''){m=null;}else{try{m=JSON.parse(m);}catch(e){return false;}}}
  else if(m instanceof Uint8Array){if(!m.length)m=null;else{try{m=JSON.parse(TD.decode(m));}catch(e){return false;}}}
  return send(JSON.stringify(retain?{k:'pub',t:topic,m,r:1}:{k:'pub',t:topic,m}));}
 function end(){ended=true;clearTimeout(retryT);clearTimeout(ctT);clearInterval(pingT);const w=ws;ws=null;
  if(w){try{if(self.connected)w.send('{"k":"bye"}');w.close();}catch(e){}}self.connected=false;}
 function reconnect(){if(ended||self.connected)return;clearTimeout(retryT);if(delay<60000)delay=500;else return;const w=ws;ws=null;if(w){try{w.close();}catch(e){}}connect();}
 Object.assign(self,{subscribe:sub,unsubscribe:unsub,publish,end,reconnect});connect();return self;}

window.DGCF={version:V,client,mode,url:wsUrl,refresh,ready,watch,local:LOCAL,DEFAULT_MODE,
 /* test hook */_bases:bases};
})();
