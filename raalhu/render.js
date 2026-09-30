/* =====================================================================
   RAALHU RUMBLE · renderer (plain canvas 2D, pseudo-3D "high chase" camera)
   Draws the pre-rendered art (art/*.webp, atlas in art/atlas.js) with a perspective projection:
   sky + far islands, a textured sea and beach, the track (sand path or jetty planks),
   then every sprite far to near. Runners are seen from behind; their face only shows
   in short head-turns (hit, bumped, finishing). window.RRV
   ===================================================================== */
(function(G){'use strict';
var E=G.RRE,SEG=E.SEG,LANE=E.LANE,HALF=E.HALF,OB=E.OB;
var clamp=E.clamp,lerp=E.lerp;
var cxAt=E.cxAt,headAt=E.headAt,shoreAt=E.shoreAt,zoneAt=E.zoneAt;
var PAL={skyTop:'#1583D9',seaFar:'#8BE0F2',seaMid:'#2AB0E0',seaDeep:'#0B78BD',shallow:'#46E0D0',foam:'#FFFFFF',crest:'rgba(255,255,255,.85)',
 sand:'#FFD98A',wet:'#E6BC72',track:'rgba(255,240,205,.82)',edge:'#E7A04F',lane:'rgba(255,255,255,.92)',plank:'#C98A55',plank2:'#B97A48',plankLine:'#6E4222',
 shadow:'rgba(25,45,70,.26)',haze:'rgba(225,246,255,.7)',ink:'#27304A'};
var CAM={h:7.6,back:11.6,fk:1.9,hy:.17,ahead:150,follow:.4};
var IMG={},A=null;

/* ---------- loading (Cache Storage first, then the network, with byte progress) ---------- */
var FILES=['runner.webp','sprites.webp','sky.webp','horizon.webp'];
var CACHE='rr-art-v2';
function load(base,onProg){A=G.RRA;var sizes=(A&&A.sizes)||{},total=0,got={};FILES.forEach(function(f){total+=sizes[f]||50000;});
 var cacheP=(G.caches&&G.isSecureContext!==false)?caches.open(CACHE).catch(function(){return null;}):Promise.resolve(null);
 function prog(){var s=0;for(var k in got)s+=got[k];onProg&&onProg(Math.min(1,s/total));}
 return cacheP.then(function(cache){
  /* old art versions are removed */
  if(G.caches)caches.keys().then(function(ks){ks.forEach(function(k){if(/^rr-art-/.test(k)&&k!==CACHE)caches.delete(k);});}).catch(function(){});
  return Promise.all(FILES.map(function(f){var url=base+f+'?v='+(A&&A.v||1);
   var fromNet=function(){return fetch(url).then(function(res){if(!res.ok)throw new Error('art '+res.status);
     var len=+res.headers.get('content-length')||sizes[f]||0;
     if(!res.body||!res.body.getReader){return res.blob().then(function(b){got[f]=sizes[f]||b.size;prog();return b;});}
     var rd=res.body.getReader(),parts=[],n=0;
     return (function pump(){return rd.read().then(function(o){if(o.done){var b=new Blob(parts,{type:'image/webp'});got[f]=sizes[f]||n;prog();return b;}parts.push(o.value);n+=o.value.length;got[f]=Math.min(sizes[f]||len||n,n);prog();return pump();});})();})
    .then(function(b){if(cache){try{cache.put(url,new Response(b,{headers:{'content-type':'image/webp'}})).catch(function(){});}catch(e){}}return b;});};
   var p=cache?cache.match(url).then(function(m){return m?m.blob().then(function(b){got[f]=sizes[f]||b.size;prog();return b;}):fromNet();}).catch(fromNet):fromNet();
   return p.then(function(blob){return new Promise(function(ok,bad){var im=new Image();im.decoding='async';im.onload=function(){IMG[f.replace('.webp','')]=im;ok();};im.onerror=function(){bad(new Error('decode '+f));};im.src=URL.createObjectURL(blob);});});
  }));});}

/* ---------- atlas drawing ---------- */
/* draw atlas frame r (full frame fw x fh) so that its full box is at (dx,dy,dw,dh) */
function blit(x,im,r,dx,dy,dw,dh){var kx=dw/r.fw,ky=dh/r.fh;x.drawImage(im,r.x,r.y,r.w,r.h,dx+r.ox*kx,dy+r.oy*ky,r.w*kx,r.h*ky);}
function sprR(k){return A.sprites.r[k];}
/* a sprite standing on the ground at (cx,by), world width wm scaled by s px/m */
function drawSpr(x,key,cx,by,s,flip,scale){var r=sprR(key);if(!r)return;var w=r.wm*s*(scale||1),h=w*r.fh/r.fw;
 if(flip){x.save();x.translate(cx,0);x.scale(-1,1);blit(x,IMG.sprites,r,-w/2,by-h,w,h);x.restore();}else blit(x,IMG.sprites,r,cx-w/2,by-h,w,h);return h;}

/* ---------- runner looks: tinted sheets built once per runner ---------- */
var HAIRMAP={crop:'short',short:'short',sidepart:'short',quiff:'short',slick:'short',messy:'short',tufts:'short',spiky:'short',undercut:'short',pixie:'short',
 fade:'fade',buzz:'fade',cornrows:'fade',bald:'bald',afro:'afro',curly:'curly',curlytop:'curly',mohawk:'mohawk',
 waves:'long',sleek:'long',long:'long',fringelong:'long',curtain:'long',sidefringe:'long',sideswept:'long',halfup:'long',wavy:'mid',
 bob:'bob',sleekbob:'bob',ponytail:'pony',fringepony:'pony',topbun:'bun',highbun:'bun',bun:'bun',manbun:'bun',lowbun:'lowbun',braids:'braids',dreads:'locs',
 hijab:'hijab',shayla:'hijab',khimar:'hijab',headscarf:'hijab',turban:'turban'};
var HATMAP={cap:'cap',capback:'cap',fisher:'cap',police:'cap',pilot:'cap',captain:'cap',helmet:'cap',gradcap:'cap',
 bucket:'brim',straw:'brim',cowboy:'brim',deerstalker:'brim',pirate:'brim',tophat:'brim',beanie:'beanie',chef:'beanie',headband:'band',headphones:'band',kulhi:'wrap'};
var OUTFITC={tee:'#2F7FD1',blouse:'#F3EFE7',libaas:'#179C93',wrap:'#8E2F45',blazer:'#253766',hoodie:'#7B4FD6',mvjersey:'#D21034',polo:'#1E8A5E',mlinen:'#E9DFC9',shirt:'#8FB8E0',
 kurta:'#F3EFE7',hawaii:'#179C93',suit:'#3A3D48',tux:'#16161C',sequin:'#8C6FD6',police:'#27365C',trench:'#B8955E',chef:'#FBFAF7',pilot:'#FFFFFF',pirate:'#F3EEE4',diver:'#1D2027',
 astro:'#EFEFEC',hero:'#2F5FD0',boduberu:'#F4F0E8',royal:'#8E1B2C'};
function colOf(v,def){if(!v)return def;if(typeof v==='string')return v;if(Array.isArray(v))return v[0];if(v.base)return v.base;return def;}
/* colours and families for a DGAvatar config (or plain colours for players without one) */
function lookOf(cfg,fallback){var AV=G.DGAvatar,o={skin:'#CB9669',cloth:'#F0645A',hair:'#1E1B24',scarf:'#C57483',hat:'#E5484D',fam:'short',hatF:null};
 if(fallback)for(var k in fallback)o[k]=fallback[k];
 if(!cfg||!AV)return o;
 var it=function(cat,key){try{var i=AV.item(cat+'.'+key);return i?i.value:null;}catch(e){return null;}};
 o.skin=colOf(it('skin',cfg.skin),o.skin);o.hair=colOf(it('hairColor',cfg.hairColor),o.hair);o.scarf=colOf(it('scarfColor',cfg.scarfColor),o.scarf);o.hat=colOf(it('hatColor',cfg.hatColor),o.hat);
 var oc=cfg.outfitColor&&cfg.outfitColor!=='auto'?colOf(it('outfitColor',cfg.outfitColor),null):null;o.cloth=oc||OUTFITC[cfg.outfit]||o.cloth;
 o.fam=HAIRMAP[cfg.hair]||'short';o.hatF=cfg.hat&&cfg.hat!=='none'?(HATMAP[cfg.hat]||null):null;
 if(o.fam==='hijab'||o.fam==='turban')o.hatF=null;
 return o;}
function cv(w,h){var c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;}
var TMP=null;
function tint(dst,dx,dy,r,col){if(!r)return;if(!TMP||TMP.width<r.fw||TMP.height<r.fh)TMP=cv(Math.max(r.fw,160),Math.max(r.fh,160));var x=TMP.getContext('2d');
 x.globalCompositeOperation='source-over';x.clearRect(0,0,TMP.width,TMP.height);x.drawImage(IMG.runner,r.x,r.y,r.w,r.h,r.ox,r.oy,r.w,r.h);
 x.globalCompositeOperation='multiply';x.fillStyle=col;x.fillRect(0,0,r.fw,r.fh);x.globalCompositeOperation='destination-in';x.drawImage(IMG.runner,r.x,r.y,r.w,r.h,r.ox,r.oy,r.w,r.h);
 x.globalCompositeOperation='source-over';dst.drawImage(TMP,0,0,r.fw,r.fh,dx,dy,r.fw,r.fh);}
function plain(dst,dx,dy,r){if(r)dst.drawImage(IMG.runner,r.x,r.y,r.w,r.h,dx+r.ox,dy+r.oy,r.w,r.h);}
/* sheet: body frames in a row (140 px each) + the back of the head (112 x 134) */
function runnerSheet(look,num){var B=A.body,Hh=A.head,R=A.runner.r,n=B.frames.length,bp=B.px;
 var c=cv(n*bp+Hh.w+2,Math.max(bp,Hh.h)),x=c.getContext('2d');
 B.frames.forEach(function(f,i){var ox=i*bp;tint(x,ox,0,R['b_'+f+'_skin'],look.skin);tint(x,ox,0,R['b_'+f+'_cloth'],look.cloth);plain(x,ox,0,R['b_'+f+'_fix']);
  var m=B.meta[f];if(num!=null&&f.indexOf('swim')<0){x.save();x.translate(ox+m.bx*bp,m.by*bp+1.2);x.rotate(m.rot||0);x.fillStyle='#27304A';x.font='900 12px system-ui,-apple-system,"Segoe UI",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(num),0,0);x.restore();}});
 var hx=n*bp,fam=look.fam in Hh.tint?look.fam:'short',ht=Hh.tint[fam]==='scarf'?look.scarf:look.hair;
 tint(x,hx,0,R['h_'+fam+'_skin'],look.skin);tint(x,hx,0,R['h_'+fam+'_hair'],ht);plain(x,hx,0,R['h_'+fam+'_fix']);
 if(look.hatF&&R['t_'+look.hatF+'_hat']){tint(x,hx,0,R['t_'+look.hatF+'_hat'],look.hat);plain(x,hx,0,R['t_'+look.hatF+'_fix']);}
 return{c:c,n:n,bp:bp,hx:hx,hw:Hh.w,hh:Hh.h,idx:Object.fromEntries?Object.fromEntries(B.frames.map(function(f,i){return[f,i];})):(function(){var o={};B.frames.forEach(function(f,i){o[f]=i;});return o;})()};}
/* face images for the short head-turns (DGAvatar, cropped to the head) */
function faceImgs(cfg){var AV=G.DGAvatar,out={};if(!AV||!cfg)return out;
 ['shocked','laugh'].forEach(function(ex){try{var im=new Image();im.decoding='async';im.src=AV.dataURI(cfg,{size:160,bg:false,expression:ex});out[ex]=im;}catch(e){}});return out;}
/* round HUD icon from the avatar (or a coloured dot) */
function iconOf(cfg,col,size){var c=cv(size,size),x=c.getContext('2d'),AV=G.DGAvatar;x.fillStyle=col||'#F0645A';x.beginPath();x.arc(size/2,size/2,size/2,0,6.2832);x.fill();
 if(AV&&cfg){try{var im=new Image();im.onload=function(){x.save();x.beginPath();x.arc(size/2,size/2,size/2-1,0,6.2832);x.clip();x.drawImage(im,0,0,size,size);x.restore();};im.src=AV.dataURI(cfg,{size:96});}catch(e){}}
 return c;}

/* ---------- view ---------- */
function View(canvas,o){o=o||{};this.c=canvas;this.x=canvas.getContext('2d',{alpha:false});this.dprMax=o.dpr||1.5;this.lite=!!o.lite;this.tags=o.tags!==false;
 this.camX=0;this.slope=0;this.lt=0;this.K=new Float32Array(300*7);this.items=[];this.tagC={};this.prog=null;this.resize();}
View.prototype.resize=function(){var b=this.c.getBoundingClientRect(),d=Math.min(G.devicePixelRatio||1,this.lite?1:this.dprMax);this.W=Math.max(10,b.width);this.H=Math.max(10,b.height);this.dpr=d;
 this.c.width=Math.round(this.W*d);this.c.height=Math.round(this.H*d);this.pat=null;this.gSky=null;};

View.prototype.draw=function(race,me,t){
 var x=this.x,d=this.dpr,W=this.W,H=this.H,P=PAL,T=race.track;x.setTransform(d,0,0,d,0,0);
 var dt=this.lt?Math.min(.1,t-this.lt):.016;this.lt=t;
 var mz=me.rz!=null?me.rz:me.z,mx=me.rx!=null?me.rx:me.x;
 this.camX=lerp(this.camX,mx*CAM.follow,1-Math.exp(-dt*5));
 this.slope=lerp(this.slope,headAt(T,mz+2),1-Math.exp(-dt*3));var slope=this.slope;
 var camZ=mz-CAM.back,Fk=Math.min(W*CAM.fk,H*.9)*(1+clamp((me.speed||0)-11,0,6)*.01),hy=Math.round(H*CAM.hy),camH=CAM.h;
 var bcx=cxAt(T,camZ),camX=this.camX,ahead=this.lite?CAM.ahead*.72:CAM.ahead;this.hy=hy;
 /* depth samples: z, scale, screen x of the centre line, screen y, shore, zone, wash */
 var K=this.K,n=0,zz=camZ+.7;
 while(zz<camZ+ahead&&n<290){var dz=zz-camZ,s=Fk/dz,o=n*7;K[o]=zz;K[o+1]=s;K[o+2]=W/2+(cxAt(T,zz)-bcx-slope*dz-camX)*s;K[o+3]=hy+camH*s;K[o+4]=shoreAt(T,zz);K[o+5]=zoneAt(T,zz);
  K[o+6]=.7*Math.sin(t*1.15+zz*.05)+.35*Math.sin(t*.63+zz*.13)+(K[o+5]===1?.45*Math.max(0,Math.sin(t*.9+zz*.09)):0);n++;
  zz=Math.floor(zz/SEG+1)*SEG;if(dz>60)zz+=SEG;if(dz>100)zz+=SEG;}
 function X(i,l){return K[i*7+2]+l*K[i*7+1];}function Y(i){return K[i*7+3];}
 /* ---- sky + far horizon ---- */
 var sky=IMG.sky,ar=W/(hy+2),sH=Math.min(sky.height,sky.width*.9/ar),sW=sH*ar,sX=clamp((sky.width-sW)/2-slope*220,0,sky.width-sW);
 var DB=this.dbg||{};if(!DB.sky)x.drawImage(sky,sX,sky.height-sH,sW,sH,0,0,W,hy+2);
 var hz=IMG.horizon,hs=Math.max(.55,W/760),hw=hz.width*hs,hh=hz.height*hs,hOff=((-slope*Fk*.9)%hw+hw)%hw;
 x.fillStyle=P.seaFar;x.fillRect(0,hy,W,H-hy);
 if(!this.gSea||this.gH!==H||this.gY!==hy){var g=x.createLinearGradient(0,hy,0,H);g.addColorStop(0,P.seaFar);g.addColorStop(.18,P.seaMid);g.addColorStop(1,P.seaDeep);this.gSea=g;this.gH=H;this.gY=hy;
  var g2=x.createLinearGradient(0,hy,0,hy+H*.07);g2.addColorStop(0,P.haze);g2.addColorStop(1,'rgba(225,246,255,0)');this.gHaze=g2;}
 x.fillStyle=this.gSea;x.fillRect(0,hy,W,H-hy);
 for(var hx0=-hOff;hx0<W;hx0+=hw)x.drawImage(hz,hx0,hy-hh*(150/190),hw,hh);
 /* ---- sea: wave marks in world space (so the perspective comes for free) ---- */
 function hsh(v){var s=Math.sin(v*12.9898+78.233)*43758.5453;return s-Math.floor(s);}
 if(!this.lite&&!DB.seaTex){var w0=sprR('wv0'),w1=sprR('wv1'),cnt=0;
  for(var mz2=Math.ceil((camZ+3)/3)*3;mz2<camZ+ahead&&cnt<110;){var dzm=mz2-camZ,sm2=Fk/dzm,stp=dzm<30?3:dzm<70?6:12,shm=shoreAt(T,mz2),cxm=W/2+(cxAt(T,mz2)-bcx-slope*dzm-camX)*sm2,ym=hy+camH*sm2;
   for(var xw=-shm-6.5-hsh(mz2)*4;;xw-=5.2){var sxp=cxm+xw*sm2;if(sxp<-60)break;var ph2=(t*.22+hsh(mz2+xw))%1,xo=ph2*2.2,sp2=hsh(mz2*7+xw)<.5?w0:w1,ww=sp2.wm*sm2;
    x.globalAlpha=Math.sin(ph2*Math.PI)*(dzm>90?.5:.85);blit(x,IMG.sprites,sp2,sxp+xo*sm2-ww/2,ym-ww*sp2.fh/sp2.fw*.5,ww,ww*sp2.fh/sp2.fw);if(++cnt>=110)break;}
   mz2+=stp;}x.globalAlpha=1;}
 /* ---- far wave crests rolling towards the shore ---- */
 var bands=this.lite?0:4,i;
 for(var b=0;b<bands;b++){var ph=((b/bands+t*.07)%1),dd=1.2+(1-ph)*26,wd=.3+ph*.5;x.fillStyle=P.crest;x.globalAlpha=Math.min(1,ph*3)*(.3+.5*ph);x.beginPath();
  for(i=n-1;i>=0;i--)x.lineTo(X(i,-K[i*7+4]-dd),Y(i));for(i=0;i<n;i++)x.lineTo(X(i,-K[i*7+4]-dd+wd),Y(i));x.fill();}
 x.globalAlpha=1;
 /* shallow turquoise band */
 x.fillStyle=P.shallow;x.globalAlpha=.8;x.beginPath();for(i=n-1;i>=0;i--)x.lineTo(X(i,-K[i*7+4]-5.5),Y(i));for(i=0;i<n;i++)x.lineTo(X(i,-K[i*7+4]),Y(i));x.fill();x.globalAlpha=1;
 /* ---- beach: wet sand, dry sand (textured), foam line ---- */
 var R0=Math.max(W,X(0,40))+60;
 x.fillStyle=P.wet;x.beginPath();for(i=0;i<n;i++)x.lineTo(X(i,-K[i*7+4]+K[i*7+6]*.4-.2),Y(i));x.lineTo(R0,Y(n-1));x.lineTo(R0,H+40);x.lineTo(X(0,-K[4]),H+40);x.fill();
 x.fillStyle=P.sand;x.beginPath();for(i=0;i<n;i++)x.lineTo(X(i,-K[i*7+4]+1.3+K[i*7+6]*.15),Y(i));x.lineTo(R0,Y(n-1));x.lineTo(R0,H+40);x.lineTo(X(0,-K[4]+1.3),H+40);x.fill();
 /* sand marks (ripples, pebbles) scattered in world space */
 if(!this.lite&&!DB.sandTex){var s0=sprR('sm0'),s1=sprR('sm1'),cn=0;x.globalAlpha=.85;
  for(var mz3=Math.ceil((camZ+2.5)/2.5)*2.5;mz3<camZ+ahead*.7&&cn<70;){var dz3=mz3-camZ,sm3=Fk/dz3,st3=dz3<25?2.5:dz3<55?5:10,sh3=shoreAt(T,mz3),cx3=W/2+(cxAt(T,mz3)-bcx-slope*dz3-camX)*sm3,y3=hy+camH*sm3;
   if(zoneAt(T,mz3)!==2){for(var xs=HALF+1+hsh(mz3)*2.5;;xs+=3.6){var px5=cx3+xs*sm3;if(px5>W+30||cn>=70)break;var q5=hsh(mz3*3+xs)<.5?s0:s1,w5=q5.wm*sm3;blit(x,IMG.sprites,q5,px5-w5/2,y3-w5*q5.fh/q5.fw,w5,w5*q5.fh/q5.fw);cn++;}
    if(sh3>5)for(xs=-HALF-1-hsh(mz3+7)*1.5;xs>-sh3+1.8;xs-=3.4){var px6=cx3+xs*sm3;if(px6<-30)break;var q6=hsh(mz3*5+xs)<.5?s0:s1,w6=q6.wm*sm3;blit(x,IMG.sprites,q6,px6-w6/2,y3-w6*q6.fh/q6.fw,w6,w6*q6.fh/q6.fw);cn++;}}
   mz3+=st3;}x.globalAlpha=1;}
 x.fillStyle=P.foam;x.globalAlpha=.95;x.beginPath();for(i=0;i<n;i++)x.lineTo(X(i,-K[i*7+4]+K[i*7+6]-.28),Y(i));for(i=n-1;i>=0;i--)x.lineTo(X(i,-K[i*7+4]+K[i*7+6]+.22),Y(i));x.fill();
 x.globalAlpha=.55;x.beginPath();for(i=0;i<n;i++)x.lineTo(X(i,-K[i*7+4]+K[i*7+6]*.5-1.1),Y(i));for(i=n-1;i>=0;i--)x.lineTo(X(i,-K[i*7+4]+K[i*7+6]*.5-.9),Y(i));x.fill();x.globalAlpha=1;
 /* glints on the water */
 if(!this.lite){x.fillStyle='#FFFFFF';for(var gi=0;gi<22;gi++){var gy=hy+3+((gi*37)%23)/23*(H*.12),gx=((gi*127+t*(6+gi%3*4))%W),ga=.2+.5*Math.abs(Math.sin(t*1.3+gi));x.globalAlpha=ga*.8;x.fillRect(gx,gy,3+gi%5*2,1.2);}x.globalAlpha=1;}
 x.fillStyle=this.gHaze;x.fillRect(0,hy,W,H*.07);
 /* ---- track: sand path or jetty planks ---- */
 var st=0;for(i=1;i<=n;i++){if(i===n||K[i*7+5]!==K[st*7+5]){var zn=K[st*7+5],e=Math.min(i,n-1),j;
   if(zn===2){x.fillStyle='rgba(10,60,100,.25)';x.beginPath();for(j=st;j<=e;j++)x.lineTo(X(j,-HALF-.1)+K[j*7+1]*.25,Y(j)+K[j*7+1]*.35);for(j=e;j>=st;j--)x.lineTo(X(j,HALF+.1)+K[j*7+1]*.25,Y(j)+K[j*7+1]*.35);x.fill();}
   x.fillStyle=zn===2?P.plank:P.track;x.beginPath();for(j=st;j<=e;j++)x.lineTo(X(j,-HALF),Y(j));for(j=e;j>=st;j--)x.lineTo(X(j,HALF),Y(j));x.fill();
   x.fillStyle=zn===2?P.plankLine:P.edge;x.beginPath();for(j=st;j<=e;j++)x.lineTo(X(j,-HALF-.16),Y(j));for(j=e;j>=st;j--)x.lineTo(X(j,-HALF+.03),Y(j));x.fill();
   x.beginPath();for(j=st;j<=e;j++)x.lineTo(X(j,HALF-.03),Y(j));for(j=e;j>=st;j--)x.lineTo(X(j,HALF+.16),Y(j));x.fill();st=i;}}
 /* plank seams (jetty) and lane dashes (sand) */
 x.strokeStyle=P.plankLine;x.lineWidth=1;x.beginPath();var anyP=false;
 for(i=0;i<n-1;i++){var zi=K[i*7],dzi=zi-camZ;if(dzi>70)break;if(K[i*7+5]!==2||K[(i+1)*7+5]!==2)continue;anyP=true;
  for(var q=0;q<4;q++){var fz=q/4,xa=lerp(X(i,-HALF),X(i+1,-HALF),fz),xb=lerp(X(i,HALF),X(i+1,HALF),fz),ya=lerp(Y(i),Y(i+1),fz);x.moveTo(xa,ya);x.lineTo(xb,ya);}}
 if(anyP){x.globalAlpha=.55;x.stroke();x.globalAlpha=1;}
 x.fillStyle=P.lane;
 for(i=0;i<n-1;i++){zi=K[i*7];if(zi-camZ>90)break;if(K[i*7+5]===2||Math.round(zi/SEG)%2)continue;
  for(var l=-1;l<=1;l+=2){var lx=l*LANE/2;x.beginPath();x.moveTo(X(i,lx-.06),Y(i));x.lineTo(X(i,lx+.06),Y(i));x.lineTo(X(i+1,lx+.06),Y(i+1));x.lineTo(X(i+1,lx-.06),Y(i+1));x.fill();}}
 var self=this;
 function P3(l,z){var dz=z-camZ,s=Fk/dz;return[W/2+(cxAt(T,z)-bcx-slope*dz-camX+l)*s,hy+camH*s,s];}
 function band(z1,z2,col,l1,l2){if(z1-camZ<.8)z1=camZ+.8;if(z2<=z1)return;var a=P3(l1==null?-HALF:l1,z1),b2=P3(l2==null?HALF:l2,z1),c=P3(l2==null?HALF:l2,z2),e2=P3(l1==null?-HALF:l1,z2);x.fillStyle=col;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b2[0],b2[1]);x.lineTo(c[0],c[1]);x.lineTo(e2[0],e2[1]);x.fill();}
 [0,race.len].forEach(function(zl){if(zl-camZ>1&&zl-camZ<ahead){for(var qq=0;qq<8;qq++){band(zl,zl+.35,qq%2?'#fff':P.ink,-HALF+qq*HALF/4,-HALF+(qq+1)*HALF/4);band(zl+.35,zl+.7,qq%2?P.ink:'#fff',-HALF+qq*HALF/4,-HALF+(qq+1)*HALF/4);}}});
 var ob=T.obs,lo=0;while(lo<ob.length&&ob[lo].z<camZ)lo++;
 for(i=lo;i<ob.length&&ob[i].z<camZ+ahead;i++){if(ob[i].t==='gap'){band(ob[i].z-.95,ob[i].z+.95,'#0E6FA8');band(ob[i].z-.95,ob[i].z-.72,'rgba(255,255,255,.9)');band(ob[i].z+.8,ob[i].z+.95,'#4A2A12');}}
 /* ---- sprites, far to near ---- */
 var it=this.items;it.length=0;var maxZ=camZ+ahead;
 var de=T.deco;lo=0;var hi=de.length;while(lo<hi){var m=(lo+hi)>>1;if(de[m].z<camZ+.8)lo=m+1;else hi=m;}
 for(i=lo;i<de.length&&de[i].z<maxZ;i++){if(this.lite&&de[i].z>camZ+80&&(de[i].t==='shells'||de[i].t==='star'||de[i].t==='flowers'))continue;it.push(de[i]);}
 lo=0;while(lo<ob.length&&ob[lo].z<camZ+.8)lo++;for(i=lo;i<ob.length&&ob[i].z<maxZ;i++)if(ob[i].t!=='gap')it.push(ob[i]);
 var pk=T.pk;for(i=0;i<pk.length;i++)if(pk[i].z>camZ+.8&&pk[i].z<maxZ&&!me.got[pk[i].i])it.push(pk[i]);
 var rsn=race.runners;for(i=0;i<rsn.length;i++){var rr=rsn[i],rz=rr.rz!=null?rr.rz:rr.z;rr._dz=rz;if(rz>camZ+.9&&rz<maxZ)it.push(rr);}
 for(i=0;i<race.proj.length;i++)if(race.proj[i].z>camZ+.9)it.push(race.proj[i]);
 for(i=0;i<race.fx.length;i++)if(race.fx[i].z>camZ+.9)it.push(race.fx[i]);
 if(race.len>camZ+1&&race.len<maxZ)it.push({z:race.len+.4,t:'arch',x:0});
 for(i=0;i<it.length;i++)it[i]._s=it[i].ctl?it[i]._dz:it[i].z;
 it.sort(function(a,b){return b._s-a._s;});
 var bob=0,lead=mz;for(i=0;i<rsn.length;i++){var lz=rsn[i].rz!=null?rsn[i].rz:rsn[i].z;if(lz>lead)lead=lz;}
 for(i=0;i<it.length;i++){var Q=it[i],p=P3(0,Q._s),s2=p[2],fade=clamp((maxZ-Q._s)/18,0,1);x.globalAlpha=fade;
  if(Q.ctl){Q._behind=Q!==me&&Q._s<mz-.5;if(Q._behind){var dzb=Q._s-camZ;if(dzb<2.2){x.globalAlpha=1;continue;}x.globalAlpha=fade*clamp((dzb-1.5)/(CAM.back*.95),.15,.8);}this.runner(x,Q,p,s2,t,me,race);}
  else if(Q.t&&OB[Q.t]){var lx2=Q.lane<0?0:(Q.lane-1)*LANE,px=p[0]+lx2*s2,key=Q.t;
   if(Q.t==='fall'){this.palmFall(x,Q,p,s2,t,lead,mz);}
   else{if(Q.t==='crab')key='crab'+(Math.floor(t*5+Q.id)%2);x.fillStyle=P.shadow;var ow=(sprR(key)||{wm:1}).wm;x.beginPath();x.ellipse(px+.1*s2,p[1],ow*.5*s2,ow*.12*s2+.5,0,0,6.3);x.fill();
    drawSpr(x,key,px,p[1],s2,false);}}
  else if(Q.k){var px2=p[0]+(Q.lane-1)*LANE*s2,bb=.35+Math.sin(t*4+Q.z)*.1,sq=.55+.45*Math.abs(Math.cos(t*2.2+Q.z));x.fillStyle=P.shadow;x.beginPath();x.ellipse(px2,p[1],.32*s2,.08*s2+.5,0,0,6.3);x.fill();
   var cr=sprR('crate_'+Q.k),cw=cr.wm*s2,ch=cw*cr.fh/cr.fw;blit(x,IMG.sprites,cr,px2-cw*sq/2,p[1]-(bb*s2)-ch,cw*sq,ch);}
  else if(Q.o!==undefined){var px3=p[0]+Q.x*s2,py3=p[1]-Q.y*s2;x.fillStyle=P.shadow;x.beginPath();x.ellipse(px3,p[1],.2*s2,.05*s2+.5,0,0,6.3);x.fill();
   var co=sprR('coconut'),cs=co.wm*s2;x.save();x.translate(px3,py3);x.rotate(Q.sp);blit(x,IMG.sprites,co,-cs/2,-cs/2,cs,cs);x.restore();}
  else if(Q.life!==undefined){this.fxDraw(x,Q,p,s2,t);}
  else if(Q.t==='arch'){drawSpr(x,'arch',p[0],p[1],s2);}
  else{var px4=p[0]+Q.x*s2,sp=sprR(Q.t);if(!sp)continue;var sw4=sp.wm*s2;if(px4+sw4<-10||px4-sw4>W+10){x.globalAlpha=1;continue;}
   if(Q.t==='boat'||Q.t==='buoy'||Q.t==='rocksea'){var bo=Math.sin(t*1.6+Q.z)*.05*s2;drawSpr(x,Q.t,px4,p[1]+.25*s2+bo,s2,Q.f);}
   else{if(Q.t!=='shells'&&Q.t!=='star'){x.fillStyle=P.shadow;x.beginPath();x.ellipse(px4+sw4*.12,p[1],sw4*.34,sw4*.07+.5,0,0,6.3);x.fill();}drawSpr(x,Q.t,px4,p[1],s2,Q.f);}}
 }
 x.globalAlpha=1;
 /* gulls in the sky */
 if(!this.lite){for(var gq=0;gq<2;gq++){var gxp=((t*(14+gq*6)+gq*260)%(W+160))-80,gyp=hy*(.35+gq*.22)+Math.sin(t*.8+gq)*6,gs=sprR('gull'+(Math.floor(t*4+gq)%2));if(gs){var gw=W*.07;blit(x,IMG.sprites,gs,gxp,gyp,gw,gw*gs.fh/gs.fw);}}}
 /* speed lines at top speed */
 if(!this.lite&&(me.speed||0)>14.6){x.strokeStyle='rgba(255,255,255,.3)';x.lineWidth=1.5;x.beginPath();for(i=0;i<6;i++){var a2=i*1.7+Math.floor(t*14)*.9,yy=hy+((a2*97)%1)*(H-hy);var side=i%2?W-8:8;x.moveTo(side,yy);x.lineTo(side+(i%2?-1:1)*W*.1,yy+12);}x.stroke();}
 if(this.prog)this.drawProg(x,race,me);
};
/* a falling palm: it stands beside the track (right), tips a little, then falls across all three lanes and
   lies there as a trunk to jump; it lands when the leading runner is 12 m away (same for every phone) */
View.prototype.palmFall=function(x,Q,p,s,t,lead,mz){
 var pr=clamp((lead-(Q.z-40))/28,0,1),bx=p[0]+(HALF+1.4)*s,gy=p[1];
 if(pr<1){var a=pr<.35?-(.05+.07*pr/.35)-(pr>.08?.035*Math.sin(t*17):0):-(.12+(Math.PI/2-.12)*Math.pow((pr-.35)/.65,2));Q._land=0;
  x.fillStyle=PAL.shadow;x.beginPath();x.ellipse(bx-Math.sin(-a)*2.2*s,gy,(.7+2.4*Math.sin(-a))*s,.14*s+.5,0,0,6.3);x.fill();
  x.save();x.translate(bx,gy);x.rotate(a);drawSpr(x,'palmtip',0,0,s,false);x.restore();return;}
 if(!Q._land){Q._land=t;if(this.onThud&&Q.z-mz<45&&Q.z>mz-5)this.onThud();}
 var el=t-Q._land,r=sprR('palmfall'),w=r.wm*s,h=w*r.fh/r.fw,cx=bx-(566/600-.5)*w,sq=el<.6?1+.22*Math.sin(el*22)*Math.exp(-el*6):1;
 x.fillStyle=PAL.shadow;x.beginPath();x.ellipse(cx,gy,w*.46,.16*s+.5,0,0,6.3);x.fill();
 x.save();x.translate(cx,gy);x.scale(1,sq);blit(x,IMG.sprites,r,-w/2,-h+.12*s,w,h);x.restore();
 if(el<.55){var pf=sprR(el<.25?'puff0':'puff1');if(pf){var pw=pf.wm*s*1.2,ph=pw*pf.fh/pf.fw,al=x.globalAlpha;x.globalAlpha=al*Math.min(1,(.55-el)*3);[-1.4,.4,2.2].forEach(function(o){blit(x,IMG.sprites,pf,bx-(3.5-o)*s*.9-pw/2,gy-ph*.8,pw,ph);});x.globalAlpha=al;}}};
View.prototype.fxDraw=function(x,q,p,s,t){var k=q.life,px=p[0]+(q.x||0)*s;
 if(q.t==='bonk'){var st=sprR('stars');var w=st.wm*s;x.save();x.translate(px,p[1]-1.75*s);x.rotate(k*8);blit(x,IMG.sprites,st,-w/2,-w*st.fh/st.fw/2,w,w*st.fh/st.fw);x.restore();}
 else if(q.t==='splash'){var f=k>.6?0:k>.3?1:2;drawSpr(x,'splash'+f,px,p[1]+.15*s,s);}
 else if(q.t==='puff'){drawSpr(x,'puff'+(k>.25?0:1),px,p[1],s);}
 else if(q.t==='dust'){x.globalAlpha*=Math.min(1,k*3);drawSpr(x,'puff1',px,p[1],s,false,.6);}};
var FACEMAX={hit:1,win:1};
View.prototype.runner=function(x,r,p,s,t,me,race){
 var L=r.look;if(!L||!L.sheet)return;var S=L.sheet,rx=r.rx!=null?r.rx:r.x,ry=r.ry!=null?r.ry:r.y,px=p[0]+rx*s,gy=p[1],alpha=x.globalAlpha,bp=S.bp,ms=r.moving!==false;
 x.fillStyle=PAL.shadow;x.beginPath();x.ellipse(px,gy,.34*s*(1-Math.min(.5,ry*.3)),.09*s+.5,0,0,6.3);x.fill();
 if(r.inv>0&&r.fall<=0&&Math.floor(t*14)%2)x.globalAlpha=alpha*.5;
 /* which body frame */
 var fr,M=A.body.meta,swim=r.water||r.fall>0;
 if(swim)fr='swim'+(Math.floor(t*4)%2);
 else if(r.fin&&r.face>0)fr='win'+(Math.floor(t*5)%2);
 else if(r.stum>0)fr='stum'+(Math.floor(t*6)%2);
 else if(r.slide>0)fr='slide';
 else if(ry>.05)fr='jump';
 else if(!ms||race.t<0)fr='idle';
 else fr='run'+(Math.floor(((r._dz||r.z)/2.2%1)*8+8)&7);
 var fi=S.idx[fr],bw=s*1,bh=s*1,by=gy-ry*s,lean=clamp(r.lean||0,-1,1)*.16,m=M[fr];
 x.save();x.translate(px,by);if(lean)x.rotate(lean);
 if(swim){var wy=.1*s;x.save();x.beginPath();x.rect(-bw,-bh*2,bw*2,bh*2-.02*s+wy-bh*.0);x.clip();x.drawImage(S.c,fi*bp,0,bp,bp,-bw/2,-bh+wy+.28*s,bw,bh);this.head(x,r,S,m,-bw/2,-bh+wy+.28*s,bw,bh,t);x.restore();
  x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.ellipse(0,wy,.6*s,.13*s,0,0,6.3);x.fill();}
 else{x.drawImage(S.c,fi*bp,0,bp,bp,-bw/2,-bh*.97,bw,bh);this.head(x,r,S,m,-bw/2,-bh*.97,bw,bh,t);}
 if(r.sh>0){var bu=sprR('bubble'),uw=bu.wm*s*1.05;x.globalAlpha=alpha*(r.sh<1?(Math.floor(t*10)%2?.4:.85):.85);blit(x,IMG.sprites,bu,-uw/2,-uw*bu.fh/bu.fw*1.02,uw,uw*bu.fh/bu.fw);}
 x.restore();x.globalAlpha=alpha;
 if(r.dash>0){x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=Math.max(1,.05*s);x.beginPath();for(var i=-1;i<=1;i++){x.moveTo(px+i*.25*s,by+.05*s);x.lineTo(px+i*.32*s,by+.5*s);}x.stroke();}
 r._sx=px;r._sy=by-1.3*s;
 if(this.tags&&r!==me){if(!r._behind)this.tag(x,r,px,by-1.55*s,s);}
 else if(r===me&&!swim&&!this.noMe){var ty=by-1.62*s-6;if(ty>this.hy+10){x.fillStyle='#FF5A4E';x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.moveTo(px-7,ty-9);x.lineTo(px+7,ty-9);x.lineTo(px,ty);x.closePath();x.fill();x.stroke();}}};
/* head: the back of the head, or a quick turn to show the face */
View.prototype.head=function(x,r,S,m,bx,by,bw,bh,t){
 var hw=bw*S.hw/S.bp,hh=bh*S.hh/S.bp,nx=bx+m.nx*bw,ny=by+m.ny*bh;
 var turn=0;if(r.face>0){if(!r._faceOn){r._faceOn=1;r._fmax=r.face;}var el=r._fmax-r.face;turn=Math.min(1,el/.14,r.face/.14);}else r._faceOn=0;
 var fimg=r.faces&&(r.faceK==='win'?r.faces.laugh:r.faces.shocked);
 x.save();x.translate(nx,ny);if(m.rot)x.rotate(m.rot);
 var bobH=Math.sin(t*14+(r.id||0))*.004*bh;
 if(turn>0&&fimg&&fimg.complete&&fimg.naturalWidth){
  /* squash the back of the head away, then the face turns in */
  var sq=turn<.5?1-turn*2:(turn-.5)*2;x.scale(Math.max(.02,sq),1);
  if(turn<.5)x.drawImage(S.c,S.hx,0,S.hw,S.hh,-hw/2,-hh*(96/120)+bobH,hw,hh);
  else{var fw=hw*1.28,fh=fw*.8;x.drawImage(fimg,0,0,fimg.naturalWidth,fimg.naturalHeight*.8,-fw/2,-hh*(96/120)+hh*.02,fw,fh);}
 }else x.drawImage(S.c,S.hx,0,S.hw,S.hh,-hw/2,-hh*(96/120)+bobH,hw,hh);
 x.restore();};
View.prototype.tag=function(x,r,px,py,s){if(py>this.H*.86||py<this.hy+8||s<22)return;
 var key=r.place+'|'+r.name,c=this.tagC[r.id];
 if(!c||c.k!==key){var fs=11,cc=cv(10,10),cx=cc.getContext('2d');cx.font='800 '+fs+'px system-ui,-apple-system,"Segoe UI",sans-serif';var tx=r.place+' '+r.name,w=Math.ceil(cx.measureText(tx).width)+14,dp=Math.min(2,G.devicePixelRatio||1);
  cc.width=w*dp;cc.height=(fs+8)*dp;cx=cc.getContext('2d');cx.scale(dp,dp);cx.font='800 '+fs+'px system-ui,-apple-system,"Segoe UI",sans-serif';cx.fillStyle='rgba(23,32,52,.7)';cx.beginPath();var h=fs+8;cx.moveTo(h/2,0);cx.arcTo(w,0,w,h,h/2);cx.arcTo(w,h,0,h,h/2);cx.arcTo(0,h,0,0,h/2);cx.arcTo(0,0,w,0,h/2);cx.fill();
  cx.fillStyle='#fff';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(tx,w/2,h/2+.5);c=this.tagC[r.id]={c:cc,k:key,w:w,h:h};}
 var sc=clamp(s/60,.8,1.1);x.drawImage(c.c,px-c.w*sc/2,py-c.h*sc,c.w*sc,c.h*sc);};
/* progress bar across the top (drawn in the canvas: no per-frame DOM work) */
View.prototype.drawProg=function(x,race,me){var g=this.prog,y=g.y,l=g.x,w=g.w;
 x.fillStyle='rgba(255,255,255,.4)';x.beginPath();x.roundRect?x.roundRect(l,y-3,w,6,3):x.rect(l,y-3,w,6);x.fill();
 x.fillStyle='#FFFFFF';x.fillRect(l+w-3,y-8,4,16);x.fillStyle=PAL.ink;x.fillRect(l+w-3,y-8,4,4);x.fillRect(l+w-3,y,4,4);
 var rs=race.runners,i,r,sz;
 for(i=0;i<=rs.length;i++){r=i<rs.length?rs[i]:me;if((i<rs.length&&r===me)||!r.icon)continue;sz=r===me?24:19;var f=clamp((r.rz!=null?r.rz:r.z)/race.len,0,1),cx=l+f*w;
  x.fillStyle=r===me?'#FF5A4E':'#FFFFFF';x.beginPath();x.arc(cx,y,sz/2+2,0,6.2832);x.fill();x.drawImage(r.icon,cx-sz/2,y-sz/2,sz,sz);}};
/* a standalone runner (for the start sheet / results): draws the idle frame + head into a small canvas */
function portrait(c,r,frame){var x=c.getContext('2d'),S=r.look&&r.look.sheet;if(!S)return;var W=c.width,H=c.height;x.clearRect(0,0,W,H);var s=Math.min(W/1.05,H/1.5),fi=S.idx[frame||'idle'],m=A.body.meta[frame||'idle'];
 var bx=W/2-s/2,by=H-s*1.02;x.fillStyle='rgba(0,0,0,.14)';x.beginPath();x.ellipse(W/2,H-s*.06,s*.3,s*.07,0,0,6.3);x.fill();x.drawImage(S.c,fi*S.bp,0,S.bp,S.bp,bx,by,s,s);
 var hw=s*S.hw/S.bp,hh=s*S.hh/S.bp;x.drawImage(S.c,S.hx,0,S.hw,S.hh,bx+m.nx*s-hw/2,by+m.ny*s-hh*(96/120),hw,hh);}

G.RRV={load:load,View:View,lookOf:lookOf,runnerSheet:runnerSheet,faceImgs:faceImgs,iconOf:iconOf,portrait:portrait,drawSpr:drawSpr,blit:blit,IMG:IMG,PAL:PAL,CAM:CAM,
 get A(){return A;},sprR:sprR,HAIRMAP:HAIRMAP};
})(window);
