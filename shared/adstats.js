/* Dhivehi Games · anonymous ad counts and time played (window.DGAds). First party only: no ad network, no cookies.
   Load AFTER shared/stats.js (it reuses that file's anonymous account and its time-in-game counter):
     <script src="../shared/stats.js?v=2" defer></script><script src="../shared/adstats.js?v=1" defer></script>

   What counts (the same rules the admin "Advertisers" tab explains to sponsors):
     view : an ad element is at least half on screen for 1 second. Once per screen visit: a rotating box counts each
            slide once while it stays on screen; scrolling away, changing screen or hiding the page starts a new visit.
            The same ad in the same spot is not counted again within 20 s (protects against re-drawn table plaques).
     tap  : a real tap/click on a link inside the ad. Swipes (moved > 10 px) and press-and-hold (> 650 ms) don't count.
     time : seconds per game from DGStats.takeTime() (visible page, not idle for 2 minutes).
   Ads are found by their attributes, so a game only has to tag its slot:
     data-ad="<sponsor id>" data-ad-place="home_box|game_box|raalhu|plaque|credit" [data-ad-game="digu"]
   (DGSponsors.box() and DGSponsors.adAttr()/tag() write them; no data-ad-game = the game in the address bar).
   DGAds.place(el, sponsorId, place, game) tags (or re-tags) an element by hand.

   Sending: counts wait in memory (and in localStorage, so a page change never loses them) and go out as ONE small
   merge-write per device per day:  adstats/day-YYYYMMDD/dev/{stats uid}
     { p:'web|ios|android', v:{'sponsor~place~game':n}, k:{same: taps}, m:{game:seconds}, r:{sponsor:1 first view this
       month}, y:{sponsor:1 first view this year}, sv/sk/sm: totals of v/k/m, c: number of writes, t: server time }
   at most every 2 minutes while there are new ad counts (or 10+ minutes of play time), shortly after the page is
   hidden, and on the next page after a page change (pagehide only saves; the next page sends). Days are Maldives time.
   Off (silently) where shared/stats.js is off: developer test host (localhost etc. unless the phone app sets
   window.DG_APP), ?ns= test tables, bots, Do Not Track / Global Privacy Control. Every error is swallowed. */
(function(){
'use strict';
if(window.DGAds)return;
var S=window.DGStats;
var H=location.hostname;
var APP=!!(window.DG_APP||location.protocol==='capacitor:'||(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()));
var LOCAL=!APP&&(/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(H)||/\.(localhost|test)$/.test(H)||location.protocol==='file:');
var OFF=true;try{OFF=LOCAL||!S||S.off||!S.fb||!window.IntersectionObserver||!window.MutationObserver||!window.Promise||!window.localStorage;}catch(e){OFF=true;}

var PLACES=['home_box','game_box','raalhu','plaque','credit'];
var GAMES=['home','digu','dhogu','bondi','ranga','dhashundhama','binveriya','atolls','dhihaeh','thaas','joker','juice','raalhu','quiz'];
var VIEW_MS=1000,COOL_MS=20000,SEND_MS=120000,TIME_SEND=600,CAP={v:400,k:60,m:900},LSQ='dg-ads-q',LSM='dg-ads-m';

function setAttrs(el,sid,place,game){
 if(!sid){el.removeAttribute('data-ad');return;}
 el.setAttribute('data-ad',sid);if(place)el.setAttribute('data-ad-place',place);
 if(game)el.setAttribute('data-ad-game',game);else el.removeAttribute('data-ad-game');}

if(OFF){window.DGAds={off:true,place:function(el,sid,place,game){try{if(el)setAttrs(el,sid,place,game);}catch(e){}},flush:function(){return Promise.resolve(false);},peek:function(){return {};}};return;}

/* ---------------- storage ---------------- */
function day(off){return new Date(Date.now()+5*3600e3-(off||0)*864e5).toISOString().slice(0,10).replace(/-/g,'');}
function jget(k){try{var o=JSON.parse(localStorage.getItem(k)||'{}');return o&&typeof o==='object'?o:{};}catch(e){return {};}}
function jset(k,o){try{localStorage.setItem(k,JSON.stringify(o));}catch(e){}}
var TAB=(function(){try{var t=sessionStorage.getItem('dg-ads-tab');if(!t){t=Math.random().toString(36).slice(2,10);sessionStorage.setItem('dg-ads-tab',t);}return t;}catch(e){return 't'+Math.random().toString(36).slice(2,8);}})();
var pend={};   /* day -> {v,k,m,r,y} */
function empty(b){for(var n in b)for(var k in b[n])return false;return true;}
function bucket(d){d=d||day();return pend[d]||(pend[d]={v:{},k:{},m:{},r:{},y:{}});}
function addMap(a,b){for(var k in b){var n=+b[k];if(n>0)a[k]=(a[k]||0)+n;}}
function merge(into,from){for(var d in from){if(!/^\d{8}$/.test(d)||!from[d])continue;var b=bucket(d),x=from[d];['v','k','m'].forEach(function(n){addMap(b[n],x[n]||{});});['r','y'].forEach(function(n){for(var k in (x[n]||{}))b[n][k]=1;});}}
function prune(){var y=day(1);for(var d in pend)if(d<y||empty(pend[d]))delete pend[d];}
/* this tab's waiting counts live under its own key, so two open tabs never overwrite each other */
function save(){var o=jget(LSQ);prune();if(Object.keys(pend).length)o[TAB]={ts:Date.now(),p:pend};else delete o[TAB];jset(LSQ,o);}
function adopt(){var o=jget(LSQ),now=Date.now(),ch=false;
 for(var id in o){var e=o[id];if(!e||typeof e!=='object'){delete o[id];ch=true;continue;}
  /* our own tab (the page before this one) or a tab that has been quiet for 10 minutes (closed) */
  if(id===TAB||now-(+e.ts||0)>600000){merge(pend,e.p||{});delete o[id];ch=true;}}
 if(ch)jset(LSQ,o);prune();save();}

/* "first view this month / year" markers, so the admin can count players reached without reading every device */
function reach(b,sid){var m=jget(LSM),d=day(),mo=d.slice(0,6),yr=d.slice(0,4);
 if(m.m!==mo){m.m=mo;m.ms={};}if(m.y!==yr){m.y=yr;m.ys={};}
 if(!m.ms[sid]){m.ms[sid]=1;b.r[sid]=1;}if(!m.ys[sid]){m.ys[sid]=1;b.y[sid]=1;}jset(LSM,m);}

/* ---------------- counting ---------------- */
var cool={};
function ids(el){var sid=el.getAttribute('data-ad')||'',place=el.getAttribute('data-ad-place')||'',game=el.getAttribute('data-ad-game')||'';
 if(!game){try{game=S.game&&S.game()||'';}catch(e){game='';}if(!game)game='home';}
 if(!/^[a-z0-9-]{1,32}$/.test(sid)||PLACES.indexOf(place)<0||GAMES.indexOf(game)<0)return null;
 return {sid:sid,key:sid+'~'+place+'~'+game};}
function view(el){var x=ids(el);if(!x)return;var now=Date.now();if(now-(cool[x.key]||0)<COOL_MS)return;cool[x.key]=now;
 var b=bucket();b.v[x.key]=(b.v[x.key]||0)+1;reach(b,x.sid);save();}
function tap(el){var x=ids(el);if(!x)return;var b=bucket();b.k[x.key]=(b.k[x.key]||0)+1;save();}

/* ---------------- views: IntersectionObserver + a 250 ms check while something is on screen ---------------- */
var els=[],tickT=0,scanT=0;
function shown(el){try{return el.checkVisibility?el.checkVisibility({opacityProperty:true,visibilityProperty:true}):true;}catch(e){return true;}}
var io=new IntersectionObserver(function(list){var now=Date.now();
 list.forEach(function(e){var s=e.target.__dga;if(!s)return;var on=e.isIntersecting&&e.intersectionRatio>=0.495;
  if(on&&!s.vis){s.since=now;s.sid=e.target.getAttribute('data-ad')||'';}
  if(!on){s.since=0;s.sid='';s.seen={};}
  s.vis=on;});
 run();},{threshold:[0,0.25,0.5,0.75,1]});
function reg(el){if(el.__dga)return;el.__dga={vis:false,since:0,sid:'',seen:{}};els.push(el);io.observe(el);}
function run(){if(tickT)return;for(var i=0;i<els.length;i++)if(els[i].__dga&&els[i].__dga.vis){tickT=setInterval(tick,250);return;}}
function tick(){var now=Date.now(),any=false;if(document.hidden)return;
 for(var i=0;i<els.length;i++){var el=els[i],s=el.__dga;if(!s||!s.vis||!el.isConnected)continue;any=true;
  var sid=el.getAttribute('data-ad')||'';
  if(!sid||sid!==s.sid||!shown(el)){s.sid=sid;s.since=now;continue;}
  if(!s.since){s.since=now;continue;}
  if(now-s.since>=VIEW_MS&&!s.seen[sid]){s.seen[sid]=1;try{view(el);}catch(e){}}}
 if(!any){clearInterval(tickT);tickT=0;}}
function scan(){scanT=0;try{var l=document.querySelectorAll('[data-ad]');for(var i=0;i<l.length;i++)reg(l[i]);
 els=els.filter(function(e){if(e.isConnected)return true;try{io.unobserve(e);}catch(x){}e.__dga=null;return false;});}catch(e){}}
new MutationObserver(function(){if(!scanT)scanT=setTimeout(scan,200);}).observe(document.documentElement,{childList:true,subtree:true});
/* hiding the page ends every screen visit; coming back starts new ones */
function resetVisits(){els.forEach(function(e){var s=e.__dga;if(s){s.seen={};s.since=s.vis?Date.now():0;}});}

/* ---------------- taps: a click on a real link inside a tagged ad, not after a swipe or a long press ---------------- */
var pd=null;
addEventListener('pointerdown',function(e){pd={x:e.clientX,y:e.clientY,t:Date.now(),moved:false};},true);
addEventListener('pointermove',function(e){if(pd&&!pd.moved&&Math.abs(e.clientX-pd.x)+Math.abs(e.clientY-pd.y)>10)pd.moved=true;},{capture:true,passive:true});
addEventListener('keydown',function(){pd=null;},true);
addEventListener('click',function(e){var p=pd;pd=null;try{
 var t=e.target,a=t&&t.closest&&t.closest('a[href]'),el=t&&t.closest&&t.closest('[data-ad]');if(!a||!el)return;
 if(!(el.contains(a)||a.contains(el)))return;var h=a.getAttribute('href')||'';if(!h||h==='#'||/^javascript:/i.test(h))return;
 if(p&&(p.moved||Date.now()-p.t>650))return;tap(el);}catch(x){}},true);

/* ---------------- sending ---------------- */
function split(m,cap){var take={},rest={},n=0;for(var k in m){var v=Math.max(0,Math.floor(+m[k]||0)),a=Math.min(v,cap-n);if(a>0){take[k]=a;n+=a;}if(v-a>0)rest[k]=v-a;}return [take,rest,n];}
function anyAds(){for(var d in pend){var b=pend[d];for(var k in b.v)return true;for(k in b.k)return true;}return false;}
function waitingSecs(){var n=0;try{n=S.peekTime?S.peekTime():0;}catch(e){}for(var d in pend)for(var g in pend[d].m)n+=+pend[d].m[g]||0;return n;}
function takeTimeInto(){try{var t=S.takeTime?S.takeTime():{},b=bucket();for(var g in t)if(GAMES.indexOf(g)>0&&t[g]>0)b.m[g]=(b.m[g]||0)+t[g];}catch(e){}}
var busy=false,lastSend=0;
function flush(){if(busy)return Promise.resolve(false);takeTimeInto();prune();
 var days=Object.keys(pend).filter(function(d){return !empty(pend[d]);});if(!days.length){save();return Promise.resolve(false);}
 busy=true;var plat='web';try{plat=S.platform();}catch(e){}
 /* take at most one capped batch per day; anything over the caps stays for the next send */
 var out={};days.forEach(function(d){var b=pend[d],o={},keep={v:{},k:{},m:{},r:{},y:{}};
  ['v','k','m'].forEach(function(n){var s=split(b[n],CAP[n]);o[n]=s[0];o['s'+n]=s[2];keep[n]=s[1];});
  o.r=b.r;o.y=b.y;out[d]=o;if(empty(keep))delete pend[d];else pend[d]=keep;});
 save();
 function back(){for(var d in out){var o=out[d],b=bucket(d);['v','k','m'].forEach(function(n){addMap(b[n],o[n]);});for(var k in o.r)b.r[k]=1;for(k in o.y)b.y[k]=1;}save();}
 return S.fb().then(function(f){var F=f.F;
  return Promise.all(Object.keys(out).map(function(d){var o=out[d],data={p:plat,t:F.serverTimestamp(),c:F.increment(1),sv:F.increment(o.sv),sk:F.increment(o.sk),sm:F.increment(o.sm)};
   ['v','k','m'].forEach(function(n){var x={},any=false;for(var k in o[n]){x[k]=F.increment(o[n][k]);any=true;}if(any)data[n]=x;});
   ['r','y'].forEach(function(n){var x={},any=false;for(var k in o[n]){x[k]=1;any=true;}if(any)data[n]=x;});
   return F.setDoc(F.doc(f.db,'adstats','day-'+d,'dev',f.uid),data,{merge:true});}));
 }).then(function(){busy=false;lastSend=Date.now();return true;},function(){busy=false;back();return false;});}

setInterval(function(){if(document.hidden||busy)return;if(anyAds()||waitingSecs()>=TIME_SEND)flush();},SEND_MS);
var hideT=0;
document.addEventListener('visibilitychange',function(){resetVisits();clearTimeout(hideT);
 /* a short wait: when the page is being left (pagehide follows at once), the next page sends instead */
 if(document.hidden)hideT=setTimeout(function(){if(anyAds()||waitingSecs()>=60)flush();else{takeTimeInto();save();}},400);});
addEventListener('pagehide',function(){clearTimeout(hideT);takeTimeInto();save();});
addEventListener('pageshow',function(e){if(e.persisted){pend={};adopt();resetVisits();}});

adopt();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();

window.DGAds={off:false,
 place:function(el,sid,place,game){try{if(!el)return;setAttrs(el,sid,place,game);if(sid)reg(el);}catch(e){}},
 flush:flush,
 peek:function(){return JSON.parse(JSON.stringify(pend));}};
})();
