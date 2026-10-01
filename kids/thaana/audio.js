// Plays the owner's recordings when they exist; otherwise the line is shown as a caption for an estimated time.
// RECORDINGS lists the keys that have a file in audio/ (none yet). Other keys are never requested, so there are
// no 404s and no wait for a missing file (iOS can take seconds to report one). Add each key here as it is recorded.
export const RECORDINGS = new Set([]);
export const LINES = {
  go: 'Here we gooo!', good: 'Wow! So good!', oops1: 'Oh oh, try again!', oops2: "That's sooo close! Let's try again!",
  gotthis: 'You got this!', yippee: 'Yippee!', lala: 'La-la-la-laaa', allknown: 'You know them all!', hum: '🎵 hmm-hmm-hmm', song: '🎵 Miss Taatal\'s Thaana Song',
};
export function caption(key) {
  if (Object.hasOwn(LINES, key)) return LINES[key];
  const [kind, name] = key.split(':');
  if (kind === 'meet') return `This is ${name}! Say it with me!`;
  if (kind === 'find') return `Find ${name}!`;
  if (kind === 'listen') return `Listen… which one is ${name}?`;
  if (kind === 'trace') return `Trace ${name} with your finger!`;
  if (kind === 'learned') return `You learned ${name}!`;
  if (kind === 'letter') return name;
  return '';
}
const estimate = text => Math.max(900, Math.min(3000, 60 * text.length));
export const estimateFor = key => estimate(caption(key));   // how long a line takes when there is no recording

export function createAudio({ load, base, muted, recordings = RECORDINGS }) {
  const cache = new Map(); let current = null;
  async function get(key) {
    if (!recordings.has(key)) return null;
    if (!cache.has(key)) cache.set(key, (async () => { try { return await load(base + key.replace(':', '-') + '.m4a'); } catch (e) { return null; } })());
    return cache.get(key);
  }
  return {
    async play(key) {
      const clip = await get(key);
      if (!clip) return estimateFor(key);
      if (!muted) { try { current && current.stop(); current = clip; await clip.play(); } catch (e) { /* autoplay blocked: caption still shows */ } }
      return Math.round(clip.duration * 1000);
    },
    stopAll() { try { current && current.stop(); } catch (e) {} current = null; },
    setMuted(b) { muted = b; if (b) this.stopAll(); },
  };
}

// Browser loader: HTMLAudioElement, resolves null when the file is missing.
export function browserLoader(url) {
  return new Promise(res => {
    const a = new Audio(); a.preload = 'auto';
    let resolved = false;
    const resolve = (clip) => { if (!resolved) { resolved = true; res(clip); } };
    const loadHandler = () => {
      const duration = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 1;
      resolve({ duration, play: () => { a.currentTime = 0; return a.play(); }, stop: () => a.pause() });
    };
    a.onloadedmetadata = loadHandler;
    a.oncanplaythrough = loadHandler;
    a.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 2500);
    a.src = url;
  });
}
