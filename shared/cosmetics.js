/*! Dhivehi Games - premium cosmetics: avatar rings + card backs.
 *  Dependency-free. Exposes window.DGCosmetics.
 *
 *  RINGS
 *    DGCosmetics.ring(id, {size, still})  -> HTML string (a <span class="dgc-ring">)
 *      id    : 'f-classic' | 'f-shine' | 'f-bloom' | 'f-bolt' | 'f-fire' | 'f-orbit' | 'f-horizon'
 *              (the 'f-' prefix is optional; the old fx key 'blackhole' is accepted too).
 *              Any other id (incl. the retired f-halo, f-storm, f-sakura, f-arcane) returns ''.
 *      size  : avatar diameter in px (only picks the level of detail: <=56 = table, >56 = store)
 *      still : true -> no animation for this instance
 *    Drop-in for digu's ringFX(): the span is absolutely positioned at inset:-32% of the avatar
 *    container (same box as the old <i class="rfx">, i.e. a 156-unit viewBox where the avatar
 *    edge sits at r~47.6). The container must be position:relative (+ isolation:isolate);
 *    the avatar disc itself must be position:relative;z-index:1 (digu's .frm>.pz already is).
 *    Layers with class dgc-bk sit at z-index 0 (behind the avatar), the rest at z-index 2.
 *
 *  BACKS
 *    DGCosmetics.whaleShark({size, animate}) -> HTML string (<span class="dgc-bkw"> holding SVG)
 *    DGCosmetics.turtle({size, animate})     -> same (static by default)
 *    DGCosmetics.eclipse({size, animate})    -> same; animate defaults to true for eclipse
 *    DGCosmetics.back(id, opts)              -> 'b-whale' / 'b-turtle' / 'b-eclipse' convenience
 *    DGCosmetics.backURL(id, {size})         -> cached data: URL of the static back (table fans)
 *    The span fills its positioned parent (inset:0) - put it inside digu's <div class="back">.
 *    Art is drawn in a 100x140 viewBox (card aspect 1:1.4), preserveAspectRatio slice.
 *
 *  CSS
 *    DGCosmetics.css (string) / DGCosmetics.injectCSS() - injected automatically on first use.
 *    All classes/keyframes are prefixed dgc-. prefers-reduced-motion and .dgc-still on any
 *    ancestor freeze everything on a designed still frame.
 *
 *  Performance: every animation is transform/opacity on HTML layers (<i>) whose SVG content is
 *  static, so the browser rasterises each layer once and the compositor does the rest - no
 *  per-frame JS, no SVG repaint, no large blur filters.
 */
(function (global) {
  'use strict';
  var D2R = Math.PI / 180;
  var uid = 0;
  var nid = function () { uid++; return 'dgc' + uid.toString(36) + '-'; };
  var n2 = function (v) { var r = Math.round(v * 100) / 100; return (r === 0 ? 0 : r).toString(); };
  // mulberry32 - deterministic "random" so every render of an item looks the same
  var RNG = function (seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  // polar: angle in degrees, clockwise from 12 o'clock
  var PO = function (cx, cy, r, a) { return [cx + r * Math.sin(a * D2R), cy - r * Math.cos(a * D2R)]; };
  var pt = function (r, a, cx, cy) { var p = PO(cx == null ? 78 : cx, cy == null ? 78 : cy, r, a); return n2(p[0]) + ' ' + n2(p[1]); };
  var stops = function (a) { return a.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join(''); };
  // '§' is replaced by a unique per-instance prefix
  var RG = function (id, r, st, cx, cy) { return '<radialGradient id="§' + id + '" gradientUnits="userSpaceOnUse" cx="' + (cx == null ? 78 : cx) + '" cy="' + (cy == null ? 78 : cy) + '" r="' + r + '">' + stops(st) + '</radialGradient>'; };
  var RGb = function (id, st, a) { return '<radialGradient id="§' + id + '" ' + (a || '') + '>' + stops(st) + '</radialGradient>'; };
  var LG = function (id, st, a) { return '<linearGradient id="§' + id + '" ' + (a || 'x1="0" y1="0" x2="1" y2="1"') + '>' + stops(st) + '</linearGradient>'; };
  var CI = function (r, attr, cx, cy) { return '<circle cx="' + n2(cx == null ? 78 : cx) + '" cy="' + n2(cy == null ? 78 : cy) + '" r="' + n2(r) + '" ' + attr + '/>'; };
  var R1 = function (r, col, w, op) { return CI(r, 'fill="none" stroke="' + col + '" stroke-width="' + n2(w) + '"' + (op != null && op !== 1 ? ' stroke-opacity="' + op + '"' : '')); };
  var PA = function (d, attr) { return '<path d="' + d + '" ' + attr + '/>'; };

  // a filled band following an arc; rf(t) radius, wf(t) half width, t in 0..1
  function band(a0, a1, rf, wf, n, cx, cy) {
    n = n || Math.max(10, Math.ceil(Math.abs(a1 - a0) / 3));
    var o = [], i = [];
    for (var k = 0; k <= n; k++) {
      var t = k / n, a = a0 + (a1 - a0) * t, r = rf(t), w = wf(t);
      o.push(pt(r + w, a, cx, cy)); i.push(pt(r - w, a, cx, cy));
    }
    return 'M' + o.join('L') + 'L' + i.reverse().join('L') + 'Z';
  }
  var lens = function (r, a0, a1, w) { return band(a0, a1, function () { return r; }, function (t) { return w / 2 * Math.sin(Math.PI * t); }); };
  var comet = function (r, a0, a1, w) { return band(a0, a1, function () { return r; }, function (t) { return w / 2 * Math.pow(t, 1.35); }); };
  function star4(x, y, R, fill, op, rot) {
    var w = R * 0.15;
    return '<path d="M0 ' + n2(-R) + 'C' + n2(w) + ' ' + n2(-w) + ' ' + n2(w) + ' ' + n2(-w) + ' ' + n2(R) + ' 0C' + n2(w) + ' ' + n2(w) + ' ' + n2(w) + ' ' + n2(w) + ' 0 ' + n2(R) + 'C' + n2(-w) + ' ' + n2(w) + ' ' + n2(-w) + ' ' + n2(w) + ' ' + n2(-R) + ' 0C' + n2(-w) + ' ' + n2(-w) + ' ' + n2(-w) + ' ' + n2(-w) + ' 0 ' + n2(-R) + 'Z" transform="translate(' + n2(x) + ' ' + n2(y) + ')' + (rot ? ' rotate(' + rot + ')' : '') + '" fill="' + fill + '"' + (op != null ? ' opacity="' + op + '"' : '') + '/>';
  }
  // Catmull-Rom -> cubic bezier through points (open)
  function crPath(p, close) {
    var d = 'M' + n2(p[0][0]) + ' ' + n2(p[0][1]);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || (close ? p[p.length - 1] : p[i]), p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || (close ? p[0] : p2);
      d += 'C' + n2(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + n2(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + n2(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + n2(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + n2(p2[0]) + ' ' + n2(p2[1]);
    }
    return d + (close ? 'Z' : '');
  }

  // ring layer: full-size <i> holding a static SVG (156 viewBox)
  var L = function (inner, cls, style, defs) { return '<i class="dgc-l' + (cls ? ' ' + cls : '') + '"' + (style ? ' style="' + style + '"' : '') + '><svg viewBox="0 0 156 156" focusable="false">' + (defs ? '<defs>' + defs + '</defs>' : '') + inner + '</svg></i>'; };
  // small particle element; x,y in 156 space, sz in % of the ring box
  var ptc = 0;
  var PT = function (x, y, sz, inner, cls, style, vb) { inner = sfx(inner, 'p' + (ptc++)); return '<i class="dgc-pt' + (cls ? ' ' + cls : '') + '" style="left:' + n2(x / 1.56 - sz / 2) + '%;top:' + n2(y / 1.56 - sz / 2) + '%;width:' + sz + '%;height:' + sz + '%;' + (style || '') + '"><svg viewBox="' + (vb || '-10 -10 20 20') + '" focusable="false">' + inner + '</svg></i>'; };
  // give a copy of some markup its own gradient/clip ids (same instance, different layer)
  var sfx = function (s, t) { return s.replace(/(id="|url\(#|href="#)§/g, '$1§' + t); };
  var org = function (x, y) { return 'transform-origin:' + n2(x / 1.56) + '% ' + n2(y / 1.56) + '%'; };

  /* ------------------------------------------------------------------ rings */
  var RB = {};

  RB.classic = function (sm) {
    var k = sm ? 1.2 : 1;
    var d = LG('p', [[0, '#FFFFFF'], [.4, '#EEF2F5'], [.55, '#B7C3CC'], [.78, '#FAFBFC'], [1, '#CFD8DF']]);
    return L(R1(52.3, '#062030', 1.8 * k, .2) + R1(50, 'url(#§p)', 3.6 * k) + R1(48.2, '#5F7280', .5 * k, .45) + R1(51.75, '#FFFFFF', .45 * k, .9), '', '', d);
  };

  RB.shine = function (sm) {
    var k = sm ? 1.2 : 1;
    var d = LG('g', [[0, '#FFF3C4'], [.16, '#EDBE55'], [.33, '#8E5A12'], [.5, '#F4D27A'], [.6, '#FFF8E2'], [.74, '#C98A1C'], [.88, '#7E4F0D'], [1, '#E9B64C']]);
    var bez = R1(51.2, 'url(#§g)', 6.4 * k) + R1(51.2 - 3.2 * k, '#4A2E05', .8, .75) + R1(51.2 + 3.2 * k, '#5A3808', .8, .6) + R1(51.2 + 2.3 * k, '#FFF1C2', .5, .85) + R1(51.2 - 2.2 * k, '#FFE7A0', .45, .7) + R1(51.2, '#6E450B', .35, .3);
    var hl = PA(lens(51.2, -50, 50, 5.8 * k), 'fill="#FFFFFF" opacity=".2"') + PA(lens(51.2, -27, 27, 4.8 * k), 'fill="#FFFFFF" opacity=".38"') + PA(lens(51.2, -11, 11, 3.2 * k), 'fill="#FFFFFF" opacity=".95"') + PA(lens(51.2, 150, 210, 3.8 * k), 'fill="#FFF6D8" opacity=".22"');
    var g = PO(78, 78, 55, 42);
    var glint = '<g transform="translate(' + n2(g[0]) + ' ' + n2(g[1]) + ')"><circle r="6" fill="url(#§gl)"/>' + star4(0, 0, 10, '#FFFFFF') + star4(0, 0, 4.6, '#FFFFFF', .9, 45) + '</g>';
    return L(bez, 'dgc-shd-gold', '', d) + L(hl, 'dgc-spin', 'animation-duration:4.6s') + L(glint, 'dgc-glint', org(g[0], g[1]), RGb('gl', [[0, '#FFFFFF', .95], [1, '#FFE7A0', 0]]));
  };

  /* Pastel Bloom - a Maldivian flower crown: frangipani (hero), jasmine buds, hibiscus accents,
     leaves and a rose-gold vine. Some flowers sit behind the avatar edge (z 0), the rest in front. */
  RB.bloom = function (sm) {
    var rnd = RNG(12), i;
    var FP = 'M0 0C-2.7-1.3-5.1-5.1-4.4-8.6C-3.8-11.3-.6-12.6 1.9-11.2C3.8-10.1 3.5-6.4 1.5-3.3C.9-2.1.4-.9 0 0Z';
    var HP = 'M0 0C-3.4-1.6-6.2-5.4-5.6-8.6Q-4.8-10.8-2.6-10.4Q-1.2-11.8.4-10.9Q2.2-11.6 3.6-10.2Q5.6-8.8 5.2-6.4C4.6-3.6 2.2-1.2 0 0Z';
    var LF = 'M0 0C2.6-3.6 3.1-11 0-17C-3.1-11-2.6-3.6 0 0Z';
    var JB = 'M0 0C-1.15-1.4-1.35-4.3 0-6.6C1.35-4.3 1.15-1.4 0 0Z';
    var d = RGb('fw', [[0, '#FFBE3B'], [.26, '#FFDA7A'], [.52, '#FFF4DA'], [1, '#FFFFFF']], 'cx=".58" cy="1" r="1.08"') +
      RGb('fp', [[0, '#FFB443'], [.26, '#FFD3A2'], [.55, '#FBD5DE'], [1, '#F2A2BC']], 'cx=".58" cy="1" r="1.08"') +
      RGb('fl', [[0, '#FFC457'], [.26, '#FBDCC6'], [.58, '#EBD9F6'], [1, '#C9AEEC']], 'cx=".58" cy="1" r="1.08"') +
      RGb('hb', [[0, '#B8154F'], [.24, '#EC6A8A'], [.66, '#FFA99E'], [1, '#FFD6C8']], 'cx=".5" cy="1" r="1.05"') +
      LG('lf', [[0, '#5A9A73'], [.5, '#B3DDB5'], [1, '#6AAB82']], 'x1="0" y1="0" x2="1" y2="0"') +
      LG('jb', [[0, '#FFFFFF'], [.55, '#FFF7F9'], [1, '#F4B9CD']], 'x1="0" y1="1" x2="0" y2="0"') +
      LG('rg', [[0, '#F8DCCB'], [.5, '#D9A07F'], [1, '#FBE8DC']]) +
      RGb('ct', [[0, '#FFB32E'], [1, '#FFD978', 0]]) +
      '<g id="§fr">' + [0, 72, 144, 216, 288].map(function (r) { return '<path d="' + FP + '" transform="rotate(' + r + ')"/>'; }).join('') + '</g>' +
      '<g id="§fk" fill="none" stroke-width=".32" stroke-linecap="round">' + [0, 72, 144, 216, 288].map(function (r) { return '<path d="M.5-1.6Q1.7-5 1-8.6" transform="rotate(' + r + ')"/>'; }).join('') + '</g>' +
      '<g id="§hi">' + [0, 72, 144, 216, 288].map(function (r) { return '<path d="' + HP + '" transform="rotate(' + r + ')"/>'; }).join('') + '</g>';
    var at = function (a, r) { return PO(78, 78, r, a); };
    var tr = function (p, rot, sc) { return 'translate(' + n2(p[0]) + ' ' + n2(p[1]) + ') rotate(' + n2(rot) + ') scale(' + sc + ')'; };
    var frang = function (a, r, sc, g, edge) {
      var p = at(a, r);
      return '<g transform="' + tr(p, rnd() * 72, sc) + '"><use href="#§fr" fill="url(#§' + g + ')" stroke="' + edge + '" stroke-width=".3" stroke-opacity=".7"/><use href="#§fk" stroke="' + (g === 'fw' ? '#E9B458' : '#E59A6C') + '" stroke-opacity=".5"/><circle r="2.3" fill="url(#§ct)"/></g>';
    };
    var hibiscus = function (a, r, sc) {
      var p = at(a, r), q = PO(0, 0, 9, 20);
      return '<g transform="' + tr(p, rnd() * 72, sc) + '"><use href="#§hi" fill="url(#§hb)" stroke="#D9607A" stroke-width=".3" stroke-opacity=".6"/>' +
        '<path d="M0 0L' + n2(q[0]) + ' ' + n2(q[1]) + '" stroke="#C2185B" stroke-width=".6" stroke-linecap="round"/>' +
        [.55, .7, .85].map(function (t) { return CI(.45, 'fill="#FFD95A"', q[0] * t + .6, q[1] * t); }).join('') + CI(.55, 'fill="#9E0F3E"', q[0], q[1]) + '</g>';
    };
    var leaf = function (a, r, rot, sc) {
      var p = at(a, r);
      return '<g transform="' + tr(p, a + rot, sc) + '"><path d="' + LF + '" fill="url(#§lf)" stroke="#4E8A64" stroke-width=".25" stroke-opacity=".6"/><path d="M0-.6L0-15.6M0-5L1.6-7.4M0-8.6L1.8-11M0-6.4L-1.6-8.8M0-10L-1.7-12.4" fill="none" stroke="#E6F4E4" stroke-width=".28" stroke-opacity=".6"/></g>';
    };
    var buds = function (a, r, n) {
      var p = at(a, r), s = '<g transform="' + tr(p, a, 1) + '">';
      for (var j = 0; j < n; j++) { var ra = (j - (n - 1) / 2) * 26; s += '<g transform="rotate(' + n2(ra) + ')"><path d="' + JB + '" fill="url(#§jb)" stroke="#E7B3C6" stroke-width=".22"/><path d="M-.85.3Q0-1.1.85.3Q0 1-.85.3Z" fill="#7DB48A"/></g>'; }
      return s + '</g>';
    };
    var jstar = function (a, r, sc) {
      var p = at(a, r), s = '<g transform="' + tr(p, rnd() * 72, sc) + '" fill="#FFFFFF" stroke="#EBC9D6" stroke-width=".2">';
      for (var j = 0; j < 5; j++) s += '<path d="M0 0C-.9-1-1-2.8 0-3.8C1-2.8.9-1 0 0Z" transform="rotate(' + (j * 72) + ')"/>';
      return s + CI(.45, 'fill="#F5C96A" stroke="none"', 0, 0) + '</g>';
    };
    // behind the avatar: vine, leaves, two frangipani tucked under the edge
    var back = R1(51.4, 'url(#§rg)', 1.2, .95) + R1(53.4, '#F3D3C3', .4, .55);
    for (i = 0; i < 18; i++) { var la = i * 20 + 6, big = (la > 140 && la < 330); back += leaf(la, 52, (i % 2 ? 1 : -1) * (40 + (i % 3) * 8), big ? 1.42 : 1.2); }
    back += frang(96, 50, 1.05, 'fl', '#C6A6E4') + frang(276, 50.5, 1.1, 'fw', '#EBC98E') + frang(18, 50.5, .9, 'fp', '#E7A2B6') + frang(206, 51, 1, 'fp', '#E7A2B6');
    // in front: accents
    var front = hibiscus(268, 61, 1.05) + hibiscus(146, 60, .9) + hibiscus(66, 58, .78) +
      buds(0, 58.5, 3) + buds(92, 59, 2) + buds(214, 62, 2) + buds(322, 61.5, 3) + buds(126, 60.5, 2) +
      frang(118, 57.5, 1.1, 'fl', '#C6A6E4') + frang(34, 57.5, 1.05, 'fp', '#E7A2B6') + frang(340, 60, .85, 'fw', '#EBC98E') + frang(204, 61, .95, 'fl', '#C6A6E4');
    if (!sm) front += jstar(160, 63, 1) + jstar(290, 64, .9) + jstar(80, 62, .85) + jstar(12, 63, .8) + jstar(236, 64, .9);
    // hero frangipani, each breathing on its own
    var heroes = [[300, 58.5, 1.62, 'fp', '#E7A2B6'], [238, 59, 1.34, 'fw', '#EBC98E'], [176, 58.5, 1.5, 'fw', '#EBC98E']];
    var hl = heroes.map(function (h, j) {
      var p = at(h[0], h[1]);
      return L(sfx(frang(h[0], h[1], h[2], h[3], h[4]), 'h' + j), 'dgc-breathe dgc-shd-soft', org(p[0], p[1]) + ';animation-delay:' + (-j * 2.1) + 's', sfx(d, 'h' + j));
    }).join('');
    var pd = RGb('pp', [[0, '#FFC75A'], [.35, '#FFE9C0'], [1, '#FFFFFF']], 'cx=".58" cy="1" r="1.08"');
    var petal = function (x, y, dx, dy, rt, dur, del) {
      return PT(x, y, 7, '<defs>' + pd + '</defs><path d="' + FP + '" transform="translate(0 5.5) scale(.9)" fill="url(#§pp)" stroke="#EBC98E" stroke-width=".3"/>', 'dgc-petal', 'opacity:0;--dx:' + dx + '%;--dy:' + dy + '%;--rt:' + rt + 'deg;animation-duration:' + dur + 's;animation-delay:' + del + 's');
    };
    var pts = petal(34, 44, -150, 380, -200, 7.5, -1) + petal(40, 118, -90, 330, 160, 8.5, -4.8);
    if (!sm) pts += petal(118, 128, 120, 300, 220, 9, -2.6);
    return L(sfx(back, 'b'), 'dgc-bk dgc-sway dgc-shd-soft', 'animation-duration:7s', sfx(d, 'b')) +
      '<i class="dgc-l dgc-sway" style="animation-duration:7s">' + L(sfx(front, 'f'), 'dgc-shd-soft', '', sfx(d, 'f')) + hl + '</i>' + pts;
  };
  function jagArc(rnd, r, a0, a1, amp, segs) {
    var d = '';
    for (var i = 0; i <= segs; i++) { var t = i / segs, a = a0 + (a1 - a0) * t, rr = r + ((i === 0 || i === segs) ? 0 : (rnd() - .5) * 2 * amp); d += (i ? 'L' : 'M') + pt(rr, a); }
    return d;
  }
  function forkOut(rnd, r, a, len, dir) {
    var d = 'M' + pt(r, a), rr = r, aa = a;
    for (var i = 0; i < 3; i++) { rr += dir * len / 3; aa += (rnd() - .5) * 9; d += 'L' + pt(rr, aa); }
    return d;
  }
  var zap = function (paths, k, glow, core) { return '<g fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="' + paths + '" stroke="' + glow + '" stroke-width="' + n2(3.4 * k) + '" stroke-opacity=".5"/><path d="' + paths + '" stroke="' + core + '" stroke-width="' + n2(1.05 * k) + '"/></g>'; };

  RB.bolt = function (sm) {
    var k = sm ? 1.3 : 1, rnd = RNG(5), i, f;
    var base = R1(54, '#2F6BFF', 10, .26) + R1(54, '#4D8BFF', 4.4, .5) + R1(54, '#EAF3FF', 1.3 * k) + R1(49, '#9CC2FF', .6 * k, .6) + R1(59.5, '#7FAEFF', .45 * k, .4);
    // a faint always-on plasma crackle so the ring never looks idle
    var pl = '';
    for (i = 0; i < 4; i++) pl += jagArc(rnd, 54, i * 90 + 10, i * 90 + 80, 2.2, 12);
    base += '<path d="' + pl + '" fill="none" stroke="#CFE2FF" stroke-width="' + n2(.55 * k) + '" stroke-opacity=".55" stroke-linejoin="round"/>';
    var en = '';
    for (i = 0; i < 3; i++) { var a = i * 120; en += PA(comet(54, a - 75, a, 7 * k), 'fill="#6FA3FF" opacity=".35"') + PA(comet(54, a - 48, a, 3.4 * k), 'fill="#F4F9FF" opacity=".95"') + CI(1.7 * k, 'fill="#FFFFFF"', PO(78, 78, 54, a)[0], PO(78, 78, 54, a)[1]); }
    var out = L(base, 'dgc-shd-blue') + L(en, 'dgc-spin', 'animation-duration:2.2s');
    for (f = 0; f < 3; f++) {
      var p = '';
      for (i = 0; i < 4; i++) {
        var a0 = f * 30 + i * 90 + rnd() * 20, span = 50 + rnd() * 26;
        p += jagArc(rnd, 54, a0, a0 + span, 4.2, Math.round(span / 5.5));
        p += forkOut(rnd, 54 + (rnd() - .5) * 3, a0 + span * (.25 + rnd() * .5), 9 + rnd() * 6, 1);
        if (!sm && rnd() > .35) p += forkOut(rnd, 54, a0 + span * .7, 5, -1);
      }
      out += L(zap(p, k, '#3F7CFF', '#F6FAFF'), 'dgc-flk dgc-flk' + f);
    }
    var sp = '';
    for (i = 0; i < (sm ? 6 : 10); i++) { var q = PO(78, 78, 56 + rnd() * 12, rnd() * 360); sp += CI(.6 + rnd() * .7, 'fill="#DDEBFF"', q[0], q[1]); }
    return out + L(sp, 'dgc-tw', 'animation-duration:.9s');
  };

  // a flame tongue rooted on the ring at angle a; it bends upward (real fire rises), taller on top
  function tongue(a, h, hw, curl, r0, up) {
    var xy = function (p) { return n2(p[0]) + ' ' + n2(p[1]); };
    var BL = PO(78, 78, r0, a - hw), BR = PO(78, 78, r0, a + hw), M = PO(78, 78, r0, a);
    h *= .74 + .36 * (1 + Math.cos(a * D2R)) / 2;
    var dx = Math.sin(a * D2R), dy = -Math.cos(a * D2R) - up, l = Math.hypot(dx, dy); dx /= l; dy /= l;
    var T = [M[0] + dx * h + curl * dy, M[1] + dy * h - curl * dx];
    var px = BR[0] - BL[0], py = BR[1] - BL[1], w = Math.hypot(px, py) / 2; px /= 2 * w; py /= 2 * w;
    var c1 = [BL[0] + dx * h * .42 - px * w * .3, BL[1] + dy * h * .42 - py * w * .3];
    var c2 = [T[0] - dx * h * .4 - px * w * .45, T[1] - dy * h * .4 - py * w * .45];
    var c3 = [T[0] - dx * h * .32 + px * w * .75, T[1] - dy * h * .32 + py * w * .75];
    var c4 = [BR[0] + dx * h * .3 + px * w * .3, BR[1] + dy * h * .3 + py * w * .3];
    return 'M' + xy(BL) + 'C' + xy(c1) + ' ' + xy(c2) + ' ' + xy(T) + 'C' + xy(c3) + ' ' + xy(c4) + ' ' + xy(BR) + 'Z';
  }
  RB.fire = function (sm) {
    var rnd = RNG(9), i, a;
    var gB = RG('fb', 76, [[.6, '#FFD166'], [.7, '#FF8A1F'], [.82, '#EE3F0E'], [.92, '#B3140A', .8], [1, '#7A0A05', 0]]);
    var gM = RG('fm', 76, [[.61, '#FFF6C8'], [.7, '#FFD04A'], [.79, '#FF9A2A'], [.86, '#FF5A14', .75], [.92, '#E0300C', 0]]);
    var gC = RG('fc', 76, [[.61, '#FFFFFF'], [.66, '#FFF4B8'], [.71, '#FFD85A'], [.76, '#FFB02E', .55], [.8, '#FF8A1F', 0]]);
    var heat = RG('ht', 76, [[.6, '#FF7A1A', 0], [.64, '#FF7A1A', .6], [.78, '#FF4A0A', .22], [1, '#FF4A0A', 0]]);
    var back = ['', ''], mid = ['', ''], core = '';
    for (i = 0; i < 18; i++) { a = i * 20 + rnd() * 6; back[i % 2] += PA(tongue(a, 15 + rnd() * 14, 8, (rnd() - .5) * 10, 46.5, .6), 'fill="url(#§fb)"'); }
    for (i = 0; i < 16; i++) { a = i * 22.5 + 11 + rnd() * 5; mid[i % 2] += PA(tongue(a, 10 + rnd() * 9, 6.8, (rnd() - .5) * 7, 47, .45), 'fill="url(#§fm)"'); }
    for (i = 0; i < 24; i++) { a = i * 15 + 4; core += PA(tongue(a, 6 + rnd() * 4, 5.2, (rnd() - .5) * 3, 47.6, .3), 'fill="url(#§fc)"'); }
    core = R1(50, '#FF7A1A', 6, .5) + R1(49.6, '#FFB547', 3.6, .95) + core + R1(49.2, '#FFE08A', 1.6) + R1(48.3, '#FFF8E0', .7, .95);
    var out = L(CI(76, 'fill="url(#§ht)"'), 'dgc-bk dgc-heat', '', heat) +
      L(back[0], 'dgc-fire', 'animation-duration:.62s', gB) + L(sfx(back[1], 'q'), 'dgc-fire', 'animation-duration:.74s;animation-delay:-.37s', sfx(gB, 'q')) +
      L(mid[0], 'dgc-fire', 'animation-duration:.5s;animation-delay:-.2s', gM) + L(sfx(mid[1], 'q'), 'dgc-fire', 'animation-duration:.58s;animation-delay:-.45s', sfx(gM, 'q')) +
      L(core, 'dgc-fire dgc-fire-c', 'animation-duration:.44s', gC);
    var eg = RGb('eg', [[0, '#FFF3C0'], [.35, '#FFB547', .9], [1, '#FF5A14', 0]]);
    var n = sm ? 4 : 6;
    for (i = 0; i < n; i++) {
      a = i * (360 / n) + 25 + rnd() * 20; var p = PO(78, 78, 63, a), dx = Math.sin(a * D2R), dy = -Math.cos(a * D2R);
      out += PT(p[0], p[1], 5, '<defs>' + eg + '</defs><circle r="8" fill="url(#§eg)"/><circle r="2" fill="#FFF8E0"/>', 'dgc-ember',
        '--dx:' + n2(dx * 300 + (dy * 60)) + '%;--dy:' + n2(dy * 300 - 90) + '%;animation-duration:' + n2(1.6 + rnd() * .9) + 's;animation-delay:' + n2(-rnd() * 2.4) + 's');
    }
    return out;
  };

  RB.orbit = function (sm) {
    var k = sm ? 1.25 : 1, rnd = RNG(33), i, p;
    var base = R1(50, '#8FC0FF', 3.4, .28) + R1(49, '#E3F0FF', .8 * k, .85) +
      CI(64, 'fill="none" stroke="#CFE3FF" stroke-width="' + n2(.6 * k) + '" stroke-dasharray="1.2 3.2" opacity=".55"') + CI(71, 'fill="none" stroke="#CFE3FF" stroke-width="' + n2(.45 * k) + '" stroke-dasharray=".8 5" opacity=".35"');
    var mp = PO(78, 78, 64, 90), mx = mp[0], my = mp[1];
    var md = RGb('mn', [[0, '#FFFFFF'], [.35, '#EDE9E0'], [.78, '#ABA496'], [1, '#6B665D']], 'cx=".3" cy=".45" r=".75" fx=".22" fy=".42"') + RGb('mg', [[0, '#EAF3FF', .55], [1, '#9CC6FF', 0]]);
    var moon = PA(comet(64, 18, 84, 3.6 * k), 'fill="#CFE3FF" opacity=".16"') + PA(comet(64, 52, 84, 2.4 * k), 'fill="#E3F0FF" opacity=".3"') +
      CI(13, 'fill="url(#§mg)"', mx, my) + CI(7.6, 'fill="url(#§mn)"', mx, my) +
      CI(1.6, 'fill="#9C9589" opacity=".6"', mx - 1.2, my - 2.4) + CI(1.1, 'fill="#9C9589" opacity=".55"', mx + 2.3, my + 1.8) + CI(.8, 'fill="#9C9589" opacity=".55"', mx - .6, my + 3.4) + CI(.6, 'fill="#9C9589" opacity=".5"', mx + 3.6, my - 2.6) +
      '<path d="M' + n2(mx) + ' ' + n2(my - 7.6) + 'A7.6 7.6 0 0 1 ' + n2(mx) + ' ' + n2(my + 7.6) + 'A4.2 7.6 0 0 0 ' + n2(mx) + ' ' + n2(my - 7.6) + 'Z" fill="#23222A" opacity=".5"/>';
    var rk = RGb('rk', [[0, '#D8CCBC'], [.6, '#8E8174'], [1, '#4F463F']], 'cx=".35" cy=".35" r=".8"');
    var rocks = '';
    [[71, 20, 1.9], [72.5, 150, 1.4], [69.5, 255, 1.7]].forEach(function (r, j) {
      var c = PO(78, 78, r[0], r[1]), pp = [];
      for (var m = 0; m < 7; m++) { var rr = r[2] * (.75 + RNG(j * 7 + m)() * .45); pp.push(n2(c[0] + rr * Math.cos(m / 7 * 6.283)) + ',' + n2(c[1] + rr * Math.sin(m / 7 * 6.283))); }
      rocks += '<polygon points="' + pp.join(' ') + '" fill="url(#§rk)" stroke="#3E3731" stroke-width=".35"/>';
    });
    var tw1 = '', tw2 = '';
    for (i = 0; i < (sm ? 10 : 16); i++) { p = PO(78, 78, 50 + rnd() * 26, rnd() * 360); var st = (rnd() > .75) ? star4(p[0], p[1], 1.8, '#FFFFFF') : CI(.45 + rnd() * .5, 'fill="#FFFFFF"', p[0], p[1]); if (i % 2) tw1 += st; else tw2 += st; }
    var mt = LG('mt', [[0, '#FFFFFF', 0], [.7, '#FFD9A0', .55], [1, '#FFFFFF', .95]], 'x1="38" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse"');
    var meteor = '<defs>' + mt + RGb('mh', [[0, '#FFF3DC', .9], [1, '#FFB060', 0]]) + '</defs><path d="M20.8 19.2L38.5 1.5L19.2 20.8Z" fill="url(#§mt)"/><circle cx="20" cy="20" r="3.6" fill="url(#§mh)"/><circle cx="20" cy="20" r="1.25" fill="#FFFFFF"/>';
    var out = L(base, 'dgc-shd-sky') + L(tw1, 'dgc-tw', 'animation-duration:1.5s') + L(tw2, 'dgc-tw', 'animation-duration:1.5s;animation-delay:-.75s') +
      L(rocks, 'dgc-spin dgc-rev', 'animation-duration:26s', rk) + L(moon, 'dgc-spin', 'animation-duration:7.5s', md);
    out += PT(30, 30, 34, meteor, 'dgc-meteor', 'animation-duration:3.6s;animation-delay:-.4s', '0 0 40 40');
    if (!sm) out += PT(126, 122, 30, meteor, 'dgc-meteor', 'animation-duration:5.2s;animation-delay:-2.9s', '0 0 40 40');
    return out;
  };

  /* Event Horizon - faithful port of the original Digu ring (RINGFX.blackhole): black event-horizon band,
     a tilted accretion disk masked to outside the avatar, a pale photon ring, two dashed orange swirl
     rings spinning (4s) and ten embers falling inward on a slowly turning (6s) wheel.
     Polish only: every moving part is its own compositor layer (the embers are tiny HTML elements
     instead of repainting SVG), unique mask/gradient ids per instance, glow sized to the avatar. */
  RB.horizon = function (sm) {
    var d = '<mask id="§bhm"><rect width="156" height="156" fill="#fff"/><circle cx="78" cy="78" r="51" fill="#000"/></mask>' +
      LG('bhd', [[0, '#FF7A1A', .15], [.3, '#FFB347'], [.5, '#FFF4DA'], [.7, '#FFB347'], [1, '#FF7A1A', .15]], 'x1="0" y1="0" x2="1" y2="0"');
    var base = '<circle cx="78" cy="78" r="57" fill="none" stroke="#000" stroke-width="12" opacity=".85"/>' +
      '<g mask="url(#§bhm)"><g transform="rotate(-16 78 78)"><ellipse cx="78" cy="78" rx="76" ry="17" fill="none" stroke="url(#§bhd)" stroke-width="5"/>' +
      '<ellipse cx="78" cy="78" rx="70" ry="13" fill="none" stroke="#FFD89B" stroke-width="1" opacity=".7"/></g></g>' +
      '<circle cx="78" cy="78" r="52.5" fill="none" stroke="#FFF6E6" stroke-width="1.3"/>';
    var swirl = '<circle cx="78" cy="78" r="60" fill="none" stroke="#FF9E3D" stroke-width="3.5" stroke-dasharray="60 18 30 26 90 20" stroke-linecap="round" opacity=".9"/>' +
      '<circle cx="78" cy="78" r="63" fill="none" stroke="#FFD89B" stroke-width="1.2" stroke-dasharray="20 30 70 40" stroke-linecap="round" opacity=".7"/>';
    // embers: [angle (deg, clockwise from +x as in the original rotate()), radius, delay s]
    var EM = [[-1, 1, 1.12], [42, 1.3, .02], [78, 1.3, .24], [110, 1.2, .12], [147, 1.4, 1.36], [175, 1, .71], [216, 1.3, 2.77], [256, 1.4, 1.15], [282, 1.4, .87], [328, 1, 1.27]];
    var SZ = 3, U = 100 / (SZ * 1.56);   // element size in % of the ring box; 1 SVG unit in % of the element
    var em = EM.map(function (e) {
      var c = Math.cos(e[0] * D2R), s = Math.sin(e[0] * D2R), x = 78 + 57 * c, y = 78 + 57 * s;
      return PT(x, y, SZ, CI(e[1], 'fill="#FFE2B0"', 0, 0), 'dgc-fall',
        '--x0:' + n2(c * 16 * U) + '%;--y0:' + n2(s * 16 * U) + '%;--x1:' + n2(-c * 4 * U) + '%;--y1:' + n2(-s * 4 * U) + '%;animation-delay:' + e[2] + 's', n2(-SZ * .78) + ' ' + n2(-SZ * .78) + ' ' + n2(SZ * 1.56) + ' ' + n2(SZ * 1.56));
    }).join('');
    var sh = sm ? ' dgc-shd-bh3' : ' dgc-shd-bh4';
    return L(base, sh.trim(), '', d) + L(swirl, 'dgc-spin' + sh, 'animation-duration:4s') +
      '<i class="dgc-l dgc-spin' + sh + '" style="animation-duration:6s">' + em + '</i>';
  };

  var ALIAS = { blackhole: 'horizon' };
  var RINGS = ['classic', 'shine', 'bloom', 'bolt', 'fire', 'orbit', 'horizon'];
  var key = function (id) { id = String(id || '').replace(/^f-/, ''); return ALIAS[id] || id; };
  var TPL = {};
  function ring(id, opts) {
    opts = opts || {};
    var kk = key(id); if (!RB[kk]) return '';
    injectCSS();
    var sm = (opts.size || 46) <= 56, ck = kk + (sm ? ':s' : ':l');
    var tpl = TPL[ck] || (TPL[ck] = '<span class="dgc-ring dgc-r-' + kk + '§STILL" aria-hidden="true">' + RB[kk](sm) + '</span>');
    return tpl.replace('§STILL', opts.still ? ' dgc-still' : '').replace(/§/g, nid());
  }

  /* ------------------------------------------------------------------ backs */
  var BV = 'viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" focusable="false"';
  var BL = function (inner, cls, style, defs) { return '<i class="dgc-bl' + (cls ? ' ' + cls : '') + '"' + (style ? ' style="' + style + '"' : '') + '><svg ' + BV + '>' + (defs ? '<defs>' + defs + '</defs>' : '') + inner + '</svg></i>'; };
  var BSVG = function (inner, defs) { return '<svg class="dgc-bsvg" ' + BV + '>' + (defs ? '<defs>' + defs + '</defs>' : '') + inner + '</svg>'; };
  var gold = LG('gd', [[0, '#FBEBB8'], [.3, '#C9A04A'], [.52, '#FFF4D0'], [.75, '#A8802F'], [1, '#EBCB7A']]);
  var frame = function (w, inner) {
    return '<rect x="4" y="4" width="92" height="132" rx="6.2" fill="none" stroke="url(#§gd)" stroke-width="' + n2(w) + '"/>' +
      '<rect x="5.9" y="5.9" width="88.2" height="128.2" rx="4.6" fill="none" stroke="url(#§gd)" stroke-width="' + n2(w * .42) + '" opacity=".75"/>' +
      [[50, 4], [50, 136]].map(function (c) { return '<path d="M' + (c[0] - 3.2) + ' ' + c[1] + 'L' + c[0] + ' ' + (c[1] - 1.6) + 'L' + (c[0] + 3.2) + ' ' + c[1] + 'L' + c[0] + ' ' + (c[1] + 1.6) + 'Z" fill="url(#§gd)" stroke="#0B1A33" stroke-width=".3"/>'; }).join('') +
      (inner || '');
  };

  /* ---- shared deep-ocean scene for the Whale Shark and Sea Turtle backs ---- */
  var wave = function (x0, x1, y, amp, wl) { var d = 'M' + n2(x0) + ' ' + n2(y) + 'Q' + n2(x0 + wl / 4) + ' ' + n2(y - amp) + ' ' + n2(x0 + wl / 2) + ' ' + n2(y); for (var x = x0 + wl; x <= x1 + .01; x += wl / 2) d += 'T' + n2(x) + ' ' + n2(y); return d; };
  var P2 = function (s) { return s.split(' ').map(function (q) { return q.split(',').map(Number); }); };
  var frameOcean = function (w, metal, rim) {
    return '<rect x="4" y="4" width="92" height="132" rx="6.2" fill="none" stroke="' + rim + '" stroke-width="' + n2(w * 2.2) + '" stroke-opacity=".35"/>' +
      '<rect x="4" y="4" width="92" height="132" rx="6.2" fill="none" stroke="url(#§' + metal + ')" stroke-width="' + n2(w) + '"/>' +
      '<rect x="6" y="6" width="88" height="128" rx="4.6" fill="none" stroke="#F4F8FC" stroke-width="' + n2(w * .38) + '" stroke-opacity=".6"/>' +
      [[50, 4], [50, 136]].map(function (c) { return '<path d="M' + (c[0] - 3.2) + ' ' + c[1] + 'L' + c[0] + ' ' + (c[1] - 1.6) + 'L' + (c[0] + 3.2) + ' ' + c[1] + 'L' + c[0] + ' ' + (c[1] + 1.6) + 'Z" fill="url(#§' + metal + ')" stroke="' + rim + '" stroke-width=".3"/>'; }).join('') +
      [[8.6, 8.6], [91.4, 8.6], [8.6, 131.4], [91.4, 131.4]].map(function (c) { return CI(1.05, 'fill="url(#§pl)"', c[0], c[1]); }).join('');
  };
  var FISH = 'M-2.6 0C-1.6-1.3 1.2-1.6 2.6-.2C2.9 0 2.9.2 2.6.3C1.2 1.6-1.6 1.4-2.6 0ZM-2.3 0L-4.1-1.4L-3.6 0L-4.1 1.4Z';
  // theme 'night' (whale shark): midnight open ocean, moonlight, bioluminescent plankton, silver frame
  // theme 'day'   (sea turtle):  bright turquoise reef, sun caustics, sandy coral floor, gold frame
  function oceanParts(sm, o) {
    var rnd = RNG(o.seed), i, night = o.theme === 'night';
    var defs = RGb('pl', [[0, '#FFFFFF'], [.5, '#EAF2F7'], [1, '#AFC4D2']], 'cx=".35" cy=".35" r=".75"') + gold +
      LG('sv', [[0, '#FFFFFF'], [.28, '#A9B4C6'], [.5, '#F5F8FC'], [.74, '#7F8BA2'], [1, '#E4E9F1']]);
    var bg, rays, plk = '', reef = '', frameTop;
    if (night) {
      defs += LG('bg', [[0, '#1C2868'], [.3, '#111A4B'], [.66, '#080E2C'], [1, '#02040F']], 'x1="0" y1="0" x2="0" y2="1"') +
        RGb('tl', [[0, '#C3D0FF', .42], [.45, '#6F83D6', .14], [1, '#6F83D6', 0]], 'cx=".62" cy="-.04" r=".78"') +
        RGb('lp', [[0, '#2B3C94', .22], [1, '#2B3C94', 0]]) +
        RGb('vg', [[.55, '#010208', 0], [1, '#010208', .78]], 'cx=".5" cy=".44" r=".8"') +
        LG('ry', [[0, '#E2E9FF', .22], [.6, '#E2E9FF', .05], [1, '#E2E9FF', 0]], 'x1="0" y1="0" x2="0" y2="1"') +
        RGb('pk', [[0, '#DFFFFF', .95], [.3, '#4FE6F0', .5], [1, '#1FA6C8', 0]]);
      bg = '<rect width="100" height="140" fill="url(#§bg)"/><rect width="100" height="140" fill="url(#§tl)"/><ellipse cx="50" cy="72" rx="44" ry="52" fill="url(#§lp)"/>' +
        '<g fill="none" stroke="#CFD9FF" stroke-width=".3" opacity=".08">';
      for (i = 0; i < 4; i++) bg += '<path d="' + wave(-4 + i * 3, 104, 8 + i * 4, 1.2, 11 + i * 1.6) + '"/>';
      bg += '</g>';
      rays = '<g fill="url(#§ry)">' + [[52, 57, 30, 44], [63, 66, 52, 62], [72, 74, 70, 78], [42, 45, 14, 24]].map(function (r) { return '<polygon points="' + r[0] + ',-2 ' + r[1] + ',-2 ' + r[3] + ',126 ' + r[2] + ',126"/>'; }).join('') + '</g>';
      // bioluminescent plankton (static part lives in bg, the drifting part in plk)
      for (i = 0; i < (sm ? 26 : 54); i++) {
        var x = 6 + rnd() * 88, y = 8 + rnd() * 124, r = (sm ? .32 : .2) + rnd() * (sm ? .3 : .36), glow = rnd() > .55, s = (glow ? CI(r * 4.2, 'fill="url(#§pk)" opacity="' + n2(.45 + rnd() * .4) + '"', x, y) : '') + CI(r, 'fill="#B8FDFF" opacity="' + n2(.55 + rnd() * .45) + '"', x, y);
        if (i % 3 === 0) plk += s; else bg += s;
      }
      frameTop = '<rect width="100" height="140" fill="url(#§vg)"/>' + frameOcean(sm ? 1.1 : .85, 'sv', '#02040F');
    } else {
      defs += LG('bg', [[0, '#A8F4F4'], [.26, '#4AD4E0'], [.6, '#1AB0C8'], [1, '#0E8BA8']], 'x1="0" y1="0" x2="0" y2="1"') +
        RGb('tl', [[0, '#FFFFFF', .8], [.4, '#E9FFFB', .28], [1, '#E9FFFB', 0]], 'cx=".42" cy="-.05" r=".8"') +
        RGb('vg', [[.6, '#05506A', 0], [1, '#05506A', .42]], 'cx=".5" cy=".44" r=".8"') +
        LG('ry', [[0, '#FFFFFF', .5], [.6, '#FFFFFF', .12], [1, '#FFFFFF', 0]], 'x1="0" y1="0" x2="0" y2="1"') +
        LG('sd', [[0, '#F8E9BE'], [1, '#D9B97C']], 'x1="0" y1="0" x2="0" y2="1"') +
        RGb('bc', [[0, '#FFD89A'], [1, '#E0923E']], 'cx=".4" cy=".35" r=".7"');
      bg = '<rect width="100" height="140" fill="url(#§bg)"/><rect width="100" height="140" fill="url(#§tl)"/>';
      // sunlight caustics: two crossing families of wavy light lines
      bg += '<g fill="none" stroke="#FFFFFF" stroke-width="' + (sm ? .6 : .42) + '" stroke-linecap="round">';
      for (i = 0; i < 11; i++) bg += '<path d="' + wave(-20, 120, 4 + i * 11, 2.2, 9 + (i % 3) * 2) + '" opacity="' + n2(.34 - i * .02) + '" transform="rotate(9 50 ' + (4 + i * 11) + ')"/>';
      for (i = 0; i < 11; i++) bg += '<path d="' + wave(-20, 120, 9 + i * 11, 1.8, 12 + (i % 2) * 3) + '" opacity="' + n2(.26 - i * .015) + '" transform="rotate(-13 50 ' + (9 + i * 11) + ')"/>';
      bg += '</g>';
      if (!sm) for (i = 0; i < 18; i++) bg += CI(.2 + rnd() * .3, 'fill="#FFFFFF" opacity="' + n2(.3 + rnd() * .4) + '"', 6 + rnd() * 88, 8 + rnd() * 100);
      rays = '<g fill="url(#§ry)">' + [[12, 20, -6, 14], [28, 36, 8, 32], [44, 50, 32, 50], [58, 65, 56, 78], [74, 80, 82, 100]].map(function (r) { return '<polygon points="' + r[0] + ',-2 ' + r[1] + ',-2 ' + r[3] + ',124 ' + r[2] + ',124"/>'; }).join('') + '</g>';
      // sandy floor with ripples and dappled light, then colourful coral
      reef = '<path d="M0 121C12 118.6 24 120.8 38 119.8C54 118.8 68 121.4 82 119.6C90 118.8 96 119.8 100 119.4V140H0Z" fill="url(#§sd)"/>' +
        '<g fill="none" stroke="#C49B5C" stroke-width=".35" opacity=".55">' + [124, 128.5, 133].map(function (y) { return '<path d="' + wave(2, 98, y, .8, 7) + '"/>'; }).join('') + '</g>' +
        [[20, 126, 5, 1.2], [46, 130, 6, 1.4], [72, 125.5, 4.5, 1.1], [88, 132, 4, 1]].map(function (e) { return '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] + '" ry="' + e[3] + '" fill="#FFFFFF" opacity=".35"/>'; }).join('');
      var branch = function (x, y, s, col, tip) {
        var br = 'M0 0C-.4-3-.2-5 .3-7M.2-3.2C-1.8-4.4-3.2-6-3.6-8.6M.1-4.6C2-6 3-7.8 3.3-10M-1.8-5.2C-2.6-6.6-2.4-8.4-1.4-10M1.9-6.6C1.4-8.4 1.8-9.6 2.6-11.2M-3.6-8.6L-5-10M3.3-10L4.6-11.4';
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="none" stroke-linecap="round"><path d="' + br + '" stroke="' + col + '" stroke-width="1.7"/><path d="' + br + '" stroke="' + tip + '" stroke-width=".5" stroke-opacity=".7"/></g>';
      };
      var fanC = function (x, y, s) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0 0C-5-1-8-6-7-11C-3-13 3-13 7-11C8-6 5-1 0 0Z" fill="#FF9254" opacity=".95"/><path d="M0 0L-5-10M0 0L0-12M0 0L5-10M0 0L-2.6-11.4M0 0L2.6-11.4" stroke="#FFD2A8" stroke-width=".35" opacity=".8"/></g>'; };
      var tube = function (x, y, h) { return '<rect x="' + (x - 1.1) + '" y="' + (y - h) + '" width="2.2" height="' + h + '" rx="1.1" fill="#B48BE4"/><ellipse cx="' + x + '" cy="' + (y - h) + '" rx="1.1" ry=".5" fill="#5E3D8F"/>'; };
      var grass = function (x, h, lean) { return '<path d="M' + n2(x - .8) + ' 124Q' + n2(x - .8 + lean * .4) + ' ' + n2(124 - h * .55) + ' ' + n2(x + lean) + ' ' + n2(124 - h) + 'Q' + n2(x + .3 + lean * .45) + ' ' + n2(124 - h * .5) + ' ' + n2(x + .8) + ' 124Z" fill="#35B884"/>'; };
      o.grass.forEach(function (g) { reef += grass(g[0], g[1], g[2]); });
      reef += branch(16, 126, 1.15, '#FF6F8E', '#FFC2CE') + fanC(30, 124, .9) + tube(40, 125, 5) + tube(42.6, 125.5, 3.6) +
        branch(84, 125, .95, '#FF6F8E', '#FFC2CE') + fanC(70, 125.5, .75) + tube(92, 126, 4.4) +
        '<ellipse cx="58" cy="126" rx="4" ry="2.5" fill="url(#§bc)"/><path d="M55 126q1.5-1.2 3 0t3 0" fill="none" stroke="#B86A2A" stroke-width=".3" opacity=".7"/>' +
        '<ellipse cx="7" cy="128" rx="3" ry="1.9" fill="url(#§bc)"/>';
      frameTop = '<rect width="100" height="140" fill="url(#§vg)"/>' + frameOcean(sm ? 1.1 : .85, 'gd', '#063C50');
    }
    var bub = function (x, y, r) { return CI(r, 'fill="#FFFFFF" fill-opacity=".12" stroke="#FFFFFF" stroke-width="' + n2(sm ? .35 : .25) + '" stroke-opacity=".85"', x, y) + CI(r * .3, 'fill="#FFFFFF" opacity=".9"', x - r * .35, y - r * .35); };
    var bubbles = (o.bubbles || []).map(function (b) { return bub(b[0], b[1], b[2] * (sm ? 1.2 : 1)); }).join('');
    var fish = (o.fish || []).map(function (f) { return '<path d="' + FISH + '" transform="translate(' + f[0] + ' ' + f[1] + ') rotate(' + f[2] + ') scale(' + (f[3] * (sm ? 1.15 : 1)) + ')" fill="' + (f[5] || '#CFE6F5') + '" opacity="' + (f[4] || .6) + '"/>'; }).join('');
    return { defs: defs, bg: bg, rays: rays, plk: plk, bubbles: bubbles, fish: fish, reef: reef, top: frameTop };
  }
  function oceanBack(cls, p, fg, opts) {
    var html;
    if (opts.animate) {
      html = '<span class="dgc-bkw ' + cls + '§STILL" aria-hidden="true">' + BL(sfx(p.bg, 'a'), '', '', sfx(p.defs, 'a')) + BL(sfx(p.rays, 'b'), 'dgc-wray', '', sfx(p.defs, 'b')) +
        (p.plk ? BL(sfx(p.plk, 'p'), 'dgc-plk', '', sfx(p.defs, 'p')) : '') +
        BL(sfx(p.reef + p.fish + fg, 'c'), '', '', sfx(p.defs, 'c')) +
        (p.bubbles ? BL(sfx(p.bubbles, 'd'), 'dgc-bub', '', sfx(p.defs, 'd')) + BL(sfx(p.bubbles, 'e'), 'dgc-bub', 'animation-delay:-3.5s;transform:translateY(-12%)', sfx(p.defs, 'e')) : '') +
        BL(p.top, '', '', p.defs) + '</span>';
    } else {
      html = '<span class="dgc-bkw ' + cls + '§STILL" aria-hidden="true">' + BSVG(p.bg + p.rays + p.plk + p.reef + p.fish + fg + p.bubbles + p.top, p.defs) + '</span>';
    }
    return html.replace('§STILL', opts.still ? ' dgc-still' : '').replace(/§/g, nid());
  }

  /* Whale Shark - outline, fins, spots and waves traced from extras/logos/whale-shark-back.png
     (PNG 330x562 mapped uniformly: x' = (x-165)*0.2491+50, y' = y*0.2491) */
  var WHALE = {
    main: '48.7,28.7 50.7,28.6 54.9,29.2 58.3,30.2 60.5,31.5 62.1,33.1 62.8,34.4 63.4,35.8 63.9,38 64.2,41.6 64.5,42.6 64.5,44.8 63.9,50 63.5,51.8 63.4,53.2 63,54.3 62.8,56.3 63.1,56.8 64.8,58.5 66,60 68.4,63.4 69.6,65.8 70.2,67.3 70.5,69.3 70.5,70.2 70.1,71.1 69.7,71.3 68.5,70.6 66.3,68.8 64.5,67.6 62.4,66.5 60.2,65.9 59.7,65.9 59.2,66.1 58.7,66.7 58.1,67.8 56.6,72 54.7,76.6 54.1,78.3 53,83.2 53,85.4 52.8,86.7 53,88 53,89.7 53.5,91 53.6,92.6 54.2,94.3 56.3,98.5 57.7,100.5 58.5,101.3 60.4,102.6 61,102.8 64.2,102.8 65.7,102.4 71.1,102.4 73.2,103 74.5,103.7 74.8,104 74.8,104.4 74.2,105 73,105.3 71.8,105.8 68.3,107.6 65.7,109.3 65,110 64.6,110.7 64,112.6 63.9,113.8 63.5,115.3 63.5,116.8 63,118.6 62.8,120.3 62.4,121.1 62,121.3 61.5,120.9 60.6,119.8 59.8,118.2 59,116.2 58,111.8 57.9,110.4 57.3,107 56.2,105.5 54.1,103.9 51.8,101.7 50.1,99.9 48.6,97.9 46.4,94.4 44.1,89.5 43.1,86.3 41.8,80.4 41.7,79 41.3,76.7 41.2,75 40.8,72.5 40.7,70.8 40.3,68.7 40.2,67.3 39.8,65.9 39.2,65.5 38.5,65.3 35.9,65.9 33.2,67 29.5,69.2 29,69 28.6,68.4 28.6,67.7 29.6,65.2 30.9,62.9 32.5,60.5 33.4,59.3 35.5,57.2 36.5,56.4 37.9,55 38,54.3 38,45.4 38.5,42.9 38.5,41.7 39,40.6 39,39.5 39.6,37.1 40.9,33.8 42,32 43.7,30.4 46,29.3',
    fin: '62.2,57 62.7,56.9 63.3,57.1 65.3,59.3 67.6,62.5 69.1,65 70.1,67.8 70.1,70.3 69.9,70.8 69.4,71.1 68.2,70.3 65.9,68.4 64.1,67.2 61.5,65.9 60,65.7 59.5,65.4 59.4,64.6 61.1,60.8',
    waves: ['58.5,91.4 59.5,91.3 60.5,91 62.7,89.6 66.9,86.2 69.2,85 70.7,84.5 73.2,84.2 76.2,84.6 78.4,85.6 80.4,86.9 81.1,87.2', '18.4,89.3 19.1,89 21.4,87.7 23.6,86.8 24.6,86.6 26.1,86.5 29.3,86.7 30.8,87.2 33.8,88.8 38.8,92.9 40.3,93.8 41,94.1 41.5,94.1', '58.5,96.8 59.5,96.7 62,95.8 64.7,94.1 68.7,91.2 69.9,90.5 72.2,89.7 73.9,89.6 75.2,89.7 77.7,90.5 79.2,91.3 79.9,91.6', '18.6,95.5 19.4,95.2 21.6,93.8 23.6,93 26.3,92.5 27.3,92.5 29.6,92.9 30.6,93.2 33.1,94.7 38,98.6 39.8,99.8 43.8,101.1 46,101.2', '66.2,98.7 67.4,98.2 70.7,96.5 72.9,95.8 74.7,95.8', '18.9,102.6 19.6,102.3 21.9,101.1 23.6,100.7 25.6,100.5 27.6,100.7 28.8,100.9 30.3,101.5 32.6,103 34.1,104.3 36.8,107.1 39.3,109.4 41.3,110.8 42.5,111.5 45,112.3 46.8,112.5 49,112.4 50.8,111.9 51.3,111.8', '37.8,102.6 38.5,102.9 39.8,104 41.3,105 43.8,106.5 46.5,107.3 48,107.4', '20.6,108.5 23.4,107.4 25.3,107 26.3,107.1 28.8,107.6 30.3,108.3 32.6,109.8 37.3,114 39.3,115.4 41.3,116.4 42.5,116.8 45.3,117'],
    spots: '48.6,80.2,1.25,.55 49.6,63.1,1.07,.66 48.8,71.3,1.01,.58 49.1,67.4,1,.64 58,31.8,.99,.55 49.8,58.8,.93,.68 50.3,54.6,.9,.73 42.5,34,.88,.51 50.7,50.4,.81,.7 54.4,56.3,.78,.72 52.1,30.6,.76,.51 45.7,55.6,.76,.64 53.2,65,.76,.66 48.2,74.7,.76,.63 48.8,87.3,.76,.65 46.3,51.2,.74,.69 55,51.8,.74,.7 53.8,60.6,.73,.67 67.9,68.4,.73,.5 43.5,63.9,.69,.66 51.9,72.7,.69,.7 45.5,59.9,.67,.65 45.4,72.2,.67,.65 52.3,93.4,.67,.53 40.6,54,.66,.47 43.4,60,.66,.63 45.6,63.9,.66,.69 42,43.5,.64,.53 53.7,44.9,.64,.69 58,53.1,.64,.67 43.2,56.2,.64,.59 51.1,80.5,.64,.61 56.3,103.6,.64,.48 61.2,34.6,.63,.51 51,46.7,.63,.69 43.2,52.8,.63,.59 45.6,68.1,.63,.69 45.5,76.5,.63,.67 49.6,90.5,.63,.65 45.6,31,.61,.57 52.4,68.8,.61,.73 49,84.1,.61,.58 50.6,93.5,.61,.63 52.2,36.4,.6,.7 41,38.1,.6,.5 60.6,40.8,.6,.53 41.4,50.6,.6,.58 55.4,65.5,.6,.47 62.4,64.8,.6,.48 51.3,76.8,.6,.7 45.6,80.3,.6,.67 48.8,36.3,.58,.66 51,44.2,.58,.68 53.7,47.4,.58,.67 56,48.4,.58,.69 62.3,37.7,.56,.45 49.2,40.2,.56,.63 53.5,42.5,.56,.57 60.9,43.7,.56,.52 48.9,44.4,.56,.64 57.4,57.1,.56,.59 49,75.8,.56,.49 43.8,81.5,.56,.6 47.9,84,.56,.63 51,83.9,.56,.64 45.9,84.2,.56,.58 46.6,87.8,.56,.68 47.1,91.4,.56,.57 46,38.2,.54,.63 45.8,47.6,.54,.67 43.5,49.8,.54,.68 67.5,64.9,.54,.64 57.6,65.8,.54,.49 50.9,87.2,.54,.6 53.2,96.3,.54,.49 59.5,103.6,.54,.52 52.6,34,.53,.55 59.6,38.1,.53,.62 54.5,38.7,.53,.66 62.2,42.2,.53,.42 48.2,46.8,.53,.62 58.4,49.4,.53,.65 43.6,73.1,.53,.59 44,76.8,.53,.67 52.9,77.7,.53,.57 44.4,85.4,.53,.56 43.9,36.7,.51,.64 57.9,37.2,.51,.65 47.6,38.2,.51,.56 56.7,39.1,.51,.6 52.3,40.2,.51,.65 40.2,40.8,.51,.52 56.6,41.7,.51,.6 56.1,43.5,.51,.57 46.1,45,.51,.6 56.2,45.8,.51,.67 62.6,45.7,.51,.55 40.4,46.1,.51,.58 62.3,51.2,.51,.46 41.4,57.7,.51,.51 34.5,60.4,.51,.58 56.3,61,.51,.56 33,62.1,.51,.67 41.8,65.4,.51,.59 43.5,66.9,.51,.49 43.4,68.9,.51,.6 57.7,33.7,.49,.51 49.2,34.6,.49,.58 51.1,34.5,.49,.55 42.3,38.6,.49,.51 43.9,38.7,.49,.6 47.1,40.6,.49,.56 42.9,41,.49,.61 43.6,47.5,.49,.56 60.1,48,.49,.65 38.3,63.6,.49,.53 53.7,73.6,.49,.45 54,100.4,.49,.58 65.6,104,.49,.47 47.6,34.8,.47,.55 54.6,35.7,.47,.63 55.1,36.8,.47,.65 51,38.4,.47,.61 44.9,40.7,.47,.56 47.3,42.2,.47,.62 39.7,43.8,.47,.55 43.6,45.1,.47,.59 58.6,46.7,.47,.57 59.7,59.7,.47,.54 65.2,61.4,.47,.56 41.5,61.4,.47,.55 65.6,66.6,.47,.53 54.5,69.6,.47,.57 48.4,94.5,.47,.55 54.7,98.8,.47,.49 62.1,106.6,.47,.46 60.2,114.3,.47,.51 48,30.6,.44,.64 54.6,31,.44,.48 61.1,38.4,.44,.54 62.6,40.2,.44,.52 54.1,40.6,.44,.63 44.3,42.8,.44,.53 59,43.5,.44,.55 60.6,45.8,.44,.56 40.9,48.5,.44,.47 60.3,57.5,.44,.56 37,58.1,.44,.49 34.2,64.9,.44,.45 31.8,65.9,.44,.62 30.3,67.1,.44,.55 51.6,90.1,.44,.54 51.8,96.3,.44,.56 56,100.6,.44,.5 59.3,105.2,.44,.53 64.3,107,.44,.48 62.9,111.6,.44,.49 49.5,42.2,.42,.55 51,42.1,.42,.56 61.8,53.5,.42,.47 64.1,60.2,.42,.44 67.6,103.7,.42,.44 45.9,36.5,.4,.49 60.2,50.6,.4,.54 58.7,63.3,.4,.42 36.6,64,.4,.49 68.2,66.8,.4,.44 70.2,104,.4,.45 68.9,105.6,.4,.49 59.6,112,.4,.5 49.3,30.3,.37,.5 59.1,39.6,.37,.46 45.8,42.9,.37,.52 62.9,44.2,.37,.44 63,59.2,.37,.43 66.3,63.1,.37,.44 42.3,69.6,.37,.44 51.6,32.7,.34,.45 58.2,35.5,.34,.48 60.1,52.7,.34,.44 61.2,55.9,.34,.45 63,61.3,.34,.44 56.8,67.9,.34,.51 45.3,88.5,.34,.47 42.3,45.3,.31,.45 42.1,47.5,.31,.44 39.4,48.6,.31,.41 52.9,99.3,.31,.44 49.8,33,.28,.42 44.6,35.2,.28,.42 42.9,35.6,.28,.44 59.6,36.3,.28,.43 41.4,41.7,.28,.46 58.4,41.7,.28,.42 39.7,63.9,.28,.42 66.3,65.6,.28,.45 56.2,69.1,.28,.42 42.4,74.1,.28,.48 61,109.6,.28,.43'
  };
  var OTPL = {};
  function whaleParts(sm) {
    var ck = 'w' + (sm ? 's' : 'l');
    if (OTPL[ck]) return OTPL[ck];
    var p = oceanParts(sm, { seed: 808, theme: 'night' });
    // shape, fins and spots exactly as traced; the traced wave lines are intentionally not drawn so the shark pops
    var ow = sm ? 1.15 : .95, ink = '#F7FCFF', W = WHALE;
    p.defs += LG('bd', [[0, '#0B1340'], [.45, '#1A2A6C'], [.55, '#1A2A6C'], [1, '#0A1239']], 'x1="0" y1="0" x2="1" y2="0"') +
      RGb('wp', [[0, '#3C6FD0', .42], [.55, '#28449A', .16], [1, '#28449A', 0]]) +
      LG('rim', [[0, '#FFFFFF', 1], [.5, '#CFF6FF', .75], [1, '#8FE6F2', .45]], 'gradientUnits="userSpaceOnUse" x1="72" y1="28" x2="34" y2="112"');
    var main = crPath(P2(W.main), true), fin = crPath(P2(W.fin), true);
    var sp = W.spots.split(' ').map(function (q) { return q.split(',').map(Number); });
    var halo = sp.map(function (s) { return '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + n2(s[2] * (sm ? 2.1 : 2.4)) + '"/>'; }).join('');
    var spots = sp.map(function (s) { return '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + n2(s[2] * (sm ? 1.15 : 1)) + '" opacity="' + n2(Math.min(1, .45 + s[3] * .95)) + '"/>'; }).join('');
    var glow = function (d) { return '<path d="' + d + '" stroke="#6FE8F5" stroke-width="' + n2(ow * 9) + '" stroke-opacity=".05"/><path d="' + d + '" stroke="#7FEFF8" stroke-width="' + n2(ow * 5.5) + '" stroke-opacity=".09"/><path d="' + d + '" stroke="#A8F6FF" stroke-width="' + n2(ow * 3) + '" stroke-opacity=".17"/>'; };
    var fg = '<ellipse cx="51" cy="72" rx="30" ry="50" fill="url(#§wp)"/>' +
      '<path d="' + main + '" fill="#010410" opacity=".45" transform="translate(1.6 2.4)"/>' +
      '<g fill="none" stroke-linejoin="round">' + glow(main) + '</g>' +
      '<path d="' + main + '" fill="url(#§bd)"/><path d="' + fin + '" fill="url(#§bd)"/>' +
      '<g fill="#7FF0FA" opacity="' + (sm ? .1 : .13) + '">' + halo + '</g>' +
      '<g fill="#F4FEFF">' + spots + '</g>' +
      '<g fill="none" stroke-linejoin="round"><path d="' + main + '" stroke="url(#§rim)" stroke-width="' + n2(ow * 2) + '" stroke-opacity=".45"/>' +
      '<path d="' + main + '" stroke="' + ink + '" stroke-width="' + n2(ow) + '"/><path d="' + fin + '" stroke="' + ink + '" stroke-width="' + n2(ow) + '"/>' +
      '<path d="M38.2 55.1C38.6 58.6 39.2 62.4 39.7 65.7" stroke="' + ink + '" stroke-width="' + n2(ow * .85) + '" stroke-linecap="round"/></g>';
    return (OTPL[ck] = { defs: p.defs, bg: p.bg, rays: p.rays, plk: p.plk, bubbles: p.bubbles, fish: p.fish, reef: p.reef, top: p.top, fg: fg });
  }
  function whaleShark(opts) {
    opts = opts || {}; injectCSS();
    var p = whaleParts(opts.size != null && opts.size < 90);
    return oceanBack('dgc-whale', p, p.fg, opts);
  }

  /* Sea Turtle - seen from above, swimming up and to the right */
  function turtleParts(sm) {
    var ck = 't' + (sm ? 's' : 'l');
    if (OTPL[ck]) return OTPL[ck];
    var p = oceanParts(sm, {
      seed: 515, theme: 'day',
      bubbles: [[70.5, 27.5, 1], [72.8, 22.4, .75], [71, 17.6, .55], [73.4, 13.4, .42], [30, 104, .8], [27.6, 99, .55], [29.4, 95, .4]],
      fish: [[13, 20, -20, .95, .95, '#FFD23F'], [18.4, 16.4, -20, .8, .95, '#FFD23F'], [19.4, 22.6, -20, .75, .95, '#FFD23F'], [23.6, 18.6, -20, .62, .9, '#FFD23F'], [86, 104, 200, .9, .95, '#FF8A3D'], [90.6, 99.4, 200, .72, .95, '#FF8A3D']],
      grass: [[5, 9, 1.2], [23, 7, -1], [25, 9.5, 1.4], [63, 7, 1], [65, 9, -1.2], [95, 8, -1]]
    });
    var ow = sm ? 1.05 : .8, ink = '#EEF6FC', i;
    p.defs += RGb('sh', [[0, '#3E7E7A'], [.55, '#23596A'], [1, '#163F55']], 'cx=".5" cy=".42" r=".62"') +
      RGb('sc', [[0, '#D2B06A'], [.4, '#7E9468'], [.75, '#346F6C'], [1, '#1F5566']], 'cx=".5" cy=".45" r=".72"') +
      LG('sk', [[0, '#2A6478'], [1, '#17435A']], 'x1="0" y1="0" x2="1" y2="1"') +
      RGb('mo', [[0, '#E6BE6E', .5], [1, '#E6BE6E', 0]]);
    var S0 = 'M0 -25C12.5 -25 19.5 -13 19.5 -1C19.5 12 12 22 0 27C-12 22 -19.5 12 -19.5 -1C-19.5 -13 -12.5 -25 0 -25Z';
    var S1 = 'M0 -20.9C10.5 -20.9 16.4 -10.8 16.4 -.8C16.4 10.2 10.1 18.6 0 22.8C-10.1 18.6 -16.4 10.2 -16.4 -.8C-16.4 -10.8 -10.5 -20.9 0 -20.9Z';
    var FL = 'M-13.6 -15.4C-19 -20.2 -27 -24.8 -35.6 -24.2C-38.8 -23.8 -39.4 -21.8 -37 -20.4C-30.2 -16.2 -22.6 -11 -15.8 -8.3Z';
    var FR = 'M13.6 -15.4C19.6 -17 27 -14.2 33 -8.6C35.2 -6.5 34.8 -4.8 32.2 -5.2C25.5 -6 20 -7.4 15.8 -8.2Z';
    var RL = 'M-9.8 18.5C-14.5 19.8 -18.4 23.5 -18.2 27.4C-17.9 29 -16.6 29.2 -15.4 28C-12.5 25.2 -9.8 23 -7 21.8Z';
    var RR = 'M9.8 18.5C14.5 19.8 18.4 23.5 18.2 27.4C17.9 29 16.6 29.2 15.4 28C12.5 25.2 9.8 23 7 21.8Z';
    var HD = 'M-4.4 -24.2C-5.4 -29.5 -3.9 -35.2 0 -36.6C3.9 -35.2 5.4 -29.5 4.4 -24.2Z';
    var NK = 'M-5 -22.6Q0 -20.4 5 -22.6L4.5 -25.4Q0 -26.6 -4.5 -25.4Z';
    var TL = 'M-1.5 26.2L0 30.6L1.5 26.2Z';
    var limbs = [FL, FR, RL, RR, NK, HD, TL];
    var sil = limbs.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '<path d="' + S0 + '"/>';
    // vertebral + costal scute network
    var Y = [-17.5, -9, -.5, 8, 15.5, 20.8], Wv = [3.4, 6.8, 7.4, 7, 5.3, 1.8];
    var ringX = function (y) { var t = (y + .8) / 21.8; return 16.4 * Math.sqrt(Math.max(0, 1 - t * t)); };
    var vert = '', cost = '', rays2 = '';
    for (i = 0; i < 5; i++) {
      var y0 = Y[i], y1 = Y[i + 1], w0 = Wv[i], w1 = Wv[i + 1], ym = (y0 + y1) / 2, wm = Math.max(w0, w1) + 1.3;
      vert += '<path d="M' + n2(-w0) + ' ' + y0 + 'Q0 ' + n2(y0 - 1) + ' ' + n2(w0) + ' ' + y0 + 'L' + n2(wm) + ' ' + n2(ym) + 'L' + n2(w1) + ' ' + y1 + 'Q0 ' + n2(y1 - 1) + ' ' + n2(-w1) + ' ' + y1 + 'L' + n2(-wm) + ' ' + n2(ym) + 'Z" fill="url(#§sc)"/>';
      rays2 += [[-1, 1]].map(function () { return '<path d="M0 ' + n2(ym) + 'L' + n2(-wm * .7) + ' ' + n2(y0 + .6) + 'M0 ' + n2(ym) + 'L' + n2(wm * .7) + ' ' + n2(y0 + .6) + 'M0 ' + n2(ym) + 'L' + n2(wm * .75) + ' ' + n2(y1 - .4) + 'M0 ' + n2(ym) + 'L' + n2(-wm * .75) + ' ' + n2(y1 - .4) + '"/>'; }).join('');
    }
    for (i = 1; i < 5; i++) {
      [-1, 1].forEach(function (s) {
        var y = Y[i], wm = Math.max(Wv[i - 1], Wv[i]) + .2, ye = y + 2.2, xe = ringX(ye);
        cost += '<path d="M' + n2(s * wm) + ' ' + n2(y) + 'Q' + n2(s * (wm + xe) / 2) + ' ' + n2(y + 1.6) + ' ' + n2(s * xe) + ' ' + n2(ye) + '"/>';
      });
    }
    for (i = 0; i < 4; i++) {
      [-1, 1].forEach(function (s) {
        var yc = (Y[i] + Y[i + 1]) / 2 + 1, xc = s * (Math.max(Wv[i], Wv[i + 1]) + ringX(yc)) / 2;
        cost += '<ellipse cx="' + n2(xc) + '" cy="' + n2(yc) + '" rx="3.6" ry="3" fill="url(#§mo)" stroke="none"/>';
      });
    }
    var marg = '';
    for (i = 0; i < 26; i++) { var th = i / 26 * 6.2832, cx = Math.sin(th), cy = -Math.cos(th); marg += '<path d="M' + n2(cx * 16.4) + ' ' + n2(cy * (cy < 0 ? 20.1 : 23.6) - .8) + 'L' + n2(cx * 19.3) + ' ' + n2(cy * (cy < 0 ? 24.1 : 27.8) - .8) + '"/>'; }
    var dots = function (pts) { return pts.map(function (q) { return CI(q[2] || .45, 'fill="' + ink + '" opacity=".6"', q[0], q[1]); }).join(''); };
    var turtle = '<g transform="translate(50 67) rotate(24) scale(' + (sm ? 1.04 : 1.02) + ')">' +
      '<g fill="#010712" opacity=".38" transform="translate(1.4 2.2)">' + sil + '</g>' +
      '<g fill="url(#§sk)" stroke="' + ink + '" stroke-width="' + n2(ow) + '" stroke-linejoin="round">' + limbs.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</g>' +
      '<path d="M-2.2 -33.4L0 -34.6L2.2 -33.4L1.4 -30.4L-1.4 -30.4Z M-4 -28.4L-1.6 -28.6L0 -26.6L1.6 -28.6L4 -28.4" fill="none" stroke="' + ink + '" stroke-width=".3" stroke-opacity=".6"/>' +
      '<ellipse cx="-3.3" cy="-30.6" rx=".85" ry="1.35" fill="#050E18"/><ellipse cx="3.3" cy="-30.6" rx=".85" ry="1.35" fill="#050E18"/>' + CI(.3, 'fill="#FFFFFF"', -3.1, -31.1) + CI(.3, 'fill="#FFFFFF"', 3.5, -31.1) +
      dots([[-20, -18.4], [-24.6, -20.4], [-29.4, -21.8], [-33.4, -22.2, .38], [-18.4, -13.2, .38], [-23.4, -15.2, .38], [18.6, -12.6], [23, -11.2], [27.4, -9.2, .4], [31, -7, .35], [-13.4, 23.4, .4], [-15.6, 26, .35], [13.4, 23.4, .4], [15.6, 26, .35]]) +
      '<path d="' + S0 + '" fill="#1B4A5F"/><path d="' + S1 + '" fill="url(#§sh)"/>' +
      '<g fill="none" stroke="' + ink + '" stroke-width="' + n2(sm ? .42 : .3) + '" stroke-opacity=".7">' + marg + cost + '</g>' +
      vert + (sm ? '' : '<g fill="none" stroke="#E6F2EA" stroke-width=".22" stroke-opacity=".28">' + rays2 + '</g>') +
      '<g fill="none" stroke="' + ink + '" stroke-width="' + n2(sm ? .5 : .38) + '" stroke-opacity=".85" stroke-linejoin="round">' + vert.replace(/ fill="url\(#§sc\)"/g, '') + '<path d="' + S1 + '"/></g>' +
      '<path d="' + S0 + '" fill="none" stroke="#8CC8F0" stroke-width="' + n2(ow * 3) + '" stroke-opacity=".14"/><path d="' + S0 + '" fill="none" stroke="' + ink + '" stroke-width="' + n2(ow) + '"/>' +
      '</g>';
    return (OTPL[ck] = { defs: p.defs, bg: p.bg, rays: p.rays, plk: p.plk, bubbles: p.bubbles, fish: p.fish, reef: p.reef, top: p.top, fg: turtle });
  }
  function turtle(opts) {
    opts = opts || {}; injectCSS();
    var p = turtleParts(opts.size != null && opts.size < 90);
    return oceanBack('dgc-turtle', p, p.fg, opts);
  }
  /* Eclipse - the light follows the eclipse: a bright golden partial sun, the card darkens and stars
     come out as the moon covers it, only the corona at totality, the diamond ring, then daylight returns. */
  var ETPL = {};
  function eclipseParts(sm) {
    var ck = sm ? 's' : 'l';
    if (ETPL[ck]) return ETPL[ck];
    var Z = 1.2, MX = 50, MY = 62, RM = 15.6 * Z, RS = 15 * Z, rnd = RNG(31), i;
    var sky = RGb('sk', [[0, '#15110A'], [.35, '#0A090E'], [1, '#030306']], 'gradientUnits="userSpaceOnUse" cx="50" cy="62" r="95"');
    var bgp = '<rect width="100" height="140" fill="url(#§sk)"/>';
    var stars = '';
    for (i = 0; i < (sm ? 26 : 54); i++) {
      var x = 5 + rnd() * 90, y = 5 + rnd() * 130; if (Math.hypot(x - MX, y - MY) < 38) continue;
      var r = .18 + Math.pow(rnd(), 2.2) * .55, o = .35 + rnd() * .6;
      if (r > .5 && !sm) stars += star4(x, y, r * 3.4, '#FFF4DC', .9) + CI(r, 'fill="#FFFFFF"', x, y); else stars += CI(sm ? r * 1.25 : r, 'fill="#FFF8EA" opacity="' + n2(o) + '"', x, y);
    }
    var dayD = RGb('dy', [[0, '#FFF1D2'], [.24, '#F4CC80'], [.52, '#D69C4C'], [.82, '#9A662A'], [1, '#664016']], 'gradientUnits="userSpaceOnUse" cx="50" cy="62" r="92"');
    var day = '<rect width="100" height="140" fill="url(#§dy)"/>';
    var cor = RG('co1', 50, [[.36, '#FFD27A', .55], [.6, '#F2A93B', .16], [1, '#F2A93B', 0]], MX, MY) +
      RG('co2', 32 * Z, [[.5, '#FFF6DC'], [.56, '#FFE3A0', .9], [.7, '#FFC45C', .42], [1, '#FFB347', 0]], MX, MY) +
      RG('co3', 50 * Z, [[.3, '#FFF1C8', .8], [.6, '#FFC45C', .25], [1, '#FFC45C', 0]], MX, MY);
    var corona = CI(50, 'fill="url(#§co1)"', MX, MY) + CI(32 * Z, 'fill="url(#§co2)"', MX, MY);
    corona += [[62, 1.6], [205, 1.2], [300, 1.4]].map(function (p) { return PA(band(p[0] - 5, p[0] + 5, function (t) { return RM + p[1] * Math.sin(Math.PI * t) * .8; }, function (t) { return p[1] * .5 * Math.sin(Math.PI * t); }, 10, MX, MY), 'fill="#FF5C7A" opacity=".8"'); }).join('');
    corona += CI(RM + 1.7, 'fill="none" stroke="#FFC45C" stroke-width="3" stroke-opacity=".38"', MX, MY) + CI(RM + .5, 'fill="none" stroke="#FFEFC8" stroke-width="1.15"', MX, MY);
    var str = '';
    for (i = 0; i < 18; i++) {
      var a = i * 20 + rnd() * 12, eq = Math.abs(Math.sin(a * D2R)), len = (12 + eq * 20 + rnd() * 10) * Z, w = 4 + eq * 6 + rnd() * 3;
      str += PA('M' + pt(RS, a - w, MX, MY) + 'Q' + pt(RS + len * .45, a - w * .35, MX, MY) + ' ' + pt(RS + len, a + (rnd() - .5) * 4, MX, MY) + 'Q' + pt(RS + len * .45, a + w * .35, MX, MY) + ' ' + pt(RS, a + w, MX, MY) + 'Z', 'fill="url(#§co3)"');
    }
    if (!sm) for (i = 0; i < 28; i++) { var a2 = rnd() * 360, l2 = (8 + rnd() * 18) * Z; str += PA('M' + pt(RS + 1, a2, MX, MY) + 'L' + pt(RS + 1 + l2, a2 + (rnd() - .5) * 6, MX, MY), 'stroke="#FFE7AE" stroke-width=".22" stroke-opacity="' + n2(.25 + rnd() * .35) + '" fill="none"'); }
    var sunD = RGb('sn', [[0, '#FFFEF8'], [.6, '#FFF2CF'], [.9, '#FFDA8A'], [1, '#F6B84C']]) +
      RG('sg', 46, [[0, '#FFFFFF', .95], [.3, '#FFF3D0', .75], [.55, '#FFD98A', .35], [1, '#FFB347', 0]], MX, MY);
    var sun = CI(RS, 'fill="url(#§sn)"', MX, MY);
    var glow = CI(46, 'fill="url(#§sg)"', MX, MY);
    var moonD = RGb('mn', [[0, '#1A1C27'], [.75, '#0B0C12'], [1, '#050507']], 'cx=".42" cy=".4" r=".7"');
    var moon = CI(RM, 'fill="url(#§mn)"', MX, MY) +
      '<g fill="#9FB3D9" opacity=".035"><ellipse cx="' + n2(MX - 5) + '" cy="' + n2(MY - 4) + '" rx="6" ry="4.2" transform="rotate(-25 ' + n2(MX - 5) + ' ' + n2(MY - 4) + ')"/><ellipse cx="' + n2(MX + 5) + '" cy="' + n2(MY + 5) + '" rx="4.6" ry="3.2"/>' + CI(2.4, '', MX + 6, MY - 7) + '</g>' +
      CI(RM, 'fill="none" stroke="#FFE7B0" stroke-width=".3" stroke-opacity=".5"', MX, MY);
    var flD = RGb('fl', [[0, '#FFFFFF'], [.18, '#FFFFFF', .95], [.4, '#FFE3A0', .55], [1, '#FFC45C', 0]]);
    var flare = function (x, y) {
      x = +n2(x);
      return CI(9, 'fill="url(#§fl)"', x, y) + CI(1.4, 'fill="#FFFFFF"', x, y) +
        PA('M' + n2(x - 24) + ' ' + y + 'Q' + x + ' ' + (y - .6) + ' ' + n2(x + 24) + ' ' + y + 'Q' + x + ' ' + (y + .6) + ' ' + n2(x - 24) + ' ' + y + 'Z', 'fill="#FFF8E6" opacity=".9"') +
        PA('M' + x + ' ' + (y - 14) + 'Q' + n2(x + .5) + ' ' + y + ' ' + x + ' ' + (y + 14) + 'Q' + n2(x - .5) + ' ' + y + ' ' + x + ' ' + (y - 14) + 'Z', 'fill="#FFF8E6" opacity=".8"') +
        star4(x, y, 7.5, '#FFFFFF', .6, 45);
    };
    var FA = [MX - RM + .1, MY], FB = [MX + RM - .1, MY];
    var R1o = 28.5 * Z, R2o = 31.2 * Z, RN = R1o + 2.3, gw = sm ? .5 : .32;
    var orn = '<g fill="none" stroke="url(#§gd)" stroke-width="' + n2(gw) + '">' +
      CI(R1o, 'opacity=".85"', MX, MY) + (sm ? '' : CI(R2o, 'stroke-dasharray=".25 1.5" opacity=".7"', MX, MY)) +
      CI(2.3, '', MX, MY - RN) + CI(2.3, '', MX, MY + RN) +
      '<path d="M50 9.5V' + n2(MY - RN - 2.3) + 'M50 ' + n2(MY + RN + 2.3) + 'V130.5"/></g>' +
      CI(.95, 'fill="url(#§gd)"', MX, MY - RN) + CI(.95, 'fill="url(#§gd)"', MX, MY + RN) +
      star4(50, 14.5, 3.4, 'url(#§gd)') + star4(50, 115, 4.2, 'url(#§gd)') + star4(50, 124.5, 1.8, 'url(#§gd)') +
      [[10.5, 10.5], [89.5, 10.5], [10.5, 129.5], [89.5, 129.5]].map(function (c) { return star4(c[0], c[1], 2.6, 'url(#§gd)'); }).join('');
    var top = '<rect width="100" height="140" fill="url(#§vg)"/>' + orn +
      '<rect x="4" y="4" width="92" height="132" rx="6.2" fill="none" stroke="#1A1004" stroke-width="' + n2(sm ? 2.2 : 1.8) + '" stroke-opacity=".35"/>' + frame(sm ? 1.1 : .85);
    var defs = sky + dayD + cor + sunD + moonD + flD + RGb('vg', [[.6, '#000000', 0], [1, '#000000', .5]], 'cx=".5" cy=".46" r=".8"') + gold;
    ETPL[ck] = { defs: defs, bg: bgp, stars: stars, day: day, corona: corona, str: str, sun: sun, glow: glow, moon: moon, fa: flare(FA[0], FA[1]), fb: flare(FB[0], FB[1]), FA: FA, FB: FB, top: top, MX: MX, MY: MY };
    return ETPL[ck];
  }
  // the still frame (reduced motion, animate:false, backURL) is totality: corona + stars on darkness
  var eclStill = function (p) { return p.bg + p.stars + p.corona + p.str + p.moon + p.top; };
  function eclipse(opts) {
    opts = opts || {}; injectCSS();
    var sm = opts.size != null && opts.size < 90, p = eclipseParts(sm), html;
    if (opts.animate === false) {
      html = '<span class="dgc-bkw dgc-ecl§STILL" aria-hidden="true">' + BSVG(eclStill(p), p.defs) + '</span>';
    } else {
      var o = function (x, y) { return 'transform-origin:' + n2(x) + '% ' + n2(y / 1.4) + '%'; };
      var n = 0, lay = function (inner, cls, style) { var t = 'x' + (n++); return BL(sfx(inner, t), cls, style, sfx(p.defs, t)); };
      html = '<span class="dgc-bkw dgc-ecl§STILL" aria-hidden="true">' +
        BSVG(p.bg, p.defs) +
        BL(p.stars, 'dgc-e-star') + lay(p.day, 'dgc-e-day') +
        '<i class="dgc-bl dgc-e-cor">' + lay(p.corona) + lay(p.str, 'dgc-e-str', o(p.MX, p.MY)) + '</i>' +
        lay(p.glow, 'dgc-e-glow') + lay(p.sun, 'dgc-e-sun') + lay(p.moon) +
        lay(p.fa, 'dgc-e-fa', o(p.FA[0], p.FA[1])) + lay(p.fb, 'dgc-e-fb', o(p.FB[0], p.FB[1])) +
        lay(p.top) + '</span>';
    }
    return html.replace('§STILL', opts.still ? ' dgc-still' : '').replace(/§/g, nid());
  }

  // Static back as a cached data: URL (one decoded image shared by every card that uses it).
  // Cheapest option for many face-down cards on the table: <div class="back" style="background:url(...) center/cover">.
  var URLC = {};
  function backURL(id, opts) {
    opts = opts || {}; id = String(id || '').replace(/^b-/, '');
    var sm = opts.size != null && opts.size < 90, ck = id + (sm ? ':s' : ':l'), body, defs, q;
    if (URLC[ck]) return URLC[ck];
    if (id === 'whale' || id === 'turtle') { q = id === 'whale' ? whaleParts(sm) : turtleParts(sm); body = q.bg + q.rays + q.plk + q.reef + q.fish + q.fg + q.bubbles + q.top; defs = q.defs; }
    else if (id === 'eclipse') { q = eclipseParts(sm); body = eclStill(q); defs = q.defs; }
    else return '';
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice"><defs>' + defs + '</defs>' + body + '</svg>';
    return (URLC[ck] = 'data:image/svg+xml,' + encodeURIComponent(s.replace(/§/g, 'k')));
  }
  function back(id, opts) {
    id = String(id || '').replace(/^b-/, '');
    if (id === 'whale') return whaleShark(opts);
    if (id === 'turtle') return turtle(opts);
    if (id === 'eclipse') return eclipse(opts);
    return '';
  }
  /* ------------------------------------------------------------------ css */
  var css = [
    '.dgc-ring{position:absolute;inset:-32%;display:block;pointer-events:none}',
    '.dgc-ring i{position:absolute;display:block}',
    '.dgc-ring .dgc-l{inset:0;z-index:2}',
    '.dgc-ring .dgc-bk{z-index:0}',
    '.dgc-ring .dgc-l .dgc-l{z-index:auto}',
    '.dgc-ring svg,.dgc-bkw svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block;overflow:visible}',
    '.dgc-spin{animation:dgc-spin 12s linear infinite}',
    '.dgc-rev{animation-direction:reverse!important}',
    '.dgc-tw{animation:dgc-tw 1.6s ease-in-out infinite alternate}',
    '.dgc-sway{animation:dgc-sway 5s ease-in-out infinite alternate}',
    '.dgc-glint{animation:dgc-glint 4.6s ease-in-out infinite;opacity:.9}',
    '.dgc-flk{animation:dgc-flk 1.35s linear infinite}',
    '.dgc-flk1{animation-delay:-.45s;opacity:0}.dgc-flk2{animation-delay:-.9s;opacity:0}',
    '.dgc-fire{animation:dgc-fire .6s ease-in-out infinite alternate}',
    '.dgc-heat{animation:dgc-heat .9s ease-in-out infinite alternate}',
    '.dgc-ember{animation:dgc-ember 2s ease-out infinite;opacity:0}',
    '.dgc-petal{animation:dgc-petal 6s ease-in infinite;opacity:.9}',
    '.dgc-meteor{animation:dgc-meteor 4s linear infinite;opacity:0}',
    '.dgc-infall{animation:dgc-infall 3.2s cubic-bezier(.5,0,.9,.7) infinite;opacity:.55}',
    '.dgc-shd-gold>svg{filter:drop-shadow(0 1px 1.2px rgba(70,40,0,.5))}',
    '.dgc-shd-soft>svg{filter:drop-shadow(0 .5px 1px rgba(60,20,40,.35))}',
    '.dgc-shd-blue>svg{filter:drop-shadow(0 0 2.5px #4D8BFF)}',
    '.dgc-shd-sky>svg{filter:drop-shadow(0 0 2px rgba(160,200,255,.7))}',
    '.dgc-shd-bh>svg{filter:drop-shadow(0 0 2px rgba(255,140,40,.85))}',
    '.dgc-shd-bh4>svg,.dgc-shd-bh4>i>svg{filter:drop-shadow(0 0 4px rgba(255,140,40,.8))}',
    '.dgc-shd-bh3>svg,.dgc-shd-bh3>i>svg{filter:drop-shadow(0 0 2.6px rgba(255,140,40,.8))}',
    '.dgc-fall{opacity:0;animation:dgc-fall 2.4s cubic-bezier(.5,0,.9,.6) infinite}',
    '@keyframes dgc-fall{0%{opacity:0;transform:translate(var(--x0),var(--y0))}20%{opacity:1}100%{opacity:0;transform:translate(var(--x1),var(--y1))}}',
    '@keyframes dgc-spin{to{transform:rotate(360deg)}}',
    '@keyframes dgc-tw{0%{opacity:.12}100%{opacity:1}}',
    '@keyframes dgc-sway{0%{transform:rotate(-3deg)}100%{transform:rotate(3deg)}}',
    '@keyframes dgc-glint{0%,58%{opacity:0;transform:scale(.2) rotate(0deg)}72%{opacity:1;transform:scale(1) rotate(40deg)}88%,100%{opacity:0;transform:scale(.25) rotate(90deg)}}',
    '@keyframes dgc-flk{0%{opacity:1}6%{opacity:.3}10%{opacity:1}22%{opacity:.85}30%,100%{opacity:0}}',
    '@keyframes dgc-fire{0%{transform:scale(.965) rotate(-1.6deg);opacity:.82}100%{transform:scale(1.045) rotate(1.8deg);opacity:1}}',
    '@keyframes dgc-heat{0%{opacity:.7}100%{opacity:1}}',
    '@keyframes dgc-ember{0%{opacity:0;transform:translate(0,0) scale(1)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3)}}',
    '@keyframes dgc-petal{0%{opacity:0;transform:translate(0,0) rotate(0deg)}12%{opacity:.95}80%{opacity:.8}100%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--rt))}}',
    '@keyframes dgc-meteor{0%{opacity:0;transform:translate(60%,-60%)}8%{opacity:1}34%{opacity:0;transform:translate(-60%,60%)}100%{opacity:0;transform:translate(-60%,60%)}}',
    '@keyframes dgc-infall{0%{opacity:0;transform:rotate(0deg) scale(1.2)}25%{opacity:1}100%{opacity:0;transform:rotate(200deg) scale(.74)}}',
    '.dgc-breathe{animation:dgc-breathe 6.3s ease-in-out infinite alternate}',
    '.dgc-shim{animation:dgc-shim 2.8s ease-in-out infinite alternate}',
    '@keyframes dgc-breathe{0%{transform:scale(.94) rotate(-3deg)}100%{transform:scale(1.05) rotate(3deg)}}',
    '@keyframes dgc-shim{0%{transform:scale(.985);opacity:.45}100%{transform:scale(1.035);opacity:1}}',
    /* backs */
    '.dgc-bkw{position:absolute;inset:0;display:block;overflow:hidden;border-radius:inherit;background:#07152E}',
    '.dgc-ecl{background:#050509}',
    '.dgc-bkw i{position:absolute;inset:0;display:block}',
    '.back:has(>.dgc-bkw):before{display:none}',
    '.dgc-wray{animation:dgc-wray 7s ease-in-out infinite alternate}',
    '@keyframes dgc-wray{0%{opacity:.55;transform:translateX(-3%)}100%{opacity:1;transform:translateX(3%)}}',
    '.dgc-bub{animation:dgc-bub 7s linear infinite}',
    '.dgc-plk{animation:dgc-plk 9s ease-in-out infinite alternate}',
    '@keyframes dgc-plk{0%{opacity:.35;transform:translate(-1.5%,2%)}50%{opacity:1}100%{opacity:.55;transform:translate(1.5%,-3%)}}',
    '@keyframes dgc-bub{0%{opacity:0;transform:translateY(6%)}15%{opacity:1}80%{opacity:.9}100%{opacity:0;transform:translateY(-14%)}}',
    /* eclipse: 11s per pass, alternating, so every pass is partial -> totality -> partial */
    '.dgc-e-sun{animation:dgc-esun 11s infinite alternate}',
    '.dgc-e-glow{opacity:0;animation:dgc-eglow 11s infinite alternate}',
    '.dgc-e-day{opacity:0;animation:dgc-eday 11s linear infinite alternate}',
    '.dgc-e-cor{animation:dgc-ecor 11s linear infinite alternate}',
    '.dgc-e-star{animation:dgc-estar 11s linear infinite alternate}',
    '.dgc-e-str{animation:dgc-spin 90s linear infinite}',
    '.dgc-e-fa{opacity:0;animation:dgc-efa 11s linear infinite alternate}',
    '.dgc-e-fb{opacity:0;animation:dgc-efb 11s linear infinite alternate}',
    '@keyframes dgc-esun{0%{transform:translateX(-24%);animation-timing-function:cubic-bezier(.35,0,.65,1)}38%{transform:translateX(-1.1%);animation-timing-function:ease-out}44%,56%{transform:translateX(0);animation-timing-function:ease-in}62%{transform:translateX(1.1%);animation-timing-function:cubic-bezier(.35,0,.65,1)}100%{transform:translateX(24%)}}',
    '@keyframes dgc-eglow{0%{transform:translateX(-24%);opacity:1;animation-timing-function:cubic-bezier(.35,0,.65,1)}38%{transform:translateX(-1.1%);opacity:.18;animation-timing-function:ease-out}44%,56%{transform:translateX(0);opacity:0;animation-timing-function:ease-in}62%{transform:translateX(1.1%);opacity:.18;animation-timing-function:cubic-bezier(.35,0,.65,1)}100%{transform:translateX(24%);opacity:1}}',
    '@keyframes dgc-eday{0%{opacity:.95}22%{opacity:.82}36%{opacity:.3}42%,58%{opacity:0}64%{opacity:.3}78%{opacity:.82}100%{opacity:.95}}',
    '@keyframes dgc-ecor{0%,37%{opacity:0}45%,55%{opacity:1}63%,100%{opacity:0}}',
    '@keyframes dgc-estar{0%,32%{opacity:0}44%,56%{opacity:1}68%,100%{opacity:0}}',
    '@keyframes dgc-efa{0%,34%{opacity:0;transform:scale(.3)}40%{opacity:1;transform:scale(1.15)}46%{opacity:0;transform:scale(.5)}100%{opacity:0;transform:scale(.3)}}',
    '@keyframes dgc-efb{0%,54%{opacity:0;transform:scale(.5)}60%{opacity:1;transform:scale(1.15)}66%{opacity:0;transform:scale(.3)}100%{opacity:0;transform:scale(.3)}}',
    /* freeze: still frame that is designed to look finished */
    '.dgc-still *,.dgc-still.dgc-ring *,.dgc-still.dgc-bkw *{animation:none!important}',
    '@media (prefers-reduced-motion:reduce){.dgc-ring *,.dgc-bkw *{animation:none!important}}'
  ].join('\n');

  function injectCSS() {
    if (typeof document === 'undefined' || document.getElementById('dgc-css')) return;
    var s = document.createElement('style'); s.id = 'dgc-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  global.DGCosmetics = {
    version: '1.1.0',
    css: css,
    injectCSS: injectCSS,
    ring: ring,
    hasRing: function (id) { return !!RB[key(id)]; },
    RINGS: RINGS.map(function (r) { return 'f-' + r; }),
    whaleShark: whaleShark,
    turtle: turtle,
    eclipse: eclipse,
    back: back,
    backURL: backURL
  };
})(typeof window !== 'undefined' ? window : this);
