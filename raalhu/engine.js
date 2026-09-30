/* =====================================================================
   RAALHU RUMBLE Â· race engine (pure, no DOM, deterministic track from a seed)
   One straight run, 3 lanes, 2 to 6 runners, about 100 seconds, told as a journey in 4 acts:
   1 sunny beach, 2 the storm rolls in (lightning strikes a lane), 3 into the trees: dusk, then night (bats swoop),
   4 sunrise: dawn breaks, the runners leave the trees and finish on a bright beach by the water.
   In the forest coconuts also fall: a shadow grows in a lane, then the coconut drops into the lit road.
   Every hazard comes from the seeded track: lightning and bats are a schedule in race time (lane + moment),
   so every phone sees the same strike at the same moment; each applies to the runners inside its act.
   Used by index.html (window.RRE) and by the node simulations (module.exports).
   Runner control: ctl 'me' (this device's player), 'ai' (computer, simulated here),
   'net' (another phone; its state is set by the page from network updates).
   authority=true: this copy decides hits (vs computer, or the online host).
   authority=false: an online client; throws/bumps are only requests, the host decides.
   ===================================================================== */
(function(G){'use strict';
var SEG=2,LANE=1.25,HALF=2.1,LEN=1390,WZ=.95,WB=1,WN=1.1;
var clamp=function(v,a,b){return v<a?a:v>b?b:v;},lerp=function(a,b,t){return a+(b-a)*t;},sm=function(t){t=clamp(t,0,1);return t*t*(3-2*t);};
function rng(seed){var a=seed>>>0||1;return function(){a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
var laneX=function(l){return (l-1)*LANE;};

/* ---------- obstacles: what each one needs ---------- */
var OB={
 crab:   {need:'jump', w:.95,h:.6, label:'Crab'},
 coco:   {need:'jump', w:1.05,h:.62,label:'Coconuts'},
 lounger:{need:'jump', w:1.15,h:.78,label:'Sun lounger'},
 dhoni:  {need:'move', w:1.4, h:2.2,label:'Beached dhoni'},
 net:    {need:'slide',w:1.45,h:2.1,label:'Fishing net'},
 /* a palm beside the track tips over and falls across all three lanes as the leader comes near; jump the trunk */
 fall:   {need:'jump', all:1,w:5.6,h:.7, label:'Falling palm'},
 gap:    {need:'jump', all:1,fall:1,w:4.4,h:0,label:'Jetty gap'},
 /* the forest: a low branch across one lane at head height */
 branch: {need:'slide',w:1.5,h:2,label:'Low branch'}
};
/* the four acts along the track (metres): storm builds from s0, lightning between z0 and z1, the forest starts at f0,
   bats between b0 and b1, lanterns light the last stretch of forest from clr, dawn breaks and the trees end at e0
   (the sunrise beach, with the finish on the sand by the water) */
function actsOf(len){var s0=Math.round(len*.229),f0=Math.round(len*.488),e0=Math.round(len*.755);
 return{s0:s0,z0:s0+50,z1:f0-8,f0:f0,b0:f0+95,b1:e0-45,n0:f0+25,n1:e0-30,clr:e0-60,e0:e0};}
function inZap(T,z){return z>=T.acts.z0&&z<T.acts.z1;}
function inBat(T,z){return z>=T.acts.b0&&z<T.acts.b1;}
/* falling coconuts: the forest at dusk and at night (n0..n1) */
function inNut(T,z){return z>=T.acts.n0&&z<T.acts.n1;}
var IN=[inZap,inBat,inNut],WHY=['bolt','bat','nut'];
/* weather levels at a place on the track (0..1): for the picture and the sound only */
function wxAt(T,z){var A=T.acts,up=sm((z-(A.e0-85))/75);return{storm:sm((z-A.s0)/70)*(1-sm((z-(A.f0-25))/55)),rain:sm((z-(A.s0+25))/45)*(1-sm((z-(A.f0-12))/34)),
 forest:sm((z-(A.f0-30))/40)*(1-sm((z-(A.e0-12))/34)),dusk:sm((z-A.f0)/70)*(1-sm((z-(A.e0-60))/60)),night:sm((z-(A.f0+55))/80)*(1-up),
 clear:sm((z-A.clr)/45)*(1-sm((z-A.e0)/30)),dawn:sm((z-(A.e0-90))/50)*(1-sm((z-(A.e0+35))/90)),mist:sm((z-(A.e0-80))/40)*(1-sm((z-(A.e0+5))/60)),sun:sm((z-(A.e0+20))/80)};}
var CRATES=['throw','bump','shield'];

/* ---------- track ---------- */
function makeTrack(seed,len){
 len=len||LEN;var R=rng(seed),N=Math.ceil((len+460)/SEG)+4;
 var head=new Float32Array(N),cx=new Float32Array(N+1),shore=new Float32Array(N),zone=new Uint8Array(N),sz=new Uint8Array(N);
 /* stretches in metres: [start, type] ; 0 beach, 1 water's edge, 2 jetty */
 var AC=actsOf(len),st=[[0,0]],z=70,last=0,jetty=0,water=0;
 /* the beach (acts 1 and 2), then the forest to the end (act 3) */
 while(z<AC.f0-40){var t;
  if(!jetty&&z>len*.16)t=2;else if(last!==1&&(water<1||R()<.55))t=1;else t=0;
  if(t===2&&z>AC.f0-170)t=last===1?0:1;
  var L=t===2?100+R()*28:t===1?64+R()*36:48+R()*34;
  if(t===2)jetty=1;if(t===1)water++;
  st.push([z,t]);z+=L;last=t;}
 st.push([z,0]);st.push([AC.f0,3]);
 /* act 4: out of the trees onto the beach again (sand and the water's edge; the finish is on the sand by the water) */
 z=AC.e0;last=-1;while(z<len-70){var t4=last===0?1:0;st.push([z,t4]);z+=t4===1?60+R()*30:44+R()*26;last=t4;}
 st.push([Math.max(z,len-70),4]);
 var i=0,h0=0,s0=11;
 for(var k=0;k<st.length;k++){var a=Math.round(st[k][0]/SEG),b=k+1<st.length?Math.round(st[k+1][0]/SEG):N,tt=st[k][1];
  var hT=tt===2?(R()*2-1)*.07:tt===3?(R()*2-1)*.16:tt===4?0:(R()*2-1)*.2,sT=tt===0?7+R()*9:tt===1?2.75:tt===3?40:tt===4?5.2:-15,Ls=Math.max(1,b-a);
  /* type 4 = the finish beach: sand close to the water (zone 0) */
  for(i=a;i<b&&i<N;i++){var q=i-a;head[i]=lerp(h0,hT,sm(q/(Ls*.5)));shore[i]=lerp(s0,sT,sm(q/Math.min(Ls,7)));sz[i]=tt===4?0:tt;}
  h0=hT;s0=sT;}
 for(i=0;i<N;i++){zone[i]=(sz[i]===2||shore[i]<HALF+.35)?2:sz[i];cx[i+1]=cx[i]+head[i]*SEG;}
 var T={seed:seed,len:len,N:N,head:head,cx:cx,shore:shore,zone:zone,obs:[],pk:[],deco:[],stretches:st,acts:AC,zaps:[],bats:[],eyes:[]};
 /* obstacles: never in the first 80 m, closer together later in the race */
 var n=0,lastAll=-99;z=84;
 while(z<len-42){
  var zo=zoneAt(T,z),storm=z>=AC.s0&&z<AC.f0,dawnB=z>=AC.e0,pool=zo===3?['crab','coco','branch','coco','crab','branch','fall','coco']:zo===2?['gap','net','crab','coco','gap','net']:zo===1?['fall','crab','coco','net','crab','fall']:['crab','coco','lounger','dhoni','net','fall','dhoni','lounger','coco'];
  var ty=pool[Math.floor(R()*pool.length)],d=OB[ty];
  /* in the storm the palms fall less often (lightning is the extra thing to watch) */
  if(storm&&ty==='fall'&&R()<.55){ty=zo===1?'crab':'coco';d=OB[ty];}
  /* the sunrise beach: the beach obstacles again, the palms fall a little less often */
  if(dawnB&&ty==='fall'&&R()<.35){ty=zo===1?'crab':'lounger';d=OB[ty];}
  /* whole-track obstacles need their own zone all around them, and some room from the last one */
  if(d.all){var bad=ty==='gap'?(zoneAt(T,z-4)!==2||zoneAt(T,z+4)!==2):(zoneAt(T,z-4)===2||zoneAt(T,z+4)===2||zoneAt(T,z+8)===2);if(bad||z-lastAll<22){ty=zo===2?'crab':zo===1?'coco':'lounger';d=OB[ty];}}
  if(d.all){T.obs.push({z:z,lane:-1,t:ty,id:n++});lastAll=z;}
  else{var two=R()<(.28+.36*z/len),a0=Math.floor(R()*3);T.obs.push({z:z,lane:a0,t:ty,id:n++});
   if(two){var b0=(a0+1+Math.floor(R()*2))%3,t2=pool[Math.floor(R()*pool.length)];if(OB[t2].all)t2=zo===2?'net':'crab';
   /* storm and forest: never two lane-blockers side by side, so a lightning or bat lane always leaves a way through */
   if(t2==='dhoni'&&(storm||zo===3))t2='coco';T.obs.push({z:z+(R()<.5?0:3),lane:b0,t:t2,id:n++});}}
  z+=lerp(31,21,z/len)+R()*8+(z>=AC.s0&&z<AC.e0?3:0);
 }
 T.obs.sort(function(a,b){return a.z-b.z||a.id-b.id;});
 /* ability crates (each runner can take every crate once) */
 for(z=46;z<len-34;z+=44+R()*24){var zc=z;for(var p=0;p<T.obs.length;p++){if(Math.abs(T.obs[p].z-zc)<7)zc=T.obs[p].z+9;}
  if(zc>len-30)break;var r=R();T.pk.push({z:zc,lane:Math.floor(R()*3),k:r<.4?'throw':r<.74?'bump':'shield',i:T.pk.length});z=zc;}
 /* scenery */
 var lastLan=-99;
 for(z=-34;z<len+440;z+=stp){
  var zo2=zoneAt(T,z),stp=zo2===3?2.4+R()*2.6:4.2+R()*7,sh=shoreAt(T,z),rr=R(),fl=R()<.5?1:0;
  /* the forest tunnel: dense trees on both sides; the lantern-lit clearing at the finish */
  if(zo2===3){var clr=z>AC.clr&&z<AC.e0;
   for(var sd=-1;sd<=1;sd+=2){
    if(!clr||R()<.25){var r3=R(),kd=r3<.24?'palm':r3<.4?'bfruit':r3<.54?'banyan':r3<.64?'palm2':r3<.84?'fern':'bush';
     T.deco.push({z:z+R()*1.5,x:sd*(HALF+1.3+R()*2.4+(kd==='banyan'||kd==='bfruit'?1.6:0)),t:kd,f:R()<.5?1:0});}
    if(R()<.6){var r4=R();T.deco.push({z:z+1.2,x:sd*(HALF+(clr?8:5.5)+R()*7),t:r4<.35?'palm':r4<.6?'bfruit':r4<.85?'banyan':'palm2',f:R()<.5?1:0});}}
   if(clr&&z-lastLan>5.5){lastLan=z;T.deco.push({z:z,x:HALF+.9,t:'lantern',f:0});T.deco.push({z:z+.5,x:-(HALF+.9),t:'lantern',f:1});}
   continue;}
  if(zo2===2){T.deco.push({z:z,x:-(HALF+.16),t:'post'});T.deco.push({z:z,x:HALF+.16,t:'post'});
   if(R()<.14)T.deco.push({z:z+1,x:-(HALF+.16),t:'lamp'});
   if(-sh>HALF+4&&R()<.55)T.deco.push({z:z,x:-sh+2.5+R()*5,t:R()<.7?'palm':'palm2',f:fl});
   if(R()<.1)T.deco.push({z:z+2,x:-(HALF+3+R()*6),t:'buoy'});
   if(R()<.05)T.deco.push({z:z+2,x:-(HALF+7+R()*5),t:'boat',f:fl});
   continue;}
  if(z>len-40&&z<len+30){if(R()<.8){T.deco.push({z:z,x:HALF+.9,t:'flag',f:fl});T.deco.push({z:z,x:-(HALF+.9),t:'flag',f:1-fl});}}
  var kind=rr<.44?'palm':rr<.56?'palm2':rr<.66?'bush':rr<.74?'parasol':rr<.8?'hut':rr<.86?'rock':rr<.92?'kayak':rr<.96?'flowers':'lounger2';
  T.deco.push({z:z,x:HALF+2.2+R()*6,t:kind,f:fl});
  if(R()<.35)T.deco.push({z:z+3,x:HALF+9+R()*8,t:R()<.8?'palm':'hut',f:1-fl});
  if(sh>6.2&&R()<.55){var room=sh-HALF-2.2;T.deco.push({z:z+2,x:-HALF-1.2-R()*Math.max(.4,room),t:R()<.3?'palm2':R()<.5?'shells':R()<.7?'rock':R()<.85?'castle':'star',f:fl});}
  if(zo2===1&&R()<.3)T.deco.push({z:z+1,x:-(sh+2.5+R()*6),t:R()<.6?'buoy':'rocksea'});
  if(R()<.22)T.deco.push({z:z+1.5,x:HALF+.7+R()*1.2,t:R()<.5?'shells':'star',f:fl});
 }
 T.deco.sort(function(a,b){return a.z-b.z;});
 /* lightning and bats: one schedule in race time from the seed (lane + moment). A strike or a swoop only touches
    runners inside its act (lightning: z0..z1, bats: b0..b1). At least 1.6 s apart, each with its own warning. */
 var RH=rng((seed*31+17)>>>0),t2;
 for(t2=12;t2<175;t2+=1.65+RH()*1.1)T.zaps.push({t:+t2.toFixed(2),lane:Math.floor(RH()*3),i:T.zaps.length});
 /* the forest at night: one schedule shared by bats and falling coconuts (about 1 in 3 is a coconut), at least 1.6 s
    apart, so only one forest hazard is ever being warned about at a time. A coconut's shadow grows for WN s, then it drops. */
 T.nuts=[];var RN=rng((seed*41+29)>>>0);
 for(t2=30;t2<175;t2+=1.6+RN()*1.2){var nut=RN()<.36,ln=Math.floor(RN()*3),e2={t:+t2.toFixed(2),lane:ln};
  if(nut){e2.i=T.nuts.length;T.nuts.push(e2);}else{e2.i=T.bats.length;T.bats.push(e2);}}
 /* glowing eyes in the dark beside the forest track (harmless decoration; seeded so every phone matches) */
 var RE=rng((seed*13+5)>>>0);
 for(z=AC.f0+30;z<AC.e0-50;z+=2.4+RE()*4.5){var sd2=RE()<.5?-1:1;T.eyes.push({z:z,x:sd2*(HALF+2.2+RE()*6.5),y:.3+RE()*(RE()<.3?2.6:1.1),k:Math.floor(RE()*4),s:.75+RE()*.6,ph:RE()*10,bl:2.5+RE()*4,dr:(RE()-.5)*.5});}
 return T;
}
function idx(T,z){var f=z/SEG;if(f<0)f=0;var i=f|0;if(i>=T.N-1)i=T.N-2;return[i,f-i];}
function cxAt(T,z){if(z<0)return T.head[0]*z;var a=idx(T,z);return lerp(T.cx[a[0]],T.cx[a[0]+1],a[1]);}
function headAt(T,z){var a=idx(T,z);return lerp(T.head[a[0]],T.head[a[0]+1],a[1]);}
function shoreAt(T,z){var a=idx(T,z);return lerp(T.shore[a[0]],T.shore[a[0]+1],a[1]);}
function zoneAt(T,z){var i=Math.max(0,Math.min(T.N-1,Math.floor(z/SEG)));return T.zone[i];}

/* ---------- race ---------- */
var DIFF={easy:{skill:[.6,.72],pace:[.95,.968]},normal:{skill:[.78,.88],pace:[.972,.988]},hard:{skill:[.9,.97],pace:[.988,1]}};
function Race(o){o=o||{};
 this.seed=o.seed||12345;this.len=o.len||LEN;this.track=makeTrack(this.seed,this.len);
 this.t=-(o.countdown==null?3:o.countdown);this.runners=[];this.proj=[];this.fx=[];this.ev=[];
 this.R=rng((this.seed*7+3)>>>0);this.authority=o.authority!==false;this.pid=0;this.over=false;
 this.hz=0;this.hb=0;this.hn=0;this.hwz=0;this.hwb=0;this.hwn=0;}
Race.prototype.add=function(p){
 var r={id:this.runners.length,name:p.name||'Runner',ctl:p.ctl||(p.me?'me':'ai'),me:!!p.me,skill:p.skill||.85,pace:p.pace||1,
  lane:p.lane==null?1:p.lane,x:0,z:p.z||0,y:0,vy:0,slide:0,stum:0,inv:0,fall:0,fallX:0,water:0,dash:0,sh:0,speed:0,
  fin:false,finT:0,place:1,ch:{throw:1,bump:1,shield:0},face:0,faceK:'',oi:0,pi:0,plan:null,planO:null,aiT:.8+this.R()*2,lean:0,
  hits:0,dunks:0,crates:0,got:{},inputs:0,zap:0,avoidL:-1,avoidT:0,hzK:''};
 r.x=laneX(r.lane);this.runners.push(r);return r;};
Race.prototype.base=function(){return 11.2+4*sm(this.t/32);};
Race.prototype.laneOf=function(r){return clamp(Math.round(r.x/LANE)+1,0,2);};
Race.prototype.local=function(r){return r.ctl!=='net';};
Race.prototype.canAct=function(r){return !(r.fall>0||r.fin||this.t<0);};
Race.prototype.move=function(r,d){if(r.fall>0||r.fin||this.t<-.5)return;var n=clamp(r.lane+d,0,2);r.inputs++;if(n!==r.lane){r.lane=n;r.lean=d;this.ev.push({t:'lane',r:r});}};
Race.prototype.jump=function(r){if(r.fall>0||r.fin||this.t<0)return;r.inputs++;if(r.y<=0.001){r.vy=7.3;r.slide=0;this.ev.push({t:'jump',r:r});}};
Race.prototype.duck=function(r){if(r.fall>0||r.fin||this.t<0)return;r.inputs++;if(r.y>0.05)r.vy=-13;if(r.slide<=0)this.ev.push({t:'slide',r:r});r.slide=.66;};
/* a hit from an obstacle or a rival; a raised shell shield blocks it and pops */
Race.prototype.hit=function(r,why,by){
 if(r.fall>0||r.fin)return false;
 if(r.sh>0){r.sh=0;r.inv=Math.max(r.inv,.5);this.ev.push({t:'block',r:r,why:why,by:by});return false;}
 if(r.inv>0)return false;
 r.speed*=why==='bump'?.55:.4;r.stum=why==='bump'?.6:1;r.inv=1.3;r.face=1.1;r.faceK='hit';r.hits++;
 this.ev.push({t:'hit',r:r,why:why,by:by});return true;};
Race.prototype.dunk=function(r,side,by){
 if(r.fall>0||r.fin)return false;
 r.fall=1.5;r.face=1.6;r.faceK='hit';r.water=1;r.fallX=side<0?-(HALF+1.3):HALF+1.3;r.speed=0;r.y=0;r.vy=0;r.slide=0;r.sh=0;r.dunks++;
 this.ev.push({t:'splash',r:r,x:r.fallX,z:r.z,by:by});return true;};
Race.prototype.throwCo=function(r){
 if(r.ch.throw<=0||!this.canAct(r))return false;r.ch.throw--;r.inputs++;
 var q={id:++this.pid,z:r.z+.7,x:r.x,y:1.05,vy:2.2,v:Math.max(r.speed,8)+21,o:r.id,life:1.7,sp:0,real:this.authority};
 this.proj.push(q);this.ev.push({t:'throw',r:r,q:q});return true;};
Race.prototype.shield=function(r){
 if(r.ch.shield<=0||!this.canAct(r)||r.sh>0)return false;r.ch.shield--;r.inputs++;r.sh=5;this.ev.push({t:'shield',r:r});return true;};
/* bump: pick the closest rival beside or just ahead; the effect is computed by bumpFx and applied by applyBump
   (online clients only ask; the host works it out and tells the rival's phone) */
Race.prototype.bump=function(r){
 if(r.ch.bump<=0||!this.canAct(r))return false;r.ch.bump--;r.inputs++;r.dash=.55;
 if(!this.authority){this.ev.push({t:'bumpReq',r:r});return true;}
 var fx=this.bumpFx(r);this.ev.push({t:'bump',r:r,tg:fx?this.runners[fx.tg]:null,fx:fx});
 if(fx){if(fx.k==='block')r.dash=.8;if(this.runners[fx.tg].ctl!=='net')this.applyBump(this.runners[fx.tg],fx,r);}
 return true;};
Race.prototype.bumpFx=function(r){
 var best=null,bd=9,rl=this.laneOf(r);
 for(var i=0;i<this.runners.length;i++){var o=this.runners[i];if(o===r||o.fall>0||o.fin)continue;
  var dz=o.z-r.z,ld=Math.abs(this.laneOf(o)-rl);if(dz<-1.6||dz>4.5||ld>1)continue;var sc=Math.abs(dz)+ld*1.2;if(sc<bd){bd=sc;best=o;}}
 if(!best)return null;
 var ol=this.laneOf(best),dir=ol!==rl?Math.sign(ol-rl):(ol===0?1:-1),nl=ol+dir;
 if(best.sh>0)return{tg:best.id,k:'block',by:r.id};
 if(nl<0||nl>2){var zz=best.z,zo=zoneAt(this.track,zz),wet=nl<0?(zo===1||zo===2||shoreAt(this.track,zz)<4.6):zo===2;
  return wet?{tg:best.id,k:'dunk',side:nl<0?-1:1,by:r.id}:{tg:best.id,k:'wall',lane:ol,dir:dir,by:r.id};}
 return{tg:best.id,k:'shift',lane:nl,dir:dir,by:r.id};};
Race.prototype.applyBump=function(o,fx,by){
 var byId=by?by.id:fx.by;
 if(fx.k==='block'){if(o.sh>0){o.sh=0;o.inv=Math.max(o.inv,.5);}this.ev.push({t:'block',r:o,why:'bump',by:byId});return;}
 if(fx.k==='dunk'){this.dunk(o,fx.side,byId);return;}
 if(fx.k==='wall'){o.lane=fx.lane;o.x=laneX(fx.lane)+fx.dir*.7;if(this.hit(o,'bump',byId)){o.stum=1;o.speed*=.7;}return;}
 o.lane=fx.lane;o.lean=fx.dir;this.hit(o,'bump',byId);};
Race.prototype.update=function(dt){
 var T=this.track,rs=this.runners,i,r,k;this.t+=dt;var go=this.t>=0,base=this.base(),lead=0;
 for(i=0;i<rs.length;i++)if(rs[i].z>lead)lead=rs[i].z;
 for(i=0;i<rs.length;i++){r=rs[i];
  r.face=Math.max(0,r.face-dt);r.lean*=Math.exp(-dt*6);
  if(r.ctl==='net')continue;
  r.inv=Math.max(0,r.inv-dt);r.dash=Math.max(0,r.dash-dt);r.zap=Math.max(0,r.zap-dt);r.stum=Math.max(0,r.stum-dt);if(r.sh>0)r.sh=Math.max(0,r.sh-dt);
  if(r.fall>0){r.fall-=dt;r.x=lerp(r.x,r.fallX,1-Math.exp(-dt*7));
   if(r.fall<=0){r.fall=0;r.water=0;r.lane=1;r.x=0;r.inv=1.6;r.speed=base*.45;
    /* never back into a jetty gap: climb out just past it */
    for(k=Math.max(0,r.oi-2);k<T.obs.length&&T.obs[k].z<r.z+2;k++){if(T.obs[k].t==='gap'&&Math.abs(T.obs[k].z-r.z)<2)r.z=T.obs[k].z+1.3;}
    this.ev.push({t:'back',r:r});}
   continue;}
  if(!go)continue;
  if(r.ctl==='ai'&&!r.fin)this.ai(r,dt,lead);
  var tgt=base*(r.ctl==='ai'?r.pace:1)*(1+clamp((lead-r.z)/55,0,1)*.1)*(r.dash>0?1.28:1)*(r.stum>0?.62:1);
  if(r.fin)tgt=Math.min(tgt,5);
  r.speed+=(tgt-r.speed)*Math.min(1,dt*(r.speed>tgt?4:1.9));
  var pz=r.z;r.z+=r.speed*dt;
  r.x=lerp(r.x,laneX(r.lane),1-Math.exp(-dt*15));
  if(r.y>0||r.vy>0){r.vy-=24*dt;r.y+=r.vy*dt;if(r.y<=0){r.y=0;r.vy=0;this.ev.push({t:'land',r:r});}}
  if(r.slide>0)r.slide=Math.max(0,r.slide-dt);
  if(r.fin)continue;
  /* obstacles crossed this frame */
  while(r.oi<T.obs.length&&T.obs[r.oi].z<pz-2)r.oi++;
  for(k=r.oi;k<T.obs.length&&T.obs[k].z<=r.z+.4;k++){var ob=T.obs[k],d=OB[ob.t];
   if(ob.z+.25<pz||ob.z-.25>r.z)continue;
   if(ob.lane>=0&&Math.abs(r.x-laneX(ob.lane))>.72)continue;
   var ok=d.need==='jump'?r.y>.33:d.need==='slide'?r.slide>0:false;
   if(ok)continue;
   if(d.fall){if(r.inv>0&&r.sh<=0&&r.fall<=0){/* still recovering: hop the gap for free */r.vy=Math.max(r.vy,5);r.y=Math.max(r.y,.4);continue;}
    this.dunk(r,r.lane===2?1:-1);break;}
   if(r.inv>0&&r.sh<=0)continue;
   if(this.hit(r,ob.t))this.fx.push({t:'puff',x:r.x,z:r.z,life:.5});
  }
  /* crates */
  while(r.pi<T.pk.length&&T.pk[r.pi].z<pz-2)r.pi++;
  for(k=r.pi;k<T.pk.length&&T.pk[k].z<=r.z+.4;k++){var p=T.pk[k];if(r.got[p.i])continue;if(p.z+.5<pz||p.z-.5>r.z)continue;if(Math.abs(r.x-laneX(p.lane))>.75)continue;
   r.got[p.i]=1;var n=rs.length,add=(r.place>1&&r.place>=n-1)?2:1,before=r.ch[p.k];r.ch[p.k]=Math.min(3,r.ch[p.k]+add);r.crates++;
   this.ev.push({t:'crate',r:r,k:p.k,n:r.ch[p.k]-before,dbl:add>1});}
  if(r.z>=this.len){r.fin=true;r.finT=this.t-(r.z-this.len)/Math.max(1,r.speed);r.face=2.2;r.faceK='win';this.ev.push({t:'finish',r:r});}
 }
 this.hazards(rs);
 /* coconuts: every copy flies them; only the authority decides who is hit */
 for(i=this.proj.length-1;i>=0;i--){var q=this.proj[i];q.z+=q.v*dt;q.vy-=3*dt;q.y=Math.max(.5,q.y+q.vy*dt);q.life-=dt;q.sp+=dt*14;var gone=false;
  for(var j=0;j<rs.length;j++){var o=rs[j];if(o.id===q.o||o.fall>0||o.fin)continue;
   if(Math.abs(o.z-q.z)<1.1&&Math.abs(o.x-q.x)<.62&&o.y<.75&&o.slide<=0){gone=true;
    if(q.real){if(o.ctl==='net')this.ev.push({t:'hitReq',r:o,why:'coco',by:q.o});else if(this.hit(o,'coco',q.o))this.fx.push({t:'bonk',x:o.x,z:o.z,life:.6});}
    break;}}
  if(gone||q.life<=0)this.proj.splice(i,1);}
 for(i=this.fx.length-1;i>=0;i--){this.fx[i].life-=dt;if(this.fx[i].life<=0)this.fx.splice(i,1);}
 this.places();};
/* lightning and bats. Warnings ('zapWarn'/'batWarn') come WZ/WB seconds before; then the strike ('bolt') or the
   swoop ('bat'). Each phone decides for its own runner, the authority for computer runners (as with obstacles).
   Lightning: anyone in that lane is hit (jumping doesn't help). Bats: anyone in that lane who isn't sliding.
   Falling coconuts (forest, dusk and night): anyone in that lane when it lands (change lane). */
Race.prototype.hazards=function(rs){var T=this.track,t=this.t,e,k,r,q;
 var L=[[T.zaps,'hwz','hz',WZ,'zapWarn','bolt'],[T.bats,'hwb','hb',WB,'batWarn','bat'],[T.nuts,'hwn','hn',WN,'nutWarn','nut']];
 for(q=0;q<3;q++){var li=L[q],list=li[0];
  while(this[li[1]]<list.length&&list[this[li[1]]].t-li[3]<=t){e=list[this[li[1]]++];if(t-(e.t-li[3])<.5)this.ev.push({t:li[4],h:e});}
  while(this[li[2]]<list.length&&list[this[li[2]]].t<=t){e=list[this[li[2]]++];if(t-e.t>.3)continue;var hitIds=[];
   for(k=0;k<rs.length;k++){r=rs[k];if(r.ctl==='net'||r.fin||r.fall>0)continue;
    if(!IN[q](T,r.z))continue;if(Math.abs(r.x-laneX(e.lane))>.72)continue;if(q===1&&r.slide>0)continue;
    if(this.hit(r,WHY[q])){hitIds.push(r.id);if(q===0)r.zap=1.5;}}
   this.ev.push({t:li[5],h:e,hits:hitIds});}}};
/* the lane a computer runner steps into to get out of a hazard lane: not the hazard lane, no dhoni there soon */
Race.prototype.safeLane=function(r,bad){var T=this.track,sp=Math.max(6,r.speed),best=null,bd=9;
 for(var l=0;l<3;l++){if(l===bad)continue;var blocked=false;
  for(var k=r.oi;k<T.obs.length;k++){var o=T.obs[k];if(o.z>r.z+sp*1.6+3)break;if(o.z<r.z-1)continue;if(o.lane===l&&OB[o.t].need==='move'){blocked=true;break;}}
  if(blocked)continue;var d=Math.abs(l-r.lane);if(d<bd){bd=d;best=l;}}
 return best;};
Race.prototype.aiMove=function(r,d){var n=clamp(r.lane+d,0,2);if(r.avoidT>this.t&&n!==r.lane&&(n===r.avoidL||r.hzSlide))return;this.move(r,d);};
/* computer runners see the warning, and (by skill) get out of the lane or slide under the bat */
Race.prototype.aiHaz=function(r){var T=this.track,t=this.t,sp=Math.max(6,r.speed),R=this.R,
 L=[[T.zaps,this.hz,WZ],[T.bats,this.hb,WB],[T.nuts,this.hn,WN]],K=r.hk||(r.hk=[{},{},{}]);
 for(var q=0;q<3;q++){var list=L[q][0],H=K[q];
  for(var k=L[q][1];k<list.length;k++){var e=list[k],dt2=e.t-t;if(dt2>L[q][2])break;if(dt2<0)continue;
   var zAt=r.z+sp*dt2,zIn=IN[q];if(!zIn(T,zAt)&&!zIn(T,zAt+4)&&!zIn(T,r.z))continue;
   var key=q+':'+e.i;
   if(H.k!==key){H.k=key;r.hzK=key;H.ok=r.skill>=.999||R()<Math.min(.97,r.skill*1.04+.02);H.at=t+lerp(.5,.14,r.skill)+R()*.16;
    /* a bat: slide under it if nothing in my lane needs a jump around then */
    var sl=q===1&&R()<.5;if(sl){for(var p=r.oi;p<T.obs.length;p++){var o=T.obs[p];if(o.z>r.z+sp*(dt2+.5))break;if(o.z>r.z-.5&&(o.lane<0||o.lane===r.lane)&&OB[o.t].need!=='slide'){sl=false;break;}}}H.sl=sl;r.hzSlide=sl;}
   if(!H.ok)continue;
   r.avoidL=e.lane;r.avoidT=e.t+.15;
   if(t<H.at)continue;
   if(r.lane===e.lane||Math.abs(r.x-laneX(e.lane))<.8){
    if(q===1&&H.sl){if(dt2<.3&&r.slide<dt2+.12)this.duck(r);}
    else{var l=this.safeLane(r,e.lane);if(l!=null&&l!==r.lane)this.move(r,Math.sign(l-r.lane));else if(l==null&&q===1&&dt2<.3&&r.slide<dt2+.12)this.duck(r);}}}}};
Race.prototype.places=function(){var rs=this.runners,ord=rs.slice().sort(function(a,b){if(a.fin&&b.fin)return a.finT-b.finT;if(a.fin)return -1;if(b.fin)return 1;return b.z-a.z||a.id-b.id;});
 for(var i=0;i<ord.length;i++)ord[i].place=i+1;return ord;};
/* estimated time for a runner who hasn't crossed the line yet */
Race.prototype.est=function(r){return r.fin?r.finT:Math.max(this.t,0)+(this.len-r.z)/Math.max(9,r.speed||this.base());};
Race.prototype.results=function(){var self=this;return this.runners.map(function(r){return{r:r,t:self.est(r),fin:r.fin};}).sort(function(a,b){return a.t-b.t;});};
/* ---------- computer runners ---------- */
Race.prototype.ai=function(r,dt,lead){
 var T=this.track,R=this.R,rs=this.runners,sp=Math.max(6,r.speed),rl=r.lane;
 this.aiHaz(r);
 var nx=null,dmin=34;
 for(var k=r.oi;k<T.obs.length;k++){var o=T.obs[k],dz=o.z-r.z;if(dz<-.3)continue;if(dz>dmin)break;if(o.lane<0||o.lane===rl){nx=o;break;}}
 if(nx){var ttc=(nx.z-r.z)/sp,d=OB[nx.t];
  if(r.planO!==nx){r.planO=nx;r.plan=R()<r.skill?d.need:'none';
   if(r.plan==='jump'||r.plan==='slide'){var fr=this.freeLane(r,nx);if(!d.all&&fr!=null&&R()<.35)r.plan='move';}
   /* a raised shell saves a runner who would crash anyway */
   if(r.plan==='none'&&r.ch.shield>0&&!d.fall&&R()<r.skill*.6)r.plan='shield';}
  if(r.plan==='jump'&&ttc<.24+.05*(1-r.skill))this.jump(r);
  else if(r.plan==='slide'&&ttc<.36)this.duck(r);
  else if(r.plan==='shield'&&ttc<.5){this.shield(r);r.plan='none';}
  else if(r.plan==='move'&&ttc<.95){var f=this.freeLane(r,nx);if(f!=null&&f!==r.lane)this.aiMove(r,Math.sign(f-r.lane));if(f==null)r.plan=d.need==='move'?'none':d.need;}
 }
 r.aiT-=dt;
 if(r.aiT<=0){r.aiT=1.1+R()*2.2;
  if(!nx||(nx.z-r.z)>16){var tgt=-1;for(var p=r.pi;p<T.pk.length;p++){var c=T.pk[p];if(c.z-r.z>30)break;if(c.z>r.z+4&&!r.got[c.i]){tgt=c.lane;break;}}
   if(tgt<0&&R()<.3)tgt=Math.floor(R()*3);if(tgt>=0&&tgt!==r.lane)this.aiMove(r,Math.sign(tgt-r.lane));}}
 /* incoming coconut from behind in my lane: shield or sidestep */
 for(var qi=0;qi<this.proj.length;qi++){var q=this.proj[qi];if(q.o===r.id)continue;var qd=r.z-q.z;
  if(qd>0&&qd<9&&Math.abs(q.x-r.x)<.7&&R()<dt*3*r.skill){if(r.ch.shield>0&&r.sh<=0)this.shield(r);else this.aiMove(r,r.lane===0?1:r.lane===2?-1:(R()<.5?-1:1));break;}}
 if(this.t>4)for(var i=0;i<rs.length;i++){var o2=rs[i];if(o2===r||o2.fall>0||o2.fin)continue;var dz2=o2.z-r.z,ol=this.laneOf(o2);
  if(r.ch.throw>0&&ol===rl&&dz2>5&&dz2<26&&R()<dt*.9*r.skill){this.throwCo(r);break;}
  var zq=zoneAt(T,o2.z),edge=ol===0&&(zq===1||zq===2)&&rl<=1;
  if(r.ch.bump>0&&Math.abs(dz2)<2.2&&Math.abs(ol-rl)<=1&&R()<dt*(edge?4:1.5)*r.skill){this.bump(r);break;}}
};
Race.prototype.freeLane=function(r,ob){var T=this.track,bad=[0,0,0];
 for(var k=r.oi;k<T.obs.length;k++){var o=T.obs[k];if(o.z>ob.z+4)break;if(o.z<ob.z-4)continue;if(o.lane<0)return null;bad[o.lane]=1;}
 var best=null,bd=9;for(var l=0;l<3;l++){if(bad[l])continue;var d=Math.abs(l-r.lane);if(d===2)d=2.5;if(d<bd){bd=d;best=l;}}
 return best;};
/* make a computer runner from a player's last known state (AFK, lost connection, host left) */
Race.prototype.takeOver=function(r,skill){r.ctl='ai';r.skill=skill||.84;r.pace=.985;r.plan=null;r.planO=null;r.aiT=.5;r.hzK='';r.hk=null;r.lane=clamp(r.lane|0,0,2);
 var T=this.track;while(r.oi<T.obs.length&&T.obs[r.oi].z<r.z-2)r.oi++;while(r.pi<T.pk.length&&T.pk[r.pi].z<r.z-2)r.pi++;};
Race.DIFF=DIFF;

var API={SEG:SEG,LANE:LANE,HALF:HALF,LEN:LEN,WZ:WZ,WB:WB,WN:WN,actsOf:actsOf,inZap:inZap,inBat:inBat,inNut:inNut,wxAt:wxAt,OB:OB,CRATES:CRATES,DIFF:DIFF,makeTrack:makeTrack,Race:Race,rng:rng,laneX:laneX,
 cxAt:cxAt,headAt:headAt,shoreAt:shoreAt,zoneAt:zoneAt,clamp:clamp,lerp:lerp,sm:sm};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else G.RRE=API;
})(typeof window!=='undefined'?window:this);
