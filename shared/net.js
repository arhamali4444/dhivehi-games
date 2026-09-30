/* =====================================================================================
   DGNet · shared online play for Dhivehi Games                        shared/net.js  v2
   Load it BEFORE the game's own script, with a cache-busting version:
       <script src="../shared/net.js?v=2"></script>        (bump ?v= in EVERY game whenever this file changes)
   v2 (Sept 2026, backward-compatible): optional waiting-room hooks roomList / roomClick / onLobbyMsg / lobbyFix,
   NET.lobby(obj), game-owned lobby data T.x (also passed to onStart as info.x). Used by Dhihaeh for 2 v 2 seats.
   v5 (Sept 2026, backward-compatible; games opt in with cfg.cpu:true):
   - Quick Match flow: a 12 s search screen (timer ring, seats filling), then "Nobody's around yet" with
     "Start with computer players" (starts by itself after 5 s) or "Keep waiting".
   - PERMANENT computer seats in T.players ({id:'cpu…',name,look,cpu:1}). They are skipped by the AFK check,
     host hand-over and voice, count as free seats in the table listing, and reach onStart as seats[i].cpu=1.
     start() may begin with a single person when computers fill the other seats.
   - A newcomer takes a computer's seat: in the waiting room at once; during a match they watch, then the game
     calls NET.handBreak() between hands (or NET.handBreak(cpuId) at the start of that computer's turn) and
     cfg.onSeatSwap(cpuId,{id,name,look}) hands the seat over (the newcomer keeps its score). The toast says
     "Name took a seat". With no computer seats the old rule stays: public joiners play from the next match.
   - Voice on Quick Match tables too (mic off until tapped), per-player mute and report in the voice tray,
     each player's mic on/off shared (T.mic), a crossed-out mic badge on muted players, and a speaking ring
     (.dgn-ring, transform + opacity only, colour --dgn-talk) around cfg.avatarEl(pid).
   - NET.friends() (Play with Friends sheet), NET.playing(cb) ("N playing now" for the home), NET.ask(o)
     (a themed confirm sheet → Promise<boolean>), NET.leaveAsk() (confirm, then leave the table).

   WHAT IT DOES (extracted from Digu's proven online code, plus Dhogu's Last-Will and epoch-based
   host hand-over, which are more robust):
   - Transport: a tiny built-in MQTT 3.1.1 client over secure WebSockets, talking to two public
     brokers at once (broker.emqx.io:8084, broker.hivemq.com:8884) with auto-reconnect. Every
     message between a player and the host is end-to-end encrypted (ECDH P-256 + AES-GCM).
   - Tables: 4-letter codes, public (listed) or private (code only), Quick Match, a live list of
     open and in-play public tables (listing refreshed every 10 s, ignored after 45 s), cleanup on
     pagehide, and an empty table closes at once when its host leaves.
   - Host-authoritative play: the host runs the game engine; players send actions; the host sends
     every player its own view of the state (the game decides what is hidden).
   - Host migration: if the host leaves or goes silent, the next connected player in seat order
     becomes the host (epoch numbers stop two hosts from fighting); the game rebuilds from the last
     view (and an optional backup the host keeps sending to the first two successors).
   - Spectators with a viewer count; public-table joiners mid-match WAIT and watch, then play from
     the next match; private tables stay locked while a match is on.
   - AFK: the game reports timed-out turns with strike(pid); 2 in a row marks the player AFK, tells
     them, and the game hands the seat to its AI (each game applies its own AFK rule).
   - Voice chat (WebRTC, signalled through the encrypted table channel, mic off until tapped;
     friends tables only, not Quick Match) and quick chat (preset phrases, shown as bubbles).
   - A small UI kit: the online hub sheet, table lists, invite link/code, waiting room, a dock with
     mic / speaker / chat / viewer count, a watch bar, chat bubbles, notices. Theme it with CSS
     variables on :root (all optional):
       --dgn-bg --dgn-bg2 --dgn-fg --dgn-muted --dgn-line --dgn-soft --dgn-acc --dgn-acc-fg
       --dgn-good --dgn-bad --dgn-scrim --dgn-radius --dgn-font --dgn-head --dgn-room-bg
       --dgn-dock-inset (e.g. "64px 10px auto auto")  --dgn-watch-bottom  --dgn-talk
   - Namespaces: every game has its own, "dhivehi<game>/v1/". On localhost ONLY, "?ns=abc" switches
     to a private test namespace "dhivehi<game>/test-abc/". Test namespaces never write to Firestore,
     and on localhost without ?ns= public tables and Quick Match are blocked (private tables only).
   - Presence ("N playing now") via Firebase (project dhivehi-digu): check-ins are only written for
     games the live Firestore rules accept (DGNet.PRESENCE) and never from localhost or test tables.
   - Test hook: on localhost "?pid=abc" gives a tab its own player id (so several tabs can play).

   USE:
     const NET = DGNet.create({
       game:'bondi', title:'Bondi', min:2, max:5,           // namespace dhivehibondi/v1/
       me(){ return {name, look} },                           // look = small JSON (avatar config)
       setName(v){...},                                       // the hub's name field writes here
       avatar(seat,size){ return html },                      // optional: lobby avatars
       options:[{k:'rounds',label:'Match length',def:5,choices:[[3,'3 rounds'],[5,'5 rounds']],when(o){return true}}],
       rulesNote:'15 seconds a turn. …',                     // shown in the waiting room
       listInfo(meta){ return 'Round 2 of 5' },               // host: short text for the live list
       dropText(name,why){ return name+' left. …' },          // host: toast when a seat goes to the AI
       // host side
       onStart(seats, opts, info),   // start a match: seats [{id,name,look}] in seat order
       view(pid, spectator),         // the state as pid may see it (JSON)
       onAction(pid, action),        // a remote player's action
       onDrop(pid, why),             // 'left' | 'lost': a seated player left mid-match: AI takes the seat
       backup(),                     // optional: full state for the first successors (migration)
       // every player
       onState(view, meta, info),    // client: a new state from the host (info.spec / info.waiting)
       onLobby(),                    // the table went (back) to the waiting room
       onMigrate({view,backup,oldHost,meta}),   // I became the host: rebuild host state, then play on
       onEnd(kind, msg),             // left | closed | lost | afk | kicked | moved: show the game's home
       onTell(obj),                  // client: a private note from the host (NET.tell(pid,obj)), e.g. {err}
       dockHost(),                   // optional: element to mount the voice/chat dock in (e.g. the top bar)
       avatarEl(pid),                // element to anchor chat bubbles and the voice ring
       // optional waiting-room extras (v2, e.g. choosing seats / teams). T.x is game-owned lobby data kept in the meta:
       roomList(T,ctx),              // HTML that replaces the player list; ctx={host,me,quick,avatar(seat,size),icons}.
                                     //   Keep <li data-pid> and a .av inside for bubbles and the voice ring; data-dgn="x" buttons call roomClick
       roomClick(dataset),           // a data-dgn="x" button in the room was tapped (every player)
       onLobbyMsg(pid,obj),          // host: a player sent NET.lobby(obj) while the table waits; change T.x (NET.meta().x), then it syncs
       lobbyFix(T)                   // host: tidy T.x before each waiting-room update (players come and go)
       // v5 computer seats (all optional unless cpu:true):
       cpu:true,                     // Quick Match fills empty seats with computer players
       quickSize:4,                  // seats Quick Match looks for (default max)
       cpuSeat(i,taken),             // {name,look} for a new computer seat (default: a Maldivian name, no look)
       onSeatSwap(cpuId,player),     // host: a newcomer takes that computer's seat now; return false to refuse
       onCount(n)                    // "N playing now" changed (also NET.playing(cb))
     });
     NET.open()   NET.boot()   NET.leave()   NET.sync()   NET.send(action)   NET.start()   NET.again()
     NET.matchOver()   NET.strike(pid)   NET.clear(pid)   NET.afk(pid)   NET.retire()   NET.lobby(obj)
     NET.isOnline() isHost() isClient() isSpectator() meta() hostNow() humans() id ns test
     v5: NET.friends()  NET.playing(cb)  NET.handBreak([true|false|cpuId])  NET.ask(o)  NET.leaveAsk()  NET.isCpu(id)
   ===================================================================================== */
(function(){
'use strict';
if(window.DGNet)return;
const VERSION=1;
const BROKERS=['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt'];
const LOCAL=/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname)||/\.(localhost|test)$/.test(location.hostname);
const Q=new URLSearchParams(location.search);
const LIST_MS=10000,STALE_MS=45000,INFO_MS=5000,PING_MS=2500,AWAY_MS=30000,LOST_MS=12000,MIG_STEP=7000,MIG_GIVEUP=50000,
      MAX_VIEW=30,AFK_TURNS=2,QUICK_WAIT=20000,QUICK_FULL=3000,QUICK_AGAIN=25000,BK_MS=1200,
      QUICK_SEARCH=12000,QUICK_ASK=5000,QUICK_REFILL=6000;
const CPU_NAMES=['Aisha','Ibrahim','Mariyam','Hassan','Aminath','Moosa','Hawwa','Yoosuf','Shifa','Nasih','Zahir','Leena'];
const REPORT_REASONS=['Abusive voice','Abusive chat','Offensive name','Cheating or unfair play','Other'];
const ls={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}},del(k){try{localStorage.removeItem(k);}catch(e){}}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14);
const clampInt=(v,a,b)=>Math.max(a,Math.min(b,v|0));
const TE=new TextEncoder(),TD=new TextDecoder();

/* ---------- player id (shared by every Dhivehi game on this device) ---------- */
function pid(key){if(LOCAL){const q=Q.get('pid');if(q&&/^[a-z0-9_-]{2,24}$/i.test(q))return q;}
 key=key||'dd-pid';let v=ls.get(key);if(!v){v='p'+Math.random().toString(36).slice(2,10);ls.set(key,v);}return v;}
/* localhost tests only: ?pname=Ali gives a tab its own display name */
function testName(){if(!LOCAL)return '';const v=cleanName(Q.get('pname'));return v;}
function nsFor(game,ver){const base='dhivehi'+String(game).toLowerCase().replace(/[^a-z0-9]/g,'');
 try{const q=Q.get('ns');if(LOCAL&&q&&/^[a-z0-9]{3,16}$/i.test(q))return base+'/test-'+q.toLowerCase()+'/';}catch(e){}return base+'/v'+(ver||1)+'/';}

/* ---------- crypto ---------- */
function b64(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function unb64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function rid(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
async function newKeys(){const kp=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);return{kp,pub:b64(new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey)))};}
async function sharedKey(priv,pubB64){const pk=await crypto.subtle.importKey('raw',unb64(pubB64),{name:'ECDH',namedCurve:'P-256'},false,[]);return crypto.subtle.deriveKey({name:'ECDH',public:pk},priv,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function seal(key,obj){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,TE.encode(JSON.stringify(obj)));return{i:b64(iv),c:b64(new Uint8Array(ct))};}
async function unseal(key,m){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(m.i)},key,unb64(m.c));return JSON.parse(TD.decode(pt));}

/* ---------- tiny MQTT 3.1.1 client (QoS 0) with an optional retained Last Will ---------- */
function MQ(url,opts){
 const self={connected:false,reconnecting:true};
 let ws=null,buf=new Uint8Array(0),pingT=null,retryT=null,ctT=null,ended=false,pid=0,delay=1500,lastIn=0;
 const subs=new Set(),clientId='dg_'+rid(7);
 const str=s=>{const b=TE.encode(s),o=new Uint8Array(2+b.length);o[0]=b.length>>8;o[1]=b.length&255;o.set(b,2);return o;};
 function packet(head,parts){const bodyLen=parts.reduce((t,p)=>t+p.length,0);let len=bodyLen;const lb=[];do{let d=len%128;len=Math.floor(len/128);if(len>0)d|=128;lb.push(d);}while(len>0);
  const out=new Uint8Array(1+lb.length+bodyLen);out[0]=head;out.set(lb,1);let off=1+lb.length;parts.forEach(p=>{out.set(p,off);off+=p.length;});return out;}
 function send(u8){if(ws&&ws.readyState===1){try{ws.send(u8);return true;}catch(e){}}return false;}
 function nextId(){pid=pid%65535+1;return new Uint8Array([pid>>8,pid&255]);}
 function schedule(){if(ended)return;clearTimeout(retryT);self.reconnecting=true;retryT=setTimeout(connect,delay);delay=Math.min(15000,delay*1.6);}
 function drop(w){if(ws!==w)return;clearTimeout(ctT);clearInterval(pingT);ws=null;buf=new Uint8Array(0);const was=self.connected;self.connected=false;if(was&&opts.onDown)opts.onDown();schedule();}
 function connect(){if(ended)return;let w;try{w=new WebSocket(url,['mqtt']);}catch(e){schedule();return;}
  ws=w;w.binaryType='arraybuffer';
  ctT=setTimeout(()=>{if(ws===w&&!self.connected){try{w.close();}catch(e){}drop(w);}},9000);
  /* CONNECT: clean session, keep-alive 30 s; with a Will: retained, QoS 0 (flags 0x26) */
  w.onopen=()=>{if(ws!==w)return;const wl=opts.will;const parts=[new Uint8Array([0,4,77,81,84,84,4,wl?0x26:0x02,0,30]),str(clientId)];if(wl){parts.push(str(wl.topic));parts.push(str(wl.payload||''));}send(packet(0x10,parts));};
  w.onmessage=e=>{if(ws!==w)return;lastIn=Date.now();const d=new Uint8Array(e.data);const nb=new Uint8Array(buf.length+d.length);nb.set(buf);nb.set(d,buf.length);buf=nb;parse();};
  w.onclose=()=>drop(w);w.onerror=()=>{try{w.close();}catch(e){}drop(w);};}
 function parse(){while(buf.length>=2){let mul=1,len=0,i=1,b;do{if(i>=buf.length)return;b=buf[i++];len+=(b&127)*mul;mul*=128;}while(b&128);
  if(buf.length<i+len)return;const head=buf[0],body=buf.slice(i,i+len);buf=buf.slice(i+len);handle(head>>4,head&15,body);}}
 function handle(type,flags,b){
  if(type===2){if(b[1]!==0){try{ws&&ws.close();}catch(e){}return;}
   self.connected=true;self.reconnecting=false;delay=1500;clearTimeout(ctT);lastIn=Date.now();
   if(subs.size)sub([...subs]);clearInterval(pingT);
   pingT=setInterval(()=>{if(Date.now()-lastIn>50000){const w=ws;try{w&&w.close();}catch(e){}drop(w);return;}send(new Uint8Array([0xC0,0]));},20000);
   opts.onUp&&opts.onUp();}
  else if(type===3){const qos=(flags>>1)&3,tl=(b[0]<<8)|b[1];const topic=TD.decode(b.subarray(2,2+tl));let off=2+tl;
   if(qos>0){const hi=b[off],lo=b[off+1];off+=2;send(new Uint8Array([qos===1?0x40:0x50,2,hi,lo]));}
   opts.onMsg&&opts.onMsg(topic,b.subarray(off),flags&1);}}
 function sub(topics){topics.forEach(t=>subs.add(t));if(!self.connected)return;const parts=[nextId()];topics.forEach(t=>{parts.push(str(t));parts.push(new Uint8Array([0]));});send(packet(0x82,parts));}
 function unsub(topics){topics.forEach(t=>subs.delete(t));if(!self.connected)return;send(packet(0xA2,[nextId()].concat(topics.map(str))));}
 function publish(topic,payload,retain){if(!self.connected)return false;const p=typeof payload==='string'?TE.encode(payload):payload;return send(packet(0x30|(retain?1:0),[str(topic),p]));}
 function end(){ended=true;clearTimeout(retryT);clearTimeout(ctT);clearInterval(pingT);const w=ws;ws=null;if(w){try{if(self.connected)w.send(new Uint8Array([0xE0,0]));w.close();}catch(e){}}self.connected=false;}
 function reconnect(){if(ended||self.connected)return;clearTimeout(retryT);delay=1500;const w=ws;ws=null;if(w){try{w.close();}catch(e){}}connect();}
 Object.assign(self,{subscribe:sub,unsubscribe:unsub,publish,end,reconnect});connect();return self;}
/* one client per broker; messages are JSON (empty payload = null, used to wipe retained topics) */
function makeClients(will){return BROKERS.map((url,bi)=>{const o={bi,ok:false,up:null,h:null,subs:()=>[],onUp2:null,c:null};
 o.c=MQ(url,{will,onUp:()=>{o.ok=true;const t=o.subs();if(t.length)o.c.subscribe(t);if(o.up){const f=o.up;o.up=null;f();}o.onUp2&&o.onUp2();},
  onDown:()=>{o.ok=false;},onMsg:(topic,p,ret)=>{if(!o.h)return;let m=null;if(p.length){try{m=JSON.parse(TD.decode(p));}catch(e){return;}}o.h(o,topic,m,ret);}});return o;});}
function anyUp(cl,ms){return new Promise(res=>{let done=false;const fin=v=>{if(done)return;done=true;clearTimeout(t);res(v);};const t=setTimeout(()=>fin(cl.some(o=>o.ok)),ms);cl.forEach(o=>{if(o.ok)fin(true);else{const f=o.up;o.up=()=>{f&&f();fin(true);};}});});}
const pub=(o,topic,obj,retain)=>!!(o&&o.c&&o.ok&&o.c.publish(topic,typeof obj==='string'?obj:JSON.stringify(obj),retain));
function genCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ';let s='';for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}

/* ---------- presence: "N playing now" (Firebase, project dhivehi-digu) ----------
   Only games the live Firestore rules accept are written; see extras/firestore-rules.txt. */
const PRESENCE=['digu','bondi','thaas','dhashundhama','binveriya','atolls','dhihaeh','joker','juice'];
const FBCFG={apiKey:'AIzaSyCl9Xz5r80755hYX0ww2GRaB6TZTH6sayE',authDomain:'dhivehi-digu.firebaseapp.com',projectId:'dhivehi-digu',storageBucket:'dhivehi-digu.firebasestorage.app',messagingSenderId:'778464006205',appId:'1:778464006205:web:7dce5d63707c6b2d0eda54'};
let fbP=null;
const FBV='https://www.gstatic.com/firebasejs/12.19.0/';
function fb(){if(fbP)return fbP;
 fbP=Promise.all([import(FBV+'firebase-app.js'),import(FBV+'firebase-firestore.js')]).then(([A,F])=>{
  const app=A.getApps&&A.getApps().length?A.getApp():A.initializeApp(FBCFG);return{A,F,app,db:F.getFirestore(app)};}).catch(e=>{fbP=null;throw e;});return fbP;}
/* sign-in is only loaded for real presence check-ins (never on localhost or test tables) */
let fbaP=null;
function fbAuth(){if(fbaP)return fbaP;fbaP=Promise.all([fb(),import(FBV+'firebase-auth.js')]).then(([f,U])=>({f,U,auth:U.getAuth(f.app)})).catch(e=>{fbaP=null;throw e;});return fbaP;}

/* ---------- locked names (same rule as Digu) ----------
   A registered player (Digu keeps their username in dd-auth-username) always plays as that username, their own capital
   letters kept. A guest can't take a registered username (usernames/{name}, read-only check, cached per name). */
const regName=()=>(ls.get('dd-auth-username')||'').trim().toLowerCase();
const unameKey=n=>{const k=String(n||'').trim().toLowerCase();return /^[a-z0-9_.-]{1,14}$/.test(k)?k:'';};
const unameSeen=new Map();
async function unameTaken(n){const k=unameKey(n);if(!k)return false;if(k==='dangerous')return true;if(unameSeen.has(k))return unameSeen.get(k);
 try{const f=await fb();const s=await f.F.getDoc(f.F.doc(f.db,'usernames',k));unameSeen.set(k,s.exists());return s.exists();}catch(e){return false;}}
function lockedName(n){const un=regName();if(!un||testName())return n;return String(n||'').toLowerCase()===un?n:un;}
/* a guest's name that is known to be registered (false while the first check is still running) */
function guestTaken(n){if(regName()||testName())return false;const k=unameKey(n);if(!k)return false;if(k==='dangerous')return true;
 if(!unameSeen.has(k)){unameTaken(k);return false;}return unameSeen.get(k);}

/* ---------- icons ---------- */
const SV=(p,extra)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra||''}>${p}</svg>`;
const IC={
 micOn:SV('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
 micOff:SV('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/><path d="M4 4l16 16"/>'),
 spk:SV('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
 spkOff:SV('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
 chat:SV('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/>'),
 eye:SV('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
 back:SV('<path d="M15 5l-7 7 7 7"/>'),
 x:SV('<path d="M6 6l12 12M18 6L6 18"/>'),
 bolt:SV('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
 share:SV('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
 copy:SV('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
 plus:SV('<path d="M12 5v14M5 12h14"/>'),
 users:SV('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.2 14.1c2.7.4 4.8 2.7 4.8 5.9"/>'),
 lock:SV('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
 globe:SV('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>'),
 bot:SV('<rect x="4" y="7" width="16" height="12" rx="3.5"/><path d="M12 7V4"/><circle cx="9.3" cy="12.6" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.7" cy="12.6" r="1.4" fill="currentColor" stroke="none"/>',' stroke-width="2.4"'),
 seat:SV('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.6-6 7-6s6.2 2.5 7 6"/>'),
 flag:SV('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
 mute:SV('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
 micX:SV('<path d="M15 9.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.6 2.5"/><path d="M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.4 12.5c.1-.5.1-1 .1-1.5M12 17.5V21M4 4l16 16"/>',' stroke-width="2.6"'),
 crown:'<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14h20l1.5-10-6.5 4.5L12 1 7 8.5.5 4z" fill="#F2C94C" stroke="#8A6414" stroke-width="1.2" stroke-linejoin="round"/></svg>'};
const PHRASES=['Hello!','Good luck!','Nice one!','Oops!','Well played!','Your turn!','Thanks!','Hurry up!','Be right back','Good game!','One more?','Bye!'];

const STYLE=`
.dgn{font-family:var(--dgn-font,inherit);color:var(--dgn-fg,#F5F1E8);-webkit-tap-highlight-color:transparent}
.dgn *,.dgn *::before,.dgn *::after{box-sizing:border-box}
.dgn [hidden]{display:none!important}
.dgn button{font:inherit;color:inherit;cursor:pointer;-webkit-appearance:none;appearance:none}
.dgn-scrim{position:fixed;inset:0;background:var(--dgn-scrim,rgba(4,6,10,.62));z-index:calc(var(--dgn-z,9000) + 1);animation:dgnFade .2s ease}
.dgn-sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:520px;max-height:min(92vh,92dvh);overflow:auto;overscroll-behavior:contain;z-index:calc(var(--dgn-z,9000) + 2);
 background:var(--dgn-bg,#15181d);border:1px solid var(--dgn-line,rgba(255,255,255,.12));border-bottom:0;border-radius:var(--dgn-radius,18px) var(--dgn-radius,18px) 0 0;
 padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -18px 50px rgba(0,0,0,.45);animation:dgnUp .28s cubic-bezier(.2,.8,.2,1)}
@keyframes dgnUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes dgnFade{from{opacity:0}to{opacity:1}}
.dgn-grab{width:40px;height:4px;border-radius:4px;background:var(--dgn-line,rgba(255,255,255,.2));margin:0 auto 10px}
.dgn-hd{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.dgn-hd h2{margin:0;font:800 21px/1.15 var(--dgn-head,inherit);letter-spacing:.01em;flex:1;min-width:0}
.dgn-x{width:36px;height:36px;border-radius:50%;border:0;background:var(--dgn-soft,rgba(255,255,255,.08));display:grid;place-items:center;flex:none}
.dgn-x svg,.dgn-ib svg{width:20px;height:20px}
.dgn-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 9px;border-radius:99px;background:var(--dgn-soft,rgba(255,255,255,.08));white-space:nowrap}
.dgn-live i{width:8px;height:8px;border-radius:50%;background:var(--dgn-good,#43B581);box-shadow:0 0 0 3px rgba(67,181,129,.25)}
.dgn-srv{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dgn-muted,rgba(245,241,232,.64));margin:2px 0 12px}
.dgn-srv i{width:8px;height:8px;border-radius:50%;background:#d9a441;flex:none}
.dgn-srv.s-ok i{background:var(--dgn-good,#43B581)}.dgn-srv.s-fail i{background:var(--dgn-bad,#E5604D)}
.dgn-lbl{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dgn-muted,rgba(245,241,232,.64));margin:14px 0 6px}
.dgn-in{width:100%;min-width:0;height:46px;border-radius:12px;border:1px solid var(--dgn-line,rgba(255,255,255,.14));background:var(--dgn-bg2,#1d2128);color:inherit;font:600 16px/1 inherit;padding:0 14px;outline:none}
.dgn-in:focus{border-color:var(--dgn-acc,#E5604D);box-shadow:0 0 0 3px color-mix(in srgb,var(--dgn-acc,#E5604D) 30%,transparent)}
.dgn-in.code{text-transform:uppercase;letter-spacing:.3em;font-weight:800;text-align:center;max-width:150px}
.dgn-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 16px;border-radius:12px;border:1px solid var(--dgn-line,rgba(255,255,255,.12));
 background:var(--dgn-soft,rgba(255,255,255,.08));font-weight:700;font-size:15px;line-height:1.15;text-align:center;transition:transform .12s,filter .12s}
.dgn-btn:active{transform:scale(.97)}
.dgn-btn[disabled]{opacity:.5;cursor:default;transform:none}
.dgn-btn svg{width:19px;height:19px;flex:none}
.dgn-btn.pri{background:var(--dgn-acc,#E5604D);color:var(--dgn-acc-fg,#fff);border-color:transparent;box-shadow:0 8px 22px color-mix(in srgb,var(--dgn-acc,#E5604D) 32%,transparent)}
.dgn-btn.w{width:100%}
.dgn-btn.big{min-height:62px;font-size:17px;flex-direction:row}
.dgn-btn.big span{display:flex;flex-direction:column;align-items:flex-start;text-align:left}
.dgn-btn.big small{font-size:12px;font-weight:600;opacity:.82;margin-top:2px}
.dgn-btn.sm{min-height:36px;padding:6px 12px;font-size:13px;border-radius:10px}
.dgn-row{display:flex;gap:8px;align-items:center}.dgn-row .dgn-in{flex:1}
.dgn-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.dgn-card{margin-top:12px;padding:12px;border-radius:14px;background:var(--dgn-bg2,#1d2128);border:1px solid var(--dgn-line,rgba(255,255,255,.08))}
.dgn-card .dgn-lbl{margin-top:0}
.dgn-seg{display:flex;gap:4px;padding:4px;border-radius:12px;background:var(--dgn-soft,rgba(255,255,255,.07));flex-wrap:wrap}
.dgn-seg button{flex:1 1 auto;min-height:38px;border:0;border-radius:9px;background:transparent;font-weight:700;font-size:13.5px;padding:6px 8px;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.dgn-seg button svg{width:16px;height:16px}
.dgn-seg button[aria-pressed="true"]{background:var(--dgn-acc,#E5604D);color:var(--dgn-acc-fg,#fff)}
.dgn-seg button[disabled]{cursor:default}
.dgn-seg button[disabled][aria-pressed="false"]{opacity:.55}
.dgn-hint,.dgn-fine{font-size:12.5px;line-height:1.45;color:var(--dgn-muted,rgba(245,241,232,.64));margin:8px 0 0}
.dgn-fine{margin-top:14px}
.dgn-h3{font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin:18px 0 8px;color:var(--dgn-muted,rgba(245,241,232,.7))}
.dgn-list{display:flex;flex-direction:column;gap:8px}
.dgn-empty{font-size:13px;color:var(--dgn-muted,rgba(245,241,232,.64));padding:12px;border-radius:12px;border:1px dashed var(--dgn-line,rgba(255,255,255,.14));margin:0;text-align:center}
.dgn-tb{display:flex;align-items:center;gap:10px;padding:10px 10px 10px 12px;border-radius:14px;background:var(--dgn-bg2,#1d2128);border:1px solid var(--dgn-line,rgba(255,255,255,.08))}
.dgn-tb .ti{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--dgn-soft,rgba(255,255,255,.08));flex:none}
.dgn-tb .ti svg{width:18px;height:18px}
.dgn-tb .tt{flex:1;min-width:0}
.dgn-tb b{display:block;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgn-tb small{display:block;font-size:12px;color:var(--dgn-muted,rgba(245,241,232,.64));line-height:1.35}
.dgn-tb .ta{display:flex;gap:6px;flex:none}
/* waiting room, quick wait */
.dgn-room,.dgn-quick{position:fixed;inset:0;z-index:calc(var(--dgn-z,9000) + 3);overflow:auto;overscroll-behavior:contain;background:var(--dgn-room-bg,var(--dgn-bg,#15181d));animation:dgnFade .2s ease}
.dgn-room-in{max-width:520px;margin:0 auto;padding:calc(10px + env(safe-area-inset-top,0px)) 16px calc(24px + env(safe-area-inset-bottom,0px))}
.dgn-top{display:flex;align-items:center;gap:8px;min-height:48px}
.dgn-top .ttl{flex:1;min-width:0;font:800 17px/1.2 var(--dgn-head,inherit);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgn-ib{width:42px;height:42px;border-radius:50%;border:1px solid var(--dgn-line,rgba(255,255,255,.12));background:var(--dgn-soft,rgba(255,255,255,.08));display:grid;place-items:center;flex:none;position:relative}
.dgn-ib[aria-pressed="true"]{background:var(--dgn-good,#43B581);color:#fff;border-color:transparent}
.dgn-codebox{text-align:center;margin:8px 0 4px;padding:14px 12px;border-radius:16px;background:var(--dgn-bg2,#1d2128);border:1px solid var(--dgn-line,rgba(255,255,255,.08))}
.dgn-codebox .dgn-lbl{margin-top:0}
.dgn-code{display:flex;justify-content:center;gap:8px;margin:4px 0 12px;user-select:all}
.dgn-code span{width:clamp(44px,14vw,58px);height:clamp(54px,17vw,68px);border-radius:12px;display:grid;place-items:center;font:900 clamp(28px,9vw,38px)/1 var(--dgn-head,inherit);background:var(--dgn-soft,rgba(255,255,255,.08));border:1px solid var(--dgn-line,rgba(255,255,255,.12))}
.dgn-plist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dgn-plist li{display:flex;align-items:center;gap:10px;min-height:52px;padding:6px 10px;border-radius:14px;background:var(--dgn-bg2,#1d2128);border:1px solid var(--dgn-line,rgba(255,255,255,.08))}
.dgn-plist li.empty{background:transparent;border-style:dashed;color:var(--dgn-muted,rgba(245,241,232,.6));font-size:13.5px}
.dgn-plist li.empty .seat{width:38px;height:38px;border-radius:50%;border:2px dashed var(--dgn-line,rgba(255,255,255,.2));flex:none}
.dgn-plist .av{width:38px;height:38px;border-radius:50%;overflow:hidden;flex:none;display:grid;place-items:center;background:var(--dgn-soft,rgba(255,255,255,.1));font-weight:800;position:relative}
.dgn-plist .av svg{width:100%;height:100%}
.dgn-plist .nm{flex:1;min-width:0;font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgn-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:99px;background:var(--dgn-soft,rgba(255,255,255,.1));margin-left:4px;vertical-align:middle}
.dgn-tag svg{width:14px;height:10px}
.dgn-tag.you{background:color-mix(in srgb,var(--dgn-acc,#E5604D) 28%,transparent)}
.dgn-kick{width:32px;height:32px;border-radius:50%;border:0;background:var(--dgn-soft,rgba(255,255,255,.08));display:grid;place-items:center;flex:none}
.dgn-kick svg{width:15px;height:15px}
.dgn-go{margin-top:18px;display:flex;flex-direction:column;gap:10px}
.dgn-waitp{text-align:center;font-weight:700;margin:6px 0 0}
.dgn-quick{display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
.dgn-quick .qi{max-width:340px}
.dgn-spin{width:54px;height:54px;border-radius:50%;border:4px solid var(--dgn-line,rgba(255,255,255,.14));border-top-color:var(--dgn-acc,#E5604D);margin:0 auto 18px;animation:dgnSpin .9s linear infinite}
@keyframes dgnSpin{to{transform:rotate(360deg)}}
.dgn-quick p{font-weight:700;font-size:16px;margin:0 0 18px}
/* in-match dock, watch bar, chat */
.dgn-dock{position:fixed;inset:var(--dgn-dock-inset,calc(env(safe-area-inset-top,0px) + 62px) 10px auto auto);z-index:var(--dgn-dock-z,30);display:flex;flex-direction:var(--dgn-dock-dir,row);gap:6px;align-items:center;justify-content:flex-end;pointer-events:none}
.dgn-dock.inline{position:static;inset:auto;z-index:auto;pointer-events:auto;flex:none}
.dgn-dock>*{pointer-events:auto}
.dgn-dock .dgn-ib{width:var(--dgn-dock-size,38px);height:var(--dgn-dock-size,38px);background:var(--dgn-dock-bg,rgba(10,12,16,.62));backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:var(--dgn-fg,#F5F1E8);box-shadow:0 4px 14px rgba(0,0,0,.35)}
.dgn-dock.inline .dgn-ib{box-shadow:var(--dgn-inline-shadow,inset 0 0 0 1px rgba(255,255,255,.18));backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--dgn-inline-bg,rgba(0,0,0,.35));border:0}
.dgn-dock .dgn-ib[aria-pressed="true"]{background:var(--dgn-good,#43B581);color:#fff}
.dgn-voice{display:grid;gap:8px}.dgn-voice .dgn-btn{justify-content:flex-start}
.dgn-vw{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;padding:5px 9px;border-radius:99px;background:var(--dgn-dock-bg,rgba(10,12,16,.62));color:var(--dgn-fg,#F5F1E8)}
.dgn-vw svg{width:15px;height:15px}
.dgn-watch{position:fixed;left:50%;transform:translateX(-50%);bottom:var(--dgn-watch-bottom,calc(10px + env(safe-area-inset-bottom,0px)));z-index:var(--dgn-dock-z,30);width:min(500px,calc(100vw - 20px));display:flex;align-items:center;gap:10px;
 padding:10px 10px 10px 14px;border-radius:16px;background:var(--dgn-bg,#15181d);border:1px solid var(--dgn-line,rgba(255,255,255,.14));box-shadow:0 10px 30px rgba(0,0,0,.45)}
.dgn-watch .we{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--dgn-soft,rgba(255,255,255,.08));flex:none}
.dgn-watch .we svg{width:18px;height:18px}
.dgn-watch .wt{flex:1;min-width:0}.dgn-watch b{display:block;font-size:14px}.dgn-watch small{display:block;font-size:12px;color:var(--dgn-muted,rgba(245,241,232,.64))}
.dgn-tray{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:calc(var(--dgn-z,9000) + 5);width:min(460px,calc(100vw - 20px));padding:12px;border-radius:18px;background:var(--dgn-bg,#15181d);
 border:1px solid var(--dgn-line,rgba(255,255,255,.14));box-shadow:0 16px 40px rgba(0,0,0,.5);animation:dgnUp .2s ease}
.dgn-tray .th{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:800}
.dgn-tray .tg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dgn-tray .tg button{min-height:40px;border-radius:10px;border:1px solid var(--dgn-line,rgba(255,255,255,.1));background:var(--dgn-soft,rgba(255,255,255,.08));font-weight:700;font-size:13px;padding:6px 4px;line-height:1.15}
.dgn-bub{position:fixed;z-index:var(--dgn-bub-z,35);max-width:min(200px,60vw);padding:7px 11px;border-radius:14px;background:#fff;color:#111;font:700 13px/1.25 var(--dgn-font,inherit);box-shadow:0 6px 18px rgba(0,0,0,.35);
 pointer-events:none;animation:dgnBub 3.2s ease forwards;transform-origin:50% 100%}
.dgn-bub::after{content:'';position:absolute;left:var(--ax,50%);bottom:-6px;width:12px;height:12px;background:#fff;transform:translateX(-50%) rotate(45deg);border-radius:2px}
.dgn-bub.below::after{bottom:auto;top:-6px}
.dgn-bub small{display:block;font-size:10.5px;font-weight:800;opacity:.6;letter-spacing:.03em}
@keyframes dgnBub{0%{opacity:0;transform:scale(.7)}8%{opacity:1;transform:scale(1.04)}14%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
.dgn-toast{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:calc(var(--dgn-z,9000) + 8);max-width:min(440px,calc(100vw - 24px));padding:10px 16px;border-radius:14px;
 background:var(--dgn-bg,#15181d);border:1px solid var(--dgn-line,rgba(255,255,255,.16));font-weight:700;font-size:14px;line-height:1.35;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.45);animation:dgnFade .2s ease}
#dgnNote .dgn-scrim{z-index:calc(var(--dgn-z,9000) + 6)}#dgnNote .dgn-sheet{z-index:calc(var(--dgn-z,9000) + 7)}
.dgn-note ol{margin:6px 0 10px;padding-left:20px;font-size:14px;line-height:1.5}
.dgn-note p{font-size:14.5px;line-height:1.5;margin:6px 0 14px;color:var(--dgn-muted,rgba(245,241,232,.8))}
/* v5: speaking ring + muted badge around a seat avatar (only transform and opacity change while someone talks) */
.dgn-ring{position:absolute;inset:-5px;border-radius:50%;pointer-events:none;box-sizing:border-box;border:3px solid var(--dgn-talk,rgba(67,181,129,.9));
 box-shadow:0 0 12px var(--dgn-talk,rgba(67,181,129,.6)),inset 0 0 8px var(--dgn-talk,rgba(67,181,129,.5));opacity:0;transform:scale(1);transition:opacity .3s ease-out,transform .3s ease-out;z-index:3;will-change:transform,opacity}
.dgn-ring.on{transition:opacity .08s linear,transform .08s linear}
.dgn-moff{padding:0;margin:0;position:absolute;right:-4px;bottom:-3px;width:18px;height:18px;border-radius:50%;background:#fff;color:#1c1c1e;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.4);z-index:4;pointer-events:none}
.dgn-moff svg{width:62%;height:62%}
.dgn-moff.dgn-me{box-shadow:0 0 0 1.5px var(--dgn-acc,#E5604D),0 1px 3px rgba(0,0,0,.4)}
.dgn-moff[hidden]{display:none!important}
/* v5: Quick Match search */
.dgn-qs{text-align:center}
.dgn-qpanel{margin:8px 0 0;padding:22px 14px 18px;border-radius:calc(var(--dgn-radius,18px) + 4px);background:var(--dgn-bg2,#1d2128);border:1px solid var(--dgn-line,rgba(255,255,255,.08))}
.dgn-ringw{position:relative;width:148px;height:148px;margin:4px auto 0}
.dgn-ringw svg.tr{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.dgn-ringw .trk{fill:none;stroke:var(--dgn-line,rgba(255,255,255,.14));stroke-width:8}
.dgn-ringw .arc{fill:none;stroke:var(--dgn-acc,#E5604D);stroke-width:8;stroke-linecap:round}
.dgn-ringw .dgn-rme{position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--dgn-soft,rgba(255,255,255,.1));font-weight:800;font-size:40px;line-height:1;font-family:var(--dgn-head,inherit);box-shadow:0 0 0 4px var(--dgn-bg,#15181d)}
.dgn-ringw .dgn-rme svg{width:100%;height:100%;display:block}
.dgn-secs{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);background:var(--dgn-bg,#15181d);color:var(--dgn-acc,#E5604D);font-weight:800;font-size:12px;line-height:1;font-family:var(--dgn-font,inherit);padding:6px 10px;border-radius:99px;box-shadow:0 4px 12px -6px rgba(0,0,0,.6);white-space:nowrap;border:1px solid var(--dgn-line,rgba(255,255,255,.12))}
.dgn-qs h3{margin:22px 0 4px;font-weight:800;font-size:22px;line-height:1.15;font-family:var(--dgn-head,inherit);letter-spacing:-.01em}
.dgn-quick.qs{display:block;padding:0;text-align:left}
.dgn-qs .dgn-qst{font-size:12.5px;font-weight:600;color:var(--dgn-muted,rgba(245,241,232,.64));margin:0;min-height:1.4em}
.dgn-dots::after{content:"";display:inline-block;width:1.2em;text-align:left;animation:dgnDots 1.4s steps(4) infinite}
@keyframes dgnDots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
.dgn-seats{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 4px;margin:16px 0 6px}
.dgn-st{display:flex;flex-direction:column;align-items:center;gap:5px;width:66px;min-width:0}
.dgn-st .av,.dgn-st .emp{width:52px;height:52px;border-radius:50%;flex:none}
.dgn-st .av{overflow:hidden;display:grid;place-items:center;background:var(--dgn-soft,rgba(255,255,255,.1));font-weight:800;font-size:20px;box-shadow:0 0 0 2.5px var(--dgn-bg,#15181d);animation:dgnPop .45s cubic-bezier(.2,1.4,.4,1) both}
.dgn-st .av svg{width:100%;height:100%;display:block}
.dgn-st .av.cpu{color:var(--dgn-muted,rgba(245,241,232,.7))}.dgn-st .av.cpu>svg{width:58%;height:58%}
.dgn-st .emp{border:2px dashed var(--dgn-line,rgba(255,255,255,.22));display:grid;place-items:center;color:var(--dgn-muted,rgba(245,241,232,.5))}
.dgn-st .emp svg{width:18px;height:18px}
.dgn-st .n{font-size:11.5px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dgn-st .n.o{color:var(--dgn-muted,rgba(245,241,232,.6));font-weight:600}
@keyframes dgnPop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}
.dgn-ctag{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 6px;border-radius:99px;background:var(--dgn-soft,rgba(255,255,255,.12));color:var(--dgn-muted,rgba(245,241,232,.8));white-space:nowrap;vertical-align:middle}
.dgn-ctag svg{width:10px;height:10px}
.dgn-qfill{font-size:12.5px;color:var(--dgn-muted,rgba(245,241,232,.64));margin:2px 0 14px}
.dgn-qs .dgn-qhint{font-size:12px;font-weight:500;color:var(--dgn-muted,rgba(245,241,232,.64));margin:12px 4px 0;text-align:center}
#dgnQa .dgn-scrim{z-index:calc(var(--dgn-z,9000) + 4)}#dgnQa .dgn-sheet{z-index:calc(var(--dgn-z,9000) + 5)}
.dgn-bots{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:10px 12px;border-radius:14px;background:var(--dgn-bg2,#1d2128);text-align:left}
.dgn-bots .hp{display:flex;flex:none}
.dgn-bots .hp span{width:32px;height:32px;border-radius:50%;margin-left:-8px;display:grid;place-items:center;overflow:hidden;background:var(--dgn-soft,rgba(255,255,255,.12));box-shadow:0 0 0 2px var(--dgn-bg,#15181d);color:var(--dgn-muted,rgba(245,241,232,.8))}
.dgn-bots .hp span:first-child{margin-left:0}.dgn-bots .hp svg{width:60%;height:60%}
.dgn-bots small{font-size:12px;line-height:1.35;color:var(--dgn-muted,rgba(245,241,232,.7))}
.dgn-btn.cd{position:relative;overflow:hidden;flex-direction:column;gap:2px}
.dgn-btn.cd .cdt{display:block;font-size:11.5px;font-weight:600;opacity:.9}
.dgn-btn.cd .bar{position:absolute;left:0;bottom:0;height:4px;width:100%;background:rgba(255,255,255,.7);transform-origin:left;transform:scaleX(1)}
.dgn-stack{display:grid;gap:10px}
/* v5: voice tray players, report */
.dgn-tray{max-height:min(78vh,78dvh);overflow:auto;overscroll-behavior:contain}
.dgn-vlist{display:grid;gap:6px;margin-top:2px}
.dgn-vp{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 8px;border-radius:12px;background:var(--dgn-bg2,#1d2128);border:1px solid var(--dgn-line,rgba(255,255,255,.08))}
.dgn-vp .av{width:30px;height:30px;border-radius:50%;overflow:hidden;flex:none;display:grid;place-items:center;background:var(--dgn-soft,rgba(255,255,255,.1));font-weight:800;font-size:13px}
.dgn-vp .av svg{width:100%;height:100%;display:block}
.dgn-vp b{flex:1;min-width:0;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dgn-vp .ms{width:16px;height:16px;flex:none;opacity:.75;display:grid;place-items:center}.dgn-vp .ms svg{width:16px;height:16px}
.dgn-vp .dgn-btn.sm{min-height:36px;padding:4px 9px;font-size:12.5px}
.dgn-vp .dgn-btn.sm[aria-pressed="true"]{background:var(--dgn-bad,#E5604D);color:#fff;border-color:transparent}
.dgn-rr{display:grid;gap:6px;margin:6px 0 10px}
.dgn-rr label{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;border-radius:12px;background:var(--dgn-bg2,#1d2128);font-weight:700;font-size:14px;cursor:pointer}
.dgn-rr input{accent-color:var(--dgn-acc,#E5604D);width:18px;height:18px;flex:none}
.dgn-ta{width:100%;min-height:64px;border-radius:12px;border:1px solid var(--dgn-line,rgba(255,255,255,.14));background:var(--dgn-bg2,#1d2128);color:inherit;font-weight:500;font-size:14px;line-height:1.4;font-family:var(--dgn-font,inherit);padding:10px 12px;resize:vertical;outline:none}
.dgn-chk{display:flex;align-items:center;gap:8px;font-size:13.5px;margin:10px 0 14px;font-weight:600}
@media (prefers-reduced-motion:reduce){.dgn *{animation:none!important;transition:none!important}.dgn-ring{transition:none!important}}
`;

/* ======================================================================================== */
function create(cfg){
 cfg=cfg||{};
 const GAME=String(cfg.game||'game').toLowerCase().replace(/[^a-z0-9]/g,'');
 const NS=nsFor(GAME,cfg.v||1),TEST=NS.indexOf('/test-')>0;
 const MIN=Math.max(2,cfg.min|0||2),MAX=Math.max(MIN,cfg.max|0||MIN);
 const TITLE=cfg.title||'the game';
 /* v5: computer seats (Quick Match); off unless the game opts in, so older games keep today's behaviour */
 const CPU=!!cfg.cpu,QSIZE=Math.max(MIN,Math.min(MAX,cfg.quickSize|0||MAX));
 const PH=Array.isArray(cfg.phrases)&&cfg.phrases.length?cfg.phrases.slice(0,12):PHRASES;
 const myId=cfg.id||pid();
 const NET_ERR='Can’t reach the game server. If you’re on office or school Wi-Fi, try mobile data.';
 const AFK_MSG=cfg.afkText||'You were away for 2 turns in a row, so the computer took your seat. You can’t rejoin this match.';
 const LEFT_REJOIN='You left this match, so you can’t rejoin it. You can join the next one.';
 const AFK_REJOIN='You were away for 2 turns, so you can’t rejoin this match.';

 let net=null,pool=null,poolT=null,srv='checking',run=0,role=null,T=null,V=null,BK=null,skew=0,hostAway=false;
 const skews=[];const lobby={},poolSeen={};
 const R={};

 /* ---------------- helpers ---------------- */
 const meInfo=()=>{let m={};try{m=cfg.me?cfg.me()||{}:{};}catch(e){}return{name:cleanName(lockedName(cleanName(m.name))),look:validLook(m.look)};};
 /* the hub's name field: registered players keep their username; a guest can't take a registered one */
 function setNameSafe(raw){let v=cleanName(raw);if(!v||!cfg.setName)return;
  if(regName()&&!testName()&&v.toLowerCase()!==regName()){v=lockedName(v);toast('Your name is your username.');const e=$i('dgnName');if(e)e.value=v;}
  else if(!regName()&&!testName()&&unameKey(v)){if(guestTaken(v)){toast('That name is registered. Log in or pick another.',4500);return;}
   /* not checked yet: keep it for now, and put the old name back if it turns out to be registered */
   const prev=meInfo().name;
   unameTaken(v).then(t=>{if(!t||regName())return;if(meInfo().name===v){try{cfg.setName(prev);}catch(x){}}
    toast('That name is registered. Log in or pick another.',4500);const e=$i('dgnName');if(e&&cleanName(e.value)===v){e.value=prev;e.focus();}});}
  try{cfg.setName(v);}catch(x){}}
 function validLook(l){if(!l||typeof l!=='object')return null;try{const s=JSON.stringify(l);return s.length<=3000?JSON.parse(s):null;}catch(e){return null;}}
 const seatOf=id=>T&&T.players?T.players.find(p=>p.id===id):null;
 const seated=id=>{const s=seatOf(id);return !!s&&!s.gone;};
 const nameOf=id=>{const s=seatOf(id)||(T&&T.wait||[]).find(p=>p.id===id);return s?s.name:'';};
 /* computer seats count as free: a newcomer can take one */
 const isCpuP=p=>!!(p&&p.cpu);
 const humanSeats=()=>T&&T.players?T.players.filter(p=>!p.gone&&!p.cpu):[];
 const cpuSeats=()=>T&&T.players?T.players.filter(p=>!p.gone&&p.cpu):[];
 const freeSeats=()=>Math.max(0,MAX-humanSeats().length-T.wait.length);
 function cpuMake(){const taken=new Set(T.players.map(p=>String(p.name||'').toLowerCase()));let o=null;
  if(cfg.cpuSeat){try{o=cfg.cpuSeat(T.players.length,[...taken]);}catch(e){console.error(e);}}
  let name=o&&cleanName(o.name);if(!name||taken.has(name.toLowerCase()))name=CPU_NAMES.find(n=>!taken.has(n.toLowerCase()))||('Computer '+(T.players.length+1));
  let id;do{id='cpu'+rid(3);}while(T.players.some(p=>p.id===id));
  return{id,name,look:o?validLook(o.look):null,cpu:1};}
 function cpuFill(k){if(!T)return 0;let a=0;while(T.players.length<Math.min(MAX,k)){T.players.push(cpuMake());a++;}return a;}
 function noteSkew(hostNow){skews.push(hostNow-Date.now());if(skews.length>20)skews.shift();skew=Math.max.apply(null,skews);}
 function netOK(){if(window.WebSocket&&window.crypto&&crypto.subtle&&window.TextEncoder)return true;toast('This browser can’t play online. Try Chrome or Safari.',5000);return false;}
 let wake=null;
 async function keepAwake(on){try{if(on){if(!wake&&!document.hidden&&navigator.wakeLock){const w=await navigator.wakeLock.request('screen');wake=w;w.addEventListener('release',()=>{if(wake===w)wake=null;});}}else if(wake){const w=wake;wake=null;await w.release();}}catch(e){}}
 function optsKey(){return 'dgn-opt-'+GAME;}
 function defOpts(){const o={};let saved={};try{saved=JSON.parse(ls.get(optsKey())||'{}')||{};}catch(e){}
  (cfg.options||[]).forEach(op=>{const ok=v=>op.choices.some(c=>String(c[0])===String(v));o[op.k]=ok(saved[op.k])?op.choices.find(c=>String(c[0])===String(saved[op.k]))[0]:op.def;});return o;}

 /* ---------------- lobby watcher (hub + Quick Match) ---------------- */
 function srvSet(v){if(srv!==v){srv=v;updHubLive();}}
 function warm(){if(net||!window.WebSocket)return;
  if(!pool){pool=makeClients(null);const p0=pool;p0.forEach(o=>o.onUp2=()=>srvSet('ok'));anyUp(p0,10000).then(v=>{if(!v&&pool===p0&&srv!=='ok')srvSet('fail');});}
  const p=pool;p.forEach(o=>{o.h=onPoolMsg;o.subs=()=>[NS+'lobby/+'];if(o.ok)o.c.subscribe([NS+'lobby/+']);});
  clearTimeout(poolT);poolT=setTimeout(()=>{if(pool!==p)return;if(UI.hubOn||UI.quickOn){warm();return;}p.forEach(o=>{try{o.c.end();}catch(e){}});pool=null;},5*60*1000);}
 function takeClients(subs,h){clearTimeout(poolT);const cl=pool||makeClients(null);pool=null;cl.forEach(o=>{try{o.c.unsubscribe([NS+'lobby/+']);}catch(e){}o.subs=subs;o.h=h;o.onUp2=null;if(o.ok){const t=subs();if(t.length)o.c.subscribe(t);}});return cl;}
 function onPoolMsg(o,topic,m){if(topic.indexOf(NS+'lobby/')===0){onLobbyMsg(topic,m);return;}const mm=/\/([A-Z]{4})\/i$/.exec(topic);if(mm&&m&&m.host)poolSeen[mm[1]]=m;}
 function onLobbyMsg(topic,m){const code=topic.slice((NS+'lobby/').length);if(!/^[A-Z]{4}$/.test(code))return;
  if(!m||!m.t)delete lobby[code];
  else{const cur=lobby[code];if(!cur||+m.t>=cur.t)lobby[code]={code,name:cleanName(m.name)||'Player',n:clampInt(m.n,1,12),mx:clampInt(m.mx||MAX,2,12),t:+m.t,c:+m.c||+m.t,
   status:m.status==='lobby'?'lobby':'playing',q:!!m.q,host:String(m.host||'').slice(0,24),vw:clampInt(m.vw,0,999),f:clampInt(m.f,0,12),cp:clampInt(m.cp,0,12),info:String(m.info||'').slice(0,60),
   ids:Array.isArray(m.ids)?m.ids.slice(0,12).map(x=>String(x).slice(0,24)):[]};}
  updLists();quickCheck();}
 const fresh=x=>Math.abs(Date.now()-x.t)<STALE_MS&&x.host!==myId;
 function openTables(){return Object.values(lobby).filter(x=>x.status==='lobby'&&x.n<x.mx&&fresh(x)).sort((a,b)=>b.n-a.n||b.t-a.t);}
 function liveTables(){return Object.values(lobby).filter(x=>x.status==='playing'&&fresh(x)).sort((a,b)=>b.f-a.f||b.vw-a.vw||b.t-a.t);}

 /* ---------------- connection teardown ---------------- */
 function closeNet(o){o=o||{};const n=net;net=null;if(!n)return;(n.timers||[]).forEach(t=>clearInterval(t));clearTimeout(n.failT);clearTimeout(n.bkT);
  if(n.role==='host'&&n.code&&!n.superseded)(n.clients||[]).forEach(c=>{try{if(n.listed)c.c.publish(NS+'lobby/'+n.code,'',true);if(!o.keepInfo)c.c.publish(NS+n.code+'/i','',true);}catch(e){}});
  (n.clients||[]).forEach(c=>{c.h=null;c.onUp2=null;});
  setTimeout(()=>{(n.clients||[]).forEach(c=>{try{c.c.end();}catch(e){}});},n.role==='host'?700:300);}
 function endSession(kind,msg){run++;vcStop();closeNet();clearTimeout(syncT);syncT=0;role=null;T=null;V=null;BK=null;hostAway=false;keepAwake(false);hideAll();
  try{cfg.onEnd&&cfg.onEnd(kind||'left',msg||'');}catch(e){console.error(e);}
  if(kind==='afk')notice('You were away',AFK_MSG);else if(msg)toast(msg,5000);}

 /* ================= HOST ================= */
 async function hostNet(code,o){const keys=await newKeys();
  const n={role:'host',code,kp:keys.kp,pub:keys.pub,players:new Map(),timers:[],clients:[],isPublic:!!o.pub,quick:!!o.quick,created:o.created||Date.now(),
   banned:new Set(),ep:o.ep|0,listed:false,lsent:0,last:{},strikes:{},chatAt:{},bkAt:0,autoAt:0,autoK:0,overAt:0,wokeAt:0};
  /* Last Will: if this connection dies without a goodbye, the broker wipes the table's retained info */
  n.clients=makeClients({topic:NS+code+'/i',payload:''});
  n.clients.forEach(c=>{c.subs=()=>[NS+code+'/h',NS+code+'/i'].concat(n.quick?[NS+'lobby/+']:[]);c.h=onHostMsg;});net=n;
  const up=await anyUp(n.clients,10000);if(net!==n)return null;if(!up){closeNet();return null;}
  n.info=()=>{if(net!==n)return;n.clients.forEach(c=>pub(c,NS+code+'/i',{v:1,host:myId,pub:n.pub,t:Date.now(),ep:n.ep,since:n.created},true));};
  n.clients.forEach(c=>c.onUp2=()=>{n.info();updListing(true);});n.info();
  n.timers.push(setInterval(n.info,INFO_MS),setInterval(()=>updListing(true),LIST_MS),setInterval(hostWatch,2000));
  if(CPU&&n.quick)n.timers.push(setInterval(quickTick,250));
  return n;}
 function localGuard(o){if(LOCAL&&!TEST&&(o.pub||o.quick)){toast('On localhost, add ?ns=test1 to the address to test public tables and Quick Match.',6000);return false;}return true;}
 async function hostCreate(o){o=o||{};if(!netOK()||!localGuard(o))return false;const r=++run;vcStop();closeNet();role=null;T=null;
  if(!o.quick)showQuick('Creating your table…');
  warm();const up=pool?await anyUp(pool,10000):false;if(r!==run)return false;
  if(!up){srvSet('fail');hideQuick();toast(NET_ERR,5000);return false;}srvSet('ok');
  let code=null;
  for(let a=0;a<4&&!code;a++){const c=genCode();if(lobby[c])continue;delete poolSeen[c];const p=pool;if(!p)break;
   p.forEach(x=>{if(x.ok)x.c.subscribe([NS+c+'/i']);});await sleep(900);p.forEach(x=>{try{x.c.unsubscribe([NS+c+'/i']);}catch(e){}});
   if(r!==run)return false;const s=poolSeen[c];if(!s||!s.t||Date.now()-s.t>10*60*1000)code=c;}
  code=code||genCode();
  const p=pool;pool=null;clearTimeout(poolT);if(p)p.forEach(x=>{x.h=null;try{x.c.end();}catch(e){}});
  const n=await hostNet(code,{pub:!!o.pub,quick:!!o.quick});
  if(r!==run){if(n&&net===n)closeNet();return false;}
  if(!n){hideQuick();toast(NET_ERR,5000);return false;}
  const me=meInfo();role='host';hostAway=false;
  T={v:1,code,pub:!!o.pub,quick:!!o.quick,hostId:myId,ep:n.ep,created:n.created,status:'lobby',opts:defOpts(),
   players:[{id:myId,name:me.name||'Player',look:me.look}],wait:[],viewers:0,conn:[myId],mid:0,rev:1,note:null,autoAt:0};
  keepAwake(true);closeHub();hideQuick();enterLobby();sync();return true;}
 function updListing(force){const n=net;if(!n||n.role!=='host'||!T)return;const topic=NS+'lobby/'+n.code;
  const here=humanSeats().length,live=T.status!=='lobby',inRoom=T.players.filter(p=>!p.cpu).length;
  const show=n.isPublic&&(live||inRoom<MAX);
  if(show){const now=Date.now();if(!force&&now-n.lsent<1500){clearTimeout(n.lT);n.lT=setTimeout(()=>updListing(true),1600);return;}n.lsent=now;
   const h=T.players.find(p=>p.id===T.hostId)||T.players[0]||{};let info='';try{info=cfg.listInfo?String(cfg.listInfo(T)||''):'';}catch(e){}
   const msg={v:1,code:n.code,name:h.name,n:live?here:inRoom,mx:MAX,t:now,c:n.created,status:live?'playing':'lobby',q:n.quick,host:myId,vw:T.viewers|0,
    f:live?freeSeats():Math.max(0,MAX-inRoom),cp:cpuSeats().length,info:info.slice(0,60),ids:humanSeats().map(p=>p.id).slice(0,12)};
   n.listed=true;n.clients.forEach(c=>pub(c,topic,msg,true));}
  else if(n.listed){n.listed=false;n.clients.forEach(c=>{try{if(c.ok)c.c.publish(topic,'',true);}catch(e){}});}}
 async function sendTo(tp,pl,obj){const n=net;if(!n||n.role!=='host'||!pl||!pl.key)return;try{const m=await seal(pl.key,obj);let o=n.clients[pl.bi];if(!o||!o.ok)o=n.clients.find(x=>x.ok);pub(o,NS+n.code+'/p/'+tp,m);}catch(e){}}
 const sendToId=(id,obj)=>{const n=net;if(!n)return;n.players.forEach((pl,tp)=>{if(pl.pid===id)sendTo(tp,pl,obj);});};
 function connIds(){const n=net,now=Date.now();return T.players.filter(p=>p.id===myId||(!p.gone&&n&&n.last[p.id]&&now-n.last[p.id]<8000)).map(p=>p.id);}
 function viewers(){const n=net;if(!n||!T)return 0;const ids=new Set();n.players.forEach(pl=>{if(pl.pid&&!seated(pl.pid))ids.add(pl.pid);});return ids.size;}
 let syncT=0,syncAt=0;
 function sync(){if(role!=='host'||!net||syncT)return;syncT=setTimeout(flush,Math.max(0,60-(Date.now()-syncAt)));}
 function flush(){syncT=0;syncAt=Date.now();const n=net;if(role!=='host'||!n||!T)return;
  T.rev=(T.rev|0)+1;T.conn=connIds();T.viewers=viewers();
  if(T.status==='lobby'&&cfg.lobbyFix){try{cfg.lobbyFix(T);}catch(e){console.error(e);}}
  n.players.forEach((pl,tp)=>{if(pl.pid)sendState(tp,pl);});
  updListing(false);backups();renderRoom();updDock();}
 function sendState(tp,pl){let s=null;if(T.status!=='lobby'&&cfg.view){try{s=cfg.view(pl.pid,!seated(pl.pid));}catch(e){console.error(e);}}
  sendTo(tp,pl,{k:'state',m:T,s,now:Date.now()});}
 /* the first two successors keep a full copy so a board game can carry on if the host vanishes */
 function backups(){const n=net;if(!cfg.backup||!n||!T||T.status==='lobby')return;const now=Date.now();
  if(now-n.bkAt<BK_MS){if(!n.bkT)n.bkT=setTimeout(()=>{n.bkT=0;backups();},BK_MS-(now-n.bkAt)+20);return;}n.bkAt=now;
  let b=null;try{b=cfg.backup();}catch(e){console.error(e);return;}if(b==null)return;
  successors(2).forEach(id=>sendToId(id,{k:'bk',b,rev:T.rev}));}
 function successors(k){const P=T.players,N=P.length,hi=Math.max(0,P.findIndex(p=>p.id===myId)),c=connIds(),out=[];
  for(let i=1;i<N&&out.length<k;i++){const p=P[(hi+i)%N];if(p.id!==myId&&!p.gone&&!p.cpu&&c.includes(p.id))out.push(p.id);}return out;}
 function nextHost(){if(!T)return null;if(role==='host')return successors(1)[0]||null;return null;}
 function hostWatch(){const n=net;if(!n||role!=='host'||!T)return;const now=Date.now();let ch=false;
  if(!document.hidden&&now-(n.wokeAt||0)>15000){
   T.players.slice().forEach(p=>{if(p.id===myId||p.gone||p.cpu)return;const t=n.last[p.id]||(n.last[p.id]=now);if(now-t>AWAY_MS)drop(p.id,'lost');});
   n.players.forEach((pl,tp)=>{if(pl.pid&&!seated(pl.pid)&&now-(pl.seen||0)>AWAY_MS){n.players.delete(tp);ch=true;}});}
  const alive=id=>[...n.players.values()].some(pl=>pl.pid===id);const w=T.wait.filter(x=>alive(x.id));if(w.length!==T.wait.length){T.wait=w;ch=true;}
  if(viewers()!==(T.viewers|0))ch=true;
  if(T.status==='lobby'&&T.quick&&!CPU){const k=T.players.length;
   if(k>=MIN){if(!n.autoAt||n.autoK!==k){n.autoAt=now+(k>=MAX?QUICK_FULL:QUICK_WAIT);n.autoK=k;T.autoAt=n.autoAt;ch=true;}else if(now>=n.autoAt){n.autoAt=0;start();return;}}
   else if(n.autoAt){n.autoAt=0;n.autoK=0;T.autoAt=0;ch=true;}}
  if(T.status==='over'&&T.quick&&n.overAt&&now-n.overAt>QUICK_AGAIN){again();return;}
  if(ch)sync();}
 /* v5 Quick Match waiting room (host): search ~12 s, then offer computer players (they start by itself after 5 s).
    A full table of people starts after 3 s; a rematch that already has computer seats starts after 6 s. */
 function quickTick(){const n=net;if(!n||role!=='host'||!T||!T.quick||T.status!=='lobby'||!CPU)return;const now=Date.now();
  const hum=T.players.filter(p=>!p.cpu).length,tot=T.players.length,cpus=tot-hum;let ch=false;
  if(hum>=QSIZE||(cpus&&tot>=QSIZE&&!n.qAsk)){const want=hum>=QSIZE?QUICK_FULL:QUICK_REFILL;
   if(!n.autoAt||n.autoK!==tot*100+hum){n.autoAt=now+want;n.autoK=tot*100+hum;T.autoAt=n.autoAt;n.qAsk=0;T.qAsk=0;ch=true;}
   else if(now>=n.autoAt){n.autoAt=0;start();return;}}
  else{if(n.autoAt){n.autoAt=0;n.autoK=0;T.autoAt=0;ch=true;}
   if(!n.qEnd){n.qEnd=now+QUICK_SEARCH;T.qEnd=n.qEnd;ch=true;}
   if(!n.qAsk&&now>=n.qEnd){n.qAsk=now+QUICK_ASK;T.qAsk=n.qAsk;ch=true;}
   else if(n.qAsk&&now>=n.qAsk){quickBots();return;}}
  if(ch)sync();}
 /* fill the empty seats with computer players and start */
 function quickBots(){const n=net;if(!n||role!=='host'||!T||T.status!=='lobby')return;n.qAsk=0;T.qAsk=0;cpuFill(Math.max(QSIZE,MIN));start();}
 function quickWaitMore(){const n=net;if(!n||role!=='host'||!T||T.status!=='lobby')return;n.qAsk=0;T.qAsk=0;n.qEnd=Date.now()+QUICK_SEARCH;T.qEnd=n.qEnd;sync();}
 /* v5: a newcomer who waited takes a computer's seat (every waiter while seats last, or just into one seat) */
 function seatSwap(only){const n=net;if(role!=='host'||!n||!T||T.status==='over')return 0;let k=0;
  while(T.wait.length){const i=T.players.findIndex(p=>p.cpu&&!p.gone&&(!only||p.id===only));if(i<0)break;
   const w=T.wait[0],c=T.players[i];let ok=true;
   if(T.status!=='lobby'){if(!cfg.onSeatSwap)break;try{ok=cfg.onSeatSwap(c.id,{id:w.id,name:w.name,look:w.look})!==false;}catch(e){console.error(e);ok=false;}}
   if(!ok)break;
   T.wait.shift();T.players[i]={id:w.id,name:w.name,look:w.look};
   n.players.forEach(pl=>{if(pl.pid===w.id){pl.spec=false;pl.seen=Date.now();}});n.last[w.id]=Date.now();clearStrikes(w.id);
   note(w.name+' took a seat');toast(w.name+' took a seat');k++;if(only)break;}
  if(k){sync();updDock();}return k;}
 function handBreak(a){const n=net;if(role!=='host'||!n||!T)return 0;
  if(a===false){n.brk=false;return 0;}if(a===true)n.brk=true;
  return seatSwap(typeof a==='string'?a:null);}
 function mapConn(tp,pl,id,spec){const n=net;n.players.forEach((q,t2)=>{if(t2!==tp&&q.pid===id)n.players.delete(t2);});pl.pid=id;pl.spec=!!spec;pl.seen=Date.now();n.last[id]=Date.now();}
 function note(t){if(T)T.note={k:Math.max((T.rev|0)+1,((T.note&&T.note.k)|0)+1),t};}
 function drop(id,why){const n=net;if(!n||role!=='host'||!T||id===myId)return;
  n.players.forEach((pl,tp)=>{if(pl.pid===id)n.players.delete(tp);});delete n.last[id];
  const i=T.players.findIndex(p=>p.id===id);
  if(i<0){const nm=nameOf(id),w=T.wait.length;T.wait=T.wait.filter(x=>x.id!==id);if(w!==T.wait.length)note(nm+' left.');sync();return;}
  const p=T.players[i];if(p.gone||p.cpu)return;
  if(T.mic)delete T.mic[id];
  if(T.status==='lobby'){T.players.splice(i,1);note(p.name+' left the table.');sync();return;}
  p.gone=1;let t='';try{t=cfg.dropText?cfg.dropText(p.name,why):'';}catch(e){}
  note(t||(p.name+(why==='left'?' left.':' lost connection.')+' The computer takes their seat.'));
  try{cfg.onDrop&&cfg.onDrop(id,why);}catch(e){console.error(e);}
  sync();}
 /* AFK: the game reports each timed-out turn; 2 in a row and the seat goes to the AI */
 function strike(id){if(role!=='host'||!T||!net)return false;const p=seatOf(id);if(!p||p.gone||p.cpu)return false;const n=net;n.strikes[id]=(n.strikes[id]|0)+1;
  if(n.strikes[id]<AFK_TURNS)return false;n.strikes[id]=0;markAfk(id);return true;}
 function clearStrikes(id){if(net&&net.strikes)net.strikes[id]=0;}
 function markAfk(id){if(role!=='host'||!T||!net)return;const p=seatOf(id);if(!p||p.gone||p.cpu)return;p.gone=1;p.afk=1;if(T.mic)delete T.mic[id];
  let t='';try{t=cfg.dropText?cfg.dropText(p.name,'afk'):'';}catch(e){}note(t||(p.name+' is away. The computer takes their seat.'));
  if(id===myId){hostAway=true;notice('You were away',cfg.hostAfkText||'You missed 2 turns in a row, so the computer is playing your seat. You’ll leave the table when it’s done.');}
  else{const n=net;n.players.forEach((pl,tp)=>{if(pl.pid===id){sendTo(tp,pl,{k:'afk',m:AFK_MSG});n.players.delete(tp);}});}
  sync();}
 function kick(id){const n=net;if(!n||role!=='host'||!T||T.status!=='lobby'||id===myId)return;n.banned.add(id);
  sendToId(id,{k:'err',m:'The host removed you from this table.'});n.players.forEach((pl,tp)=>{if(pl.pid===id)n.players.delete(tp);});
  const i=T.players.findIndex(p=>p.id===id);if(i>=0)T.players.splice(i,1);sync();}
 function setPub(v){const n=net;if(!n||role!=='host'||!T||T.status!=='lobby'||T.quick)return;n.isPublic=!!v;T.pub=!!v;sync();updListing(true);}
 function setOpt(k,v){if(role!=='host'||!T||T.status!=='lobby'||T.quick)return;const op=(cfg.options||[]).find(o=>o.k===k);if(!op)return;const c=op.choices.find(c=>String(c[0])===String(v));if(!c)return;
  T.opts[k]=c[0];ls.set(optsKey(),JSON.stringify(T.opts));sync();}
 function start(){const n=net;if(role!=='host'||!n||!T||T.status!=='lobby')return;const seats=T.players.filter(p=>!p.gone);
  if(seats.length<MIN){toast('You need at least '+MIN+' players.');return;}
  T.players=seats;T.status='playing';T.mid=(T.mid|0)+1;T.autoAt=0;n.autoAt=0;n.strikes={};n.overAt=0;T.note=null;
  n.brk=false;n.qEnd=0;n.qAsk=0;T.qEnd=0;T.qAsk=0;hideRoom();closeQa();
  if(cfg.lobbyFix){try{cfg.lobbyFix(T);}catch(e){console.error(e);}}
  try{cfg.onStart&&cfg.onStart(seats.map(p=>p.cpu?{id:p.id,name:p.name,look:p.look,cpu:1}:{id:p.id,name:p.name,look:p.look}),clone(T.opts),{mid:T.mid,quick:T.quick,x:clone(T.x),cpu:seats.filter(p=>p.cpu).map(p=>p.id)});}catch(e){console.error(e);}
  sync();updDock();}
 function matchOver(){const n=net;if(role!=='host'||!n||!T||T.status!=='playing')return;T.status='over';n.overAt=Date.now();sync();}
 /* next match: everyone still seated plus the players who waited, up to the table size */
 function again(){const n=net;if(!T)return;if(role!=='host'){toast('Waiting for the host to start the next match…');return;}if(!n||T.status==='lobby')return;
  const keep=T.players.filter(p=>!p.gone).map(p=>p.cpu?{id:p.id,name:p.name,look:p.look,cpu:1}:{id:p.id,name:p.name,look:p.look});
  /* people who waited take computer seats first, then any empty seats */
  const wq=T.wait.slice();keep.forEach((p,i)=>{if(p.cpu&&wq.length){const w=wq.shift();keep[i]={id:w.id,name:w.name,look:w.look};}});
  const add=wq.slice(0,Math.max(0,MAX-keep.length));
  T.players=keep.concat(add);T.wait=wq.slice(add.length);T.status='lobby';T.autoAt=0;n.autoAt=0;n.autoK=0;n.overAt=0;n.strikes={};T.note=null;
  n.brk=false;n.qEnd=0;n.qAsk=0;T.qEnd=0;T.qAsk=0;
  if(CPU&&T.quick&&T.players.some(p=>p.cpu))cpuFill(QSIZE);
  n.players.forEach(pl=>{if(pl.pid&&seated(pl.pid))pl.spec=false;});
  const now=Date.now();T.players.forEach(p=>{if(p.id!==myId)n.last[p.id]=n.last[p.id]||now;});
  try{cfg.onLobby&&cfg.onLobby();}catch(e){console.error(e);}enterLobby();sync();}
 async function onHostMsg(o,topic,m,ret){const n=net;if(!n||n.role!=='host')return;
  if(topic.indexOf(NS+'lobby/')===0){onLobbyMsg(topic,m);return;}
  if(topic===NS+n.code+'/i'){
   /* wiped (an old host's Last Will fired late): put our info straight back */
   if(!m||!m.host){if(n.info)n.info();return;}
   /* someone else took over this table while we were cut off: bow out without touching their topics */
   if(m.host!==myId&&!ret){const ep=m.ep|0;if(ep>n.ep||(ep===n.ep&&m.host<myId)){n.superseded=true;endSession('moved','Your connection dropped and the table moved on without you.');}}return;}
  if(!m||topic!==NS+n.code+'/h'||typeof m.f!=='string'||!/^[0-9a-f]{8,40}$/.test(m.f)||!m.i||!m.c)return;
  let pl=n.players.get(m.f);
  try{if(!pl||!pl.key||(m.p&&m.p!==pl.pub)){if(!m.p)return;const key=await sharedKey(n.kp.privateKey,m.p);pl=n.players.get(m.f)||{pid:null};pl.key=key;pl.pub=m.p;n.players.set(m.f,pl);}
   const d=await unseal(pl.key,m);if(net!==n)return;pl.bi=o.bi;pl.seen=Date.now();onHostData(pl,m.f,d);}catch(e){}}
 function onHostData(pl,tp,d){const n=net;if(!T||!d||typeof d!=='object')return;
  if(d.k==='hello'){const id=String(d.id||'').slice(0,24),name=cleanName(d.name)||'Player',look=validLook(d.look);if(!id||id===myId)return;
   if(n.banned.has(id)){sendTo(tp,pl,{k:'err',m:'The host removed you from this table.'});return;}
   const seat=seatOf(id);
   if(seat){if(seat.gone){sendTo(tp,pl,{k:'err',m:seat.afk?AFK_REJOIN:LEFT_REJOIN});return;}mapConn(tp,pl,id,false);
    if(T.status==='lobby'){seat.name=name;seat.look=look;sync();}else sendState(tp,pl);return;}
   if(T.status==='lobby'&&!d.spec){const ci=T.players.findIndex(p=>p.cpu);
    if(ci>=0){mapConn(tp,pl,id,false);T.players[ci]={id,name,look};T.wait=T.wait.filter(q=>q.id!==id);note(name+' took a seat');toast(name+' took a seat');sync();return;}
    if(T.players.length>=MAX){sendTo(tp,pl,{k:'err',m:'That table is full.'});return;}
    mapConn(tp,pl,id,false);T.players.push({id,name,look});note(name+' joined.');sync();return;}
   if(!T.pub){sendTo(tp,pl,{k:'err',m:d.spec?'That table is private, so it can’t be watched.':'That match has already started. Private tables open again between matches.'});return;}
   const waiting=T.wait.some(q=>q.id===id);
   if(!waiting&&viewers()>=MAX_VIEW&&![...n.players.values()].some(q=>q.pid===id)){sendTo(tp,pl,{k:'err',m:'This table has too many viewers right now.'});return;}
   mapConn(tp,pl,id,true);
   if(!d.spec&&!waiting&&T.status!=='lobby'&&freeSeats()>0){T.wait.push({id,name,look});
    const cs=CPU&&cpuSeats().length>T.wait.length-1;note(cs?name+' is watching, and takes a computer’s seat at the next break.':name+' joins for the next match.');
    if(cs&&n.brk&&T.status==='playing'&&seatSwap(null)){sendState(tp,pl);return;}}
   sync();sendState(tp,pl);return;}
  if(!pl.pid){/* a ping on a fresh key after a host change: map it if that player is seated */
   const id=String(d.id||'').slice(0,24);if(!id)return;if(n.banned.has(id))return;const s=seatOf(id);if(!s||s.gone)return;mapConn(tp,pl,id,false);}
  const id=pl.pid;n.last[id]=Date.now();const seat=seatOf(id);
  if(seat&&seat.gone&&d.k!=='leave'){sendTo(tp,pl,seat.afk?{k:'afk',m:AFK_MSG}:{k:'err',m:LEFT_REJOIN});n.players.delete(tp);return;}
  switch(d.k){
   case 'ping':if((d.rev|0)!==(T.rev|0))sendState(tp,pl);else sendTo(tp,pl,{k:'pong'});return;
   case 'act':if(seat&&T.status!=='lobby'&&cfg.onAction){clearStrikes(id);try{cfg.onAction(id,d.a);}catch(e){console.error(e);}}return;
   case 'chat':relayChat(id,d.m);return;
   case 'rtc':{if(!seat)return;const to=String(d.to||'');if(to===myId)vcSignal(id,d.d);else if(seated(to))sendToId(to,{k:'rtc',f:id,d:d.d});return;}
   case 'look':if(seat&&T.status==='lobby'){seat.name=cleanName(d.name)||seat.name;seat.look=validLook(d.look);sync();}return;
   case 'lob':if(seat&&T.status==='lobby')lobbyMsg(id,d.d);return;
   case 'mic':if(seat&&!seat.gone){const on=!!d.on;T.mic=T.mic||{};if(!!T.mic[id]!==on){if(on)T.mic[id]=1;else delete T.mic[id];sync();}}return;
   case 'leave':n.players.delete(tp);drop(id,'left');if(!seat)sync();return;}}

 /* ================= JOINER ================= */
 async function joinSend(obj){const n=net;if(!n||n.role!=='join'||!n.key)return false;
  let o=n.clients[n.bi];if(!o||!o.ok)o=n.clients.find(x=>x.ok);if(!o)return false;
  try{const m=await seal(n.key,obj);m.f=n.topic;m.p=n.pub;return pub(o,NS+n.code+'/h',m);}catch(e){return false;}}
 const hello=()=>{const n=net,me=meInfo();return joinSend({k:'hello',id:myId,name:me.name||'Player',look:me.look,spec:n&&n.spec?1:0});};
 async function netJoin(code,o){o=o||{};if(!netOK()){o.onFail&&o.onFail('');return;}vcStop();closeNet();
  const keys=await newKeys();const n={role:'join',code,kp:keys.kp,pub:keys.pub,topic:rid(8),key:null,hostPub:null,hostId:null,ep:-1,bi:-1,last:0,ready:false,timers:[],clients:[],upSince:0,lostAt:0,spec:!!o.spec};net=n;
  n.fail=m=>{if(net!==n||n.ready)return;closeNet();if(o.onFail)o.onFail(m);else toast(m,5000);};
  n.clients=takeClients(()=>[NS+code+'/i',NS+code+'/p/'+n.topic],onJoinMsg);
  n.failT=setTimeout(()=>n.fail(!n.clients.some(c=>c.ok)?NET_ERR:n.hostPub?'The host isn’t answering. Ask them to keep the game open.':'No table found with code '+code+'.'),o.timeout||15000);
  anyUp(n.clients,10000).then(v=>{if(net!==n||n.ready)return;if(!v){srvSet('fail');n.fail(NET_ERR);}else{srvSet('ok');setTimeout(()=>{if(net===n&&!n.ready&&!n.hostPub)n.fail('No table found with code '+code+'. It may have closed, or the code is wrong.');},6500);}});
  n.timers.push(setInterval(()=>joinTick(n),PING_MS));}
 function joinTick(n){if(net!==n)return;const now=Date.now();if(n.clients.some(o=>o.ok)){if(!n.upSince)n.upSince=now;}else n.upSince=0;
  if(!n.ready){if(n.key)hello();return;}
  joinSend({k:'ping',rev:T?T.rev|0:0,id:myId});
  if(!n.lostAt&&n.upSince&&now-n.upSince>8000&&now-n.last>LOST_MS){n.lostAt=now;toast('Lost contact with the host…');}
  if(n.lostAt){if(!T||T.status==='over'&&!seated(myId)){endSession('closed','The host left the table.');return;}
   const r=myRank();if(r<0){if(now-n.lostAt>MIG_GIVEUP)endSession('lost','Lost the connection to the table.');return;}
   if(now-n.lostAt>MIG_GIVEUP){endSession('lost','Lost the connection to the table.');return;}
   if(now-n.lostAt>=r*MIG_STEP+1500)becomeHost();}}
 /* who takes over when the host is gone: the next connected player after the host, in seat order */
 function myRank(){if(!T||!seated(myId))return -1;const P=T.players,N=P.length,hi=P.findIndex(p=>p.id===T.hostId),c=[];
  for(let k=1;k<=N;k++){const p=P[((hi<0?0:hi)+k)%N];if(p.id===T.hostId||p.gone||p.cpu)continue;if(T.conn&&!T.conn.includes(p.id)&&p.id!==myId)continue;if(!c.includes(p.id))c.push(p.id);}return c.indexOf(myId);}
 async function onJoinMsg(o,topic,m,ret){const n=net;if(!n||n.role!=='join')return;
  if(topic===NS+n.code+'/i'){
   if(!m||!m.pub||!m.host){if(n.ready&&!n.lostAt)n.lostAt=Date.now();return;}   /* host info wiped: the host is gone */
   if(m.host===myId)return;
   if(m.pub===n.hostPub){if(!ret){n.last=Date.now();n.lostAt=0;}if(n.bi<0||!n.clients[n.bi]||!n.clients[n.bi].ok)n.bi=o.bi;return;}
   const ep=m.ep|0;if(n.hostPub&&ep<=n.ep)return;
   n.hostPub=m.pub;n.hostId=m.host;n.ep=ep;n.bi=o.bi;n.key=null;
   let key;try{key=await sharedKey(n.kp.privateKey,m.pub);}catch(e){return;}if(net!==n||n.hostPub!==m.pub)return;
   n.key=key;n.last=Date.now();n.lostAt=0;hello();return;}
  if(topic!==NS+n.code+'/p/'+n.topic||!n.key||!m)return;
  let d;try{d=await unseal(n.key,m);}catch(e){return;}if(net!==n||!d||typeof d!=='object')return;
  n.bi=o.bi;n.last=Date.now();
  if(d.k==='err'){if(!n.ready){n.fail(String(d.m||'Couldn’t join that table.'));return;}endSession('kicked',String(d.m||''));return;}
  if(d.k==='afk'){endSession('afk');return;}
  if(d.k==='bye'){if(d.next===myId&&T&&seated(myId)){becomeHost();return;}if(d.mig||d.next){n.lostAt=Date.now();return;}endSession('closed','The host closed the table.');return;}
  if(d.k==='state'){applyState(d);return;}
  if(!n.ready)return;
  if(d.k==='chat'){showChat(String(d.p||''),d.m|0);return;}
  if(d.k==='rtc'){vcSignal(String(d.f||''),d.d);return;}
  if(d.k==='bk'){BK=d.b;return;}
  if(d.k==='tell'){try{cfg.onTell&&cfg.onTell(d.d);}catch(e){console.error(e);}return;}}
 function applyState(d){const n=net,m=d.m;if(!m||typeof m!=='object'||!Array.isArray(m.players))return;
  if(T&&T.code===m.code&&(m.ep|0)===(T.ep|0)&&(m.rev|0)<=(T.rev|0))return;
  if(typeof d.now==='number')noteSkew(d.now);
  const prev=T;T=m;T.wait=T.wait||[];V=d.s;
  if(!n.ready){n.ready=true;clearTimeout(n.failT);role='join';keepAwake(true);hideQuick();closeHub();
   try{const u=new URL(location.href);if(u.searchParams.has('t')){u.searchParams.delete('t');history.replaceState(history.state,'',u.pathname+u.search+u.hash);}}catch(e){}}
  const me=seatOf(myId);
  if(me&&me.gone){endSession(me.afk?'afk':'left',me.afk?'':LEFT_REJOIN);return;}
  if(T.note&&T.note.t&&(!prev||!prev.note||prev.note.k!==T.note.k))toast(T.note.t);
  if(T.status==='lobby'){if(prev&&prev.status!=='lobby'){try{cfg.onLobby&&cfg.onLobby();}catch(e){console.error(e);}}enterLobby();}
  else{hideRoom();try{cfg.onState&&cfg.onState(V,T,{spec:!seated(myId),waiting:T.wait.some(w=>w.id===myId)});}catch(e){console.error(e);}}
  updDock();}
 /* host migration: rebuild the table from the last state (and backup), with a higher epoch */
 async function becomeHost(){const n=net;if(!n||n.role!=='join'||n.promoting||!T)return;n.promoting=true;
  const M=clone(T),old=M.hostId,lastV=V,bk=BK,oldSkew=skew;
  const oldCl=n.clients;n.timers.forEach(clearInterval);clearTimeout(n.failT);oldCl.forEach(c=>{c.h=null;c.onUp2=null;});net=null;
  const h=await hostNet(M.code,{ep:Math.max(n.ep|0,M.ep|0)+1,pub:!!M.pub,quick:!!M.quick,created:M.created});
  setTimeout(()=>oldCl.forEach(c=>{try{c.c.end();}catch(e){}}),600);
  if(!h){endSession('lost','Lost the connection to the table.');return;}
  role='host';const oi=M.players.findIndex(p=>p.id===old);let wasSeated=false;
  if(oi>=0){if(M.status==='lobby')M.players.splice(oi,1);else if(!M.players[oi].gone){M.players[oi].gone=1;wasSeated=true;}}
  const oldName=(T.players.find(p=>p.id===old)||{}).name||'The host';
  M.hostId=myId;M.ep=h.ep;M.rev=(M.rev|0)+100;M.wait=M.wait||[];T=M;
  const now=Date.now();T.players.forEach(p=>{if(p.id!==myId&&!p.gone&&!p.cpu)h.last[p.id]=now;});if(T.mic)delete T.mic[old];
  note(oldName+' left. '+(meInfo().name||'You')+' is the host now.');
  toast('The host left, so you are the host now.');
  if(T.status==='lobby'||!cfg.onMigrate){if(T.status!=='lobby'){T.status='lobby';try{cfg.onLobby&&cfg.onLobby();}catch(e){}}enterLobby();sync();return;}
  /* skew: the old host's clock minus ours; subtract it from the old host's timestamps */
  try{cfg.onMigrate({view:lastV,backup:bk,oldHost:old,meta:T,skew:oldSkew});}catch(e){console.error(e);}
  if(wasSeated){try{cfg.onDrop&&cfg.onDrop(old,'left');}catch(e){console.error(e);}}
  if(T.status==='over')h.overAt=now;
  sync();updDock();}

 /* ================= COMMON ================= */
 async function leave(o){o=o||{};const n=net;if(!n&&!role){endSession(o.afk?'afk':'left');return;}run++;
  if(role==='host'&&n){const nx=nextHost();const jobs=[];n.players.forEach((pl,tp)=>{if(pl.pid)jobs.push(sendTo(tp,pl,nx?{k:'bye',mig:1,next:nx}:{k:'bye'}));});
   await Promise.race([Promise.all(jobs),sleep(800)]);closeNet({keepInfo:!!nx});}
  else if(n&&n.role==='join'){await Promise.race([joinSend({k:'leave'}),sleep(600)]);closeNet();}
  else closeNet();
  endSession(o.afk?'afk':'left');}
 function wakeUp(){const n=net;if(!n)return;keepAwake(true);n.wokeAt=Date.now();(n.clients||[]).forEach(o=>{try{if(!o.c.connected)o.c.reconnect();}catch(e){}});
  if(n.role==='join'&&n.ready)joinSend({k:'ping',rev:T?T.rev|0:0,id:myId});else if(n.role==='host')sync();}
 addEventListener('pagehide',()=>{const n=net;if(!n)return;
  if(n.role==='host'){const nx=nextHost();n.players.forEach((pl,tp)=>{if(pl.pid)sendTo(tp,pl,nx?{k:'bye',mig:1,next:nx}:{k:'bye'});});
   n.clients.forEach(c=>{try{if(n.listed)c.c.publish(NS+'lobby/'+n.code,'',true);if(!nx)c.c.publish(NS+n.code+'/i','',true);}catch(e){}});}
  else joinSend({k:'leave'});});
 addEventListener('pageshow',e=>{if(e.persisted&&net)endSession('left','You left the table.');});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){wakeUp();if(UI.hubOn&&!net)warm();presence();}else presenceOff();});
 addEventListener('online',()=>{if(net)wakeUp();});
 /* quick chat */
 function relayChat(id,mi){const n=net;if(!n||!T)return;const k=mi|0;if(!PH[k])return;if(!(seated(id)||T.wait.some(p=>p.id===id)))return;
  const now=Date.now();if(now-(n.chatAt[id]||0)<1200)return;n.chatAt[id]=now;showChat(id,k);n.players.forEach((pl,tp)=>{if(pl.pid)sendTo(tp,pl,{k:'chat',p:id,m:k});});}
 function sayChat(k){closeTray();if(!role||!T)return;if(role==='host')relayChat(myId,k);else joinSend({k:'chat',m:k|0});}
 /* waiting-room requests (e.g. "seat me here"): the host's game code decides, then everyone gets the new room */
 function lobbyMsg(id,obj){if(role!=='host'||!T||T.status!=='lobby'||!cfg.onLobbyMsg||!obj||typeof obj!=='object')return;
  try{cfg.onLobbyMsg(id,clone(obj));}catch(e){console.error(e);}sync();}
 function lobbySend(obj){if(!role||!T||T.status!=='lobby'||!seated(myId))return;if(role==='host')lobbyMsg(myId,obj);else joinSend({k:'lob',d:obj});}

 /* ---------------- Quick Match ---------------- */
 async function quickMatch(){if(!netOK()||!(await needNameOK())||!localGuard({quick:true}))return;const r=++run;vcStop();closeNet();role=null;T=null;closeHub();showQuick('Connecting…');warm();
  const up=pool?await anyUp(pool,10000):false;if(r!==run)return;
  if(!up){srvSet('fail');hideQuick();toast(NET_ERR,5000);return;}
  srvSet('ok');setQuick('Looking for an open table…');
  await sleep(Object.keys(lobby).length?400:1800);if(r!==run)return;tryQuick(r,new Set());}
 function tryQuick(r,tried){if(r!==run)return;if(!UI.quickOn)showQuick('Looking for an open table…');
  const l=openTables().filter(x=>!tried.has(x.code)).sort((a,b)=>(b.q-a.q)||(b.n-a.n)||(a.c-b.c));
  const lv=liveTables().filter(x=>x.f>0&&!tried.has(x.code)&&(!CPU||x.cp>0)).sort((a,b)=>(b.cp-a.cp)||(b.q-a.q));const x=l[0]||lv[0];
  if(x){tried.add(x.code);setQuick(l[0]?'Joining '+x.name+'’s table…':x.cp>0?'Joining '+x.name+'’s table. You take a computer’s seat at the next break…':'Joining '+x.name+'’s table. You play from the next match…');
   netJoin(x.code,{timeout:6500,onFail:()=>{if(r!==run)return;warm();setQuick('That table didn’t answer. Trying another…');setTimeout(()=>tryQuick(r,tried),600);}});}
  else{setQuick('No open tables. Starting one…');hostCreate({pub:true,quick:true}).then(ok=>{if(!ok&&r===run)hideQuick();});}}
 /* a lone Quick Match host merges into an older quick table if one shows up */
 function quickCheck(){const n=net;if(!n||role!=='host'||!n.quick||!T||T.status!=='lobby'||T.players.filter(p=>!p.cpu).length>1||n.merging)return;
  const other=openTables().filter(x=>x.q&&x.code!==n.code&&(x.c<n.created||(x.c===n.created&&x.code<n.code)))[0];if(!other)return;
  n.merging=true;const r=++run;vcStop();closeNet();role=null;T=null;hideRoom();showQuick('Joining '+other.name+'’s table…');
  setTimeout(()=>{if(r!==run)return;netJoin(other.code,{timeout:6500,onFail:()=>{if(r===run){warm();tryQuick(r,new Set([other.code]));}}});},200);}
 async function joinCode(code,o){o=o||{};code=String(code||'').toUpperCase().replace(/[^A-Z]/g,'');if(!/^[A-Z]{4}$/.test(code)){toast('Table codes are 4 letters.');return;}
  if(!o.spec&&!(await needNameOK()))return;const r=++run;role=null;T=null;closeHub();showQuick((o.spec?'Opening table ':'Joining table ')+code+'…');
  netJoin(code,{spec:!!o.spec,timeout:15000,onFail:m=>{if(r!==run)return;hideQuick();toast(m||'Couldn’t join that table.',5000);}});}
 /* needName, then (for a guest) wait for the registered-name check before sitting down */
 async function needNameOK(){if(!needName())return false;const n=meInfo().name;
  if(!regName()&&!testName()&&unameKey(n)&&(await unameTaken(n))){if(!UI.hubOn)openHub();toast('That name is registered. Log in or pick another.',4500);return false;}return true;}
 function needName(){const e=document.getElementById('dgnName');if(e){const v=cleanName(e.value);if(v)setNameSafe(v);}
  if(meInfo().name&&guestTaken(meInfo().name)){openHub();setTimeout(()=>{const i=document.getElementById('dgnName');if(i){i.focus();}},120);toast('That name is registered. Log in or pick another.',4500);return false;}
  if(meInfo().name)return true;openHub();setTimeout(()=>{const i=document.getElementById('dgnName');if(i){i.focus();}},120);toast('Choose a name first, so the others know who you are.');return false;}

 /* ================= VOICE (WebRTC, signalled through the table) ================= */
 const VC={peers:new Map(),stream:null,on:false,deaf:ls.get('dgn-deaf')==='1',ac:null,me:null,lv:{},code:null,box:null,lit:false,mute:new Set(),fake:null};
 const ICE=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
 /* v5: voice at Quick Match tables too for games with computer seats (mic off until tapped); older games keep friends-only */
 const vcTable=()=>!!role&&!!T&&(!T.quick||CPU)&&seated(myId);
 const vcHears=id=>!VC.deaf&&!VC.mute.has(id);
 /* tell the table whether my mic is on (T.mic, kept by the host) */
 function vcShare(){if(!role||!T||!seated(myId))return;const on=!!VC.on;
  if(role==='host'){T.mic=T.mic||{};if(!!T.mic[myId]!==on){if(on)T.mic[myId]=1;else delete T.mic[myId];sync();}}else joinSend({k:'mic',on:on?1:0});}
 const vcSupported=()=>!!window.RTCPeerConnection&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)&&window.isSecureContext!==false;
 const vcAvail=()=>vcTable()&&vcSupported();
 function vcSend(to,d){if(role==='host')sendToId(to,{k:'rtc',f:myId,d});else joinSend({k:'rtc',to,d});}
 function vcAC(){if(!VC.ac){const A=window.AudioContext||window.webkitAudioContext;if(A)try{VC.ac=new A();}catch(e){}}if(VC.ac&&VC.ac.state==='suspended')VC.ac.resume().catch(()=>{});return VC.ac;}
 function vcMeter(stream){const ac=vcAC();if(!ac)return null;try{const src=ac.createMediaStreamSource(stream),an=ac.createAnalyser();an.fftSize=512;an.smoothingTimeConstant=.5;src.connect(an);return{an,buf:new Uint8Array(an.fftSize),src};}catch(e){return null;}}
 function vcWait(pc){return new Promise(r=>{if(pc.iceGatheringState==='complete')return r();const t=setTimeout(r,2500);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);r();}});});}
 function vcAttach(p){if(!p.tr)return;const tk=VC.stream&&VC.on?VC.stream.getAudioTracks()[0]:null;p.tr.sender.replaceTrack(tk).catch(()=>{});}
 function vcPeer(id,offerer){let p=VC.peers.get(id);if(p)return p;
  const pc=new RTCPeerConnection({iceServers:ICE});
  if(!VC.box){VC.box=document.createElement('div');VC.box.hidden=true;document.body.appendChild(VC.box);}
  const au=document.createElement('audio');au.autoplay=true;au.setAttribute('playsinline','');VC.box.appendChild(au);
  p={pc,tr:offerer?pc.addTransceiver('audio',{direction:'sendrecv'}):null,au,meter:null,t:Date.now()};VC.peers.set(id,p);vcAttach(p);
  pc.ontrack=e=>{const st=(e.streams&&e.streams[0])||new MediaStream([e.track]);au.srcObject=st;au.muted=!vcHears(id);au.play().catch(()=>{});p.meter=vcMeter(st);};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')vcDrop(id);};
  return p;}
 function vcDrop(id){const p=VC.peers.get(id);if(!p)return;VC.peers.delete(id);try{p.pc.close();}catch(e){}try{p.au.srcObject=null;p.au.remove();}catch(e){}try{p.meter&&p.meter.src.disconnect();}catch(e){}delete VC.lv[id];}
 async function vcCall(id){const p=vcPeer(id,true);try{await p.pc.setLocalDescription(await p.pc.createOffer());await vcWait(p.pc);if(VC.peers.get(id)!==p)return;vcSend(id,{t:'offer',sdp:p.pc.localDescription.sdp});}catch(e){vcDrop(id);}}
 async function vcSignal(from,d){if(!vcAvail()||!d||!from||from===myId||!seated(from)||isCpuP(seatOf(from)))return;
  try{if(d.t==='offer'){vcDrop(from);const p=vcPeer(from,false);await p.pc.setRemoteDescription({type:'offer',sdp:String(d.sdp)});
    p.tr=p.pc.getTransceivers()[0];if(p.tr){p.tr.direction='sendrecv';vcAttach(p);}
    await p.pc.setLocalDescription(await p.pc.createAnswer());await vcWait(p.pc);if(VC.peers.get(from)!==p)return;vcSend(from,{t:'answer',sdp:p.pc.localDescription.sdp});}
   else if(d.t==='answer'){const p=VC.peers.get(from);if(p&&p.pc.signalingState==='have-local-offer')await p.pc.setRemoteDescription({type:'answer',sdp:String(d.sdp)});}}catch(e){vcDrop(from);}}
 function vcStop(){[...VC.peers.keys()].forEach(vcDrop);if(VC.stream){VC.stream.getTracks().forEach(t=>t.stop());VC.stream=null;}try{VC.me&&VC.me.src.disconnect();}catch(e){}VC.me=null;VC.on=false;VC.lv={};VC.code=null;
  if(window.__vcRec){window.__vcRec=false;try{if(navigator.audioSession)navigator.audioSession.type='ambient';}catch(e){}}vcUI();}
 function vcMicHelp(e){window.__vcRec=false;try{if(navigator.audioSession)navigator.audioSession.type='ambient';}catch(x){}const nm=(e&&e.name)||'Error';
  const ios=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),crios=/CriOS/.test(navigator.userAgent);
  if(nm==='NotReadableError'||nm==='AbortError'){toast('Your mic is busy. End any phone or WhatsApp call, then try again.',5000);return;}
  if(nm==='NotFoundError'||nm==='OverconstrainedError'){toast('No microphone found on this device.',4500);return;}
  const steps=ios?(crios?'<li>Open the iPhone <b>Settings</b> app → <b>Apps</b> → <b>Chrome</b>.</li><li>Turn <b>Microphone</b> on.</li><li>Come back and reload the game.</li>'
   :'<li>In Safari, tap the <b>page settings</b> button on the left of the address bar (or <b>aA</b>).</li><li>Tap <b>Website Settings</b> → <b>Microphone</b> → <b>Allow</b>.</li><li>Reload the game and tap the mic again.</li>')
   :'<li>Tap the <b>lock</b> or <b>settings</b> icon next to the address.</li><li>Set <b>Microphone</b> to <b>Allow</b>.</li><li>Reload the game and tap the mic again.</li>';
  notice('Allow the microphone',`<p>Your browser blocked the mic for this game. To talk:</p><ol>${steps}</ol><p style="font-size:12px">You can still hear everyone without a mic. (${esc(nm)})</p>`,true);}
 async function vcMic(){if(vcTable()&&!vcSupported()){const why=!window.isSecureContext?'this page isn’t opened over a secure (https) link':!window.RTCPeerConnection?'this browser can’t make voice calls':'this browser doesn’t allow microphone access';
   notice('Voice chat isn’t available here',`<p>Voice needs a browser that supports it, and ${why}. Update your browser, and open the game from its normal link, not inside WhatsApp, Instagram or Facebook.</p>`,true);return;}
  if(!vcAvail()){toast(T&&T.quick&&!CPU?'Voice chat is for friends tables, not Quick Match.':'Voice chat works for players at the table.');return;}
  vcAC();VC.peers.forEach(p=>{if(p.au.paused&&p.au.srcObject)p.au.play().catch(()=>{});});
  /* iPhone: an 'ambient' audio session forbids recording, so switch to play-and-record first */
  if(!VC.stream){window.__vcRec=true;try{if(navigator.audioSession)navigator.audioSession.type='play-and-record';}catch(e){}
   try{VC.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
   catch(e){if(e&&(e.name==='NotAllowedError'||e.name==='SecurityError')){vcMicHelp(e);return;}
    try{VC.stream=await navigator.mediaDevices.getUserMedia({audio:true});}catch(e2){vcMicHelp(e2);return;}}VC.me=vcMeter(VC.stream);}
  VC.on=!VC.on;VC.stream.getAudioTracks().forEach(t=>t.enabled=VC.on);VC.peers.forEach(vcAttach);
  toast(VC.on?'Mic on. Everyone at the table can hear you.':'Mic off.');vcShare();vcUI();}
 function vcDeaf(){VC.deaf=!VC.deaf;ls.set('dgn-deaf',VC.deaf?'1':'0');VC.peers.forEach((p,id)=>{p.au.muted=!vcHears(id);});toast(VC.deaf?'Voices muted.':'Voices on.');vcUI();}
 /* mute one player, only for me */
 function vcMute(id){if(!id||id===myId)return;if(VC.mute.has(id))VC.mute.delete(id);else VC.mute.add(id);const p=VC.peers.get(id);if(p)p.au.muted=!vcHears(id);
  toast((nameOf(id)||'Player')+(VC.mute.has(id)?' is muted for you.':' can be heard again.'));vcUI();}
 /* report a player (voice, chat, name…): Firestore "reports" (create-only), never from localhost or test tables; otherwise kept on this device */
 function openReport(id){const nm=nameOf(id)||'Player';
  notice('Report '+nm,`<p>Reports are private. We review them and act on repeated or serious ones.</p><div class="dgn-rr" role="radiogroup" aria-label="Reason">${REPORT_REASONS.map((r,i)=>`<label><input type="radio" name="dgnRr" value="${i}"${i?'':' checked'}><span>${esc(r)}</span></label>`).join('')}</div>
<label class="dgn-lbl" for="dgnRn" style="margin-top:4px">Anything else? (optional)</label><textarea class="dgn-ta" id="dgnRn" maxlength="300"></textarea>
<label class="dgn-chk"><input type="checkbox" id="dgnRm" checked> Also mute ${esc(nm)} for me</label>
<div class="dgn-two"><button class="dgn-btn" data-dgn="noteClose">Cancel</button><button class="dgn-btn pri" data-dgn="sendReport" data-id="${esc(id)}">Send report</button></div>`,true,true);}
 async function sendReport(id){const s=document.querySelector('input[name="dgnRr"]:checked'),reason=REPORT_REASONS[s?+s.value:0]||'Other';
  const rep={reason,note:String((($i('dgnRn')||{}).value||'')).replace(/[\u0000-\u001f<>]/g,' ').slice(0,300),targetId:String(id).slice(0,40),targetName:String(nameOf(id)||'').slice(0,20),
   byId:myId,byName:String(meInfo().name||'Player').slice(0,20),table:String(T?T.code:'').slice(0,8),mode:'net:'+GAME+(T&&T.quick?':quick':''),chat:[],t:Date.now()};
  const also=!!(($i('dgnRm')||{}).checked);closeNote();if(also&&!VC.mute.has(id))vcMute(id);
  let ok=false;if(!LOCAL&&!TEST){try{const a=await fbAuth(),f=a.f;try{if(a.auth.authStateReady)await a.auth.authStateReady();}catch(e){}const u=a.auth.currentUser||(await a.U.signInAnonymously(a.auth)).user;
   await f.F.addDoc(f.F.collection(f.db,'reports'),Object.assign({},rep,{uid:u.uid,at:f.F.serverTimestamp()}));ok=true;}catch(e){}}
  if(!ok){let q=[];try{q=JSON.parse(ls.get('dd-report-queue')||'[]');if(!Array.isArray(q))q=[];}catch(e){}q.push(rep);ls.set('dd-report-queue',JSON.stringify(q.slice(-20)));}
  toast(ok?'Report sent. Thank you for helping keep the games friendly.':'Report saved. It will be sent from Digu when you’re back online.',4000);}
 function vcUI(){const tbl=vcTable();document.querySelectorAll('[data-dgn="voice"]').forEach(b=>{b.hidden=!tbl;b.setAttribute('aria-pressed',String(VC.on));b.setAttribute('aria-label',VC.on?'Voice chat: your mic is on':'Voice chat: your mic is off');const h=VC.on?IC.micOn:IC.micOff;if(b._h!==h){b.innerHTML=h;b._h=h;}});
  const t=$i('dgnTray');if(t&&!t.hidden&&t.dataset.k==='voice')renderVoice();}
 function renderVoice(){const t=$i('dgnTray');t.dataset.k='voice';
  t.innerHTML=`<div class="th"><span>Voice chat</span><button class="dgn-x" data-dgn="trayClose" aria-label="Close">${IC.x}</button></div><div class="dgn-voice">
<button class="dgn-btn${VC.on?' pri':''}" data-dgn="mic" aria-pressed="${VC.on}">${VC.on?IC.micOn:IC.micOff}${VC.on?'Mic on · tap to turn off':'Turn on my mic'}</button>
<button class="dgn-btn" data-dgn="deaf" aria-pressed="${VC.deaf}">${VC.deaf?IC.spkOff:IC.spk}${VC.deaf?'Voices muted · tap to hear them':'Mute everyone’s voices'}</button>
<p class="dgn-hint" style="margin:2px 2px 0">Your mic stays off until you turn it on. Only the players at this table can hear you.</p>${vcPlayersHTML()}</div>`;}
 /* v5: everyone else at the table: mic on/off, mute for me, report */
 function vcPlayersHTML(){if(!T)return '';const ps=T.players.filter(p=>p.id!==myId&&!p.gone&&!p.cpu);if(!ps.length)return '';
  return `<span class="dgn-lbl" style="margin:8px 2px 0">At this table</span><div class="dgn-vlist">${ps.map(p=>{const m=VC.mute.has(p.id),on=!!(T.mic&&T.mic[p.id]);
   return `<div class="dgn-vp" data-pid="${esc(p.id)}"><span class="av">${av(p,30)}</span><b>${esc(p.name)}</b><span class="ms" role="img" aria-label="${on?'Mic on':'Mic off'}">${on?IC.micOn:IC.micX}</span><button class="dgn-btn sm" data-dgn="vmute" data-id="${esc(p.id)}" aria-pressed="${m}" aria-label="${m?'Unmute ':'Mute '}${esc(p.name)}">${m?IC.mute+'Muted':'Mute'}</button><button class="dgn-btn sm" data-dgn="vreport" data-id="${esc(p.id)}" aria-label="Report ${esc(p.name)}">${IC.flag}</button></div>`;}).join('')}</div>`;}
 function openVoice(){ensureUI();if(!vcTable()){toast(T&&T.quick&&!CPU?'Voice chat is for friends tables, not Quick Match.':'Voice chat works for players at the table.');return;}
  const t=$i('dgnTray');if(!t.hidden&&t.dataset.k==='voice'){closeTray();return;}t.hidden=false;renderVoice();} function vcLevel(m){if(!m)return 0;m.an.getByteTimeDomainData(m.buf);let s=0;for(let i=0;i<m.buf.length;i++){const v=(m.buf[i]-128)/128;s+=v*v;}return Math.min(1,Math.sqrt(s/m.buf.length)*5);}
 function avatarEl(id){let el=null;if(UI.roomOn){el=document.querySelector(`.dgn-plist li[data-pid="${CSS.escape(id)}"] .av,.dgn-st[data-pid="${CSS.escape(id)}"] .av`);}if(!el&&cfg.avatarEl){try{el=cfg.avatarEl(id);}catch(e){}}return el||null;}
 setInterval(()=>{if(!vcAvail()){if(VC.peers.size||VC.stream)vcStop();return;}
  if(VC.code&&VC.code!==T.code)vcStop();VC.code=T.code;
  const ids=T.players.filter(p=>p.id!==myId&&!p.gone&&!p.cpu).map(p=>p.id);
  [...VC.peers.keys()].forEach(id=>{if(!ids.includes(id))vcDrop(id);});
  ids.forEach(id=>{const p=VC.peers.get(id);if(!p){if(myId<id)vcCall(id);return;}
   const cs=p.pc.connectionState;if(myId<id&&cs!=='connected'&&Date.now()-p.t>15000){vcDrop(id);vcCall(id);}p.au.muted=!vcHears(id);});
  if(VC.on&&!(T.mic&&T.mic[myId]))vcShare();
  vcUI();},3000);
 document.addEventListener('pointerdown',()=>{if(!VC.peers.size)return;vcAC();VC.peers.forEach(p=>{if(p.au.paused&&p.au.srcObject)p.au.play().catch(()=>{});});},{passive:true,capture:true});
 /* v5 speaking ring: a .dgn-ring element around each seat avatar, scaled and faded with the voice level (~18 readings
    a second; it rises at once and fades about 0.3 s after the talking stops). Plus a crossed-out mic badge on anyone
    whose mic is off (or who I muted). Games re-render their seats, so the ring and badge are put back when missing. */
 const DECO=new WeakMap();
 function decoFor(el){let d=DECO.get(el);if(d&&d.ring.isConnected&&(d.inside?d.ring.parentNode===el:d.ring.parentNode===el.parentNode))return d;
  if(d){try{d.ring.remove();d.badge.remove();}catch(e){}}
  const cs=getComputedStyle(el),inside=cs.overflow==='visible'&&cs.overflowX==='visible'&&cs.overflowY==='visible'&&el.tagName!=='IMG'&&el.tagName!=='svg';
  const ring=document.createElement('span');ring.className='dgn-ring';ring.setAttribute('aria-hidden','true');
  const badge=document.createElement('span');badge.className='dgn-moff';badge.hidden=true;badge.innerHTML=IC.micX;
  if(inside){if(cs.position==='static')el.style.position='relative';el.appendChild(ring);el.appendChild(badge);}
  else{const par=el.parentNode;if(!par)return null;par.insertBefore(ring,el.nextSibling);par.insertBefore(badge,ring.nextSibling);}
  d={ring,badge,inside,lv:-1,b:null};DECO.set(el,d);return d;}
 function decoPlace(el,d){if(d.inside)return;const w=el.offsetWidth,h=el.offsetHeight,x=el.offsetLeft,y=el.offsetTop,k=x+','+y+','+w+','+h;if(d.k===k)return;d.k=k;
  Object.assign(d.ring.style,{inset:'auto',left:(x-5)+'px',top:(y-5)+'px',width:(w+10)+'px',height:(h+10)+'px'});
  const b=Math.max(14,Math.min(20,Math.round(w*.36)));Object.assign(d.badge.style,{left:(x+w-b+4)+'px',top:(y+h-b+3)+'px',right:'auto',bottom:'auto',width:b+'px',height:b+'px'});}
 function decoClear(){document.querySelectorAll('.dgn-ring,.dgn-moff').forEach(e=>e.remove());document.querySelectorAll('.dgn-talk').forEach(e=>e.classList.remove('dgn-talk'));}
 let vcTick=0;
 setInterval(()=>{const tbl=vcTable(),talk=!!T&&(VC.peers.size>0||VC.on||!!VC.fake);
  if(!T||!role||(!tbl&&!talk)){if(VC.lit){decoClear();VC.lit=false;}return;}
  const slow=(++vcTick%6)===0;VC.lit=true;
  T.players.forEach(q=>{if(q.cpu)return;const fk=VC.fake&&VC.fake[q.id];
   const raw=q.gone?0:fk!=null?+fk:q.id===myId?(VC.on?vcLevel(VC.me):0):(vcHears(q.id)?vcLevel((VC.peers.get(q.id)||{}).meter):0);
   const lv=VC.lv[q.id]=Math.max(raw,(VC.lv[q.id]||0)*.6);const el=avatarEl(q.id);if(!el||!el.isConnected)return;
   const d=decoFor(el);if(!d)return;if(slow||d.lv<0)decoPlace(el,d);
   const on=lv>.06;el.style.setProperty('--dgn-vl',lv.toFixed(2));if(el.classList.contains('dgn-talk')!==on)el.classList.toggle('dgn-talk',on);
   if(on||d.lv>.06){d.ring.classList.toggle('on',on);d.ring.style.transform=on?`scale(${(1+lv*.22).toFixed(3)})`:'scale(1)';d.ring.style.opacity=on?(.55+lv*.45).toFixed(2):'0';}
   d.lv=lv;
   /* crossed-out mic: their mic is off, or I muted them (only where voice is on for me) */
   const off=tbl&&!q.gone&&(q.id===myId?!VC.on:(!(T.mic&&T.mic[q.id])||VC.mute.has(q.id)));const b=off?(q.id===myId?'me':'x'):'';
   if(d.b!==b){d.b=b;d.badge.hidden=!off;d.badge.classList.toggle('dgn-me',b==='me');d.badge.title=!off?'':q.id===myId?'Your mic is off':VC.mute.has(q.id)?'Muted by you':'Mic off';}});},57);

 /* ================= PRESENCE ================= */
 let presT=0,presUid=null,countN=0,countAt=0;
 const presWrite=()=>PRESENCE.includes(GAME)&&!LOCAL&&!TEST&&cfg.presence!==false;
 async function presence(){if(!presWrite()||document.hidden)return;try{const a=await fbAuth(),f=a.f;
   try{if(a.auth.authStateReady)await a.auth.authStateReady();}catch(e){}
   const u=a.auth.currentUser||(await a.U.signInAnonymously(a.auth)).user;presUid=u.uid;
   await f.F.setDoc(f.F.doc(f.db,'presence',GAME,'users',u.uid),{t:f.F.serverTimestamp()});}catch(e){}}
 async function presenceOff(){if(!presUid||!presWrite())return;try{const f=await fb();f.F.deleteDoc(f.F.doc(f.db,'presence',GAME,'users',presUid)).catch(()=>{});}catch(e){}}
 async function presenceCount(){if(cfg.presence===false||Date.now()-countAt<25000)return;countAt=Date.now();
  try{const f=await fb();const since=f.F.Timestamp.fromMillis(Date.now()-120000);
   const r=await f.F.getCountFromServer(f.F.query(f.F.collection(f.db,'presence',GAME,'users'),f.F.where('t','>',since)));countN=r.data().count|0;updHubLive();countTell();}catch(e){}}
 /* v5: "N playing now" for the game's home (Quick Match button). cb(n) runs now and whenever the count changes. */
 let countCb=null,countSent=-1;
 function countTell(){if(countN===countSent)return;countSent=countN;if(countCb){try{countCb(countN);}catch(e){}}try{cfg.onCount&&cfg.onCount(countN);}catch(e){}}
 function playing(cb){if(typeof cb==='function'){countCb=cb;try{cb(countN);}catch(e){}}presenceCount();return countN;}
 setInterval(()=>{if((countCb||cfg.onCount)&&!document.hidden&&!role)presenceCount();},30000);
 function presenceStart(){if(presT||!presWrite())return;setTimeout(presence,2500);presT=setInterval(presence,60000);addEventListener('pagehide',presenceOff);}

 /* ================= UI ================= */
 const UI={root:null,hubOn:false,roomOn:false,quickOn:false,pubPick:ls.get('dgn-pub')!=='0'};
 function ensureUI(){if(UI.root)return UI.root;
  if(!document.getElementById('dgn-css')){const st=document.createElement('style');st.id='dgn-css';st.textContent=STYLE;document.head.appendChild(st);}
  const r=document.createElement('div');r.className='dgn';r.id='dgn';
  r.innerHTML='<div id="dgnHub" hidden></div><div id="dgnRoom" class="dgn-room" hidden role="dialog" aria-modal="true" aria-label="Waiting room"></div><div id="dgnQuick" class="dgn-quick" hidden role="dialog" aria-modal="true" aria-live="polite"></div>'+
   '<div id="dgnDock" class="dgn-dock" hidden></div><div id="dgnWatch" class="dgn-watch" hidden role="status"></div><div id="dgnTray" class="dgn-tray" hidden role="dialog" aria-label="Quick chat"></div><div id="dgnQa" hidden></div><div id="dgnNote" hidden></div><div id="dgnToast" class="dgn-toast" hidden role="status" aria-live="polite"></div>';
  document.body.appendChild(r);UI.root=r;UI.dock=r.querySelector('#dgnDock');UI.dock.addEventListener('click',e=>{e.stopPropagation();onUIClick(e);});
  r.addEventListener('click',onUIClick);
  r.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='dgnCode'){e.preventDefault();joinCode(e.target.value);}if(e.key==='Enter'&&e.target.id==='dgnName'){e.preventDefault();e.target.blur();}});
  r.addEventListener('input',e=>{if(e.target.id==='dgnCode')e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);});
  r.addEventListener('change',e=>{if(e.target.id==='dgnName'){const v=cleanName(e.target.value);if(v)setNameSafe(v);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!document.getElementById('dgnNote').hidden)closeNote();else if(!document.getElementById('dgnTray').hidden)closeTray();else if(UI.hubOn)closeHub();}});  document.addEventListener('click',e=>{const tr=document.getElementById('dgnTray');if(tr&&!tr.hidden&&!e.target.closest('#dgnTray,[data-dgn="chat"],[data-dgn="voice"]'))closeTray();},true);
  return r;}
 const $i=id=>document.getElementById(id);
 function toast(t,ms){if(cfg.toast){try{cfg.toast(t,ms);return;}catch(e){}}ensureUI();const e=$i('dgnToast');e.textContent=t;e.hidden=false;e.style.animation='none';void e.offsetWidth;e.style.animation='';clearTimeout(e._t);e._t=setTimeout(()=>{e.hidden=true;},ms||2800);}
 function notice(title,html,raw,noOk){ensureUI();const n=$i('dgnNote');if(n._res){const r=n._res;n._res=null;r(false);}n.hidden=false;
  n.innerHTML=`<div class="dgn-scrim" data-dgn="noteClose"></div><section class="dgn-sheet dgn-note" role="alertdialog" aria-modal="true" aria-labelledby="dgnNt"><div class="dgn-grab"></div><div class="dgn-hd"><h2 id="dgnNt">${esc(title)}</h2></div>${raw?html:`<p>${esc(html)}</p>`}${noOk?'':'<button class="dgn-btn pri w" data-dgn="noteClose">OK</button>'}</section>`;
  setTimeout(()=>{const b=n.querySelector('.dgn-btn.pri')||n.querySelector('.dgn-btn');b&&b.focus({preventScroll:true});},60);}
 function closeNote(v){const n=$i('dgnNote');if(n){n.hidden=true;n.innerHTML='';if(n._res){const r=n._res;n._res=null;r(v===true);}}}
 /* v5: a themed confirm sheet. ask({title,text,ok,cancel}) → Promise<boolean> */
 function ask(o){o=o||{};return new Promise(res=>{notice(o.title||'Are you sure?',`${o.text?`<p>${esc(o.text)}</p>`:''}<div class="dgn-two"><button class="dgn-btn" data-dgn="noteClose">${esc(o.cancel||'Stay')}</button><button class="dgn-btn pri" data-dgn="askYes">${esc(o.ok||'OK')}</button></div>`,true,true);$i('dgnNote')._res=res;});}
 /* v5: "Leave table" with a confirm; a computer (the game's AI) takes a seated player's seat */
 async function leaveAsk(){if(!role){leave();return true;}const me=seatOf(myId),live=!!T&&T.status==='playing'&&!!me&&!me.gone;
  const ok=await ask({title:'Leave the table?',text:live?'A computer player takes your seat, and you can’t come back to this match.':me?'You’ll leave this table.':'You’ll stop watching this table.',ok:'Leave table',cancel:'Stay'});
  if(ok)leave();return ok;}
 function hideAll(){closeHub();hideRoom();hideQuick();closeTray();closeQa();updDock();}

 /* ---------- hub ---------- */
 function openHub(o){ensureUI();if(role){if(T&&T.status==='lobby')enterLobby();else toast('You are already at a table.');return;}
  UI.friends=!!(o&&o.friends===true);if(UI.friends)UI.pubPick=ls.get('dgn-pub')==='1';
  UI.hubOn=true;warm();presenceCount();guestTaken(meInfo().name);renderHub();}
 /* v5: Play with Friends: make a table (private or public) or join with a code; public tables and live games below */
 function openFriends(){openHub({friends:true});}
 function closeHub(){UI.hubOn=false;const h=$i('dgnHub');if(h){h.hidden=true;h.innerHTML='';}}
 function renderHub(pre){const h=$i('dgnHub');const me=meInfo();h.hidden=false;
  if(UI.friends){h.innerHTML=`<div class="dgn-scrim" data-dgn="hubClose"></div><section class="dgn-sheet" role="dialog" aria-modal="true" aria-labelledby="dgnHt">
<div class="dgn-grab"></div>
<div class="dgn-hd"><h2 id="dgnHt">Play with Friends</h2><button class="dgn-x" data-dgn="hubClose" aria-label="Close">${IC.x}</button></div>
<p class="dgn-srv" id="dgnSrv"></p>
${TEST?`<p class="dgn-hint" style="margin:-6px 0 8px">Test namespace: <b>${esc(NS)}</b></p>`:''}
<label class="dgn-lbl" for="dgnName">Your name</label><input class="dgn-in" id="dgnName" maxlength="14" autocomplete="nickname" enterkeyhint="done" placeholder="Your name" value="${esc(me.name)}">
<div class="dgn-card"><span class="dgn-lbl">${IC.plus.replace('<svg','<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"')}Create a table</span>
 <div class="dgn-seg" role="group" aria-label="Who can join"><button data-dgn="pubPick" data-v="0" aria-pressed="${!UI.pubPick}">${IC.lock}Private</button><button data-dgn="pubPick" data-v="1" aria-pressed="${UI.pubPick}">${IC.globe}Public</button></div>
 <p class="dgn-hint" id="dgnPubHint">${UI.pubPick?'Anyone can find it and join from Quick Match.':'Only people with your invite link or code can join.'}</p>
 <button class="dgn-btn pri w" style="margin-top:10px" data-dgn="create">${IC.plus}Create table</button></div>
<div class="dgn-card"><label class="dgn-lbl" for="dgnCode">Join with a code</label><div class="dgn-row"><input class="dgn-in code" id="dgnCode" maxlength="4" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="CODE" value="${esc(pre||'')}"><button class="dgn-btn pri" data-dgn="join">Join</button></div></div>
<h3 class="dgn-h3">Public tables</h3><div class="dgn-list" id="dgnOpen"></div>
<h3 class="dgn-h3">Watch a live game</h3><div class="dgn-list" id="dgnLiveL"></div>
${cfg.rulesNote?`<p class="dgn-fine">${esc(cfg.rulesNote)}</p>`:''}
</section>`;updHubLive();updLists(true);return;}
  h.innerHTML=`<div class="dgn-scrim" data-dgn="hubClose"></div><section class="dgn-sheet" role="dialog" aria-modal="true" aria-labelledby="dgnHt">
<div class="dgn-grab"></div>
<div class="dgn-hd"><h2 id="dgnHt">Play ${esc(TITLE)} online</h2><span class="dgn-live" id="dgnCount" hidden><i></i><b></b></span><button class="dgn-x" data-dgn="hubClose" aria-label="Close">${IC.x}</button></div>
<p class="dgn-srv" id="dgnSrv"></p>
${TEST?`<p class="dgn-hint" style="margin:-6px 0 8px">Test namespace: <b>${esc(NS)}</b></p>`:''}
<label class="dgn-lbl" for="dgnName">Your name</label><input class="dgn-in" id="dgnName" maxlength="14" autocomplete="nickname" enterkeyhint="done" placeholder="Your name" value="${esc(me.name)}">
<button class="dgn-btn pri w big" style="margin-top:14px" data-dgn="quick">${IC.bolt}<span>Quick Match<small>Join an open table, or start one</small></span></button>
<div class="dgn-card"><span class="dgn-lbl">New table</span>
 <div class="dgn-seg" role="group" aria-label="Who can join"><button data-dgn="pubPick" data-v="1" aria-pressed="${UI.pubPick}">${IC.globe}Public</button><button data-dgn="pubPick" data-v="0" aria-pressed="${!UI.pubPick}">${IC.lock}Private</button></div>
 <p class="dgn-hint" id="dgnPubHint">${UI.pubPick?'Anyone can join from the list below, and watch once it starts.':'Only people with your code or invite link can join.'}</p>
 <button class="dgn-btn w" style="margin-top:10px" data-dgn="create">${IC.plus}Create table</button></div>
<div class="dgn-card"><label class="dgn-lbl" for="dgnCode">Join with a code</label><div class="dgn-row"><input class="dgn-in code" id="dgnCode" maxlength="4" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="ABCD" value="${esc(pre||'')}"><button class="dgn-btn" data-dgn="join">Join</button></div></div>
<h3 class="dgn-h3">Open tables</h3><div class="dgn-list" id="dgnOpen"></div>
<h3 class="dgn-h3">Live now</h3><div class="dgn-list" id="dgnLiveL"></div>
${cfg.rulesNote?`<p class="dgn-fine">${esc(cfg.rulesNote)}</p>`:''}
</section>`;updHubLive();updLists(true);}
 function updHubLive(){const s=$i('dgnSrv');if(s){const t={checking:'Connecting to the game server…',ok:'Game server connected',fail:'Can’t reach the game server on this network'}[srv];s.className='dgn-srv s-'+srv;s.innerHTML='<i></i>'+t;}
  const c=$i('dgnCount');if(c){c.hidden=countN<1;const b=c.querySelector('b');if(b)b.textContent=countN+' playing now';}updLists();}
 let listT=0;
 function updLists(now){if(!UI.hubOn)return;if(listT&&!now)return;const go=()=>{listT=0;const o=$i('dgnOpen'),l=$i('dgnLiveL');if(!o||!l)return;
   const ol=openTables(),lv=liveTables();
   const oh=ol.length?ol.map(x=>`<div class="dgn-tb"><span class="ti">${x.q?IC.bolt:IC.users}</span><div class="tt"><b>${esc(x.name)}’s table</b><small>${x.n} of ${x.mx} players${x.q?' · Quick Match':''}${x.info?' · '+esc(x.info):''}</small></div><div class="ta"><button class="dgn-btn sm pri" data-dgn="joinOpen" data-code="${esc(x.code)}">Join</button></div></div>`).join('')
    :`<p class="dgn-empty">${srv==='fail'?'Can’t load open tables on this network.':srv==='checking'?'Looking for open tables…':'No open tables right now. Create one, or try Quick Match.'}</p>`;
   const lh=lv.length?lv.map(x=>`<div class="dgn-tb"><span class="ti">${IC.eye}</span><div class="tt"><b>${esc(x.name)}’s table</b><small>${x.n}/${x.mx} playing${x.info?' · '+esc(x.info):''}${x.vw?' · '+x.vw+' watching':''}</small>${x.f>0?'<small>Join now to play in the next match</small>':''}</div><div class="ta">${x.f>0?`<button class="dgn-btn sm" data-dgn="joinLive" data-code="${esc(x.code)}" aria-label="Join ${esc(x.name)}’s table for the next match">Join</button>`:''}<button class="dgn-btn sm pri" data-dgn="watch" data-code="${esc(x.code)}">Watch</button></div></div>`).join('')
    :`<p class="dgn-empty">${srv==='ok'?'No public games in play right now.':'Loading live tables…'}</p>`;
   if(o._h!==oh){o._h=oh;o.innerHTML=oh;}if(l._h!==lh){l._h=lh;l.innerHTML=lh;}};
  if(now)go();else listT=setTimeout(go,250);}
 setInterval(()=>{if(UI.hubOn&&!document.hidden){if(!net&&!pool)warm();updLists();presenceCount();}},5000);

 /* ---------- quick wait ---------- */
 function showQuick(t){ensureUI();UI.quickOn=true;const q=$i('dgnQuick');q.hidden=false;
  /* v5: games with computer seats show the Quick Match search screen from the first moment (the ring starts once a table is ready) */
  if(CPU&&/^(Connecting|Looking|No open|That table|Joining)/.test(String(t))){q.classList.add('qs');const me=Object.assign({id:myId},meInfo());
   q.innerHTML=`<div class="dgn-room-in dgn-qs">${qTopHTML('cancel')}<section class="dgn-qpanel">${qRingHTML(me)}<h3><span class="dgn-dots">Finding players</span></h3><p class="dgn-qst" id="dgnQt">${esc(t)}</p>
<div class="dgn-seats">${qSeatsHTML([me])}</div><div class="dgn-qfill">1 of ${QSIZE} seats filled</div><button class="dgn-btn w" data-dgn="cancel">Cancel</button></section>
<p class="dgn-qhint">If the table isn’t full after about 12 seconds, you can start with computer players.</p></div>`;return;}
  q.classList.remove('qs');q.innerHTML=`<div class="qi"><div class="dgn-spin" aria-hidden="true"></div><p id="dgnQt">${esc(t)}</p><button class="dgn-btn" data-dgn="cancel">Cancel</button></div>`;}
 function setQuick(t){const e=$i('dgnQt');if(e)e.textContent=t;else showQuick(t);}
 function hideQuick(){UI.quickOn=false;const q=$i('dgnQuick');if(q){q.hidden=true;q.innerHTML='';q.classList.remove('qs');}}
 /* ---------- v5 Quick Match search screen (the waiting room of a Quick Match table) ---------- */
 const RING_C=414.7;
 const qTopHTML=a=>`<div class="dgn-top"><button class="dgn-ib" data-dgn="${a}" aria-label="${a==='cancel'?'Cancel':'Leave table'}">${IC.back}</button><span class="ttl">Quick Match</span>${a==='leave'?`<button class="dgn-ib" data-dgn="voice" hidden></button><button class="dgn-ib" data-dgn="chat" aria-label="Quick chat">${IC.chat}</button>`:''}</div>`;
 const qRingHTML=me=>`<div class="dgn-ringw"><svg class="tr" viewBox="0 0 148 148" aria-hidden="true"><circle class="trk" cx="74" cy="74" r="66"/><circle class="arc" id="dgnQarc" cx="74" cy="74" r="66" stroke-dasharray="${RING_C}" stroke-dashoffset="0"/></svg><span class="dgn-rme">${av(me,104)}</span><span class="dgn-secs" id="dgnQsecs">${Math.round(QUICK_SEARCH/1000)} s</span></div>`;
 function qSeatsHTML(list){let h='';for(let i=0;i<Math.max(QSIZE,list.length);i++){const p=list[i];
   h+=p?`<div class="dgn-st" data-pid="${esc(p.id)}"><span class="av${p.cpu?' cpu':''}">${p.cpu&&!cfg.avatar?IC.bot:av(p,52)}</span><span class="n">${p.id===myId?'You':esc(p.name)}</span>${p.cpu?`<span class="dgn-ctag">${IC.bot}Computer</span>`:''}</div>`
    :`<div class="dgn-st"><span class="emp">${IC.seat}</span><span class="n o">Open seat</span></div>`;}return h;}
 function renderQRoom(r){if(r._built!==2){r._built=2;const me=seatOf(myId)||Object.assign({id:myId},meInfo());
   r.innerHTML=`<div class="dgn-room-in dgn-qs">${qTopHTML('leave')}<section class="dgn-qpanel">${qRingHTML(me)}<h3 id="dgnQh"></h3><p class="dgn-qst" id="dgnQs"></p>
<div class="dgn-seats" id="dgnQseats"></div><div class="dgn-qfill" id="dgnQf"></div><button class="dgn-btn w" data-dgn="leave">Cancel</button></section>
<p class="dgn-qhint">If the table isn’t full after about 12 seconds, you can start with computer players.</p></div>`;}
  qPaint();vcUI();}
 function qPaint(){if(!UI.roomOn||!T||!T.quick||!CPU||T.status!=='lobby')return;const host=role==='host',now=Date.now()+(host?0:skew);
  const set=(id,h)=>{const e=$i(id);if(e&&e._h!==h){e._h=h;e.innerHTML=h;}};
  const hum=T.players.filter(p=>!p.cpu).length,free=Math.max(0,QSIZE-T.players.length);
  let f=0,secs='',head='<span class="dgn-dots">Finding players</span>',sub=hum>1?'Players found. Looking for more…':'Looking for players…';
  if(T.autoAt){f=1;const s=Math.max(0,Math.ceil((T.autoAt-now)/1000));secs='Starting';head=hum>=QSIZE?'Table full':'Starting soon';sub='The match starts in '+s+' s';}
  else if(T.qAsk){f=1;secs='0 s';head=hum>1?'Still '+free+' seat'+(free===1?'':'s')+' free':'Nobody’s around yet';sub=host?'':'Starting soon…';}
  else if(T.qEnd){const left=T.qEnd-now;f=Math.max(0,Math.min(1,1-left/QUICK_SEARCH));secs=Math.max(0,Math.ceil(left/1000))+' s';}
  const a=$i('dgnQarc');if(a)a.setAttribute('stroke-dashoffset',(RING_C*f).toFixed(1));
  const sc=$i('dgnQsecs');if(sc&&sc.textContent!==secs)sc.textContent=secs||' ';
  set('dgnQh',head);const st=$i('dgnQs');if(st&&st.textContent!==sub)st.textContent=sub;
  set('dgnQseats',qSeatsHTML(T.players));
  const fl=$i('dgnQf'),ft=Math.min(T.players.length,QSIZE)+' of '+QSIZE+' seats filled';if(fl&&fl.textContent!==ft)fl.textContent=ft;
  if(host&&T.qAsk)renderQa(now);else closeQa();}
 function renderQa(now){ensureUI();const q=$i('dgnQa');const hum=T.players.filter(p=>!p.cpu).length,n=Math.max(1,Math.max(QSIZE,MIN)-T.players.length);
  const left=Math.max(0,T.qAsk-now),f=Math.max(0,Math.min(1,left/QUICK_ASK));
  const key=hum+':'+n;if(q.hidden||q._k!==key){q._k=key;q.hidden=false;
   q.innerHTML=`<div class="dgn-scrim"></div><section class="dgn-sheet" role="dialog" aria-modal="true" aria-labelledby="dgnQah"><div class="dgn-grab"></div>
<div class="dgn-hd"><h2 id="dgnQah">${hum>1?'Still '+n+' seat'+(n===1?'':'s')+' free':'Nobody’s around yet'}</h2></div>
<p class="dgn-hint" style="font-size:13.5px;margin:0 0 14px">${hum>1?'Fill them with computer players and start. Anyone who turns up later takes a computer’s seat.':'Start now with computer players. If real players turn up, they take a computer’s seat.'}</p>
<div class="dgn-bots"><span class="hp">${Array.from({length:Math.min(n,4)},()=>`<span>${IC.bot}</span>`).join('')}</span><small>${n===1?'1 computer player fills the empty seat.':n+' computer players fill the empty seats.'} Each has a small “Computer” tag.</small></div>
<div class="dgn-stack"><button class="dgn-btn pri w cd" style="min-height:62px" data-dgn="qBots"><span>Start with computer players</span><span class="cdt" id="dgnCdt"></span><span class="bar" id="dgnCdb"></span></button>
<button class="dgn-btn w" data-dgn="qWait">Keep waiting</button></div></section>`;
   setTimeout(()=>{const b=q.querySelector('.dgn-btn.pri');b&&b.focus({preventScroll:true});},60);}
  const t=$i('dgnCdt'),s='Starting by itself in '+Math.max(1,Math.ceil(left/1000))+' s';if(t&&t.textContent!==s)t.textContent=s;
  const b=$i('dgnCdb');if(b)b.style.transform='scaleX('+f.toFixed(3)+')';}
 function closeQa(){const q=$i('dgnQa');if(q&&!q.hidden){q.hidden=true;q.innerHTML='';q._k='';}}
 setInterval(()=>{if(UI.roomOn&&T&&T.quick&&CPU&&T.status==='lobby')qPaint();},200);

 /* ---------- waiting room ---------- */
 function enterLobby(){ensureUI();closeHub();hideQuick();if(!UI.roomOn){UI.roomOn=true;const r=$i('dgnRoom');r.hidden=false;r._built=0;}renderRoom();updDock();}
 function hideRoom(){UI.roomOn=false;const r=$i('dgnRoom');if(r){r.hidden=true;r.innerHTML='';r._built=0;}closeQa();}
 function av(seat,size){if(cfg.avatar){try{const h=cfg.avatar(seat,size);if(h)return h;}catch(e){}}return esc((seat.name||'?').slice(0,1).toUpperCase());}
 const inviteURL=()=>{const u=location.origin+location.pathname+'?t='+(T?T.code:'');return TEST?u+'&ns='+encodeURIComponent(Q.get('ns')):u;};
 function renderRoom(){if(!UI.roomOn||!T||T.status!=='lobby')return;const r=$i('dgnRoom');const host=role==='host',me=seatOf(myId);
  if(T.quick&&CPU){renderQRoom(r);return;}
  if(r._built!==1){r._built=1;const code=T.code;
   r.innerHTML=`<div class="dgn-room-in"><div class="dgn-top"><button class="dgn-ib" data-dgn="leave" aria-label="Leave table">${IC.back}</button><span class="ttl" id="dgnRt"></span><button class="dgn-ib" data-dgn="voice" hidden></button><button class="dgn-ib" data-dgn="chat" aria-label="Quick chat">${IC.chat}</button></div>
<div class="dgn-codebox"><span class="dgn-lbl">Table code</span><div class="dgn-code" aria-label="Table code ${esc(code.split('').join(' '))}">${code.split('').map(c=>`<span>${c}</span>`).join('')}</div>
<div class="dgn-two"><button class="dgn-btn pri" data-dgn="share">${IC.share}Invite</button><button class="dgn-btn" data-dgn="copy">${IC.copy}Copy link</button></div></div>
<div id="dgnPub"></div>
<span class="dgn-lbl">Players <span id="dgnPc"></span></span><ul class="dgn-plist" id="dgnPl"></ul>
<div id="dgnWt"></div><div id="dgnOpts"></div>
${cfg.rulesNote?`<p class="dgn-fine">${esc(cfg.rulesNote)}</p>`:''}
<div class="dgn-go" id="dgnGo"></div></div>`;}
  const set=(id,h)=>{const e=$i(id);if(e&&e._h!==h){e._h=h;e.innerHTML=h;}};
  set('dgnRt',esc(T.quick?'Quick Match table':host?'Your table':(nameOf(T.hostId)||'Friend')+'’s table'));
  set('dgnPub',host&&!T.quick?`<span class="dgn-lbl">Who can join</span><div class="dgn-seg" role="group" aria-label="Who can join"><button data-dgn="setPub" data-v="1" aria-pressed="${!!T.pub}">${IC.globe}Anyone (public)</button><button data-dgn="setPub" data-v="0" aria-pressed="${!T.pub}">${IC.lock}Code only</button></div>`:'');
  set('dgnPc',`· ${T.players.length} of ${MAX}`);
  let custom=null;if(cfg.roomList){try{custom=cfg.roomList(T,{host,me:myId,quick:!!T.quick,avatar:av,icons:IC});}catch(e){console.error(e);}}
  if(custom!=null)set('dgnPl',String(custom));else
  set('dgnPl',T.players.map(p=>`<li data-pid="${esc(p.id)}"><span class="av">${av(p,38)}</span><span class="nm">${esc(p.name)}${p.id===T.hostId?`<span class="dgn-tag">${IC.crown}Host</span>`:''}${p.id===myId?'<span class="dgn-tag you">You</span>':''}</span>${host&&!T.quick&&p.id!==myId?`<button class="dgn-kick" data-dgn="kick" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${IC.x}</button>`:''}</li>`).join('')
   +Array.from({length:Math.max(0,MAX-T.players.length)},()=>'<li class="empty"><span class="seat"></span><span>Open seat</span></li>').join(''));
  set('dgnWt',T.wait.length?`<p class="dgn-hint">Waiting for a seat: ${T.wait.map(w=>esc(w.name)).join(', ')}</p>`:'');
  const ops=(cfg.options||[]).filter(op=>!op.when||op.when(T.opts));
  set('dgnOpts',ops.map(op=>`<span class="dgn-lbl">${esc(op.label)}${host&&!T.quick?'':' <small style="text-transform:none;letter-spacing:0">(set by the host)</small>'}</span><div class="dgn-seg" role="group" aria-label="${esc(op.label)}">${op.choices.map(c=>`<button data-dgn="opt" data-k="${esc(op.k)}" data-v="${esc(c[0])}" aria-pressed="${String(T.opts[op.k])===String(c[0])}"${host&&!T.quick?'':' disabled'}>${esc(c[1])}</button>`).join('')}</div>${op.hint?`<p class="dgn-hint">${esc(typeof op.hint==='function'?op.hint(T.opts):op.hint)}</p>`:''}`).join(''));
  const secs=T.autoAt?Math.max(0,Math.ceil((T.autoAt-(Date.now()+(role==='host'?0:skew)))/1000)):0;
  const hn=nameOf(T.hostId)||'the host';
  const go=(host?`<button class="dgn-btn pri w big" data-dgn="start"${T.players.length<MIN?' disabled':''}>${T.players.length<MIN?'Waiting for players…':'Start the match'}</button>`
   :me?`<p class="dgn-waitp">Waiting for ${esc(hn)} to start…</p>`:`<p class="dgn-waitp">Watching ${esc(hn)}’s table</p>`)
   +(T.quick&&T.autoAt?`<p class="dgn-hint" style="text-align:center">Starting automatically in ${secs}s</p>`:T.quick&&T.players.length<MIN?`<p class="dgn-hint" style="text-align:center">Looking for more players. The match starts as soon as someone joins.</p>`:'')
   +`<button class="dgn-btn w" data-dgn="leave">Leave table</button>`;
  set('dgnGo',go);vcUI();}
 setInterval(()=>{if(UI.roomOn&&T&&T.autoAt)renderRoom();},1000);

 /* ---------- dock + watch bar (during a match) ---------- */
 function updDock(){if(!UI.root)return;const d=UI.dock,w=$i('dgnWatch');const on=!!role&&!!T&&T.status!=='lobby'&&!UI.roomOn;
  const me=seated(myId),waiting=!!T&&(T.wait||[]).some(x=>x.id===myId);
  if(!on){d.hidden=true;w.hidden=true;if(d.parentNode!==UI.root){UI.root.appendChild(d);d.classList.remove('inline');}return;}
  if(!d._b){d._b=1;d.innerHTML=`<span class="dgn-vw" hidden></span><button class="dgn-ib" data-dgn="voice" hidden></button><button class="dgn-ib" data-dgn="chat" aria-label="Quick chat">${IC.chat}</button>`;}
  /* games can mount the dock inline, e.g. in their own top bar (cfg.dockHost) */
  let host=null;try{host=cfg.dockHost?cfg.dockHost():null;}catch(e){}
  if(host&&host.isConnected){if(d.parentNode!==host)host.insertBefore(d,host.firstChild);d.classList.add('inline');}else if(d.parentNode!==UI.root){UI.root.appendChild(d);d.classList.remove('inline');}
  d.hidden=false;const vw=d.querySelector('.dgn-vw'),n=T.viewers|0;vw.hidden=n<1;const vh=IC.eye+'<span>'+n+'</span>';if(vw._h!==vh){vw._h=vh;vw.innerHTML=vh;}vw.setAttribute('aria-label',n+' watching');
  const cb=d.querySelector('[data-dgn="chat"]');if(cb)cb.hidden=!(me||waiting);
  const cs=CPU&&cpuSeats().length>0&&T.status==='playing';
  if(me){w.hidden=true;}else{w.hidden=false;const t=waiting?(cs?'You’re next to play':'You’re in for the next match'):'Watching live',s=[n?n+' watching':'',waiting?(cs?'You take a computer’s seat at the next break':'You play from the start of the next match'):T.pub&&freeSeatsSafe()>0&&T.status!=='lobby'?(cs?'Tap Join to take a computer’s seat':'Tap Join to play in the next match'):''].filter(Boolean).join(' · ');
   const h=`<span class="we">${IC.eye}</span><div class="wt"><b>${esc(t)}</b><small>${esc(s)}</small></div>${!waiting&&T.pub&&freeSeatsSafe()>0?'<button class="dgn-btn sm pri" data-dgn="waitJoin">Join</button>':''}<button class="dgn-btn sm" data-dgn="leave">Leave</button>`;if(w._h!==h){w._h=h;w.innerHTML=h;}}
  vcUI();}
 const freeSeatsSafe=()=>{try{return freeSeats();}catch(e){return 0;}};

 /* ---------- quick chat tray + bubbles ---------- */
 function openTray(){ensureUI();const t=$i('dgnTray');if(!t.hidden&&t.dataset.k==='chat'){closeTray();return;}t.hidden=false;t.dataset.k='chat';
  t.innerHTML=`<div class="th"><span>Quick chat</span><button class="dgn-x" data-dgn="trayClose" aria-label="Close">${IC.x}</button></div><div class="tg">${PH.map((p,i)=>`<button data-dgn="say" data-v="${i}">${esc(p)}</button>`).join('')}</div>`;}
 function closeTray(){const t=$i('dgnTray');if(t&&!t.hidden){t.hidden=true;t.innerHTML='';}}
 function showChat(id,k){const txt=PH[k|0];if(!txt)return;ensureUI();const nm=id===myId?'You':nameOf(id)||'Player';
  const el=avatarEl(id);const b=document.createElement('div');b.className='dgn-bub';b.innerHTML=`<small>${esc(nm)}</small>${esc(txt)}`;UI.root.appendChild(b);
  const W=innerWidth,H=innerHeight,bw=Math.min(200,W*.6);let x=W/2,y=90,below=false;
  if(el){const r=el.getBoundingClientRect();if(r.width){x=r.left+r.width/2;y=r.top-8;if(y<70){y=r.bottom+10;below=true;}}}
  const bh=b.offsetHeight||44,bwr=b.offsetWidth||bw,left=Math.max(8,Math.min(W-bwr-8,x-bwr/2));
  b.style.left=left+'px';b.style.top=(below?y:Math.max(8,y-bh))+'px';b.style.setProperty('--ax',Math.max(12,Math.min(bwr-12,x-left))+'px');if(below)b.classList.add('below');
  setTimeout(()=>b.remove(),3300);try{cfg.onChat&&cfg.onChat(id,txt);}catch(e){}}

 /* ---------- one click handler ---------- */
 async function shareInvite(){const url=inviteURL(),text=`Join my ${TITLE} table! Code ${T?T.code:''}`;
  if(navigator.share){try{await navigator.share({title:TITLE,text,url});return;}catch(e){if(e&&e.name==='AbortError')return;}}copyInvite();}
 async function copyInvite(){const url=inviteURL();let ok=false;try{await navigator.clipboard.writeText(url);ok=true;}catch(e){try{const t=document.createElement('textarea');t.value=url;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();ok=document.execCommand('copy');t.remove();}catch(x){}}
  toast(ok?'Invite link copied':'Your table code is '+(T?T.code:''));}
 function onUIClick(e){const b=e.target.closest('[data-dgn]');if(!b||b.disabled)return;const a=b.dataset.dgn;
  switch(a){
   case 'hubClose':closeHub();break;
   case 'noteClose':closeNote();break;
   case 'trayClose':closeTray();break;
   case 'quick':quickMatch();break;
   case 'pubPick':UI.pubPick=b.dataset.v==='1';ls.set('dgn-pub',UI.pubPick?'1':'0');b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    {const h=$i('dgnPubHint');if(h)h.textContent=UI.friends?(UI.pubPick?'Anyone can find it and join from Quick Match.':'Only people with your invite link or code can join.'):UI.pubPick?'Anyone can join from the list below, and watch once it starts.':'Only people with your code or invite link can join.';}break;
   case 'create':needNameOK().then(ok=>{if(ok)hostCreate({pub:UI.pubPick});});break;
   case 'join':joinCode(($i('dgnCode')||{}).value);break;
   case 'joinOpen':case 'joinLive':joinCode(b.dataset.code);break;
   case 'watch':joinCode(b.dataset.code,{spec:true});break;
   case 'cancel':run++;closeNet();role=null;T=null;hideQuick();break;
   case 'leave':leave();break;
   case 'share':shareInvite();break;
   case 'copy':copyInvite();break;
   case 'setPub':setPub(b.dataset.v==='1');break;
   case 'opt':setOpt(b.dataset.k,b.dataset.v);break;
   case 'kick':kick(b.dataset.id);break;
   case 'x':if(cfg.roomClick){try{cfg.roomClick(Object.assign({},b.dataset));}catch(x){console.error(x);}}break;
   case 'start':start();break;
   case 'chat':openTray();break;
   case 'say':sayChat(+b.dataset.v);break;
   case 'mic':vcMic();break;
   case 'voice':openVoice();break;
   case 'deaf':vcDeaf();break;
   case 'vmute':vcMute(b.dataset.id);break;
   case 'vreport':closeTray();openReport(b.dataset.id);break;
   case 'sendReport':sendReport(b.dataset.id);break;
   case 'askYes':closeNote(true);break;
   case 'qBots':quickBots();break;
   case 'qWait':closeQa();quickWaitMore();break;
   case 'waitJoin':if(net&&role==='join'){net.spec=false;hello();toast('You’re in for the next match.');}break;}}

 /* ---------------- boot: invite links (?t=CODE) ---------------- */
 function boot(){presenceStart();const t=(Q.get('t')||'').toUpperCase();if(!/^[A-Z]{4}$/.test(t))return false;
  if(meInfo().name){joinCode(t);return true;}ensureUI();UI.hubOn=true;warm();renderHub(t);setTimeout(()=>{const i=$i('dgnName');i&&i.focus();},200);toast('Choose a name, then tap Join.');return true;}

 /* ---------------- public API ---------------- */
 Object.assign(R,{
  version:VERSION,id:myId,ns:NS,test:TEST,local:LOCAL,min:MIN,max:MAX,phrases:PH,
  open:openHub,close:closeHub,boot,join:joinCode,quick:quickMatch,create:hostCreate,leave,retire:()=>leave({afk:true}),
  isOnline:()=>!!role,isHost:()=>role==='host',isClient:()=>role==='join',
  isSpectator:()=>!!role&&!!T&&!seated(myId),isWaiting:()=>!!T&&(T.wait||[]).some(w=>w.id===myId),hostAway:()=>hostAway,
  meta:()=>T,view:()=>V,seated,humans:()=>T?T.players.filter(p=>!p.gone&&!p.cpu).length:0,
  hostNow:()=>Date.now()+(role==='join'?skew:0),skew:()=>role==='join'?skew:0,
  sync,send:a=>role==='join'?joinSend({k:'act',a}):Promise.resolve(false),
  start,again,matchOver,strike,clear:clearStrikes,lobby:lobbySend,afk:markAfk,drop:(id,why)=>drop(id,why||'left'),note:t=>{note(t);sync();},
  tell:(id,obj)=>{if(role==='host'&&id!==myId)sendToId(id,{k:'tell',d:obj});},
  chat:sayChat,showChat,toast,notice,updDock,
  lists:()=>({open:openTables(),live:liveTables()}),
  /* v5 */
  friends:openFriends,playing,handBreak,ask,leaveAsk,isCpu:id=>isCpuP(seatOf(id)),cpu:CPU,quickSize:QSIZE});
 if(LOCAL){window.__NET=R;R._vc=()=>({on:VC.on,deaf:VC.deaf,stream:!!VC.stream,mute:[...VC.mute],mic:T&&T.mic||{},peers:[...VC.peers].map(([id,p])=>[id,p.pc.connectionState,!!p.au.srcObject])});
  /* fake voice levels for tests: R._vcFake({pid:0..1}) or null; R._vcMic(on) sets my shared mic state without a real mic */
  R._vcFake=o=>{VC.fake=o||null;};R._vcMic=on=>{VC.on=!!on;vcShare();vcUI();};
  R._quick=()=>({qEnd:T&&T.qEnd,qAsk:T&&T.qAsk,autoAt:T&&T.autoAt,players:T?T.players.map(p=>({id:p.id,name:p.name,cpu:!!p.cpu,gone:!!p.gone})):[],wait:T?T.wait.map(w=>w.id):[]});}   /* localhost test hooks */
 return R;}

window.DGNet={version:VERSION,create,pid,testName,ns:nsFor,local:LOCAL,PRESENCE};
})();
