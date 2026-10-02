/* =====================================================================
   GUESS THE CELEBRITY · Maldives edition (Dhivehi Games)            celebrity/game.js
   Look C "Long Lens" (design-mockups/celebrity/celeb-C-lens.html), round flow as design-mockups/celebrity/round-flow,
   feature-clue reveal as design-mockups/celebrity/reveal (the "features" method).

   One engine for every mode (the same shape as the Dhivehi Quiz). The "host" runs the match: vs Computer and the
   Daily challenge on this device, online the table host (shared/net.js). S is plain JSON:
     phases  adv (film advance, Frame NN, 3·2·1) -> q (15 s, six hint cards) -> rev (flash, name, points)
             -> [stand every 3 frames] -> adv ... -> over
   view(pid) sends each player the match WITHOUT the answer of the frame being played (no name, no category, no
   right index). Players send {t:'ans',q,pick,ms}. Points by the hint showing when you lock: 1000 850 700 550 400 250.
   Content (who is live, photo addresses): celebrity/content.js. Only live people are ever loaded.
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
const C = window.DGCelebContent;

/* ---------- match rules ---------- */
const Q_MS = 15000;                                   /* 15 s a frame */
const STEP_MS = 2500;                                  /* a new hint every 2.5 s: 6 hints */
const STEP = [0.1, 2.5, 5, 7.5, 10, 12.5];             /* when each hint card drops (s) */
const PTS = [1000, 850, 700, 550, 400, 250];           /* points by the hint showing when you lock */
const NR = 10;                                         /* frames a match (Friends tables: 5, 10 or 15) */
const GRACE = 900;                                     /* online: a moment for the network after the buzzer */
const ADV_MS = FAST ? 700 : 2100, REV_MS = FAST ? 900 : 3400, STAND_MS = FAST ? 700 : 6000, CPU_SPEED = FAST ? .2 : LOCAL && Q.get('cpus') === 'quick' ? .3 : 1;   /* ?cpus=quick: localhost demo, computers answer sooner */
const DAILY_CAP = 500;
const BOLI_QUICK = [30, 20, 10];                       /* Quick Match: 1st, 2nd, 3rd */
const BOLI_DAILY_PERFECT = 10;                         /* Daily: 1 per face named, +10 for all ten */
const BOLI_CPU_WIN = 5;                                /* vs Computer: a win against 3 or more computers */
const CPU_ACC = { E: .85, M: .66, H: .46 };
const ptsFor = ms => PTS[Math.max(0, Math.min(5, Math.floor((+ms || 0) / STEP_MS)))];
const myId = (() => { if (window.DGNet && DGNet.local && /^[a-z0-9_-]{2,24}$/i.test(Q.get('pid') || '')) return Q.get('pid');
  let v = ls.get('dd-pid'); if (!v) { v = 'p' + Math.random().toString(36).slice(2, 10); ls.set('dd-pid', v); } return v; })();
const HINTS = C.HINTS;

/* ---------- icons ---------- */
const sv = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra ? ' ' + extra : ''}>${d}</svg>`;
const I = {
  back: sv('<path d="M15 5l-7 7 7 7"/>', 'class="bk"'),
  menu: sv('<path d="M4 7h16M4 12h16M4 17h10"/>', 'class="ic"'),
  bolt: sv('<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>', 'class="ic"'),
  friends: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.8.1 4.8 1.9 5.5 4.9"/>', 'class="ic"'),
  cpu: sv('<rect x="4" y="6" width="16" height="12" rx="3"/><path d="M9 11v2M15 11v2M12 3v3M8 21h8"/>', 'class="ic"'),
  cal: sv('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', 'class="ic"'),
  book: sv('<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>', 'class="ic"'),
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  tick8: '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#14110a" stroke-width="4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  okMk: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#08130d" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  noMk: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a0808" stroke-width="3.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
let pcn = 0;
function pcMark() { const id = 'pcm' + (++pcn); return `<svg class="pcm" viewBox="14.4 6.4 71.2 88.2" aria-hidden="true"><defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><rect x="-30" y="-40" width="60" height="80" rx="8" fill="#fff"/><path d="M50,32.65 A14.5,14.5 0 1 0 26.01,48.85 Q39.27,63.45 50,80 Q60.73,63.45 73.99,48.85 A14.5,14.5 0 1 0 50,32.65Z" transform="translate(0,1.5) scale(0.7778) translate(-50,-52.75)" fill="#000"/></mask></defs><g transform="translate(50,50.5) rotate(-8)"><rect x="-30" y="-40" width="60" height="80" rx="8" fill="currentColor" mask="url(#${id})"/></g></svg>`; }
const BOLI_IMG = '<img src="boli.webp" alt="" width="22" height="22">';

/* ---------- audio: soft WebAudio effects (the site-wide dd-sfx mute) ---------- */
const AU = (() => { let ctx = null, out = null;
  function get() { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (x) { return null; } } out = ctx.createGain(); out.gain.value = .8; out.connect(ctx.destination); } return ctx; }
  function unlock() { if (document.hidden) return; const c = get(); if (!c) return; try { const s = navigator.audioSession, t = window.__vcRec ? 'play-and-record' : window.__vcAt ? 'playback' : 'ambient'; if (s && s.type !== t) s.type = t; } catch (e) {}
    if (c.state !== 'running') { try { const p = c.resume(); p && p.catch && p.catch(() => {}); } catch (e) {} }
    if (!c._primed || c.state !== 'running') { c._primed = 1; try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} } }
  function sleep() { if (ctx && ctx.state === 'running') { try { const p = ctx.suspend(); p && p.catch && p.catch(() => {}); } catch (e) {} } }
  return { get, unlock, sleep, get out() { get(); return out; } }; })();
const sfxOn = () => { const v = ls.get('dd-sfx'); return v !== '0' && v !== 'off'; };
const SFX = (() => {
  function tone(t, f, dur, vol, type) { const c = AU.get(); const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(AU.out); o.start(t); o.stop(t + dur + .05); }
  function noise(t, dur, vol, hp) { const c = AU.get(), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = hp || 1800; g.gain.value = vol; s.buffer = b; s.connect(f); f.connect(g); g.connect(AU.out); s.start(t); }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const ready = () => { if (!sfxOn() || document.hidden) return null; const c = AU.get(); if (!c || c.state !== 'running') return null; return c.currentTime + .01; };
  return {
    tick() { const t = ready(); if (t == null) return; tone(t, 1760, .05, .045, 'triangle'); },
    card() { const t = ready(); if (t == null) return; noise(t, .05, .12, 2600); tone(t + .01, hz(84), .09, .03, 'triangle'); },
    pick() { const t = ready(); if (t == null) return; tone(t, hz(76), .12, .08, 'triangle'); },
    shutter() { const t = ready(); if (t == null) return; noise(t, .035, .35, 1200); noise(t + .07, .05, .25, 900); },
    blip(i) { const t = ready(); if (t == null) return; tone(t, i === 2 ? hz(88) : hz(81), .12, .05); },
    right() { const t = ready(); if (t == null) return; [72, 76, 79, 84].forEach((m, i) => tone(t + i * .07, hz(m), .5, .08)); },
    wrong() { const t = ready(); if (t == null) return; [64, 60].forEach((m, i) => tone(t + i * .14, hz(m), .4, .06, 'triangle')); },
    win() { const t = ready(); if (t == null) return; [67, 72, 76, 79, 84, 88].forEach((m, i) => tone(t + i * .09, hz(m), .8, .09)); } }; })();
['pointerdown', 'touchstart', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => AU.unlock(), { capture: true, passive: true }));

/* ---------- players, names, avatars (the same as the other games) ---------- */
const DGA = () => window.DGAvatar || null;
const PC = ['#f0b544', '#8A78F0', '#35B08F', '#E8A23A', '#2D86C9', '#C8326A'];
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

/* =====================================================================
   CONTENT: the live people (content.js). Nothing hidden is ever loaded.
   ===================================================================== */
let PEOPLE = [], contentState = 'loading', contentP = null;    /* loading | ok | soon | error */
function loadContent(force) {
  if (contentP && !force) return contentP;
  contentState = 'loading';
  contentP = C.loadLive().then(r => { PEOPLE = r.people; contentState = PEOPLE.length >= 4 ? 'ok' : 'soon'; return PEOPLE; })
    .catch(() => { PEOPLE = []; contentState = 'error'; contentP = null; return PEOPLE; });
  return contentP;
}
/* "similar category": the screen, the stage, public life, sport */
const GROUP = { Actor: 'screen', Actress: 'screen', Presenter: 'screen', Influencer: 'screen', Musician: 'stage', Designer: 'stage',
  Politician: 'public', 'Public Figure': 'public', Businessman: 'public', Athlete: 'sport', Coach: 'sport' };
const grp = c => GROUP[c] || c || '';
/* three other people, the same gender and a similar category when possible; never the same person, never a name twice */
function distractors(p, r) {
  const used = new Set([p.name.toLowerCase()]), out = [];
  const others = PEOPLE.filter(x => x.id !== p.id && x.name.toLowerCase() !== p.name.toLowerCase());
  const tiers = [others.filter(x => x.g === p.g && grp(x.c) === grp(p.c)), others.filter(x => x.g === p.g && grp(x.c) !== grp(p.c)), others.filter(x => x.g !== p.g)];
  for (const t of tiers) for (const x of shuffle(t, r)) { if (out.length >= 3) break; const k = x.name.toLowerCase(); if (used.has(k)) continue; used.add(k); out.push(x); }
  return out;
}
/* one frame: one photo of one person, four names (the person's name is the answer, whichever photo it is) */
function mkRound(p, f, r) {
  const opts = shuffle([p].concat(distractors(p, r)), r);
  return { pid: p.id, ph: f.id, k: f.k, w: f.w, h: f.h, b: f.b, d: f.d, name: p.name, cat: p.c, opts: opts.map(x => ({ id: x.id, name: x.name })), c: opts.findIndex(x => x.id === p.id) };
}
const RECENT_KEY = 'celeb-recent';
function recent() { try { const a = JSON.parse(ls.get(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch (e) { return []; } }
function markSeen(id) { if (!id) return; const a = recent().filter(x => x !== id); a.push(id); ls.set(RECENT_KEY, JSON.stringify(a.slice(-120))); }
/* n frames, n DIFFERENT people (never two photos of one person in a match); faces not seen lately first */
function pickRounds(n, diffs) {
  const pos = new Map(recent().map((id, i) => [id, i]));
  const ok = PEOPLE.map(p => ({ p, ph: p.photos.filter(f => diffs.includes(f.d)) })).filter(x => x.ph.length);
  const fresh = shuffle(ok.filter(x => !x.ph.some(f => pos.has(f.id))));
  const seen = ok.filter(x => x.ph.some(f => pos.has(f.id))).sort((a, b) => Math.max(...a.ph.map(f => pos.has(f.id) ? pos.get(f.id) : -1)) - Math.max(...b.ph.map(f => pos.has(f.id) ? pos.get(f.id) : -1)));
  return fresh.concat(seen).slice(0, n).map(x => { const un = x.ph.filter(f => !pos.has(f.id)); return mkRound(x.p, (un.length ? un : x.ph)[Math.floor(rnd() * (un.length ? un : x.ph).length)], rnd); });
}
const eligible = diffs => PEOPLE.filter(p => p.photos.some(f => diffs.includes(f.d))).length;
const CPU_DIFFS = ['E', 'M'], ALL_DIFFS = ['E', 'M', 'H'];

/* ---------- the Daily challenge: 10 faces, the same for everyone that day (Maldives time, UTC+5), Hard included ---------- */
const mvDay = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
function dailyRounds(day) {
  const r = seeded('dhivehi-celebrity|' + day), sorted = PEOPLE.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return shuffle(sorted, r).slice(0, NR).map(p => { const ph = p.photos.slice().sort((a, b) => a.id < b.id ? -1 : 1); return mkRound(p, ph[Math.floor(r() * ph.length)], r); });
}
const DAILY_KEY = 'celeb-daily';
function dailyRec() { try { const d = JSON.parse(ls.get(DAILY_KEY) || 'null'); if (d && d.day === mvDay()) return d; } catch (e) {} return null; }
function dailySave(o) { ls.set(DAILY_KEY, JSON.stringify(Object.assign({ day: mvDay() }, o))); }
function dailyLine() { const d = dailyRec(); if (!d) return '10 faces, one try'; return 'Done today · ' + (d.right | 0) + '/' + (d.n || NR); }

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
function newMatch(kind, players, rounds, o) { o = o || {}; return { gid: rid(), kind, quick: !!o.quick, n: o.n || rounds.length, qi: 0, phase: 'adv', at: Date.now(), rounds, players, picks: {}, prev: null, day: o.day || '', diffs: o.diffs || ALL_DIFFS }; }
function commit() { render(); if (online() && NET && NET.isHost()) NET.sync(); }
function clearHost() { clearTimeout(hostT); hostT = 0; cpuT.forEach(clearTimeout); cpuT = []; }
function hostSched() { clearTimeout(hostT); hostT = 0; if (!hostOn() || pausedAt) return; const el = Date.now() - S.at;
  if (S.phase === 'adv') hostT = setTimeout(hostStartQ, Math.max(0, ADV_MS - el));
  else if (S.phase === 'q') { const all = active().length && active().every(p => S.picks[p.id]); hostT = setTimeout(hostEndQ, all ? (FAST ? 150 : 650) : Math.max(0, Q_MS + (online() ? GRACE : 0) - el)); }
  else if (S.phase === 'rev') hostT = setTimeout(hostAfterRev, Math.max(0, REV_MS - el));
  else if (S.phase === 'stand') hostT = setTimeout(() => hostAdv(S.qi + 1), Math.max(0, STAND_MS - el)); }
function hostAdv(i) { if (!hostOn()) return; if (i >= S.n) { hostFinish(); return; }
  if (!S.rounds[i]) { hostT = setTimeout(() => hostAdv(i), 300); return; }
  brk(false); S.qi = i; S.phase = 'adv'; S.at = Date.now(); S.picks = {}; S.prev = null; S.players.forEach(p => { p.gain = null; }); commit(); hostSched(); }
function hostStartQ() { if (!hostOn() || S.phase !== 'adv') return; if (!S.rounds[S.qi]) { S.at = Date.now(); hostSched(); return; } S.phase = 'q'; S.at = Date.now(); S.picks = {}; planCpus(); commit(); hostSched(); }
/* computer players: a chance of the right face that falls with the photo's difficulty, and a lock time */
function planCpus() { cpuT.forEach(clearTimeout); cpuT = []; cpuPlan = {}; const R = S.rounds[S.qi];
  S.players.forEach(p => { if (!p.cpu || p.gone) return; const acc = Math.max(.15, Math.min(.95, (CPU_ACC[R.d] || .6) + (p.sk || 0))), ok = rnd() < acc;
    if (rnd() < .03 && Q.get('cpus') !== 'quick') return;   /* now and then a computer runs out of time (not in the localhost demo) */
    const ms = Math.round((ok ? 1500 + rnd() * 8500 : 2500 + rnd() * 10500) * CPU_SPEED);
    const wrong = [0, 1, 2, 3].filter(i => i !== R.c); cpuPlan[p.id] = { p: ok ? R.c : wrong[Math.floor(rnd() * 3)], ms }; });
  cpuGo(); }
function cpuGo() { cpuT.forEach(clearTimeout); cpuT = []; const qi = S.qi;
  Object.keys(cpuPlan).forEach(id => { if (S.picks[id]) return; const pl = cpuPlan[id]; cpuT.push(setTimeout(() => { if (S && S.qi === qi && S.phase === 'q') hostPick(id, pl.p, pl.ms); }, Math.max(0, S.at + pl.ms - Date.now()))); }); }
function hostPick(id, p, ms) { if (!S || S.phase !== 'q' || S.picks[id]) return false; const pl = S.players.find(x => x.id === id); if (!pl || pl.gone) return false;
  if (!(p >= 0 && p <= 3)) return false; S.picks[id] = { p: p | 0, ms: Math.max(0, Math.min(Q_MS, Math.round(+ms || 0))) };
  if (online() && !pl.cpu && NET) NET.clear(id);
  commit(); hostSched(); return true; }
function rankIds(N) { return N.players.filter(p => !p.gone).slice().sort((a, b) => b.score - a.score || (a.fast || 0) - (b.fast || 0)).map(p => p.id); }
function hostEndQ() { if (!hostOn() || S.phase !== 'q') return; cpuT.forEach(clearTimeout); cpuT = []; const R = S.rounds[S.qi]; S.prev = rankIds(S);
  S.players.forEach(p => { if (p.gone) { p.gain = null; return; } const pk = S.picks[p.id];
    if (pk && pk.p === R.c) { const g = ptsFor(pk.ms); p.score += g; p.gain = g; p.right = (p.right | 0) + 1; p.fast = (p.fast || 0) + pk.ms; (p.got = p.got || []).push(S.qi); }
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
/* my own answer: tapping a name locks it */
function answer(i) { if (!S || S.phase !== 'q' || meIdx() < 0 || me().gone) return; const qi = S.qi; if (myPicks[qi] != null || S.picks[myId]) return;
  const ms = Math.max(0, Math.min(Q_MS, now() - S.at));
  myPicks[qi] = i; SFX.pick(); buzz(8);
  if (hostOn()) hostPick(myId, i, ms);
  else { NET.send({ t: 'ans', q: qi, pick: i, ms }); render(); } }

/* ---------- solo modes ---------- */
let startTok = 0;
function preload(rounds) { return Promise.all(rounds.map(R => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = C.mediaUrl(R.k); if (im.decode) im.decode().then(res, res); }))); }
function soloStart(kind, nPlayers) {
  if (kind === 'daily') { const d = dailyRec(); if (d && (d.done || d.started)) { renderHome(); toast('You’ve played today’s challenge. New faces come at midnight, Maldives time.', 4200); return; } }
  const tok = ++startTok;
  loadContent().then(() => {
    if (tok !== startTok || online()) return;
    if (contentState !== 'ok') { renderHome(); return; }
    const me0 = meP(); let players = [me0], rounds;
    if (kind === 'daily') { const day = mvDay(); rounds = dailyRounds(day); if (rounds.length < 3) { toast('Not enough faces yet. Come back soon.'); return; }
      dailySave({ started: 1, done: 0, right: 0, score: 0, n: rounds.length }); S = newMatch('daily', players, rounds, { day }); }
    else {
      rounds = pickRounds(NR, CPU_DIFFS); if (rounds.length < 3) { toast('Not enough faces yet. Come back soon.'); return; }
      const bots = shuffle(CPUS).filter(n => n.toLowerCase() !== me0.name.toLowerCase()).slice(0, Math.max(1, Math.min(9, (nPlayers || 4) - 1)));
      players = players.concat(bots.map((n, i) => ({ id: 'cpu' + i, name: n, cpu: 1, sk: (rnd() - .5) * .16, ch: cpuChar(n), score: 0, right: 0, fast: 0 })));
      S = newMatch('cpu', players, rounds, { diffs: CPU_DIFFS });
    }
    toast('Loading faces…', 1400);
    preload(S.rounds).then(() => { if (tok !== startTok || !S) return; closeToast(); S.at = Date.now(); mode = kind; myPicks = {}; buildMatch(); commit(); hostSched(); });
  });
}
function soloQuit() { clearHost(); pausedAt = 0; if (mode === 'daily' && S && S.phase !== 'over') { const m = me(); dailySave({ started: 1, done: 1, right: m ? m.right | 0 : 0, score: m ? m.score : 0, n: S.n, quit: 1 }); }
  S = null; mode = null; closeSheet(); renderHome(); }
/* solo: pause while the page is hidden or sideways (the clock stops); online never pauses */
function pauseSolo() { if (S && (mode === 'cpu' || mode === 'daily') && S.phase !== 'over' && !pausedAt) { pausedAt = Date.now(); clearHost(); } }
function resumeSolo() { if (!pausedAt || !S) return; const d = Date.now() - pausedAt; pausedAt = 0; S.at += d; if (S.phase === 'q') cpuGo(); hostSched(); render(); }
let rotPaused = false;
document.addEventListener('visibilitychange', () => { if (document.hidden) { AU.sleep(); pauseSolo(); } else if (!rotPaused) resumeSolo(); });
const ROT_MQ = window.matchMedia ? matchMedia('(orientation:landscape) and (max-height:520px) and (hover:none),(orientation:landscape) and (max-height:520px) and (pointer:coarse)') : null;
function rotCheck() { if (!ROT_MQ) return; if (ROT_MQ.matches) { if (!pausedAt) { pauseSolo(); rotPaused = !!pausedAt; } } else if (rotPaused) { rotPaused = false; if (!document.hidden) resumeSolo(); } }
if (ROT_MQ) { if (ROT_MQ.addEventListener) ROT_MQ.addEventListener('change', rotCheck); else if (ROT_MQ.addListener) ROT_MQ.addListener(rotCheck); }

/* =====================================================================
   ONLINE (shared/net.js)
   ===================================================================== */
function viewFor(pid) { if (!S) return null; const d = clone(S), hide = d.phase === 'q' || d.phase === 'adv';
  d.rounds = d.rounds.slice(0, Math.max(0, d.qi + 1)).map((R, i) => { if (i === d.qi && hide) { delete R.c; delete R.name; delete R.cat; delete R.pid; } return R; });
  if (d.phase === 'q') { const pk = {}; Object.keys(d.picks).forEach(id => { pk[id] = id === pid ? d.picks[id] : { p: -1 }; }); d.picks = pk; }
  return d; }
function seatFrom(s) { const ch = s.id === myId ? myChar() : lookCh(s.look);
  if (s.cpu) return { id: s.id, name: s.name, cpu: 1, sk: (rnd() - .5) * .16, ch: ch || cpuChar(s.name), score: 0, right: 0, fast: 0 };
  return { id: s.id, name: s.name, ch, score: 0, right: 0, fast: 0 }; }
function netStart(seats, opts, info) { mode = 'online'; clearHost(); myPicks = {};
  const quick = !!(info && info.quick), n = quick ? NR : ([5, 10, 15].includes(+opts.count) ? +opts.count : NR), diffs = !quick && opts.faces === 'easy' ? CPU_DIFFS : ALL_DIFFS;
  S = newMatch('online', seats.map(seatFrom), [], { quick, n, diffs }); closeSheet(); buildMatch(); commit(); brk(true);
  loadContent().then(() => { if (!S || !online() || !NET.isHost()) return;
    S.rounds = pickRounds(n, diffs); S.n = Math.min(n, S.rounds.length);
    if (S.n < 3) { toast('Not enough faces are live yet for a match.', 4000); NET.leave(); return; }
    preload(S.rounds.slice(0, 2)); S.at = Date.now(); commit(); hostSched(); });
  hostSched(); }
function netAction(pid, a) { if (!S || !a || typeof a !== 'object' || !hostOn()) return;
  if (a.t === 'ans') { if ((a.q | 0) !== S.qi || S.phase !== 'q') return; const pl = S.players.find(p => p.id === pid); if (!pl || pl.cpu || pl.gone) return;
    const el = Date.now() - S.at; if (el > Q_MS + GRACE) return;
    hostPick(pid, a.pick | 0, Math.max(0, Math.min(Q_MS, el, +a.ms || 0))); } }
function netSeatSwap(cid, pl) { if (!hostOn() || !S || !pl || !pl.id) return false; if (S.phase === 'q' || S.phase === 'over') return false;
  const k = S.players.findIndex(p => p.id === cid); if (k < 0 || S.players.some(p => p.id === pl.id)) return false;
  const p = S.players[k]; p.id = pl.id; p.name = String(pl.name || 'Player').slice(0, 20); p.ch = lookCh(pl.look); delete p.cpu; delete p.sk; commit(); return true; }
function netDrop(pid) { if (!hostOn() || !S) return; const p = S.players.find(x => x.id === pid); if (!p || p.cpu) return; p.gone = 1; commit(); if (S.phase === 'q') hostSched(); }
let wasSpec = null;
function netState(v, meta, info) { if (!v || !Array.isArray(v.players)) return; mode = 'online'; const N = v; N.at = (N.at || Date.now()) - (NET.skew() || 0);
  const spec = info ? !!info.spec : null, flip = wasSpec === true && spec === false; wasSpec = spec;
  const fresh = screen !== 'match' || !S || S.gid !== N.gid || flip; S = N;
  const R = S.rounds && S.rounds[S.qi]; if (R) preload([R]);
  if (fresh) { closeSheet(); myPicks = {}; buildMatch(); } render(); }
function netMigrate(o) { mode = 'online'; clearHost(); const b = o.backup;
  if (!b || !b.gid || !Array.isArray(b.players)) { if (o.view && o.view.phase === 'over') { S = o.view; buildMatch(); render(); return; } NET.again(); return; }
  S = clone(b); S.at = (S.at || Date.now()) - (o.skew || 0); S.players.forEach(p => { if (p.id === o.oldHost && !p.cpu) p.gone = 1; });
  if (screen !== 'match') buildMatch();
  if (S.phase === 'q') { S.at = Date.now(); S.picks = {}; planCpus(); } else if (S.phase !== 'over') S.at = Date.now();
  if (S.phase === 'over') { render(); NET.matchOver(); return; }
  if (S.phase === 'rev' || S.phase === 'stand' || S.phase === 'adv') brk(true);
  commit(); hostSched(); toast('The host left, so you run the match now.', 3500); }
function netLobby() { wasSpec = null; clearHost(); S = null; closeSheet(); if (screen === 'match') renderHome(); }
function netEnd() { wasSpec = null; clearHost(); mode = null; S = null; closeSheet(); renderHome(); }
function cpuSeat(i, taken) { const t = new Set((taken || []).map(x => String(x).toLowerCase())); const n = shuffle(CPUS).find(x => !t.has(x.toLowerCase())); if (!n) return null; const ch = cpuChar(n); return { name: n, look: ch ? { ch } : null }; }
function initNet() { if (!window.DGNet) return; NET = DGNet.create({ game: 'celebrity', title: 'Guess the Celebrity', min: 2, max: 6, id: myId,
  cpu: true, quickSize: 4, cpuSeat, onSeatSwap: netSeatSwap,
  me: () => ({ name: myName(), look: { ch: myChar() } }), setName: v => { ls.set('lg-name', v); if (screen === 'home') renderHome(); },
  avatar: (seat, size) => { const s = avHTML({ name: seat.name, ch: lookCh(seat.look) }, size); return s.replace(/^<span class="av"[^>]*>|<\/span>$/g, '').replace(/^<span class="ai[^"]*"[^>]*>|<\/span>$/g, ''); },
  options: [{ k: 'count', label: 'Frames', def: 10, choices: [[5, '5 faces'], [10, '10 faces'], [15, '15 faces']] },
    { k: 'faces', label: 'Faces', def: 'all', choices: [['all', 'All faces'], ['easy', 'Easier faces']], hint: () => 'Friends tables give XP, no Boli' }],
  rulesNote: '2 to 6 players. Everyone sees the same face, one clue at a time, for 15 seconds. Lock a name early for more points: 1000 with the first clue, 250 with the last. Miss 2 frames in a row and you are marked away.',
  listInfo: m => S && m.status !== 'lobby' ? 'Frame ' + Math.max(1, S.qi + 1) + ' of ' + S.n : ((m.opts && m.opts.count) || 10) + ' faces',
  dropText: (nm, why) => nm + (why === 'afk' ? ' is away' : why === 'left' ? ' left' : ' lost connection') + '. Their points stay on the board.',
  afkText: 'You missed 2 frames in a row, so you were marked away. You can’t rejoin this match.',
  hostAfkText: 'You missed 2 frames in a row, so you are marked away. You’ll leave the table when this match ends.',
  onStart: netStart, view: pid => viewFor(pid), backup: () => S, onAction: netAction, onDrop: netDrop, onState: netState, onLobby: netLobby, onMigrate: netMigrate, onEnd: netEnd,
  toast: (t, ms) => toast(t, ms),
  dockHost: () => screen === 'match' ? document.getElementById('dockHost') : null,
  avatarEl: pid => { if (screen !== 'match') return null; const q = CSS.escape(pid); return document.querySelector(`#strip .pl[data-pid="${q}"] .av`); } }); }

/* =====================================================================
   UI: home
   ===================================================================== */
let spCtl = null, liveN = 0, homeFaces = null;
const liveText = () => liveN > 0 ? liveN + ' playing now' : 'Be the first to play';
function offHome() { if (spCtl) { try { spCtl.destroy(); } catch (e) {} spCtl = null; } }
const hp = () => `<a class="pill hp" href="../" aria-label="Back to Dhivehi Games">${I.back}${pcMark()}</a>`;
/* a photo as a CSS background, zoomed on the face to fill a W x H box (k = zoom: 1 = the whole face fills the box) */
function faceBg(R, W, H, k) {
  const b = R.b, x0 = b.hair[0], y0 = Math.min(b.hair[1], b.eye[1]), x1 = b.hair[2], y1 = b.chin[3];
  const fw = Math.max(.05, Math.max(x1 - x0, b.mouth[2] - b.mouth[0]) * 1.25) * R.w, fh = Math.max(.05, (y1 - y0) * 1.15) * R.h;
  const s = Math.max(W / R.w, H / R.h, Math.min(W / fw, H / fh) * (k || 1));
  const cx = (b.nose[0] + b.nose[2]) / 2 * R.w, cy = (y0 + y1) / 2 * R.h;
  const ox = Math.min(0, Math.max(W - R.w * s, W / 2 - cx * s)), oy = Math.min(0, Math.max(H - R.h * s, H / 2 - cy * s));
  return `background-image:url('${C.mediaUrl(R.k)}');background-size:${(R.w * s).toFixed(1)}px ${(R.h * s).toFixed(1)}px;background-position:${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
}
function filmHTML() {
  const sm = matchMedia('(max-width:370px)').matches, sh = matchMedia('(max-height:600px)').matches ? 96 : matchMedia('(max-height:700px)').matches ? 118 : (sm ? 124 : 150);
  const ws = sm ? [96, 108, 96] : [118, 132, 118];
  /* owner: the lobby never shows a real face (it would give answers away) - the strip keeps its look with "?" frames */
  const F = null;
  return `<div class="film" aria-hidden="true"><div class="frames">${[0, 1, 2].map(i => `<div class="fr${i === 1 ? ' on' : ' dim'}">${F && F[i] ? `<span class="ph" style="${faceBg(F[i], ws[i], sh, .78)}"></span>` : '<span class="q">?</span>'}${i === 1 ? '<span class="vf"></span>' : ''}<span class="fn">${['07', '08 ▸', '09'][i]}</span></div>`).join('')}</div></div>`;
}
function renderHome() { screen = 'home'; stopLoop(); offHome(); document.documentElement.dataset.scr = 'home';
  const nm = myName(), p = meP(), d = dailyRec();
  let body;
  if (contentState === 'ok') body = `<section class="modes" aria-label="Play">
 <button class="md qm" data-a="quick"><span class="mi">${I.bolt}</span><span class="mt"><b>Quick Match</b><small>Play real people now</small><span class="live" id="qmLive"><i></i><span>${liveText()}</span></span></span></button>
 <button class="md" data-a="friends"><span class="mi">${I.friends}</span><span class="mt"><b>Play with Friends</b><small>Create or join a table</small></span>${I.chev}</button>
 <button class="md" data-a="cpu"><span class="mi">${I.cpu}</span><span class="mt"><b>vs Computer</b><small>2–10 players · offline</small></span>${I.chev}</button>
 <div class="two"><button class="md${d ? ' done' : ''}" data-a="daily"><span class="mt"><b>Daily challenge</b><small>${esc(dailyLine())}</small></span></button><button class="md" data-a="howto"><span class="mt"><b>How to play</b><small>Rules &amp; Boli</small></span></button></div>
</section>`;
  else if (contentState === 'loading') body = `<section class="soon" aria-live="polite"><span class="lens"></span><h2>Focusing…</h2><p>Loading today’s faces.</p></section>`;
  else if (contentState === 'error') body = `<section class="soon" aria-live="polite"><span class="lens"></span><h2>Out of signal</h2><p>We couldn’t reach the list of faces. Check your connection and try again.</p><div class="row"><button class="btn am" data-a="retry">Try again</button><button class="btn gh" data-a="howto">How to play</button></div></section>`;
  else body = `<section class="soon" id="soon" aria-live="polite"><span class="lens"></span><h2>Coming soon</h2><p>The first Maldivian stars are getting ready for their close-up. Check back soon to name them, one clue at a time.</p><div class="row"><button class="btn gh" data-a="howto">How to play</button></div></section>`;
  app.innerHTML = `<main class="page home">
<div class="tb">${hp()}<button class="pill pp" data-a="name" aria-label="Your name: ${esc(nm || 'not set')}. Change">${avHTML(p, 38)}<span class="pn"><b>${nm ? esc(nm) : 'Player'}</b><small>${isReg() ? 'Your username' : nm ? 'Tap to rename' : 'Set your name'}</small></span></button><a class="pill bp" href="../digu/?open=boli" aria-label="${shells()} Boli">${BOLI_IMG}<span>${fmtBoli(shells())}</span></a></div>
${filmHTML()}
<div class="cl-title"><h1 class="disp"><span>Guess the</span>Celebrity</h1></div>
<div class="sub"><span class="lab">Maldives edition</span><span class="dv" lang="dv" dir="rtl">މީ ކޮން ތަރިއެއް؟</span></div>
${body}
<div class="spbox"><div id="spbox"></div><p class="snote">Part of <a href="../">Dhivehi Games</a>. Boli you earn here spend in the Digu store.</p></div>
</main>`;
  const el = $('#spbox'); if (el && window.DGSponsors) { try { spCtl = DGSponsors.box(el); } catch (e) {} }
  if (NET && NET.playing) { try { NET.playing(n => { liveN = n | 0; const l = $('#qmLive span'); if (l) l.textContent = liveText(); }); } catch (e) {} } }

/* =====================================================================
   UI: the match (top bar, player strip, viewfinder, answers) drawn every frame from (phase, time)
   ===================================================================== */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, s, d) => clamp((t - s) / d);
const eOut = x => 1 - Math.pow(1 - x, 3);
const eOut4 = x => 1 - Math.pow(1 - x, 4);
const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const sstep = x => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const M = () => reduce ? 0 : 1;
const pad2 = n => String(n).padStart(2, '0');
const SLOTS = [[68, 190, -.06], [180, 184, .05], [290, 194, -.035], [70, 304, .045], [180, 308, -.05], [290, 300, .06]];
const BD = 4, LABH = 17;
let G = null, frames = [], lastKey = '', raf = 0, lastStrip = '', chipsEl = [], lastSec = -1, cueKey = '';

function buildMatch() { screen = 'match'; offHome(); document.documentElement.dataset.scr = 'match'; lastKey = ''; lastStrip = ''; frames = []; G = null;
  app.innerHTML = `<main class="page match" id="match">
<div class="gt"><button class="pill menu" data-a="menu" aria-label="Menu">${I.menu}</button><div class="round" id="rnd"></div><div class="pill myscore" id="my">0</div></div>
<div id="stage" class="mview" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0">
 <div class="strip" id="strip" aria-label="Players"></div>
 <div class="view" id="view"><div class="sprk t" id="spT"></div><div class="sprk b" id="spB"></div><div class="frm" id="fA"></div><div class="frm" id="fB"></div></div>
 <div class="tbar"><i id="tb"></i></div>
 <div class="ans" id="ans">${[0, 1, 2, 3].map(i => `<button class="an" data-a="ans" data-i="${i}"><span class="ov l"></span><span class="ov r"></span><span class="ov w"></span><span class="lab">${'ABCD'[i]}</span><b></b><span class="lk">${I.lock}Locked</span><span class="mk r">${I.okMk}</span><span class="mk w">${I.noMk}</span></button>`).join('')}</div>
</div>
<div id="panelHost" style="display:none;flex-direction:column;flex:1 1 auto;min-height:0"></div>
<div class="dockrow" id="dock"><span id="dockHost"></span></div>
<div class="spill" id="spill"></div><div id="chips"></div>
</main>`;
  frames = [$('#fA'), $('#fB')];
  if (online() && NET) NET.updDock();
  startLoop(); setTimeout(rotCheck, 0); }
function startLoop() { cancelAnimationFrame(raf); const f = () => { try { tickFrame(); } catch (e) { console.error(e); } raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); }
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
addEventListener('resize', () => { if (screen === 'match') { lastKey = ''; G = null; } });

/* geometry of the viewfinder and a round's photo inside it */
function geo() { const v = $('#view'); if (!v) return null; const r = v.getBoundingClientRect(); return { VW: r.width, VH: r.height, k: Math.min(r.width / 358, r.height / 452) }; }
function photoFit(R, g) { const b = R.b, s0 = Math.max(g.VW / R.w, g.VH / R.h);
  const y0 = Math.min(b.hair[1], b.eye[1]), y1 = b.chin[3], fhpx = Math.max(8, (y1 - y0) * R.h);
  const s = Math.max(s0, Math.min(.66 * g.VH / fhpx, 2.2));
  const cx = (b.nose[0] + b.nose[2]) / 2 * R.w, cy = (y0 + y1) / 2 * R.h;
  return { s, ox: Math.min(0, Math.max(g.VW - R.w * s, g.VW / 2 - cx * s)), oy: Math.min(0, Math.max(g.VH - R.h * s, g.VH * .46 - cy * s)) }; }
/* one frame of film: board, hint cards, the photo (hidden until the end), HUD, name, shutter */
function frameHTML(R, idx) {
  if (!R) return `<div class="board"></div><span class="vf"></span>`;
  return `<div class="board"></div><img class="photo" alt="" draggable="false" src="${esc(C.mediaUrl(R.k))}"><div class="cards"></div><div class="vg"></div>
<div class="who">Who<em>?</em></div>
<div class="hud t"><span class="rec"><i></i><b class="secs">15</b><span class="su">s</span></span><span class="mm">200 mm</span></div>
<div class="hud b"><span class="pts"><small class="ck">Answer now</small><b class="pv">+1000</b></span><span class="zoom"><span class="cl">Clue 1/6</span><span class="ticks">${'<i></i>'.repeat(6)}</span></span></div>
<div class="rn"><span class="tag"></span><h2 class="disp nm"></h2></div>
<div class="blades"><i></i><i></i></div><div class="bloom"></div>
<div class="cd"><div class="ring"></div><div class="num">3</div><div class="num">2</div><div class="num">1</div></div>
<div class="cdcap"><b>Frame ${pad2(idx + 1)}</b> &nbsp;·&nbsp; <span>3</span>·<span>2</span>·<span>1</span></div>
<span class="vf"></span>`; }
function setupFrame(el, R, idx, g) {
  el.innerHTML = frameHTML(R, idx); el._R = R; el._idx = idx;
  if (!R) return;
  const P = photoFit(R, g), ph = el.querySelector('.photo');
  Object.assign(ph.style, { left: P.ox + 'px', top: P.oy + 'px', width: R.w * P.s + 'px', height: R.h * P.s + 'px' });
  const host = el.querySelector('.cards'), url = C.mediaUrl(R.k);
  /* two rows of cards in the band between "Who?" and the points; on short screens the cards get smaller so nothing overlaps */
  const small = g.VH < 380, whoB = small ? 44 + 44 : 50 + 60, hudT = g.VH - 24 - (small ? 50 : 58) - 4;
  let kk = g.k, CH = 80 * kk + 2 * BD + LABH; const avail = hudT - whoB;
  if (2 * CH + 8 > avail) { kk = Math.max(.4, (avail - 8 - 2 * (2 * BD + LABH)) / 160); CH = 80 * kk + 2 * BD + LABH; }
  const pad = Math.max(0, (avail - 2 * CH - 8) / 2) * (small ? 1 : .6), r1 = whoB + pad + CH / 2, r2 = r1 + CH + 8;
  const y1 = Math.min(r1, g.VH * .42) - LABH / 2, y2 = Math.min(r2, g.VH * .67) - LABH / 2;
  const who = el.querySelector('.who'); if (who) who.style.fontSize = small ? '44px' : '';
  el._cards = HINTS.map((h, i) => {
    const b = R.b[h], bw = Math.max(4, (b[2] - b[0]) * R.w), bh = Math.max(4, (b[3] - b[1]) * R.h);
    const k = Math.min(104 * kk / bw, 80 * kk / bh, 2.4), w = bw * k, hh = bh * k;
    const BW = Math.max(w + BD * 2, 62), BH = hh + BD * 2 + LABH, sx = SLOTS[i][0] * g.VW / 358, sy = (i < 3 ? y1 : y2) + (SLOTS[i][1] - (i < 3 ? 190 : 304)) * kk, rot = SLOTS[i][2];
    const c = document.createElement('div'); c.className = 'card'; c.dataset.hint = h;
    Object.assign(c.style, { width: BW + 'px', height: BH + 'px', left: (sx - BW / 2) + 'px', top: (sy - (BD + hh / 2)) + 'px', transformOrigin: `${BW / 2}px ${BD + hh / 2}px` });
    c.innerHTML = `<div class="cfr"></div><div class="cim" style="left:${(BW - w) / 2}px;top:${BD}px;width:${w}px;height:${hh}px;background-image:url('${url}');background-size:${R.w * k}px ${R.h * k}px;background-position:${-b[0] * R.w * k}px ${-b[1] * R.h * k}px"></div><div class="clab">Hint ${i + 1}</div><i class="pin"></i>`;
    host.appendChild(c);
    const tx = P.ox + (b[0] + b[2]) / 2 * R.w * P.s, ty = P.oy + (b[1] + b[3]) / 2 * R.h * P.s;
    return { el: c, fr: c.querySelector('.cfr'), lb: c.querySelector('.clab'), pin: c.querySelector('.pin'), rot, dx: tx - sx, dy: ty - sy, S: P.s / k };
  });
  el._q = s => el.querySelector(s);
}
const css = (el, o, tf) => { if (!el) return; el.style.opacity = o; if (tf !== undefined) el.style.transform = tf; };
const setT = (el, v) => { if (el && el._t !== v) { el.textContent = v; el._t = v; } };

/* the player strip: pills placed by rank (slots), re-ordered with a slide after each reveal */
function stripLayout() { const st = $('#strip'); if (!st) return null; const W = st.clientWidth || 358, n = S.players.length, gap = 6;
  const pitch = (W + gap) / n, pw = pitch - gap; return { W, n, pitch, pw, mini: pw < 74 }; }
function buildStrip() { const st = $('#strip'), L = stripLayout(); if (!L) return; const k0 = meIdx();
  st.classList.toggle('mini', L.mini);
  st.innerHTML = S.players.map((p, k) => `<div class="pl${k === k0 ? ' me' : ''}${p.gone ? ' gone' : ''}" data-pid="${esc(p.id)}" style="width:${L.pw.toFixed(1)}px">${avHTML(p, L.mini ? Math.min(28, L.pw - 6) : 30, k)}${p.cpu && !L.mini ? '' : ''}<span class="lock">${I.tick8}</span><span class="n">0</span><span class="gl"></span></div>`).join('');
  st._L = L; }
const short = v => v >= 10000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k' : fmt(v);

function tickFrame() {
  if (screen !== 'match' || !S) return;
  const t = (now() - S.at) / 1000, key = [S.gid, S.qi, S.phase === 'stand' || S.phase === 'over' ? S.phase : 'play', !!(S.rounds && S.rounds[S.qi])].join('|');
  if (key !== lastKey) layoutFor(key);
  if (S.phase === 'stand' || S.phase === 'over') { panelTick(t); return; }
  drawPlay(t);
}
function layoutFor(key) {
  lastKey = key;
  const panel = S.phase === 'stand' || S.phase === 'over';
  $('#stage').style.display = panel ? 'none' : 'flex'; $('#panelHost').style.display = panel ? 'flex' : 'none';
  chipsEl.forEach(c => c.remove()); chipsEl = [];
  if (panel) { $('#panelHost').innerHTML = S.phase === 'stand' ? standHTML() : overHTML(); if (S.phase === 'over') overFx(); return; }
  G = geo(); if (!G || G.VW < 10) { lastKey = ''; return; }
  buildStrip(); lastStrip = '';
  /* the frame being played (and, during the film advance, the one before it) */
  const cur = frames[S.qi % 2], prev = frames[(S.qi + 1) % 2];
  setupFrame(cur, S.rounds[S.qi], S.qi, G);
  const pr = S.qi > 0 ? S.rounds[S.qi - 1] : null;
  if (S.phase === 'adv') { setupFrame(prev, pr, S.qi - 1, G); prev._revealed = true; }
  else prev.innerHTML = '';
  cur.style.visibility = ''; prev.style.visibility = S.phase === 'adv' ? '' : 'hidden';
  const host = $('#chips'); chipsEl = S.players.map(() => { const c = document.createElement('div'); c.className = 'chip'; host.appendChild(c); return c; });
  lastSec = -1; cueKey = '';
}
/* answer buttons */
function ansState(t) {
  const R = S.rounds[S.qi], k0 = meIdx(), spec = k0 < 0 || (me() && me().gone);
  const mine = S.picks[myId] ? S.picks[myId].p : myPicks[S.qi];
  const BTN = [...document.querySelectorAll('#ans .an')];
  const rev = S.phase === 'rev', adv = S.phase === 'adv';
  const showNames = !adv || t > ADV_MS / 1000 - .25;
  const prevR = adv && S.qi > 0 ? S.rounds[S.qi - 1] : null;
  const outA = adv && !showNames ? 1 - eOut(prog(t, 0, .3)) : 1, inA = adv && showNames ? eOut(prog(t, ADV_MS / 1000 - .25, .25)) : 1;
  BTN.forEach((b, i) => {
    const o = R && R.opts && R.opts[i], nm = b.querySelector('b');
    const label = adv && !showNames ? (prevR && prevR.opts[i] ? prevR.opts[i].name : '') : (o ? o.name : '');
    setT(nm, label);
    const locked = mine != null || spec || S.phase !== 'q';
    b.disabled = locked; b.setAttribute('aria-label', 'ABCD'[i] + ': ' + label);
    const isMine = mine === i && !adv, isRight = rev && R.c === i;
    const reveal = rev ? eOut(prog(t, .35, .25)) : 0;
    const lockA = isMine ? (S.phase === 'q' ? 1 : 1 - reveal) : 0;
    const dim = (S.phase === 'q' && mine != null && !isMine) || (rev && !isRight && !isMine) ? .42 : 1;
    b.querySelector('.lab').style.opacity = nm.style.opacity = (adv ? (showNames ? inA : outA) : 1) * (isRight ? 1 : dim);
    b.querySelector('.ov.l').style.opacity = lockA; b.querySelector('.lk').style.opacity = lockA;
    b.querySelector('.ov.r').style.opacity = b.querySelector('.mk.r').style.opacity = isRight ? reveal : 0;
    b.querySelector('.ov.w').style.opacity = b.querySelector('.mk.w').style.opacity = rev && isMine && R.c !== i ? reveal : 0;
    let tf = '';
    if (rev && isMine && R.c !== i && M()) { const s = prog(t, .4, .42); if (s > 0 && s < 1) tf = `translateX(${7 * Math.sin(s * Math.PI * 6) * (1 - s)}px)`; }
    b.style.transform = tf;
  });
}
function drawPlay(t) {
  const R = S.rounds[S.qi]; if (!R) return;
  const cur = frames[S.qi % 2], prev = frames[(S.qi + 1) % 2], q = s => cur.querySelector(s);
  if (!cur._cards) return;
  const k0 = meIdx(), m = me(), mine = S.picks[myId] ? S.picks[myId] : (myPicks[S.qi] != null ? { p: myPicks[S.qi], ms: null } : null);
  const ph = S.phase, Mo = M();
  /* top bar: Frame NN/10 (rolls during the film advance) */
  const rndEl = $('#rnd');
  if (rndEl) { const roll = ph === 'adv' && S.qi > 0 ? eOut(prog(t, .45, .35)) : 1;
    const want = `<b><em>Frame</em><span class="fnum"><span class="f0">${pad2(S.qi)}</span><span class="f1">${pad2(S.qi + 1)}</span></span><em>/${pad2(S.n)}</em></b>`;
    if (rndEl._k !== S.qi + '/' + S.n) { rndEl.innerHTML = want; rndEl._k = S.qi + '/' + S.n; }
    css(rndEl.querySelector('.f0'), Mo ? 1 : 1 - roll, `translateY(${-24 * roll * Mo}px)`); css(rndEl.querySelector('.f1'), Mo ? 1 : roll, `translateY(${24 * (1 - roll) * Mo}px)`); }
  /* ---- film advance + 3·2·1 ---- */
  const D = G.VW;
  if (ph === 'adv') {
    const a = t, shrink = eIO(prog(a, 0, .25)), slide = eIO(prog(a, .18, .62)), grow = eIO(prog(a, .78, .25)), sc = 1 - .075 * shrink + .075 * grow;
    if (!Mo) { const x = eOut(prog(a, .05, .45)); css(prev, 1 - x, 'none'); css(cur, x, 'none'); }
    else { css(prev, 1, `translateX(${-slide * D}px) scale(${sc})`); css(cur, 1, `translateX(${(1 - slide) * D}px) scale(${sc})`); }
    const sp = (Mo ? -slide * D : 0) + 'px 0'; $('#spT').style.backgroundPosition = sp; $('#spB').style.backgroundPosition = sp;
    if (prev._cards) revealDraw(prev, 9, true);   /* the last frame stays fully revealed while it slides away */
    const cdT = [.95, 1.3, 1.65].map(x => x * ADV_MS / 2100);
    [...cur.querySelectorAll('.num')].forEach((el, i) => { const p = prog(a, cdT[i], .35), o = p <= 0 || p >= 1 ? 0 : Math.min(1, p / .25, (1 - p) / .22), e = eOut(prog(a, cdT[i], .3));
      el.style.opacity = o; el.style.transform = `scale(${1 + .08 * (1 - e) * Mo})`; el.style.filter = Mo ? `blur(${3.5 * (1 - e)}px)` : 'none';
      cur.querySelectorAll('.cdcap span')[i].classList.toggle('on', p > 0 && p < 1);
      const ck = S.gid + ':' + S.qi + ':' + i; if (p > 0 && p < 1 && cueKey !== ck) { cueKey = ck; SFX.blip(i); } });
    const rf = eOut(prog(a, .85, 1.1)), rOut = eOut(prog(a, 1.95 * ADV_MS / 2100, .2));
    const ring = q('.ring'); ring.style.opacity = eOut(prog(a, .85, .2)) * (1 - rOut) * lerp(.35, .9, rf); ring.style.transform = `scale(${Mo ? lerp(1.9, 1, rf) : 1})`; ring.style.filter = Mo ? `blur(${5 * (1 - rf)}px)` : 'none';
    q('.cdcap').style.opacity = eOut(prog(a, .85, .2)) * (1 - rOut);
    ['.who', '.hud.t', '.hud.b'].forEach(s => css(q(s), 0));
    cur._cards.forEach(c => { c.el.style.opacity = 0; });
    $('#tb').style.transform = 'scaleX(1)'; $('#tb').style.opacity = eOut(prog(a, ADV_MS / 1000 - .3, .3));
  } else { css(cur, 1, 'none'); prev.style.visibility = 'hidden'; $('#spT').style.backgroundPosition = '0 0'; $('#spB').style.backgroundPosition = '0 0';
    q('.ring').style.opacity = 0; q('.cdcap').style.opacity = 0; cur.querySelectorAll('.num').forEach(el => { el.style.opacity = 0; }); }
  /* ---- question: hints drop, points fall ---- */
  if (ph === 'q') {
    const qt = Math.min(t, Q_MS / 1000), k = Math.max(1, STEP.filter(s => qt >= s).length);
    css(q('.who'), eOut(prog(t, 0, .25)), `translateY(${10 * (1 - eOut(prog(t, 0, .3))) * Mo}px)`);
    q('.hud.t').style.opacity = 1; q('.hud.b').style.opacity = 1;
    const sec = Math.max(0, Math.ceil(15 - qt)); setT(q('.secs'), String(sec)); setT(q('.su'), 's');
    setT(q('.mm'), Math.round(lerp(200, 70, (k - 1) / 5)) + ' mm'); setT(q('.cl'), `Clue ${k}/6`);
    [...q('.ticks').children].forEach((el, i) => el.classList.toggle('on', i < k));
    const ck = q('.ck');
    if (mine) { if (ck._v !== 'L') { ck.innerHTML = I.lock + 'Answer locked'; ck._v = 'L'; } setT(q('.pv'), '+' + fmt(ptsFor(mine.ms != null ? mine.ms : (now() - S.at)))); }
    else { if (ck._v !== 'N') { ck.textContent = 'Answer now'; ck._v = 'N'; } setT(q('.pv'), '+' + fmt(PTS[k - 1])); }
    q('.pv').style.opacity = mine ? 1 : .55 + .45 * eOut(prog(qt, STEP[k - 1], .25));
    cur._cards.forEach((c, i) => { const a = prog(qt, STEP[i], .45); if (a <= 0) { c.el.style.opacity = 0; return; }
      if (!c.snd) { c.snd = 1; if (i > 0 || t < 1) SFX.card(); }
      const e = eOut(a); c.el.style.opacity = Math.min(1, a * 2.2); c.el.style.transform = `translateY(${-16 * (1 - e) * Mo}px) rotate(${c.rot}rad) scale(${1 + .04 * (1 - e) * Mo})`;
      c.fr.style.opacity = c.lb.style.opacity = c.pin.style.opacity = 1; });
    css(q('.photo'), 0); q('.vg').style.opacity = 0;
    $('#tb').style.transform = `scaleX(${1 - qt / 15})`; $('#tb').style.opacity = 1;
    if (sec <= 5 && sec > 0 && sec !== lastSec && !mine && k0 >= 0) { lastSec = sec; SFX.tick(); }
    if (AUTO) planAuto();
  }
  /* ---- reveal: shutter, cards melt into the photo, the name, points fly ---- */
  if (ph === 'rev') {
    revealDraw(cur, t, false);
    const got = m && !m.gone && m.gain > 0;
    setT(q('.secs'), t < .65 ? '' : (!m || m.gone ? 'Wrapped' : got ? 'Got it' : 'Missed')); setT(q('.su'), ''); setT(q('.mm'), '24 mm');
    $('#tb').style.opacity = 0;
    const rk = S.gid + ':' + S.qi + ':rev'; if (cueKey !== rk) { cueKey = rk; SFX.shutter(); setTimeout(() => { if (m && !m.gone) (m.gain > 0 ? SFX.right : SFX.wrong)(); }, 420); markSeen(R.ph); }
  }
  ansState(t);
  drawStrip(t);
  /* my score pill */
  const myScore = m ? (ph === 'rev' && m.gain > 0 ? m.score - m.gain + m.gain * eOut(prog(t, 1.6, .5)) : m.score) : 0;
  setT($('#my'), fmt(myScore));
}
/* the reveal of frame el at time t (s since the end of the question); done = draw the end state */
function revealDraw(el, t, done) {
  const R = el._R, q = s => el.querySelector(s), Mo = M(); if (!R) return;
  if (done) t = 9;
  const melt = eIO(prog(t, .02, .5)), whoOut = eOut(prog(t, 0, .22));
  css(q('.who'), 1 - whoOut, `translateY(${-10 * whoOut * Mo}px)`);
  q('.hud.b').style.opacity = 1 - eOut(prog(t, 0, .18));
  q('.hud.t').style.opacity = t < .12 ? 1 - prog(t, 0, .12) : eOut(prog(t, .65, .3));
  el._cards.forEach(c => { const f = melt * Mo, land = sstep(clamp((melt - .45) / .55));
    c.el.style.transform = `translate(${c.dx * f}px,${c.dy * f}px) rotate(${c.rot * (1 - f)}rad) scale(${lerp(1, c.S, f)})`;
    c.el.style.opacity = Mo ? 1 - land : 1 - melt;
    const fo = 1 - clamp(melt * 1.6); c.fr.style.opacity = fo; c.lb.style.opacity = fo; c.pin.style.opacity = fo; });
  const phIn = eOut(prog(t, .05, .42));
  css(q('.photo'), phIn, `scale(${1 + .035 * (1 - eOut(prog(t, 0, 1.1))) * Mo})`); q('.vg').style.opacity = phIn;
  const bl = t >= 0 && t < .16 ? Math.sin(Math.PI * t / .16) : 0;
  q('.blades').querySelectorAll('i').forEach(b => { b.style.transform = `scaleY(${.16 * bl * Mo})`; });
  const bloom = t < .09 ? eOut(t / .09) : 1 - eOut(prog(t, .09, .6));
  q('.bloom').style.opacity = done ? 0 : bloom * (reduce ? .4 : .82);
  if (!done) { const sp = $('#spill'); if (sp) sp.style.opacity = bloom * (reduce ? 0 : .32); }
  const nmEl = q('.nm'), tag = q('.tag');
  if (R.name && nmEl._t !== R.name) { nmEl.textContent = R.name; nmEl._t = R.name; tag.textContent = R.cat || ''; tag.hidden = !R.cat;
    /* the name never breaks inside a word: the longest word fits the frame width (wide caps are about 0.98 em a letter) */
    const W = (el.clientWidth || 358) - 44, word = Math.max(...R.name.split(/\s+/).map(w => w.length)), lines = R.name.length > 11 ? 38 : 50;
    nmEl.style.fontSize = Math.max(26, Math.min(lines, W / (word * .98))).toFixed(1) + 'px'; }
  const nm = eOut4(prog(t, .3, .32)); css(nmEl, nm, `translateY(${8 * (1 - nm) * Mo}px) scale(${1 + .14 * (1 - nm) * Mo})`);
  const tg = eOut(prog(t, .55, .3)); css(tag, tg, `translateX(${-10 * (1 - tg) * Mo}px)`);
}
/* the strip: scores count up, pills slide to their new places, points chips fly in */
function drawStrip(t) {
  const st = $('#strip'); if (!st || !st._L) return; const L = st._L, ph = S.phase, Mo = M();
  const ids = S.players.map(p => p.id), rev = ph === 'rev';
  const after = rankIds(S).concat(S.players.filter(p => p.gone).map(p => p.id));
  const before = rev && S.prev ? S.prev.concat(ids.filter(id => !S.prev.includes(id))) : after;
  const moved = rev ? eIO(prog(t, 2.25, .6)) : 1, ord = moved >= .5 ? after : before;
  const cnt = rev ? eOut(prog(t, 1.6, .5)) : 1;
  const pills = [...st.children];
  S.players.forEach((p, i) => { const el = pills[i]; if (!el) return;
    const slot = Math.max(0, ord.indexOf(p.id)), x = slot * L.pitch;
    const tf = `translateX(${x.toFixed(1)}px)`; if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; el.style.zIndex = slot === 0 ? 2 : 1; }
    const sc = p.gone ? null : (rev && p.gain > 0 ? p.score - p.gain + p.gain * cnt : p.score);
    setT(el.querySelector('.n'), p.gone ? (p.afk ? 'Away' : 'Left') : (L.mini ? short(sc) : fmt(sc)));
    const lockOn = ph === 'q' && !!(S.picks[p.id] || (p.id === myId && myPicks[S.qi] != null));
    const lk = el.querySelector('.lock'); if (lk._on !== lockOn) { lk.classList.toggle('on', lockOn); lk._on = lockOn; }
    el.querySelector('.gl').style.opacity = rev && p.gain > 0 ? Math.sin(Math.PI * prog(t, 1.55, .7)) * .9 : 0; });
  /* chips: +points from my answer to my pill, the others rise into theirs */
  if (!G) return;
  const pr = $('#match').getBoundingClientRect(), sr = st.getBoundingClientRect();
  S.players.forEach((p, i) => { const c = chipsEl[i]; if (!c) return;
    if (!rev || p.gain == null || p.gone) { c.style.opacity = 0; return; }
    const v = p.gain; setT(c, v ? '+' + fmt(v) : '0'); c.classList.toggle('z', !v); c.classList.toggle('big', p.id === myId);
    const slot = Math.max(0, before.indexOf(p.id)), tx = sr.left - pr.left + slot * L.pitch + 19, ty = sr.top - pr.top + sr.height / 2;
    const cw = c.offsetWidth || 60, chh = c.offsetHeight || 30; let x, y, o, s;
    if (p.id === myId && S.picks[myId]) {
      const b = document.querySelectorAll('#ans .an')[S.picks[myId].p], bb = b.getBoundingClientRect();
      const show = eOut(prog(t, .75, .2)), fl = eIO(prog(t, .95, .62)), out = prog(t, 1.5, .2);
      const cx = bb.left - pr.left + bb.width / 2 + 30, cy = bb.top - pr.top + 6;
      if (!Mo) { x = tx; y = ty + 34; o = show * (1 - out); s = 1; }
      else { const kx = lerp(cx, tx, .25), ky = ty + 150; x = (1 - fl) * (1 - fl) * cx + 2 * (1 - fl) * fl * kx + fl * fl * tx; y = (1 - fl) * (1 - fl) * cy + 2 * (1 - fl) * fl * ky + fl * fl * ty; o = show * (1 - out); s = lerp(1, .62, fl) * (.9 + .1 * show); }
    } else { const st0 = .85 + i * .07, show = eOut(prog(t, st0, .2)), fl = eIO(prog(t, st0 + .15, .5)), out = prog(t, 1.5, .2);
      x = tx; y = Mo ? lerp(ty + 52, ty, fl) : ty + 34; o = show * (1 - out); s = Mo ? lerp(1, .7, fl) : 1; }
    c.style.opacity = o; c.style.transform = `translate(${(x - cw / 2).toFixed(1)}px,${(y - chh / 2).toFixed(1)}px) scale(${s.toFixed(3)})`; });
}
let autoQi = -1;
function planAuto() { if (!AUTO || !S || S.phase !== 'q' || meIdx() < 0 || myPicks[S.qi] != null || S.picks[myId] || autoQi === S.gid + S.qi) return; autoQi = S.gid + S.qi; const qi = S.qi; clearTimeout(autoT);
  const R = S.rounds[qi], want = window.__celebAutoPick;
  autoT = setTimeout(() => { if (!S || S.qi !== qi || S.phase !== 'q') return; let c = typeof want === 'function' ? want(qi, R) : null;
    if (c == null) c = R.c != null && rnd() < .7 ? R.c : Math.floor(rnd() * 4); answer(c); }, (FAST ? 300 : 900) + rnd() * (FAST ? 400 : 1800)); }

/* ---------- standings (every 3 frames) and the final results ---------- */
function thumbHTML(R, W, H, cls, inner) { return `<div class="th ${cls || ''}" style="${faceBg(R, W, H, .9)}">${inner || ''}</div>`; }
function standHTML() {
  const ids = rankIds(S), prev = S.prev || ids, k0 = meIdx(), n = S.qi + 1, R = S.rounds[S.qi];
  const rows = ids.map((id, r) => { const k = S.players.findIndex(p => p.id === id), p = S.players[k], pr = prev.indexOf(id), pk = S.picks[id];
    const lead = r === 0, ahead = r > 0 ? S.players.find(x => x.id === ids[r - 1]) : null;
    const mv = pr < 0 || pr === r ? (lead ? '<span class="mv">— held 1st</span>' : `<span class="mv">— ${fmt(ahead.score - p.score)} behind</span>`)
      : pr > r ? `<span class="mv up">▲ ${pr - r} place${pr - r > 1 ? 's' : ''}</span>` : `<span class="mv dn">▼ ${r - pr} place${r - pr > 1 ? 's' : ''}</span>`;
    const note = p.gain > 0 ? `Frame ${pad2(n)} <em>+${fmt(p.gain)}</em>` : pk && pk.p >= 0 && R.opts[pk.p] ? `Frame ${pad2(n)} · said ${esc(R.opts[pk.p].name)}` : `Frame ${pad2(n)} · no answer`;
    return `<div class="rk${lead ? ' lead' : ''}${k === k0 ? ' me' : ''}" data-pid="${esc(id)}"><span class="p">${r + 1}</span>${avHTML(p, 42, k)}<span class="nm"><b>${esc(k === k0 ? 'You' : p.name)}</b><small>${note}</small></span><span class="sc"><b>${fmt(p.score)}</b>${mv}</span></div>`; }).join('');
  const last3 = S.rounds.slice(Math.max(0, S.qi - 2), S.qi + 1).map((Rr, i) => thumbHTML(Rr, 110, 112, '', `<span class="cap"><span>${pad2(S.qi - 1 + i)}</span><span>${esc(Rr.name || '')}</span></span>`)).join('');
  const solo = mode === 'cpu', left = Math.max(1, Math.ceil((STAND_MS - (now() - S.at)) / 1000));
  return `<div class="panel" id="standings">
<div class="sth"><h2 class="disp"><span>${n} of ${S.n} shot</span>Standings</h2><span class="lab" style="text-align:right">After<br>frame ${pad2(n)}</span></div>
<div class="prog">${Array.from({ length: S.n }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>
<div class="rank${ids.length > 4 ? ' dense' : ''}">${rows}</div>
<div class="sheet3"><div class="g">${last3}</div></div>
<div class="gap">${n + 3 < S.n ? `Next standings after frame <b>${pad2(n + 3)}</b>` : `Final results after frame <b>${pad2(S.n)}</b>`}</div>
<div class="nextbar" style="margin-top:12px"><span>Next frame in <b id="ncd">${left}</b></span>${solo ? '<button data-a="ready">I’m ready</button>' : ''}</div></div>`;
}
let overKey = '', overAw = null, overFxK = '';
function place() { return rankIds(S).indexOf(myId); }
function xpFor() { const m = me(); if (!m || m.gone) return 0; let x = 5 + (m.right | 0); const pl = place(); if (S.kind !== 'daily' && pl >= 0 && pl < 3 && active().length > 1) x += [10, 5, 2][pl]; if (S.kind === 'daily' && m.right === S.n) x += 10; return x; }
function overAward() { const k = S.gid; if (overKey === k) return overAw; overKey = k; overAw = null; const m = me(); if (!m || m.gone) return null; const xp = xpFor();
  if (S.kind === 'daily') { const n = (m.right | 0) + (m.right === S.n ? BOLI_DAILY_PERFECT : 0); overAw = award('celeb:daily:' + S.day, n, xp) || { sh: 0, xp: 0 }; dailySave({ started: 1, done: 1, right: m.right | 0, score: m.score, n: S.n }); }
  else if (S.kind === 'online' && S.quick) { const pl = place(); overAw = award('celeb:' + S.gid, pl >= 0 && pl < 3 ? BOLI_QUICK[pl] : 0, xp) || { sh: 0, xp: 0 }; overAw.pl = pl; }
  else if (S.kind === 'cpu') { const b = place() === 0 && S.players.length >= 4 ? BOLI_CPU_WIN : 0; overAw = award('celeb:' + S.gid, b, xp) || { sh: 0, xp: 0 }; overAw.cpu = 1; }
  else { overAw = award('celeb:' + S.gid, 0, xp) || { sh: 0, xp: 0 }; overAw.friends = 1; }
  return overAw; }
function overFx() { if (overFxK === S.gid) return; overFxK = S.gid; const m = me(); if (!m) return; if ((S.kind !== 'daily' && place() === 0) || (S.kind === 'daily' && m.right >= 7)) SFX.win(); }
function overHTML() {
  const aw = overAward(), k0 = meIdx(), m = me(), ids = rankIds(S), P = ids.map(id => S.players.find(p => p.id === id)), ki = p => S.players.indexOf(p);
  const named = m ? m.right | 0 : 0, nm = p => ki(p) === k0 ? 'You' : p.name;
  const pod = (p, r) => p ? `<div class="pd p${r + 1}" data-pid="${esc(p.id)}">${avHTML(p, [76, 58, 52][r], ki(p))}<b>${esc(nm(p))}</b><span class="sc">${fmt(p.score)}</span><div class="step">${r + 1}</div></div>` : '<div class="pd"></div>';
  const rest = P.slice(3).map((p, i) => `<div class="fourth" data-pid="${esc(p.id)}"><span class="n">${i + 4}</span>${avHTML(p, 32, ki(p))}<b>${esc(nm(p))}</b><span class="sc">${fmt(p.score)}</span></div>`).join('')
    + S.players.filter(p => p.gone).map(p => `<div class="fourth"><span class="n">–</span>${avHTML(p, 32)}<b>${esc(p.name)}</b><span class="sc">${p.afk ? 'Away' : 'Left'}</span></div>`).join('');
  let earn = '';
  if (aw) { const why = S.kind === 'daily' ? `${named} of ${S.n} named` : S.kind === 'online' && S.quick ? (aw.pl >= 0 && aw.pl < 3 ? ['first', 'second', 'third'][aw.pl] + ' place' : 'Quick Match') : S.kind === 'cpu' ? (aw.sh ? 'a win against the computer' : 'vs Computer') : 'Friends table';
    earn = aw.sh > 0 ? `<div class="earn">${BOLI_IMG}<span><b>+${aw.sh} Boli</b> for ${why} · ${named} of ${S.n} named${aw.capped ? ' (daily limit)' : ''}${aw.xp ? ' · +' + aw.xp + ' XP' : ''}</span></div>`
      : `<div class="earn">${BOLI_IMG}<span>${named} of ${S.n} named${aw.xp ? ' · <b>+' + aw.xp + ' XP</b>' : ''}${S.kind === 'cpu' ? ' · win against 3+ computers for +' + BOLI_CPU_WIN + ' Boli' : S.kind === 'online' && !S.quick ? ' · Friends tables give no Boli' : ''}</span></div>`; }
  const got = new Set((m && m.got) || []);
  const sheet = S.rounds.slice(0, S.n).map((R, i) => thumbHTML(R, 64, 70, got.has(i) ? '' : 'miss', got.has(i) ? `<span class="ok">${I.tick8}</span>` : '')).join('');
  const host = online() && NET && NET.isHost();
  const acts = mode === 'cpu' ? `<div class="acts"><button class="btn gh" data-a="home">Lobby</button><button class="btn am" data-a="again">Play again</button></div>`
    : mode === 'daily' ? `<p class="waitline">New faces at midnight, Maldives time.</p><div class="acts one"><button class="btn am" data-a="home">Back to the lobby</button></div>`
    : host ? `<div class="acts"><button class="btn gh" data-a="netLeave">Leave</button><button class="btn am" data-a="netAgain">Play again</button></div>`
    : `<p class="waitline">${k0 < 0 ? 'The next match starts soon.' : 'Waiting for the host to start the next match…'}</p><div class="acts one"><button class="btn gh" data-a="netLeave">Leave table</button></div>`;
  const kind = S.kind === 'daily' ? 'Daily challenge' : S.kind === 'cpu' ? 'vs Computer' : S.quick ? 'Quick Match' : 'Friends table';
  const head = S.kind === 'daily' ? `<div class="podium" style="grid-template-columns:1fr"><div class="pd p1">${avHTML(m || meP(), 76, 0)}<b>You</b><span class="sc">${fmt(m ? m.score : 0)}</span><div class="step" style="height:70px;font-size:26px">${named}/${S.n}</div></div></div>`
    : `<div class="podium">${pod(P[1], 1)}${pod(P[0], 0)}${pod(P[2], 2)}</div>${rest ? `<div class="rest">${rest}</div>` : ''}`;
  return `<div class="panel" id="results"><div class="rh"><h2 class="disp">That’s<br>a wrap</h2><span class="lab" style="text-align:right">${kind}<br>${S.n} frames</span></div>
${head}${earn}<div class="csheet"><div class="g">${sheet}</div></div><div class="lab cnote">Grey frames: faces you missed</div>${acts}</div>`;
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
<p><b>Guess the Celebrity</b> shows a famous Maldivian face, one small clue at a time. Name them before the others do.</p>
<h3>A frame</h3>
<p>Each frame lasts <b>15 seconds</b>. Every 2.5 seconds a new photo card lands: <b>Hint 1</b> to <b>Hint 6</b>. The first cards give little away; the last one is the most telling.</p>
<p>Tap one of the four names to <b>lock</b> your answer. You can’t change it. The earlier you lock a right answer, the more you score: <b>1000</b> with one hint, then 850, 700, 550, 400 and <b>250</b> with all six. A wrong answer or no answer scores nothing.</p>
<p>When time is up the shutter fires, the cards drop into place and the full photo shows with the name.</p>
<h3>A match</h3>
<p>A match is <b>10 frames</b>, a different person every frame. The standings show after every third frame, and the top three go on the podium.</p>
<h3>Ways to play</h3>
<p><b>Quick Match</b>: play real people now; computer players fill empty seats, and a person who arrives takes a computer’s seat between frames. <b>Play with Friends</b>: create a table or join with a code. <b>vs Computer</b>: 2 to 10 players, works offline once loaded, with the easier faces. <b>Daily challenge</b>: the same 10 faces for everyone that day (Maldives time), harder faces too, one try.</p>
<h3>Boli</h3>
<p>Quick Match: ${BOLI_QUICK[0]} for 1st, ${BOLI_QUICK[1]} for 2nd, ${BOLI_QUICK[2]} for 3rd. Daily challenge: 1 for each face you name, ${BOLI_DAILY_PERFECT} extra for all ten. vs Computer: +${BOLI_CPU_WIN} for a win against 3 or more computers. Friends tables give XP, no Boli. The usual daily Boli limit applies.</p>
<h3>The faces</h3>
<p>Every person in the game agreed to be in it, or their photo comes from an official or public source. Something wrong? Tell us from the Dhivehi Games home page.</p></div>`; }
function openHowTo() { sheet(`<div class="grab"></div><h2>How to play</h2>${howHTML()}<div class="row"><button class="btn am" data-a="close">Got it</button></div>`); }
function openName() { const nm = myName(); if (isReg()) { sheet(`<div class="grab"></div><h2>Your name</h2><p class="muted" style="margin:6px 0 0">You play as your username, <b>${esc(nm)}</b>. Change your character in Digu.</p><div class="row"><button class="btn gh" data-a="close">Close</button><a class="btn am" href="../digu/?open=profile">Edit character</a></div>`); return; }
  sheet(`<div class="grab"></div><h2>Your name</h2><p class="muted" style="margin:4px 0 0;font-size:13px">Shown to other players. Your character comes from your Digu profile.</p>
<label class="f" for="pnm">Name</label><input class="in" id="pnm" maxlength="14" value="${esc(nm)}" dir="auto" autocomplete="nickname" enterkeyhint="done">
<div class="row"><button class="btn gh" data-a="close">Cancel</button><button class="btn am" data-a="saveName">Save</button></div>`); setTimeout(() => { const i = $('#pnm'); i && i.focus(); }, 250); }
function saveName() { const v = (($('#pnm') || {}).value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14); if (!v) { toast('Enter a name first.'); return; } ls.set('lg-name', v); closeSheet(); renderHome(); }
let cpuN = (() => { const v = +ls.get('celeb-cpu-n'); return v >= 2 && v <= 10 ? v : 4; })();
function openCpu() { sheet(`<div class="grab"></div><h2>vs Computer</h2><p class="muted" style="margin:4px 0 0;font-size:13px">How many players, you included? 10 frames with the easier faces. Works offline once the faces have loaded.</p>
<div class="nsel" role="group" aria-label="Players">${[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button data-a="cpuN" data-n="${n}" aria-pressed="${n === cpuN}">${n}</button>`).join('')}</div>
<div class="row"><button class="btn gh" data-a="close">Cancel</button><button class="btn am" data-a="cpuGo">Start</button></div>`); }
const sfxLabel = () => 'Sound: ' + (sfxOn() ? 'On' : 'Off');
function openMenu() { if (!S) return; const solo = mode === 'cpu' || mode === 'daily';
  const kind = S.kind === 'daily' ? 'Daily challenge' : S.kind === 'cpu' ? 'vs Computer' : S.quick ? 'Quick Match' : 'Friends table';
  sheet(`<div class="grab"></div><h2>Guess the Celebrity</h2><p class="muted" style="margin:4px 0 0">${kind} · frame ${Math.max(1, S.qi + 1)} of ${S.n}</p>
<div class="mlist"><button class="btn gh" data-a="howto">How to play</button><button class="btn gh" data-a="sfx" aria-pressed="${sfxOn()}">${sfxLabel()}</button>
${solo ? '<button class="btn dg" data-a="quitAsk">Quit to lobby</button>' : '<button class="btn dg" data-a="netLeave">Leave table</button>'}</div>`); }
function openQuit() { if (!S) return; const d = S.kind === 'daily' && S.phase !== 'over';
  sheet(`<div class="grab"></div><h2>Quit to lobby?</h2><p class="muted" style="margin:6px 0 0">${d ? 'Your daily challenge ends here and counts as today’s try.' : 'This match ends and won’t be saved.'}</p>
<div class="row"><button class="btn gh" data-a="close">Stay</button><button class="btn dg" data-a="quitYes">Quit to lobby</button></div>`); }
function toggleSfx() { ls.set('dd-sfx', sfxOn() ? '0' : '1'); document.querySelectorAll('[data-a="sfx"]').forEach(b => { b.setAttribute('aria-pressed', String(sfxOn())); b.textContent = sfxLabel(); }); if (sfxOn()) { AU.unlock(); SFX.pick(); } }
let menuPaused = false;
const sheetObs = new MutationObserver(() => { const open = $('#sheet').classList.contains('open');
  if (open && screen === 'match' && !pausedAt && (mode === 'cpu' || mode === 'daily')) { pauseSolo(); menuPaused = !!pausedAt; }
  else if (!open && menuPaused) { menuPaused = false; if (!document.hidden && !rotPaused) resumeSolo(); } });
sheetObs.observe($('#sheet'), { attributes: true, attributeFilter: ['class'] });

/* ---------- one click handler ---------- */
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
  switch (a) {
    case 'quick': if (NET) NET.quick(); else toast('Online play needs a newer browser.'); break;
    case 'friends': if (NET) NET.friends(); else toast('Online play needs a newer browser.'); break;
    case 'cpu': openCpu(); break;
    case 'cpuN': cpuN = +b.dataset.n; ls.set('celeb-cpu-n', String(cpuN)); document.querySelectorAll('.nsel button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.n === cpuN))); break;
    case 'cpuGo': closeSheet(); soloStart('cpu', cpuN); break;
    case 'daily': soloStart('daily'); break;
    case 'retry': loadContent(true).then(renderHome); renderHome(); break;
    case 'ans': answer(+b.dataset.i); break;
    case 'ready': if (hostOn() && mode === 'cpu' && S.phase === 'stand') hostAdv(S.qi + 1); break;
    case 'again': if (mode === 'cpu') { const n = S.players.length; S = null; soloStart('cpu', n); } break;
    case 'home': if (online() && NET) NET.leave(); S = null; mode = null; clearHost(); renderHome(); break;
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
  if (screen === 'match' && S && S.phase === 'q' && !$('#sheet').classList.contains('open') && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase()); if (i >= 0 && e.key.length === 1) answer(i); } });

/* test hooks (used by the automated checks; harmless in normal play) */
window.__celeb = { PTS, STEP, Q_MS, ptsFor, get S() { return S; }, get mode() { return mode; }, get NET() { return NET; }, get people() { return PEOPLE; }, get content() { return contentState; },
  answer, view: viewFor,
  /* localhost tests only: hold the current phase at t seconds (the clock and the host stop) / let it run again */
  hold: t => { if (!LOCAL || !S) return false; clearHost(); const n = Date.now(); S.at = n - t * 1000; pausedAt = n; return true; },
  release: () => { if (!LOCAL || !S) return false; resumeSolo(); return true; }, mvDay, dailyRounds, pickRounds, distractors: p => distractors(p, rnd), get pausedAt() { return pausedAt; }, recent };

/* ---------- boot ---------- */
initNet();
renderHome();
loadContent().then(() => { if (screen === 'home') renderHome();
  if (LOCAL && Q.get('play') && contentState === 'ok') soloStart(Q.get('play') === 'daily' ? 'daily' : 'cpu', +Q.get('n') || 4); });
if (NET) NET.boot();
})();
