/* =====================================================================================
   Guess the Celebrity: content (who is in the game, and where the photos are).   celebrity/content.js
   Shared by the game (celebrity/index.html) and the admin page (admin/, Content tab). No photos live in this site:
   the game fetches the LIVE list when it starts.

   The live list = ONE small Firestore document, trivia/celebrity, field "data" (a JSON string, the "manifest"):
     {v:1, at, people:[{id, name, nameDv, g:'M'|'F', c:category, live:true,
                        photos:[{id, k:mediaKey, d:'E'|'M'|'H', w, h, b:{hair,ear,chin,nose,mouth,eye}}]}]}
   The admin page rebuilds it from the admin-only people docs (trivia_celebs/{personId}) after EVERY change, with
   only people switched Live (and only their photos). One read per game start; hidden people are never sent.
   Photos: the dg-admin Worker, GET <WORKER>/media/<key> (Cloudflare R2, extras/cloudflare/SETUP-r2-media.md).

   Storage behind one small interface, two backends:
     production : manifest from Firestore (REST, no SDK), photos from the Worker
     local dev  : localhost only, ?dev=http://localhost:PORT  (never in the phone app). The dev server
                  (extras/celebrity/dev_media_server.py) serves a folder OUTSIDE this repo with the same paths:
                  GET /manifest.json, GET|PUT|DELETE /media/<key>, GET /admin-media/<key>.
   ===================================================================================== */
(function (root) {
  'use strict';
  var WORKER = 'https://dg-admin.rasewgaming.workers.dev';
  var PROJECT = 'dhivehi-digu', API_KEY = 'AIzaSyCl9Xz5r80755hYX0ww2GRaB6TZTH6sayE';
  var DOC_URL = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/trivia/celebrity?key=' + API_KEY;
  var HINTS = ['hair', 'ear', 'chin', 'nose', 'mouth', 'eye'];          /* hint order: least revealing first, eye last */
  var DIFF = { Easy: 'E', Medium: 'M', Hard: 'H', E: 'E', M: 'M', H: 'H' };
  var STATUSES = ['To check', 'Asked', 'Approved', 'Refused', 'Official or public source'];

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

  /* a photo's address (game and admin thumbnails) */
  function mediaUrl(key) { return base() + '/media/' + String(key || '').split('/').map(encodeURIComponent).join('/'); }

  var num = function (v, a, b) { v = +v; return isFinite(v) ? Math.max(a, Math.min(b, v)) : a; };
  function cleanBox(x) { return Array.isArray(x) && x.length === 4 && x.every(function (v) { return typeof v === 'number' && isFinite(v); }) ? x.map(function (v) { return Math.round(num(v, 0, 1) * 1e4) / 1e4; }) : null; }
  var KEY_RE = /^(celeb|song)\/[a-z0-9][a-z0-9-]{0,95}\.webp$/;

  /* admin people docs -> the public manifest (only live people, only photos with a valid key and all six hint boxes) */
  function buildManifest(people) {
    var out = [];
    (people || []).forEach(function (p) {
      if (!p || p.live !== true || typeof p.name !== 'string' || !p.name.trim()) return;
      var ph = (p.photos || []).map(function (f) {
        var b = {}, ok = f && KEY_RE.test(f.key || '') && HINTS.every(function (h) { return (b[h] = cleanBox(f.boxes && f.boxes[h])); });
        return ok ? { id: String(f.id), k: f.key, d: DIFF[f.difficulty] || 'M', w: Math.round(num(f.w, 1, 4000)), h: Math.round(num(f.h, 1, 4000)), b: b } : null;
      }).filter(Boolean);
      if (!ph.length) return;
      out.push({ id: String(p.id), name: p.name.trim().slice(0, 40), nameDv: String(p.nameDv || '').slice(0, 40), g: p.gender === 'F' ? 'F' : 'M',
        c: String(p.category || '').slice(0, 30), live: true, photos: ph });
    });
    out.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return { v: 1, at: Date.now(), people: out };
  }

  /* any manifest from outside -> a clean list of live people (defensive: drops anything not live or malformed) */
  function parseManifest(m) {
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
    var people = m && Array.isArray(m.people) ? m.people : [];
    var seen = {};
    return people.filter(function (p) {
      if (!p || p.live !== true || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.photos) || seen[p.id]) return false;
      p.photos = p.photos.filter(function (f) { return f && KEY_RE.test(f.k || '') && f.b && HINTS.every(function (h) { return cleanBox(f.b[h]); }); });
      seen[p.id] = 1;
      return p.photos.length > 0;
    });
  }

  /* the live list: Firestore (production) or the dev server. Cached on the device so vs Computer works offline. */
  var CACHE = 'celeb-manifest';
  function readCache() { try { var c = JSON.parse(localStorage.getItem(CACHE) || 'null'); return c && c.dev === DEV && Array.isArray(c.people) ? c : null; } catch (e) { return null; } }
  function loadLive() {
    var url = DEV ? DEV + '/manifest.json' : DOC_URL;
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return { people: [] };           /* no list published yet = nobody live */
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (j) {
        if (DEV) return j;
        var f = j && j.fields && j.fields.data;
        return f && typeof f.stringValue === 'string' ? f.stringValue : { people: [] };
      });
    }).then(function (m) {
      var people = parseManifest(m);
      try { localStorage.setItem(CACHE, JSON.stringify({ dev: DEV, at: Date.now(), people: people })); } catch (e) {}
      return { people: people, fresh: true };
    }).catch(function (e) {
      var c = readCache();
      if (c) return { people: parseManifest({ people: c.people }), fresh: false };
      throw e;
    });
  }

  root.DGCelebContent = { WORKER: WORKER, DEV: DEV, HINTS: HINTS, STATUSES: STATUSES, KEY_RE: KEY_RE, DOC_URL: DOC_URL,
    mediaUrl: mediaUrl, base: base, buildManifest: buildManifest, parseManifest: parseManifest, loadLive: loadLive };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DGCelebContent;
})(typeof window !== 'undefined' ? window : globalThis);
