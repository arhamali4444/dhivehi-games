/* Dhivehi Games - one-screen lobbies ("fit engine"). Shared by the website and the phone app.

   Each game's lobby fits ONE phone screen with no page scrolling, so the sponsor box (.dgs-box) is always on screen.
   Where it runs:
     - the phone app (window.DG_APP, set before this file loads): always
     - the website: only while the window is phone-sized, (max-width: 600px) and (max-height: 1000px).
       Desktops, tablets and phones in landscape keep the normal layout; growing past the limit (rotating, resizing)
       undoes everything and puts every moved row back where it was.
   Steps until the page fits (each step only when the previous one was not enough):
     1. dgf-c1: compact sponsor box, small print and gaps
     2. shrink the decorative art (hide it when it would be smaller than its minimum and may go), then the title
     3. dgf-c2 (shortest phones, e.g. iPhone SE): smaller sponsor box, no kicker / tagline lines, smaller hints
     4. dgf-c3 (320 px wide phones): no one-line mode rules summary, one-line More row, tighter cards
     +  "more" rows (per game, below) always live in a "More" sheet on phones, so the screen is the same on every phone
     5. still too tall (e.g. a first-run form): the page simply scrolls as before. Nothing is ever cut off.
   Runs only when the lobby appears, changes size or the window resizes; no scroll listeners, nothing per frame.
   Height-only window changes (Safari's address bar sliding in and out, the on-screen keyboard) are ignored while the
   page scrolls or a text field is focused, so the layout never jumps under the user's finger.
   (Zooming the whole lobby was tried and dropped: in WebKit it re-lays the page out every animation frame.)

   Binveriya, Atolls and Raalhu Rumble do not load this file: their lobbies are already full-screen fixed layouts
   (position:fixed, sponsor box pinned at the bottom) that fit every phone by design.

   window.__dgFit = { refit(), state() } for tests. */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  if (W.__dgFitLoaded) return;
  W.__dgFitLoaded = 1;

  /* ---------- per-game config ----------
     mark  = an element only the lobby has (its root is the <main> around it)
     decor = decorative art / title that may shrink (CSS zoom, so the layout really gets smaller): [selector, smallest zoom, may hide]
     pull  = the title sits over the hero's bottom edge with a negative top margin: that margin shrinks with the hero
             and is 0 once the hero is gone (otherwise the title slides up under the top bar)
     gone  = background art that only makes sense with the hero (hidden together with it)
     clip  = background art drawn behind the hero at a fixed size: cut off (it fades out at its own bottom edge) where the
             shrunken hero ends, so no text sits on top of the picture
     css   = extra CSS for this game (only while the engine is on: scope it to html.dgf-on)
     more  = secondary rows moved into a "More" sheet on phones (items = selectors, hide = hidden on phones only) */
  var T = { mark: '.dtitle', decor: [['.dhero', 0.3, 1], ['.dtitle', 0.6]], pull: '.dtitle' };
  var FIT = {
    digu: { mark: '.dtitle', decor: T.decor, pull: '.dtitle', more: { items: ['.hmlist', '.hhow'], hide: ['.heb'], title: 'More', sub: 'Most wins, Store, your account, how to play', closeOnAction: true } },
    dhogu: { mark: '.d1-ttl', decor: [['.d1-hero', 0.3, 1], ['.d1-ttl', 0.6]] },
    bondi: T, joker: T, dhashundhama: T,
    /* the juice-bar backdrop (body:before) is drawn for a page WITH the hero: without it, slide the shelf of jars up behind
       the top bar so the title and rules text sit on the plain wall, not on the jars */
    juice: { mark: T.mark, decor: T.decor, pull: T.pull, css: ['html.dgf-on body:has(main.dgf-nohero):before{top:-96px}'] },
    dhihaeh: { mark: '.dtitle', decor: [['.hhero', 0.3, 1], ['.dtitle', 0.6]], pull: '.dtitle', gone: ['.hsc'], clip: '.hsc' },
    /* Guess the Celebrity: the film strip of faces is the decor (shrinks, then goes on the shortest phones) */
    celebrity: { mark: 'main.home .cl-title', decor: [['.film .frames', 0.55], ['.film', 0.6, 1]] },
    /* Guess the Song: the hero (title + the turntable seen from above) shrinks as one piece; it never goes */
    song: { mark: 'main.home .lob', decor: [['.lob', 0.82]] },
    quiz: { mark: 'main.home .hero', decor: [['.hero', 0.3, 1]], more: { items: ['.topics', '.rew', '.chk', '.howlink', '.snote'], titleFrom: '.topics h4', title: 'Practice topics', sub: 'Topics, how to win Boli, how to play' } }
  };
  /* the game = the folder the page is in: /digu/, /digu/index.html, /some/prefix/digu/ */
  var game = (location.pathname.replace(/\/[^\/]*$/, '').split('/').pop() || '').toLowerCase();
  var cfg = FIT[game];
  if (!cfg || !W.MutationObserver) return;
  var APP = !!W.DG_APP;
  var PHONE = '(max-width: 600px) and (max-height: 1000px)';
  var mq = W.matchMedia ? W.matchMedia(PHONE) : null;
  function phone() { return APP || (mq ? mq.matches : (W.innerWidth <= 600 && W.innerHeight <= 1000)); }

  /* ---------- CSS (everything scoped to html.dgf-on = engine active, or to elements only the engine creates) ---------- */
  (function css() {
    if (D.getElementById('dgf-css')) return;
    var s = D.createElement('style');
    s.id = 'dgf-css';
    s.textContent = [
      /* fixed screens: the page itself never scrolls (sheets scroll inside themselves) */
      'html.dgf-on.dg-fixed,html.dgf-on.dg-fixed body{overflow:hidden!important;overscroll-behavior:none}',
      /* measuring the lobby's real content height (see over()): no min-heights for one layout pass */
      'html.dgf-measure,html.dgf-measure body,html.dgf-measure .dgf-anc{min-height:0!important}',
      /* step 1: compact sponsor box and small print */
      'html.dgf-on .dgf-c1 .dgs-box{height:84px}',
      'html.dgf-on .dgf-c1 .homebelow{margin-top:10px!important}',
      'html.dgf-on .dgf-c1 .dgs-box{margin-bottom:0!important}',
      'html.dgf-on .dgf-c1 .snote{margin-top:8px!important;font-size:11px!important;line-height:1.35!important}',
      'html.dgf-on .dgf-c1 .mhint{margin-top:6px!important;font-size:12px!important;line-height:1.35!important}',
      'html.dgf-on .dgf-c1 .modes,html.dgf-on .dgf-c1 .d1-menu{margin-top:10px!important}',
      'html.dgf-on .dgf-c1 .mseg{margin-top:12px!important}',
      'html.dgf-on .dgf-c1 :is(.howlink,.how,.hhow,.d1-how){margin-top:4px!important}',
      /* step 3: the shortest phones */
      'html.dgf-on .dgf-c2 .dgs-box{height:70px}',
      'html.dgf-on .dgf-c2 .dgs-lg{width:40px;height:40px;border-radius:11px}',
      'html.dgf-on .dgf-c2 :is(.dtitle .kick,.dtitle>p,.dtitle>svg,.dtitle .eb,.d1-kick,.d1-tag,.hero .tag){display:none!important}',
      'html.dgf-on .dgf-c2 .mhint{font-size:11px!important;margin-top:4px!important}',
      'html.dgf-on .dgf-c2 .lang button{height:44px!important}',
      'html.dgf-on .dgf-c2 .snote{display:none!important}',
      'html.dgf-on .dgf-c2 .mseg button{height:44px!important}',
      'html.dgf-on main.dgf-c2{padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))!important}',
      'html.dgf-on .dgf-c2 .mseg{padding-top:3px!important;padding-bottom:3px!important}',
      /* step 4: the very smallest screens (iPhone SE 1st gen, 320 x 568): the mode's one-line rules summary goes (it is
         in How to play too), the More row loses its second line, tighter cards */
      'html.dgf-on .dgf-c3 .mhint{display:none!important}',
      'html.dgf-on .dgf-c3 .dgf-more{padding-top:10px;padding-bottom:10px}',
      'html.dgf-on .dgf-c3 .dgf-more small{display:none}',
      'html.dgf-on .dgf-c3 .lang button{min-height:44px!important;height:44px!important}',
      'html.dgf-on .dgf-c3 .modes{gap:8px}',
      'html.dgf-on .dgf-c3 .md{padding-top:10px;padding-bottom:10px}',
      'html.dgf-on .dgf-c3 .md.solo .row small{display:none}',
      'html.dgf-on .dgf-c3 .md.solo .two{margin-top:8px}',
      /* the "More" row and sheet */
      '.dgf-more{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:10px 0 0;padding:12px 16px;border:0;border-radius:18px;font:inherit;text-align:left;cursor:pointer;color:inherit;background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.8),0 8px 22px -16px rgba(60,40,90,.45);touch-action:manipulation}',
      '.dgf-more.dgf-dark{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}',
      '.dgf-more b{display:block;font-size:15px}.dgf-more small{display:block;font-size:12px;opacity:.7;margin-top:1px}',
      '.dgf-more span{flex:1;min-width:0}.dgf-more svg{width:18px;height:18px;flex:none;opacity:.55}',
      '.dgf-more:active{transform:scale(.98)}',
      '.dgf-more:focus-visible,.dgf-close:focus-visible{outline:2px solid currentColor;outline-offset:2px}',
      '.dgf-panel:focus{outline:none}',
      '.dgf-sheet{position:fixed;inset:0;z-index:880;visibility:hidden;pointer-events:none}',
      '.dgf-sheet.open{visibility:visible;pointer-events:auto}',
      '.dgf-scrim{position:absolute;inset:0;background:rgba(20,12,30,.42);opacity:0;transition:opacity .28s ease}',
      '.dgf-sheet.open .dgf-scrim{opacity:1}',
      '.dgf-panel{position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;box-sizing:border-box;max-height:calc(100% - 24px - env(safe-area-inset-top,0px));overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;border-radius:26px 26px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom,0px));background:var(--dgf-bg,#F7F2EA);color:var(--dgf-fg,inherit);box-shadow:0 -18px 40px -20px rgba(0,0,0,.4);transform:translate3d(0,104%,0);transition:transform .38s cubic-bezier(.2,.9,.3,1)}',
      '.dgf-sheet.open .dgf-panel{transform:translate3d(0,0,0)}',
      '.dgf-grab{width:40px;height:5px;border-radius:99px;background:currentColor;opacity:.2;margin:0 auto 10px}',
      '.dgf-panel h2{margin:2px 4px 12px;font-size:18px}',
      '.dgf-close{display:block;margin:14px auto 0;padding:11px 26px;border:0;border-radius:99px;font:inherit;font-weight:700;cursor:pointer;background:rgba(0,0,0,.07);color:inherit;touch-action:manipulation}',
      '.dgf-sheet.dgf-dark .dgf-close{background:rgba(255,255,255,.12)}',
      '@media (prefers-reduced-motion:reduce){.dgf-panel,.dgf-scrim{transition:none}}'
    ].concat(cfg.css || []).join('\n');
    (D.head || R).appendChild(s);
  })();

  function rgba(s) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?/.exec(s || ''); if (!m) return null;
    var a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4];
    return [+m[1], +m[2], +m[3], a];
  }
  function hex(s) { var m = /^#?([0-9a-f]{6})$/i.exec((s || '').trim()); if (!m) return null; var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }

  var root = null, sheet = null, ro = null, lastSH = -1, pend = 0, idleMark = null, on = false, lastW = 0, lastH = 0, lastFocus = null;
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  /* how much the lobby's CONTENT is taller than the screen (> 0 = it would scroll). The document's scrollHeight is
     useless here: it is never smaller than the screen, and html / body / #app carry min-height:100% or 100dvh, so the
     page always measured "exactly full". Those min-heights are switched off for the measurement (dgf-measure) and the
     bottom of <body> is read against innerHeight (the screen height right now = 100dvh). 4 px of slack: content that
     moves by a pixel or two (live counters, fonts) never flips. */
  function over() {
    var anc = [];
    for (var e = root; e && e !== D.body && e.nodeType === 1; e = e.parentElement) { e.classList.add('dgf-anc'); anc.push(e); }
    R.classList.add('dgf-measure');
    var o;
    try {
      var b = D.body.getBoundingClientRect(), mb = parseFloat(getComputedStyle(D.body).marginBottom) || 0;
      o = b.bottom + (W.scrollY || 0) + mb - W.innerHeight + 4;
    } finally {
      R.classList.remove('dgf-measure');
      anc.forEach(function (x) { x.classList.remove('dgf-anc'); });
    }
    return o;
  }
  function lobby() {
    var m = D.querySelector(cfg.mark); idleMark = null; if (!m) return null;
    var r = m.closest('main') || m.parentElement;
    if (r && r.getClientRects().length) return r;
    idleMark = m; return null;   /* lobby kept in the page but hidden (a game is on) */
  }
  /* refocus = the user closed it (Close, scrim, Escape): focus back on the More row. Not after a row's own action (that row
     may have opened its own sheet, which keeps the focus) or an automatic close. */
  function closeMore(refocus) {
    if (!sheet || !sheet.classList.contains('open')) return;
    sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    var b = root && root.querySelector('.dgf-more'); if (b) b.setAttribute('aria-expanded', 'false');
    if (refocus && lastFocus && lastFocus.isConnected) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }
  function openMore() {
    if (!sheet) return;
    lastFocus = (root && root.querySelector('.dgf-more')) || D.activeElement;   /* focus goes back to the More row on close */
    sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    var b = root && root.querySelector('.dgf-more'); if (b) b.setAttribute('aria-expanded', 'true');
    var c = sheet.querySelector('.dgf-panel'); if (c) { try { c.focus({ preventScroll: true }); } catch (e) {} }   /* focus into the sheet: Tab reaches its rows and Close */
  }
  /* sheet colours from the page: its background, text that reads on it */
  function paintSheet(btn) {
    var bg = rgba(getComputedStyle(D.body).backgroundColor);
    if (!bg || bg[3] < 0.5) bg = rgba(getComputedStyle(R).backgroundColor);
    if (!bg || bg[3] < 0.5) { var tm = D.querySelector('meta[name="theme-color"]'); bg = tm && hex(tm.content); }
    if (!bg || bg[3] < 0.5) bg = [247, 242, 234, 1];
    var dark = lum(bg) < 0.45, fg = rgba(getComputedStyle(root).color);
    sheet.style.setProperty('--dgf-bg', 'rgb(' + bg.slice(0, 3).join(',') + ')');
    if (fg && Math.abs(lum(fg) - lum(bg)) < 0.4) sheet.style.setProperty('--dgf-fg', dark ? '#F5F1EA' : '#241A22');
    else sheet.style.removeProperty('--dgf-fg');
    sheet.classList.toggle('dgf-dark', dark);
    if (btn) btn.classList.toggle('dgf-dark', lum(fg || [0, 0, 0]) > 0.6);   /* light text on the lobby = dark lobby */
  }
  function buildMore() {
    var m = cfg.more, first = null;
    m.items.forEach(function (s) { if (!first) first = root.querySelector(s); });
    if (!sheet || !root.contains(sheet)) {
      sheet = D.createElement('div');
      sheet.className = 'dgf-sheet';
      sheet.id = 'dgf-sheet-' + game;
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-hidden', 'true');
      sheet.innerHTML = '<div class="dgf-scrim"></div><div class="dgf-panel" tabindex="-1"><div class="dgf-grab"></div><h2></h2><div class="dgf-body"></div><button type="button" class="dgf-close">Close</button></div>';
      sheet.__dgfClose = function () { closeMore(true); };
      sheet.addEventListener('click', function (e) {
        if (e.target.classList.contains('dgf-scrim') || e.target.closest('.dgf-close')) { closeMore(true); return; }
        if (m.closeOnAction && e.target.closest('.dgf-body [data-a],.dgf-body a[href],.dgf-body button')) setTimeout(function () { closeMore(false); }, 0);
      });
      root.appendChild(sheet);
    }
    var btn = root.querySelector('.dgf-more');
    if (!btn && first) {
      btn = D.createElement('button'); btn.type = 'button'; btn.className = 'dgf-more';
      btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', sheet.id);
      btn.addEventListener('click', openMore);
      first.parentNode.insertBefore(btn, first);
    }
    var body = sheet.querySelector('.dgf-body');
    m.items.forEach(function (s) {
      var fresh = [].filter.call(root.querySelectorAll(s), function (el) { return !sheet.contains(el); });
      if (!fresh.length) return;
      [].forEach.call(body.querySelectorAll(s), function (old) { if (old.parentNode === body) body.removeChild(old); });
      fresh.forEach(function (el) {
        /* a placeholder where the row was, so it can go back when the window stops being phone-sized */
        var ph = D.createComment('dgf'); el.parentNode.insertBefore(ph, el); el.__dgfPh = ph;
        body.appendChild(el);
      });
    });
    (m.hide || []).forEach(function (s) { [].forEach.call(root.querySelectorAll(s), function (el) { if (el.style.display !== 'none') { el.__dgfDisp = el.style.display; el.style.display = 'none'; } }); });
    /* labels: from the moved content when it has a heading (so the quiz's Dhivehi mode stays in Dhivehi) */
    var t = m.title, sub = m.sub, h = m.titleFrom && sheet.querySelector(m.titleFrom);
    if (h) { var c = h.cloneNode(true); [].forEach.call(c.querySelectorAll('span'), function (x) { x.remove(); }); t = c.textContent.trim() || t; if (/[ހ-޿]/.test(t)) sub = ''; }
    sheet.querySelector('h2').textContent = t; sheet.setAttribute('aria-label', t);
    if (btn) btn.innerHTML = '<span><b></b>' + (sub ? '<small></small>' : '') + '</span>' + CHEV;
    if (btn) { btn.querySelector('b').textContent = t; if (sub) btn.querySelector('small').textContent = sub; }
    var lang = root.getAttribute('lang'); if (lang) sheet.querySelector('.dgf-panel').setAttribute('lang', lang);
    paintSheet(btn);
  }
  /* the window is no longer phone-sized: every moved row back in its place, nothing of ours left in the page */
  function unbuildMore(r) {
    if (sheet) {
      [].slice.call(sheet.querySelectorAll('.dgf-body > *')).forEach(function (el) {
        var ph = el.__dgfPh;
        if (ph && ph.parentNode) ph.parentNode.replaceChild(el, ph);
        else el.remove();   /* its old place was re-rendered by the page: the page already drew a fresh copy */
        el.__dgfPh = null;
      });
      if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
      sheet = null;
    }
    if (r) {
      [].forEach.call(r.querySelectorAll('.dgf-more'), function (b) { b.remove(); });
      ((cfg.more && cfg.more.hide) || []).forEach(function (s) { [].forEach.call(r.querySelectorAll(s), function (el) { if (el.__dgfDisp != null) { el.style.display = el.__dgfDisp; el.__dgfDisp = null; } }); });
    }
  }
  /* the title's negative top margin (it overlaps the hero's bottom edge): scaled with the hero's zoom z, cleared with null */
  function pull(z) {
    if (!cfg.pull || !root) return; var t = root.querySelector(cfg.pull); if (!t) return;
    if (z == null) { t.style.marginTop = ''; t.__dgfMt = null; return; }
    var base = t.__dgfMt; if (base == null) { t.style.marginTop = ''; base = t.__dgfMt = parseFloat(getComputedStyle(t).marginTop) || 0; }
    t.style.marginTop = base < 0 ? (base * z).toFixed(1) + 'px' : '';
  }
  function clipArt(z) {
    if (!cfg.clip || !root) return; var h = root.querySelector(cfg.decor[0][0]);
    [].forEach.call(D.querySelectorAll(cfg.clip), function (el) {
      if (z == null || !h || z >= 1) { el.style.height = ''; return; }
      el.style.height = Math.max(0, Math.round(h.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 24)) + 'px';
    });
  }
  function goneArt(hide) { (cfg.gone || []).forEach(function (s) { [].forEach.call(D.querySelectorAll(s), function (el) { el.style.display = hide ? 'none' : ''; }); }); }   /* page-wide: the art can sit outside the lobby's <main> */
  function reset(r) {
    r.classList.remove('dgf-c1', 'dgf-c2', 'dgf-c3', 'dgf-nohero', 'dgf-fits');
    cfg.decor.forEach(function (d) { var e = r.querySelector(d[0]); if (e) { e.style.zoom = ''; e.style.display = ''; } });
    var keep = root; root = r; pull(null); clipArt(null); root = keep;
    goneArt(false);
  }
  /* shrink the decorative parts (in order) until the page fits; k scales each part's smallest zoom */
  function shrink(o, k) {
    for (var i = 0; i < cfg.decor.length && o > 0; i++) {
      var e = root.querySelector(cfg.decor[i][0]), min = cfg.decor[i][1] * k;
      if (!e || e.style.display === 'none') continue;
      for (var n = 0; n < 4 && o > 0; n++) {
        var z = +(e.style.zoom || 1), hgt = e.getBoundingClientRect().height;
        if (!hgt) break;
        var nz = Math.max(min, z * (hgt - o - 2) / hgt);
        if (nz >= z - 0.004) break;
        e.style.zoom = nz.toFixed(3); if (i === 0) { pull(nz); clipArt(nz); } o = over();
      }
      if (o > 0 && cfg.decor[i][2] && +e.style.zoom <= min + 0.001) {
        e.style.display = 'none';
        if (i === 0) { pull(0); goneArt(true); root.classList.add('dgf-nohero'); }
        o = over();
      }
    }
    return o;
  }
  function fit(again) {
    if (!root) return;
    R.classList.add('dg-fixed');
    reset(root);
    if (cfg.more) buildMore();
    var o = over();
    if (o > 0) { root.classList.add('dgf-c1'); o = shrink(over(), 1); }
    if (o > 0) { root.classList.add('dgf-c2'); o = shrink(over(), 0.84); }
    if (o > 0) { root.classList.add('dgf-c3'); o = over(); }
    var ok = o <= 0;
    R.classList.toggle('dg-fixed', ok);
    root.classList.toggle('dgf-fits', ok);
    if (ok && W.scrollY) W.scrollTo(0, 0);   /* a fixed screen starts at the top; a scrolling one keeps its place */
    lastSH = (D.scrollingElement || R).scrollHeight;
    lastW = W.innerWidth; lastH = W.innerHeight;
    /* zoom changes can settle a frame late in WebKit: check again once painted, re-fit if it no longer fits */
    if (!again) requestAnimationFrame(function () { if (root && on && over() > 0) fit(true); });
  }
  function release() {
    if (ro) { ro.disconnect(); ro = null; }
    closeMore();
    var r = root || (D.querySelector(cfg.mark) && lobby());
    if (r) { reset(r); }
    unbuildMore(r || D);
    root = null;
    R.classList.remove('dg-fixed', 'dgf-on');
  }
  function check() {
    pend = 0;
    var want = phone();
    if (!want) { if (on) { on = false; release(); W.dispatchEvent(new Event('dg:screen')); } return; }
    if (!on) { on = true; R.classList.add('dgf-on'); root = null; }
    R.classList.add('dgf-on');
    var r = lobby();
    if (r !== root) {
      if (ro) { ro.disconnect(); ro = null; }
      if (root && root !== r) { closeMore(); reset(root); }
      root = r; closeMore();
      if (root) {
        fit();
        if (W.ResizeObserver) { ro = new ResizeObserver(function () { if (root && Math.abs((D.scrollingElement || R).scrollHeight - lastSH) > 2) soon(); }); ro.observe(root); }
      } else R.classList.remove('dg-fixed');
      W.dispatchEvent(new Event('dg:screen'));
    } else if (root && ((cfg.more && !(sheet && root.contains(sheet) && root.querySelector('.dgf-more'))) || Math.abs((D.scrollingElement || R).scrollHeight - lastSH) > 2)) fit();
  }
  function soon() { if (!pend) pend = setTimeout(check, 80); }
  function typing() { var a = D.activeElement; return !!(a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))); }
  /* window size changes: a new width (rotation, resize) or crossing the phone limit = start over. A height-only change is
     Safari's address bar or the keyboard: re-fit only a screen that is fixed (it cannot scroll, so nothing moves under a
     finger); a page that scrolls keeps its layout. Pinch-zoom (visualViewport scale) never re-fits. */
  function resized() {
    if (W.visualViewport && W.visualViewport.scale > 1.01) return;
    var w = W.innerWidth, h = W.innerHeight;
    if (on !== phone() || !on) { root = null; soon(); return; }
    if (w !== lastW) { root = null; soon(); return; }
    if (Math.abs(h - lastH) < 2) return;
    if (APP) { root = null; soon(); return; }   /* the app's screen height only changes with the keyboard / rotation */
    if (typing()) return;
    if (root && !root.classList.contains('dgf-fits')) return;
    root = null; soon();
  }
  /* the lobby appearing is handled before the next paint (no jump from full size to fitted); everything else is batched */
  if (phone()) { on = true; R.classList.add('dgf-on'); }
  new MutationObserver(function () {
    if (!on) return;   /* desktop / tablet: nothing to do until the window becomes phone-sized */
    if (!root && !pend) { var m = D.querySelector(cfg.mark); if (m && m !== idleMark) { check(); return; } }
    soon();
  }).observe(R, { childList: true, subtree: true });
  W.addEventListener('resize', resized);
  if (W.visualViewport) W.visualViewport.addEventListener('resize', resized);
  if (mq) { var mqf = function () { root = null; soon(); }; if (mq.addEventListener) mq.addEventListener('change', mqf); else if (mq.addListener) mq.addListener(mqf); }
  W.addEventListener('pageshow', function (e) { if (e.persisted) { root = null; soon(); } });
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && sheet.classList.contains('open')) { closeMore(true); e.stopImmediatePropagation(); } }, true);
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { root = null; soon(); });
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', soon); else soon();
  W.__dgFit = { refit: function () { root = null; check(); }, open: openMore, close: function () { closeMore(true); },
    state: function () { return { on: on, root: !!root, fixed: R.classList.contains('dg-fixed'), over: root ? over() : null }; } };
})();
