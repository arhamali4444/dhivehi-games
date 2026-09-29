/* Dhivehi Games - the ONE sponsor list for the whole site (window.DGSponsors). No dependencies.
   Include with <script src="/shared/sponsors.js"></script> (or ../shared/sponsors.js from a game folder).

   EDIT THE LIST BELOW to add or change ads. Fields:
     title, sub : text          cta  : button text ('' = no button)
     url        : where a tap goes ('' = nowhere). Relative links are relative to the SITE ROOT (e.g. 'digu/').
     logo       : 2-3 letters or an emoji, or an image path/URL (site-root relative or https://)
     colors     : three gradient colours           label: 'Sponsored' for paid ads ('Advertise', 'New', ...)
     felt       : true ONLY for real paid sponsors. Those (and only those) are printed on the Digu table
                  felt and credited as "Hand sponsored by ...". Default false: placeholders and house
                  promos never appear on the felt. With no felt:true entries, house promos show instead.
     house      : true for our own game promos (shown on the felt only while there is no paid sponsor)
     kicker     : short word shown before the title on the table line for house promos ('Coming soon', 'Try')

   API
     DGSponsors.list            the array above (read only)
     DGSponsors.AD_MS           ms each slide stays up
     DGSponsors.box(el)         renders the homepage "ripple reveal" sponsor box INTO el (any block element;
                                it gets class dgs-box). Swipe left/right, press-and-hold pauses, story bars,
                                iris reveal from the button. Returns {show(i), destroy()}.
     DGSponsors.felt(n)         the n-th felt:true sponsor (cycles), or null when there are none
     DGSponsors.logoHTML(s)     <span class="dgs-lg"> with the logo image or letters
     DGSponsors.href(s)         resolved url ('' when none)
     DGSponsors.injectCSS()     adds the CSS once (done automatically by box())
*/
(function (root) {
  'use strict';
  var SPONSORS = [
    { title: 'Your brand here', sub: 'The main sponsor spot on Dhivehi Games', cta: '', url: '', logo: 'DG', colors: ['#0E4C6B', '#1E8A8A', '#E9C476'], label: 'Advertise' },
    { title: 'Binveriya', sub: 'Own the islands. Bend the rules.', cta: 'Play', url: 'binveriya/', logo: 'BV', colors: ['#0A6E8C', '#1BA7BF', '#F2C94C'], label: 'New', house: true, kicker: 'New' },
    { title: 'Bondi', sub: 'Noir card duel. Don\'t be the last one holding.', cta: 'Play', url: 'bondi/', logo: '♠', colors: ['#0B0B0D', '#2A2A30', '#C9A45C'], label: 'New', house: true, kicker: 'New' },
    { title: 'Digu Blitz', sub: '5 players, 5 seconds a turn. Keep up?', cta: 'Play', url: 'digu/', logo: '⚡', colors: ['#6A2C1A', '#C4552C', '#F2B35B'], label: 'New', house: true, kicker: 'Try' },
    { title: 'Dhogu is online', sub: 'Spot the lie with friends, any network', cta: 'Play', url: 'dhogu/', logo: '?', colors: ['#1B1B3A', '#4B3AA8', '#E68AB8'], label: 'New', house: true, kicker: 'Now online' }
  ];
  var AD_MS = 5000;

  var doc = root.document;
  var reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* site root = the folder above /shared/ where this file lives */
  var BASE = (function () { try { var s = doc.currentScript && doc.currentScript.src; if (s) return new URL('../', s).href; } catch (e) { } return root.location ? root.location.origin + '/' : '/'; })();
  function abs(u) { u = String(u || ''); if (!u) return ''; if (/^(https?:|data:|mailto:|tel:)/i.test(u)) return u; try { return new URL(u.replace(/^\//, ''), BASE).href; } catch (e) { return u; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var isImg = function (l) { return /^(https?:|data:|\/|\.|[\w-]+\/)/.test(l || '') || /\.(png|jpe?g|webp|svg|gif)$/i.test(l || ''); };
  function logoHTML(s, cls) {
    var c = (s.colors || ['#0E4C6B'])[0];
    return '<span class="dgs-lg' + (cls ? ' ' + cls : '') + '" style="color:' + esc(c) + '">' + (isImg(s.logo) ? '<img src="' + esc(abs(s.logo)) + '" alt="">' : esc(s.logo || '')) + '</span>';
  }
  var CSS = [
    '.dgs-box{position:relative;height:118px;border-radius:22px;overflow:hidden;isolation:isolate;background:#0E4C6B;box-shadow:0 18px 30px -18px rgba(11,59,43,.55);touch-action:pan-y;user-select:none;-webkit-user-select:none}',
    '.dgs-ad{position:absolute;inset:0;color:#fff;display:flex;align-items:center;gap:12px;padding:0 16px;text-decoration:none;clip-path:circle(140% at 86% 50%);-webkit-tap-highlight-color:transparent}',
    '.dgs-ad:focus-visible{outline:2px solid #fff;outline-offset:-4px}',
    '.dgs-ad.dgs-in{animation:dgs-iris .95s cubic-bezier(.6,0,.2,1) both}',
    '@keyframes dgs-iris{from{clip-path:circle(0% at 86% 50%)}to{clip-path:circle(140% at 86% 50%)}}',
    '.dgs-lg{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;font:900 18px/1 Fraunces,Georgia,serif;background:#fff;flex:none;overflow:hidden}',
    '.dgs-lg img{width:100%;height:100%;object-fit:cover;display:block}',
    '.dgs-tx{min-width:0}',
    '.dgs-ad b{display:block;font-size:15px;line-height:1.15}.dgs-ad small{display:block;font-size:11.5px;opacity:.92;line-height:1.3}',
    '.dgs-go{margin-left:auto;background:#fff;font-weight:800;font-size:12px;padding:8px 13px;border-radius:99px;flex:none}',
    '.dgs-lab{position:absolute;right:10px;bottom:8px;font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;background:rgba(0,0,0,.3);padding:3px 7px;border-radius:99px}',
    '.dgs-ad.dgs-in .dgs-lg,.dgs-ad.dgs-in .dgs-tx,.dgs-ad.dgs-in .dgs-go{animation:dgs-pop .7s cubic-bezier(.16,1,.3,1) both}',
    '.dgs-ad.dgs-in .dgs-lg{animation-delay:.35s}.dgs-ad.dgs-in .dgs-tx{animation-delay:.43s}.dgs-ad.dgs-in .dgs-go{animation-delay:.51s}',
    '@keyframes dgs-pop{from{opacity:0;transform:translateY(12px) scale(.94)}}',
    '.dgs-rip{position:absolute;right:calc(14% - 40px);top:50%;width:80px;height:80px;margin-top:-40px;border-radius:50%;z-index:50;pointer-events:none;box-shadow:0 0 0 2px rgba(255,255,255,.85);opacity:0}',
    '.dgs-rip.dgs-go2{animation:dgs-ring 1.2s cubic-bezier(.2,.8,.2,1)}',
    '@keyframes dgs-ring{from{transform:scale(.2);opacity:.9}to{transform:scale(5);opacity:0}}',
    '.dgs-bars{position:absolute;left:12px;right:12px;top:8px;display:flex;gap:4px;z-index:60;pointer-events:none}',
    '.dgs-bars i{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,.35);overflow:hidden}',
    '.dgs-bars i:before{content:"";display:block;height:100%;background:#fff;transform-origin:left;transform:scaleX(var(--f,0))}',
    '.dgs-bars i.dgs-run:before{animation:dgs-fill var(--dur,5s) linear both}',
    '.dgs-box.dgs-hold .dgs-bars i.dgs-run:before{animation-play-state:paused}',
    '@keyframes dgs-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
    '@media (prefers-reduced-motion:reduce){.dgs-box *{animation:none!important}}'
  ].join('\n');
  function injectCSS() {
    if (!doc || doc.getElementById('dgs-css')) return;
    var st = doc.createElement('style'); st.id = 'dgs-css'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
  }
  function box(el) {
    if (!el) throw new Error('DGSponsors.box: container element required');
    injectCSS();
    el.classList.add('dgs-box'); el.innerHTML = '';
    el.setAttribute('aria-roledescription', 'carousel'); if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Sponsors');
    var bars = doc.createElement('div'); bars.className = 'dgs-bars'; bars.setAttribute('aria-hidden', 'true');
    var rip = doc.createElement('span'); rip.className = 'dgs-rip'; rip.setAttribute('aria-hidden', 'true');
    el.appendChild(bars); el.appendChild(rip);
    var ai = 0, az = 1, adT = 0, adStart = 0, adLeft = AD_MS, dead = false, drag = null, swiped = 0;
    var ads = SPONSORS.map(function (s) {
      var u = abs(s.url), a = doc.createElement(u ? 'a' : 'div'); a.className = 'dgs-ad'; if (u) { a.href = u; if (/^https?:/i.test(s.url || '')) { a.target = '_blank'; a.rel = 'noopener sponsored'; } }
      var c = s.colors || ['#0E4C6B', '#1E8A8A', '#E9C476'];
      a.style.background = 'linear-gradient(120deg,' + c[0] + ',' + c[1] + ' 60%,' + c[2] + ')';
      a.innerHTML = logoHTML(s) + '<span class="dgs-tx"><b>' + esc(s.title) + '</b><small>' + esc(s.sub) + '</small></span>' + (s.cta ? '<span class="dgs-go" style="color:' + esc(c[0]) + '">' + esc(s.cta) + '</span>' : '') + '<span class="dgs-lab">' + esc(s.label || 'Sponsored') + '</span>';
      a.setAttribute('aria-label', s.title + '. ' + s.sub); el.insertBefore(a, rip); return a;
    });
    bars.innerHTML = ads.length > 1 ? ads.map(function () { return '<i></i>'; }).join('') : '';
    var barEls = Array.prototype.slice.call(bars.children);
    function schedule(ms) { clearTimeout(adT); if (dead || ads.length < 2 || reduce) return; adLeft = ms; adStart = Date.now(); adT = setTimeout(function () { if (doc.hidden) { schedule(AD_MS); return; } show(ai + 1); }, ms); }
    function show(n, first) {
      if (!ads.length) return;
      ai = ((n % ads.length) + ads.length) % ads.length; var a = ads[ai]; a.style.zIndex = String(++az);
      ads.forEach(function (x, i) { if (i !== ai) { x.tabIndex = -1; x.setAttribute('aria-hidden', 'true'); } });
      a.removeAttribute('aria-hidden'); a.tabIndex = 0;
      if (!first && !reduce) { a.classList.remove('dgs-in'); void a.offsetWidth; a.classList.add('dgs-in'); rip.classList.remove('dgs-go2'); void rip.offsetWidth; rip.classList.add('dgs-go2'); }
      barEls.forEach(function (b, i) { b.classList.remove('dgs-run'); b.style.setProperty('--f', i < ai ? 1 : 0); });
      if (barEls[ai]) { void barEls[ai].offsetWidth; barEls[ai].style.setProperty('--dur', AD_MS + 'ms'); barEls[ai].classList.add('dgs-run'); }
      schedule(AD_MS);
    }
    function down(e) { drag = { x: e.clientX, id: e.pointerId, moved: false }; el.classList.add('dgs-hold'); clearTimeout(adT); adLeft = Math.max(300, adLeft - (Date.now() - adStart)); }
    function move(e) { if (drag && e.pointerId === drag.id && Math.abs(e.clientX - drag.x) > 8) drag.moved = true; }
    function up(e) { if (!drag) return; var dx = e.clientX - drag.x, m = drag.moved; drag = null; el.classList.remove('dgs-hold'); if (m) swiped = Date.now(); if (m && Math.abs(dx) > 40) { show(ai + (dx < 0 ? 1 : -1)); return; } schedule(adLeft); }
    function click(e) { if (Date.now() - swiped < 400) { e.preventDefault(); e.stopPropagation(); } }
    function key(e) { if (e.key === 'ArrowRight') { show(ai + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { show(ai - 1); e.preventDefault(); } }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('click', click, true); el.addEventListener('keydown', key);
    show(0, true);
    return {
      show: function (i) { show(i); },
      destroy: function () { dead = true; clearTimeout(adT); el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('click', click, true); el.removeEventListener('keydown', key); el.innerHTML = ''; el.classList.remove('dgs-box', 'dgs-hold'); }
    };
  }
  /* paid sponsors (felt:true) own the table; with none, our own game promos (house:true) fill it instead */
  function feltList() { var paid = SPONSORS.filter(function (s) { return s.felt === true; }); return paid.length ? paid : SPONSORS.filter(function (s) { return s.house === true; }); }
  root.DGSponsors = {
    version: 1,
    list: SPONSORS,
    AD_MS: AD_MS,
    box: box,
    felt: function (n) { var l = feltList(); return l.length ? l[((n | 0) % l.length + l.length) % l.length] : null; },
    logoHTML: logoHTML,
    href: function (s) { return abs(s && s.url); },
    injectCSS: injectCSS
  };
})(typeof window !== 'undefined' ? window : this);
