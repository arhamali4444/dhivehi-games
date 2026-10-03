/* =====================================================================
   GUESS THE SONG · Maldives edition (Dhivehi Games)                     song/game.js
   Look "Vinyl From Above" (design-mockups/song/round6/song6-v6-overhead.html): a turntable seen from overhead on
   warm linen. A light streak turns across the grooves, the tone-arm swings in while the clip plays and lifts when it
   stops, a brass ring shows the clip's progress, and the label art changes every round.

   The same engine shape as Guess the Celebrity (celebrity/game.js). The "host" runs the match: vs Computer and the
   Daily challenge on this device, online the table host (shared/net.js). S is plain JSON:
     phases  adv (the record changes, "Round NN") -> q (15 s: the clip plays, four answers) -> rev (title, artist,
             year, Listen link, who got it) -> [stand every 3 rounds] -> adv ... -> over
   view(pid) sends each player the match WITHOUT the answer of the round being played. Players send
   {t:'ans',q,pick,ms,rp}. Points: speed (1000 at once, 30 less a second) x the clip-length multiplier
   (5 s x1.0, 3 s x1.3, 2 s x1.6, 1 s x2.0) x 0.8 after the one replay.
   Audio: Web Audio. Every clip is exactly 5.0 s on the server; the chosen length is cut from its start at play time,
   with 30 ms fades in and out (song/content.js scheduleClip). The next clip loads during the reveal; the site's
   sound switch (dd-sfx) is respected; the first tap unlocks audio on iOS.
   Content (which songs are live, clip addresses): song/content.js. Only live songs are ever loaded.
   ===================================================================== */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const app = $('#app');
const Q = new URLSearchParams(location.search);
const APP = !!(window.DG_APP || location.protocol === 'capacitor:' || !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));
const LOCAL = !APP && (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\.(localhost|test)$/.test(location.hostname));
const FAST = LOCAL && Q.has('fast'), AUTO = LOCAL && Q.has('auto');
const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const buzz = ms => { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const C = window.DGSongContent;

/* ---------- match rules ---------- */
const Q_MS = 15000;                                    /* 15 s a round */
const NR = 10;                                         /* rounds a match (Friends tables: 5, 10 or 15) */
const GRACE = 900;                                     /* online: a moment for the network after the buzzer */
const NEEDLE = .45;                                    /* s after the round starts: the needle lands, the clip plays */
const ADV_MS = FAST ? 900 : 2200, REV_MS = FAST ? 1500 : 6500, STAND_MS = FAST ? 700 : 6000, CPU_SPEED = FAST ? .2 : LOCAL && Q.get('cpus') === 'quick' ? .3 : 1;
const DAILY_CAP = 500;
const BOLI_QUICK = [30, 20, 10];                       /* Quick Match: 1st, 2nd, 3rd */
const BOLI_DAILY_PERFECT = 10;                         /* Daily: 1 per song named, +10 for all ten */
const BOLI_CPU_WIN = 5;                                /* vs Computer: a win against 3 or more computers */
const LENS = C.LENS;                                   /* [[5,1.0],[3,1.3],[2,1.6],[1,2.0]] */
const QUICK_LEN = 3;                                   /* Quick Match: everyone hears 3 s (x1.3) */
const multFor = len => (LENS.find(x => x[0] === len) || [3, 1.3])[1];
const CPU_ACC = { E: .82, M: .64, H: .46 }, CPU_LEN = { 5: .08, 3: 0, 2: -.07, 1: -.15 };
/* speed points: 1000 at the start, 30 less every second (550 at the buzzer), x the clip multiplier, x0.8 after a replay */
const ptsFor = (ms, mult, rp) => Math.round(Math.max(0, 1000 - 30 * Math.max(0, Math.min(15, (+ms || 0) / 1000))) * (mult || 1) * (rp ? .8 : 1) / 10) * 10;
const myId = (() => { if (window.DGNet && DGNet.local && /^[a-z0-9_-]{2,24}$/i.test(Q.get('pid') || '')) return Q.get('pid');
  let v = ls.get('dd-pid'); if (!v) { v = 'p' + Math.random().toString(36).slice(2, 10); ls.set('dd-pid', v); } return v; })();
let lenPick = (() => { const v = +ls.get('song-len'); return LENS.some(x => x[0] === v) ? v : 3; })();

/* ---------- icons ---------- */
const sv = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra ? ' ' + extra : ''}>${d}</svg>`;
const I = {
  back: sv('<path d="M15 5l-7 7 7 7"/>', 'class="bk"'),
  menu: sv('<path d="M4 7h16M4 12h16M4 17h10"/>', 'class="ic"'),
  bolt: sv('<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>', 'class="ic"'),
  friends: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.8.1 4.8 1.9 5.5 4.9"/>', 'class="ic"'),
  cpu: sv('<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M9 11v2M15 11v2M12 3v3M8 21h8"/>', 'class="ic"'),
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  replay: '<svg class="ic" viewBox="0 0 24 24" style="color:var(--acc)"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>',
  play: '<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  out: '<svg class="ic" viewBox="0 0 24 24" style="width:18px;height:18px;opacity:.7" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  spk: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>',
  tick: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  x: s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>`
};
let pcn = 0;
function pcMark() { const id = 'pcm' + (++pcn); return `<svg class="pcm" viewBox="14.4 6.4 71.2 88.2" aria-hidden="true"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><rect x="-30" y="-40" width="60" height="80" rx="8" fill="#fff"/><path d="M50,32.65 A14.5,14.5 0 1 0 26.01,48.85 Q39.27,63.45 50,80 Q60.73,63.45 73.99,48.85 A14.5,14.5 0 1 0 50,32.65Z" transform="translate(0,1.5) scale(0.7778) translate(-50,-52.75)" fill="#000"/></mask></defs><g transform="translate(50,50.5) rotate(-8)"><rect x="-30" y="-40" width="60" height="80" rx="8" fill="currentColor" mask="url(#${id})"/></g></svg>`; }
const BOLI_IMG = '<img src="boli.webp" alt="" width="22" height="22">';

/* ---------- audio: one Web Audio context for the clips and the soft effects (the site-wide dd-sfx switch) ---------- */
const AU = (() => { let ctx = null, out = null, clip = null;
  function get() { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (x) { return null; } }
    out = ctx.createGain(); out.gain.value = .7; out.connect(ctx.destination); clip = ctx.createGain(); clip.gain.value = 1; clip.connect(ctx.destination); } return ctx; }
  /* a music game: 'playback' so a clip is heard with the ringer switch off (the game's own Sound switch still mutes it) */
  function unlock() { if (document.hidden) return; const c = get(); if (!c) return; try { const s = navigator.audioSession; if (s && s.type !== 'playback' && !window.__vcRec) s.type = 'playback'; } catch (e) {}
    if (c.state !== 'running') { try { const p = c.resume(); p && p.catch && p.catch(() => {}); } catch (e) {} }
    if (!c._primed || c.state !== 'running') { c._primed = 1; try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} } }
  function sleep() { if (ctx && ctx.state === 'running') { try { const p = ctx.suspend(); p && p.catch && p.catch(() => {}); } catch (e) {} } }
  return { get, unlock, sleep, get out() { get(); return out; }, get clip() { get(); return clip; }, get running() { return !!ctx && ctx.state === 'running'; } }; })();
const sfxOn = () => { const v = ls.get('dd-sfx'); return v !== '0' && v !== 'off'; };
const SFX = (() => {
  function tone(t, f, dur, vol, type) { const c = AU.get(); const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(AU.out); o.start(t); o.stop(t + dur + .05); }
  function noise(t, dur, vol, lp) { const c = AU.get(), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.value = lp || 1600; g.gain.value = vol; s.buffer = b; s.connect(f); f.connect(g); g.connect(AU.out); s.start(t); }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const ready = () => { if (!sfxOn() || document.hidden) return null; const c = AU.get(); if (!c || c.state !== 'running') return null; return c.currentTime + .01; };
  return {
    tick() { const t = ready(); if (t == null) return; tone(t, 1480, .05, .035, 'triangle'); },
    pick() { const t = ready(); if (t == null) return; tone(t, hz(74), .12, .07, 'triangle'); },
    needle() { const t = ready(); if (t == null) return; noise(t, .07, .07, 900); },
    right() { const t = ready(); if (t == null) return; [72, 76, 79, 84].forEach((m, i) => tone(t + i * .07, hz(m), .5, .07)); },
    wrong() { const t = ready(); if (t == null) return; [64, 60].forEach((m, i) => tone(t + i * .14, hz(m), .4, .05, 'triangle')); },
    win() { const t = ready(); if (t == null) return; [67, 72, 76, 79, 84, 88].forEach((m, i) => tone(t + i * .09, hz(m), .8, .08)); } }; })();
['pointerdown', 'touchstart', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => AU.unlock(), { capture: true, passive: true }));

/* ---------- clips: fetched once, decoded once, kept in memory for the session (vs Computer then works offline) ---------- */
const CL = { bufs: new Map(), ps: new Map(), audio: null };
/* Web Audio is everywhere we ship (iOS Safari, Chrome, Edge, the app); without it (very old or stripped-down browsers)
   the clip plays through one <audio> element instead: the same length, timed by the clock (less exact, no fades) */
const HAS_WA = !!(window.AudioContext || window.webkitAudioContext);
const clk = () => { const c = AU.get(); return c ? c.currentTime : performance.now() / 1000; };
const canPlay = t => { try { const a = document.createElement('audio'); return !!t && !!a.canPlayType && /maybe|probably/.test(a.canPlayType(t)); } catch (e) { return false; } };
function decode(ab) { const c = AU.get(); if (!c) return Promise.reject(new Error('no audio'));
  return new Promise((res, rej) => { try { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } }); }
const fetchDecode = key => fetch(C.mediaUrl(key)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(decode);
/* the compressed copy when this browser plays its type, else (or when it fails) the WAV every browser decodes */
const fetchEl = key => fetch(C.mediaUrl(key)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); }).then(b => ({ el: 1, url: URL.createObjectURL(b), duration: C.CLIP_S }));
function loadClip(R) { if (!R || !R.k) return Promise.resolve(null);
  if (CL.ps.has(R.k)) return CL.ps.get(R.k);
  const get = HAS_WA ? fetchDecode : fetchEl;
  const p = (R.kc && canPlay(R.kt) ? get(R.kc).catch(() => get(R.k)) : get(R.k))
    .then(b => { CL.bufs.set(R.k, b); return b; })
    .catch(e => { CL.ps.delete(R.k); throw e; });
  CL.ps.set(R.k, p); return p; }
const preload = rounds => Promise.all(rounds.map(R => loadClip(R).then(() => true, () => false)));

/* ---------- players, names, avatars (the same as the other games) ---------- */
const DGA = () => window.DGAvatar || null;
const PC = ['#9a6b22', '#2D86C9', '#35B08F', '#C8326A', '#8A78F0', '#E8A23A'];
function myName() { const t = window.DGNet && DGNet.testName(); if (t) return t; const n = (ls.get('lg-name') || '').trim(), reg = (ls.get('dd-auth-username') || '').trim();
  if (reg && n.toLowerCase() !== reg.toLowerCase()) return reg; return n; }
const isReg = () => !!(ls.get('dd-auth-username') || '').trim() && !(window.DGNet && DGNet.testName());
function myChar() { const A = DGA(); if (!A) return null; try { let c = A.load(); if (!c) { const o = JSON.parse(ls.get('dd-char') || 'null'); if (o && typeof o === 'object') c = A.normalize(o); } return c || (A.starter ? A.starter() : A.random(myId)); } catch (e) { return null; } }
function lookCh(l) { const A = DGA(); if (!A || !l || typeof l !== 'object' || !l.ch) return null; try { return A.normalize(l.ch); } catch (e) { return null; } }
const CPUS = ['Aminath', 'Ibrahim', 'Hawwa', 'Mariyam', 'Ahmed', 'Zara', 'Ismail', 'Leena', 'Moosa', 'Shifa', 'Hassan', 'Nasih'];
function cpuChar(name) { const A = DGA(); if (!A) return null; try { const l = (A.looks || []).find(x => x.name === name); return l ? A.normalize(l.cfg) : A.random(name); } catch (e) { return null; } }
function meP() { return { id: myId, name: myName() || 'You', ch: myChar(), score: 0, right: 0, fast: 0 }; }
function avHTML(p, size, k) { size = size || 40; const A = DGA(); let inner = '';
  if (A && p && p.ch) { try { inner = `<span class="ai">${A.render(p.ch, { size: size > 56 ? 96 : 64, animate: false })}</span>`; } catch (e) { inner = ''; } }
  if (!inner) inner = `<span class="ai l" style="--c:${PC[(k || 0) % PC.length]}">${esc(((p && p.name) || '?').slice(0, 1).toUpperCase())}</span>`;
  return `<span class="av" style="--s:${size}px">${inner}</span>`; }

/* ---------- Boli (the shared wallet and daily cap, localStorage dd-inv) ---------- */
function invRead() { try { const d = JSON.parse(ls.get('dd-inv') || 'null'); if (d && d.v === 1) return d; } catch (e) {} return null; }
function award(key, n, xp) { n = n > 0 ? n | 0 : 0; xp = xp > 0 ? xp | 0 : 0; if (!n && !xp) return null; let d = invRead(); if (!d) d = { v: 1, shells: 100, xp: 0, owned: {}, eq: {}, hist: [], stats: {}, aw: [], day: '', dayEarned: 0 };
  d.aw = Array.isArray(d.aw) ? d.aw : []; if (d.aw.includes(key)) return null; d.aw.push(key); if (d.aw.length > 80) d.aw.shift();
  const today = new Date().toISOString().slice(0, 10); if (d.day !== today) { d.day = today; d.dayEarned = 0; }
  const got = Math.max(0, Math.min(n, DAILY_CAP - (d.dayEarned | 0))); d.dayEarned = (d.dayEarned | 0) + got; d.shells = (d.shells | 0) + got; d.xp = Math.max(0, d.xp | 0) + xp;
  ls.set('dd-inv', JSON.stringify(d)); return { sh: got, xp, capped: got < n }; }
const shells = () => { const d = invRead(); return d ? d.shells | 0 : 100; };
/* Boli display: 1,234 below 100,000, then 100K / 1.2M (rounded down) */
function fmtBoli(n) { n = Math.max(0, Math.floor(Number(n) || 0)); if (n < 1e5) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); if (n < 1e6) return Math.floor(n / 1e3) + 'K'; if (n < 1e9) return String(Math.floor(n / 1e5) / 10).replace(/\.0$/, '') + 'M'; return String(Math.floor(n / 1e8) / 10).replace(/\.0$/, '') + 'B'; }
const fmt = n => Math.round(n).toLocaleString('en');

/* ---------- random ---------- */
function rnd() { const a = new Uint32Array(1); try { crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); } }
function shuffle(a, r) { r = r || rnd; a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let s = h >>> 0; return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rid = () => Math.random().toString(36).slice(2, 10);
const hashN = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/* =====================================================================
   CONTENT: the live songs (content.js). Nothing hidden is ever loaded.
   ===================================================================== */
let SONGS = [], contentState = 'loading', contentP = null;      /* loading | ok | soon | error */
const MIN_LIVE = 4;
function loadContent(force) {
  if (contentP && !force) return contentP;
  contentState = 'loading';
  contentP = C.loadLive().then(r => { SONGS = r.songs; contentState = SONGS.length >= MIN_LIVE ? 'ok' : 'soon'; return SONGS; })
    .catch(() => { SONGS = []; contentState = 'error'; contentP = null; return SONGS; });
  return contentP;
}
const titleKey = s => (s.t + '|' + (s.tl || '')).toLowerCase();
/* three other songs: the same genre and a similar era (within 10 years) first, then the same genre, then the same era,
   then any; never the same song, never the same title twice */
function distractors(s, r) {
  const used = new Set([titleKey(s)]), out = [];
  const others = SONGS.filter(x => x.id !== s.id && titleKey(x) !== titleKey(s));
  const era = x => s.y && x.y && Math.abs(x.y - s.y) <= 10, gen = x => !!s.g && x.g === s.g;
  const tiers = [others.filter(x => gen(x) && era(x)), others.filter(x => gen(x) && !era(x)), others.filter(x => !gen(x) && era(x)), others.filter(x => !gen(x) && !era(x))];
  for (const t of tiers) for (const x of shuffle(t, r)) { if (out.length >= 3) break; const k = titleKey(x); if (used.has(k)) continue; used.add(k); out.push(x); }
  return out;
}
/* one round: one song, four answers (title in Thaana, transliteration, artist), a label picture for the record */
function mkRound(s, r, art) {
  const opts = shuffle([s].concat(distractors(s, r)), r);
  return { id: s.id, k: s.k, kc: s.kc || '', kt: s.kt || '', d: s.d, t: s.t, tl: s.tl, a: s.a, aDv: s.aDv, y: s.y, g: s.g, u: s.u, art: art % ARTS,
    opts: opts.map(x => ({ id: x.id, t: x.t, tl: x.tl, a: x.a })), c: opts.findIndex(x => x.id === s.id) };
}
const RECENT_KEY = 'song-recent';
function recent() { try { const a = JSON.parse(ls.get(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch (e) { return []; } }
function markSeen(id) { if (!id) return; const a = recent().filter(x => x !== id); a.push(id); ls.set(RECENT_KEY, JSON.stringify(a.slice(-150))); }
/* n rounds, n different songs; easier songs first when asked (practice), songs not heard lately first */
function pickRounds(n, diffs, seedArt) {
  const pos = new Map(recent().map((id, i) => [id, i])), art0 = seedArt == null ? Math.floor(rnd() * ARTS) : seedArt;
  const order = L => shuffle(L.filter(s => !pos.has(s.id))).concat(L.filter(s => pos.has(s.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id)));
  const pref = SONGS.filter(s => diffs.includes(s.d)), rest = SONGS.filter(s => !diffs.includes(s.d));
  return order(pref).concat(order(rest)).slice(0, n).map((s, i) => mkRound(s, rnd, art0 + i));
}
const CPU_DIFFS = ['E', 'M'], ALL_DIFFS = ['E', 'M', 'H'];

/* ---------- the Daily challenge: 10 songs, the same for everyone that day (Maldives time, UTC+5) ---------- */
const mvDay = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
function dailyRounds(day) {
  const r = seeded('dhivehi-song|' + day), sorted = SONGS.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), art0 = Math.floor(r() * ARTS);
  return shuffle(sorted, r).slice(0, NR).map((s, i) => mkRound(s, r, art0 + i));
}
const DAILY_KEY = 'song-daily';
function dailyRec() { try { const d = JSON.parse(ls.get(DAILY_KEY) || 'null'); if (d && d.day === mvDay()) return d; } catch (e) {} return null; }
function dailySave(o) { ls.set(DAILY_KEY, JSON.stringify(Object.assign({ day: mvDay() }, o))); }
function dailyLine() { const d = dailyRec(); if (!d) return '10 songs, one try'; return 'Done today · ' + (d.right | 0) + '/' + (d.n || NR); }

/* =====================================================================
   LABEL ART: flat Maldivian-inspired abstracts, one per round (lagoon, atoll, sunset sea, reef, dhoni sail,
   palm shade, wave bands, night lagoon). Drawn in a 100 x 100 box, clipped round by the label.
   ===================================================================== */
const ART = [
 u => `<defs><radialGradient id="a${u}" cx="42%" cy="40%" r="70%"><stop offset="0" stop-color="#bff3ea"/><stop offset=".38" stop-color="#55cfc6"/><stop offset=".7" stop-color="#1b8fa0"/><stop offset="1" stop-color="#0d5f78"/></radialGradient><linearGradient id="b${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf1dc"/><stop offset="1" stop-color="#ecd7ae"/></linearGradient></defs>
  <circle cx="50" cy="50" r="50" fill="url(#a${u})"/><path d="M8 66c14-6 30-4 44 2s28 7 42 1v40H8z" fill="#0d5f78" opacity=".35"/><path d="M18 30c10-8 26-10 38-6 10 3 16 10 26 9-6 7-18 8-30 5-12-3-22-2-34-8z" fill="url(#b${u})"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M30 88V76M30 80l-6-7M24 73l-3-5M24 73l1-6M30 79l6-8M36 71l-1-6M36 71l5-3M30 76l-2-5" stroke="#f08a6c" stroke-width="3.2"/><path d="M70 86c0-6 1-10 3-14M73 72c-3-3-5-7-5-11M73 72c3-3 7-4 10-3M71 79c4 0 7 2 9 5M68 61c-2-2-2-5-1-7M83 69c2-2 3-4 3-7" stroke="#f6b08a" stroke-width="2.8"/></g>
  <path d="M12 52c12-4 22 4 34 0s22-4 34 0" stroke="#fff" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>`,
 u => `<defs><radialGradient id="a${u}" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#0f6f86"/><stop offset="1" stop-color="#0a4660"/></radialGradient><radialGradient id="b${u}" cx="48%" cy="46%" r="50%"><stop offset="0" stop-color="#c9f5ec"/><stop offset=".7" stop-color="#6fd6cc"/><stop offset="1" stop-color="#3fb7b4"/></radialGradient></defs>
  <circle cx="50" cy="50" r="50" fill="url(#a${u})"/><path d="M50 16c20 0 34 14 34 33 0 20-15 36-35 36S15 70 15 50s15-34 35-34z" fill="url(#b${u})"/>
  <path d="M50 16c20 0 34 14 34 33 0 20-15 36-35 36S15 70 15 50s15-34 35-34z" fill="none" stroke="#f7ead0" stroke-width="5" stroke-dasharray="22 5 14 6 30 4 18 7" stroke-linecap="round"/>`,
 u => `<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d29a"/><stop offset=".45" stop-color="#ec9a72"/><stop offset=".62" stop-color="#c8656a"/></linearGradient><linearGradient id="b${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a8b9b"/><stop offset="1" stop-color="#0d4b63"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#a${u})"/><path d="M30 60a20 20 0 0 1 40 0z" fill="#fbe7bf"/><rect y="60" width="100" height="40" fill="url(#b${u})"/>
  <g stroke="#fbe7bf" stroke-linecap="round" fill="none" opacity=".75"><path d="M36 66h28" stroke-width="2.2"/><path d="M41 72h18" stroke-width="1.8"/><path d="M45 78h10" stroke-width="1.5"/></g>
  <path d="M6 86c10-4 18 3 28 0s18-4 28 0 18 4 32-1" stroke="#9fdad6" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>`,
 u => `<defs><radialGradient id="a${u}" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#1d8a9a"/><stop offset="1" stop-color="#083f52"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#a${u})"/><path d="M0 78c18-10 40-12 58-6s30 6 42 0v28H0z" fill="#ecd7ae"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M34 76c0-14 2-24 8-34M42 42c-4-6-5-12-3-18M42 42c6-4 12-4 17-2M38 58c-6-3-11-8-12-14M38 58c6 1 11 5 13 10" stroke="#f08a6c" stroke-width="4"/>
  <path d="M66 74c2-10 7-17 14-22M80 52c1-6 5-10 10-12M80 52c-6-2-10-6-11-12M72 63c-5-1-9-4-11-9" stroke="#f6b08a" stroke-width="3"/></g>
  <path d="M10 30c14-5 24 4 38-1s24-5 40 0" stroke="#9fe1d9" stroke-width="1.5" fill="none" opacity=".45" stroke-linecap="round"/>`,
 u => `<defs><linearGradient id="a${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f3ef"/><stop offset=".6" stop-color="#86d3cf"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#a${u})"/><rect y="64" width="100" height="36" fill="#2a8fa0"/><path d="M0 64h100" stroke="#e8fbf7" stroke-width="1.2"/>
  <path d="M51 18v44" stroke="#5b3d24" stroke-width="2.2" stroke-linecap="round"/><path d="M53 20c14 8 20 22 16 38H53z" fill="#fbf1dc"/><path d="M49 26c-10 7-14 18-11 32h11z" fill="#f2d9a8"/>
  <path d="M28 62h48l-6 8H34z" fill="#6b4a2e"/><path d="M14 76c10-3 18 2 28 0s18-3 30 0" stroke="#bfeeea" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>`,
 u => `<defs><linearGradient id="a${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e6c2"/><stop offset="1" stop-color="#e5c38a"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#a${u})"/><path d="M48 58c14-10 34-8 52 2v40H40c-6-14-4-30 8-42z" fill="#47c1bb"/><path d="M58 70c10-4 22-3 34 2" stroke="#d6f6f1" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <g fill="none" stroke="#2f7a5a" stroke-width="3.4" stroke-linecap="round"><path d="M-2 8c18 2 30 10 38 24"/><path d="M-2 22c14 0 26 6 34 16"/><path d="M-2 38c12-2 22 2 30 8"/><path d="M6 -2c6 14 14 24 26 32"/></g>
  <g fill="none" stroke="#3f9a70" stroke-width="2" stroke-linecap="round"><path d="M14 12l-2 8M22 16l-3 8M30 22l-4 7M12 28l-3 7M22 32l-4 6"/></g>`,
 u => `<rect width="100" height="100" fill="#123d5a"/>
  <g fill="none" stroke-linecap="round"><path d="M-6 30c16-10 30-10 46 0s30 10 46 0 22-6 22-6" stroke="#fbf1dc" stroke-width="7"/><path d="M-6 48c16-10 30-10 46 0s30 10 46 0 22-6 22-6" stroke="#47c1bb" stroke-width="7"/>
  <path d="M-6 66c16-10 30-10 46 0s30 10 46 0 22-6 22-6" stroke="#f08a6c" stroke-width="7"/><path d="M-6 84c16-10 30-10 46 0s30 10 46 0 22-6 22-6" stroke="#e8c983" stroke-width="7"/></g>`,
 u => `<defs><radialGradient id="a${u}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#2c4479"/><stop offset="1" stop-color="#131c3b"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#a${u})"/><path d="M60 20a17 17 0 1 0 6 30 14 14 0 1 1-6-30z" fill="#fbf1dc"/><rect y="62" width="100" height="38" fill="#0e2a46"/>
  <g stroke="#e8c983" stroke-linecap="round" opacity=".8"><path d="M50 68h16" stroke-width="2"/><path d="M53 74h10" stroke-width="1.8"/><path d="M55 80h6" stroke-width="1.5"/></g>
  <path d="M8 88c12-3 20 2 30 0s20-3 32 0 16 2 24-1" stroke="#5f7fb8" stroke-width="1.4" fill="none" opacity=".6" stroke-linecap="round"/>`
];
const ARTS = ART.length;
let artN = 0;
const artSVG = i => { const u = 'L' + (++artN); return `<svg viewBox="0 0 100 100" aria-hidden="true">${ART[((i % ARTS) + ARTS) % ARTS](u)}<circle cx="50" cy="50" r="49" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="1"/></svg>`; };
/* the turntable from above, in its design box: 'q' 358 x 350 (the round), 'lob' 250 x 236 (lobby), 'mini' 118 x 118 (reveal) */
function deckHTML(kind, art) {
  if (kind === 'mini') return `<div class="deck"><span class="inlay"></span><div class="platter" style="left:1px;top:1px;width:116px;height:116px"></div><div class="disc dsc" style="left:7px;top:7px;width:104px;height:104px;transform:rotate(-30deg)"><div class="lab">${artSVG(art)}</div></div><div class="streak stk" style="left:7px;top:7px;width:104px;height:104px"></div><span class="spindle" style="left:54px;top:54px"></span></div>`;
  if (kind === 'lob') return `<div class="deck" aria-hidden="true"><span class="inlay"></span><div class="platter" style="left:8px;top:12px;width:220px;height:220px"></div><div class="disc dsc" style="left:14px;top:18px;width:208px;height:208px;transform:rotate(-30deg)"><div class="lab">${artSVG(art)}</div></div><div class="streak stk" style="left:14px;top:18px;width:208px;height:208px"></div><span class="spindle" style="left:113px;top:117px"></span><span class="bear" style="left:222px;top:34px"></span><div class="tarm" style="left:222px;top:34px;transform:rotate(-6deg)"><span class="cw"></span><span class="tube"></span><span class="hs"></span><span class="bp"></span></div></div>`;
  return `<div class="deck" aria-hidden="true"><span class="inlay"></span><div class="platter" style="left:16px;top:26px;width:304px;height:304px"></div><svg class="ringo" viewBox="0 0 100 100" style="left:9px;top:19px;width:318px;height:318px"><circle class="bg" cx="50" cy="50" r="48.5"/><circle class="fg" id="ring" cx="50" cy="50" r="48.5" pathLength="100"/></svg>
<div class="disc dsc" id="disc" style="left:22px;top:32px;width:292px;height:292px;transform:rotate(-30deg)"><div class="lab" id="lab">${artSVG(art)}</div></div><div class="streak stk" id="stk" style="left:22px;top:32px;width:292px;height:292px"></div><span class="spindle" style="left:163px;top:173px"></span><span class="bear" style="left:324px;top:58px"></span>
<div class="tarm" id="arm" style="left:324px;top:58px;transform:rotate(-4deg)"><span class="cw"></span><span class="tube"></span><span class="hs"></span><span class="bp"></span></div><span class="knob" style="left:22px;top:306px"><i></i>33⅓</span><div class="rdy" id="rdy"><b></b><small>Get ready</small></div></div>`;
}

/* =====================================================================
   ENGINE: S is the whole match. Only the host changes it.
   ===================================================================== */
let S = null, mode = null, screen = 'home';      /* mode: cpu | daily | online */
let hostT = 0, cpuT = [], cpuPlan = {}, pausedAt = 0, myPicks = {}, autoT = 0;
let NET = null;
const online = () => mode === 'online';
const hostOn = () => !!S && (mode === 'cpu' || mode === 'daily' || (online() && !!NET && NET.isHost()));
const meIdx = () => S ? S.players.findIndex(p => p.id === myId) : -1;
const me = () => { const k = meIdx(); return k >= 0 ? S.players[k] : null; };
const active = () => S.players.filter(p => !p.gone);
const now = () => pausedAt || Date.now();
function newMatch(kind, players, rounds, o) { o = o || {}; const len = LENS.some(x => x[0] === o.len) ? o.len : 3;
  return { gid: rid(), kind, quick: !!o.quick, n: o.n || rounds.length, qi: 0, phase: 'adv', at: Date.now(), rounds, players, picks: {}, prev: null, day: o.day || '', len, mult: multFor(len) }; }
function commit() { render(); if (online() && NET && NET.isHost()) NET.sync(); }
function clearHost() { clearTimeout(hostT); hostT = 0; cpuT.forEach(clearTimeout); cpuT = []; }
function hostSched() { clearTimeout(hostT); hostT = 0; if (!hostOn() || pausedAt) return; const el = Date.now() - S.at;
  if (S.phase === 'adv') hostT = setTimeout(hostStartQ, Math.max(0, ADV_MS - el));
  else if (S.phase === 'q') { const all = active().length && active().every(p => S.picks[p.id]); hostT = setTimeout(hostEndQ, all ? (FAST ? 250 : 900) : Math.max(0, Q_MS + (online() ? GRACE : 0) - el)); }
  else if (S.phase === 'rev') hostT = setTimeout(hostAfterRev, Math.max(0, REV_MS - el));
  else if (S.phase === 'stand') hostT = setTimeout(() => hostAdv(S.qi + 1), Math.max(0, STAND_MS - el)); }
function hostAdv(i) { if (!hostOn()) return; if (i >= S.n) { hostFinish(); return; }
  if (!S.rounds[i]) { hostT = setTimeout(() => hostAdv(i), 300); return; }
  brk(false); S.qi = i; S.phase = 'adv'; S.at = Date.now(); S.picks = {}; S.prev = null; S.players.forEach(p => { p.gain = null; }); commit(); hostSched(); }
/* the round starts once the host has the clip (it waits a moment more if the network is slow) */
function hostStartQ() { if (!hostOn() || S.phase !== 'adv') return; const R = S.rounds[S.qi];
  if (!R) { S.at = Date.now(); hostSched(); return; }
  if (!CL.bufs.has(R.k)) { const q = S.qi, gid = S.gid; loadClip(R).catch(() => {}).then(() => { if (S && S.gid === gid && S.qi === q && S.phase === 'adv') { CL.bufs.has(R.k) || (R.bad = 1); hostStartQ2(); } }); return; }
  hostStartQ2(); }
function hostStartQ2() { if (!hostOn() || S.phase !== 'adv' || pausedAt) return; S.phase = 'q'; S.at = Date.now(); S.picks = {}; planCpus(); commit(); hostSched(); }
/* computer players: a chance of the right song that falls with the song's difficulty and a shorter clip, a lock time,
   and now and then the replay (then they answer later and score 20% less) */
function planCpus() { cpuT.forEach(clearTimeout); cpuT = []; cpuPlan = {}; const R = S.rounds[S.qi];
  S.players.forEach(p => { if (!p.cpu || p.gone) return; const acc = Math.max(.15, Math.min(.95, (CPU_ACC[R.d] || .6) + (CPU_LEN[S.len] || 0) + (p.sk || 0))), ok = rnd() < acc;
    if (rnd() < .03 && Q.get('cpus') !== 'quick') return;   /* now and then a computer runs out of time */
    const rp = rnd() < .22, base = NEEDLE + S.len + (rp ? S.len + 1.2 : 0);
    const ms = Math.round((base + (ok ? .6 + rnd() * 6.5 : 1.5 + rnd() * 8)) * 1000 * CPU_SPEED);
    const wrong = [0, 1, 2, 3].filter(i => i !== R.c); cpuPlan[p.id] = { p: ok ? R.c : wrong[Math.floor(rnd() * 3)], ms: Math.min(Q_MS - 200, ms), rp: rp ? 1 : 0 }; });
  cpuGo(); }
function cpuGo() { cpuT.forEach(clearTimeout); cpuT = []; const qi = S.qi;
  Object.keys(cpuPlan).forEach(id => { if (S.picks[id]) return; const pl = cpuPlan[id]; cpuT.push(setTimeout(() => { if (S && S.qi === qi && S.phase === 'q') hostPick(id, pl.p, pl.ms, pl.rp); }, Math.max(0, S.at + pl.ms - Date.now()))); }); }
function hostPick(id, p, ms, rp) { if (!S || S.phase !== 'q' || S.picks[id]) return false; const pl = S.players.find(x => x.id === id); if (!pl || pl.gone) return false;
  if (!(p >= 0 && p <= 3)) return false; S.picks[id] = { p: p | 0, ms: Math.max(0, Math.min(Q_MS, Math.round(+ms || 0))), rp: rp ? 1 : 0 };
  if (online() && !pl.cpu && NET) NET.clear(id);
  commit(); hostSched(); return true; }
function rankIds(N) { return N.players.filter(p => !p.gone).slice().sort((a, b) => b.score - a.score || (a.fast || 0) - (b.fast || 0)).map(p => p.id); }
function hostEndQ() { if (!hostOn() || S.phase !== 'q') return; cpuT.forEach(clearTimeout); cpuT = []; const R = S.rounds[S.qi]; S.prev = rankIds(S);
  S.players.forEach(p => { if (p.gone) { p.gain = null; return; } const pk = S.picks[p.id];
    if (pk && pk.p === R.c) { const g = ptsFor(pk.ms, S.mult, pk.rp); p.score += g; p.gain = g; p.right = (p.right | 0) + 1; p.fast = (p.fast || 0) + pk.ms; (p.got = p.got || []).push(S.qi); }
    else p.gain = 0;
    if (online() && NET && !p.cpu && !pk) { if (NET.strike(p.id)) { p.gone = 1; p.afk = 1; } } });
  S.phase = 'rev'; S.at = Date.now(); brk(true); commit(); hostSched(); }
function hostAfterRev() { if (!hostOn() || S.phase !== 'rev') return;
  if (S.qi + 1 >= S.n) { hostFinish(); return; }
  if (S.kind !== 'daily' && (S.qi + 1) % 3 === 0) { S.phase = 'stand'; S.at = Date.now(); commit(); hostSched(); return; }
  hostAdv(S.qi + 1); }
function hostFinish() { if (!hostOn()) return; clearHost(); S.phase = 'over'; S.at = Date.now(); brk(false); commit();
  if (online() && NET) { NET.matchOver(); if (NET.hostAway()) setTimeout(() => { if (online() && NET.isHost()) NET.retire(); }, 3000); } }
function brk(on) { if (!online() || !NET || !NET.isHost() || !NET.handBreak) return 0; try { if (on) return NET.handBreak(true); const k = NET.handBreak(); NET.handBreak(false); return k; } catch (e) { console.error(e); return 0; } }
/* my own answer: tapping a title locks it (with my replay, if I used it) */
function answer(i) { if (!S || S.phase !== 'q' || meIdx() < 0 || me().gone) return; const qi = S.qi; if (myPicks[qi] != null || S.picks[myId]) return;
  const ms = Math.max(0, Math.min(Q_MS, now() - S.at)), rp = CS && CS.key === S.gid + ':' + qi && CS.replayed ? 1 : 0;
  myPicks[qi] = i; SFX.pick(); buzz(8);
  if (hostOn()) hostPick(myId, i, ms, rp);
  else { NET.send({ t: 'ans', q: qi, pick: i, ms, rp }); render(); } }

/* ---------- the clip of the round being played (this device only) ---------- */
let CS = null;   /* {key, plays:[{when,len,h}], replayed, started, need:'tap'|'mute'|'' } */
function csNow() { if (!S) return null; const k = S.gid + ':' + S.qi; if (!CS || CS.key !== k) CS = { key: k, plays: [], replayed: false, started: false, need: '', armE: 0, lastCt: 0 }; return CS; }
function playClip(replay) { const cs = csNow(), R = S && S.rounds[S.qi]; if (!cs || !R) return false;
  if (!sfxOn()) { cs.need = 'mute'; return false; }
  const c = AU.get(), b = CL.bufs.get(R.k); if (!b) { loadClip(R).catch(() => {}); return false; }
  let when, h;
  if (b.el) {   /* no Web Audio: the <audio> element */
    const a = CL.audio || (CL.audio = new Audio()), len = S.len; a.src = b.url; try { a.currentTime = 0; } catch (e) {}
    when = performance.now() / 1000; const pr = a.play(); if (pr && pr.catch) pr.catch(() => { cs.need = 'tap'; });
    h = { el: a, t: setTimeout(() => { try { a.pause(); } catch (e) {} }, len * 1000) };
  } else {
    if (c.state !== 'running') { cs.need = 'tap'; return false; }
    when = c.currentTime + .03; h = C.scheduleClip(c, b, AU.clip, when, S.len, C.FADE_S);
  }
  cs.plays.push({ when, len: S.len, h }); cs.started = true; cs.need = ''; if (replay) cs.replayed = true;
  window.__songLast = { when, len: S.len, end: when + S.len, replay: !!replay, qi: S.qi };
  return true; }
function stopClip() { if (!CS) return; const t = clk();
  CS.plays.forEach(p => { if (t < p.when + p.len) { if (p.h.el) { clearTimeout(p.h.t); try { p.h.el.pause(); } catch (e) {} p.len = Math.max(0, t - p.when); return; } try { p.h.gain.gain.cancelScheduledValues(t); p.h.gain.gain.setValueAtTime(p.h.gain.gain.value, t); p.h.gain.gain.linearRampToValueAtTime(0, t + .05); p.h.src.stop(t + .06); } catch (e) {} p.len = Math.max(0, t + .05 - p.when); } }); }
function clipNow() { const cs = CS; if (!cs) return { playing: false, prog: 0, played: 0, left: 0 };
  const t = clk(); let playing = false, prog = cs.started ? 1 : 0, played = 0, left = 0;
  cs.plays.forEach(p => { const e = Math.max(0, Math.min(p.len, t - p.when)); played += e; if (t >= p.when && t < p.when + p.len) { playing = true; prog = e / p.len; left = p.len - e; } else if (t < p.when) { playing = true; prog = 0; left = p.len; } });
  return { playing, prog, played, left }; }
function replay() { if (!S || S.phase !== 'q') return; const cs = csNow(); const st = clipNow();
  if (!cs.started || cs.replayed || st.playing || myPicks[S.qi] != null || S.picks[myId]) return;
  playClip(true); render(); }

/* ---------- solo modes ---------- */
let startTok = 0;
function soloStart(kind, nPlayers) {
  if (kind === 'daily') { const d = dailyRec(); if (d && (d.done || d.started)) { renderHome(); toast('You’ve played today’s challenge. New songs come at midnight, Maldives time.', 4200); return; } }
  const tok = ++startTok; AU.unlock();
  loadContent().then(() => {
    if (tok !== startTok || online()) return;
    if (contentState !== 'ok') { renderHome(); return; }
    const me0 = meP(); let players = [me0], rounds;
    if (kind === 'daily') rounds = dailyRounds(mvDay());
    else rounds = pickRounds(NR, CPU_DIFFS);
    if (rounds.length < 3) { toast('Not enough songs yet. Come back soon.'); return; }
    toast('Loading songs…', 6000);
    /* every clip of the match is loaded first, so the match plays on without the network */
    preload(rounds).then(ok => {
      if (tok !== startTok || online()) return;
      const good = rounds.filter((R, i) => ok[i]);
      if (good.length < Math.min(3, rounds.length)) { closeToast(); toast('Couldn’t load the songs. Check your connection and try again.', 4500); return; }
      if (kind === 'daily') { dailySave({ started: 1, done: 0, right: 0, score: 0, n: good.length }); S = newMatch('daily', players, good, { day: mvDay(), len: lenPick }); }
      else {
        const bots = shuffle(CPUS).filter(n => n.toLowerCase() !== me0.name.toLowerCase()).slice(0, Math.max(1, Math.min(9, (nPlayers || 4) - 1)));
        players = players.concat(bots.map((n, i) => ({ id: 'cpu' + i, name: n, cpu: 1, sk: (rnd() - .5) * .16, ch: cpuChar(n), score: 0, right: 0, fast: 0 })));
        S = newMatch('cpu', players, good, { len: lenPick });
      }
      closeToast(); S.at = Date.now(); mode = kind; myPicks = {}; buildMatch(); commit(); hostSched();
    });
  });
}
function soloQuit() { clearHost(); stopClip(); pausedAt = 0; if (mode === 'daily' && S && S.phase !== 'over') { const m = me(); dailySave({ started: 1, done: 1, right: m ? m.right | 0 : 0, score: m ? m.score : 0, n: S.n, quit: 1 }); }
  S = null; mode = null; closeSheet(); renderHome(); }
/* solo: pause while the page is hidden, sideways or the menu is open (the clock, the computers and the clip stop);
   online never pauses (the clip is only silenced while hidden) */
function pauseSolo() { if (S && (mode === 'cpu' || mode === 'daily') && S.phase !== 'over' && !pausedAt) { pausedAt = Date.now(); clearHost(); AU.sleep(); if (!HAS_WA) stopClip(); } }
function resumeSolo() { if (!pausedAt || !S) return; const d = Date.now() - pausedAt; pausedAt = 0; S.at += d; AU.unlock(); if (S.phase === 'q') cpuGo(); hostSched(); render(); }
let rotPaused = false;
document.addEventListener('visibilitychange', () => { if (document.hidden) { AU.sleep(); pauseSolo(); } else { if (!rotPaused && !menuPaused) resumeSolo(); if (!pausedAt) AU.unlock(); } });
const ROT_MQ = window.matchMedia ? matchMedia('(orientation:landscape) and (max-height:520px) and (hover:none),(orientation:landscape) and (max-height:520px) and (pointer:coarse)') : null;
function rotCheck() { if (!ROT_MQ) return; if (ROT_MQ.matches) { if (!pausedAt) { pauseSolo(); rotPaused = !!pausedAt; } } else if (rotPaused) { rotPaused = false; if (!document.hidden) resumeSolo(); } }
if (ROT_MQ) { if (ROT_MQ.addEventListener) ROT_MQ.addEventListener('change', rotCheck); else if (ROT_MQ.addListener) ROT_MQ.addListener(rotCheck); }

/* =====================================================================
   ONLINE (shared/net.js)
   ===================================================================== */
function viewFor(pid) { if (!S) return null; const d = clone(S), hide = d.phase === 'q' || d.phase === 'adv';
  d.rounds = d.rounds.slice(0, Math.max(0, d.qi + 2)).map((R, i) => {
    if (i > d.qi) return { k: R.k, kc: R.kc, kt: R.kt, pre: 1 };                        /* the next clip only, to load it early */
    if (i === d.qi && hide) { ['c', 'id', 't', 'tl', 'a', 'aDv', 'y', 'g', 'u', 'd'].forEach(k => delete R[k]); } return R; });
  if (d.phase === 'q') { const pk = {}; Object.keys(d.picks).forEach(id => { pk[id] = id === pid ? d.picks[id] : { p: -1 }; }); d.picks = pk; }
  return d; }
function seatFrom(s) { const ch = s.id === myId ? myChar() : lookCh(s.look);
  if (s.cpu) return { id: s.id, name: s.name, cpu: 1, sk: (rnd() - .5) * .16, ch: ch || cpuChar(s.name), score: 0, right: 0, fast: 0 };
  return { id: s.id, name: s.name, ch, score: 0, right: 0, fast: 0 }; }
function netStart(seats, opts, info) { mode = 'online'; clearHost(); myPicks = {};
  const quick = !!(info && info.quick), n = quick ? NR : ([5, 10, 15].includes(+opts.count) ? +opts.count : NR);
  const len = quick ? QUICK_LEN : (LENS.some(x => x[0] === +opts.clip) ? +opts.clip : QUICK_LEN);
  S = newMatch('online', seats.map(seatFrom), [], { quick, n, len }); closeSheet(); buildMatch(); commit(); brk(true);
  loadContent().then(() => { if (!S || !online() || !NET.isHost()) return;
    S.rounds = pickRounds(n, ALL_DIFFS); S.n = Math.min(n, S.rounds.length);
    if (S.n < 3) { toast('Not enough songs are live yet for a match.', 4000); NET.leave(); return; }
    preload(S.rounds.slice(0, 2)); S.at = Date.now(); commit(); hostSched(); });
  hostSched(); }
function netAction(pid, a) { if (!S || !a || typeof a !== 'object' || !hostOn()) return;
  if (a.t === 'ans') { if ((a.q | 0) !== S.qi || S.phase !== 'q') return; const pl = S.players.find(p => p.id === pid); if (!pl || pl.cpu || pl.gone) return;
    const el = Date.now() - S.at; if (el > Q_MS + GRACE) return;
    hostPick(pid, a.pick | 0, Math.max(0, Math.min(Q_MS, el, +a.ms || 0)), a.rp ? 1 : 0); } }
function netSeatSwap(cid, pl) { if (!hostOn() || !S || !pl || !pl.id) return false; if (S.phase === 'q' || S.phase === 'over') return false;
  const k = S.players.findIndex(p => p.id === cid); if (k < 0 || S.players.some(p => p.id === pl.id)) return false;
  const p = S.players[k]; p.id = pl.id; p.name = String(pl.name || 'Player').slice(0, 20); p.ch = lookCh(pl.look); delete p.cpu; delete p.sk; commit(); return true; }
function netDrop(pid) { if (!hostOn() || !S) return; const p = S.players.find(x => x.id === pid); if (!p || p.cpu) return; p.gone = 1; commit(); if (S.phase === 'q') hostSched(); }
let wasSpec = null;
function netState(v, meta, info) { if (!v || !Array.isArray(v.players)) return; mode = 'online'; const N = v; N.at = (N.at || Date.now()) - (NET.skew() || 0);
  const spec = info ? !!info.spec : null, flip = wasSpec === true && spec === false; wasSpec = spec;
  const fresh = screen !== 'match' || !S || S.gid !== N.gid || flip; S = N;
  (S.rounds || []).slice(S.qi, S.qi + 2).forEach(R => { if (R && R.k) loadClip(R).catch(() => {}); });
  if (fresh) { closeSheet(); myPicks = {}; buildMatch(); } render(); }
function netMigrate(o) { mode = 'online'; clearHost(); const b = o.backup;
  if (!b || !b.gid || !Array.isArray(b.players)) { if (o.view && o.view.phase === 'over') { S = o.view; buildMatch(); render(); return; } NET.again(); return; }
  S = clone(b); S.at = (S.at || Date.now()) - (o.skew || 0); S.players.forEach(p => { if (p.id === o.oldHost && !p.cpu) p.gone = 1; });
  if (screen !== 'match') buildMatch();
  if (S.phase === 'q') { S.at = Date.now(); S.picks = {}; planCpus(); } else if (S.phase !== 'over') S.at = Date.now();
  if (S.phase === 'over') { render(); NET.matchOver(); return; }
  if (S.phase === 'rev' || S.phase === 'stand' || S.phase === 'adv') brk(true);
  commit(); hostSched(); toast('The host left, so you run the match now.', 3500); }
function netLobby() { wasSpec = null; clearHost(); stopClip(); S = null; closeSheet(); if (screen === 'match') renderHome(); }
function netEnd() { wasSpec = null; clearHost(); stopClip(); mode = null; S = null; closeSheet(); renderHome(); }
function cpuSeat(i, taken) { const t = new Set((taken || []).map(x => String(x).toLowerCase())); const n = shuffle(CPUS).find(x => !t.has(x.toLowerCase())); if (!n) return null; const ch = cpuChar(n); return { name: n, look: ch ? { ch } : null }; }
function initNet() { if (!window.DGNet) return; NET = DGNet.create({ game: 'song', title: 'Guess the Song', min: 2, max: 6, id: myId,
  cpu: true, quickSize: 4, cpuSeat, onSeatSwap: netSeatSwap,
  me: () => ({ name: myName(), look: { ch: myChar() } }), setName: v => { ls.set('lg-name', v); if (screen === 'home') renderHome(); },
  avatar: (seat, size) => { const s = avHTML({ name: seat.name, ch: lookCh(seat.look) }, size); return s.replace(/^<span class="av"[^>]*>|<\/span>$/g, '').replace(/^<span class="ai[^"]*"[^>]*>|<\/span>$/g, ''); },
  options: [{ k: 'count', label: 'Songs', def: 10, choices: [[5, '5 songs'], [10, '10 songs'], [15, '15 songs']] },
    { k: 'clip', label: 'Clip length', def: 3, choices: LENS.map(x => [x[0], x[0] + ' s · ×' + x[1].toFixed(1)]), hint: () => 'Friends tables give XP, no Boli' }],
  rulesNote: '2 to 6 players. Everyone hears the same short clip of a Dhivehi song. Lock a title early for more points; a shorter clip scores more; one replay costs 20%. Miss 2 rounds in a row and you are marked away.',
  listInfo: m => S && m.status !== 'lobby' ? 'Round ' + Math.max(1, S.qi + 1) + ' of ' + S.n : ((m.opts && m.opts.count) || 10) + ' songs',
  dropText: (nm, why) => nm + (why === 'afk' ? ' is away' : why === 'left' ? ' left' : ' lost connection') + '. Their points stay on the board.',
  afkText: 'You missed 2 rounds in a row, so you were marked away. You can’t rejoin this match.',
  hostAfkText: 'You missed 2 rounds in a row, so you are marked away. You’ll leave the table when this match ends.',
  onStart: netStart, view: pid => viewFor(pid), backup: () => S, onAction: netAction, onDrop: netDrop, onState: netState, onLobby: netLobby, onMigrate: netMigrate, onEnd: netEnd,
  toast: (t, ms) => toast(t, ms),
  dockHost: () => screen === 'match' ? document.getElementById('dockHost') : null,
  avatarEl: pid => { if (screen !== 'match') return null; const q = CSS.escape(pid); return document.querySelector(`#strip .pl[data-pid="${q}"] .av`); } }); }

/* =====================================================================
   UI: home (the lobby)
   ===================================================================== */
let spCtl = null, liveN = 0;
const liveText = () => liveN > 0 ? liveN + ' playing now' : 'Be the first to play';
function offHome() { if (spCtl) { try { spCtl.destroy(); } catch (e) {} spCtl = null; } }
const hp = () => `<a class="pill hp" href="../" aria-label="Back to Dhivehi Games">${I.back}${pcMark()}</a>`;
const chipsHTML = () => `<div class="pick"><div class="ph"><b>Clip length</b><small>Shorter clip, more points</small></div><div class="chips" role="group" aria-label="Clip length">${LENS.map(([l, m]) => `<button class="chip" data-a="len" data-l="${l}" aria-pressed="${l === lenPick}" aria-label="${l} second clip, points times ${m.toFixed(1)}"><b>${l} s</b><small>×${m.toFixed(1)}</small></button>`).join('')}</div></div>`;
function renderHome() { screen = 'home'; offHome(); document.documentElement.dataset.scr = 'home'; homeT0 = performance.now();
  const nm = myName(), p = meP(), d = dailyRec();
  let body;
  if (contentState === 'ok') body = `${chipsHTML()}<section class="modes" aria-label="Play">
 <button class="md qm" data-a="quick"><span class="mi">${I.bolt}</span><span class="mt"><b>Quick Match</b><small>Play real people now</small><span class="live" id="qmLive"><i></i><span>${liveText()}</span></span></span></button>
 <button class="md" data-a="friends"><span class="mi">${I.friends}</span><span class="mt"><b>Play with Friends</b><small>Create or join a table</small></span>${I.chev}</button>
 <button class="md" data-a="cpu"><span class="mi">${I.cpu}</span><span class="mt"><b>vs Computer</b><small>2–10 players · offline</small></span>${I.chev}</button>
 <div class="two"><button class="md${d ? ' done' : ''}" data-a="daily"><span class="mt"><b>Daily challenge</b><small>${esc(dailyLine())}</small></span></button><button class="md" data-a="howto"><span class="mt"><b>How to play</b><small>Rules &amp; Boli</small></span></button></div>
</section>`;
  else if (contentState === 'loading') body = `<section class="soon" aria-live="polite"><span class="k">One moment</span><h2>Setting the needle…</h2><p>Loading today’s songs.</p></section>`;
  else if (contentState === 'error') body = `<section class="soon" aria-live="polite"><span class="k">Out of signal</span><h2>No songs reached us</h2><p>We couldn’t reach the list of songs. Check your connection and try again.</p><div class="row"><button class="btn am" data-a="retry">Try again</button><button class="btn gh" data-a="howto">How to play</button></div></section>`;
  else body = `<section class="soon" id="soon" aria-live="polite"><span class="k">The record is warming up</span><h2>Coming soon</h2><p>We are asking Maldivian artists for permission to use their songs. Once the first songs are cleared, you’ll hear a few seconds and name them here.</p><div class="row"><button class="btn gh" data-a="howto">How to play</button></div></section>`;
  app.innerHTML = `<main class="page home">
<div class="tb">${hp()}<button class="pill pp" data-a="name" aria-label="Your name: ${esc(nm || 'not set')}. Change">${avHTML(p, 38)}<span class="pn"><b>${nm ? esc(nm) : 'Player'}</b><small>${isReg() ? 'Your username' : nm ? 'Tap to rename' : 'Set your name'}</small></span></button><a class="pill bp" href="../digu/?open=boli" aria-label="${shells()} Boli">${BOLI_IMG}<span>${fmtBoli(shells())}</span></a></div>
<div class="lob"><h1>Guess <br><i>the</i> Song</h1><span class="ldv" lang="dv" dir="rtl">މި ލަވައަކީ ކޮބާ؟</span><p>A record under soft daylight. Hear a few seconds, then name the song.</p>${deckHTML('lob', 1)}</div>
${body}
<div class="spbox"><div id="spbox"></div><p class="snote">Part of <a href="../">Dhivehi Games</a>. Boli you earn here spend in the Digu store.</p></div>
</main>`;
  const el = $('#spbox'); if (el && window.DGSponsors) { try { spCtl = DGSponsors.box(el); } catch (e) {} }
  if (NET && NET.playing) { try { NET.playing(n => { liveN = n | 0; const l = $('#qmLive span'); if (l) l.textContent = liveText(); }); } catch (e) {} } }
let homeT0 = 0;
function homeTick(ts) { const s = document.querySelector('.lob .stk'); if (!s || reduce) return; const T = (ts - homeT0) / 1000; s.style.transform = `rotate(${(18 + T * 9).toFixed(2)}deg)`; }

/* =====================================================================
   UI: the match (top bar, player strip, turntable, answers) drawn every frame from (phase, time)
   ===================================================================== */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, s, d) => clamp((t - s) / d);
const eOut = x => 1 - Math.pow(1 - x, 3);
const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, k) => a + (b - a) * k;
const M = () => reduce ? 0 : 1;
const pad2 = n => String(n).padStart(2, '0');
let lastKey = '', raf = 0, lastSec = -1, cueKey = '', lastTs = 0, revKey = '';

function buildMatch() { screen = 'match'; offHome(); document.documentElement.dataset.scr = 'match'; lastKey = ''; revKey = '';
  app.innerHTML = `<main class="page match" id="match">
<div class="gt"><button class="pill menu" data-a="menu" aria-label="Menu">${I.menu}</button><div class="round" id="rnd"></div><div class="pill myscore" id="my">0</div></div>
<div class="strip" id="strip" aria-label="Players"></div>
<div class="stage" id="stage">
 <div class="tt" id="tt"><div class="tbox" id="tbox"></div><div class="cover" id="cover"></div></div>
 <div class="strow"><span class="stx"><b id="stB">Listening</b><small id="stS"></small></span><button class="rp" id="rp" data-a="replay">${I.replay}<span><b id="rpB">Replay</b><small id="rpS">once · −20%</small></span></button></div>
 <div class="trow"><span class="tm"><span id="secs">15</span> s</span><span class="tbar"><i id="tb"></i></span><span class="pts"><span id="uptoL">up to</span> <b id="upto"></b></span></div>
 <div class="ca" id="ans">${[0, 1, 2, 3].map(i => `<button class="an" data-a="ans" data-i="${i}"><span class="k">${'ABCD'[i]}</span><span class="dv" lang="dv"></span><span class="tl"></span><span class="ar"></span></button>`).join('')}</div>
</div>
<div class="revp" id="revp" hidden></div>
<div id="panelHost" style="display:none;flex-direction:column;flex:1 1 auto;min-height:0"></div>
<div class="dockrow" id="dock"><span id="dockHost"></span></div>
</main>`;
  if (online() && NET) NET.updDock();
  setTimeout(rotCheck, 0); }
function loop(ts) { try { const dt = Math.min(.1, Math.max(0, (ts - (lastTs || ts)) / 1000)); lastTs = ts; if (screen === 'match') tickFrame(dt); else if (screen === 'home') homeTick(ts); } catch (e) { console.error(e); } raf = requestAnimationFrame(loop); }
addEventListener('resize', () => { if (screen === 'match') { lastKey = ''; } });
const css = (el, o, tf) => { if (!el) return; el.style.opacity = o; if (tf !== undefined) el.style.transform = tf; };
const setT = (el, v) => { if (el && el._t !== v) { el.textContent = v; el._t = v; } };
const setH = (el, v) => { if (el && el._h !== v) { el.innerHTML = v; el._h = v; } };
/* the deck: drawn at 358 x 350, scaled to the room between the strip and the answers */
function fitDeck() { const tt = $('#tt'), tb = $('#tbox'); if (!tt || !tb) return; const W = tt.clientWidth, H = tt.clientHeight; if (!W || !H) return;
  const k = Math.max(.3, Math.min(W / 358, H / 350, 1.2)); tt.style.setProperty('--k', k.toFixed(4)); tb.style.top = Math.max(0, (H - 350 * k) / 2).toFixed(1) + 'px'; }

/* the player strip: pills placed by rank, re-ordered with a slide after each reveal; +points chips below them */
function stripLayout() { const st = $('#strip'); if (!st) return null; const W = st.clientWidth || 358, n = S.players.length, gap = 6;
  const pitch = (W + gap) / n, pw = pitch - gap; return { W, n, pitch, pw, mini: pw < 74 }; }
function buildStrip() { const st = $('#strip'), L = stripLayout(); if (!L) return; const k0 = meIdx();
  st.classList.toggle('mini', L.mini);
  st.innerHTML = S.players.map((p, k) => `<div class="pl${k === k0 ? ' me' : ''}${p.gone ? ' gone' : ''}" data-pid="${esc(p.id)}" style="width:${L.pw.toFixed(1)}px">${avHTML(p, L.mini ? Math.min(28, L.pw - 6) : 34, k)}<span class="lock">${I.tick(9)}</span><span class="n">0</span></div>`).join('')
    + S.players.map((p, k) => `<span class="fly${k === k0 ? ' me' : ''}" data-f="${k}"></span>`).join('');
  st._L = L; }
const short = v => v >= 10000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k' : fmt(v);
function drawStrip(t) {
  const st = $('#strip'); if (!st || !st._L) return; const L = st._L, ph = S.phase, Mo = M();
  const ids = S.players.map(p => p.id), rev = ph === 'rev';
  const after = rankIds(S).concat(S.players.filter(p => p.gone).map(p => p.id));
  const before = rev && S.prev ? S.prev.concat(ids.filter(id => !S.prev.includes(id))) : after;
  const moved = rev ? eIO(prog(t, 2.6, .6)) : 1, ord = moved >= .5 ? after : before;
  const cnt = rev ? eOut(prog(t, 1.4, .6)) : 1;
  const pills = st.querySelectorAll('.pl'), flies = st.querySelectorAll('.fly');
  S.players.forEach((p, i) => { const el = pills[i]; if (!el) return;
    const slot = Math.max(0, ord.indexOf(p.id)), x = slot * L.pitch;
    const tf = `translateX(${x.toFixed(1)}px)`; if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; el.style.zIndex = slot === 0 ? 2 : 1; }
    const sc = p.gone ? null : (rev && p.gain > 0 ? p.score - p.gain + p.gain * cnt : p.score);
    setT(el.querySelector('.n'), p.gone ? (p.afk ? 'Away' : 'Left') : (L.mini ? short(sc) : fmt(sc)));
    const lockOn = ph === 'q' && !!(S.picks[p.id] || (p.id === myId && myPicks[S.qi] != null));
    const lk = el.querySelector('.lock'); if (lk._on !== lockOn) { lk.classList.toggle('on', lockOn); lk._on = lockOn; }
    const f = flies[i]; if (!f) return;
    if (!rev || p.gain == null || p.gone) { f.style.opacity = 0; return; }
    setT(f, p.gain ? '+' + (L.mini ? short(p.gain) : fmt(p.gain)) : '0'); f.classList.toggle('zero', !p.gain);
    const bslot = Math.max(0, before.indexOf(p.id)), show = eOut(prog(t, .55 + i * .05, .3)), out = prog(t, 2.3, .3);
    const fw = f.offsetWidth || 50, cx = bslot * L.pitch + Math.min(L.pw, Math.max(fw, L.pw * .7)) / 2;
    f.style.opacity = show * (1 - out); f.style.transform = `translate(${(cx - fw / 2).toFixed(1)}px,${(8 * (1 - show) * Mo - 10 * out * Mo).toFixed(1)}px)`; });
}

function tickFrame(dt) {
  if (screen !== 'match' || !S) return;
  const t = (now() - S.at) / 1000, panel = S.phase === 'stand' || S.phase === 'over';
  const key = [S.gid, S.qi, panel ? S.phase : S.phase === 'rev' ? 'rev' : 'play', !!(S.rounds && S.rounds[S.qi])].join('|');
  if (key !== lastKey) layoutFor(key);
  if (panel) { panelTick(); return; }
  topBar(t);
  if (S.phase === 'rev') drawRev(t); else drawPlay(t, dt);
  drawStrip(t);
  const m = me(), myScore = m ? (S.phase === 'rev' && m.gain > 0 ? m.score - m.gain + m.gain * eOut(prog(t, 1.4, .6)) : m.score) : 0;
  setT($('#my'), fmt(myScore));
}
function layoutFor(key) {
  const prevKey = lastKey; lastKey = key;
  const panel = S.phase === 'stand' || S.phase === 'over', rev = S.phase === 'rev';
  $('#stage').hidden = panel || rev; $('#revp').hidden = !rev; $('#strip').hidden = panel;
  $('#panelHost').style.display = panel ? 'flex' : 'none';
  if (panel) { $('#panelHost').innerHTML = S.phase === 'stand' ? standHTML() : overHTML(); if (S.phase === 'over') overFx(); return; }
  buildStrip();
  if (rev) { stopClip(); buildRev(); return; }
  /* a new round: a fresh record with its own label (the turntable itself is only drawn once per round) */
  const R = S.rounds[S.qi], tb = $('#tbox'), roundKey = S.gid + ':' + S.qi;
  if (tb._rk !== roundKey) { tb.innerHTML = deckHTML('q', R ? R.art | 0 : 0); tb._rk = roundKey; ['disc', 'stk', 'arm', 'ring', 'rdy'].forEach(id => { tb['_' + id] = tb.querySelector('#' + id); }); }
  fitDeck(); lastSec = -1;
  void prevKey;
}
function topBar(t) { const rndEl = $('#rnd'); if (!rndEl) return; const k = S.qi + '/' + S.n;
  if (rndEl._k !== k) { rndEl.innerHTML = `Round ${S.qi + 1} <em>/ ${S.n}</em>`; rndEl._k = k; } }
/* answer buttons */
function ansState(t) {
  const R = S.rounds[S.qi], k0 = meIdx(), spec = k0 < 0 || (me() && me().gone);
  const mine = S.picks[myId] ? S.picks[myId].p : myPicks[S.qi];
  const adv = S.phase === 'adv', show = adv ? eOut(prog(t, ADV_MS / 1000 - .35, .3)) : 1;
  document.querySelectorAll('#ans .an').forEach((b, i) => {
    const o = R && R.opts && R.opts[i];
    setT(b.querySelector('.dv'), o ? o.t : ''); setT(b.querySelector('.tl'), o ? (o.tl || '') : ''); setT(b.querySelector('.ar'), o ? (o.a || '') : '');
    const locked = mine != null || spec || S.phase !== 'q';
    if (b.disabled !== locked) b.disabled = locked;
    const lab = o ? 'ABCD'[i] + ': ' + (o.tl || o.t) + (o.a ? ', ' + o.a : '') : 'ABCD'[i]; if (b._l !== lab) { b.setAttribute('aria-label', lab); b._l = lab; }
    b.classList.toggle('mine', mine === i && !adv); b.classList.toggle('dim', S.phase === 'q' && mine != null && mine !== i);
    b.style.opacity = adv ? show : ''; b.style.transform = adv ? `translateY(${(6 * (1 - show) * M()).toFixed(1)}px)` : '';
  });
}
function drawPlay(t, dt) {
  const R = S.rounds[S.qi], tb = $('#tbox'); if (!R || !tb || !tb._disc) return;
  const ph = S.phase, Mo = M(), cs = csNow(), mine = S.picks[myId] || (myPicks[S.qi] != null ? { p: myPicks[S.qi] } : null);
  /* the clip: the needle lands NEEDLE s after the round starts */
  if (ph === 'q' && !cs.started && t >= NEEDLE && !pausedAt && !document.hidden) { if (playClip(false)) SFX.needle(); }
  const st = clipNow();
  /* tone-arm: in while the clip plays (it starts its swing just before the needle lands), lifts when it stops */
  const want = ph === 'q' && (st.playing || (!cs.started && t > NEEDLE - .45 && !cs.need)) ? 1 : 0;
  cs.armE += (want - cs.armE) * (1 - Math.exp(-(dt || .016) / (want ? .16 : .24)));
  const armA = Mo ? -4 + cs.armE * (15 + 5 * st.prog) : (want ? 13 : -4);
  if (tb._arm) tb._arm.style.transform = `rotate(${armA.toFixed(2)}deg)`;
  /* the record: 33⅓ rpm while the clip plays; on the round's start it settles onto the platter */
  const settle = ph === 'adv' && Mo ? eOut(prog(t, .1, .7)) : 1;
  const ang = -30 + st.played * .55 * 360 - (1 - settle) * 70;
  tb._disc.style.transform = `translate(${(-(1 - settle) * 380).toFixed(1)}px,0) rotate(${ang.toFixed(2)}deg)`;
  tb._disc.style.opacity = Mo ? Math.min(1, settle * 1.8).toFixed(3) : 1;
  const T = performance.now() / 1000;
  if (tb._stk) { tb._stk.style.transform = `rotate(${(18 + (Mo ? T * 9 : 0) + st.played * 14).toFixed(2)}deg)`; tb._stk.style.opacity = (.8 + .2 * cs.armE) * settle; }
  if (tb._ring) tb._ring.style.strokeDashoffset = (100 * (1 - (ph === 'q' ? st.prog : 0))).toFixed(2);
  /* "Round 04 · Get ready" over the record while it changes */
  if (tb._rdy) { const a = ph === 'adv' ? Math.min(eOut(prog(t, .35, .3)), 1 - prog(t, ADV_MS / 1000 - .35, .3)) : 0; tb._rdy.style.opacity = a;
    setT(tb._rdy.querySelector('b'), 'Round ' + pad2(S.qi + 1)); }
  /* status row + replay */
  const lab = `${S.len} s clip · ×${S.mult.toFixed(1)}`;
  if (ph === 'adv') { setT($('#stB'), 'Next record'); setT($('#stS'), lab); }
  else if (cs.need === 'mute') { setT($('#stB'), 'Sound is off'); setT($('#stS'), 'Turn it on to hear the clip'); }
  else if (cs.need === 'tap' || cs.need === 'none') { setT($('#stB'), 'Tap to listen'); setT($('#stS'), lab); }
  else if (!cs.started) { setT($('#stB'), 'Needle down'); setT($('#stS'), lab); }
  else if (st.playing) { setT($('#stB'), 'Listening'); setT($('#stS'), `${st.left.toFixed(1)} s left · ${lab}`); }
  else { setT($('#stB'), 'Clip over'); setT($('#stS'), lab); }
  const rp = $('#rp'), canRp = ph === 'q' && cs.started && !cs.replayed && !st.playing && !mine && meIdx() >= 0;
  if (rp.disabled !== !canRp) rp.disabled = !canRp;
  rp.classList.toggle('used', cs.replayed);
  setT($('#rpB'), cs.replayed ? 'Replayed' : 'Replay'); setT($('#rpS'), cs.replayed ? '−20%' : 'once · −20%');
  /* a cover over the record when the clip can't play by itself */
  const cov = $('#cover'), need = ph === 'q' ? cs.need : '';
  const ch = need === 'mute' ? `<button class="cv" data-a="soundOn"><i>${I.spk}</i>Sound is off · turn on</button>` : need === 'tap' || need === 'none' ? `<button class="cv" data-a="listen"><i>${I.play}</i>Tap to listen</button>` : '';
  setH(cov, ch);
  /* timer + points */
  const qt = ph === 'q' ? Math.min(t, Q_MS / 1000) : 0, sec = Math.max(0, Math.ceil(15 - qt));
  setT($('#secs'), String(ph === 'q' ? sec : 15));
  $('#tb').style.transform = `scaleX(${ph === 'q' ? 1 - qt / 15 : 1})`;
  const up = mine ? (mine.ms != null ? ptsFor(mine.ms, S.mult, mine.rp) : lockedPts) : ptsFor(qt * 1000, S.mult, cs.replayed);
  setT($('#upto'), '+' + fmt(up)); setT($('#uptoL'), mine ? 'locked at' : 'up to');
  if (ph === 'q' && sec <= 5 && sec > 0 && sec !== lastSec && !mine && meIdx() >= 0) { lastSec = sec; SFX.tick(); }
  ansState(t);
  if (AUTO && ph === 'q') planAuto();
}
let lockedPts = 0;
/* ---------- the reveal: title, "Sung by", year, the Listen link, the four answers marked, who got it ---------- */
function buildRev() {
  const R = S.rounds[S.qi], el = $('#revp'), m = me(), k0 = meIdx(), pk = S.picks[myId], k = S.gid + ':' + S.qi;
  if (revKey === k) return; revKey = k;
  const myGot = m && !m.gone && m.gain > 0;
  const yr = [R.y ? String(R.y) : '', R.g || ''].filter(Boolean).join(' · ');
  const rows = R.opts.map((o, i) => { const right = i === R.c, mine = pk && pk.p === i;
    return `<div class="r ${right ? 'right' : 'wrong'}${mine ? ' mypick' : ''}"><span class="dv" lang="dv">${esc(o.t)}</span><span class="en"><b>${esc(o.tl || o.t)}</b><small>${esc(o.a || '')}${mine && !right ? ' · your answer' : ''}</small></span>${right
      ? `<span class="mk ok"><span class="c">${I.tick(10)}</span>Correct${right && myGot ? ` <em>+${fmt(m.gain)}</em>` : ''}</span>` : `<span class="mk no"><span class="c">${I.x(12)}</span>Not this one</span>`}</div>`; }).join('');
  const got = S.players.map((p, i) => ({ p, i, pk: S.picks[p.id] })).filter(x => !x.p.gone && x.p.gain > 0).sort((a, b) => b.p.gain - a.p.gain);
  const who = got.length ? got.map(x => `<div class="wr"><span class="ok">${I.tick(10)}</span>${avHTML(x.p, 30, x.i)}<b>${esc(x.i === k0 ? 'You' : x.p.name)}</b><small>${x.pk && x.pk.ms != null ? (x.pk.ms / 1000).toFixed(1) + ' s' : ''}${x.pk && x.pk.rp ? ' · replayed' : x.i === k0 ? ' · no replay' : ''}</small><span class="p">+${fmt(x.p.gain)}</span></div>`).join('')
    : `<div class="wr none">Nobody named this one.</div>`;
  el.innerHTML = `<div class="rv"><div class="mini">${deckHTML('mini', R.art | 0)}</div><div class="ti"><span class="dv big" lang="dv">${esc(R.t || '')}</span><span class="tl">${esc(R.tl || '')}</span><span class="sb">Sung by</span><span class="by">${esc(R.a || '')}</span>${R.aDv ? `<span class="tl" lang="dv" style="font-size:15px">${esc(R.aDv)}</span>` : ''}${yr ? `<span class="yr">${esc(yr)}</span>` : ''}</div></div>
${R.u ? `<a class="listen" href="${esc(R.u)}" target="_blank" rel="noopener noreferrer"><span class="lp">${I.play}</span>Listen to the full song${I.out}</a>` : ''}
<div class="ra">${rows}</div>
<div class="who"><div class="hd"><span>Who got it</span><span>${got.length} of ${active().length}</span></div>${who}</div>`;
  el.classList.remove('show', 'marks'); void el.offsetWidth;
  requestAnimationFrame(() => el.classList.add('show'));
  const rk = k + ':s'; if (cueKey !== rk) { cueKey = rk; setTimeout(() => { if (m && !m.gone && S && S.phase === 'rev') (m.gain > 0 ? SFX.right : SFX.wrong)(); }, 380); markSeen(R.id); }
  /* the next song's clip loads while this one is on show */
  const nx = S.rounds[S.qi + 1]; if (nx && nx.k) loadClip(nx).catch(() => {});
}
function drawRev(t) { const el = $('#revp'); if (!el) return; if (t > .45 && !el.classList.contains('marks')) el.classList.add('marks');
  const d = el.querySelector('.dsc'), s = el.querySelector('.stk'); if (d && !reduce) d.style.transform = `rotate(${(-30 + t * .3 * 360).toFixed(1)}deg)`; if (s && !reduce) s.style.transform = `rotate(${(18 + t * 9).toFixed(1)}deg)`; }
let autoQi = -1;
function planAuto() { if (!AUTO || !S || S.phase !== 'q' || meIdx() < 0 || myPicks[S.qi] != null || S.picks[myId] || autoQi === S.gid + S.qi) return; autoQi = S.gid + S.qi; const qi = S.qi; clearTimeout(autoT);
  const R = S.rounds[qi], want = window.__songAutoPick;
  autoT = setTimeout(() => { if (!S || S.qi !== qi || S.phase !== 'q') return; let c = typeof want === 'function' ? want(qi, R) : null;
    if (c == null) c = R.c != null && rnd() < .7 ? R.c : Math.floor(rnd() * 4); answer(c); }, (FAST ? 900 : (NEEDLE + S.len) * 1000 + 300) + rnd() * (FAST ? 400 : 1500)); }

/* ---------- standings (every 3 rounds) and the final results ---------- */
const songRow = (R, i, got, link) => `<div class="s"><span class="n">${i + 1}</span><span class="dv" lang="dv">${esc(R.t || '')}</span><span class="en"><b>${esc(R.tl || R.t || '')}</b><small>${esc(R.a || '')}${R.y ? ' · ' + R.y : ''}</small></span>${link && R.u ? `<a class="ls" href="${esc(R.u)}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${esc(R.tl || 'the song')} by ${esc(R.a || 'the artist')}"><i>${I.play}</i>Listen</a>` : ''}${got == null ? '' : got ? `<span class="got" aria-label="You named it">${I.tick(10)}</span>` : '<span class="got no" aria-label="Missed"></span>'}</div>`;
function standHTML() {
  const ids = rankIds(S), prev = S.prev || ids, k0 = meIdx(), n = S.qi + 1, R = S.rounds[S.qi];
  const rows = ids.map((id, r) => { const k = S.players.findIndex(p => p.id === id), p = S.players[k], pr = prev.indexOf(id), pk = S.picks[id];
    const lead = r === 0, ahead = r > 0 ? S.players.find(x => x.id === ids[r - 1]) : null;
    const mv = pr < 0 || pr === r ? (lead ? '<span class="mv">— held 1st</span>' : `<span class="mv">— ${fmt(ahead.score - p.score)} behind</span>`)
      : pr > r ? `<span class="mv up">▲ ${pr - r} place${pr - r > 1 ? 's' : ''}</span>` : `<span class="mv dn">▼ ${r - pr} place${r - pr > 1 ? 's' : ''}</span>`;
    const note = p.gain > 0 ? `Round ${pad2(n)} <em>+${fmt(p.gain)}</em>` : pk && pk.p >= 0 && R.opts[pk.p] ? `Round ${pad2(n)} · said ${esc(R.opts[pk.p].tl || R.opts[pk.p].t)}` : `Round ${pad2(n)} · no answer`;
    return `<div class="rk${lead ? ' lead' : ''}${k === k0 ? ' me' : ''}" data-pid="${esc(id)}"><span class="p">${r + 1}</span>${avHTML(p, 42, k)}<span class="nm"><b>${esc(k === k0 ? 'You' : p.name)}</b><small>${note}</small></span><span class="sc"><b>${fmt(p.score)}</b>${mv}</span></div>`; }).join('');
  const got = new Set((me() && me().got) || []);
  const last3 = S.rounds.slice(Math.max(0, S.qi - 2), S.qi + 1).map((Rr, i) => songRow(Rr, Math.max(0, S.qi - 2) + i, me() ? got.has(Math.max(0, S.qi - 2) + i) : null, false)).join('');
  const solo = mode === 'cpu', left = Math.max(1, Math.ceil((STAND_MS - (now() - S.at)) / 1000));
  return `<div class="panel" id="standings">
<div class="sth"><h2><span>${n} of ${S.n} played</span>Standings</h2><span class="lab" style="text-align:right">After<br>round ${pad2(n)}</span></div>
<div class="prog">${Array.from({ length: S.n }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>
<div class="rank${ids.length > 4 ? ' dense' : ''}">${rows}</div>
<div class="slh"><b>Just played</b><small>Songs ${pad2(Math.max(1, n - 2))}–${pad2(n)}</small></div>
<div class="sl">${last3}</div>
<div class="gap">${n + 3 < S.n ? `Next standings after round <b>${pad2(n + 3)}</b>` : `Final results after round <b>${pad2(S.n)}</b>`}</div>
<div class="nextbar" style="margin-top:12px"><span>Next round in <b id="ncd">${left}</b></span>${solo ? '<button data-a="ready">I’m ready</button>' : ''}</div></div>`;
}
let overKey = '', overAw = null, overFxK = '';
function place() { return rankIds(S).indexOf(myId); }
function xpFor() { const m = me(); if (!m || m.gone) return 0; let x = 5 + (m.right | 0); const pl = place(); if (S.kind !== 'daily' && pl >= 0 && pl < 3 && active().length > 1) x += [10, 5, 2][pl]; if (S.kind === 'daily' && m.right === S.n) x += 10; return x; }
function overAward() { const k = S.gid; if (overKey === k) return overAw; overKey = k; overAw = null; const m = me(); if (!m || m.gone) return null; const xp = xpFor();
  if (S.kind === 'daily') { const n = (m.right | 0) + (m.right === S.n ? BOLI_DAILY_PERFECT : 0); overAw = award('song:daily:' + S.day, n, xp) || { sh: 0, xp: 0 }; dailySave({ started: 1, done: 1, right: m.right | 0, score: m.score, n: S.n }); }
  else if (S.kind === 'online' && S.quick) { const pl = place(); overAw = award('song:' + S.gid, pl >= 0 && pl < 3 ? BOLI_QUICK[pl] : 0, xp) || { sh: 0, xp: 0 }; overAw.pl = pl; }
  else if (S.kind === 'cpu') { const b = place() === 0 && S.players.length >= 4 ? BOLI_CPU_WIN : 0; overAw = award('song:' + S.gid, b, xp) || { sh: 0, xp: 0 }; overAw.cpu = 1; }
  else { overAw = award('song:' + S.gid, 0, xp) || { sh: 0, xp: 0 }; overAw.friends = 1; }
  return overAw; }
function overFx() { if (overFxK === S.gid) return; overFxK = S.gid; const m = me(); if (!m) return; if ((S.kind !== 'daily' && place() === 0) || (S.kind === 'daily' && m.right >= 7)) SFX.win(); }
function overHTML() {
  const aw = overAward(), k0 = meIdx(), m = me(), ids = rankIds(S), P = ids.map(id => S.players.find(p => p.id === id)), ki = p => S.players.indexOf(p);
  const named = m ? m.right | 0 : 0, nm = p => ki(p) === k0 ? 'You' : p.name;
  const pod = (p, r) => p ? `<div class="pd p${r + 1}" data-pid="${esc(p.id)}">${avHTML(p, [72, 54, 48][r], ki(p))}<b>${esc(nm(p))}</b><span class="sc">${fmt(p.score)}</span><div class="step">${r + 1}</div></div>` : '<div class="pd"></div>';
  const rest = P.slice(3).map((p, i) => `<div class="fourth" data-pid="${esc(p.id)}"><span class="n">${i + 4}</span>${avHTML(p, 30, ki(p))}<b>${esc(nm(p))}</b><span class="sc">${fmt(p.score)}</span></div>`).join('')
    + S.players.filter(p => p.gone).map(p => `<div class="fourth"><span class="n">–</span>${avHTML(p, 30)}<b>${esc(p.name)}</b><span class="sc">${p.afk ? 'Away' : 'Left'}</span></div>`).join('');
  let earn = '';
  if (aw) { const why = S.kind === 'daily' ? `${named} of ${S.n} named` : S.kind === 'online' && S.quick ? (aw.pl >= 0 && aw.pl < 3 ? ['first', 'second', 'third'][aw.pl] + ' place' : 'Quick Match') : S.kind === 'cpu' ? (aw.sh ? 'a win against the computer' : 'vs Computer') : 'Friends table';
    earn = aw.sh > 0 ? `<div class="earn">${BOLI_IMG}<span><b>+${aw.sh} Boli</b> for ${why} · ${named} of ${S.n} named${aw.capped ? ' (daily limit)' : ''}${aw.xp ? ' · +' + aw.xp + ' XP' : ''}</span></div>`
      : `<div class="earn">${BOLI_IMG}<span>${named} of ${S.n} named${aw.xp ? ' · <b>+' + aw.xp + ' XP</b>' : ''}${S.kind === 'cpu' ? ' · win against 3+ computers for +' + BOLI_CPU_WIN + ' Boli' : S.kind === 'online' && !S.quick ? ' · Friends tables give no Boli' : ''}</span></div>`; }
  const got = new Set((m && m.got) || []);
  const songs = S.rounds.slice(0, S.n).map((R, i) => songRow(R, i, m ? got.has(i) : null, true)).join('');
  const host = online() && NET && NET.isHost();
  const acts = mode === 'cpu' ? `<div class="acts"><button class="btn gh" data-a="home">Lobby</button><button class="btn am" data-a="again">Play again</button></div>`
    : mode === 'daily' ? `<p class="waitline">New songs at midnight, Maldives time.</p><div class="acts one"><button class="btn am" data-a="home">Back to the lobby</button></div>`
    : host ? `<div class="acts"><button class="btn gh" data-a="netLeave">Leave</button><button class="btn am" data-a="netAgain">Play again</button></div>`
    : `<p class="waitline">${k0 < 0 ? 'The next match starts soon.' : 'Waiting for the host to start the next match…'}</p><div class="acts one"><button class="btn gh" data-a="netLeave">Leave table</button></div>`;
  const kind = S.kind === 'daily' ? 'Daily challenge' : S.kind === 'cpu' ? 'vs Computer' : S.quick ? 'Quick Match' : 'Friends table';
  const head = S.kind === 'daily' ? `<div class="podium" style="grid-template-columns:1fr"><div class="pd p1">${avHTML(m || meP(), 72, 0)}<b>You</b><span class="sc">${fmt(m ? m.score : 0)}</span><div class="step" style="height:62px;font-size:28px">${named}/${S.n}</div></div></div>`
    : `<div class="podium">${pod(P[1], 1)}${pod(P[0], 0)}${pod(P[2], 2)}</div>${rest ? `<div class="rest">${rest}</div>` : ''}`;
  return `<div class="panel" id="results"><div class="rh"><h2>That’s<br><i>the record</i></h2><span class="lab" style="text-align:right">${kind}<br>${S.n} songs · ${S.len} s clips</span></div>
${head}${earn}<div class="slh"><b>Songs played</b><small>Thank you to every artist</small></div><div class="sl" id="songsPlayed">${songs}</div>${acts}</div>`;
}
function panelTick() { if (S.phase === 'stand') { const e = $('#ncd'); if (e) setT(e, String(Math.max(1, Math.ceil((STAND_MS - (now() - S.at)) / 1000)))); } }

/* render(): called on every state change; the frame loop does the drawing */
function render() { if (screen !== 'match' || !S) return;
  document.getElementById('match').classList.toggle('watching', online() && !!NET && NET.isSpectator());
  if (online() && NET) NET.updDock(); }

/* ---------- sheets, menu, toasts ---------- */
function sheet(h) { $('#sheetB').innerHTML = h; $('#sheet').classList.add('open'); }
function closeSheet() { $('#sheet').classList.remove('open'); }
let toastT = 0;
function toast(t, ms) { const e = $('#toast'); e.textContent = t; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), ms || 2600); }
function closeToast() { clearTimeout(toastT); $('#toast').classList.remove('show'); }
function howHTML() { return `<div class="rules">
<p><b>Guess the Song</b> plays a few seconds of a Dhivehi song. Name it before the others do.</p>
<h3>A round</h3>
<p>The needle drops and the clip plays: <b>5, 3, 2 or 1 second</b>, as chosen in the lobby. Then pick the song from four: each shows its title in Thaana, the title in Latin letters and the artist. You have <b>15 seconds</b>.</p>
<p>Tap an answer to <b>lock</b> it. The sooner you lock a right answer, the more you score: <b>1000</b> straight away, 30 less every second. A shorter clip multiplies your points: <b>5 s ×1.0, 3 s ×1.3, 2 s ×1.6, 1 s ×2.0</b>. You may <b>replay</b> the clip once; a right answer after a replay scores 20% less. A wrong answer or no answer scores nothing.</p>
<p>After each round you see the title, who sang it, the year if we know it, and a link to listen to the full song.</p>
<h3>A match</h3>
<p>A match is <b>10 songs</b>. The standings show after every third song, and the top three go on the podium. The results list every song played, with its artist.</p>
<h3>Ways to play</h3>
<p><b>Quick Match</b>: play real people now with 3-second clips; computer players fill empty seats. <b>Play with Friends</b>: create a table or join with a code; the host picks the clip length. <b>vs Computer</b>: 2 to 10 players, works offline once the songs have loaded. <b>Daily challenge</b>: the same 10 songs for everyone that day (Maldives time), one try.</p>
<h3>Boli</h3>
<p>Quick Match: ${BOLI_QUICK[0]} for 1st, ${BOLI_QUICK[1]} for 2nd, ${BOLI_QUICK[2]} for 3rd. Daily challenge: 1 for each song you name, ${BOLI_DAILY_PERFECT} extra for all ten. vs Computer: +${BOLI_CPU_WIN} for a win against 3 or more computers. Friends tables give XP, no Boli. The usual daily Boli limit applies.</p>
<h3>The songs</h3>
<p>Every song is in the game with its artist’s permission (or from an official source), and only a few seconds are played. Something wrong? Tell us from the Dhivehi Games home page.</p></div>`; }
function openHowTo() { sheet(`<div class="grab"></div><h2>How to play</h2>${howHTML()}<div class="row"><button class="btn am" data-a="close">Got it</button></div>`); }
function openName() { const nm = myName(); if (isReg()) { sheet(`<div class="grab"></div><h2>Your name</h2><p class="muted" style="margin:6px 0 0">You play as your username, <b>${esc(nm)}</b>. Change your character in Digu.</p><div class="row"><button class="btn gh" data-a="close">Close</button><a class="btn am" href="../digu/?open=profile">Edit character</a></div>`); return; }
  sheet(`<div class="grab"></div><h2>Your name</h2><p class="muted" style="margin:4px 0 0;font-size:13px">Shown to other players. Your character comes from your Digu profile.</p>
<label class="f" for="pnm">Name</label><input class="in" id="pnm" maxlength="14" value="${esc(nm)}" dir="auto" autocomplete="nickname" enterkeyhint="done">
<div class="row"><button class="btn gh" data-a="close">Cancel</button><button class="btn am" data-a="saveName">Save</button></div>`); setTimeout(() => { const i = $('#pnm'); i && i.focus(); }, 250); }
function saveName() { const v = (($('#pnm') || {}).value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14); if (!v) { toast('Enter a name first.'); return; } ls.set('lg-name', v); closeSheet(); renderHome(); }
let cpuN = (() => { const v = +ls.get('song-cpu-n'); return v >= 2 && v <= 10 ? v : 4; })();
function openCpu() { sheet(`<div class="grab"></div><h2>vs Computer</h2><p class="muted" style="margin:4px 0 0;font-size:13px">How many players, you included? 10 songs with ${lenPick} s clips (×${multFor(lenPick).toFixed(1)}). Works offline once the songs have loaded.</p>
<div class="nsel" role="group" aria-label="Players">${[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button data-a="cpuN" data-n="${n}" aria-pressed="${n === cpuN}">${n}</button>`).join('')}</div>
<div class="row"><button class="btn gh" data-a="close">Cancel</button><button class="btn am" data-a="cpuGo">Start</button></div>`); }
const sfxLabel = () => 'Sound: ' + (sfxOn() ? 'On' : 'Off');
function openMenu() { if (!S) return; const solo = mode === 'cpu' || mode === 'daily';
  const kind = S.kind === 'daily' ? 'Daily challenge' : S.kind === 'cpu' ? 'vs Computer' : S.quick ? 'Quick Match' : 'Friends table';
  sheet(`<div class="grab"></div><h2>Guess the Song</h2><p class="muted" style="margin:4px 0 0">${kind} · round ${Math.max(1, S.qi + 1)} of ${S.n} · ${S.len} s clips</p>
<div class="mlist"><button class="btn gh" data-a="howto">How to play</button><button class="btn gh" data-a="sfx" aria-pressed="${sfxOn()}">${sfxLabel()}</button>
${solo ? '<button class="btn dg" data-a="quitAsk">Quit to lobby</button>' : '<button class="btn dg" data-a="netLeave">Leave table</button>'}</div>`); }
function openQuit() { if (!S) return; const d = S.kind === 'daily' && S.phase !== 'over';
  sheet(`<div class="grab"></div><h2>Quit to lobby?</h2><p class="muted" style="margin:6px 0 0">${d ? 'Your daily challenge ends here and counts as today’s try.' : 'This match ends and won’t be saved.'}</p>
<div class="row"><button class="btn gh" data-a="close">Stay</button><button class="btn dg" data-a="quitYes">Quit to lobby</button></div>`); }
function toggleSfx(force) { ls.set('dd-sfx', (force != null ? force : !sfxOn()) ? '1' : '0'); document.querySelectorAll('[data-a="sfx"]').forEach(b => { b.setAttribute('aria-pressed', String(sfxOn())); b.textContent = sfxLabel(); });
  if (sfxOn()) { AU.unlock(); SFX.pick(); } else stopClip(); }
let menuPaused = false;
const sheetObs = new MutationObserver(() => { const open = $('#sheet').classList.contains('open');
  if (open && screen === 'match' && !pausedAt && (mode === 'cpu' || mode === 'daily')) { pauseSolo(); menuPaused = !!pausedAt; }
  else if (!open && menuPaused) { menuPaused = false; if (!document.hidden && !rotPaused) resumeSolo(); } });
sheetObs.observe($('#sheet'), { attributes: true, attributeFilter: ['class'] });
/* the cover's buttons: they are the user's tap that lets the audio start */
function listenNow() { AU.unlock(); const cs = csNow(); if (!cs) return; cs.need = '';
  const go = () => { if (!S || S.phase !== 'q') return; if (playClip(cs.started)) SFX.needle(); };
  const c = AU.get(); if (c && c.state !== 'running' && c.resume) c.resume().then(go, go); else go(); }

/* ---------- one click handler ---------- */
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
  switch (a) {
    case 'quick': if (NET) NET.quick(); else toast('Online play needs a newer browser.'); break;
    case 'friends': if (NET) NET.friends(); else toast('Online play needs a newer browser.'); break;
    case 'cpu': openCpu(); break;
    case 'len': lenPick = +b.dataset.l; ls.set('song-len', String(lenPick)); document.querySelectorAll('.chips .chip').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.l === lenPick))); break;
    case 'cpuN': cpuN = +b.dataset.n; ls.set('song-cpu-n', String(cpuN)); document.querySelectorAll('.nsel button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.n === cpuN))); break;
    case 'cpuGo': closeSheet(); soloStart('cpu', cpuN); break;
    case 'daily': soloStart('daily'); break;
    case 'retry': loadContent(true).then(renderHome); renderHome(); break;
    case 'ans': { const i = +b.dataset.i; if (S && S.phase === 'q' && myPicks[S.qi] == null && !S.picks[myId]) lockedPts = ptsFor(now() - S.at, S.mult, CS && CS.replayed); answer(i); break; }
    case 'replay': replay(); break;
    case 'listen': listenNow(); break;
    case 'soundOn': toggleSfx(true); listenNow(); break;
    case 'ready': if (hostOn() && mode === 'cpu' && S.phase === 'stand') hostAdv(S.qi + 1); break;
    case 'again': if (mode === 'cpu') { const n = S.players.length; S = null; soloStart('cpu', n); } break;
    case 'home': if (online() && NET) NET.leave(); stopClip(); S = null; mode = null; clearHost(); renderHome(); break;
    case 'netAgain': if (NET) NET.again(); break;
    case 'netLeave': closeSheet(); if (NET && online()) { if (NET.leaveAsk) NET.leaveAsk(); else NET.leave(); } else soloQuit(); break;
    case 'menu': openMenu(); break;
    case 'quitAsk': openQuit(); break;
    case 'quitYes': soloQuit(); break;
    case 'howto': openHowTo(); break;
    case 'sfx': toggleSfx(); break;
    case 'close': closeSheet(); break;
    case 'name': openName(); break;
    case 'saveName': saveName(); break; } });
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sheet').classList.contains('open')) { closeSheet(); return; }
  if (e.key === 'Enter' && e.target && e.target.id === 'pnm') { saveName(); return; }
  if (screen === 'match' && S && S.phase === 'q' && !$('#sheet').classList.contains('open') && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) {
    if (e.key === 'r' || e.key === 'R') { replay(); return; }
    const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase()); if (i >= 0 && e.key.length === 1) { lockedPts = ptsFor(now() - S.at, S.mult, CS && CS.replayed); answer(i); } } });

/* test hooks (used by the automated checks; harmless in normal play) */
window.__song = { Q_MS, NEEDLE, LENS, ptsFor, get S() { return S; }, get mode() { return mode; }, get NET() { return NET; }, get songs() { return SONGS; }, get content() { return contentState; },
  answer, replay, view: viewFor, get clip() { return CS; }, clipNow, get ctx() { return AU.get(); }, get clipOut() { return AU.clip; }, bufs: CL.bufs, get lenPick() { return lenPick; },
  /* localhost tests only: hold the current phase at t seconds (the clock, the host and the audio stop) / let it run again */
  hold: t => { if (!LOCAL || !S) return false; clearHost(); const n = Date.now(); S.at = n - t * 1000; pausedAt = n; AU.sleep(); return true; },
  release: () => { if (!LOCAL || !S) return false; resumeSolo(); return true; }, mvDay, dailyRounds, pickRounds, distractors: s => distractors(s, rnd), get pausedAt() { return pausedAt; }, recent };

/* ---------- boot ---------- */
initNet();
renderHome();
raf = requestAnimationFrame(loop);
loadContent().then(() => { if (screen === 'home') renderHome();
  if (LOCAL && Q.get('play') && contentState === 'ok') soloStart(Q.get('play') === 'daily' ? 'daily' : 'cpu', +Q.get('n') || 4); });
if (NET) NET.boot();
})();
