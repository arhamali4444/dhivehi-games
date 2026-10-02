// dhivehi-games/kids/thaana/taatal3.js
// Miss Taatal from the owner's painted poses (poses/*.webp + poses.json). One <img> per pose (only the current one
// shows; a ~120 ms crossfade and a little squash on each swap), lined up on one floor point so she never jumps
// sideways when the pose changes. One requestAnimationFrame loop moves her with transforms only (bob, hops, flops,
// spins), a floor shadow shrinks when she jumps, and a canvas over her screen draws the magic (sparkles, stars,
// confetti, balloons, dizzy stars, dust, speed lines, music notes) from a fixed pool of particles.
// Same API as taatal.js (state, talk, cheer, oops, point, sing, nap, pause) plus wave, getUp, dance, celebrate,
// shellSpin, run, ball and pose (a test hook). Only the teach pose has her stick.
// v2 art (2 Oct): happy/wave hello, seven cheers (never the same twice running), a stumble-fall-get-up sequence,
// dance + laughs while humming, party jumps after an island, three roll frames in the shell spin (picked by the spin
// angle, so her back shows when she's turned away) and a 4-frame beach walk between islands. Teach, balloon and
// ball are still the old pictures (no new art yet).
const css = `
.tt3{position:relative}
.tt3 .tt-root{position:absolute;left:0;top:0;width:100%;height:100%;will-change:transform;pointer-events:none}
.tt3 .tt-root img{position:absolute;left:0;top:0;opacity:0;transition:opacity .12s linear;pointer-events:none;-webkit-user-drag:none}
.tt3 .tt-root img.on{opacity:1}
.tt3 .tt-root img.cut{transition:none}
.tt3 .tt-shadow{position:absolute;left:0;top:0;border-radius:50%;background:radial-gradient(closest-side,rgba(20,60,70,.34),rgba(20,60,70,.16) 60%,rgba(20,60,70,0));pointer-events:none;will-change:transform,opacity}
.tt-fx{pointer-events:none;z-index:4}
`;
export const CHEERS = ['cheer-1', 'cheer-2', 'cheer-3', 'cheer-4', 'clap', 'jump', 'jump-wave'];
export const HUM = ['dance', 'laugh-1', 'laugh-2', 'dance', 'laugh-3', 'laugh-4'];        // humming: one picture per slow beat
export const PARTY = ['party-1', 'party-2', 'party-3', 'party-4'];
export const WALK = ['walk-1', 'walk-2', 'walk-3', 'walk-4'];
export const POSES = ['happy', 'wave', 'teach', ...CHEERS, 'oops', 'fall', 'flat', 'getup-1', 'getup-2', 'getup-3',
  'dance', 'laugh-1', 'laugh-2', 'laugh-3', 'laugh-4', ...PARTY, 'spin-1', 'spin-2', 'spin-3', ...WALK, 'balloon', 'ball', 'main'];
const CORE = ['happy', 'cheer-1', 'oops', 'getup-3'];               // plus teach (or main, the old picture with the stick)
// a pose that failed to load is swapped for a close one
const FALL = { teach: 'main', main: 'teach', wave: 'happy', happy: 'wave', 'cheer-1': 'happy', 'cheer-2': 'cheer-1', 'cheer-3': 'cheer-1',
  'cheer-4': 'cheer-1', clap: 'cheer-1', jump: 'jump-wave', 'jump-wave': 'cheer-1', oops: 'getup-3', fall: 'oops', flat: 'fall',
  'getup-1': 'flat', 'getup-2': 'getup-3', 'getup-3': 'happy', dance: 'happy', 'laugh-1': 'dance', 'laugh-2': 'laugh-1', 'laugh-3': 'laugh-1',
  'laugh-4': 'laugh-1', 'party-1': 'jump', 'party-2': 'party-1', 'party-3': 'party-1', 'party-4': 'party-1', 'spin-1': 'cheer-1',
  'spin-2': 'spin-1', 'spin-3': 'spin-2', 'walk-1': 'happy', 'walk-2': 'walk-1', 'walk-3': 'walk-1', 'walk-4': 'walk-2', balloon: 'happy', ball: 'happy' };
const STAND = 0.84, FLOOR = 0.97;          // a standing pose is 84% of the box tall; the floor is 3% above the box bottom

const jsonCache = new Map();               // poses.json is fetched once per page, however many Taatals there are
function loadMeta(base) {
  if (!jsonCache.has(base)) jsonCache.set(base, fetch(base + 'poses.json').then(r => { if (!r.ok) throw new Error('poses.json: HTTP ' + r.status); return r.json(); })
    .catch(e => { jsonCache.delete(base); throw e; }));
  return jsonCache.get(base);
}
function loaded(img) {
  return new Promise(res => {
    const ok = () => { (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(true)); };
    if (img.complete && img.naturalWidth) ok(); else { img.onload = ok; img.onerror = () => res(false); }
  });
}

// ---------- particles (a fixed pool: nothing is allocated while she moves) ----------
const N = 240;
const COLS = { spark: ['#FFD65C', '#FFFFFF', '#FFAAD2', '#8CE6FF'], star: ['#FFCD3C', '#FF78AA', '#78C8FF', '#96EBA0'],
  conf: ['#FF6E8C', '#FFC446', '#6EBEFF', '#96DC8C', '#BE96FF'], balloon: ['#FF6E8C', '#FFC446', '#6EBEFF', '#96DC8C', '#BE96FF'] };
function makePool() { const a = []; for (let i = 0; i < N; i++) a.push({ on: false, k: '', x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, r: 1, c: '', rot: 0, vr: 0, ph: 0 }); return a; }

export async function createTaatal3(el, base, { sfx = null, rest = 'teach', ballEvery = 0 } = {}) {
  const meta = await loadMeta(base);
  const P = meta.poses;
  if (!document.getElementById('tt3-css')) { const s = document.createElement('style'); s.id = 'tt3-css'; s.textContent = css; document.head.append(s); }
  el.classList.add('tt3'); el.setAttribute('aria-hidden', 'true');
  const names = POSES.filter(n => P[n]);                            // pose names come from our own fixed list
  el.innerHTML = `<div class="tt-shadow"></div><div class="tt-root">${names.map(n => `<img data-pose="${n}" src="${base}${n}.webp" alt="" draggable="false" decoding="async">`).join('')}</div>`;
  const root = el.querySelector('.tt-root'), shadow = el.querySelector('.tt-shadow'), img = {}, have = {}, wait = {};
  root.querySelectorAll('img').forEach(i => { img[i.dataset.pose] = i; });
  // every pose loads; she starts once the ones she can't do without are in (the rest fall back to a close pose)
  for (const n of names) wait[n] = loaded(img[n]).then(ok => { have[n] = ok; if (!ok) { img[n].remove(); delete img[n]; } return ok; });
  const got = n => wait[n] || Promise.resolve(false);
  const coreOk = (await Promise.all(CORE.map(got))).every(Boolean), teachOk = (await Promise.all([got('teach'), got('main')])).some(Boolean);
  if (!coreOk || !teachOk) { el.innerHTML = ''; el.classList.remove('tt3'); throw new Error('Taatal poses did not load'); }
  const resolve = n => { for (let i = 0; i < 6 && n && !have[n]; i++) n = FALL[n]; return have[n] ? n : 'hello'; };

  // the magic layer covers her whole screen (an ancestor's transform would trap position:fixed, so it lives in the screen)
  const host = el.closest('.screen') || document.body;
  const fx = document.createElement('canvas'); fx.className = 'tt-fx'; fx.setAttribute('aria-hidden', 'true');
  fx.style.cssText = host === document.body ? 'position:fixed;left:0;top:0;width:100vw;height:100vh' : 'position:absolute;left:0;top:0;width:100%;height:100%';
  host.append(fx);
  const g = fx.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = calm ? 0.25 : 1;                                   // reduced motion: same poses, small moves, fewer bits
  const pool = makePool();
  let live = 0, drew = false, fxL = 0, fxT = 0, dpr = 1;

  // ---------- size: every pose placed so its foot point sits on the floor point ----------
  let U = 100, fX = 50, fY = 97, cur = '', shadowW = 50;
  const spinR = P['spin-1'] ? P['spin-1'].rel / 2 : 0.4;       // the shell spin turns round the middle of her rolled-up body
  const SPIN = { 'spin-1': 1, 'spin-2': 1, 'spin-3': 1 };     // roll frames: centred on the floor point (their feet are wherever the roll put them)
  function layout() {
    const bw = el.clientWidth, bh = el.clientHeight; if (!bw || !bh) return;
    U = bh * STAND; fX = bw / 2; fY = bh * FLOOR;
    for (const n in img) {
      const p = P[n], k = U * p.rel / p.h, s = img[n].style;
      s.width = p.w * k + 'px'; s.height = p.h * k + 'px'; s.left = fX - (SPIN[n] ? p.w / 2 : p.foot[0]) * k + 'px'; s.top = fY - p.foot[1] * k + 'px';
    }
    root.style.transformOrigin = `${fX}px ${fY}px`;
    shadowSize();
  }
  function shadowSize() {
    const p = P[cur]; if (!p) return;
    shadowW = Math.max(0.5 * U, Math.min(1.3 * U, 0.62 * p.w * U * p.rel / p.h));
    const s = shadow.style; s.width = shadowW + 'px'; s.height = 0.12 * U + 'px'; s.left = fX - shadowW / 2 + 'px'; s.top = fY - 0.06 * U + 'px';
  }
  function sizeFx() {
    const r = fx.getBoundingClientRect(); fxL = r.left; fxT = r.top; dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w && h && (fx.width !== w || fx.height !== h)) { fx.width = w; fx.height = h; drew = true; }
  }
  let roQ = 0;                                                 // re-fit on the next frame (never inside the observer's own pass)
  const ro = new ResizeObserver(() => { if (!roQ) roQ = requestAnimationFrame(() => { roQ = 0; layout(); sizeFx(); }); }); ro.observe(el); ro.observe(host);

  let swapAt = -1;
  function show(n, cycle) {   // cycle: a walk / roll frame (a flip-book: no crossfade, no swap squash)
    n = resolve(n); if (n === cur) return;
    if (img[cur]) { img[cur].classList.toggle('cut', !!cycle); img[cur].classList.remove('on'); }
    img[n].classList.toggle('cut', !!cycle); img[n].classList.add('on'); cur = n; el.dataset.pose = n; if (!cycle) swapAt = now(); shadowSize();
  }

  // ---------- particles ----------
  function emit(k, x, y, vx, vy, life, r, c) {
    for (let i = 0; i < N; i++) { const q = pool[i]; if (q.on) continue;
      q.on = true; q.k = k; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.age = 0; q.life = life; q.r = r; q.c = c; q.rot = Math.random() * 6; q.vr = 0; q.ph = Math.random() * 6.28; live++; return q; }
    return null;
  }
  const pick = a => a[Math.floor(Math.random() * a.length)], rnd = (a, b) => a + Math.random() * (b - a);
  let AX = 0, AY = 0;
  function at() { const r = el.getBoundingClientRect(); AX = r.left - fxL + fX; AY = r.top - fxT + fY; }   // her floor point on the canvas -> AX, AY
  function sparkle(x, y, n) { for (let i = 0; i < n; i++) emit('spark', x + rnd(-6, 6), y + rnd(-6, 6), rnd(-40, 40), rnd(-60, 10), rnd(0.35, 0.6), rnd(0.05, 0.09) * U, pick(COLS.spark)); }
  function stars(x, y, n) {
    n = Math.max(3, Math.round(n * (calm ? 0.5 : 1)));
    for (let i = 0; i < n; i++) { const a = i * 6.283 / n + rnd(-0.2, 0.2), sp = rnd(2.2, 3.2) * U;
      const q = emit('star', x, y, sp * Math.cos(a), sp * Math.sin(a), 0.9, rnd(0.07, 0.1) * U, pick(COLS.star)); if (q) q.vr = rnd(-4, 4); }
  }
  function confetti(n) {
    const W = fx.width / dpr; n = Math.round(n * (calm ? 0.4 : 1));
    for (let i = 0; i < n; i++) { const q = emit('conf', rnd(0, W), rnd(-40, -5), rnd(-30, 30), rnd(60, 140), rnd(2.4, 3.4), Math.max(4, rnd(0.03, 0.05) * U), pick(COLS.conf)); if (q) q.vr = rnd(-6, 6); }
  }
  function balloon() {
    const W = fx.width / dpr, H = fx.height / dpr;
    emit('balloon', rnd(0.08, 0.92) * W, H + rnd(10, 60), rnd(-8, 8), -H / rnd(3.2, 4.2), 5, Math.max(16, rnd(0.17, 0.22) * U), pick(COLS.balloon));
  }
  function note(x, y) { emit('note', x, y, rnd(-15, 15), -0.7 * U, 1.3, 0.09 * U, pick(COLS.star)); }

  function star5(x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : g.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
    g.closePath();
  }
  function drawFx(dt) {
    if (!live && !drew) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, fx.width, fx.height); drew = live > 0;
    for (let i = 0; i < N; i++) {
      const q = pool[i]; if (!q.on) continue;
      q.age += dt; if (q.age >= q.life) { q.on = false; live--; continue; }
      const t = q.age / q.life; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
      g.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const x = q.x, y = q.y, r = q.r;
      if (q.k === 'spark') {
        const s = r * (1 - 0.6 * t); q.vy += 40 * dt; g.fillStyle = q.c; g.beginPath();
        g.moveTo(x, y - s); g.lineTo(x + s * 0.25, y - s * 0.25); g.lineTo(x + s, y); g.lineTo(x + s * 0.25, y + s * 0.25);
        g.lineTo(x, y + s); g.lineTo(x - s * 0.25, y + s * 0.25); g.lineTo(x - s, y); g.lineTo(x - s * 0.25, y - s * 0.25); g.closePath(); g.fill();
      } else if (q.k === 'star' || q.k === 'dizzy') {
        let sx = x, sy = y;
        if (q.k === 'dizzy') { const a = q.ph + q.age * 5; sx = x + 0.4 * U * Math.cos(a); sy = y + 0.1 * U * Math.sin(a); }
        else { const d = Math.pow(0.12, dt); q.vx *= d; q.vy = q.vy * d + 3 * U * dt; }
        star5(sx, sy, r, q.rot); g.fillStyle = q.c; g.fill(); g.lineWidth = Math.max(1, r * 0.12); g.strokeStyle = '#fff'; g.stroke();
      } else if (q.k === 'conf') {
        q.vx += Math.sin(q.age * 3 + q.ph) * 20 * dt; g.save(); g.translate(x, y); g.rotate(q.rot); g.scale(1, Math.cos(q.age * 7 + q.ph));
        g.fillStyle = q.c; g.fillRect(-r, -r * 0.4, 2 * r, 0.8 * r); g.restore();
      } else if (q.k === 'balloon') {
        const bx = x + 0.15 * r * Math.sin(q.age * 2 + q.ph);
        g.strokeStyle = 'rgba(110,110,110,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx, y + r * 1.15);
        g.quadraticCurveTo(bx - 0.3 * r, y + 2 * r, bx + 0.1 * r, y + 2.8 * r); g.stroke();
        g.fillStyle = q.c; g.beginPath(); g.ellipse(bx, y, r * 0.85, r * 1.1, 0, 0, 6.2832); g.fill();
        g.beginPath(); g.moveTo(bx - 0.12 * r, y + r * 1.2); g.lineTo(bx + 0.12 * r, y + r * 1.2); g.lineTo(bx, y + r * 1.04); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(bx - 0.3 * r, y - 0.5 * r, 0.16 * r, 0.26 * r, -0.5, 0, 6.2832); g.fill();
      } else if (q.k === 'dust') {
        g.fillStyle = 'rgba(232,210,160,.75)'; g.beginPath(); g.arc(x, y, r * (0.6 + t), 0, 6.2832); g.fill();
      } else if (q.k === 'line') {
        g.strokeStyle = 'rgba(22,58,58,.35)'; g.lineWidth = Math.max(1.5, 0.02 * U); g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + q.rot, y); g.stroke();
      } else if (q.k === 'note') {
        g.fillStyle = q.c; g.strokeStyle = q.c; g.lineWidth = Math.max(1.5, r * 0.18); const nx = x + 6 * Math.sin(q.age * 4 + q.ph);
        g.beginPath(); g.ellipse(nx, y, r * 0.42, r * 0.32, -0.4, 0, 6.2832); g.fill();
        g.beginPath(); g.moveTo(nx + r * 0.36, y); g.lineTo(nx + r * 0.36, y - r * 1.2); g.lineTo(nx + r * 0.85, y - r * 0.85); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  // ---------- states ----------
  const now = () => performance.now();
  let state = 'idle', t0 = now(), until = 0, then = null, paused = false, pausedAt = 0, raf = 0, last = now();
  let held = '', dir = 1, ev = 0, lastEmit = 0, mark = -1;
  const snd = (n, k) => { try { sfx && sfx.play(n, k); } catch (e) {} };
  const FIRST = { point: 'teach', oops: 'oops', getup: 'getup-3', sing: 'dance', dance: 'party-1', spin: 'spin-1', run: 'walk-1', ball: 'ball' };
  let cheerPose = 'cheer-1';
  function set(s, ms, next) {   // the first pose of a moment shows at once (with the state), the loop moves on from there
    state = s; t0 = now(); until = ms ? t0 + ms : 0; then = next || null; ev = 0; mark = -1; el.dataset.state = s;
    if (img[cur]) show(s === 'talk' || s === 'pose' ? held : s === 'cheer' ? cheerPose : FIRST[s] || rest);
  }
  const once = bit => (ev & bit) ? false : (ev |= bit, true);
  const tip = () => {        // the stick's tip on the canvas
    const p = P[cur], i = img[cur]; if (!p || !p.tip) return null; const r = i.getBoundingClientRect();
    return [r.left - fxL + p.tip[0] * r.width / p.w, r.top - fxT + p.tip[1] * r.height / p.h];
  };

  function frame() {
    if (paused) { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const n = now(), dt = Math.min(0.05, (n - last) / 1000); last = n;
    if (until && n >= until) { const f = then; set('idle'); if (f) f(); }
    const t = (n - t0) / 1000, T = n / 1000;
    let lift = 0.012 * U * (0.5 + 0.5 * Math.sin(T * 2.2)), rot = 1.2 * Math.sin(T * 1.1), dx = 0, sx = 1 - 0.008 * Math.sin(T * 2.4), sy = 1 + 0.012 * Math.sin(T * 2.4);
    let ang = 0, pose = rest, flip = 1, shadowK = 1, cycle = false;
    const emitNow = n - lastEmit > 45; if (emitNow) lastEmit = n;
    if (state === 'idle' && ballEvery && n - t0 > ballEvery) { api.ball(); return; }
    if (state === 'talk' && held === 'wave') {                   // waving hello
      pose = 'wave'; rot = 3 * Math.sin(t * 7); lift = 0.02 * U * Math.abs(Math.sin(t * 7));
      if (once(1)) snd('chime');
    } else if (state === 'talk' || state === 'point') {          // teaching: a little point at the card, sparkles from the stick
      pose = 'teach'; const k = Math.min(1, t / 0.35);
      dx = 0.03 * U * k; rot = -2.5 * k + (t > 0.35 && t < 1.3 ? 2 * Math.sin((t - 0.35) * 12) : 0);
      if (state === 'talk') lift += 0.012 * U * Math.abs(Math.sin(t * 9));
      if (once(1)) snd('twinkle');
      if (t < 1.4 && emitNow) { const p = tip(); p && sparkle(p[0], p[1], calm ? 1 : 2); }
    } else if (state === 'cheer') {                              // a hop: crouch, jump, land; a burst of stars
      pose = cheerPose; lift = 0;
      if (once(1)) snd('perk');
      if (t < 0.14) { const s = Math.sin(Math.PI * t / 0.28); sy = 1 - 0.1 * s; sx = 1 + 0.06 * s; }
      else if (t < 0.66) { const k = (t - 0.14) / 0.52; lift = 0.3 * U * Math.sin(Math.PI * k); sy = 1.04; sx = 0.97; rot = -4 * Math.sin(Math.PI * k);
        if (once(2)) { at(); stars(AX, AY - 0.6 * U, 9); } }
      else if (t < 0.86) { const s = Math.sin(Math.PI * (t - 0.66) / 0.2); sy = 1 - 0.1 * s; sx = 1 + 0.06 * s; if (once(4)) snd('land'); }
    } else if (state === 'oops') {                               // oops! a stumble, the fall, flat out, push up, up, stand and wave
      if (once(1)) snd('ohoh');
      if (t < 0.3) { pose = 'oops'; const k = t / 0.3; lift = 0.05 * U * Math.sin(Math.PI * k); rot = -5 * Math.sin(Math.PI * k); }
      else if (t < 0.55) { pose = 'fall'; const k = (t - 0.3) / 0.25; lift = 0.08 * U * (1 - k * k); rot = 4 * (1 - k); }
      else if (t < 1.15) { pose = 'flat'; lift = 0; rot = 0; if (once(2)) snd('bloop');
        if (t < 0.75) { const s = Math.sin(Math.PI * (t - 0.55) / 0.4); sy = 1 - 0.12 * s; sx = 1 + 0.07 * s; } }
      else if (t < 1.45) { pose = 'getup-1'; lift = 0; rot = 0; }
      else if (t < 1.75) { pose = 'getup-2'; lift = 0.015 * U; rot = -1.5; }
      else { pose = 'getup-3'; const k = (t - 1.75) / 0.35;
        if (k < 1) { lift = 0.08 * U * Math.sin(Math.PI * k); } else { rot = 3 * Math.sin((t - 2.1) * 8); if (once(4)) snd('land'); } }
    } else if (state === 'getup') {                              // "You got this!": up, a hop and a wave
      pose = 'getup-3'; const k = t / 0.35;
      if (k < 1) lift = 0.06 * U * Math.sin(Math.PI * k); else rot = 3 * Math.sin((t - 0.35) * 8);
      if (once(1)) snd('hop', 4);
    } else if (state === 'sing') {                               // humming: slow dance swaps and music notes
      const b = Math.floor(t / 0.55); pose = HUM[b % HUM.length];
      rot = 4 * Math.sin(t * Math.PI / 0.55); dx = 0.03 * U * Math.sin(t * Math.PI / 0.55); lift = 0.02 * U * Math.abs(Math.sin(t * Math.PI / 0.55));
      const nb = Math.floor(t / 0.45); if (nb !== mark) { mark = nb; at(); note(AX + rnd(-0.2, 0.3) * U, AY - 0.95 * U); if (nb % 2 === 0) snd('twinkle', nb / 2); }
    } else if (state === 'dance') {                              // party: celebration hops through the four party jumps
      const beat = 0.45, b = Math.floor(t / beat), x = (t % beat) / beat;
      pose = PARTY[b % 4]; lift = x < 0.7 ? 0.16 * U * Math.sin(Math.PI * x / 0.7) : 0;
      if (x >= 0.7) { const s = Math.sin(Math.PI * (x - 0.7) / 0.3); sy = 1 - 0.07 * s; sx = 1 + 0.04 * s; }
      rot = 6 * Math.sin(t * Math.PI / beat); dx = 0.05 * U * Math.sin(t * Math.PI / beat / 2);
      if (b !== mark) { mark = b; snd('hop', b); at(); sparkle(AX + rnd(-0.4, 0.4) * U, AY - rnd(0.3, 0.9) * U, calm ? 1 : 3); }
      if (celebrating) {
        if (once(1)) { confetti(40); snd('chime'); }
        if (t > 1.1 && once(2)) confetti(30);
        const bi = Math.floor(t / 0.38); if (bi < (calm ? 2 : 6) && !(ev & (8 << bi))) { ev |= 8 << bi; balloon(); }
      }
    } else if (state === 'spin') {                               // shell spin: hop, three turns easing out, wobble, dizzy stars, hop up
      pose = 'spin-1'; const p = Math.min(1, t / 2.4); lift = 0; rot = 0;
      if (p < 0.12) lift = 0.22 * U * Math.sin(Math.PI * p / 0.12);
      else if (p < 0.7) { const k = (p - 0.12) / 0.58; ang = 1080 * (1 - Math.pow(1 - k, 2.2)); const turn = Math.floor(ang / 360); if (turn !== mark) { mark = turn; snd('hop', 2 + turn * 2); } }
      else if (p < 0.85) { const k = (p - 0.7) / 0.15; ang = 1080 + 14 * Math.sin(k * 18) * (1 - k);
        if (once(1)) { at(); for (let i = 0; i < 4; i++) { const q = emit('dizzy', AX, AY - 0.8 * U, 0, 0, 1.1, Math.max(7, 0.11 * U), COLS.star[i]); if (q) q.ph = i * Math.PI / 2; } snd('twinkle', 2); } }
      else { const k = (p - 0.85) / 0.15; ang = 1080; pose = 'jump-wave'; lift = 0.2 * U * Math.sin(Math.PI * Math.min(1, k * 1.2)); if (once(2)) snd('hop', 8); if (k > 0.85 && once(4)) snd('land'); }
      if (pose === 'spin-1' && ang && !calm) {                   // the roll frame follows the angle: face, rolling, her back (turned away), rolling
        const a = ang % 360; pose = a < 50 || a >= 310 ? 'spin-1' : a < 130 || a >= 230 ? 'spin-2' : 'spin-3'; cycle = true;
      }
    } else if (state === 'run') {                                // a beach stroll between islands: four walk frames and a little bob (the game moves her, slowly)
      const fr = Math.floor(t / 0.16), ph = (t % 0.16) / 0.16; pose = WALK[fr % 4]; cycle = true; flip = dir;
      lift = 0.02 * U * Math.sin(Math.PI * ph); rot = dir * 1.5 * Math.sin(t * Math.PI / 0.32); shadowK = 1;
      if (fr !== mark) { mark = fr;                              // a footstep and a puff of sand as each foot lands (walk-1, walk-3)
        if (fr % 2 === 0) { snd('step', fr / 2); at(); emit('dust', AX - dir * rnd(0.1, 0.25) * U, AY - rnd(0, 0.04) * U, -dir * 20, -10, 0.5, Math.max(4, 0.06 * U), ''); } }
    } else if (state === 'ball') {                               // a little bounce with her beach ball
      pose = 'ball'; const s = t * 6; lift = 0.05 * U * Math.abs(Math.sin(s)); rot = 2 * Math.sin(s);
      const b = Math.floor(s / Math.PI); if (b !== mark) { mark = b; snd('step', b); }
    } else if (state === 'nap') { lift = 0; rot = 0; sy = 1 + 0.02 * Math.sin(T * 1.6); sx = 1; }
    else if (state === 'pose') pose = held;
    show(pose, cycle);
    // swapping pictures: a small squash so the swap reads as a move
    const ts = (n - swapAt) / 1000; if (swapAt >= 0 && ts < 0.16) { const s = Math.sin(Math.PI * ts / 0.16); sy *= 1 - 0.06 * s; sx *= 1 + 0.04 * s; }
    lift *= M; rot *= M; dx *= M; if (calm) ang = ang ? 6 * Math.sin(t * 6) : 0;
    let tr = `translate(${dx * dir}px,${-lift}px) rotate(${rot}deg) scale(${sx * flip},${sy})`;
    if (ang) { const cy = -(SPIN[cur] && P[cur] ? P[cur].rel / 2 : spinR) * U; tr += ` translate(0px,${cy}px) rotate(${ang}deg) translate(0px,${-cy}px)`; }   // each roll frame turns round its own middle (no orbit, no sideways jump on a frame change)
    root.style.transform = tr;
    const h = Math.min(1, lift / (0.35 * U)) * shadowK;
    shadow.style.transform = `translateX(${dx * dir}px) scale(${1 - 0.5 * h})`; shadow.style.opacity = 1 - 0.55 * h;
    drawFx(dt);
  }
  let celebrating = false;
  const api = {
    get state() { return state; },
    get pose() { return cur; },
    talk(ms) { held = 'teach'; set('talk', ms); },
    wave(ms) { held = 'wave'; set('talk', ms || 1500); },         // hello: "Here we gooo!", arriving on the map
    cheer() {                                                     // a different cheer from the last one
      celebrating = false; const c = CHEERS.filter(n => have[n] && n !== cheerPose); if (c.length) cheerPose = pick(c);
      set('cheer', 1500);
    },
    oops() { set('oops', 2750); },
    getUp() { set('getup', 1600); },
    point() { held = 'teach'; set('point', 1200); },
    sing(on) { set(on ? 'sing' : 'idle'); },
    nap(on) { set(on ? 'nap' : 'idle'); },
    dance(ms) { celebrating = false; set('dance', ms || 2500); },
    celebrate(spin) {                                             // island done: dance + confetti + balloons, (3 stars) shell spin, then the balloon
      celebrating = true;
      set('dance', 2500, () => { celebrating = false; rest = 'balloon'; if (spin) set('spin', 2400); });
    },
    shellSpin() { set('spin', 2400); },
    run(on, d) { dir = d < 0 ? -1 : 1; set(on ? 'run' : 'idle'); },
    ball() { set('ball', 2600); },
    rest(n) { rest = n; },
    pose(n) { held = resolve(n); set('pose'); show(held); return held; },   // test hook: hold one pose
    fx() { return live; },                                        // test hook: particles in the air
    fxKinds() { const s = {}; for (const q of pool) if (q.on) s[q.k] = (s[q.k] || 0) + 1; return s; },
    pause(on) {   // paused: no frames at all (her screen is not shown, or the app is hidden)
      on = !!on; if (on === paused) return;
      if (on) { pausedAt = now(); cancelAnimationFrame(raf); raf = 0; }
      else { const d = now() - pausedAt; t0 += d; if (until) until += d; if (swapAt >= 0) swapAt += d; lastEmit += d; last = now(); }
      paused = on; el.dataset.paused = on ? '1' : '';
      if (!on && !raf) raf = requestAnimationFrame(frame);
    },
  };
  layout(); sizeFx(); set('idle'); show(rest); swapAt = -1;
  raf = requestAnimationFrame(frame);
  return api;
}
