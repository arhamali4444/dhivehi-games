// dhivehi-games/kids/thaana/sfx.js
// Miss Taatal's soft sound effects, made live with Web Audio (no files): music-box bells, wooden xylophone notes,
// a gentle "oh-oh", a water-drop bloop and tiny footsteps. The tones are the owner-approved ones
// (taatal_sfx_soft.py, 2 Oct 2026). Quiet on purpose: the master volume is 0.4.
// Silent until unlock() is called from a tap (browsers block sound before one); muted and hidden mean silent.
export const SOUNDS = ['chime', 'twinkle', 'hop', 'land', 'ohoh', 'bloop', 'step', 'perk'];
const MASTER = 0.4, LEVEL = 1.6;                       // LEVEL: the demo mix was normalised up by about this much
const midi = n => 440 * 2 ** ((n - 69) / 12);
const HOPS = [72, 74, 76, 79, 81, 79, 76, 74, 72];     // a happy pentatonic walk, one note per hop
const TWINKLES = [91, 93, 96, 98];

export function createSfx({ Ctx = globalThis.AudioContext || globalThis.webkitAudioContext, muted = false,
  isHidden = () => typeof document !== 'undefined' && document.hidden } = {}) {
  let ctx = null, out = null, broken = !Ctx;

  // one sine partial: quick attack, then an exponential fade (rate k per second), stopped after dur
  function partial(f, amp, t, dur, k, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * LEVEL, t + attack);
    g.gain.setTargetAtTime(0, t + attack, 1 / k);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur);
  }
  const musicbox = (f, t, dur = 1.2, vol = 0.25) => {
    partial(f, vol, t, dur, 3.2, 0.004); partial(f * 2, 0.35 * vol, t, dur, 9.2, 0.004);
    partial(f * 3.01, 0.18 * vol, t, dur, 12.2, 0.004); partial(f * 4.2, 0.08 * vol, t, dur, 17.2, 0.004);
  };
  const xylo = (f, t, dur = 0.5, vol = 0.28) => { partial(f, vol, t, dur, 9, 0.002); partial(f * 3.93, 0.25 * vol, t, dur, 39, 0.002); };
  function softpad(f, t, dur, vol) {                  // warm held note: slow swell in, gentle release
    [[1, 1], [2, 0.3], [3, 0.1]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * m;
      g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vol * LEVEL, t + 0.15);
      g.gain.setValueAtTime(a * vol * LEVEL, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function bloop(t) {                                  // a soft water-drop: a sine sliding down
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 620; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.14);
    g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15 * LEVEL, t + 0.005); g.gain.setTargetAtTime(0, t + 0.04, 0.05);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
  }

  const play = {
    chime: t => [84, 88, 91, 96].forEach((m, i) => musicbox(midi(m), t + 0.06 * i, 1.2, 0.16)),
    twinkle: (t, k) => musicbox(midi(TWINKLES[(k == null ? Math.floor(Math.random() * 4) : k) % 4]), t, 0.6, 0.07),
    hop: (t, k = 0) => xylo(midi(HOPS[k % HOPS.length]), t, 0.5, 0.26),
    land: t => xylo(midi(60), t, 0.25, 0.1),
    ohoh: t => { musicbox(midi(76), t, 1.6, 0.18); musicbox(midi(72), t + 0.45, 1.6, 0.18); softpad(midi(60), t, 2.0, 0.05); },
    bloop,
    step: (t, k = 0) => xylo(midi(k % 2 ? 81 : 84), t, 0.18, 0.08),
    perk: t => [72, 76, 79, 84].forEach((m, i) => xylo(midi(m), t + 0.07 * i, 0.45, 0.2)),
  };

  return {
    get ready() { return !!ctx && !broken; },
    unlock() {                                         // call from a tap: makes (once) and wakes the audio context
      if (broken) return;
      try {
        if (!ctx) { ctx = new Ctx(); out = ctx.createGain(); out.gain.value = MASTER; out.connect(ctx.destination); }
        if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => {});
      } catch (e) { broken = true; ctx = null; }
    },
    play(name, k) {                                    // true when the sound was scheduled
      if (!ctx || broken || muted || isHidden() || !Object.hasOwn(play, name)) return false;
      try { play[name](ctx.currentTime + 0.01, k); return true; } catch (e) { return false; }
    },
    setMuted(b) { muted = !!b; },
    pause(on) { try { ctx && (on ? ctx.suspend && ctx.suspend() : ctx.resume && ctx.resume()); } catch (e) {} },   // app hidden: stop ringing notes
  };
}
