// dhivehi-games/kids/thaana/game.js
import { LETTERS, ATOLL1, islandsFor, buildTurns, makeRng, starsFor, createProgress, idleAction, traceResult } from './logic.js';
import { createTaatal } from './taatal.js';
import { createAudio, browserLoader, caption, estimateFor } from './audio.js';

const $ = s => document.querySelector(s);
const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const progress = createProgress(store);
const islands = islandsFor(ATOLL1);
let muted = false; try { muted = store && store.getItem('tf-muted') === '1'; } catch (e) {}
const audio = createAudio({ load: browserLoader, base: 'audio/', muted });
const TEST = new URLSearchParams(location.search).has('test');

// island positions on the map (percent of the sea), bottom to top like a winding path;
// a short landscape screen uses --wx/--wy instead: left to right, zig-zagging (see index.html)
const SPOTS = [[22, 90], [70, 82], [35, 73], [75, 64], [28, 54], [70, 46], [32, 36], [72, 28], [35, 20], [70, 12]];

let screen = 'map';
function show(id) { screen = id; document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); pauseHidden(); }

function renderMap() {
  const sea = $('#sea');
  sea.innerHTML = islands.map((isl, i) => {
    const open = progress.isUnlocked(isl.id, islands), st = progress.best(isl.id);
    const label = isl.kind === 'review' ? '★' : LETTERS[isl.letters[0]].ch;
    return `<button class="isl" data-id="${isl.id}" data-stars="${st}" ${open ? '' : 'data-locked="1" aria-disabled="true"'}
      style="--x:${SPOTS[i][0]}%;--y:${SPOTS[i][1]}%;--wx:${9 + i * 9.1}%;--wy:${i % 2 ? 36 : 74}%" aria-label="${isl.kind === 'review' ? 'Review island' : LETTERS[isl.letters[0]].name}${open ? '' : ' (locked)'}">
      <b lang="dv" dir="rtl"><span${isl.kind === 'review' ? ' class="st"' : ''}>${label}</span></b>${open ? `<em>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</em>` : ''}</button>`;
  }).join('');
  $('#starTotal').textContent = '⭐ ' + islands.reduce((n, i) => n + progress.best(i.id), 0);
  sea.querySelectorAll('.isl:not([data-locked])').forEach(b => b.addEventListener('click', () => startIsland(b.dataset.id)));
}

$('#mute').addEventListener('click', () => {
  muted = !muted; audio.setMuted(muted); $('#mute').textContent = muted ? '🔇' : '🔊'; $('#mute').setAttribute('aria-pressed', muted);
  try { store && store.setItem('tf-muted', muted ? '1' : '0'); } catch (e) {}
});
$('#mute').textContent = muted ? '🔇' : '🔊';
$('#mute').setAttribute('aria-pressed', muted);

// Miss Taatal (play screen) and her twin on the done screen: each created once, the first time her screen is shown
// (hidden elements have no size). The promise is kept so a quick quit + re-enter can't make a second one. If her
// pictures can't load the game plays without her (every call checks `taatal &&`).
let taatal = null, taatal2 = null, taatalP = null, taatal2P = null;
const makeTaatal = sel => createTaatal($(sel), 'taatal/').catch(e => { console.warn('Taatal did not load; playing without her.', e); return null; });
const getTaatal = () => taatalP || (taatalP = makeTaatal('#tt').then(t => { taatal = t; pauseHidden(); return t; }));
const getTaatal2 = () => taatal2P || (taatal2P = makeTaatal('#tt2').then(t => { taatal2 = t; pauseHidden(); return t; }));
// each Taatal only moves while her screen is shown and the app is visible
function pauseHidden() { const h = document.hidden; taatal && taatal.pause(h || screen !== 'play'); taatal2 && taatal2.pause(h || screen !== 'done'); }
renderMap();


// ---------- playing an island ----------
let run = null;           // { isl, turns, i, mistakes, missesThisTurn, busy, idleMs, lastTick }
const bub = $('#bub');

// Taatal acts the line out as soon as it is said (not when the audio promise settles); with a real recording
// her talking is then stretched to the clip's length
function say(key) {
  bub.textContent = caption(key);
  const talk = key !== 'good' && !key.startsWith('oops') && key !== 'gotthis', est = estimateFor(key);
  taatal && (key === 'good' ? taatal.cheer() : talk ? taatal.talk(est) : taatal.oops());
  return audio.play(key).then(ms => { if (talk && ms !== est && taatal && taatal.state === 'talk') taatal.talk(ms); return ms; });
}

function renderBar() {
  $('#prog').innerHTML = run.turns.map((_, k) => `<i class="${k < run.i ? 'd' : ''}"></i>`).join('');
  $('#playStars').textContent = '★'.repeat(starsFor(run.mistakes));
}

async function startIsland(id) {
  const isl = islands.find(x => x.id === id);
  stopFit(); $('#card').innerHTML = ''; $('#answers').innerHTML = ''; bub.textContent = '';   // nothing left over from the last island
  show('play');
  const seed = (Date.now() ^ id.length * 977) >>> 0;
  const r = run = { isl, turns: buildTurns(isl, ATOLL1, makeRng(TEST ? 1 : seed)), i: 0, mistakes: 0, misses: 0, busy: true, idleMs: 0, lastTick: performance.now(), hummed: false, lockUntil: 0 };
  renderBar(); startTick();
  await getTaatal();
  await fontReady;                                                  // letters are sized from the real glyph shapes
  if (run !== r) return;
  const ms = await say('go');                                       // "Here we gooo!" first, then the first turn
  setTimeout(() => { if (run === r) renderTurn(); }, ms);
}

function renderTurn() {
  stopFit();                                          // a stale re-fit would run on the previous turn's (detached) card
  const t = run.turns[run.i], L = LETTERS[t.target];
  run.misses = 0; run.idleMs = 0; run.hummed = false; run.busy = false; run.lockUntil = performance.now() + 300;   // a tap that was meant for the previous turn lands here
  renderBar();
  const card = $('#card'), ans = $('#answers');
  if (t.type === 'meet') {
    card.innerHTML = `<span class="glyph big" lang="dv" dir="rtl">${L.ch}</span>`;
    ans.innerHTML = `<div class="name">${L.name}</div><button class="btn go" style="width:100%">Next ›</button>`;
    ans.querySelector('.btn').onclick = () => { if (locked()) return; run.busy = true; advance(); };
    say('meet:' + L.name);
  } else if (t.type === 'trace') {
    card.innerHTML = `<span class="glyph big ghost" lang="dv" dir="rtl">${L.ch}</span><canvas class="trace"></canvas>`;
    ans.innerHTML = `<div class="tracebar"><div class="name">Trace ${L.name} with your finger</div><button class="btn go" style="width:100%">Done ✓</button></div>`;
    setupTrace(card, L.ch);
    ans.querySelector('.btn').onclick = () => checkTrace();
    say('trace:' + L.name);
  } else {
    // find: the card shows the letter to match; listen: only a big replay button (the letter is heard, not shown)
    card.innerHTML = t.type === 'find' ? `<span class="glyph big" lang="dv" dir="rtl">${L.ch}</span>` : `<button class="btn say" id="again" aria-label="Hear ${L.name} again">🔊</button>`;
    ans.innerHTML = `<div class="opts ${t.options.length === 4 ? 'four' : ''}">${t.options.map(o => `<button class="opt" data-idx="${o}" aria-label="${LETTERS[o].name}"><span class="glyph" lang="dv" dir="rtl">${LETTERS[o].ch}</span></button>`).join('')}</div>`;
    ans.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => pick(+b.dataset.idx, b)));
    if (t.type === 'listen') card.querySelector('#again').onclick = () => say('letter:' + L.name);
    say((t.type === 'find' ? 'find:' : 'listen:') + L.name);
  }
  relayout();
  fitRO = new ResizeObserver(relayout); fitRO.observe(card); fitRO.observe(ans);   // re-fit on rotate / resize
}

// ---------- big letters: sized by how big the glyph LOOKS, not by font-size ----------
// Dhivehi Muraka glyphs are only about a third of the em tall and sit low in the line, so each letter
// is measured (canvas ink box), scaled to fill its box and moved so its ink is centred.
const FONT = "'Dhivehi Muraka'";
const fontReady = Promise.race([document.fonts ? document.fonts.load(`100px ${FONT}`).catch(() => {}) : null, new Promise(r => setTimeout(r, 2500))]);
const inkCache = {};
function inkOf(ch) {   // the glyph's real ink box per 1px of font-size: drawn off-screen and scanned (WebKit's measureText box is loose)
  if (inkCache[ch]) return inkCache[ch];
  const F = 200, W = 3 * F, H = 2 * F, X = F, B = 1.3 * F, c = document.createElement('canvas'); c.width = W; c.height = H;
  const o = c.getContext('2d', { willReadFrequently: true }); o.font = `${F}px ${FONT}`; o.textAlign = 'left'; o.textBaseline = 'alphabetic'; o.direction = 'ltr';
  o.fillText(ch, X, B);
  const m = o.measureText(ch), px = o.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 96) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0 || !(m.fontBoundingBoxAscent > 0)) return { l: 0, r: 0.6, a: 0.36, d: 0, fa: 0.93, fd: 0.29 };   // nothing drawn: a typical letter
  const k = { l: (X - x0) / F, r: (x1 + 1 - X) / F, a: (B - y0) / F, d: (y1 + 1 - B) / F, fa: m.fontBoundingBoxAscent / F, fd: m.fontBoundingBoxDescent / F };
  if (!document.fonts || document.fonts.check(`100px ${FONT}`)) inkCache[ch] = k;   // not cached until the real font is in
  return k;
}
// fit the glyph so its ink fills fw of the box width / fh of its height (and is at most cap px), centred
function fitGlyph(g, fw, fh, cap = Infinity) {
  const box = g.parentElement, bw = box.clientWidth, bh = box.clientHeight;
  if (!bw || !bh) return null;
  const k = inkOf(g.textContent), iw = k.l + k.r, ih = k.a + k.d;
  const fs = Math.max(10, Math.min(bw * fw / iw, bh * fh / ih, cap / Math.max(iw, ih)));
  // the line box is exactly the font's ascent+descent, so the baseline sits fa*fs below the span's top
  const x = bw / 2 - (k.r - k.l) / 2 * fs, top = bh / 2 - (k.fa + (k.d - k.a) / 2) * fs;
  g.style.cssText = `font-size:${fs}px;line-height:${k.fa + k.fd};left:${x}px;top:${top}px`;
  return { fs, x, y: top + k.fa * fs };
}
let fitRO = null;
function stopFit() { if (fitRO) { fitRO.disconnect(); fitRO = null; } trace = null; }
function relayout() {
  if (!run) return;
  const g = $('#card .glyph'), geo = g && fitGlyph(g, 0.8, 0.74, 340);
  document.querySelectorAll('#answers .opt .glyph').forEach(t => fitGlyph(t, 0.86, 0.7));
  if (trace && geo) fitTrace(geo);
}

function locked() { return run.busy || performance.now() < run.lockUntil; }
function finishTurn(r, ms) { if (!r || run !== r) return; setTimeout(() => { if (run === r) advance(); }, Math.max(700, Math.min(ms, 1500))); }

function pick(idx, btn) {
  if (locked()) return;                      // ignore taps while feedback plays (double taps too)
  const t = run.turns[run.i];
  run.idleMs = 0;
  if (idx === t.target) {
    run.busy = true; btn.classList.add('ok'); { const r = run; say('good').then(ms => finishTurn(r, ms)); }
  } else {
    run.lockUntil = performance.now() + 400; run.misses++; run.mistakes++;
    btn.classList.remove('wobble'); void btn.offsetWidth; btn.classList.add('wobble');
    if (run.misses >= 2) { say('gotthis'); glow(); } else say(run.mistakes % 2 ? 'oops1' : 'oops2');
  }
}
function glow() { const t = run.turns[run.i]; const b = $(`#answers .opt[data-idx="${t.target}"]`); b && b.classList.add('glow'); }

function advance() {
  run.i++;
  if (run.i < run.turns.length) return renderTurn();
  const stars = starsFor(run.mistakes), isl = run.isl, nxt = islands[islands.indexOf(isl) + 1];
  stopFit();
  progress.record(isl.id, stars);
  $('#doneStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  // the heading says "Yippee!" (and she says it); the bubble says what was learned
  $('#bub2').textContent = caption(isl.kind === 'review' ? 'allknown' : 'learned:' + LETTERS[isl.letters[0]].name);
  nextId = nxt && progress.isUnlocked(nxt.id, islands) ? nxt.id : null;
  $('#next').textContent = nextId ? 'Next island ›' : 'Map ›';
  show('done'); audio.play('yippee');
  run = null;
  getTaatal2().then(t => { t && screen === 'done' && t.cheer(); });
}
let nextId = null;
$('#next').onclick = () => { if (nextId) startIsland(nextId); else { renderMap(); show('map'); } };
$('#quit').onclick = () => { audio.stopAll(); stopFit(); run = null; renderMap(); show('map'); };

// ---------- tracing ----------
let trace = null;   // { canvas, ch, ctx, ink:[{x,y}], drawn:[{x,y}], tol }
function setupTrace(card, ch) {
  const canvas = card.querySelector('canvas');
  trace = { canvas, ch, ctx: null, ink: [], drawn: [], tol: 18 };   // relayout() fits it to the letter (and again after a rotate)
  let last = null;
  const at = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.onpointerdown = e => { if (!trace || !trace.ctx) return; canvas.setPointerCapture(e.pointerId); last = at(e); trace.drawn.push(last); run && (run.idleMs = 0); };
  canvas.onpointermove = e => { if (!last || !trace) return; const p = at(e); trace.ctx.beginPath(); trace.ctx.moveTo(last.x, last.y); trace.ctx.lineTo(p.x, p.y); trace.ctx.stroke(); trace.drawn.push(p); last = p; };
  canvas.onpointerup = canvas.onpointercancel = () => { last = null; };
}
// ink points: draw the letter off-screen exactly where the visible ghost letter sits (same size and
// baseline as fitGlyph) and sample its pixels; the step grows with the letter so the point count stays even
function fitTrace(geo) {
  const { canvas } = trace, w = canvas.clientWidth, h = canvas.clientHeight, dpr = devicePixelRatio || 1;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);       // also clears old strokes (their spots moved)
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const off = document.createElement('canvas'); off.width = Math.ceil(w); off.height = Math.ceil(h);
  const o = off.getContext('2d'); o.font = `${geo.fs}px ${FONT}`; o.textAlign = 'left'; o.textBaseline = 'alphabetic'; o.direction = 'ltr';
  o.fillText(trace.ch, geo.x, geo.y);
  const img = o.getImageData(0, 0, off.width, off.height).data, ink = [], step = Math.max(3, Math.min(10, Math.round(geo.fs / 64)));
  for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) if (img[(y * off.width + x) * 4 + 3] > 128) ink.push({ x, y });
  Object.assign(trace, { ctx, ink, drawn: [], tol: Math.max(18, geo.fs * 0.09) });
  ctx.lineWidth = Math.max(14, geo.fs * 0.08); ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#14958F';
}
// Done with nothing (or a dot) drawn is not a try. A miss says oops (like a tap); the 2nd miss says
// "You got this!" and the ghost letter pulses; the 3rd try is always accepted (the misses still cost stars).
function checkTrace() {
  if (locked() || !trace || !trace.ctx || trace.drawn.length < 3) return;
  const ok = traceResult(trace.ink, trace.drawn, trace.tol).ok;
  if (ok || run.misses >= 2) { run.busy = true; const r = run; say('good').then(ms => finishTurn(r, ms)); return; }
  run.lockUntil = performance.now() + 400; run.misses++; run.mistakes++; run.idleMs = 0;
  trace.drawn = []; trace.ctx.clearRect(0, 0, trace.canvas.width, trace.canvas.height);
  if (run.misses >= 2) { say('gotthis'); hintTrace(); } else say(run.mistakes % 2 ? 'oops1' : 'oops2');
}
function hintTrace() { const g = $('#card .ghost'); if (!g) return; g.classList.remove('hint'); void g.offsetWidth; g.classList.add('hint'); }

// ---------- idle hum / glow: runs only while an island is being played, paused while the app is hidden ----------
let ticking = false;
function startTick() { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }
function tick() {
  if (!run) { ticking = false; return; }
  const n = performance.now();
  if (run && !document.hidden && !run.busy) {
    run.idleMs += n - run.lastTick;
    const a = idleAction(run.idleMs), t = run.turns[run.i];
    if (a === 'hum' && !run.hummed && t.type !== 'meet') { run.hummed = true; bub.textContent = caption('hum'); audio.play('hum'); taatal && taatal.sing(true); setTimeout(() => taatal && taatal.state === 'sing' && taatal.sing(false), 2500); }
    if (a === 'glow') glow();
  }
  run.lastTick = n;
  requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => {
  pauseHidden();
  if (document.hidden) audio.stopAll();
  if (run) run.lastTick = performance.now();
});

if (TEST) window.__tf = {
  turn: () => run && run.turns[run.i], turnIndex: () => (run ? run.i : -1), mistakes: () => (run ? run.mistakes : -1), islandId: () => run && run.isl.id,
  autoTrace: () => { trace.drawn = trace.ink.map(p => ({ x: p.x + 2, y: p.y + 2 })); }, ticking: () => ticking,
};
