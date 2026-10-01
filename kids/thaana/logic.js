// Thaana Fun game rules. Pure functions only: no DOM, no timers, so they run in the browser and in Node tests.
export const LETTERS = [
  ['ހ', 'haa'], ['ށ', 'shaviyani'], ['ނ', 'noonu'], ['ރ', 'raa'], ['ބ', 'baa'], ['ޅ', 'lhaviyani'],
  ['ކ', 'kaafu'], ['އ', 'alifu'], ['ވ', 'vaavu'], ['މ', 'meemu'], ['ފ', 'faafu'], ['ދ', 'dhaalu'],
  ['ތ', 'thaa'], ['ލ', 'laamu'], ['ގ', 'gaafu'], ['ޏ', 'gnaviyani'], ['ސ', 'seenu'], ['ޑ', 'daviyani'],
  ['ޒ', 'zaviyani'], ['ޓ', 'taviyani'], ['ޔ', 'yaa'], ['ޕ', 'paviyani'], ['ޖ', 'javiyani'], ['ޗ', 'chaviyani'],
].map(([ch, name]) => ({ ch, name }));

export const ATOLL1 = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function makeRng(seed) {            // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function options(target, pool, count, rng) {
  const others = shuffle(pool.filter(i => i !== target), rng).slice(0, count - 1);
  return shuffle([target, ...others], rng);
}

export function islandsFor(atoll) {
  const list = atoll.map((idx, n) => ({ id: `a1-${n}`, kind: 'letter', letters: [idx] }));
  list.push({ id: 'a1-r', kind: 'review', letters: atoll.slice() });
  return list;
}

export function buildTurns(island, atoll, rng) {
  if (island.kind === 'letter') {
    const t = island.letters[0];
    return ['meet', 'find', 'listen', 'find', 'trace', 'find'].map(type => ({
      type, target: t,
      options: type === 'find' ? options(t, atoll, 6, rng) : type === 'listen' ? options(t, atoll, 4, rng) : [t],
    }));
  }
  const targets = shuffle(island.letters, rng).slice(0, 6);
  return targets.map((t, i) => {
    const type = i % 2 ? 'listen' : 'find';
    return { type, target: t, options: options(t, atoll, type === 'find' ? 6 : 4, rng) };
  });
}

export function starsFor(mistakes) { return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1; }

const KEY = 'tf-progress-v1';
export function createProgress(storage) {
  let data = {};
  try { const raw = storage && storage.getItem(KEY); const v = raw ? JSON.parse(raw) : {}; if (v && typeof v === 'object') data = v; } catch (e) { data = {}; }
  const save = () => { try { storage && storage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: keep in memory */ } };
  const best = id => Math.max(0, Math.min(3, data[id] | 0));   // a tampered save (99, -5) must not break the map's star row
  return {
    best,
    record(id, stars) { if (stars > best(id)) { data[id] = stars; save(); } },
    isUnlocked(id, islands) {
      const i = islands.findIndex(x => x.id === id);
      return i === 0 || (i > 0 && best(islands[i - 1].id) > 0);
    },
  };
}

export function idleAction(msIdle) { return msIdle >= 15000 ? 'glow' : msIdle >= 8000 ? 'hum' : 'none'; }

export function traceResult(ink, drawn, tol) {
  if (!ink.length || drawn.length < 3) return { coverage: 0, stray: 1, ok: false };
  const near = (p, set) => set.some(q => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 <= tol * tol);
  const coverage = ink.filter(p => near(p, drawn)).length / ink.length;
  const stray = drawn.filter(p => !near(p, ink)).length / drawn.length;
  return { coverage, stray, ok: coverage >= 0.6 && stray <= 0.4 };
}
