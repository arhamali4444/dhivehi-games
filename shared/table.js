/* Dhivehi Games: the ONE card-table layout for every card game (window.DGTable). No dependencies.
   Load with <script src="../shared/table.js?v=1"></script>. Digu uses it first; Bondi, Ranga, Dhogu, Dhihaeh,
   Thaas, Joker, Juice and Dhashundhama can adopt it one at a time. The table's LOOK (theme, skin, colours)
   stays in each game: this file only decides WHERE things go.

   USAGE
     DGTable.injectCSS()                         adds the shared CSS once (timer ring, hand fan motion)
     var land = DGTable.isLandscape(innerWidth, innerHeight)
     var g = DGTable.arena({W, H, n, seating:'digu'|'bondi'|'team', land, aspect, bottom})
        W,H      the play area box (below the top bar; in portrait, above your hand)
        n        players at the table INCLUDING you (2..6)
        seating  'digu'  (Digu's opponent angles, the table a little lower, wide spread)   default
                 'bondi' (Bondi's angles, table higher, room for a message pill under it)
                 'team'  (2 v 2: partner straight across, opponents left and right)
        aspect   oval height / width in portrait (default 1.105, Bondi's table)
        land     sideways phone (DGTable.isLandscape): a wide flat oval, seats around it, piles centred. Make the
                 box start at the very top (float the top bar over it and keep its middle free for the player
                 across) and put ONE row under it: your name | your hand (DGTable.fan) | your button.
        bottom   landscape only: px covered by your hand row at the bottom of the box (0 if the row is outside it)
      returns (all px, relative to the box):
        g.oval  {x,y,w,h,cx,cy,rx,ry,rail,fx,fy}   outer oval, rail thickness and felt radii
        g.seats [{x,y,a}]    avatar CENTRE of each opponent, in turn order after you (a = angle, degrees)
        g.seat  {w,av,top,row}  seat block width, avatar size, gap from avatar centre to block top;
                             row=true (sideways): put the name + score beside the avatar, not under it
        g.piles {pw,ph,gap,y,a:{x,y},b:{x,y}}  card width/height and the CENTRES of the two piles (a left, b right)
        g.status {x,y}       centre of the one-line game message (under the piles)
        g.ad    {x,y,k,show} centre + scale of the sponsor piece on the felt (show=false when there's no room)
        g.plate {x,y,show}   centre of the small nameplate on the rail (bottom of the oval)
     DGTable.handCard({vw,vh,n,land})             hand card width for n cards (a touch smaller at 10+)
     var f = DGTable.fan({W, cw, n, gaps, focus, sel, press, land, pad})
        ONE fanned row that always fits in W (never off-screen). gaps[i] = true puts a small gap BEFORE card i
        (between sets/runs). focus = finger/mouse x in the box (or null): cards near it spread wider, dock-style,
        and the card under the finger (press = its index) lifts a little. sel = index of the lifted/selected card.
        returns {x:[],y:[],r:[],x0,x1,cw,step,liftSel}: top-left x/y and rotation (deg) of each card
     DGTable.indexAt(f, x)                        where a card dragged to x would go (for drag-to-reorder)
     DGTable.nearest(f, x)                        index of the card whose face is under x
     DGTable.ringHTML()                           the turn-timer ring markup (<span class="dgt-ring">); set
                                                  --d (duration) and --dl (negative = already running) on it,
                                                  --tc for the colour; classes .warn/.hot recolour it.
   Every position is a plain number: apply it with transform: translate(...) so all motion stays on the compositor. */
(function (root) {
  'use strict';
  var SEATS = {
    digu: [[], [90], [130, 50], [151, 90, 29], [164, 122, 58, 16], [172, 132, 90, 48, 8], [174, 140, 106, 74, 40, 6]],
    bondi: [[], [90], [140, 40], [156, 90, 24], [166, 122, 58, 14], [170, 130, 90, 50, 10], [172, 136, 106, 74, 44, 8]],
    team: [[], [90], [140, 40], [160, 90, 20], [166, 122, 58, 14], [170, 130, 90, 50, 10], [172, 136, 106, 74, 44, 8]]
  };
  var cl = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function isLandscape(vw, vh) { return vw > vh && vh <= 520; }

  function arena(o) {
    /* n may be 7 when a spectator watches a full 6-player table (6 opponents, nobody at the bottom) */
    var W = o.W, H = o.H, n = Math.max(2, Math.min(7, o.n | 0)), nO = n - 1, land = !!o.land;
    var seating = SEATS[o.seating] ? o.seating : 'digu', ang = SEATS[seating][nO] || [];
    var ow, oh, oy, rail, top, bot, av, sw, ar;
    if (!land) {
      ar = o.aspect || 1.105;
      top = seating === 'bondi' ? (nO >= 3 ? 56 : 62) : (nO >= 4 ? 50 : 58);
      bot = seating === 'bondi' ? 44 : 10;
      ow = Math.min(W * 0.92, 560);
      oh = Math.max(120, Math.min(H - top - bot, ow * ar));
      if (oh < ow * ar * 0.8) ow = oh / (ar * 0.8);
      oy = Math.round(top + Math.max(0, H - top - bot - oh) * (seating === 'bondi' ? 0.45 : (nO >= 3 ? 0.72 : 0.5)));
      rail = cl(ow * 0.061, 12, 24);
      av = cl(W * 0.124, 38, 50) * (nO >= 5 ? 0.88 : nO >= 3 ? 0.94 : 1);
      sw = nO >= 5 ? 62 : nO >= 3 ? 68 : 76;
    } else {
      /* sideways: the box should reach the top of the screen (the game's top bar floats over it, with the
         middle kept free), so the player across sits above a wide, flat oval */
      ar = 0.42; av = cl(H * 0.12, 32, 40); top = Math.round(av * 0.5 + 40); bot = o.bottom || 0;
      oh = Math.max(90, H - top - bot - 6);
      ow = Math.min(W * 0.7, oh / ar, 720);
      oh = Math.min(oh, ow * 0.46);
      oy = Math.round(top + Math.max(0, H - top - bot - oh) * 0.4);
      rail = cl(oh * 0.09, 10, 18);
      sw = Math.round(av + 80);   /* seat.row: name + score BESIDE the avatar, so seats stay short */
    }
    var ox = (W - ow) / 2, cx = ox + ow / 2, cy = oy + oh / 2, rx = ow / 2, ry = oh / 2;
    var oval = { x: ox, y: oy, w: ow, h: oh, cx: cx, cy: cy, rx: rx, ry: ry, rail: rail, fx: rx - rail, fy: ry - rail };
    var half = sw / 2, seats = ang.map(function (a) {
      var t = a * Math.PI / 180;
      var sy = land ? 1.08 : 1.06, sx = land ? 1.04 : 1.02;
      return { x: cl(cx + rx * sx * Math.cos(t), half + 2, W - half - 2), y: Math.max(av / 2 + 3, cy - ry * sy * Math.sin(t)), a: a };
    });
    /* piles in the middle of the felt; the message under them; the sponsor piece under that if it fits */
    var pw = land ? Math.round(cl(oh * 0.29, 36, 58)) : Math.round(cl(Math.min(W * (nO >= 5 ? 0.17 : 0.19), oh * (nO >= 5 ? 0.26 : 0.3)), 48, 104));
    var ph = pw * 1.4, gap = Math.round(cl(pw * 0.3, 14, 30));
    var py = land ? cy - 6 : seating === 'bondi' ? cy + 6 : cy - 4;
    if (land) py = Math.min(py, cy + oval.fy - ph / 2 - 34);
    var piles = { pw: pw, ph: ph, gap: gap, y: py, a: { x: cx - gap / 2 - pw / 2, y: py }, b: { x: cx + gap / 2 + pw / 2, y: py } };
    var stY = land ? py + ph / 2 + 19 : seating === 'bondi' ? oy + oh + 22 : py + ph / 2 + 30;
    var k = cl(ow / 340, 0.72, 1.12), adY = stY + 18 + 8 + 22 * k;
    var adShow = !land && seating !== 'bondi' && adY + 24 * k < cy + oval.fy * 0.97;
    return {
      land: land, n: n, seating: seating, W: W, H: H, oval: oval, seats: seats,
      seat: { w: sw, av: Math.round(av), top: Math.round(av / 2), row: land },
      piles: piles, status: { x: cx, y: stY }, ad: { x: cx, y: adY, k: k, show: adShow },
      plate: { x: cx, y: cy + ry - rail / 2, show: !land && ow > 230 }
    };
  }

  function handCard(o) {
    var vw = o.vw, vh = o.vh, cw;
    if (o.land) cw = cl(vh * 0.15, 40, 64);
    else { cw = cl(vw * 0.185, 56, 92); if (vh < 740) cw = Math.min(cw, 66); if (vh < 640) cw = Math.min(cw, 60); }
    if ((o.n | 0) >= 10) cw *= 0.93;
    return Math.round(cw);
  }

  /* one row, never off-screen: the fan uses the full width (pad px from each edge), a flat arc, small gaps
     between groups, and a dock-style spread around the finger so the touched card never feels cramped */
  function fan(o) {
    /* pad: the edge cards are tilted, so keep their rotated corners on screen too */
    var W = o.W, cw = o.cw, n = o.n | 0, land = !!o.land, pad = Math.max(o.pad || 0, Math.ceil(cw * 1.4 * Math.sin((land ? 3 : 4.5) * Math.PI / 180) / 2) + 2);
    var gaps = o.gaps || [], gc = 0, i;
    for (i = 1; i < n; i++) if (gaps[i]) gc++;
    var avail = Math.max(cw, W - 2 * pad), gg = cl(cw * 0.14, 5, 10);
    var free = avail - cw - gc * gg;
    if (n > 1 && free / (n - 1) < cw * 0.3) { gg = 3; free = avail - cw - gc * gg; }
    var s0 = n > 1 ? Math.max(0, Math.min(cw * 0.62, free / (n - 1))) : 0;
    var steps = [];
    for (i = 1; i < n; i++) steps.push(s0);
    var focus = o.focus;
    if (focus != null && n > 2 && s0 < cw * 0.58) {
      /* where each gap sits in the plain fan, then widen the ones near the finger and borrow from the far ones */
      var tot0 = cw + s0 * (n - 1) + gc * gg, x = pad + (avail - tot0) / 2, mids = [];
      for (i = 1; i < n; i++) { var xa = x; x += s0 + (gaps[i] ? gg : 0); mids.push((xa + x) / 2 + cw * 0.5); }
      var amp = o.amp == null ? 1.25 : o.amp, sig = cw * 1.2, maxS = cw * 0.66, minS = Math.min(s0, Math.max(cw * 0.25, s0 * 0.5));   /* far cards keep their rank + suit corner */
      var w = mids.map(function (m) { var d = (m - focus) / sig; return 1 + amp * Math.exp(-d * d); });
      var tgt = w.map(function (v) { return Math.min(maxS, s0 * v); });
      var sum = tgt.reduce(function (a, b) { return a + b; }, 0), budget = Math.min(free, cw * 0.62 * (n - 1));
      if (sum > budget) {
        var give = tgt.map(function (t, j) { return Math.max(0, t - minS) / (w[j] * w[j]); });
        var gs = give.reduce(function (a, b) { return a + b; }, 0), ex = sum - budget;
        if (gs > 0) tgt = tgt.map(function (t, j) { return Math.max(minS, t - give[j] * Math.min(1e9, ex / gs)); });
        /* rounding safety: never exceed the budget */
        sum = tgt.reduce(function (a, b) { return a + b; }, 0);
        if (sum > budget) { var sc = budget / sum; tgt = tgt.map(function (t) { return t * sc; }); }
      }
      steps = tgt;
    }
    var total = cw + gc * gg;
    steps.forEach(function (s) { total += s; });
    var x0 = pad + (avail - total) / 2, xs = [], ys = [], rs = [], cx = x0, rot = land ? 3 : 4.5, drop = land ? 5 : 9;
    var liftSel = Math.round(cw * (land ? 0.36 : 0.46)), liftPress = Math.round(cw * 0.16);
    for (i = 0; i < n; i++) {
      if (i > 0) cx += steps[i - 1] + (gaps[i] ? gg : 0);
      var d = cl((cx + cw / 2 - W / 2) / (W / 2), -1, 1);
      xs.push(cx); rs.push(d * rot);
      ys.push(d * d * drop - (i === o.sel ? liftSel : i === o.press ? liftPress : 0));
    }
    return { x: xs, y: ys, r: rs, x0: x0, x1: x0 + total, cw: cw, step: s0, liftSel: liftSel, n: n };
  }
  function indexAt(f, x) { var k = 0; for (var i = 0; i < f.n; i++) if (f.x[i] + f.cw / 2 < x) k++; return k; }
  function nearest(f, x) {
    /* the top-most card whose visible face contains x (later cards sit on top) */
    for (var i = f.n - 1; i >= 0; i--) if (x >= f.x[i] && x <= f.x[i] + f.cw) return i;
    return x < f.x0 ? 0 : f.n - 1;
  }
  function ringHTML(cls) { return '<span class="dgt-ring' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><i class="l"><b></b></i><i class="r"><b></b></i></span>'; }

  var CSS = [
    /* the turn timer: a ring that drains clockwise, transform-only (two half-discs rotating) */
    '.dgt-ring{--tc:var(--ring-c,#FFD36E);position:absolute;inset:-6px;border-radius:50%;z-index:3;pointer-events:none;background:var(--ring-bg,rgba(255,255,255,.16));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4.5px),#000 calc(100% - 4px));mask:radial-gradient(farthest-side,transparent calc(100% - 4.5px),#000 calc(100% - 4px))}',
    '.dgt-ring i{position:absolute;top:0;bottom:0;width:50%;overflow:hidden}',
    '.dgt-ring i.l{left:0}.dgt-ring i.r{right:0}',
    '.dgt-ring b{position:absolute;top:0;bottom:0;width:200%;will-change:transform;animation:var(--an) var(--d,15s) linear var(--dl,0s) both}',
    '.dgt-ring .l b{left:0;background:linear-gradient(90deg,var(--tc) 50%,transparent 50%);--an:dgtL}',
    '.dgt-ring .r b{left:-100%;background:linear-gradient(90deg,transparent 50%,var(--tc) 50%);--an:dgtR}',
    '@keyframes dgtL{0%{transform:rotate(0)}50%,100%{transform:rotate(-180deg)}}',
    '@keyframes dgtR{0%,50%{transform:rotate(0)}100%{transform:rotate(-180deg)}}',
    '.dgt-ring.warn{--tc:#FF9A3D}.dgt-ring.hot{--tc:#FF4D4D}',
    /* the hand: slow spring when cards settle, quick follow while a finger spreads the fan */
    '.dgt-hand .card{transition:transform .5s var(--dgt-spring,cubic-bezier(.34,1.3,.5,1))}',
    '.dgt-hand.dgt-mag .card{transition:transform .18s cubic-bezier(.2,.8,.2,1)}',
    '.dgt-hand .card.nt,.dgt-hand .card.dragging{transition:none}',
    /* corner index built to be read at heavy overlap: a narrow column, "10" condensed */
    '.dgt-hand .card .ix{width:calc(var(--w)*.3);left:calc(var(--w)*.035)}',
    '.dgt-hand .card .r10 .ix b,.dgt-hand .card.r10 .ix b{letter-spacing:-.1em;transform:scaleX(.8);transform-origin:10% 50%}',
    '@media (prefers-reduced-motion:reduce){.dgt-hand .card,.dgt-hand.dgt-mag .card{transition:none}}'
  ].join('\n');
  function injectCSS() {
    var d = root.document; if (!d || d.getElementById('dgt-css')) return;
    /* first in <head>, so each game's own CSS can restyle anything here */
    var s = d.createElement('style'); s.id = 'dgt-css'; s.textContent = CSS; (d.head || d.documentElement).insertBefore(s, (d.head || d.documentElement).firstChild);
  }
  root.DGTable = { version: 1, SEATS: SEATS, isLandscape: isLandscape, arena: arena, handCard: handCard, fan: fan, indexAt: indexAt, nearest: nearest, ringHTML: ringHTML, injectCSS: injectCSS };
})(typeof window !== 'undefined' ? window : this);
