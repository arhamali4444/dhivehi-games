/* =====================================================================================
   DGDice · shared 3D dice for Dhivehi Games                            shared/dice.js  v1
   Load it before the game's own script:   <script src="../shared/dice.js?v=1"></script>
   (bump ?v= in every game that uses it whenever this file changes)

   Binveriya's thrown dice (Oct 2026), moved into one file so every board game can use them:
   - two 3D cubes (six CSS faces, pips as small domes, a core so no gap shows at an edge);
   - the throw is PRE-SIMULATED once (arc, 2-3 bounces of decreasing height, rim hits, die-die knocks,
     friction), then played back with transforms only, landing flat on the result the ENGINE already chose;
   - the walls are the VISIBLE part of the tray: the tray clipped to the visual viewport, minus the notch /
     rounded-corner / home-bar insets and a small pad, and they allow for the perspective lift (a die high in
     the air is drawn bigger, so it is kept further in). The dice are never off screen;
   - playback is fitted to about 1.1-1.5 s (smooth mode: at most 0.8 s, lower and simpler); a tap on the
     given hosts plays the rest 4x as fast and the dice settle with one knock;
   - doubles: a warm glow on the table under each die;
   - quiet wooden-table foley (WebAudio, all synthesised): a shake, every bounce at its own time and strength,
     then the settle. Mute is the site-wide dd-sfx key (missing = on, '0' / 'off' = off);
   - reduced motion: no throw, the result at once with one soft knock.

   USE
     const r = await DGDice.roll(trayEl, [3,5], {             // trayEl: an empty positioned box over the board
       size:[28,54], k:.12,     // die size in px: clamp(min, max, k * the visible tray's shorter side)
       speed:1,                 // playback rate (computer players: a little faster, e.g. 1.25)
       lite:undefined,          // smooth mode; default: dd-smooth, else the page's .dg-lite class / reduced motion
       rm:undefined,            // reduced motion; default: the media query
       vec:null,                // a flick {vx,vy} in px/s (optional)
       tapHosts:[el,...],       // pointerdown on these while rolling = play the rest fast (the tap is swallowed)
       sound:true});            // r = {instant:true} or {D, box, sim}
     DGDice.skip()   DGDice.end()   DGDice.rolling   DGDice.prepare(trayEl, opts) -> {W,H,D,box,lite}
     Building blocks (Binveriya's names): cubeHTML simThrow diceRot diceDraw diceBox SAFE FACE_R PIPS DPERS
     foley(sim, rate)   sfx: {on, unlock, rattle, hit, settle, dice, knock, tick, begin, end, cut, level}
   The tray needs no CSS of its own: .dtray / .d3 styles are added once, on first use (scoped to .dtray).
   ===================================================================================== */
(function(){'use strict';
if(window.DGDice)return;
const ls={get(k){try{return localStorage.getItem(k);}catch(e){return null;}}};
const RM=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};

/* ---------------------------------------------------------------- styles (added once) */
function css(){if(document.getElementById('dgdice-css'))return;const s=document.createElement('style');s.id='dgdice-css';
 s.textContent=`.dtray{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:9;perspective:900px;perspective-origin:50% 40%;opacity:0}
.dtray.on{opacity:1}.dtray.fade{opacity:0;transition:opacity .45s ease}
.dtray.dbl .d3::after{content:"";position:absolute;left:50%;top:50%;width:180%;height:180%;margin:-90% 0 0 -90%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,214,110,.8),rgba(255,214,110,.3) 55%,transparent);animation:dgdblglow 1.1s ease-out both;pointer-events:none}
@keyframes dgdblglow{0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.05)}100%{opacity:0;transform:scale(1.3)}}
.dtray .d3{position:absolute;left:0;top:0;width:var(--d);height:var(--d);transform-style:preserve-3d;will-change:transform}
.dtray .d3s{position:absolute;inset:6%;border-radius:32%;background:radial-gradient(closest-side,rgba(2,24,32,.6),rgba(2,24,32,.25) 60%,transparent);will-change:transform,opacity}
.dtray .d3c{position:absolute;inset:0;transform-style:preserve-3d;--h:calc(var(--d)/2);will-change:transform}
.dtray .d3c .fc{position:absolute;inset:0;border-radius:21%;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:radial-gradient(120% 120% at 28% 22%,#FFFFFF 0%,#F8F2E6 50%,#E4D8C0 100%);box-shadow:inset 0 0 calc(var(--d)*.1) rgba(120,90,40,.28),inset 0 0 0 1px rgba(255,255,255,.7)}
.dtray .d3c .fc b{position:absolute;width:19%;height:19%;margin:-9.5% 0 0 -9.5%;border-radius:50%;background:radial-gradient(circle at 42% 38%,#434845,#0E1311 72%);box-shadow:inset 0 calc(var(--d)*.015) calc(var(--d)*.02) rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.7)}
.dtray .d3c .fc b.r{width:23%;height:23%;margin:-11.5% 0 0 -11.5%;background:radial-gradient(circle at 42% 38%,#E0534A,#8E1D18 75%)}
.dtray .d3c .core{position:absolute;inset:3%;border-radius:12%;background:#EFE6D3}`;
 (document.head||document.documentElement).appendChild(s);}

/* ---------------------------------------------------------------- sound: Binveriya's wooden-table foley (the dice part) */
const sfx=(()=>{let ctx=null,out=null,dry=null,wet=null,nbuf=null,lvl=.5,grp=null;
 const off=v=>v==='0'||v==='off';
 const on=()=>{const a=ls.get('dd-sfx');return a!=null?!off(a):ls.get('bv-sound')!=='0';};
 function ac(){if(!on())return null;try{if(!ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();
   const comp=ctx.createDynamicsCompressor();comp.threshold.value=-20;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.15;
   out=ctx.createGain();out.gain.value=lvl;comp.connect(out);out.connect(ctx.destination);dry=ctx.createGain();dry.connect(comp);
   /* a small wooden room: 0.45 s of decaying stereo noise, darkened */
   const sr=ctx.sampleRate,len=sr*.45|0,ir=ctx.createBuffer(2,len,sr);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=i<sr*.006?0:(Math.random()*2-1)*Math.pow(1-i/len,3.4);}
   const cv=ctx.createConvolver();cv.buffer=ir;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3600;wet=ctx.createGain();wet.gain.value=.16;wet.connect(cv);cv.connect(lp);lp.connect(comp);}
  if(ctx.state==='suspended')ctx.resume();}catch(e){return null;}return ctx;}
 const R=(a,b)=>a+Math.random()*(b-a);
 /* sounds made between begin() and end() share one gain, so a skipped throw can be silenced mid-way */
 const bus=g=>{if(grp){g.connect(grp);return;}g.connect(dry);g.connect(wet);};
 function nz(dt,dur,o){const c=ac();if(!c)return;if(!nbuf){nbuf=c.createBuffer(1,c.sampleRate|0,c.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const t=c.currentTime+Math.max(0,dt),s=c.createBufferSource();s.buffer=nbuf;
  const fl=c.createBiquadFilter();fl.type=o.type||'bandpass';fl.frequency.setValueAtTime(o.f,t);if(o.to)fl.frequency.exponentialRampToValueAtTime(o.to,t+dur);fl.Q.value=o.q||1;
  const g=c.createGain(),a=o.a||.0015;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.vol,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(a+.005,dur));
  s.connect(fl);fl.connect(g);bus(g);s.start(t,Math.random()*.6);s.stop(t+dur+.05);}
 function rs(dt,f,dur,vol,to){const c=ac();if(!c)return;const t=c.currentTime+Math.max(0,dt),os=c.createOscillator(),g=c.createGain();os.frequency.setValueAtTime(f,t);if(to)os.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.0015);g.gain.exponentialRampToValueAtTime(.0001,t+dur);os.connect(g);bus(g);os.start(t);os.stop(t+dur+.05);}
 function modal(dt,f,modes,v){modes.forEach(([k,d,a])=>rs(dt,f*k*R(.993,1.007),d*R(.85,1.15),a*v));}
 const WOOD=[[1,.07,.11],[2.31,.045,.06],[3.9,.03,.035],[6.1,.018,.02]];
 function knock(dt,v,f){nz(dt,.03,{f:f*R(.9,1.1),q:3.2,vol:.5*v});nz(dt,.012,{type:'highpass',f:4200,q:.7,vol:.2*v});rs(dt,R(170,230),.05,.1*v);}
 function wood(dt,v,f){nz(dt,.018,{f:f*R(.9,1.1),q:2.5,vol:.34*v});modal(dt,R(190,240),WOOD,v);}
 function clack(dt,v){nz(dt,.02,{f:R(2800,3700),q:6,vol:.42*v});nz(dt,.01,{type:'highpass',f:5200,vol:.18*v});rs(dt,R(5200,6400),.012,.02*v);}
 function swish(dt,dur,v){nz(dt,dur,{f:500,to:1900,q:.9,vol:.05*v,a:dur*.55});}
 /* inside a tap / key press: resume, and (iOS Safari) play a silent buffer to unlock the output */
 function unlock(){if(document.hidden||!on())return;const c=ac();if(!c||(c._primed&&c.state==='running'))return;c._primed=1;try{if(c.state!=='running'){const p=c.resume();p&&p.catch&&p.catch(()=>{});}}catch(e){}try{const b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);}catch(e){}}
 ['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,unlock,{capture:true,passive:true}));
 const api={get on(){return on();},unlock,
  level(v){lvl=v;if(out)out.gain.value=v;},
  begin(){const c=ac();if(!c)return null;grp=c.createGain();grp.connect(dry);grp.connect(wet);return grp;},end(){grp=null;},
  cut(h){if(!h||!ctx)return;try{h.gain.setTargetAtTime(0,ctx.currentTime,.012);}catch(e){}},
  /* two dice shaken in a cupped hand, then the whoosh of the throw */
  rattle(){nz(0,.22,{type:'lowpass',f:750,vol:.034,a:.05});[0,.1].forEach((t0,s)=>{const n=3+(Math.random()*2|0);for(let i=0;i<n;i++)clack(t0+i*R(.014,.03),R(.22,.4)*(1-s*.2));});swish(.12,.16,.9);},
  /* one impact: t = time, s = impact speed 0..1, k = table / board rim / other die */
  hit(t,s,k){const v=.12+.88*s;if(k==='t'){wood(t,v*.9,R(1500,2300));nz(t,.008,{type:'highpass',f:5000,vol:.1*v});rs(t,R(115,150),.07,.07*v);}else if(k==='w')wood(t,v*.7,R(900,1300));else clack(t,v);},
  /* settling: the die rocks on an edge a couple of times, quicker and softer, then lies flat */
  settle(t){[0,.05,.085,.105].forEach((d,i)=>wood(t+d,.14*Math.pow(.6,i),R(2300,3000)));},
  /* a whole throw without the animation */
  dice(){api.rattle();[.3,.43,.53,.6].forEach((t,i)=>api.hit(t,.8-i*.2,i===1?'d':'t'));api.settle(.68);},
  /* reduced motion: the dice are just there, with one soft knock */
  knock(){wood(0,.3,R(1700,2100));knock(.02,.12,2400);},
  tick(){knock(0,.09,2600);}};
 return api;})();
/* the foley for one pre-simulated throw, played at rate x; returns a handle so a skipped throw can be silenced */
function foley(sim,rate=1){const h=sfx.begin();try{sfx.rattle();let last=-1;sim.dies.flatMap(x=>x.hits).sort((a,b)=>a[0]-b[0]).forEach(x=>{if(x[0]-last>.035){sfx.hit(x[0]/rate,x[1],x[2]);last=x[0];}});sfx.settle(sim.T/rate);}finally{sfx.end();}return h;}

/* ---------------------------------------------------------------- the cubes */
const PIPS={1:[[50,50]],2:[[28,28],[72,72]],3:[[26,26],[50,50],[74,74]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]]};
const FACE_R={1:[0,0],6:[0,180],2:[0,-90],5:[0,90],3:[-90,0],4:[90,0]};
const DPERS=900;/* the tray's perspective (px), origin at 50% 40% */
const pipsHTML=n=>PIPS[n].map(([x,y])=>`<b style="left:${x}%;top:${y}%"${n===1?' class="r"':''}></b>`).join('');
function cubeHTML(){const f=(n,t)=>`<div class="fc" style="transform:${t} translateZ(var(--h))">${pipsHTML(n)}</div>`;
 return `<div class="d3s"></div><div class="d3c">${f(1,'')}${f(6,'rotateY(180deg)')}${f(2,'rotateY(90deg)')}${f(5,'rotateY(-90deg)')}${f(3,'rotateX(90deg)')}${f(4,'rotateX(-90deg)')}<i class="core"></i><i class="core" style="transform:rotateY(90deg)"></i><i class="core" style="transform:rotateX(90deg)"></i></div>`;}
/* safe-area insets (notch, rounded corners, home bar) as numbers: top, right, bottom, left */
const SAFE=(()=>{let pr=null;return ()=>{try{if(!pr||!pr.isConnected){pr=document.createElement('div');pr.setAttribute('aria-hidden','true');
  pr.style.cssText='position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';document.body.appendChild(pr);}
  const cs=getComputedStyle(pr);return [cs.paddingTop,cs.paddingRight,cs.paddingBottom,cs.paddingLeft].map(v=>parseFloat(v)||0);}catch(e){return [0,0,0,0];}};})();
/* the part of a tray the player can actually see, in the tray's own px: tray ∩ visual viewport, minus insets and a small pad */
function diceBox(tray,pad=4){const r=tray.getBoundingClientRect(),vv=window.visualViewport,[st,sr,sb,sl]=SAFE();
 const vx=vv?vv.offsetLeft:0,vy=vv?vv.offsetTop:0,vw=vv?vv.width:innerWidth,vh=vv?vv.height:innerHeight;
 const L=Math.max(r.left,vx+sl)+pad,T=Math.max(r.top,vy+st)+pad,Rr=Math.min(r.right,vx+vw-sr)-pad,B=Math.min(r.bottom,vy+vh-sb)-pad;
 return [L-r.left,T-r.top,Math.max(L+1,Rr)-r.left,Math.max(T+1,B)-r.top];}
function simThrow(W,H,D,vec,o={}){const box=o.box||[4,4,W-4,H-4],lite=!!o.lite,P=DPERS,Ox=W/2,Oy=H*.4,E=D*.87;
 const[bx0,by0,bx1,by1]=box,BW=Math.max(D*2,bx1-bx0),BH=Math.max(D*2,by1-by0),sc=Math.max(.7,Math.min(1.45,Math.min(BW,BH)/360));
 /* walls for a die centred at height z: its whole projected hull (radius E, magnified by the perspective) stays in the box */
 const lim=(z,a0,a1,O)=>{const zc=z+D*.71,kc=P/(P-zc),r=E*P/(P-(zc+E));let lo=O+(a0+r-O)/kc,hi=O+(a1-r-O)/kc;if(lo>hi)lo=hi=(lo+hi)/2;return [lo,hi];};
 let ang,spd;const vs=vec?Math.hypot(vec.vx,vec.vy):0;
 if(vs>260){ang=Math.atan2(vec.vy,vec.vx);spd=Math.min(1350,Math.max(760,vs*.85));}else{ang=-Math.PI/2+(Math.random()-.5)*.7;spd=880+Math.random()*240;}
 if(Math.sin(ang)>-.35)ang=-Math.PI/2+(Math.cos(ang)>=0?.95:-.95);/* always thrown away from the player */
 if(lite)spd*=.72;
 const cx=(bx0+bx1)/2,cy=(by0+by1)/2,ca=Math.cos(ang),sa=Math.sin(ang);
 const dies=[0,1].map(k=>{const a=ang+(k?.15:-.15)+(Math.random()-.5)*.14,s=spd*sc*(.88+Math.random()*.24),off=(k?1:-1)*D*.62,z=D*(lite?.5:1+Math.random()*.4);
  const d={x:cx-ca*BW*.32-sa*off+(Math.random()-.5)*D*.3,y:cy-sa*BH*.32+ca*off+(Math.random()-.5)*D*.3,z,vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:D*(lite?2.2:3.6+Math.random()*1.2),frames:[],hits:[]};
  const[lx,hx]=lim(z,bx0,bx1,Ox),[ly,hy]=lim(z,by0,by1,Oy);d.x=Math.min(hx,Math.max(lx,d.x));d.y=Math.min(hy,Math.max(ly,d.y));return d;});
 const g=-D*55,dt=1/120,REST=lite?.3:.42,TMAX=lite?1.3:2.4;let t=0;
 const walls=(d,t)=>{const hv=Math.min(1,Math.hypot(d.vx,d.vy)/(D*26)),[lx,hx]=lim(d.z,bx0,bx1,Ox),[ly,hy]=lim(d.z,by0,by1,Oy);
  if(d.x<lx){d.x=lx;if(d.vx<0){d.vx=-d.vx*.5;d.hits.push([t,hv,'w']);}}else if(d.x>hx){d.x=hx;if(d.vx>0){d.vx=-d.vx*.5;d.hits.push([t,hv,'w']);}}
  if(d.y<ly){d.y=ly;if(d.vy<0){d.vy=-d.vy*.5;d.hits.push([t,hv,'w']);}}else if(d.y>hy){d.y=hy;if(d.vy>0){d.vy=-d.vy*.5;d.hits.push([t,hv,'w']);}}};
 for(let n=0;n<120*TMAX;n++){t+=dt;
  for(const d of dies){d.vz+=g*dt;d.z+=d.vz*dt;
   if(d.z<=0){d.z=0;if(d.vz<-D*2.2){d.hits.push([t,Math.min(1,-d.vz/(D*9)),'t']);d.vz=-d.vz*REST;d.vx*=.82;d.vy*=.82;}else d.vz=0;}
   const on=d.z===0&&d.vz===0,sp=Math.hypot(d.vx,d.vy);if(sp>0){const ns=Math.max(0,sp-(on?D*(lite?30:22):D*1.5)*dt);d.vx*=ns/sp;d.vy*=ns/sp;}
   d.x+=d.vx*dt;d.y+=d.vy*dt;walls(d,t);}
  const A=dies[0],Bd=dies[1],dx=Bd.x-A.x,dy=Bd.y-A.y,dist=Math.hypot(dx,dy);
  if(dist>0&&dist<D*1.05&&Math.abs(A.z-Bd.z)<D*.8){const nx=dx/dist,ny=dy/dist,ov=(D*1.05-dist)/2;A.x-=nx*ov;A.y-=ny*ov;Bd.x+=nx*ov;Bd.y+=ny*ov;
   const va=A.vx*nx+A.vy*ny,vb=Bd.vx*nx+Bd.vy*ny;if(va>vb){const dv=(va-vb)*.9;A.vx-=dv*nx;A.vy-=dv*ny;Bd.vx+=dv*nx;Bd.vy+=dv*ny;A.hits.push([t,Math.min(1,dv/(D*20)),'d']);}
   walls(A,t);walls(Bd,t);}
  for(const d of dies)d.frames.push([d.x,d.y,d.z]);
  if(t>.5&&dies.every(d=>d.z===0&&d.vz===0&&Math.hypot(d.vx,d.vy)<D*.25))break;}
 for(const d of dies){let L=0;d.Ls=[0];for(let j=1;j<d.frames.length;j++){const p=d.frames[j-1],q=d.frames[j];L+=Math.hypot(q[0]-p[0],q[1]-p[1],(q[2]-p[2])*1.6);d.Ls.push(L);}d.L=L||1;}
 return {dies,T:t,D,lite};}
/* how each die tumbles onto its result: roll axis across its first travel, a turn that fits the distance rolled,
   a little random yaw and wobble, and one rock as it settles */
function diceRot(d,sim,rnd=Math.random){return d.map((n,k)=>{const[rx,ry]=FACE_R[n]||FACE_R[1],dd=sim.dies[k],f0=dd.frames[0],f1=dd.frames[Math.min(14,dd.frames.length-1)];
 let ax=-(f1[1]-f0[1]),ay=f1[0]-f0[0];const l=Math.hypot(ax,ay);if(l<1e-3){ax=1;ay=0;}else{ax/=l;ay/=l;}
 const turns=Math.max(sim.lite?1.2:2,Math.min(sim.lite?2.5:5,dd.L/sim.D*.26));
 return {rx,ry,yaw:(rnd()-.5)*36,ax,ay,az:(rnd()-.5)*.6,th:turns*360+(rnd()-.5)*50,rock:sim.lite?0:4+rnd()*4};});}
/* one frame of a pre-simulated throw at time t (seconds): position, tumble and shadow of each die */
function diceDraw(sim,rot,nodes,D){const lite=sim.lite;return function(t){const idx=Math.round(t*120);sim.dies.forEach((dd,k)=>{const j=Math.max(0,Math.min(dd.frames.length-1,idx-1)),f=dd.frames[j],p=dd.Ls[j]/dd.L,r=rot[k],el=nodes[k];
   let th=r.th*(1-p)*(1-p*.35);if(p>.9&&p<1)th-=r.rock*Math.sin(Math.PI*(p-.9)/.1);
   /* a tipping cube stands on an edge: lift the centre so it never sinks into the table */
   const ph=(Math.abs(th)%90)*Math.PI/180,lift=D/2*(Math.abs(Math.cos(ph))+Math.abs(Math.sin(ph)));
   el.style.transform=`translate3d(${(f[0]-D/2).toFixed(1)}px,${(f[1]-D/2).toFixed(1)}px,0)`;
   el.children[1].style.transform=`translateZ(${(f[2]+lift).toFixed(1)}px) rotate3d(${r.ax.toFixed(3)},${r.ay.toFixed(3)},${r.az.toFixed(3)},${th.toFixed(1)}deg) rotateZ(${r.yaw.toFixed(1)}deg) rotateX(${r.rx}deg) rotateY(${r.ry}deg)`;
   const z=f[2]/D;el.children[0].style.transform=`translate3d(${(z*D*.35).toFixed(1)}px,${(z*D*.5).toFixed(1)}px,0) scale(${(1+z*.3).toFixed(3)})`;if(!lite)el.children[0].style.opacity=Math.max(.15,.62-z*.18).toFixed(2);});};}

/* ---------------------------------------------------------------- one throw, start to finish */
function isLite(){const v=ls.get('dd-smooth');if(v==='1')return true;if(v==='0')return false;return RM.matches||document.documentElement.classList.contains('dg-lite');}
/* the size and walls a throw in this tray would use now */
function prepare(tray,o){o=o||{};const W=tray.clientWidth,H=tray.clientHeight,lite=o.lite!=null?!!o.lite:isLite(),box=diceBox(tray,o.pad==null?4:o.pad);
 const bw=box[2]-box[0],bh=box[3]-box[1],sz=o.size||[28,54],D=Math.round(Math.max(sz[0],Math.min(sz[1],Math.min(bw,bh)*(o.k||.12))));return {W,H,D,box,lite};}
let CUR=null;const TT=new WeakMap();
function clearTray(tray){(TT.get(tray)||[]).forEach(clearTimeout);TT.set(tray,[]);tray.classList.remove('on','fade','dbl');tray.innerHTML='';}
function later(tray,f,ms){const a=TT.get(tray)||[];a.push(setTimeout(f,ms));TT.set(tray,a);}
function roll(tray,d,o){o=o||{};css();if(CUR)CUR.end();if(!tray)return Promise.resolve({instant:true});clearTray(tray);tray.classList.add('dtray');
 const rm=o.rm!=null?!!o.rm:RM.matches,snd=o.sound!==false;
 if(rm||document.hidden||!tray.clientWidth||!tray.clientHeight){if(snd)sfx.knock();return Promise.resolve({instant:true});}
 const pr=prepare(tray,o),{W,H,D,box,lite}=pr;tray.style.setProperty('--d',D+'px');
 tray.innerHTML=`<div class="d3">${cubeHTML()}</div><div class="d3">${cubeHTML()}</div>`;tray.classList.add('on');
 const sim=simThrow(W,H,D,o.vec||null,{box,lite}),rot=diceRot(d,sim);
 /* fit the playback to ~1.1-1.5 s (never slower than 0.8x; smooth mode: at most 0.8 s); the sound follows the same clock */
 const Tp=(lite?Math.min(sim.T,.8):Math.min(1.5,Math.max(sim.T,Math.min(1.1,sim.T/.8))))/(o.speed||1),rate=sim.T/Tp;
 const fx=snd?foley(sim,rate):null;
 const nodes=Array.from(tray.querySelectorAll('.d3')),draw=diceDraw(sim,rot,nodes,D);draw(0);
 DGDice.last={W,H,D,box,lite,sim};
 return new Promise(res=>{let t0=performance.now(),st=0,sp=rate,done=false,sk=false;
  const simAt=now=>st+(now-t0)/1000*sp;
  /* a tap while they roll: the rest plays 4x as fast, then the dice settle with one knock */
  const skip=e=>{if(done||sk)return;sk=true;if(e&&e.stopImmediatePropagation){e.stopImmediatePropagation();e.preventDefault&&e.cancelable&&e.preventDefault();}const now=performance.now();st=simAt(now);t0=now;sp=rate*4;
   if(snd){sfx.cut(fx);sfx.settle(Math.max(0,(sim.T-st)/sp));}clearTimeout(safety);safety=setTimeout(fin,(sim.T-st)/sp*1000+300);};
  const hosts=(o.tapHosts||[]).filter(Boolean),unhook=()=>hosts.forEach(h=>h.removeEventListener('pointerdown',skip,true));hosts.forEach(h=>h.addEventListener('pointerdown',skip,true));
  const me={skip:()=>skip(null),end(){if(done)return;done=true;clearTimeout(safety);unhook();if(CUR===me)CUR=null;res({D,box,sim,cut:true});}};CUR=me;
  function fr(now){if(done)return;const t=simAt(now);draw(Math.min(t,sim.T));if(t<sim.T)requestAnimationFrame(fr);else fin();}
  function fin(){if(done)return;done=true;clearTimeout(safety);unhook();if(CUR===me)CUR=null;draw(sim.T);
   if(d[0]&&d[0]===d[1])tray.classList.add('dbl');
   later(tray,()=>res({D,box,sim}),o.hold==null?200:o.hold);later(tray,()=>tray.classList.add('fade'),1100);later(tray,()=>{tray.classList.remove('on','fade','dbl');tray.innerHTML='';},1600);}
  let safety=setTimeout(fin,Tp*1000+300);requestAnimationFrame(fr);});}

window.DGDice={version:1,PIPS,FACE_R,DPERS,pipsHTML,cubeHTML,SAFE,diceBox,simThrow,diceRot,diceDraw,foley,sfx,isLite,prepare,roll,css,last:null,
 skip(){if(CUR)CUR.skip();},end(){if(CUR)CUR.end();},get rolling(){return !!CUR;}};
})();
