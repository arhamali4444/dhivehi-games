/* Dhivehi Games · first-party visitor counts (privacy-friendly, no third parties).
   Once per device per day it writes  stats/day-YYYYMMDD/visitors/{id}   = {t, g, n}
   and once per device per month      stats/month-YYYYMM/visitors/{id}   = {t, g, n}
     t = server time of the first visit, g = which games were opened (e.g. ['home','digu']),
     n = true if this is the device's first counted visit (new vs returning).
   No names, no IP, no device details. {id} is a separate anonymous Firebase account used ONLY for this
   (app "dg-stats"), so it never touches the player's own sign-in or the games' Firebase app.
   Opening a new game adds it to g with one small update; each game is written at most once per day
   (remembered in localStorage "dg-stats"). Days follow Maldives time (UTC+5).
   Loads after the page is idle, never blocks, and gives up silently on any error.
   Skipped on localhost / file: (but counted inside the phone app, which runs at https://localhost or capacitor://localhost), on test namespaces (?ns=), for bots, and with Do Not Track / Global Privacy Control.
   Rules: see extras/firestore-rules-admin.txt (match /stats/{period}/visitors/{id}).
   Pages can report an in-page game switch with DGStats.mark('ranga'). */
(function(){
'use strict';
if(window.DGStats)return;
var H=location.hostname,Q=new URLSearchParams(location.search);
var APP=!!(window.DG_APP||location.protocol==='capacitor:'||(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()));   /* a local host name means a developer test machine, but NEVER inside the phone app (https://localhost, capacitor://localhost): the app is production */
var LOCAL=!APP&&(/^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(H)||/\.(localhost|test)$/.test(H)||location.protocol==='file:');
var OFF=LOCAL||Q.has('ns')||navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true||
 /bot|crawl|spider|slurp|lighthouse|headless|prerender/i.test(navigator.userAgent||'')||!window.Promise||!window.localStorage;
var KEYS=['home','digu','dhogu','bondi','ranga','dhashundhama','binveriya','atolls','dhihaeh','thaas','joker','juice','raalhu'];
var FBV='https://www.gstatic.com/firebasejs/12.19.0/';
var CFG={apiKey:'AIzaSyCl9Xz5r80755hYX0ww2GRaB6TZTH6sayE',authDomain:'dhivehi-digu.firebaseapp.com',projectId:'dhivehi-digu',storageBucket:'dhivehi-digu.firebasestorage.app',messagingSenderId:'778464006205',appId:'1:778464006205:web:7dce5d63707c6b2d0eda54'};
var LSK='dg-stats';

function gameFromUrl(){var seg=(location.pathname.split('/').filter(Boolean)[0]||'').toLowerCase(),mode=(Q.get('mode')||'').toLowerCase();
 if(!seg||seg==='index.html')return 'home';
 if(seg==='bondi')return mode==='ranga'?'ranga':'bondi';
 if(seg==='dhihaeh')return mode==='thaas'?'thaas':'dhihaeh';
 return KEYS.indexOf(seg)>=0?seg:'';}
function mvt(){return new Date(Date.now()+5*3600e3).toISOString();}
function load(){try{var s=JSON.parse(localStorage.getItem(LSK)||'{}');return s&&typeof s==='object'?s:{};}catch(e){return{};}}
function save(){try{localStorage.setItem(LSK,JSON.stringify(st));}catch(e){}}
function uniq(a){var o=[];a.forEach(function(x){if(o.indexOf(x)<0)o.push(x);});return o;}

var st=load(),queue=[],timer=0,busy=false,again=false,fbP=null;

function fb(){if(fbP)return fbP;
 fbP=Promise.all([import(FBV+'firebase-app.js'),import(FBV+'firebase-auth.js'),import(FBV+'firebase-firestore.js')]).then(function(m){
  var A=m[0],U=m[1],F=m[2];var app=A.getApps().filter(function(a){return a.name==='dg-stats';})[0]||A.initializeApp(CFG,'dg-stats');
  var auth=(APP&&U.initializeAuth)?(function(){try{return U.initializeAuth(app,{persistence:[U.indexedDBLocalPersistence,U.browserLocalPersistence]});}catch(e){return U.getAuth(app);}})():U.getAuth(app);
  return (auth.authStateReady?auth.authStateReady():Promise.resolve()).catch(function(){}).then(function(){
   return auth.currentUser||U.signInAnonymously(auth).then(function(c){return c.user;});
  }).then(function(u){return{F:F,db:F.getFirestore(app),uid:u.uid};});
 }).catch(function(e){fbP=null;throw e;});return fbP;}

/* write (or extend) one period doc; okK/gK are the localStorage flags for that period */
function put(f,period,okK,gK,games,isNew){var F=f.F,ref=F.doc(f.db,'stats',period,'visitors',f.uid);
 var have=st[gK]||[],add=games.filter(function(g){return have.indexOf(g)<0;});
 function done(){st[okK]=1;st[gK]=uniq(have.concat(add));save();}
 if(!st[okK]){var g=uniq(have.concat(add));
  return F.setDoc(ref,{t:F.serverTimestamp(),g:g,n:!!isNew}).then(done,function(){
   /* the doc already exists (e.g. storage was cleared today): just add the games */
   return F.updateDoc(ref,{g:F.arrayUnion.apply(null,g)}).then(done);});}
 if(!add.length)return Promise.resolve();
 return F.updateDoc(ref,{g:F.arrayUnion.apply(null,add)}).then(done,function(e){
  if(e&&e.code==='not-found'){st[okK]=0;return put(f,period,okK,gK,games,isNew);}throw e;});}

function flush(){
 var now=mvt(),d='day-'+now.slice(0,10).replace(/-/g,''),m='month-'+now.slice(0,7).replace(/-/g,'');
 if(st.d!==d){st.d=d;st.dg=[];st.dOk=0;}
 if(st.m!==m){st.m=m;st.mg=[];st.mOk=0;}
 var games=queue.slice();queue=[];
 var needD=!st.dOk||games.some(function(g){return st.dg.indexOf(g)<0;}),needM=!st.mOk||games.some(function(g){return st.mg.indexOf(g)<0;});
 if(!needD&&!needM)return Promise.resolve();
 return fb().then(function(f){
  if(st.id&&st.id!==f.uid){st.dOk=0;st.mOk=0;st.dg=[];st.mg=[];}
  st.id=f.uid;var isNew=!st.seen;
  return put(f,d,'dOk','dg',games,isNew).then(function(){return put(f,m,'mOk','mg',games,isNew);}).then(function(){st.seen=1;save();});
 }).catch(function(){games.forEach(function(g){if(queue.indexOf(g)<0)queue.push(g);});});}

function run(){timer=0;if(busy){again=true;return;}busy=true;
 flush().then(function(){busy=false;if(again){again=false;schedule(1500);}});}
function schedule(delay){if(timer||OFF)return;
 var go=function(){if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:10000});else setTimeout(run,1);};
 timer=1;
 var later=function(){setTimeout(go,delay);};
 if(document.readyState==='complete')later();else addEventListener('load',later,{once:true});}

function mark(g){if(OFF)return;g=String(g||'').toLowerCase();if(KEYS.indexOf(g)<0)return;
 if(queue.indexOf(g)<0)queue.push(g);
 var now=mvt(),d='day-'+now.slice(0,10).replace(/-/g,'');
 /* already counted today for this game: nothing to do (no network, no Firebase) */
 if(st.d===d&&st.dOk&&(st.dg||[]).indexOf(g)>=0&&st.mOk&&(st.mg||[]).indexOf(g)>=0&&st.m==='month-'+now.slice(0,7).replace(/-/g,'')){queue=queue.filter(function(x){return x!==g;});return;}
 schedule(4000);}

window.DGStats={mark:mark,off:OFF};
mark(gameFromUrl());
})();
