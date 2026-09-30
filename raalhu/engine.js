/* =====================================================================================
   Raalhu Rumble engine (Dhivehi Games)                                raalhu/engine.js
   Pure and deterministic: no DOM, no clocks, no Math.random. A match is one plain JSON state;
   resolve(state, plans) returns the next state plus a recorded replay (frames + events) of the
   ~3-4 s cinematic, so the host decides and every client replays exactly the same thing.
   Only + - * / and Math.sqrt are used in the simulation path (IEEE-exact in every browser),
   so a client re-simulating the host's (pre-state, plans) gets the same frames.

   RR.newMatch({arena, mode:'ffa'|'team', seed, players:[{name, kind, team, bot, diff}]})
   RR.resolve(S, plans{seat:plan}, {record})  -> {state, frames, ev, dur, tide:{from,to,washed}}
   RR.aiPlan(S, seat, 'easy'|'normal'|'hard', seed)  -> plan
   plan = {mv:{x,y}|null, act:'missile'|'bomb'|'shield'|'special', aim:{x,y}}
   RR.snapJump / jumpRange / canUse / preview / autoMatch (headless computer-only match)
   ===================================================================================== */
(function (root) {
'use strict';
const W = 812, H = 375, G = 1000, DT = 1 / 60, REC = 2, TIDE0 = 330, TIDE_STEP = 14, MAXR = 30;
const MIS = { v: 700, dmg: 18, kx: 205, ky: -95 };
const BOMB = { R: 64, max: 27, min: 9, kn: 300 };
const COCO = { R: 44, max: 15, min: 6, kn: 250 };
const SHOCK = { R: 150, dmg: 10 };
const HOOK = { v: 900, range: 400, dmg: 8 };

/* tanks: hp, wt = knockback resistance, jump = range (world px), r = hit radius, cd = special/shield cooldown */
const KINDS = {
 dhoni:    { name: 'Dhonbe',    dv: 'ދޯނި',       tag: 'Dhoni-hull tank',        hp: 104, wt: 1.10, jump: 200, r: 27, w: 96,  third: 'shield',  sp: 'Hull Shield',  cd: 2, ch0: 0, sd: 'A hex shield that blocks every shot and push for a round, even mid-jump.' },
 crab:     { name: 'Kakuni',    dv: 'ކަކުނި',      tag: 'Crab walker',            hp: 92, wt: 1.15, jump: 190, r: 26, w: 96,  third: 'shield',  sp: 'Shell Shield', cd: 2, ch0: 0, sd: 'Pulls into its shell: blocks every shot and push for a round. Grippy legs resist knockback.' },
 golem:    { name: 'Faru',      dv: 'ފަރު',        tag: 'Coral golem tank',       hp: 108, wt: 1.25, jump: 170, r: 30, w: 100, third: 'shield',  sp: 'Reef Shield',  cd: 2, ch0: 0, sd: 'Coral armour that blocks every shot and push for a round. Big, tough and slow.' },
 beru:     { name: 'Beru Bot',  dv: 'ބޮޑުބެރު',    tag: 'Bodu Beru drum tank',    hp: 100, wt: 1.10, jump: 190, r: 27, w: 96,  third: 'special', sp: 'Bodu Beat',    cd: 3, ch0: 1, sd: 'A drum shockwave that shoves every tank nearby toward the edges.' },
 fisher:   { name: 'Masveriya', dv: 'މަސްވެރިޔާ',  tag: 'Tuna-fisher tank',       hp: 102, wt: 1.05, jump: 200, r: 27, w: 96,  third: 'special', sp: 'Pole & Line',  cd: 3, ch0: 1, sd: 'Casts a hook in a straight line and reels the first tank it catches toward you.' },
 catapult: { name: 'Kurumba',   dv: 'ކުރުނބާ',     tag: 'Coconut catapult',       hp: 106, wt: 1.20, jump: 170, r: 27, w: 96,  third: 'special', sp: 'Coconut Barrage', cd: 3, ch0: 1, sd: 'Lobs three coconuts around the target: a wide spread of small blasts.' },
 plane:    { name: 'Otto',      dv: '',        tag: 'Seaplane hover tank',    hp: 90,  wt: 0.90, jump: 250, r: 25, w: 96,  third: 'special', sp: 'Sky Hop',      cd: 3, ch0: 1, sd: 'Hops anywhere on the map and hovers above the fight, dropping a bomb from the sky.' },
 manta:    { name: 'Madi',      dv: 'މަޑި',        tag: 'Manta glider',           hp: 90,  wt: 0.90, jump: 250, r: 24, w: 96,  third: 'special', sp: 'Manta Glide',  cd: 3, ch0: 1, sd: 'A long, late glide that dodges shots, then a missile. If Madi falls in the water that round, she glides back out.' }
};
const ORDER = ['dhoni', 'crab', 'golem', 'beru', 'fisher', 'catapult', 'plane', 'manta'];
const PICKS = { shell: 'Shield shell', dbl: 'Double shot', fins: 'Speed fins', anchor: 'Heavy anchor' };
const PICK_ORDER = ['shell', 'dbl', 'fins', 'anchor'];

const ARENAS = {
 jetty: { name: 'Sandbank Jetty', dv: 'ފަޅު', sub: 'A palm-trunk jetty over a sandbank. The sand floods first.',
  plats: [{ x: -30, y: 300, w: 330, k: 'sand' }, { x: 520, y: 276, w: 330, k: 'sand' }, { x: 90, y: 205, w: 180, k: 'jetty' }, { x: 560, y: 196, w: 180, k: 'jetty' }, { x: 292, y: 150, w: 140, k: 'jetty' }] },
 reef: { name: 'Reef Wreck', dv: 'ފަރު', sub: 'An old wreck on the outer reef, with coral pillars and a deep gap.',
  plats: [{ x: -30, y: 296, w: 270, k: 'rock' }, { x: 290, y: 246, w: 230, k: 'wreck' }, { x: 590, y: 290, w: 260, k: 'rock' }, { x: 70, y: 186, w: 140, k: 'rock' }, { x: 610, y: 176, w: 140, k: 'rock' }] },
 harbour: { name: 'Malé Harbour', dv: 'މާލެ', sub: 'Quays, a moored dhoni and stacked crates, with the city behind.',
  plats: [{ x: -30, y: 296, w: 300, k: 'quay' }, { x: 560, y: 286, w: 290, k: 'quay' }, { x: 300, y: 262, w: 220, k: 'dhoni' }, { x: 70, y: 192, w: 140, k: 'crates' }, { x: 600, y: 182, w: 150, k: 'roof' }, { x: 300, y: 128, w: 150, k: 'jetty' }] }
};
const ARENA_IDS = ['jetty', 'reef', 'harbour'];
const SOLID = { sand: 1, rock: 1, quay: 1, crates: 1, roof: 1, wreck: 1 };
const MARG = { sand: 20, rock: 12, quay: 8, crates: 6, roof: 8, wreck: 10, dhoni: 10, jetty: 8 };

/* ---------------------------------------------------------------- helpers */
const clone = o => JSON.parse(JSON.stringify(o));
const clampN = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10;
const sq = v => v * v;
const dist = (ax, ay, bx, by) => Math.sqrt(sq(ax - bx) + sq(ay - by));
function rnd(S) { let t = (S.rs = (S.rs + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function mkRng(seed) { const o = { rs: seed >>> 0 }; return () => rnd(o); }
const PL = {};
function plats(a) {
 if (PL[a]) return PL[a];
 const A = ARENAS[a] || ARENAS.jetty;
 return PL[a] = A.plats.map((p, i) => { const m = MARG[p.k] || 8; return { i, x: p.x, y: p.y, w: p.w, k: p.k, x0: Math.max(14, p.x + m), x1: Math.min(W - 14, p.x + p.w - m), solid: !!SOLID[p.k], th: SOLID[p.k] ? H + 80 - p.y : (p.k === 'dhoni' ? 44 : 11) }; });
}
const dry = (p, water) => water >= p.y - 1;
function platUnder(P, x, y, water) { for (const p of P) if (Math.abs(p.y - y) < 2.5 && x >= p.x0 - 8 && x <= p.x1 + 8 && dry(p, water)) return p; return null; }
const allyOf = (S, a, b) => S.mode === 'team' && a !== b && S.tanks[a] && S.tanks[b] && S.tanks[a].team === S.tanks[b].team;
/* segment (x0,y0)-(x1,y1) vs circle */
function segCircle(x0, y0, x1, y1, cx, cy, r) {
 const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy; let u = L > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / L : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
 return sq(x0 + dx * u - cx) + sq(y0 + dy * u - cy) <= r * r;
}
/* first platform body a segment enters: returns t in [0,1] or -1 (Liang-Barsky against each rect) */
function segRects(P, water, x0, y0, x1, y1) {
 let best = -1;
 for (const p of P) {
  if (!dry(p, water)) continue;
  const rx0 = p.x, rx1 = p.x + p.w, ry0 = p.y, ry1 = p.y + p.th; let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  const cl = (q, r) => { if (q === 0) return r >= 0; const t = r / q; if (q < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
  if (cl(-dx, x0 - rx0) && cl(dx, rx1 - x0) && cl(-dy, y0 - ry0) && cl(dy, ry1 - y0) && t0 <= t1) { if (best < 0 || t0 < best) best = t0; }
 }
 return best;
}

/* ---------------------------------------------------------------- rules */
function canUse(S, seat, act) {
 const t = S.tanks[seat]; if (!t || !t.alive) return false; const K = KINDS[t.kind];
 if (act === 'missile' || act === 'bomb') return true;
 if (act === 'shield') return K.third === 'shield' && (t.sc | 0) === 0;
 if (act === 'special') return K.third === 'special' && (t.ch | 0) >= K.cd;
 return false;
}
function jumpRange(S, seat, act) {
 const t = S.tanks[seat], K = KINDS[t.kind]; let R = K.jump;
 if (t.buf && t.buf.fins) R *= 1.45;
 if (act === 'special' && canUse(S, seat, 'special')) { if (t.kind === 'plane') R = 5000; else if (t.kind === 'manta') R = Math.max(R, 420); }
 return R;
}
function inRange(t, x, y, R) { const dx = x - t.x, dy = y - t.y, ry = dy < 0 ? R * 0.8 : R * 1.7; return (dx * dx) / (R * R) + (dy * dy) / (ry * ry) <= 1.0001; }
/* nearest reachable dry spot to a tapped point (null when nothing is reachable) */
function snapJump(S, seat, x, y, act) {
 const t = S.tanks[seat]; if (!t || !t.alive) return null; const R = jumpRange(S, seat, act), P = plats(S.arena); let best = null, bd = 1e9;
 for (const p of P) {
  if (!dry(p, S.water)) continue;
  let cx = clampN(x, p.x0, p.x1);
  if (!inRange(t, cx, p.y, R)) { let bx = null, bdx = 1e9; for (let sx = p.x0; sx <= p.x1 + 0.01; sx += 3) if (inRange(t, sx, p.y, R)) { const d = Math.abs(sx - cx); if (d < bdx) { bdx = d; bx = sx; } } if (bx == null) continue; cx = bx; }
  const d = dist(cx, p.y * 1.25, x, y * 1.25); if (d < bd) { bd = d; best = { x: r1(cx), y: p.y, p: p.i }; }
 }
 return best;
}
function defaultAim(S, seat) {
 const me = S.tanks[seat]; let best = null, bd = 1e9;
 S.tanks.forEach(t => { if (!t.alive || t.seat === seat || allyOf(S, seat, t.seat)) return; const d = dist(t.x, t.y, me.x, me.y); if (d < bd) { bd = d; best = t; } });
 return best ? { x: best.x, y: best.y - 28 } : { x: me.x < W / 2 ? me.x + 200 : me.x - 200, y: me.y - 60 };
}
function sanitize(S, seat, p) {
 const t = S.tanks[seat]; p = p && typeof p === 'object' ? p : {};
 let act = ['missile', 'bomb', 'shield', 'special'].indexOf(p.act) >= 0 ? p.act : 'missile';
 if (!canUse(S, seat, act)) act = 'missile';
 let mv = null;
 if (p.mv && isFinite(p.mv.x) && isFinite(p.mv.y)) { const s = snapJump(S, seat, +p.mv.x, +p.mv.y, act); if (s && (Math.abs(s.x - t.x) > 6 || Math.abs(s.y - t.y) > 2)) mv = { x: s.x, y: s.y }; }
 const aim = p.aim && isFinite(p.aim.x) && isFinite(p.aim.y) ? { x: r1(clampN(+p.aim.x, -150, W + 150)), y: r1(clampN(+p.aim.y, -250, H)) } : defaultAim(S, seat);
 return { mv, act, aim };
}
function floodsAfter(S, pi) { const p = plats(S.arena)[pi]; if (!p) return 99; let w = S.water, n = 0; while (dry(p, w) && n < 60) { w -= TIDE_STEP; n++; } return n; }

/* ---------------------------------------------------------------- new match */
function newMatch(o) {
 o = o || {}; const seed = (o.seed >>> 0) || 1;
 const S = { v: 1, seed, rs: seed, arena: ARENAS[o.arena] ? o.arena : ARENA_IDS[seed % 3], mode: o.mode === 'team' ? 'team' : 'ffa', round: 1, phase: 'plan', water: TIDE0, tanks: [], pickups: [], pk: 0, win: null, order: null };
 const P = plats(S.arena), players = o.players || [];
 /* fair random spawns: random first spot, then spread out (farthest-point with a little randomness) */
 const cand = []; P.forEach(p => { if (floodsAfter(S, p.i) < 3) return; for (let x = p.x0 + 6; x <= p.x1 - 6; x += 10) cand.push({ x, y: p.y }); });
 for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); const q = cand[i]; cand[i] = cand[j]; cand[j] = q; }
 const chosen = [];
 players.forEach(() => {
  if (!chosen.length) { chosen.push(cand[0]); return; }
  const sc = cand.map(c => { let m = 1e9; chosen.forEach(q => { const d = dist(c.x, c.y, q.x, q.y); if (d < m) m = d; }); return { c, m }; }).sort((a, b) => b.m - a.m);
  const top = sc.filter(s => s.m >= Math.min(110, sc[0].m * 0.8)); const pick = top[Math.floor(rnd(S) * Math.min(top.length, 6))] || sc[0]; chosen.push(pick.c);
 });
 players.forEach((pl, i) => {
  const kind = KINDS[pl.kind] ? pl.kind : ORDER[i % ORDER.length], K = KINDS[kind], sp = chosen[i] || { x: 100 + i * 100, y: P[0].y };
  S.tanks.push({ seat: i, name: String(pl.name || K.name).slice(0, 16), kind, team: S.mode === 'team' ? (pl.team != null ? pl.team : i % 2) : i, x: sp.x, y: sp.y, dir: sp.x < W / 2 ? 1 : -1,
   hp: K.hp, max: K.hp, alive: true, out: null, sc: 0, ch: K.ch0, buf: { shell: 0, dbl: 0, fins: 0, anchor: 0 }, ko: 0, dealt: 0, bot: !!pl.bot, diff: pl.diff || 'normal' });
 });
 return S;
}

/* ---------------------------------------------------------------- resolve (the cinematic) */
function resolve(S0, plans, opt) {
 opt = opt || {}; const rec = opt.record !== false;
 const S = clone(S0), P = plats(S.arena), ev = [], frames = [], T = S.tanks;
 const water = S.water;
 let time = 0, pidN = 0;
 const projs = [], sch = [];
 const at = (t, fn) => { sch.push({ t, fn, n: sch.length }); sch.sort((a, b) => a.t - b.t || a.n - b.n); };
 const E = o => { o.t = Math.round(time * 100) / 100; ev.push(o); };
 const B = T.map(t => ({ s: t.seat, t, K: KINDS[t.kind], on: t.alive, x: t.x, y: t.y, vx: 0, vy: 0, air: false, mode: 0, rot: 0, sh: false, j: null, hovUntil: 0, save: false, saved: false, by: -1, x0: t.x, y0: t.y, hp0: t.hp, dodged: false, glide: false, pl: t.alive ? platUnder(P, t.x, t.y, water) : null, plan: null, dir: t.dir || 1 }));
 const used = {}; /* seat -> {shield, special, jumped, fired} */
 const wtOf = b => b.K.wt * (b.t.buf.anchor ? 2 : 1);

 function outB(b, how, by) {
  if (!b.on) return; b.on = false; const t = b.t; t.alive = false; t.hp = Math.max(0, Math.round(t.hp));
  if (by == null || by === -1) by = b.by;
  t.out = { r: S.round, t: Math.round(time * 100) / 100, how, by: by >= 0 && by !== b.s ? by : -1, hp0: b.hp0 };
  if (by >= 0 && by !== b.s && T[by]) T[by].ko = (T[by].ko | 0) + 1;
  E({ k: 'out', s: b.s, how, by: t.out.by, x: r1(b.x), y: r1(Math.min(b.y, water + 4)) });
 }
 function damage(b, dmg, by) {
  if (!b.on) return false;
  if (b.t.buf.shell) { b.t.buf.shell = 0; E({ k: 'absorb', s: b.s, x: r1(b.x), y: r1(b.y) }); return false; }
  dmg = Math.round(dmg); b.t.hp -= dmg; b.by = by; if (by >= 0 && T[by]) T[by].dealt = (T[by].dealt | 0) + dmg;
  E({ k: 'hit', s: b.s, by, dmg, x: r1(b.x), y: r1(b.y) });
  if (b.t.hp <= 0) { b.t.hp = 0; outB(b, 'hp', by); return false; }
  return true;
 }
 function knock(b, kx, ky, by) {
  if (!b.on) return; const w = wtOf(b); b.vx += kx / w; b.vy += ky / w; b.air = true; b.mode = 3; b.j = null; b.glide = false; b.hovUntil = 0; if (by >= 0) b.by = by;
 }
 function claimPick(pk, seat, how) {
  const i = S.pickups.indexOf(pk); if (i < 0) return; S.pickups.splice(i, 1); const t = T[seat];
  if (pk.k === 'anchor') t.buf.anchor = 3; else t.buf[pk.k] = 1;
  E({ k: 'pick', s: seat, pk: pk.k, id: pk.id, x: pk.x, y: pk.y, how });
 }
 function landClaims(b) { for (const pk of S.pickups.slice()) if (Math.abs(pk.x - b.x) < 30 && Math.abs(pk.y - b.y) < 6) claimPick(pk, b.s, 'land'); }
 function explode(x, y, owner, spec, kind) {
  E({ k: 'boom', x: r1(x), y: r1(y), w: kind, s: owner });
  for (const b of B) {
   if (!b.on || b.s === owner || allyOf(S, owner, b.s)) continue;
   const cx = b.x, cy = b.y - 30, dd = dist(cx, cy, x, y), d = Math.max(0, dd - b.K.r * 0.5);
   if (d >= spec.R) { if (!b.dodged && b.x0 !== b.x && dist(b.x0, b.y0 - 20, x, y) < 46) { b.dodged = true; E({ k: 'dodge', s: b.s, x: r1(b.x), y: r1(b.y) }); } continue; }
   if (b.sh) { E({ k: 'block', s: b.s, x: r1(cx), y: r1(cy), by: owner }); continue; }
   const f = d / spec.R, dmg = spec.max - (spec.max - spec.min) * f;
   const kept = damage(b, dmg, owner); if (!kept && !b.on) continue;
   if (!kept) continue; /* the shell soaked it: no push either */
   const nx = dd > 0.01 ? (cx - x) / dd : (b.s % 2 ? 1 : -1), ny = dd > 0.01 ? (cy - y) / dd : -1, K = spec.kn * (1 - 0.45 * f);
   knock(b, nx * K, ny * K * 0.35 - (0.45 * K + 50), owner);
  }
 }
 /* ---- plans */
 B.forEach(b => {
  if (!b.on) return;
  const p = sanitize(S, b.s, plans && (plans[b.s] || plans[String(b.s)])); b.plan = p; const u = used[b.s] = { shield: false, special: false, jumped: false, fired: false };
  const t = b.t, kind = t.kind, sp = p.act === 'special';
  if (p.aim.x !== b.x) b.dir = p.aim.x > b.x ? 1 : -1;
  if (p.act === 'shield') { u.shield = true; at(0.1, () => { if (b.on) { b.sh = true; E({ k: 'shield', s: b.s }); } }); }
  if (sp) u.special = true;
  if (p.mv) {
   u.jumped = true; const dx = p.mv.x - b.x;
   if (sp && kind === 'plane') { const hy = p.mv.y - 72; b.j = { x0: b.x, y0: b.y, x1: p.mv.x, y1: hy, t0: 0.15, dur: 0.8, ap: 40 + Math.max(0, b.y - hy) * 0.3, hover: true, gy: p.mv.y }; b.hovUntil = 2.5; }
   else if (sp && kind === 'manta') { b.j = { x0: b.x, y0: b.y, x1: p.mv.x, y1: p.mv.y, t0: 0.95, dur: 0.8, ap: 22 + Math.max(0, b.y - p.mv.y) * 0.35, glide: true }; }
   else b.j = { x0: b.x, y0: b.y, x1: p.mv.x, y1: p.mv.y, t0: 0.15, dur: 0.7, ap: 46 + Math.max(0, b.y - p.mv.y) * 0.55 };
   if (dx) b.dir = dx > 0 ? 1 : -1;
   b.mode = 1; at(b.j.t0, () => { if (b.on && b.j) { if (b.j.glide) b.glide = true; E({ k: 'jump', s: b.s, w: b.j.glide ? 'glide' : b.j.hover ? 'hop' : 'jump' }); } });
  } else if (sp && kind === 'plane') { /* hop in place: hover above the current spot */
   b.j = { x0: b.x, y0: b.y, x1: b.x, y1: b.y - 72, t0: 0.15, dur: 0.6, ap: 20, hover: true, gy: b.y }; b.hovUntil = 2.5; b.mode = 1;
   at(0.15, () => { if (b.on) E({ k: 'jump', s: b.s, w: 'hop' }); });
  }
  if (sp && kind === 'manta') b.save = true;
  /* the shot(s) */
  const fireT = sp && kind === 'manta' ? 1.8 : 1.0;
  const dbl = !!t.buf.dbl && (p.act === 'missile' || p.act === 'bomb');
  const shoot = (w, aim, delay) => at(fireT + delay, () => { if (b.on) fire(b, w, aim); });
  if (p.act === 'missile' || p.act === 'bomb') {
   u.fired = true; shoot(p.act, p.aim, 0);
   if (dbl) { const off = p.act === 'bomb' ? { x: p.aim.x + (b.dir > 0 ? 26 : -26), y: p.aim.y } : { x: p.aim.x, y: p.aim.y - 22 }; shoot(p.act, off, 0.16); }
  } else if (sp) {
   if (kind === 'beru') at(1.0, () => { if (b.on) shock(b); });
   else if (kind === 'fisher') shoot('hook', p.aim, 0);
   else if (kind === 'catapult') { shoot('coco', { x: p.aim.x - 46, y: p.aim.y }, 0); shoot('coco', p.aim, 0.1); shoot('coco', { x: p.aim.x + 46, y: p.aim.y }, 0.2); }
   else if (kind === 'plane') shoot('bomb', p.aim, 0.05);
   else if (kind === 'manta') shoot('missile', p.aim, 0);
  }
 });
 function fire(b, w, aim) {
  const dir = aim.x >= b.x ? 1 : -1; b.dir = dir; const hov = b.mode === 2;
  let sx = b.x + dir * 30, sy = b.y - 40; if (w === 'bomb' || w === 'coco') { sx = b.x + dir * 16; sy = b.y - (hov ? 20 : 46); }
  const p = { id: ++pidN, k: w, s: b.s, x: sx, y: sy, vx: 0, vy: 0, g: false, age: 0, life: 3, on: true };
  if (w === 'missile' || w === 'hook') {
   let dx = aim.x - sx, dy = aim.y - sy, L = Math.sqrt(dx * dx + dy * dy); if (L < 8) { dx = dir; dy = 0; L = 1; }
   const v = w === 'hook' ? HOOK.v : MIS.v; p.vx = dx / L * v; p.vy = dy / L * v; p.life = w === 'hook' ? HOOK.range / HOOK.v : 1.7; p.ux = dx / L; p.uy = dy / L;
  } else {
   const dx = aim.x - sx, dy = aim.y - sy, d = Math.sqrt(dx * dx + dy * dy); let Tt = clampN(0.72 + d / 850, 0.8, 1.5); if (hov) Tt = clampN(0.5 + d / 1100, 0.55, 1.2);
   p.vx = dx / Tt; p.vy = dy / Tt - 0.5 * G * Tt; p.g = true; p.life = 4;
  }
  projs.push(p); E({ k: 'fire', s: b.s, w, x: r1(sx), y: r1(sy) });
  if (b.t.buf.dbl && (w === 'missile' || w === 'bomb') && used[b.s] && !used[b.s].dblMark) used[b.s].dblMark = true;
 }
 function shock(b) {
  E({ k: 'shock', s: b.s, x: r1(b.x), y: r1(b.y - 24) });
  for (const o of B) {
   if (!o.on || o === b || allyOf(S, b.s, o.s)) continue; const d = dist(o.x, o.y - 26, b.x, b.y - 26); if (d > SHOCK.R) continue;
   if (o.sh) { E({ k: 'block', s: o.s, x: r1(o.x), y: r1(o.y - 30), by: b.s }); continue; }
   const kept = damage(o, SHOCK.dmg, b.s); if (!kept) continue;
   const sgn = o.x > b.x ? 1 : o.x < b.x ? -1 : (o.s > b.s ? 1 : -1), K = 330 * (1 - d / SHOCK.R) + 150;
   knock(o, sgn * K, -(150 + 0.25 * K), b.s);
  }
 }
 function hookHit(p, o) {
  const b = B[p.s]; E({ k: 'hook', s: p.s, tgt: o.s, x: r1(o.x), y: r1(o.y - 30), hit: 1 });
  if (o.sh) { E({ k: 'block', s: o.s, x: r1(o.x), y: r1(o.y - 30), by: p.s }); return; }
  const kept = damage(o, HOOK.dmg, p.s); if (!kept) return;
  const w = wtOf(o), dx = (b.x - o.x), vx = clampN(dx * 1.55, -500, 500) * (w > 1 ? 1 / Math.sqrt(w) : 1);
  o.vx = 0; o.vy = 0; knock(o, vx * w, -370 * (w > 1.2 ? 1.1 : 1), p.s); /* the pull ignores most of the weight: that is its point */
 }
 function projStep(p) {
  const px = p.x, py = p.y; if (p.g) p.vy += G * DT; p.x += p.vx * DT; p.y += p.vy * DT; p.age += DT;
  const end = (x, y, why) => { p.on = false; p.hx = x; p.hy = y; p.why = why; };
  /* tanks */
  let hitB = null, hu = 2;
  for (const b of B) {
   if (!b.on || b.s === p.s || allyOf(S, p.s, b.s)) continue; if (b.mode === 1 && !b.glide) continue;
   const cx = b.x, cy = b.y - 30, rr = b.sh ? b.K.r + 20 : b.K.r + 3;
   if (segCircle(px, py, p.x, p.y, cx, cy, rr)) { const L = sq(p.x - px) + sq(p.y - py), u = L > 0 ? ((cx - px) * (p.x - px) + (cy - py) * (p.y - py)) / L : 0; if (u < hu) { hu = u; hitB = b; } }
  }
  /* pickups */
  let hitK = null;
  for (const pk of S.pickups) if (segCircle(px, py, p.x, p.y, pk.x, pk.y - 11, 14)) { hitK = pk; break; }
  /* platforms and water */
  let tp = segRects(P, water, px, py, p.x, p.y);
  let tw = -1; if (p.y >= water && py < water) tw = (water - py) / (p.y - py); else if (py >= water) tw = 0;
  const cands = [];
  if (hitB) cands.push([Math.max(0, Math.min(1, hu)), 'tank']);
  if (hitK) cands.push([0.5, 'pick']);
  if (tp >= 0) cands.push([tp, 'plat']);
  if (tw >= 0) cands.push([tw, 'water']);
  if (!cands.length) { if (p.age > p.life || p.x < -220 || p.x > W + 220 || p.y > H + 60) { p.on = false; if (p.k === 'hook') E({ k: 'hook', s: p.s, x: r1(p.x), y: r1(p.y), hit: 0 }); } return; }
  cands.sort((a, b) => a[0] - b[0]); const [u, what] = cands[0]; const hx = px + (p.x - px) * u, hy = py + (p.y - py) * u;
  if (what === 'pick') { claimPick(hitK, p.s, 'shot'); }
  if (p.k === 'hook') {
   end(hx, hy, what);
   if (what === 'tank') hookHit(p, hitB); else E({ k: 'hook', s: p.s, x: r1(hx), y: r1(hy), hit: 0 });
   return;
  }
  if (what === 'water') { end(hx, water, 'water'); E({ k: 'splashp', x: r1(hx), w: p.k, s: p.s }); if (p.k !== 'missile') { /* a bomb that lands in the water still splashes the shore a little */ explodeSoft(hx, water, p); } return; }
  end(hx, hy, what);
  if (p.k === 'missile') {
   if (what === 'tank') {
    const b = hitB; E({ k: 'boom', x: r1(hx), y: r1(hy), w: 'missile', s: p.s });
    if (b.sh) { E({ k: 'block', s: b.s, x: r1(hx), y: r1(hy), by: p.s }); return; }
    const kept = damage(b, MIS.dmg, p.s); if (kept) knock(b, p.ux * MIS.kx, MIS.ky + p.uy * 50, p.s);
   } else {
    E({ k: 'boom', x: r1(hx), y: r1(hy), w: 'mpuff', s: p.s });
    for (const b of B) { if (!b.on || b.s === p.s || allyOf(S, p.s, b.s) || b.sh) continue; const d = dist(b.x, b.y - 26, hx, hy); if (d < 34) { const kept = damage(b, 8, p.s); if (kept) knock(b, (b.x >= hx ? 1 : -1) * 90, -110, p.s); } }
   }
   return;
  }
  explode(hx, hy, p.s, p.k === 'coco' ? COCO : BOMB, p.k);
 }
 function explodeSoft(x, y, p) { /* water blast: only tanks right at the waterline feel it */
  const spec = p.k === 'coco' ? COCO : BOMB;
  for (const b of B) { if (!b.on || b.s === p.s || allyOf(S, p.s, b.s) || b.sh) continue; const d = dist(b.x, b.y - 20, x, y); if (d < spec.R * 0.6) { const kept = damage(b, spec.min, p.s); if (kept) knock(b, (b.x >= x ? 1 : -1) * 120, -150, p.s); } }
 }
 function bodyStep(b) {
  if (!b.on) return;
  if (b.mode === 1 && b.j) {
   const j = b.j; if (time < j.t0) return; const u = (time - j.t0) / j.dur;
   if (u >= 1) {
    b.x = j.x1; b.y = j.y1; b.j = null; b.glide = false;
    if (j.hover) { b.mode = 2; b.air = true; b.gy = j.gy; E({ k: 'hover', s: b.s }); }
    else if (j.descend) { b.mode = 0; b.air = false; b.pl = platUnder(P, b.x, b.y, water); if (!b.pl) { b.mode = 3; b.air = true; } else { E({ k: 'land', s: b.s, x: r1(b.x), y: r1(b.y) }); landClaims(b); } }
    else { b.mode = 0; b.air = false; b.pl = platUnder(P, b.x, b.y, water); if (!b.pl) { b.mode = 3; b.air = true; } else { E({ k: 'land', s: b.s, x: r1(b.x), y: r1(b.y) }); landClaims(b); } }
   } else { b.x = j.x0 + (j.x1 - j.x0) * u; b.y = j.y0 + (j.y1 - j.y0) * u - 4 * j.ap * u * (1 - u); b.air = true; }
   return;
  }
  if (b.mode === 2) { if (time >= b.hovUntil) { b.mode = 1; b.j = { x0: b.x, y0: b.y, x1: b.x, y1: b.gy, t0: time, dur: 0.35, ap: 0, descend: true }; } return; }
  if (b.mode !== 3) return;
  if (b.air) {
   b.vy += G * DT; const nx = b.x + b.vx * DT, ny = b.y + b.vy * DT;
   if (b.vy > 0) {
    for (const p of P) {
     if (!dry(p, water)) continue;
     if (b.y <= p.y + 0.01 && ny >= p.y && nx >= p.x0 - 6 && nx <= p.x1 + 6) {
      const imp = b.vy; b.x = nx; b.y = p.y; b.vy = 0; b.vx *= 0.45; b.air = false; b.pl = p; b.rot = 0;
      if (imp > 260) E({ k: 'thud', s: b.s, x: r1(b.x), y: r1(b.y) }); landClaims(b); return;
     }
    }
   }
   b.x = nx; b.y = ny; b.rot += b.vx * DT * 0.012;
  } else {
   b.x += b.vx * DT; b.vx *= 0.88;
   if (Math.abs(b.vx) < 3) { b.vx = 0; b.mode = 0; }
   if (b.pl && (b.x < b.pl.x0 - 6 || b.x > b.pl.x1 + 6)) { b.air = true; b.mode = 3; }
  }
 }
 function waterCheck(b) {
  if (!b.on) return;
  if (b.y - 6 > water || b.y > H + 120 || b.x < -260 || b.x > W + 260) {
   if (b.save && !b.saved) {
    b.saved = true; let best = null, bd = 1e9;
    for (const p of P) { if (!dry(p, water)) continue; const x = clampN(b.x, p.x0 + 10, p.x1 - 10), d = dist(x, p.y, b.x, water); if (d < bd) { bd = d; best = { x, y: p.y }; } }
    if (best) { b.vx = 0; b.vy = 0; b.mode = 1; b.air = true; b.j = { x0: clampN(b.x, -40, W + 40), y0: Math.min(b.y, water + 4), x1: best.x, y1: best.y, t0: time, dur: 0.6, ap: 60 }; E({ k: 'save', s: b.s, x: r1(b.x), y: r1(water) }); return; }
   }
   outB(b, 'water', b.by);
  }
 }
 function record() {
  const fb = B.map(b => [r1(b.x), r1(b.y), Math.round(b.rot * 100) / 100, (b.air ? 1 : 0) | (b.sh ? 2 : 0) | (b.mode === 2 ? 4 : 0) | (!b.on ? 8 : 0) | (b.glide ? 16 : 0) | (b.saved ? 32 : 0), b.dir]);
  const fp = projs.filter(p => p.on).map(p => [p.id, p.k, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.s]);
  frames.push({ t: Math.round(time * 100) / 100, b: fb, p: fp });
 }
 E({ k: 'go' });
 let endAt = 0, step = 0;
 for (; step < 60 * 6; step++) {
  time = step * DT;
  while (sch.length && sch[0].t <= time + 1e-9) sch.shift().fn();
  for (const p of projs) if (p.on) projStep(p);
  for (const b of B) { bodyStep(b); waterCheck(b); }
  if (rec && step % REC === 0) record();
  if (!endAt && time >= 1.15 && !sch.length && !projs.some(p => p.on) && !B.some(b => b.on && b.mode !== 0)) endAt = time + 0.4;
  if (endAt && time >= endAt) break;
 }
 if (rec) record();
 const dur = Math.round(time * 100) / 100;
 /* ---- write back */
 B.forEach(b => {
  const t = b.t, u = used[b.s];
  if (b.on) { t.x = r1(b.x); t.y = b.y; t.dir = b.dir; if (b.mode !== 0) { const pl = platUnder(P, b.x, b.y, water); if (!pl) { outB(b, 'water', b.by); } } }
  if (u) {
   if (u.shield) t.sc = 1; else t.sc = Math.max(0, (t.sc | 0) - 1);
   if (u.special) t.ch = 0;
   if (u.jumped && t.buf.fins) t.buf.fins = 0;
   if (u.fired && t.buf.dbl) t.buf.dbl = 0;
  }
  if (t.alive || u) { t.ch = Math.min(b.K.third === 'special' ? b.K.cd : 0, (t.ch | 0) + 1); if (t.buf.anchor) t.buf.anchor--; }
 });
 /* ---- tide */
 const from = S.water; S.water = from - TIDE_STEP; const washed = [];
 B.forEach(b => { if (!b.on) return; const pl = platUnder(P, b.x, b.y, from); if (!pl || !dry(pl, S.water)) { time = 99; outB(b, 'tide', -2); washed.push(b.s); } });
 S.pickups = S.pickups.filter(pk => { const pl = platUnder(P, pk.x, pk.y, from); return pl && dry(pl, S.water); });
 if (S.round % 2 === 0 && S.pickups.length < 2 && S.round < 12) spawnPick(S);
 /* ---- over? */
 const alive = T.filter(t => t.alive);
 const sides = S.mode === 'team' ? [...new Set(alive.map(t => t.team))] : alive.map(t => t.seat);
 if (sides.length <= 1 || S.round >= MAXR) finish(S);
 else { S.round++; S.phase = 'plan'; }
 return { state: S, frames, ev, dur, tide: { from, to: S.water, washed } };
}
function rankKey(t) { return t.alive ? [1e6, t.hp, 0] : [t.out.r * 1000 + t.out.t, t.out.hp0 | 0, 0]; }
function finish(S) {
 const T = S.tanks, alive = T.filter(t => t.alive);
 const order = T.slice().sort((a, b) => { const x = rankKey(a), y = rankKey(b); return y[0] - x[0] || y[1] - x[1] || a.seat - b.seat; }).map(t => t.seat);
 S.order = order; S.phase = 'over';
 if (S.mode === 'team') {
  let team;
  if (alive.length) { const hp = {}; alive.forEach(t => hp[t.team] = (hp[t.team] || 0) + t.hp); team = +Object.keys(hp).sort((a, b) => hp[b] - hp[a])[0]; }
  else team = T[order[0]].team;
  S.win = { team, seats: T.filter(t => t.team === team).map(t => t.seat) };
 } else {
  if (alive.length === 1) S.win = { seats: [alive[0].seat] };
  else if (alive.length > 1) { const best = Math.max(...alive.map(t => t.hp)); S.win = { seats: alive.filter(t => t.hp === best).map(t => t.seat) }; }
  else { const k = rankKey(T[order[0]]); S.win = { seats: T.filter(t => { const q = rankKey(t); return q[0] === k[0] && q[1] === k[1]; }).map(t => t.seat) }; if (S.win.seats.length > 1) S.win.draw = 1; }
 }
}
function spawnPick(S) {
 const P = plats(S.arena), c = [];
 P.forEach(p => { if (floodsAfter(S, p.i) < 3) return; for (let x = p.x0 + 14; x <= p.x1 - 14; x += 12) { if (S.tanks.some(t => t.alive && Math.abs(t.x - x) < 44 && Math.abs(t.y - p.y) < 4)) continue; if (S.pickups.some(q => Math.abs(q.x - x) < 60 && q.y === p.y)) continue; c.push({ x, y: p.y }); } });
 if (!c.length) return;
 const spot = c[Math.floor(rnd(S) * c.length)], k = PICK_ORDER[Math.floor(rnd(S) * 4)];
 S.pickups.push({ id: ++S.pk, k, x: spot.x, y: spot.y, r: S.round + 1 });
}

/* ---------------------------------------------------------------- previews for the planning UI */
function preview(S, seat, plan) {
 const t = S.tanks[seat], P = plats(S.arena); const p = sanitize(S, seat, plan); const out = { jump: null, shot: [], impact: null, kind: p.act };
 let bx = t.x, by = t.y;
 if (p.mv) { const hop = p.act === 'special' && t.kind === 'plane', gl = p.act === 'special' && t.kind === 'manta'; const y1 = hop ? p.mv.y - 72 : p.mv.y, ap = hop ? 40 + Math.max(0, t.y - y1) * 0.3 : gl ? 22 + Math.max(0, t.y - y1) * 0.35 : 46 + Math.max(0, t.y - y1) * 0.55;
  const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push([t.x + (p.mv.x - t.x) * u, t.y + (y1 - t.y) * u - 4 * ap * u * (1 - u)]); } out.jump = { pts, x: p.mv.x, y: p.mv.y, hover: hop ? y1 : null }; bx = p.mv.x; by = hop ? y1 : p.mv.y; }
 else if (p.act === 'special' && t.kind === 'plane') by = t.y - 72;
 const hov = p.act === 'special' && t.kind === 'plane';
 const w = p.act === 'missile' || (p.act === 'special' && t.kind === 'manta') ? 'missile' : p.act === 'bomb' || hov ? 'bomb' : p.act === 'special' && t.kind === 'catapult' ? 'coco' : p.act === 'special' && t.kind === 'fisher' ? 'hook' : null;
 if (!w) return out;
 const dir = p.aim.x >= bx ? 1 : -1; let sx = bx + dir * 30, sy = by - 40; if (w === 'bomb' || w === 'coco') { sx = bx + dir * 16; sy = by - (hov ? 20 : 46); }
 let x = sx, y = sy, vx, vy, g = false, life = 1.7;
 if (w === 'missile' || w === 'hook') { let dx = p.aim.x - sx, dy = p.aim.y - sy, L = Math.sqrt(dx * dx + dy * dy); if (L < 8) { dx = dir; dy = 0; L = 1; } const v = w === 'hook' ? HOOK.v : MIS.v; vx = dx / L * v; vy = dy / L * v; if (w === 'hook') life = HOOK.range / HOOK.v; }
 else { const dx = p.aim.x - sx, dy = p.aim.y - sy, d = Math.sqrt(dx * dx + dy * dy); let Tt = clampN(0.72 + d / 850, 0.8, 1.5); if (hov) Tt = clampN(0.5 + d / 1100, 0.55, 1.2); vx = dx / Tt; vy = dy / Tt - 0.5 * G * Tt; g = true; life = 4; }
 out.shot.push([x, y]);
 for (let a = 0; a < life; a += DT) {
  const px = x, py = y; if (g) vy += G * DT; x += vx * DT; y += vy * DT;
  const tp = segRects(P, S.water, px, py, x, y); let tw = -1; if (y >= S.water && py < S.water) tw = (S.water - py) / (y - py);
  let u = -1; if (tp >= 0) u = tp; if (tw >= 0 && (u < 0 || tw < u)) u = tw;
  if (u >= 0) { const hx = px + (x - px) * u, hy = py + (y - py) * u; out.shot.push([hx, hy]); out.impact = { x: hx, y: hy, water: tw >= 0 && tw === u }; break; }
  out.shot.push([x, y]); if (x < -200 || x > W + 200) break;
 }
 out.w = w; out.R = w === 'bomb' ? BOMB.R : w === 'coco' ? COCO.R : 0;
 return out;
}

/* ---------------------------------------------------------------- computer players */
const AID = {
 easy:   { noise: 40, lead: 0,   edge: 0.3, shield: 0.35, rand: 0.4,  spec: 0.55, dodge: 0.35, ko: 0.3, tide: 0.8, stay: 0.35 },
 normal: { noise: 16, lead: 0.45, edge: 0.8, shield: 0.75, rand: 0.1, spec: 0.9, dodge: 0.8, ko: 0.8, tide: 1,   stay: 0.1 },
 hard:   { noise: 5,  lead: 0.85, edge: 1.1, shield: 1,    rand: 0,    spec: 1,   dodge: 1,   ko: 1,   tide: 1.2, stay: 0 }
};
function spotsFor(S, seat, R) {
 const t = S.tanks[seat], P = plats(S.arena), out = [{ x: t.x, y: t.y, p: (platUnder(P, t.x, t.y, S.water) || { i: -1 }).i, stay: true }];
 P.forEach(p => { if (!dry(p, S.water)) return; for (let x = p.x0 + 4; x <= p.x1 - 4; x += 18) { if (Math.abs(x - t.x) < 10 && p.y === t.y) continue; if (inRange(t, x, p.y, R)) out.push({ x, y: p.y, p: p.i }); } });
 return out;
}
function edgeDist(P, s, dir) { const p = P[s.p]; if (!p) return 0; return dir > 0 ? p.x1 - s.x : s.x - p.x0; }
function fallSafe(S, x, y) { const P = plats(S.arena), wN = S.water; for (const p of P) if (dry(p, wN) && p.y >= y - 4 && x >= p.x0 - 4 && x <= p.x1 + 4) return true; return false; }
function koChance(S, f, fp, dir, push) {
 const P = plats(S.arena); const e = edgeDist(P, fp, dir); if (push <= e + 6) return 0;
 const lx = fp.x + dir * push; if (fallSafe(S, lx, fp.y)) return 0.1; return clampN((push - e) / 45, 0.2, 1);
}
function aiPlan(S, seat, diff, seed) {
 const D = AID[diff] || AID.normal, R = mkRng(seed >>> 0 || 7), me = S.tanks[seat];
 if (!me || !me.alive) return null;
 const K = KINDS[me.kind], P = plats(S.arena), wN = S.water - TIDE_STEP;
 const foes = S.tanks.filter(t => t.alive && t.seat !== seat && !allyOf(S, seat, t.seat));
 if (!foes.length) return { mv: null, act: 'missile', aim: { x: me.x + 60, y: me.y - 30 } };
 const alivN = S.tanks.filter(t => t.alive).length;
 /* how much fire I expect if I stay put */
 let incoming = 0; foes.forEach(f => { const targets = S.tanks.filter(t => t.alive && t.seat !== f.seat && !allyOf(S, f.seat, t.seat)).length || 1; incoming += 22 / targets; });
 const mustLeave = f => { const pl = platUnder(P, f.x, f.y, S.water); return !pl || !dry(pl, wN); };
 const low = me.hp <= 30;
 const wt = K.wt * (me.buf.anchor ? 2 : 1);
 function safety(s, act) {
  const p = P[s.p]; if (!p) return -2000; let v = 0;
  if (!dry(p, wN)) v -= 1000; else if (!dry(p, wN - TIDE_STEP)) v -= 32 * D.tide; else if (!dry(p, wN - 2 * TIDE_STEP)) v -= 9 * D.tide;
  v += (330 - p.y) * 0.035 * D.tide;
  const e = Math.min(s.x - p.x0, p.x1 - s.x); if (e < 52) v -= (52 - e) * 0.55 * D.edge / wt;
  const ex = act === 'special' && (me.kind === 'plane' || me.kind === 'manta') ? 0.15 : 1;
  if (s.stay) v -= incoming * 0.6 * D.dodge * ex; else { const d = dist(s.x, s.y, me.x, me.y); v -= incoming * 0.6 * D.dodge * ex * (d < 45 ? 0.85 : d < 80 ? 0.4 : 0.12); v -= 1.5; }
  S.pickups.forEach(pk => { if (pk.y === s.y && Math.abs(pk.x - s.x) < 26) v += pk.k === 'shell' ? 20 : 15; });
  foes.forEach(f => { const d = dist(f.x, f.y, s.x, s.y); if (d < 64) v -= 6; if (f.kind === 'beru' && canUse(S, f.seat, 'special') && d < 150) v -= 10 * D.edge; });
  return v;
 }
 /* where a foe is likely to be */
 function foeSpots(f) {
  const ps = mustLeave(f) ? 0.04 : (f.bot ? 0.4 : 0.5); const list = [{ x: f.x, y: f.y, p: ps, pi: (platUnder(P, f.x, f.y, S.water) || { i: -1 }).i }];
  if (D.lead > 0 && (R() < D.lead || mustLeave(f))) {
   const Rj = KINDS[f.kind].jump; let best = null, bv = -1e9; const fp = platUnder(P, f.x, f.y, S.water);
   P.forEach(p => { if (!dry(p, wN)) return; for (let x = p.x0 + 10; x <= p.x1 - 10; x += 22) { if (!inRange(f, x, p.y, Rj)) continue; if (fp && p.i === fp.i && Math.abs(x - f.x) < 40) continue; const v = (330 - p.y) * 0.05 - (dry(p, wN - TIDE_STEP) ? 0 : 30) - Math.max(0, 50 - Math.min(x - p.x0, p.x1 - x)) * 0.3 + (x > f.x ? 0.01 : 0); if (v > bv) { bv = v; best = { x, y: p.y, pi: p.i }; } } });
   if (best) list.push({ x: best.x, y: best.y, p: (1 - ps) * 0.45, pi: best.pi });
  }
  return list;
 }
 const FS = foes.map(f => ({ f, spots: foeSpots(f) }));
 const shieldF = f => (KINDS[f.kind].third === 'shield' && canUse(S, f.seat, 'shield')) ? 0.65 : 1;
 const killB = (f, dmg) => f.hp <= dmg ? 55 : f.hp <= dmg * 2 ? 8 : 0;
 const threatW = f => 1 + (f.ko | 0) * 0.15 + (D.ko * (f.hp < 40 ? 0.35 : 0));
 function attack(s, act, hov) {
  /* best (value, aim) of one action fired from spot s */
  const bx = s.x, by = hov ? s.y - 72 : s.y; let best = { v: 0, aim: null };
  const dbl = me.buf.dbl && (act === 'missile' || act === 'bomb') ? 1.75 : 1;
  FS.forEach(({ f, spots }) => spots.forEach(fp => {
   const tw = threatW(f), sf = shieldF(f), fps = { x: fp.x, y: fp.y, p: fp.pi };
   let v = 0, aim = null;
   if (act === 'missile') {
    const dir = fp.x >= bx ? 1 : -1, mx = bx + dir * 30, my = by - 40, tx = fp.x, ty = fp.y - 30;
    const L = dist(mx, my, tx, ty) || 1, blk = segRects(P, S.water, mx, my, mx + (tx - mx) * (1 - 22 / L), my + (ty - my) * (1 - 22 / L));
    if (blk >= 0) return;
    const push = MIS.kx / (KINDS[f.kind].wt * (f.buf.anchor ? 2 : 1)) * 0.27;
    v = fp.p * sf * (MIS.dmg * dbl * 0.8 + killB(f, MIS.dmg * dbl) + koChance(S, f, fps, dir, push) * 75 * D.ko) * tw; aim = { x: tx, y: ty };
   } else if (act === 'bomb' || act === 'coco') {
    const pf = platUnder(P, fp.x, fp.y, S.water); const inner = pf ? (fp.x - pf.x0 < pf.x1 - fp.x ? 1 : -1) : 0;
    const e = pf ? Math.min(fp.x - pf.x0, pf.x1 - fp.x) : 99; const off = D.ko > 0.5 && e < 55 ? inner * 20 : 0;
    const spec = act === 'coco' ? COCO : BOMB, push = spec.kn * 0.55 / (KINDS[f.kind].wt * (f.buf.anchor ? 2 : 1)) * 0.36;
    let over = 0; P.forEach(q => { if (dry(q, S.water) && q.y < fp.y - 20 && q.y > fp.y - 130 && fp.x > q.x && fp.x < q.x + q.w) over = 1; });
    const base = act === 'coco' ? 15 + 2 * 5 : 25 * dbl;
    v = (fp.p * sf * (base * 0.8 + killB(f, base) + (off ? koChance(S, f, fps, -inner, push + 25) * 80 * D.ko : 0)) + (1 - fp.p) * (act === 'coco' ? 0.5 : 0.22) * 9) * (over ? 0.45 : 1) * tw;
    aim = { x: fp.x + off, y: fp.y - 4 };
   } else if (act === 'hook') {
    const dir = fp.x >= bx ? 1 : -1, mx = bx + dir * 30, my = by - 40, tx = fp.x, ty = fp.y - 30, L = dist(mx, my, tx, ty);
    if (L > HOOK.range + 10 || L < 50) return; if (segRects(P, S.water, mx, my, tx, ty) >= 0) return;
    const travel = Math.min(Math.abs(bx - fp.x) * 1.55, 500) * 0.74, lx = fp.x + (bx > fp.x ? 1 : -1) * travel;
    const ko = fallSafe(S, lx, fp.y - 60) ? 0.05 : 0.8;
    v = fp.p * sf * (HOOK.dmg + killB(f, HOOK.dmg) + ko * 85 * D.ko) * tw; aim = { x: tx, y: ty };
   }
   if (v > best.v) best = { v, aim };
  }));
  return best;
 }
 function shockVal(s) {
  let v = 0; FS.forEach(({ f, spots }) => spots.forEach(fp => { const d = dist(fp.x, fp.y, s.x, s.y); if (d > SHOCK.R - 10) return; const dir = fp.x >= s.x ? 1 : -1, K2 = 330 * (1 - d / SHOCK.R) + 150, push = K2 / (KINDS[f.kind].wt * (f.buf.anchor ? 2 : 1)) * 0.32 + 20; v += fp.p * shieldF(f) * (SHOCK.dmg + killB(f, SHOCK.dmg) + koChance(S, f, { x: fp.x, y: fp.y, p: fp.pi }, dir, push) * 85 * D.ko) * threatW(f); }));
  return v;
 }
 const opts = [];
 const Rn = jumpRange(S, seat, 'missile');
 const spots = spotsFor(S, seat, Rn).map(s => ({ s, sv: safety(s, 'missile') })).sort((a, b) => b.sv - a.sv).slice(0, 7);
 const hasSh = canUse(S, seat, 'shield'), hasSp = canUse(S, seat, 'special');
 spots.forEach(({ s, sv }) => {
  const m = attack(s, 'missile'), b = attack(s, 'bomb');
  if (m.aim) opts.push({ v: sv + m.v, s, act: 'missile', aim: m.aim });
  if (b.aim) opts.push({ v: sv + b.v, s, act: 'bomb', aim: b.aim });
  if (hasSh) { const inc = s.stay ? incoming : incoming * 0.45; const e = Math.min(s.x - (P[s.p] || { x0: 0 }).x0, (P[s.p] || { x1: 0 }).x1 - s.x); opts.push({ v: sv + (inc * 1.15 + (e < 45 ? 14 : 0) + (low ? 14 : 0)) * D.shield + incoming * 0.6 * D.dodge * (s.stay ? 1 : 0.3), s, act: 'shield', aim: null }); }
  if (hasSp && me.kind === 'beru') opts.push({ v: sv + shockVal(s) * D.spec, s, act: 'special', aim: null });
  if (hasSp && me.kind === 'fisher') { const h = attack(s, 'hook'); if (h.aim) opts.push({ v: sv + h.v * D.spec, s, act: 'special', aim: h.aim }); }
  if (hasSp && me.kind === 'catapult') { const c = attack(s, 'coco'); if (c.aim) opts.push({ v: sv + c.v * D.spec, s, act: 'special', aim: c.aim }); }
 });
 if (hasSp && (me.kind === 'plane' || me.kind === 'manta')) {
  const Rs = jumpRange(S, seat, 'special');
  spotsFor(S, seat, Rs).map(s => ({ s, sv: safety(s, 'special') })).sort((a, b) => b.sv - a.sv).slice(0, 5).forEach(({ s, sv }) => {
   const a = me.kind === 'plane' ? attack(s, 'bomb', true) : attack(s, 'missile');
   const dodge = incoming * 0.6 * D.dodge * (me.kind === 'plane' ? 0.9 : 0.7);
   opts.push({ v: sv + (a.v + dodge + (low ? 10 : 0)) * D.spec, s, act: 'special', aim: a.aim || defaultAim(S, seat) });
  });
 }
 if (!opts.length) { const s = spots[0] ? spots[0].s : { stay: true }; opts.push({ v: 0, s, act: 'bomb', aim: defaultAim(S, seat) }); }
 opts.sort((a, b) => b.v - a.v);
 let pick = opts[0];
 if (D.rand && R() < D.rand) pick = opts[Math.floor(R() * Math.min(opts.length, 6))];
 if (D.stay && R() < D.stay && pick.s && !pick.s.stay) { const st = opts.find(o => o.s.stay && P[o.s.p] && dry(P[o.s.p], wN)); if (st) pick = st; }
 let aim = pick.aim || defaultAim(S, seat);
 if (D.noise) aim = { x: aim.x + (R() * 2 - 1) * D.noise, y: aim.y + (R() * 2 - 1) * D.noise * 0.35 };
 return { mv: pick.s && !pick.s.stay ? { x: pick.s.x, y: pick.s.y } : null, act: pick.act, aim: { x: r1(aim.x), y: r1(aim.y) } };
}

/* ---------------------------------------------------------------- headless match (tests / balance sims) */
function autoMatch(o) {
 o = o || {};
 let S = newMatch({ arena: o.arena, mode: o.mode, seed: o.seed, players: o.players });
 let guard = 0; const stats = { rounds: 0 };
 while (S.phase !== 'over' && guard++ < 60) {
  const plans = {};
  S.tanks.forEach(t => { if (t.alive) plans[t.seat] = aiPlan(S, t.seat, t.diff || 'normal', (S.seed * 31 + S.round * 977 + t.seat * 131) >>> 0); });
  S = resolve(S, plans, { record: false }).state;
 }
 stats.rounds = S.round; stats.stuck = S.phase !== 'over';
 return { S, win: S.win, order: S.order, stats };
}

root.RR = { W, H, G, DT, TIDE0, TIDE_STEP, KINDS, ORDER, ARENAS, ARENA_IDS, PICKS, PICK_ORDER, MIS, BOMB, COCO, SHOCK, HOOK,
 plats, dry, platUnder, floodsAfter, inRange, jumpRange, snapJump, canUse, sanitize, defaultAim, newMatch, resolve, preview, aiPlan, autoMatch, clone, mkRng, AID };
})(typeof window !== 'undefined' ? window : globalThis);
