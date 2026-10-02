/* Dhivehi Games background music (shared/bgm.js), used by the homepage and by Digu's menu screens.
   One track, M1 "Lagoon Pads" (original, generated live with Web Audio). The homepage plays it; when it opens Digu's
   Store, Boli or Sign in screen it hands the track's position over (sessionStorage 'dg-bgm', fresh for 10 s) and Digu
   carries on from there; Digu hands it back when the player returns home. Anything else (a game, Digu's own lobby)
   ends it. Mute is the site-wide 'dd-sfx' setting ('0' / 'off' = muted). Leaving or hiding the page stops it.
   API: DGBgm.init({btn, intro, revealEvent, autostart, menu}), DGBgm.handoff(), DGBgm.stop(), DGBgm.playing() */
(function(){try{
/* DGAudio: one shared AudioContext for the page, unlocked on the first gesture (same as in the intro sound script) */
window.DGAudio=window.DGAudio||(function(){
 var A={ctx:null,bus:null,ready:[],done:false,
  muted:function(){try{var v=localStorage.getItem('dd-sfx');return v==='0'||v==='off';}catch(e){return false;}},
  setMuted:function(m){try{localStorage.setItem('dd-sfx',m?'0':'1');}catch(e){}if(A.ctx){if(m){if(A.ctx.suspend)A.ctx.suspend();}else if(A.ctx.resume)A.ctx.resume();}},
  get:function(){if(A.ctx)return A.ctx;var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
   A.ctx=new AC();A.bus=A.ctx.createGain();A.bus.connect(A.ctx.destination);return A.ctx;},
  unlock:function(){var c=A.get();if(!c)return null;try{if(c.resume)c.resume();var b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);}catch(e){}return c;},
  onGesture:function(f){if(A.done)f();else A.ready.push(f);}};
 function gesture(){if(A.muted()||A.off)return;var c=A.ctx;if(c&&c.state==='running'&&A.done)return;A.unlock();
  if(!A.done){A.done=true;A.ready.splice(0).forEach(function(f){try{f();}catch(e){}});}}
 ['pointerdown','touchstart','keydown'].forEach(function(n){addEventListener(n,gesture,{capture:true,passive:true});});
 return A;})();
/* DGMusic: the site's background music, M1 "Lagoon Pads" (owner's choice, Oct 2026; samples: design-mockups/home-music).
   Original, generated live with Web Audio (no files, no noise): warm pads + soft bass + kalimba on the F major
   pentatonic, 64 BPM, a 60 s pass that repeats without a seam and varies a little each time.
   About -32 LUFS, peaks about -21 dBFS (measured by offline render). make(ctx, dest, 'M1') ->
   {on, ctx, start(sec), fadeIn(sec), fadeOut(sec), sch(until), pos(), cycle} */
window.DGMusic=window.DGMusic||(function(){
function mtof(m){return 440*Math.pow(2,(m-69)/12);}
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function pick(r,a){return a[Math.floor(r()*a.length)];}
var P={};
/* M1 Lagoon Pads: F major, 8 chords x 8 beats @64 = 60 s */
P.M1={bpm:64,beats:64,level:.179,padCut:1100,padLevel:.18,bright:1.7,det:7,att:3,rel:3.5,bass:.22,pluckLevel:.32,pluckCut:3200,wet:.6,rt:1.6,
 chords:[[41,[53,57,60,64]],[38,[53,57,60,64]],[46,[50,53,57,62]],[36,[55,57,60,65]],
         [45,[53,57,60,67]],[43,[53,58,62,69]],[46,[53,57,60,62]],[36,[55,60,62,65]]],
 mel:[[[0,69],[1,72],[2,74],[3.5,72],[5,69]],
      [[0,74],[1.5,72],[3,69],[6,65]],
      [[0,74],[1,77],[2,74],[3,72],[4.5,69]],
      [[0,72],[2,67],[4,69],[7,72]],
      [[0,81],[1,79],[2,77],[4,72],[6,74]],
      [[0,74],[1.5,77],[3,74],[5,69]],
      [[0,72],[1,74],[2,77],[4,74],[5.5,72]],
      [[0,67],[2,72],[4,74]]],
 compose:function(c,r){var E=[],me=this;
  this.chords.forEach(function(ch,i){E.push({k:'pad',b:i*8,d:8,n:ch[1],bass:ch[0]});
   me.mel[i].forEach(function(n,j){
    if(c%3===2&&j>0&&r()<.3)return;                               /* every third pass breathes: fewer notes */
    var v=(j===0?.9:.65)+r()*.15;E.push({k:'pl',b:i*8+n[0],m:n[1],v:v,pan:pick(r,[-1,0,1])});
    if(c%2===1&&r()<.28)E.push({k:'pl',b:i*8+n[0]+1.5,m:n[1]+12,v:v*.35,pan:pick(r,[-1,1])}); /* soft echo an octave up */
   });});
  return E;}};

function make(ctx,dest,name){
 var p=P[name||'M1'],sr=ctx.sampleRate,i,beat=60/p.bpm,cycLen=p.beats*beat,R=Math.random;
 /* sum -> air lowpass -> master (fade x level) -> dest (no compressor: the levels are fixed by design) */
 var sum=ctx.createGain(),air=ctx.createBiquadFilter();air.type='lowpass';air.frequency.value=6500;air.Q.value=.5;
 var master=ctx.createGain();master.gain.value=0;sum.connect(air);air.connect(master);master.connect(dest);
 /* room: one smooth, dark MONO tail (no hiss), 15 ms pre-delay; the right side hears it 9 ms later */
 var L=Math.round(sr*p.rt),ir=ctx.createBuffer(1,L,sr),rr=rng(11),pre=Math.round(sr*.015);
 /* the tail's (1-u)^2.4 curve is computed every 32 samples and joined with straight lines (the same curve, far cheaper) */
 (function(){var o=ir.getChannelData(0),lp=0,lp2=0,ea=0,eb=Math.pow(1-pre/L,2.4),k=0,B=32;for(i=pre;i<L;i++){var u=i/L;
  if(k===0){ea=eb;eb=Math.pow(Math.max(0,1-(i+B)/L),2.4);}var ev=ea+(eb-ea)*k/B;k=(k+1)%B;
  lp+=(rr()*2-1-lp)*(.42-.34*u);lp2+=(lp-lp2)*.5;o[i]=lp2*ev*Math.min(1,(i-pre)/(sr*.03));}})();
 var send=ctx.createGain();send.channelCount=1;send.channelCountMode='explicit';send.channelInterpretation='speakers';
 var conv=ctx.createConvolver();conv.buffer=ir;var ret=ctx.createGain();ret.gain.value=p.wet;
 var mg=ctx.createChannelMerger(2),dl=ctx.createDelay(.05);dl.delayTime.value=.009;
 send.connect(conv);conv.connect(ret);ret.connect(mg,0,0);ret.connect(dl);dl.connect(mg,0,1);mg.connect(sum);
 function panner(x){if(!ctx.createStereoPanner)return ctx.createGain();var n=ctx.createStereoPanner();n.pan.value=x;return n;}
 /* pads: chord tones spread left/right, gently detuned against each other -> slowly breathing lowpass */
 var padF=ctx.createBiquadFilter();padF.type='lowpass';padF.frequency.value=p.padCut;padF.Q.value=.6;
 var lfo=ctx.createOscillator();lfo.frequency.value=.037;var lfoG=ctx.createGain();lfoG.gain.value=p.padCut*.3;lfo.connect(lfoG);lfoG.connect(padF.frequency);
 try{padF.frequency.automationRate='k-rate';}catch(e){}   /* per-block filter updates: much cheaper on phones */
 var padG=ctx.createGain();padG.gain.value=p.padLevel;var padL=panner(-.45),padR=panner(.45);
 padL.connect(padF);padR.connect(padF);padF.connect(padG);padG.connect(sum);var padS=ctx.createGain();padS.gain.value=.55;padG.connect(padS);padS.connect(send);
 var bassG=ctx.createGain();bassG.gain.value=p.bass;bassG.connect(sum);
 var N=10,re=new Float32Array(N+1),im=new Float32Array(N+1);for(i=1;i<=N;i++)im[i]=1/Math.pow(i,p.bright);
 var W=ctx.createPeriodicWave(re,im),BW=ctx.createPeriodicWave(new Float32Array(3),new Float32Array([0,1,.28]));
 /* kalimba: three pan positions -> lowpass -> level, with plenty of room */
 var plF=ctx.createBiquadFilter();plF.type='lowpass';plF.frequency.value=p.pluckCut;plF.Q.value=.5;
 var plG=ctx.createGain();plG.gain.value=p.pluckLevel;plF.connect(plG);plG.connect(sum);
 var plS=ctx.createGain();plS.gain.value=.7;plG.connect(plS);plS.connect(send);
 var pans=[panner(-.35),panner(0),panner(.35)];pans.forEach(function(n){n.connect(plF);});
 lfo.start();
 function env(g,t,a,peak,hold,rel){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.setValueAtTime(peak,t+hold);g.gain.linearRampToValueAtTime(0,t+hold+rel);}
 function osc(t,end,wave,f,det,peak,hold,out){var o=ctx.createOscillator(),g=ctx.createGain();o.setPeriodicWave(wave);o.frequency.value=f;o.detune.value=det;
  env(g,t,p.att,peak,hold,p.rel);o.connect(g);g.connect(out);o.start(t);o.stop(end);}
 function pad(t,d,notes,bass){var hold=Math.max(p.att,d*beat),end=t+hold+p.rel+.05,a=.62/notes.length,top=notes.length-1;
  notes.forEach(function(m,k){var s=k%2?1:-1;osc(t,end,W,mtof(m),s*p.det+R()*2-1,a,hold,s>0?padR:padL);
   if(k===top)osc(t,end,W,mtof(m),-s*p.det,a*.8,hold,s>0?padL:padR);});
  if(bass&&p.bass)osc(t,end,BW,mtof(bass),0,.5,hold,bassG);}
 /* every kalimba note is rendered ONCE into a small buffer at the context's own rate, then just played back */
 var BUF={},PARTS=[[1,1,1.0],[2,.1,.3],[5.93,.05,.07]];
 function pluckBuf(m){if(BUF[m])return BUF[m];var f=mtof(m),len=Math.round(sr*2.6),b=ctx.createBuffer(1,len,sr),d=b.getChannelData(0),at=Math.round(sr*.012),ft=Math.round(sr*.3);
  /* each partial is a decaying sine, made with a two-term recurrence instead of a sin() per sample (same wave) and
     stopped once it has faded below a millionth */
  PARTS.forEach(function(q){var fq=f*q[0];if(fq>9000)return;var w=2*Math.PI*fq/sr,dk=Math.exp(-1/(sr*q[2])),
   n=Math.min(len,Math.ceil(Math.log(1e-6/q[1])/Math.log(dk))),c1=2*dk*Math.cos(w),c2=dk*dk,y0=0,y1=q[1]*dk*Math.sin(w),y;
   if(n>1)d[1]+=y1;for(i=2;i<n;i++){y=c1*y1-c2*y0;d[i]+=y;y0=y1;y1=y;}});
  for(i=0;i<at;i++)d[i]*=i/at;for(i=len-ft;i<len;i++)d[i]*=(len-i)/ft;return BUF[m]=b;}
 function pluck(t,m,v,pan){var src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=pluckBuf(m);g.gain.value=v;src.connect(g);g.connect(pans[pan+1]);src.start(t);}
 function play(e){var now=ctx.currentTime;
  /* resuming part-way: a chord that is already under way comes in now for the rest of its length; past notes are skipped */
  if(e.t<now-.05){if(e.k!=='pad')return;var left=e.d*beat-(now-e.t);if(left>.5)pad(now+.02,left/beat,e.n,e.bass);return;}
  /* never schedule into the past (a fresh context's clock starts near 0) */
  if(e.k==='pad')pad(Math.max(now,e.t),e.d,e.n,e.bass);else pluck(Math.max(now,e.t+(R()-.5)*.03),e.m,e.v,e.pan);}
 /* scheduler: compose a whole pass at a time, play what falls inside the look-ahead window.
    A suspended context's clock stops, so nothing piles up while the page is away. */
 var T0=null,gen=0,q=[];
 function sch(until){if(T0===null)T0=ctx.currentTime+.15;
  while(T0+gen*cycLen<until){var ev=p.compose(gen,rng(1009+gen*7919)),base=T0+gen*cycLen;
   ev.forEach(function(e){e.t=base+e.b*beat;q.push(e);});gen++;q.sort(function(a,b){return a.t-b.t;});}
  while(q.length&&q[0].t<until)play(q.shift());}
 function fade(to,sec){var n=ctx.currentTime;master.gain.cancelScheduledValues(n);master.gain.setValueAtTime(master.gain.value,n);master.gain.linearRampToValueAtTime(to,n+sec);}
 var tm=0,api={on:false,ctx:ctx,sch:sch,level:p.level,cycle:cycLen,master:master,
  pos:function(){return T0===null?0:((ctx.currentTime-T0)%cycLen+cycLen)%cycLen;},
  /* seconds since the track began (all passes), the position handed from page to page */
  elapsed:function(){return T0===null?0:Math.max(0,ctx.currentTime-T0);},
  /* start(fadeSec, at): at = seconds into the track to begin from (only before the first start) */
  start:function(sec,at){if(T0===null&&at>0){T0=ctx.currentTime+.05-at;gen=Math.floor(at/cycLen);}api.on=true;sch(ctx.currentTime+2);clearInterval(tm);tm=setInterval(function(){if(api.on)sch(ctx.currentTime+2);},500);fade(p.level,sec==null?3:sec);},
  fadeIn:function(sec){fade(p.level,sec||1.5);},
  fadeOut:function(sec){fade(0,sec||.3);},
  /* stop for good: fade out fast, stop scheduling, then unplug */
  stop:function(){api.on=false;clearInterval(tm);fade(0,.08);setTimeout(function(){try{master.disconnect();}catch(e){}},200);},
  /* old ambience hooks (no longer used): keep them harmless */
  bloop:function(){},sink:function(){},slosh:function(){},plink:function(){},tick:function(){}};
 return api;}
return {make:make,presets:P};
})();

/* ---- the player (behaviour of the homepage music, plus the hand-over between pages) ----
   ON by default, it needs one tap or key press first (browsers allow audio only after a gesture). On the homepage a tap
   during the intro unlocks it but the music waits for the end of the intro (dg-revealed), then fades in over 3 s.
   A hand-over resumes at once with a short fade, or, if the browser still wants a tap, silently on the first tap.
   Hard stop: leaving the page (tab hidden, app switched, page hidden or frozen) fades it out fast and SUSPENDS the
   AudioContext; it comes back only when the page is visible again and sound is on. ---- */
var KEY='dg-bgm',TRACK='M1',FRESH=10000;
var sound=null,btn=null,waiting=false,hT=0,playing=false,ended=false,from=0,opt={},inited=false;
function introOn(){return !!(opt.intro&&opt.intro());}
function away(){return document.hidden||document.visibilityState==='hidden';}
window.__dMakeSound=function(c,dest){return DGMusic.make(c,dest||c.destination,'M1');};   /* for level checks (offline rendering) */
/* the hand-over: {id, pos (seconds into the track), at (ms timestamp)} */
function take(){var h=null;try{h=JSON.parse(sessionStorage.getItem(KEY)||'null');sessionStorage.removeItem(KEY);}catch(e){}
 return h&&h.id===TRACK&&h.pos>=0&&Date.now()-h.at<FRESH?h:null;}
function handoff(){try{if(ended||DGAudio.muted()||!(playing||from>0||waiting)){sessionStorage.removeItem(KEY);return;}
 sessionStorage.setItem(KEY,JSON.stringify({id:TRACK,pos:+(sound&&playing?sound.elapsed():from).toFixed(2),at:Date.now()}));}catch(e){}}
function startSound(fade){var c=DGAudio.get();if(!c||DGAudio.muted()||ended)return;
 if(playing&&sound&&sound.on){if(!away()&&c.state!=='running'&&c.resume)c.resume();return;}
 if(!sound){sound=DGMusic.make(c,DGAudio.bus||c.destination,TRACK);window.__d3snd=sound;}
 sound.on=true;if(away())return;
 if(introOn()){waiting=true;return;}              /* never over the intro: dg-revealed starts it */
 waiting=false;clearTimeout(hT);if(c.resume)c.resume();sound.start(fade==null?3:fade,from);from=0;playing=true;}
/* resume a handed-over position: a fresh copy of the track starts part-way in */
function resumeAt(h){if(sound){try{sound.stop();}catch(e){}sound=null;}playing=false;from=h.pos;if(!DGAudio.muted())startSound(.6);}
/* leaving: quick fade, then suspend (at once when the page is being hidden or frozen: timers may never run again) */
function hush(now){var c=DGAudio.ctx;if(!c)return;if(sound)sound.fadeOut(now?.06:.25);clearTimeout(hT);
 if(now){try{c.suspend();}catch(e){}}else hT=setTimeout(function(){if(away()&&c.state!=='closed')try{c.suspend();}catch(e){}},300);}
/* back: resume and fade in, only if the sound is on (and not during the intro) */
function back(){var c=DGAudio.ctx;if(!c||away()||!sound||!sound.on||ended||DGAudio.muted())return;clearTimeout(hT);
 if(c.resume)c.resume();if(introOn())waiting=true;else sound.fadeIn(1.5);}
function paintBtn(){if(!btn)return;var on=!DGAudio.muted();btn.setAttribute('aria-pressed',on?'true':'false');btn.classList.toggle('on',on);
 btn.setAttribute('aria-label',on?'Sound on. Tap to mute':'Sound off. Tap to turn on');btn.title=on?'Mute':'Sound on';}
/* the end of the music on this page (Digu: a game or the lobby); it never starts again here */
function stop(){if(ended)return;ended=true;DGAudio.off=true;waiting=false;from=0;try{sessionStorage.removeItem(KEY);}catch(e){}
 if(sound){sound.stop();playing=false;}var c=DGAudio.ctx;if(c)setTimeout(function(){try{if(c.state==='running')c.suspend();}catch(e){}},250);}
/* a hand-over starts just after the page's first paint, in a task of its own (never inside the page's loading work) */
function later(f){var go=function(){setTimeout(f,0);};if(window.requestAnimationFrame&&!away())requestAnimationFrame(go);else go();}
/* a hand-over resumes in three small steps, each in a task of its own: open the audio context, build the synth, play */
function resumeSoon(){later(function(){if(ended||DGAudio.muted())return;var c=DGAudio.get();if(!c)return;
 later(function(){if(!sound&&!ended){sound=DGMusic.make(c,DGAudio.bus||c.destination,TRACK);window.__d3snd=sound;}later(function(){startSound(.6);});});});}
function init(o){if(inited)return;inited=true;opt=o||{};btn=opt.btn||null;
 var h=take();
 if(opt.revealEvent)addEventListener(opt.revealEvent,function(){if(waiting&&sound&&sound.on&&!DGAudio.muted())startSound(from>0?.6:3);});
 document.addEventListener('visibilitychange',function(){if(away())hush(false);else back();});
 addEventListener('pagehide',function(){if(opt.menu)handoff();hush(true);});
 document.addEventListener('freeze',function(){hush(true);});
 addEventListener('blur',function(){if(away())hush(false);});
 /* back to a page kept in the browser's memory: carry on from a fresh hand-over, else from where this page was */
 addEventListener('pageshow',function(e){if(!e.persisted)return;var g=take();if(g&&!ended)resumeAt(g);else back();});
 document.addEventListener('resume',function(){back();});
 /* safety net: if a hidden page is still running (a missed event), stop it; the mute setting changed elsewhere on the page */
 setInterval(function(){var c=DGAudio.ctx;if(c&&away()&&c.state==='running')hush(true);
  if(playing&&sound&&sound.on&&DGAudio.muted()){sound.on=false;sound.fadeOut(.15);playing=false;}},1000);
 paintBtn();
 if(opt.menu){
  /* Digu's menu screens: only a fresh hand-over plays; it starts now if the browser allows, else on the first tap */
  if(h&&!DGAudio.muted()){from=h.pos;resumeSoon();DGAudio.onGesture(function(){if(!ended&&!DGAudio.muted())startSound(.6);});}
  else{ended=true;DGAudio.off=true;}
  return;}
 /* on by default: the first gesture anywhere starts the music (unless muted) */
 if(h&&!DGAudio.muted()){from=h.pos;resumeSoon();}
 DGAudio.onGesture(function(){if(!DGAudio.muted())startSound(from>0?.6:3);});
 /* native app wrapper: autoplay allowed */
 if(opt.autostart&&(window.Capacitor||/DhivehiGamesApp/.test(navigator.userAgent))&&!DGAudio.muted())startSound(from>0?.6:3);
 /* the button is a mute toggle */
 if(btn)btn.addEventListener('click',function(){
  var mute=!DGAudio.muted();DGAudio.setMuted(mute);
  if(mute){if(sound){sound.on=false;sound.fadeOut(.15);}waiting=false;playing=false;}else{DGAudio.unlock();startSound();}
  paintBtn();
 });}
window.DGBgm={init:init,handoff:handoff,stop:stop,playing:function(){return playing&&!!sound&&sound.on;},
 sound:function(){return sound;},ctx:function(){return DGAudio.ctx;}};
}catch(e){}})();
