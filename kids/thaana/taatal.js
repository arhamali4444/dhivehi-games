// dhivehi-games/kids/thaana/taatal.js
// Miss Taatal: four picture layers moved with CSS transforms (head, flipper+stick and mouth on a body).
const css = `
.tt-root{position:absolute;left:50%;bottom:0;transform-origin:var(--fx) var(--fy);will-change:transform}
.tt-root>*{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
.tt-head,.tt-arm{will-change:transform}
.tt-lid{position:absolute;border-radius:50%;overflow:hidden}
.tt-lid i{position:absolute;inset:0;background:linear-gradient(var(--skin-d),var(--skin));clip-path:inset(0 0 100% 0)}
.tt-lid svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;opacity:0}
`;

const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');

export async function createTaatal(el, base) {
  const res = await fetch(base + 'rig.json');
  if (!res.ok) throw new Error('Taatal rig.json: HTTP ' + res.status);
  const rig = await res.json();
  if (!document.getElementById('tt-css')) { const s = document.createElement('style'); s.id = 'tt-css'; s.textContent = css; document.head.append(s); }
  el.style.position = el.style.position || 'relative';
  const pct = (v, d) => (v / d * 100) + '%';
  // she fills the box's height and keeps her shape, so she resizes with the screen (rotate, iPad)
  el.innerHTML = `<div class="tt-root" style="height:100%;max-width:100%;aspect-ratio:${rig.w}/${rig.h};translate:-50% 0;--fx:${pct(rig.feet[0], rig.w)};--fy:${pct(rig.feet[1], rig.h)};--skin:${rig.skin};--skin-d:${shade(rig.skin, 0.86)}">
    <img class="tt-body" src="${base}body.webp" alt="">
    <div class="tt-arm" style="transform-origin:${pct(rig.arm[0], rig.w)} ${pct(rig.arm[1], rig.h)}"><img src="${base}arm.webp" alt="" style="width:100%;height:100%"></div>
    <div class="tt-head" style="transform-origin:${pct(rig.head[0], rig.w)} ${pct(rig.head[1], rig.h)}">
      <img src="${base}head.webp" alt="" style="position:absolute;width:100%;height:100%">
      <img class="tt-mouth" src="${base}mouth.webp" alt="" style="position:absolute;width:100%;height:100%;transform-origin:50% ${pct(rig.topLip, rig.h)}">
      ${rig.eyes.map(([cx, cy, rx, ry]) => { const ex = 0.85 * rx;
        return `<span class="tt-lid" style="left:${pct(cx - rx, rig.w)};top:${pct(cy - ry, rig.h)};width:${pct(2 * rx, rig.w)};height:${pct(2 * ry, rig.h)}"><i></i><svg viewBox="0 0 ${2 * rx} ${2 * ry}" preserveAspectRatio="none"><path d="M${rx - ex} -3A${ex} 14 0 0 0 ${rx + ex} -3" fill="none" stroke="#2d2020" stroke-width="4.5" stroke-linecap="round"/></svg></span>`; }).join('')}
    </div></div>`;
  el.setAttribute('aria-hidden', 'true');
  const $ = s => el.querySelector(s);
  const root = $('.tt-root');
  el.querySelectorAll('img').forEach(i => i.addEventListener('error', () => { root.style.visibility = 'hidden'; }));   // a missing layer: hide her rather than show half of her
  const head = $('.tt-head'), arm = $('.tt-arm'), mouth = $('.tt-mouth'), lids = [...el.querySelectorAll('.tt-lid')].map(l => ({ cover: l.querySelector('i'), lash: l.querySelector('svg') }));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1;
  let scale = 1;                                   // screen px per rig px, kept current on resize
  new ResizeObserver(() => { scale = root.clientHeight / rig.h || 1; }).observe(root);

  let state = 'idle', until = 0, t0 = performance.now(), paused = false, nextBlink = 1500, blinkAt = -1, raf = 0, pausedAt = 0;
  const set = (s, ms) => { state = s; until = ms ? now() + ms : 0; t0 = now(); el.dataset.state = s; };
  const now = () => performance.now();

  function frame() {
    if (paused) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const t = (now() - t0) / 1000, T = now() / 1000;
    if (until && now() > until) set(state === 'sing' ? 'sing' : 'idle');
    let hd = 3 * Math.sin(T * 2.1), ad = 5 * Math.sin(T * 3), m = 1, lift = 0, sq = 1 + 0.01 * Math.sin(T * 4.2), spin = 0, sway = 0, lid = 0;
    if (state === 'talk') m = 0.45 + 0.55 * Math.abs(Math.sin(t * 9.5)) * (0.65 + 0.35 * Math.sin(t * 2.7));
    if (state === 'cheer') { const x = Math.min(1, t / 1.5); const k = Math.max(0, Math.min(1, (x - 0.18) / 0.54));
      lift = x > 0.18 && x < 0.72 ? 110 * Math.sin(Math.PI * k) * scale : 0; hd = -5 * Math.sin(Math.PI * x); ad = -12 * Math.sin(Math.PI * x); spin = -5 * Math.sin(2 * Math.PI * x);
      sq = x < 0.18 ? 1 - 0.07 * Math.sin(Math.PI * x / 0.36) : x > 0.72 ? 1 - 0.07 * Math.sin(Math.PI * (x - 0.72) / 0.28) : 1.02; }
    if (state === 'oops') { const x = Math.min(1, t / 0.5); hd = 7 * x; ad = 4 * x; m = 1 - 0.45 * x; }
    if (state === 'sing') { hd = 5 * Math.sin(t * 3.6); ad = -7 * Math.sin(t * 3.6); m = 0.6 + 0.4 * Math.abs(Math.sin(t * 4.6)); spin = 3 * Math.sin(t * 3.6); sway = 14 * scale * Math.sin(t * 3.6); lid = 1; }
    if (state === 'point') { ad = -10 * Math.min(1, t / 0.4); }
    if (state === 'nap') { hd = 6; ad = 6; lid = 1; m = 0.5; sq = 1 + 0.02 * Math.sin(T * 1.6); }
    // blink every 3–5 s (not while singing or napping)
    if (!lid) { const ms = now(); if (blinkAt < 0 && ms > nextBlink) blinkAt = ms; if (blinkAt >= 0) { const k = (ms - blinkAt) / 220; lid = k < 1 ? Math.sin(Math.PI * k) : 0; if (k >= 1) { blinkAt = -1; nextBlink = ms + 3000 + Math.random() * 2000; } } }
    root.style.transform = `translate(${sway}px,${-lift * calm}px) rotate(${spin * calm}deg) scale(${2 - sq},${sq})`;
    head.style.transform = `rotate(${-hd * calm}deg)`;
    arm.style.transform = `rotate(${-ad * calm}deg)`;
    mouth.style.transform = `scaleY(${m})`;
    lids.forEach(({ cover, lash }) => {
      cover.style.clipPath = `inset(0 0 ${(1 - lid) * 100}% 0)`;
      lash.style.opacity = lid > 0.02 ? 1 : 0;
      lash.style.transform = `translateY(${Math.min(lid, 0.62) * 100}%)`;
    });
  }
  set('idle'); raf = requestAnimationFrame(frame);
  return {
    get state() { return state; },
    talk(ms) { set('talk', ms); },
    cheer() { set('cheer', 1500); },
    oops() { set('oops', 1500); },
    point() { set('point', 1200); },
    sing(on) { set(on ? 'sing' : 'idle'); },
    nap(on) { set(on ? 'nap' : 'idle'); },
    pause(on) {   // paused: no frames at all (her screen is not shown, or the app is hidden)
      on = !!on; if (on === paused) return;
      if (on) { pausedAt = now(); cancelAnimationFrame(raf); raf = 0; }
      else { const d = now() - pausedAt; t0 += d; if (until) until += d; nextBlink += d; if (blinkAt >= 0) blinkAt += d; }
      paused = on; el.dataset.paused = on ? '1' : '';
      if (!on && !raf) raf = requestAnimationFrame(frame);
    },
  };
}
