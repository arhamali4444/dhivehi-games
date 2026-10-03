/* =====================================================================================
   Guess the Song: content (which songs are in the game, and where the clips are).            song/content.js
   Shared by the game (song/index.html) and the admin page (admin/, Content tab → Songs). No clips live in this site:
   the game fetches the LIVE list when it starts.

   The live list = ONE small Firestore document, trivia/song, field "data" (a JSON string, the "manifest"):
     {v:1, at, songs:[{id, t:titleThaana, tl:transliteration, a:artist, aDv:artistThaana, y:year|0, g:genre,
                       d:'E'|'M'|'H', u:listenUrl|'', k:wavKey, kc:compressedKey|'', kt:compressedType|'', live:true}]}
   The admin page rebuilds it from the admin-only song docs (trivia_songs/{songId}) after EVERY change, with only
   songs switched Live that have a clip. One read per game start; hidden songs are never sent.
   Clips: the dg-admin Worker, GET <WORKER>/media/<key> (Cloudflare R2). Every clip is exactly 5.0 s, cut by the admin
   page with 30 ms fades: a 16-bit mono 22.05 kHz WAV (always, every browser can decode it) and, when the admin's
   browser could make one, a small compressed copy (WebM/Opus, Ogg or MP4/AAC) that the game prefers when it can play it.
   Shorter clip lengths (3, 2, 1 s) are cut from the START of the 5 s clip at play time.

   Storage behind one small interface, two backends (as Guess the Celebrity):
     production : manifest from Firestore (REST, no SDK), clips from the Worker
     local dev  : localhost only, ?dev=http://localhost:PORT (never in the phone app). The dev server
                  (extras/celebrity/dev_media_server.py) serves a folder OUTSIDE this repo with the same paths:
                  GET /manifest-song.json, GET|PUT|DELETE /media/<key>.
   ===================================================================================== */
(function (root) {
  'use strict';
  var WORKER = 'https://dg-admin.rasewgaming.workers.dev';
  var PROJECT = 'dhivehi-digu', API_KEY = 'AIzaSyCl9Xz5r80755hYX0ww2GRaB6TZTH6sayE';
  var DOC_URL = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/trivia/song?key=' + API_KEY;
  var DIFF = { Easy: 'E', Medium: 'M', Hard: 'H', E: 'E', M: 'M', H: 'H' };
  var STATUSES = ['To check', 'Asked', 'Approved', 'Refused', 'Official or public source'];
  var GENRES = ['Boduberu', 'Pop', 'Classic', 'Ballad', 'Raivaru', 'Film song', 'Patriotic', 'Religious', 'Other'];
  var CLIP_S = 5;                 /* the stored clip */
  var CLIP_SR = 22050;            /* WAV sample rate */
  var FADE_S = 0.03;              /* 30 ms fades in and out */
  var LENS = [[5, 1.0], [3, 1.3], [2, 1.6], [1, 2.0]];   /* clip length (s) and its points multiplier */

  var isApp = function () { return !!(root.DG_APP || (root.location && root.location.protocol === 'capacitor:') || (root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform())); };
  function devBase() {
    try {
      if (isApp()) return '';
      var h = root.location.hostname;
      if (!(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(h) || /\.(localhost|test)$/.test(h))) return '';
      var v = new URLSearchParams(root.location.search).get('dev') || '';
      return /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(v) ? v : '';
    } catch (e) { return ''; }
  }
  var DEV = typeof location !== 'undefined' ? devBase() : '';
  var base = function () { return DEV || WORKER; };
  function mediaUrl(key) { return base() + '/media/' + String(key || '').split('/').map(encodeURIComponent).join('/'); }

  var KEY_RE = /^song\/[a-z0-9][a-z0-9-]{0,95}\.(wav|webm|ogg|m4a)$/;
  var WAV_RE = /^song\/[a-z0-9][a-z0-9-]{0,95}\.wav$/;
  var TYPES = { wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4' };
  var str = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
  function cleanUrl(u) { u = str(u, 300); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
  function cleanYear(y) { y = parseInt(y, 10); return y >= 1900 && y <= 2100 ? y : 0; }

  /* admin song docs -> the public manifest (only live songs with a valid WAV clip key) */
  function buildManifest(songs) {
    var out = [];
    (songs || []).forEach(function (s) {
      if (!s || s.live !== true || typeof s.title !== 'string' || !s.title.trim()) return;
      var c = s.clip || {};
      if (!WAV_RE.test(c.key || '')) return;
      var kc = KEY_RE.test(c.keyC || '') && !WAV_RE.test(c.keyC) ? c.keyC : '';
      out.push({ id: String(s.id), t: str(s.title, 60), tl: str(s.titleLt, 60), a: str(s.artist, 50), aDv: str(s.artistDv, 50), y: cleanYear(s.year),
        g: str(s.genre, 30), d: DIFF[s.difficulty] || 'M', u: cleanUrl(s.url), k: c.key, kc: kc, kt: kc ? TYPES[kc.split('.').pop()] : '', live: true });
    });
    out.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return { v: 1, at: Date.now(), songs: out };
  }

  /* any manifest from outside -> a clean list of live songs (defensive: drops anything not live or malformed) */
  function parseManifest(m) {
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
    var songs = m && Array.isArray(m.songs) ? m.songs : [];
    var seen = {};
    return songs.filter(function (s) {
      if (!s || s.live !== true || typeof s.id !== 'string' || typeof s.t !== 'string' || !s.t.trim() || !WAV_RE.test(s.k || '') || seen[s.id]) return false;
      if (!(KEY_RE.test(s.kc || '') && TYPES[s.kc.split('.').pop()] === s.kt)) { s.kc = ''; s.kt = ''; }
      s.tl = str(s.tl, 60); s.a = str(s.a, 50); s.aDv = str(s.aDv, 50); s.g = str(s.g, 30); s.y = cleanYear(s.y); s.u = cleanUrl(s.u); s.d = DIFF[s.d] || 'M';
      seen[s.id] = 1;
      return true;
    });
  }

  var CACHE = 'song-manifest';
  function readCache() { try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.dev === DEV && Array.isArray(c.songs) ? c : null; } catch (e) { return null; } }
  function loadLive() {
    var url = DEV ? DEV + '/manifest-song.json' : DOC_URL;
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return { songs: [] };          /* no list published yet = nothing live */
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (j) {
        if (DEV) return j;
        var f = j && j.fields && j.fields.data;
        return f && typeof f.stringValue === 'string' ? f.stringValue : { songs: [] };
      });
    }).then(function (m) {
      var songs = parseManifest(m);
      try { localStorage.setItem(CACHE, JSON.stringify({ dev: DEV, at: Date.now(), songs: songs })); } catch (e) {}
      return { songs: songs, fresh: true };
    }).catch(function (e) {
      var c = readCache();
      if (c) return { songs: parseManifest({ songs: c.songs }), fresh: false };
      throw e;
    });
  }

  /* ---------- audio helpers (the game plays clips with them; the admin page cuts clips with them) ---------- */
  /* play `len` seconds from the start of `buffer` at `when`, with fades, into `dest`. Exactly len seconds are heard:
     the gain is 0 at when, 1 after the fade, back to 0 at when + len, and the source stops at when + len. */
  function scheduleClip(ctx, buffer, dest, when, len, fade) {
    fade = fade == null ? FADE_S : fade;
    len = Math.max(0.05, Math.min(len, buffer.duration));
    var f = Math.min(fade, len / 4), src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buffer;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + f);
    g.gain.setValueAtTime(1, when + len - f);
    g.gain.linearRampToValueAtTime(0, when + len);
    src.connect(g); g.connect(dest);
    src.start(when, 0, len);
    src.stop(when + len);
    return { src: src, gain: g, when: when, len: len, end: when + len };
  }
  /* cut the admin's song: `len` (5) seconds from `start`, mono, 22.05 kHz, 30 ms fades -> Float32Array */
  function cutClip(buffer, start, len) {
    len = len || CLIP_S;
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    var n = Math.round(len * CLIP_SR), ctx = new OAC(1, n, CLIP_SR);
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buffer;
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, FADE_S);
    g.gain.setValueAtTime(1, len - FADE_S); g.gain.linearRampToValueAtTime(0, len);
    src.connect(g); g.connect(ctx.destination);
    src.start(0, Math.max(0, Math.min(start, Math.max(0, buffer.duration - len))), len);
    return ctx.startRendering().then(function (b) { var d = b.getChannelData(0); d[d.length - 1] = 0; return d; });
  }
  /* Float32Array -> 16-bit mono WAV Blob (about 220 KB for 5 s at 22.05 kHz) */
  function encodeWav(data, sr) {
    sr = sr || CLIP_SR;
    var n = data.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var s = Math.max(-1, Math.min(1, data[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([buf], { type: 'audio/wav' });
  }

  root.DGSongContent = { WORKER: WORKER, DEV: DEV, STATUSES: STATUSES, GENRES: GENRES, KEY_RE: KEY_RE, WAV_RE: WAV_RE, TYPES: TYPES, DOC_URL: DOC_URL,
    CLIP_S: CLIP_S, CLIP_SR: CLIP_SR, FADE_S: FADE_S, LENS: LENS,
    mediaUrl: mediaUrl, base: base, buildManifest: buildManifest, parseManifest: parseManifest, loadLive: loadLive,
    scheduleClip: scheduleClip, cutClip: cutClip, encodeWav: encodeWav, cleanUrl: cleanUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DGSongContent;
})(typeof window !== 'undefined' ? window : globalThis);
