/* Dhivehi Games - shared cartoon character avatars (window.DGAvatar)
   Dependency-free, no modules. Include with <script src="/shared/avatar.js"></script>.
   Art: flat vector bust in a circle, same family as the Dhogu suspects (ink #231942, no outlines),
   with soft gradients on skin / hair / clothes, catchlights and a light rim shade.

   QUICK API
   DGAvatar.render(cfg, {size, expression, animate, ring, title, crop, bust, bg}) -> SVG string
     animate:true  = idle life: random blink / double blink, breathing, glances, a rare small smile (off with reduced motion)
     expression    = 'happy' | 'laugh' | 'wink' | 'shocked' | 'smug' | 'thinking' | 'sad' | 'angry' | 'sleepy' | 'blink'
   DGAvatar.react(el, expression, ms = 1600)
     Briefly switches an avatar already on the page to an expression with a springy pop, then returns to idle.
     el = the <svg class="dga-av"> or any element containing one (e.g. a seat). Safe to call often:
     a new call replaces the running reaction. Returns false if no avatar was found.
     e.g.  DGAvatar.react(seatEl, 'shocked');  DGAvatar.react(meEl, 'laugh', 2000);
   DGAvatar.random(seed?, {body:'f'|'m'}?)  DGAvatar.load(owned?)  DGAvatar.save(cfg)  DGAvatar.validate(cfg, owned)
   DGAvatar.openBuilder(el, {cfg, owned, boli, onSave, onBuy, onBoli, onClose, theme, boliIcon, boliManaged, tab})
     owned: Set | array | {id:true} map of bought item ids, or true = every item unlocked.
   DGAvatar.looks = ready-made starter characters; DGAvatar.presets = the Dhogu suspects. */
(function (root) {
  'use strict';
  var INK = '#231942';
  var KEY = 'dg-char';

  /* ---------------------------------------------------------------- colour utils */
  function rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(r, g, b) { return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function shade(c, t) { return mix(c, '#1b1030', t); }
  function tint(c, t) { return mix(c, '#ffffff', t); }
  function lum(c) { var x = rgb(c); return (0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2]) / 255; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  /* ---------------------------------------------------------------- catalog */
  // [id, name, value, price, rarity]  price 0 = free.  value: hex | [hexTop, hexBottom] | {p:pattern, base, css}
  var SPEC = {
    body: [['f', 'Female'], ['m', 'Male']],
    skin: [['porcelain', 'Porcelain', '#FFE3CF'], ['light', 'Light', '#F8D0AF'], ['fair', 'Fair', '#EDBB8C'], ['golden', 'Golden', '#DCA36C'],
      ['tan', 'Tan', '#C68650'], ['brown', 'Brown', '#A2663B'], ['deep', 'Deep', '#7F4B2B'], ['ebony', 'Ebony', '#5B331E']],
    face: [['round', 'Round'], ['oval', 'Oval'], ['square', 'Square'], ['heart', 'Heart'], ['full', 'Full']],
    nose: [['button', 'Button'], ['round', 'Round'], ['pointy', 'Pointed'], ['wide', 'Wide'], ['small', 'Tiny'], ['clown', 'Clown', 0, 100, 'rare']],
    cheeks: [['soft', 'Soft blush'], ['none', 'No blush'], ['rosy', 'Rosy']],
    marks: [['none', 'Clear skin'], ['freckles', 'Freckles'], ['mole', 'Beauty mark'], ['both', 'Both'], ['glitter', 'Glitter', 0, 150, 'rare']],
    eyes: [['round', 'Round'], ['dot', 'Button'], ['almond', 'Almond'], ['sleepy', 'Sleepy'], ['wide', 'Sparkly'], ['lashes', 'Lashes'], ['starry', 'Starry', 0, 300, 'epic']],
    eyeColor: [['darkbrown', 'Dark brown', '#3B2416'], ['brown', 'Brown', '#71472A'], ['black', 'Black', '#1C1618'], ['hazel', 'Hazel', '#8F6C2E'], ['honey', 'Honey', '#B5832E'],
      ['green', 'Green', '#3E8E5A'], ['teal', 'Teal', '#1F8C8C'], ['blue', 'Blue', '#3F7FC7'], ['grey', 'Grey', '#7D8A96'], ['amber', 'Amber', '#C08A2A'],
      ['violet', 'Violet', '#8A55E0', 120, 'rare'], ['ice', 'Ice blue', '#8FD3F2', 120, 'rare'], ['gold', 'Gold', '#E6B63A', 300, 'epic']],
    lashes: [['none', 'Natural'], ['subtle', 'Subtle'], ['full', 'Full'], ['dramatic', 'Dramatic', 0, 120, 'rare']],
    brows: [['soft', 'Soft'], ['straight', 'Straight'], ['thick', 'Thick'], ['arched', 'Arched'], ['thin', 'Thin'], ['bushy', 'Bushy'], ['angry', 'Stern'], ['raised', 'Raised'], ['unibrow', 'Unibrow', 0, 80, 'rare']],
    mouth: [['smile', 'Smile'], ['grin', 'Grin'], ['neutral', 'Neutral'], ['smirk', 'Smirk'], ['open', 'Open smile'], ['pout', 'Pout'], ['tongue', 'Cheeky'], ['gap', 'Gap tooth', 0, 100, 'rare']],
    lips: [['none', 'No lipstick'], ['rose', 'Rose', '#D9667A'], ['red', 'Red', '#C7283A'], ['coral', 'Coral', '#F0736A'], ['nude', 'Nude', '#B9786A'],
      ['berry', 'Berry', '#8E2A4E', 100, 'rare'], ['plum', 'Plum', '#6A2A55', 100, 'rare'], ['goldgloss', 'Gold gloss', '#D9AA3A', 300, 'epic']],
    hair: [['short', 'Short crop'], ['buzz', 'Buzz cut'], ['fade', 'Fade'], ['undercut', 'Undercut'], ['sidepart', 'Side part'], ['messy', 'Messy'], ['tufts', 'Kid spiky'],
      ['spiky', 'Spiky'], ['curlytop', 'Curly top'], ['curly', 'Curly'], ['afro', 'Afro'], ['cornrows', 'Cornrows'], ['braids', 'Braids'], ['wavy', 'Wavy'],
      ['long', 'Long straight'], ['fringelong', 'Long with fringe'], ['curtain', 'Curtain bangs'], ['sideswept', 'Side-swept bangs'], ['bob', 'Fringe bob'], ['sleekbob', 'Sleek bob'],
      ['ponytail', 'Ponytail'], ['fringepony', 'Fringe ponytail'], ['bun', 'Bun'], ['highbun', 'High bun & fringe'], ['halfup', 'Half-up'], ['manbun', 'Man bun'], ['mohawk', 'Mohawk', 0, 200, 'rare'],
      ['bald', 'Bald'], ['headscarf', 'Headscarf'], ['hijab', 'Hijab']],
    hairColor: [['black', 'Black', '#1E1B24'], ['darkbrown', 'Dark brown', '#3A2519'], ['brown', 'Brown', '#6A4128'], ['auburn', 'Auburn', '#8C3A22'],
      ['ginger', 'Ginger', '#C8642E'], ['blonde', 'Blonde', '#E2B75E'], ['grey', 'Grey', '#A7A4AE'], ['white', 'Snow', '#ECE7DF'],
      ['pink', 'Bubblegum', '#FF7FB0', 150, 'rare'], ['blue', 'Ocean blue', '#4C86F0', 150, 'rare'], ['mint', 'Lagoon mint', '#36CFAE', 150, 'rare'], ['purple', 'Ube', '#8D5CF0', 150, 'rare'],
      ['fire', 'Fire red', '#E0362F', 150, 'rare'], ['ombre', 'Ombre', ['#3A2519', '#E7BD68'], 250, 'epic'], ['sunset', 'Sunset', ['#FF6FA8', '#FFB347'], 400, 'epic']],
    facial: [['none', 'Clean-shaven'], ['stubble', 'Stubble'], ['mo', 'Moustache'], ['pencil', 'Thin moustache'], ['handlebar', 'Handlebar', 0, 120, 'rare'], ['goatee', 'Goatee'],
      ['chinstrap', 'Chin strap'], ['shortbeard', 'Short beard'], ['beard', 'Full beard'], ['longbeard', 'Long beard', 0, 150, 'rare']],
    glasses: [['none', 'No glasses'], ['round', 'Round'], ['square', 'Square'], ['rect', 'Rectangle'], ['cateye', 'Cat-eye'], ['reading', 'Reading'], ['aviator', 'Aviator'],
      ['sunglasses', 'Sunglasses', 0, 150, 'rare'], ['sporty', 'Sporty', 0, 150, 'rare'], ['heart', 'Heart', 0, 200, 'rare'], ['monocle', 'Monocle', 0, 400, 'epic']],
    glassesColor: [['black', 'Black', '#1F1B2E'], ['tortoise', 'Tortoise', '#7A4A26'], ['red', 'Red', '#D8414B'], ['blue', 'Blue', '#2F6FD1'],
      ['silver', 'Silver', '#A9B2BF'], ['white', 'White', '#F4F1EA'], ['green', 'Green', '#2F9A64'], ['gold', 'Gold', '#D9AA3A', 150, 'rare'], ['rosegold', 'Rose gold', '#E3A48E', 150, 'rare']],
    lens: [['dark', 'Dark', '#1B1B26'], ['blue', 'Blue', '#2F5FA8'], ['green', 'Green', '#2F7A55'], ['pink', 'Pink', '#E0609A'], ['amber', 'Amber', '#C9892F'],
      ['mirror', 'Mirror', ['#E8F4FF', '#6C8FB5'], 150, 'rare'], ['goldmirror', 'Gold mirror', ['#FFF1B8', '#C98A1E'], 250, 'epic'], ['rainbow', 'Rainbow', ['#6FE3FF', '#FF6FD2'], 300, 'epic']],
    hat: [['none', 'No hat'], ['cap', 'Cap'], ['capback', 'Backwards cap'], ['beanie', 'Beanie'], ['bucket', 'Bucket hat'], ['fisher', 'Fisherman cap'], ['headband', 'Headband'],
      ['kulhi', 'Turban'], ['helmet', 'Hard hat'], ['chef', 'Chef hat'], ['gradcap', 'Graduation cap'], ['deerstalker', 'Detective'], ['police', 'Police cap'], ['straw', 'Straw hat'],
      ['headphones', 'Headphones', 0, 150, 'rare'], ['cowboy', 'Cowboy', 0, 200, 'rare'], ['pirate', 'Pirate hat', 0, 200, 'rare'], ['tophat', 'Top hat', 0, 200, 'rare'],
      ['party', 'Party hat', 0, 120, 'rare'], ['bunny', 'Bunny ears', 0, 120, 'rare'], ['horns', 'Devil horns', 0, 150, 'rare'], ['flower', 'Hibiscus', 0, 120, 'rare'],
      ['halo', 'Halo', 0, 350, 'epic'], ['captain', 'Captain hat', 0, 450, 'epic'], ['crown', 'Crown', 0, 1200, 'legendary']],
    mask: [['none', 'No mask'], ['patchL', 'Eye patch (L)'], ['patchR', 'Eye patch (R)'], ['medblue', 'Medical mask'], ['medwhite', 'White mask'], ['medblack', 'Black mask'],
      ['clothdots', 'Dotty mask'], ['clothmv', 'Red & green mask'], ['bandana', 'Bandana'], ['bandaid', 'Band-aid'],
      ['domino', 'Hero mask', 0, 150, 'rare'], ['clown', 'Clown face', 0, 150, 'rare'], ['masquerade', 'Masquerade', 0, 350, 'epic']],
    hatColor: [['red', 'Red', '#E5484D'], ['navy', 'Navy', '#26336B'], ['emerald', 'Emerald', '#1E7A55'], ['yellow', 'Yellow', '#F2B33D'],
      ['black', 'Black', '#26252D'], ['white', 'White', '#F1ECE2'], ['pink', 'Pink', '#F07BA8'], ['sky', 'Sky', '#4FA3E0'], ['brown', 'Brown', '#8A5A33'], ['tan', 'Tan', '#C9A46A'],
      ['gold', 'Gold', '#D9AA3A', 150, 'rare']],
    outfit: [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['polo', 'Polo'], ['shirt', 'Shirt & tie'], ['school', 'School uniform'], ['kurta', 'Kurta'], ['libaas', 'Libaas'],
      ['feyli', 'Feyli sash'], ['fishshirt', "Fisherman's shirt"], ['jersey', 'Football jersey'], ['mvjersey', 'Maldives jersey'], ['police', 'Police uniform'],
      ['trench', 'Detective coat', 0, 450, 'epic'], ['suit', 'Suit', 0, 250, 'rare']],
    outfitColor: [['coral', 'Coral', '#F0645A'], ['ocean', 'Ocean', '#2F7FD1'], ['emerald', 'Emerald', '#1E8A5E'], ['sunshine', 'Sunshine', '#F4B63F'],
      ['violet', 'Violet', '#7B4FD6'], ['navy', 'Navy', '#253766'], ['white', 'White', '#F3EFE7'], ['black', 'Black', '#2A2A33'],
      ['maroon', 'Maroon', '#8E2F45'], ['pink', 'Pink', '#F28DB5'], ['teal', 'Teal', '#179C93'], ['sand', 'Sand', '#D8C3A0'],
      ['neon', 'Neon lime', '#A6E22E', 150, 'rare'], ['gold', 'Gold', '#D9AA3A', 300, 'epic']],
    scarfColor: [['rose', 'Rose', '#E8487A'], ['teal', 'Teal', '#0F8C7E'], ['navy', 'Navy', '#27386A'], ['black', 'Black', '#25232B'], ['cream', 'Cream', '#EADCC2'],
      ['lilac', 'Lilac', '#B58DE0'], ['sky', 'Sky', '#6BB7E8'], ['mustard', 'Mustard', '#D9A43A'], ['maroon', 'Maroon', '#8E2F45'], ['emerald', 'Emerald', '#1E8A5E'],
      ['gold', 'Gold silk', '#E0B24A', 200, 'rare']],
    neck: [['none', 'No necklace'], ['necklace', 'Necklace'], ['beads', 'Beads'], ['bowtie', 'Bow tie'], ['shells', 'Cowrie shells', 0, 180, 'rare'],
      ['pearls', 'Pearls', 0, 200, 'rare'], ['chain', 'Gold chain', 0, 250, 'rare'], ['medal', 'Champion medal', 0, 500, 'epic']],
    paint: [['none', 'No paint'], ['stripes', 'Eye black'], ['flag', 'Maldives colours'], ['heart', 'Heart'], ['whiskers', 'Whiskers'], ['star', 'Gold star', 0, 120, 'rare']],
    earrings: [['none', 'No earrings'], ['studs', 'Studs'], ['hoops', 'Hoops'], ['drops', 'Drops'], ['shells', 'Cowries', 0, 120, 'rare'], ['pearls', 'Pearls', 0, 150, 'rare']],
    bg: [['sky', 'Sky', '#7CC4FF'], ['lilac', 'Lilac', '#C3A2FF'], ['sunshine', 'Sunshine', '#FFD166'], ['mint', 'Mint', '#7EE3C4'], ['pink', 'Pink', '#FF9EC0'],
      ['coral', 'Coral', '#FF9E86'], ['sand', 'Sand', '#EBDDC3'], ['emerald', 'Emerald', '#2F8A68'], ['slate', 'Slate', '#3A4A5C'],
      ['dots', 'Polka dots', { p: 'dots', base: '#FFB4A2', css: 'radial-gradient(circle,#fff8 26%,transparent 28%) 0 0/12px 12px,#FFB4A2' }],
      ['sunset', 'Sunset', ['#FFC36B', '#FF6B8B'], 200, 'rare'], ['lagoon', 'Lagoon', ['#7FF0DF', '#2F86D8'], 200, 'rare'],
      ['waves', 'Waves', { p: 'waves', base: '#5BB8E6', css: 'repeating-radial-gradient(circle at 50% 120%,#5BB8E6 0 5px,#9ED9F5 5px 7px)' }, 200, 'rare'],
      ['confetti', 'Confetti', { p: 'confetti', base: '#FFF1D6', css: 'radial-gradient(circle at 30% 30%,#FF6B8B 12%,transparent 13%),radial-gradient(circle at 70% 60%,#3DB8F5 12%,transparent 13%),radial-gradient(circle at 40% 75%,#FFC93C 12%,transparent 13%),#FFF1D6' }, 200, 'rare'],
      ['stars', 'Starry night', ['#7657E0', '#1E1150'], 350, 'epic'],
      ['lacquer', 'Lacquer work', { p: 'lacquer', base: '#8E1B1B', css: 'repeating-radial-gradient(circle,#8E1B1B 0 5px,#F2B632 5px 7px,#1E1414 7px 9px,#2F8A4E 9px 10px)' }, 400, 'epic'],
      ['gold', 'Golden hour', ['#FFE7A6', '#D69A2E'], 800, 'legendary']]
  };
  // saved configs from v1 used bg:'night' - map it to the renamed item
  var ALIASES = { bg: { night: 'stars' } };
  var CATS = Object.keys(SPEC);
  var CAT_NAMES = { body: 'Body', skin: 'Skin tone', face: 'Face shape', nose: 'Nose', cheeks: 'Blush', marks: 'Freckles & marks', eyes: 'Eye shape', eyeColor: 'Eye colour', lashes: 'Eyelashes',
    brows: 'Eyebrows', mouth: 'Mouth', lips: 'Lipstick', hair: 'Hair style', hairColor: 'Hair colour', facial: 'Facial hair', glasses: 'Glasses', glassesColor: 'Frame colour',
    lens: 'Lens colour', hat: 'Hat', hatColor: 'Hat colour', mask: 'Masks', outfit: 'Outfit', outfitColor: 'Outfit colour', scarfColor: 'Scarf colour', neck: 'Necklace', paint: 'Face paint',
    earrings: 'Earrings', bg: 'Background' };
  var PARTS = {}, BYID = {}, catalog = [];
  CATS.forEach(function (cat) {
    PARTS[cat] = SPEC[cat].map(function (a) {
      var price = a[3] || 0;
      var it = { id: cat + '.' + a[0], cat: cat, key: a[0], name: a[1], value: a[2] || null, free: !price, price: price, rarity: a[4] || 'common' };
      BYID[it.id] = it; catalog.push(it); return it;
    });
  });
  var DEFAULTS = { v: 1, body: 'm', skin: 'golden', face: 'round', nose: 'button', cheeks: 'soft', marks: 'none', eyes: 'round', eyeColor: 'darkbrown', lashes: 'none', brows: 'soft',
    mouth: 'smile', lips: 'none', hair: 'short', hairColor: 'black', facial: 'none', glasses: 'none', glassesColor: 'black', lens: 'dark', hat: 'none', hatColor: 'red',
    outfit: 'tee', outfitColor: 'ocean', scarfColor: 'rose', neck: 'none', paint: 'none', earrings: 'none', bg: 'sky', mask: 'none' };
  var COVER = { headscarf: 1, hijab: 1 };
  /* v3: every hat can be worn over a hijab / headscarf (it sits on top of the scarf); kept for older callers */
  var COVER_HATS = { none: 1, crown: 1, headphones: 1, flower: 1, halo: 1, horns: 1, bunny: 1 };
  var HATS_OK_ON_SCARF = true;
  var HAT_TINTED = { cap: 1, capback: 1, beanie: 1, bucket: 1, fisher: 1, headband: 1, headphones: 1, cowboy: 1, party: 1, kulhi: 1, helmet: 1, tophat: 1 };
  var HAT_NOCOMPRESS = { headband: 1, headphones: 1, flower: 1, party: 1, halo: 1, horns: 1, bunny: 1 };
  var BIG_HAIR = /^(afro|spiky|bun|highbun|mohawk|manbun|curlytop|tufts|messy)$/;
  var LENS_GLASSES = { sunglasses: 1, aviator: 1, sporty: 1, heart: 1 };
  function item(cat, key) { return BYID[cat + '.' + key] || null; }
  function val(cat, key) { var i = item(cat, key); return i ? i.value : item(cat, DEFAULTS[cat]).value; }

  /* hair styles listed first for each body (every style stays allowed for both) */
  var FEM_HAIR = ['long', 'fringelong', 'curtain', 'sideswept', 'wavy', 'bob', 'sleekbob', 'ponytail', 'fringepony', 'bun', 'highbun', 'halfup', 'braids', 'curly', 'afro', 'hijab', 'headscarf'];
  var MALE_HAIR = ['short', 'fade', 'undercut', 'sidepart', 'buzz', 'messy', 'tufts', 'spiky', 'curlytop', 'curly', 'afro', 'cornrows', 'manbun', 'mohawk', 'bald'];
  var FEM_HINT = /^(long|fringelong|curtain|sideswept|wavy|bob|sleekbob|ponytail|fringepony|bun|highbun|halfup|braids|headscarf|hijab)$/;
  function norm(cfg) {
    var c = {}, src = cfg && typeof cfg === 'object' ? cfg : {};
    CATS.forEach(function (cat) {
      var k = src[cat]; if (ALIASES[cat] && ALIASES[cat][k]) k = ALIASES[cat][k];
      c[cat] = item(cat, k) ? k : DEFAULTS[cat];
    });
    /* v1/v2 configs have no body: guess it (beard -> male, feminine hair / lipstick / lashes -> female, else male) */
    if (!item('body', src.body)) c.body = c.facial !== 'none' ? 'm' : (FEM_HINT.test(c.hair) || c.lips !== 'none' || c.lashes !== 'none') ? 'f' : 'm';
    if (c.body === 'f') c.facial = 'none';
    c.v = 1; return c;
  }
  function ownedHas(owned, id) {
    if (owned === true || owned === '*') return true;
    if (!owned) return false;
    if (typeof owned.has === 'function') return owned.has(id);
    if (Array.isArray(owned)) return owned.indexOf(id) >= 0;
    return !!owned[id];
  }
  /* Fall back unowned / paid / invalid parts to free defaults and resolve conflicts. */
  function validate(cfg, owned) {
    var c = norm(cfg);
    CATS.forEach(function (cat) { var it = item(cat, c[cat]); if (!it.free && !ownedHas(owned, it.id)) c[cat] = DEFAULTS[cat]; });
    if (COVER[c.hair]) { if (!HATS_OK_ON_SCARF && !COVER_HATS[c.hat]) c.hat = 'none'; c.earrings = 'none'; if (c.hair === 'hijab') c.neck = 'none'; }
    if (c.mask === 'patchR' && c.glasses === 'monocle') c.glasses = 'none';
    return c;
  }
  /* Why an option is unavailable with the current config (for UI). Returns reason string or ''. */
  function conflict(cfg, cat, key) {
    var c = norm(cfg), what = c.hair === 'hijab' ? 'hijab' : 'headscarf';
    if (cat === 'hat' && !HATS_OK_ON_SCARF && COVER[c.hair] && !COVER_HATS[key]) return 'Most hats are off with a ' + what + ' (crown, headphones and hibiscus still fit)';
    if (cat === 'earrings' && COVER[c.hair] && key !== 'none') return 'Earrings are hidden under a ' + what;
    if (cat === 'neck' && c.hair === 'hijab' && key !== 'none') return 'Necklaces are hidden under a hijab';
    if (cat === 'mask' && key === 'patchR' && c.glasses === 'monocle') return 'The monocle is on that eye. Take it off first';
    if (cat === 'glasses' && key === 'monocle' && c.mask === 'patchR') return 'The eye patch is on that eye. Take it off first';
    return '';
  }
  function relevant(c, cat) {
    if (cat === 'scarfColor') return !!COVER[c.hair];
    if (cat === 'hatColor') return !!HAT_TINTED[c.hat] && !conflict(c, 'hat', c.hat);
    if (cat === 'glassesColor') return c.glasses !== 'none';
    if (cat === 'lens') return !!LENS_GLASSES[c.glasses];
    if (cat === 'hat' || cat === 'earrings' || cat === 'neck' || cat === 'glasses') return !conflict(c, cat, c[cat]);
    return true;
  }
  /* Paid items used by cfg that the player does not own (effective only). */
  function lockedIn(cfg, owned) {
    var c = norm(cfg), out = [];
    CATS.forEach(function (cat) {
      if (!relevant(c, cat)) return;
      var it = item(cat, c[cat]); if (!it.free && !ownedHas(owned, it.id)) out.push(it);
    });
    return out;
  }

  /* ---------------------------------------------------------------- seeded random */
  function hashStr(s) { var h = 1779033703 ^ s.length; for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; }; }
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* random(seed?, {body:'f'|'m'}?) - deterministic for a seed, free items only */
  function random(seed, ro) {
    var r = mulberry(hashStr(seed == null ? String(Math.random()) + Date.now() : String(seed))());
    var body = ro && (ro.body === 'f' || ro.body === 'm') ? ro.body : (r() < 0.5 ? 'f' : 'm');
    function pick(cat, w) {
      var list = PARTS[cat].filter(function (i) { return i.free; }), tot = 0, ws = list.map(function (i) { var x = w && w[i.key] != null ? w[i.key] : 1; tot += x; return x; });
      var n = r() * tot; for (var k = 0; k < list.length; k++) { n -= ws[k]; if (n <= 0) return list[k].key; } return list[list.length - 1].key;
    }
    var c = { v: 1 };
    c.skin = pick('skin'); c.face = pick('face'); c.eyes = pick('eyes'); c.eyeColor = pick('eyeColor', { darkbrown: 4, brown: 3, black: 2, hazel: 1.2 });
    c.brows = pick('brows', { angry: 0.4, raised: 0.5 }); c.mouth = pick('mouth', { smile: 3, grin: 2, pout: 0.4, tongue: 0.4 });
    c.nose = pick('nose'); c.cheeks = pick('cheeks', { soft: 4, none: 1, rosy: 1 });
    var hw = {};
    PARTS.hair.forEach(function (i) { hw[i.key] = body === 'f' ? (FEM_HAIR.indexOf(i.key) >= 0 ? 1 : 0.04) : (MALE_HAIR.indexOf(i.key) >= 0 ? 1 : 0.04); });
    if (body === 'f') { hw.hijab = 0.8; hw.headscarf = 0.6; hw.afro = 0.6; hw.curly = 0.7; } else { hw.bald = 0.5; hw.buzz = 0.8; hw.afro = 0.6; hw.curly = 0.7; }
    c.body = body;
    c.hair = pick('hair', hw);
    c.hairColor = pick('hairColor', { black: 5, darkbrown: 3.5, brown: 2, auburn: 0.7, ginger: 0.5, blonde: 0.7, grey: 0.6, white: 0.3 });
    var cover = !!COVER[c.hair], fem = body === 'f';
    c.marks = r() < 0.2 ? pick('marks', { none: 0 }) : 'none';
    c.lashes = fem ? (r() < 0.75 ? pick('lashes', { none: 0 }) : 'subtle') : 'none';
    c.lips = fem && r() < 0.4 ? pick('lips', { none: 0 }) : 'none';
    c.facial = fem || r() < 0.6 ? 'none' : pick('facial', { none: 0 });
    if (fem) { c.brows = pick('brows', { bushy: 0, thick: 0.3, angry: 0.1, straight: 0.5 }); c.nose = pick('nose', { wide: 0.3, pointy: 0.5 }); }
    c.glasses = r() < 0.26 ? pick('glasses', { none: 0 }) : 'none';
    c.glassesColor = pick('glassesColor'); c.lens = pick('lens');
    c.hat = !cover && r() < 0.28 ? pick('hat', { none: 0, police: 0.4, deerstalker: 0.5 }) : 'none';
    c.hatColor = pick('hatColor');
    c.outfit = pick('outfit', { police: 0.35, libaas: fem ? 2.5 : 0.2, school: 0.6, feyli: fem ? 0.3 : 1, fishshirt: fem ? 0.3 : 1 });
    c.outfitColor = pick('outfitColor'); c.scarfColor = pick('scarfColor');
    c.neck = c.hair !== 'hijab' && r() < 0.18 ? pick('neck', { none: 0 }) : 'none';
    c.paint = r() < 0.06 ? pick('paint', { none: 0 }) : 'none';
    c.mask = r() < 0.05 ? pick('mask', { none: 0 }) : 'none';
    c.earrings = !cover && r() < (fem ? 0.55 : 0.12) ? pick('earrings', { none: 0 }) : 'none';
    c.bg = pick('bg');
    return norm(c);
  }

  /* ---------------------------------------------------------------- svg helpers */
  var FACES = {
    round: { d: 'M50 24C62.7 24 72 34 72 47S62.7 70 50 70 28 60 28 47 37.3 24 50 24Z', l: 28 },
    oval: { d: 'M50 23.5C62.5 23.5 71 32.5 71 45.5 71 59.5 62 70.5 50 70.5S29 59.5 29 45.5C29 32.5 37.5 23.5 50 23.5Z', l: 29 },
    square: { d: 'M50 24C64 24 72.2 31.5 72.2 44V54.5C72.2 63.5 64.5 70 55.5 70.5H44.5C35.5 70 27.8 63.5 27.8 54.5V44C27.8 31.5 36 24 50 24Z', l: 27.8 },
    heart: { d: 'M50 24C64 24 73 32.5 72.6 45.5 72.2 56 61.5 67.5 50 71.2 38.5 67.5 27.8 56 27.4 45.5 27 32.5 36 24 50 24Z', l: 27.4 },
    full: { d: 'M50 25C65 25 73.4 33.5 73.4 47 73.4 62 63 70.2 50 70.2S26.6 62 26.6 47C26.6 33.5 35 25 50 25Z', l: 26.6 }
  };
  /* softer jaw / chin for the female body */
  var FACES_F = {
    round: { d: 'M50 24C62.7 24 72 34 72 46.4 72 58.4 61.4 70.2 50 70.2S28 58.4 28 46.4C28 34 37.3 24 50 24Z', l: 28 },
    oval: { d: 'M50 23.5C62.5 23.5 71 32.5 71 45 71 58.6 61 70.6 50 70.6S29 58.6 29 45C29 32.5 37.5 23.5 50 23.5Z', l: 29 },
    square: { d: 'M50 24C63.6 24 72 31.6 72 44V52.6C72 61.6 62.6 70.2 50 70.4 37.4 70.2 28 61.6 28 52.6V44C28 31.6 36.4 24 50 24Z', l: 28 },
    full: { d: 'M50 25C65 25 73.2 33.5 73.2 46.6 73.2 60.6 62 70.2 50 70.2S26.8 60.6 26.8 46.6C26.8 33.5 35 25 50 25Z', l: 26.8 }
  };
  var MIR = 'transform="matrix(-1 0 0 1 100 0)"';
  function both(s) { return s + '<g ' + MIR + '>' + s + '</g>'; }
  function circ(cx, cy, r, f, extra) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function P(d, f, extra) { return '<path d="' + d + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function S(d, col, w, extra) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>'; }
  function bumps(cx, cy, rx, ry, a0, a1, n, r, f) {
    var s = ''; for (var i = 0; i < n; i++) { var a = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180; s += circ((cx + rx * Math.cos(a)).toFixed(1), (cy + ry * Math.sin(a)).toFixed(1), r, f); } return s;
  }
  function lin(id, a, b, x2, y2) { return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>'; }
  function qpt(t, a, b, c) { var u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; }
  function star(cx, cy, r, f, extra) {
    var d = 'M', i, a, rr;
    for (i = 0; i < 10; i++) { a = (i * 36 - 90) * Math.PI / 180; rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : '') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2); }
    return P(d + 'Z', f, extra);
  }
  function spark(cx, cy, r, f, op) { return P('M' + cx + ' ' + (cy - r) + 'q' + r * 0.18 + ' ' + r * 0.82 + ' ' + r + ' ' + r + 'q-' + r * 0.82 + ' ' + r * 0.18 + '-' + r + ' ' + r + 'q-' + r * 0.18 + '-' + r * 0.82 + '-' + r + '-' + r + 'q' + r * 0.82 + '-' + r * 0.18 + ' ' + r + '-' + r + 'z', f, op ? ' opacity="' + op + '"' : ''); }
  var HL = ' opacity=".24"';
  var BUZZ = 'M27.6 46C26.2 31 36 22 50 22S73.8 31 72.4 46C71.2 41 69 37.2 65.5 35.2 58 33 42 33 34.5 35.2 31 37.2 28.8 41 27.6 46Z';

  /* ---------------------------------------------------------------- hair
     back: behind the body; mid: over the body, under the head; front: over the face.
     hatBack / hatFront: variants used when a hat compresses the hair (undefined = unchanged). */
  function shortFront(k) {
    return P('M26.8 49C24.5 30 35 19.5 50 19.5S75.5 30 73.2 49C72.2 44.6 70.8 41 68.6 38.2 66 39.8 62.2 39.6 59.8 37 57.2 39.8 52.4 40.2 49.6 37.2 46.2 40 41.2 39.8 38.8 36.8 35.8 39.2 33 39.6 31 38.4 29 41.6 27.6 45 26.8 49Z', k.hg) +
      S('M60 31.4Q63.6 34 64.6 37.4M48.6 30.4Q50.6 33.6 50.4 36.4M38 31.6Q37.6 34.6 38.8 36.6', k.hcB, 0.9, ' opacity=".6"') + S('M37 24.6Q45 21.4 55 22.6', '#fff', 2.2, HL);
  }
  function sleekFront(k) {
    return P('M27.2 47C25.5 29 37 20 50 20S74.5 29 72.8 47C71 39 66 32.4 58 30.4 53 29.4 47 29.4 42 30.4 34 32.4 29 39 27.2 47Z', k.hg) + S('M36.5 25Q43 22.2 50 22.2', '#fff', 2, HL) +
      S('M50 20.6Q48 25.6 42.6 30.2M50 20.6Q56 25 61.4 30.6M45 21.4Q40 25 35.4 31', k.hcB, 0.8, ' opacity=".55"');
  }
  function fringe(k) {
    return P('M27.2 50C25.6 30 37 20 50 20S74.4 30 72.8 50C72 45 71.4 42 70.6 39.6Q67 41.2 63.4 39.8 60 41.4 56.6 40 53 41.6 50 40.2 47 41.6 43.4 40 40 41.4 36.6 39.8 33 41.2 29.4 39.6C28.6 42 28 45 27.2 50Z', k.hg) +
      S('M36.6 31V38.6M43.4 29.4V38.8M50 28.6V39M56.6 29.4V38.8M63.4 31V38.6', k.hcB, 0.7, ' opacity=".4"') + S('M37 24.4Q44 21.6 52 22', '#fff', 2, HL);
  }
  var LOCKS = both(P('M27.4 47C26.6 56 27 62 28.4 67.4 30 68.4 32 68.2 33.4 67.4 32 62 31.4 56 31.6 48Z', 'url(#§hg)'));
  function shaved(k, op) { return P(BUZZ, k.hc, ' opacity="' + (op || 0.42) + '"'); }
  var HAIR = {
    bald: { front: function () { return '<ellipse cx="41" cy="31" rx="6.5" ry="3.2" fill="#fff" opacity=".22" transform="rotate(-24 41 31)"/>'; } },
    buzz: { front: function (k) { return P(BUZZ, k.hc, ' opacity=".9"') + S('M39 25.6Q46 23.4 54 24', '#fff', 1.8, ' opacity=".16"'); } },
    short: { front: shortFront },
    fade: {
      front: function (k) { return shaved(k, 0.45) + P('M31.2 34C31 24.6 39.6 19.2 50 19.2S69 24.6 68.8 34C63.8 31.6 57 30.6 50 30.6S36.2 31.6 31.2 34Z', k.hg) + S('M40 23.6Q44.4 21.8 49 22.2M53.6 22.2Q58.4 22.6 61.6 24.8', '#fff', 1.6, HL); },
      hatFront: function (k) { return shaved(k, 0.45); }
    },
    undercut: {
      front: function (k) { return shaved(k, 0.4) + P('M29.8 38C28.2 25 38 16.4 51 16.4S72.6 22.4 72 32.6C71.8 36.4 70 38.4 67.6 38.2 64.6 33.6 57 31.4 48.6 32.6 41 33.6 34.4 36 29.8 38Z', k.hg) + S('M36 27Q46 20.4 60 21.4M40 31.2Q50 25.8 64.6 27.8', k.hcB, 0.9, ' opacity=".55"') + S('M42 21.6Q50 18.6 58 19.4', '#fff', 1.8, HL); },
      hatFront: function (k) { return shaved(k, 0.4); }
    },
    sidepart: {
      front: function (k) { return P('M26.6 50C24 29 36 18.5 51 18.5S76.5 28 73.4 48C72.4 42 70.6 38 68 35 60 36 51 34 44.5 28.5 42 33.5 36 37 31.4 38.6 29 41.6 27.6 45.6 26.6 50Z', k.hg) + S('M44.5 28.5Q46 23.5 50.5 20.4', k.hcB, 1.2) + S('M52 23.4Q61 22.6 67 28', '#fff', 2, HL) + S('M49 26.4Q58 26 66.6 32M34.4 34Q38.6 31 42 27', k.hcB, 0.8, ' opacity=".5"'); }
    },
    messy: {
      front: function (k) { return P('M36.4 25L32.6 16.8 41.4 21.4ZM46 21.4 46 11.8 53 19.8ZM57 21.4 63.4 14.4 63.4 24.4ZM66.6 28 75 25.6 70.6 34ZM31.4 29.6 23.8 29 29 36.4Z', k.hg) + shortFront(k); },
      hatFront: shortFront
    },
    tufts: {
      front: function (k) { return shortFront(k) + P('M42.5 21.5C40 16 42 12 46 10.6 45.6 14.6 47 17.8 49.8 20ZM49.6 20C50 14.8 53 11.4 57.6 11.2 55.2 14 54.6 17.4 55.8 21ZM56 22C58.6 17.8 62.6 16.4 66.4 17.6 63.2 19 61.6 21.6 61.6 24.6Z', k.hg); },
      hatFront: shortFront
    },
    spiky: {
      front: function (k) { return P('M27 48C25 36 27.6 29 31.6 25.4L29.4 14 38.8 20.8 41.8 9.6 48.8 18.6 55 8.8 59 18.8 67.4 11.8 67.4 22.8 75.6 19.8 71.4 29.6C74 35.6 74 42 73 48 71 40 68 36 64 34L58 37 54 32.2 48 36.2 43 32 37 36C32 38 29 42 27 48Z', k.hg) + S('M44 16.5L47 22M56 13L56.6 20M36 20.6L39 25', '#fff', 1.6, HL); },
      hatFront: function (k) { return both(P('M27.2 49C26.2 42 27 36 30 32H35C32 37 30 42 29.6 50Z', k.hc)); }
    },
    curlytop: {
      front: function (k) {
        var s = shaved(k, 0.45);
        [[33.4, 32.6, 4], [39.4, 31, 4.2], [36, 28, 4.6], [42, 24.4, 5], [49, 22.6, 5.2], [56, 23.4, 5], [62.6, 26.6, 4.6], [66.6, 31.4, 4], [45.4, 28.6, 4.4], [53, 27.8, 4.4], [60.2, 30.4, 4.2]].forEach(function (p) {
          s += circ(p[0], p[1], p[2], k.hg) + S('M' + (p[0] - 2) + ' ' + (p[1] + 1.4) + 'Q' + p[0] + ' ' + (p[1] + 3) + ' ' + (p[0] + 2) + ' ' + (p[1] + 1.4), k.hcB, 0.8, ' opacity=".5"');
        });
        return s + S('M44 20.6Q49 18.6 54 19.6', '#fff', 1.8, HL);
      },
      hatFront: function (k) { return shaved(k, 0.45); }
    },
    curly: {
      back: function (k) { return '<ellipse cx="50" cy="40" rx="25.5" ry="22" fill="' + k.hcB + '"/>' + bumps(50, 40, 25.5, 22, 160, 380, 12, 6.2, k.hcB) + circ(26.5, 53, 5.6, k.hcB) + circ(73.5, 53, 5.6, k.hcB); },
      hatBack: function (k) { return circ(25.8, 45, 5.6, k.hcB) + circ(26.4, 53, 5.2, k.hcB) + circ(74.2, 45, 5.6, k.hcB) + circ(73.6, 53, 5.2, k.hcB); },
      front: function (k) {
        var s = P('M27 46C25 30 36 21 50 21S75 30 73 46C71.5 41 69 37.4 65.5 35.4H34.5C31 37.4 28.5 41 27 46Z', k.hg);
        [[35, 35.2, 4.3], [42.4, 33.9, 4.6], [50, 33.4, 4.8], [57.6, 33.9, 4.6], [65, 35.2, 4.3]].forEach(function (p) {
          s += circ(p[0], p[1], p[2], k.hc) + S('M' + (p[0] - 2.4) + ' ' + (p[1] + 1.6) + 'Q' + p[0] + ' ' + (p[1] + 3.4) + ' ' + (p[0] + 2.4) + ' ' + (p[1] + 1.6), k.hcB, 0.9, ' opacity=".55"');
        });
        return s + S('M38 26Q45 22.8 54 23.6', '#fff', 2.2, HL);
      }
    },
    afro: {
      back: function (k) { return '<ellipse cx="50" cy="37" rx="29" ry="25.5" fill="' + k.hcB + '"/>' + bumps(50, 37, 29, 25.5, 150, 390, 14, 6.6, k.hcB) + circ(24.4, 53, 6.6, k.hcB) + circ(75.6, 53, 6.6, k.hcB) + S('M30 20Q40 12.4 54 12.6', '#fff', 2.4, ' opacity=".12"'); },
      hatBack: function (k) { return circ(25, 43.5, 7.4, k.hcB) + circ(24, 53, 6.4, k.hcB) + circ(75, 43.5, 7.4, k.hcB) + circ(76, 53, 6.4, k.hcB); },
      front: function (k) { return P('M26 48C24 36 30 27 50 26 70 27 76 36 74 48 72 42 70 38 66 36 63 38 60 37 58 35 55 37 51 37 49 35 46 37 42 37 40 35 37 37 34 37 32 36 30 39 27 43 26 48Z', k.hg); },
      hatFront: function () { return ''; }
    },
    cornrows: {
      front: function (k) {
        return P('M27.6 47C26 30 36 21 50 21S74 30 72.4 47C71 41.6 69 38 66 35.6 59 33.4 41 33.4 34 35.6 31 38 29 41.6 27.6 47Z', k.hg) +
          S('M34.6 35.2Q36 26 44 22M42 34Q43.4 26 48 21.4M50 33.6V21M58 34Q56.6 26 52 21.4M65.4 35.2Q64 26 56 22M29.4 42Q30 32 38 24.6M70.6 42Q70 32 62 24.6', k.hcB, 1.2) +
          S('M35.6 34Q37 27 43.4 23.2M43 33Q44.2 27 48.2 22.6M51 32.6V22.4M59 33Q57.8 27 53.8 22.6M64.4 34Q63 27 56.6 23.2', '#fff', 0.7, ' opacity=".22" stroke-dasharray="1.2 1.4"');
      }
    },
    braids: {
      back: function (k) { return P('M27 46C25 27 37 18.5 50 18.5S75 27 73 46Z', k.hcB); },
      mid: function (k) {
        var s = '';
        for (var i = 0; i < 7; i++) s += '<ellipse cx="' + (28.6 - i * 0.3).toFixed(1) + '" cy="' + (57 + i * 5.2).toFixed(1) + '" rx="3.5" ry="3.1" fill="' + k.hc + '" stroke="' + k.hcB + '" stroke-width=".7"/>' + S('M' + (26.6 - i * 0.3).toFixed(1) + ' ' + (56 + i * 5.2).toFixed(1) + 'q2 1.4 4 .4', '#fff', 0.7, ' opacity=".25"');
        s += '<rect x="25.4" y="91.4" width="4.8" height="2.4" rx="1.2" fill="#E5484D"/>' + P('M26 93.6L24.6 99H31L29.6 93.6Z', k.hc);
        return both(s);
      },
      front: function (k) { return P('M27.2 50C25.5 29 37 20 50 20S74.5 29 72.8 50C71.6 42 68 35 61 31.2 57 29.4 53 28.6 50 24.4 47 28.6 43 29.4 39 31.2 32 35 28.4 42 27.2 50Z', k.hg) + S('M50 20.4V24.6', k.hcB, 1) + S('M47 25.6Q39 28 33 35M53 25.6Q61 28 67 35', k.hcB, 0.8, ' opacity=".5"') + S('M37 24Q42 21.4 47 21', '#fff', 2, HL); }
    },
    wavy: {
      back: function (k) { return P('M24.5 50C22 29 34 17 50 17S78 29 75.5 50C76 57 78 63 76 69 74 72 70 72 68 70 70 66 70.8 60 70 56H30C29.2 60 30 66 32 70 30 72 26 72 24 69 22 63 24 57 24.5 50Z', k.hcB) + S('M26 58Q24.6 63 27 68M74 58Q75.4 63 73 68', k.hc, 1, ' opacity=".5"'); },
      front: function (k) { return P('M27 48C25.5 30 37 20 50 20S75 30 73 48C71.4 41 68 36.6 63 34.4 60 37.6 55 38 51.5 35.6 48 38.8 42 39.8 37 38 32.6 40 29 43.6 27 48Z', k.hg) + S('M31 36Q35 30 41 28M58 27Q64 28.4 68 33', '#fff', 1.8, HL) + S('M45 24Q50 29 49 35M56 25Q60 29 62 33', k.hcB, 0.8, ' opacity=".5"'); }
    },
    long: {
      back: function (k) { return P('M23.5 50C21.5 27 34 16 50 16S78.5 27 76.5 50C77 62 78 74 80 86 72 90 64 88 62 84H38C36 88 28 90 20 86 22 74 23 62 23.5 50Z', k.hcB); },
      mid: function (k) { return both(P('M27.2 55C26.4 68 26.8 79 24.2 92.5 28 94.6 32 94 34.6 91.2 34 80 33.6 68 32.2 57.6Z', k.hg) + S('M29.5 66Q29.7 76 28.4 87', k.hcB, 1, ' opacity=".6"') + S('M31.6 62Q32 72 31.4 82', '#fff', 0.9, ' opacity=".18"')); },
      front: function (k) { return P('M50 21C39 21 29.5 28 27.8 45 27 54 27.6 62 29.4 70 31.4 62 32 52 34 44 37 35 43.6 29.4 50 25.5 56.4 29.4 63 35 66 44 68 52 68.6 62 70.6 70 72.4 62 73 54 72.2 45 70.5 28 61 21 50 21Z', k.hg) + S('M38.5 26.5Q43.5 23.4 48 23', '#fff', 2, HL) + S('M31 44Q32 36 38 30M69 44Q68 36 62 30', k.hcB, 0.8, ' opacity=".5"'); }
    },
    bob: {
      back: function (k) { return P('M25 48C23 28 35 18 50 18S77 28 75 48L75.6 64.4Q75.6 67.6 72.4 67.6H63C62 66 61.8 64 62 62H38C38.2 64 38 66 37 67.6H27.6Q24.4 67.6 24.4 64.4Z', k.hcB); },
      front: function (k) { return P('M27.2 52C25.6 30 37 20 50 20S74.4 30 72.8 52C72 46 71.4 42 70.4 38.8H29.6C28.6 42 28 46 27.2 52Z', k.hg) + both(P('M27.4 47C26.6 56 27 62 28.4 67.4H33.6C32.2 62 31.6 56 31.8 48Z', k.hg)) + S('M40 30V38.2M50 28.4V38.4M60 30V38.2M45 29V38.4M55 29V38.4', k.hcB, 0.7, ' opacity=".45"') + S('M37 24.4Q44 21.6 52 22', '#fff', 2, HL); }
    },
    fringelong: {
      back: function (k) { return HAIR.long.back(k); }, mid: function (k) { return HAIR.long.mid(k); },
      front: function (k) { return fringe(k) + LOCKS; }
    },
    curtain: {
      back: function (k) { return HAIR.long.back(k); }, mid: function (k) { return HAIR.long.mid(k); },
      front: function (k) {
        return P('M50 21C39 21 29.5 28 27.8 45 27.4 50 27.6 55 28.4 60 29.6 52 31.6 45.6 35.2 41.6 39.4 37.6 45.4 35.4 50 28.6 54.6 35.4 60.6 37.6 64.8 41.6 68.4 45.6 70.4 52 71.6 60 72.4 55 72.6 50 72.2 45 70.5 28 61 21 50 21Z', k.hg) +
          S('M50 22.4V28M46 30Q40 33 34 40M54 30Q60 33 66 40', k.hcB, 0.8, ' opacity=".5"') + S('M38.5 26.5Q43.5 23.4 48 23', '#fff', 2, HL);
      }
    },
    sideswept: {
      back: function (k) { return HAIR.long.back(k); }, mid: function (k) { return HAIR.long.mid(k); },
      front: function (k) {
        return P('M27 50C25.4 30 37 19.6 50 19.6S74.6 30 73 50C72.4 44.6 71.6 40.6 70.2 37.4 64.6 34.6 57 34.2 50 35.4 42 36.8 35.4 40.4 31.2 45.6 29.4 47.4 28 48.8 27 50Z', k.hg) + LOCKS +
          S('M66 30Q56 31 46 35.6M62 26Q52 28 40 34', k.hcB, 0.8, ' opacity=".5"') + S('M40 24Q48 21 58 22.4', '#fff', 2, HL);
      }
    },
    sleekbob: {
      back: function (k) { return HAIR.bob.back(k); },
      front: function (k) { return P('M27 50C25 29 36.6 19 51 19S75.4 28 73.2 50C72 44 70.4 39.6 67 36 60 34.6 52 32.4 45.6 27.6 42 33 35.6 37.4 31 40 29 43 27.6 46.6 27 50Z', k.hg) + LOCKS + S('M45.6 27.6Q47 23.4 50.6 20.4', k.hcB, 1) + S('M53 23.4Q62 23 68 29', '#fff', 2, HL); }
    },
    fringepony: {
      back: function (k) { return HAIR.ponytail.back(k); },
      front: fringe
    },
    highbun: {
      front: function (k) { return circ(50, 12.6, 9.6, k.hg) + S('M42.6 14Q50 7 57.4 14M44.6 17Q50 12 55.4 17', k.hcB, 1.1, ' opacity=".7"') + S('M45.4 7.8Q50 5.6 54.6 7.4', '#fff', 1.6, HL) + fringe(k) + S('M42.6 21Q50 18.6 57.4 21', '#F07BA8', 2.4); },
      hatFront: fringe
    },
    halfup: {
      back: function (k) { return HAIR.long.back(k) + circ(50, 16.4, 5.8, k.hcB); }, mid: function (k) { return HAIR.long.mid(k); },
      hatBack: function (k) { return HAIR.long.back(k); },
      front: function (k) { return sleekFront(k) + LOCKS + S('M44.6 20.6Q50 18.6 55.4 20.6', '#F07BA8', 2.2); }
    },
    ponytail: {
      back: function (k) { return P('M65 27C79 24.5 85.5 40 82.5 56 80.5 66 76.5 76 70.5 84 71.6 74 72 64 70.8 54 70 46 68.6 37 63.6 31Z', k.hcB) + S('M75 40Q78.6 50 76.4 62', k.hc, 1.2, ' opacity=".5"') + S('M63.6 28.4Q67.4 25.4 70.6 28.8', '#E5484D', 3.2); },
      front: sleekFront
    },
    bun: {
      front: function (k) { return circ(50, 16.5, 8.6, k.hg) + S('M43.6 18Q50 11.6 56.4 18M45.6 20.4Q50 16 54.4 20.4', k.hcB, 1.1, ' opacity=".7"') + S('M46 12.4Q50 10.2 54 12', '#fff', 1.6, HL) + sleekFront(k) + S('M42 21.6Q50 19.6 58 21.6', '#E5484D', 2.4); },
      hatFront: sleekFront
    },
    manbun: {
      back: function (k) { return circ(50, 16.2, 6.6, k.hcB) + S('M45.6 18.6Q50 15 54.4 18.6', k.hc, 1, ' opacity=".6"'); },
      hatBack: function () { return ''; },
      front: function (k) { return shaved(k, 0.4) + P('M30.6 38C29 26 38 19 50 19S71 26 69.4 38C66 31.6 59 28.6 50 28.6S34 31.6 30.6 38Z', k.hg) + S('M40 30Q44 23 50 20.6M60 30Q56 23 50 20.6M34.6 33Q40 25 48 21.4', k.hcB, 0.8, ' opacity=".55"') + S('M38 24Q44 21 50 20.4', '#fff', 1.8, HL); },
      hatFront: function (k) { return shaved(k, 0.4); }
    },
    mohawk: {
      front: function (k) { return shaved(k, 0.34) + P('M44.2 35C43 26 43.6 15 46.6 8.6 47.6 12 48.6 13 50 7 51.4 13 52.4 12 53.4 8.6 56.4 15 57 26 55.8 35C53.6 33.8 46.4 33.8 44.2 35Z', k.hg) + S('M48.4 12.6Q47.6 22 48 31', '#fff', 1.4, HL); },
      hatFront: function (k) { return shaved(k, 0.34); }
    },
    headscarf: {
      back: function (k) { return P('M22.5 48C21 26 34 14.5 50 14.5S79 26 77.5 48C78 60 81 72 86 82 76 86 66 84 60 80H40C34 84 24 86 14 82 19 72 22 60 22.5 48Z', k.scS); },
      mid: function (k) { return P('M66 69C72.5 75 75 84 73 96.5L81 94.6C81 84 77 73.6 70.2 66.6Z', k.sc) + S('M70 76Q73 84 72.6 92', k.scS, 1, ' opacity=".6"'); },
      front: function (k) {
        return P('M34 32C38 27.6 44 26.6 50 26.6S62 27.6 66 32C60 30.4 55 30 50 30.4 45 30 40 30.4 34 32Z', k.hc) +
          P('M50 17C35 17 24.8 28 24.8 46 24.8 57 27 65 32.5 72 30.5 63 29.6 55 29.8 47 30.2 34 38.4 26.8 50 26.8S69.8 34 70.2 47C70.4 55 69.5 63 67.5 72 73 65 75.2 57 75.2 46 75.2 28 65 17 50 17Z', k.sg) +
          S('M30.6 44C31.4 33 39 27.6 50 27.6S68.6 33 69.4 44', k.scL, 1, ' opacity=".7" stroke-dasharray="0.1 3"') + S('M37 20.6Q44 18.2 52 18.6', '#fff', 2, ' opacity=".22"') + S('M27.6 40Q28 30 34 24', k.scS, 1, ' opacity=".5"');
      }
    },
    hijab: {
      mid: function (k) { return P('M50 13C31 13 20.5 27.5 20.5 46 20.5 59 24 68.5 29 75.5 19 79.5 11 88 8 110H92C89 88 81 79.5 71 75.5 76 68.5 79.5 59 79.5 46 79.5 27.5 69 13 50 13Z', k.sg) + S('M27 80Q38 88 50 88.6M73 80Q66 85 58 87.4M20 96Q30 90 40 92', k.scS, 1.2, ' opacity=".5"'); },
      front: function (k) {
        return P('M31.5 38C32.5 31 40 26.6 50 26.6S67.5 31 68.5 38C63 32.5 57 30.4 50 30.4S37 32.5 31.5 38Z', k.scS) +
          P('M50 16C34 16 24.5 29 24.5 46 24.5 61 33 73 50 76.5 67 73 75.5 61 75.5 46 75.5 29 66 16 50 16ZM50 26.5C38.5 26.5 31 35 31 46.5 31 58.5 39 67.5 50 68.6 61 67.5 69 58.5 69 46.5 69 35 61.5 26.5 50 26.5Z', k.sg, ' fill-rule="evenodd"') +
          S('M33 70Q41 75.5 50 76M28 38Q30 26 40 20.6', k.scS, 1.1, ' opacity=".5"') + S('M38 19.6Q45 17.2 53 17.6', '#fff', 2.2, ' opacity=".24"');
      }
    }
  };

  /* ---------------------------------------------------------------- hats */
  var HATS = {
    cap: function (c) {
      return P('M25.5 35C25 19 36 11.5 50 11.5S75 19 74.5 35Z', c) + P('M50 11.5C64 11.5 75 19 74.5 35H65.5C65.5 22 60 14 50 11.5Z', '#000', ' opacity=".12"') + S('M31 26Q36 16 46 13.4', '#fff', 1.8, ' opacity=".22"') +
        S('M50 11.8C44 16 42 26 42.5 35M50 11.8C56 16 58 26 57.5 35', '#000', 0.9, ' opacity=".16"') + circ(50, 12, 1.9, shade(c, 0.25)) +
        circ(50, 25.5, 3.4, tint(c, 0.85)) + star(50, 25.6, 2.1, c) +
        P('M24 34.5C32 31.5 68 31.5 76 34.5 77.5 38 70 40.2 50 40.2S22.5 38 24 34.5Z', shade(c, 0.2)) + S('M27 35.6Q50 31.8 73 35.6', '#fff', 1, ' opacity=".22"');
    },
    capback: function (c, k) {
      return P('M35.5 13.5C39 7 61 7 64.5 13.5 60.5 15.2 39.5 15.2 35.5 13.5Z', shade(c, 0.22)) +
        P('M25.5 35C25 19 36 11.5 50 11.5S75 19 74.5 35Z', c) + P('M50 11.5C64 11.5 75 19 74.5 35H65.5C65.5 22 60 14 50 11.5Z', '#000', ' opacity=".12"') + S('M31 26Q36 16 46 13.4', '#fff', 1.8, ' opacity=".22"') +
        P('M43 35.2C43 29.6 46 27.2 50 27.2S57 29.6 57 35.2Z', k.cover ? k.sc : k.bald ? k.sk : k.hc) + S('M42 31.8H58', shade(c, 0.3), 1.6) + S('M25.8 35H74.2', shade(c, 0.2), 2.2);
    },
    beanie: function (c) {
      var ribs = ''; for (var x = 27; x <= 73; x += 3.3) ribs += 'M' + x.toFixed(1) + ' 31.6V39';
      return P('M25 38C24.5 19 36 9.5 50 9.5S75.5 19 75 38Z', c) + P('M50 9.5C64 9.5 75.5 19 75 38H66C66 23 60 13 50 9.5Z', '#000', ' opacity=".12"') + S('M31 26Q35 16 45 12', '#fff', 1.8, ' opacity=".2"') +
        P('M24.5 30.6H75.5Q78 30.6 78 33V37.8Q78 40.4 75.5 40.4H24.5Q22 40.4 22 37.8V33Q22 30.6 24.5 30.6Z', shade(c, 0.14)) + S(ribs, '#000', 0.9, ' opacity=".14"') +
        circ(50, 9, 5.8, tint(c, 0.7)) + circ(48.2, 7.4, 2, '#fff', ' opacity=".5"');
    },
    fisher: function (c) {
      var ribs = ''; for (var x = 30; x <= 70; x += 3.2) ribs += 'M' + x.toFixed(1) + ' 20V29';
      return P('M29.6 31C29.6 19.6 38.6 13.6 50 13.6S70.4 19.6 70.4 31Z', c) + S(ribs, '#000', 0.8, ' opacity=".12"') + P('M50 13.6C61.4 13.6 70.4 19.6 70.4 31H63C63 21 58 15.6 50 13.6Z', '#000', ' opacity=".1"') +
        P('M28.4 27.6H71.6Q73.4 27.6 73.4 29.4V33.6Q73.4 35.4 71.6 35.4H28.4Q26.6 35.4 26.6 33.6V29.4Q26.6 27.6 28.4 27.6Z', shade(c, 0.16)) + S('M28 31.4H72', '#000', 0.8, ' opacity=".14"');
    },
    bucket: function (c) {
      return P('M31 31C31 17 39 11 50 11S69 17 69 31Z', c) + P('M50 11C61 11 69 17 69 31H62C62 20 57 13 50 11Z', '#000', ' opacity=".1"') +
        P('M31 26.6H69V31.2H31Z', shade(c, 0.22)) + P('M18.5 38C21 31.5 30 29.5 50 29.5S79 31.5 81.5 38C76 40.5 66 38 50 38S24 40.5 18.5 38Z', shade(c, 0.06)) +
        S('M22 36.2C28 32.4 72 32.4 78 36.2', '#fff', 0.8, ' opacity=".45" stroke-dasharray="1.2 1.4"') + P('M60 30.2l1.6 3.2 1.6-3.2z', '#F2B33D');
    },
    headband: function (c) {
      return P('M27.6 34.2Q50 27.4 72.4 34.2L72.9 40Q50 33.4 27.1 40Z', c) + S('M27.6 37.1Q50 30.6 72.6 37.1', '#fff', 1.3, ' opacity=".85"') + P('M60 31.4Q66 32 72.4 34.2L72.9 40Q67 38 60.6 37Z', '#000', ' opacity=".1"');
    },
    headphones: function (c, k) {
      var d = shade(c, 0.35);
      return S('M24.5 48C21.6 23 35 11.8 50 11.8S78.4 23 75.5 48', d, 4.2) + S('M24.5 48C21.6 23 35 11.8 50 11.8S78.4 23 75.5 48', c, 2.4) + S('M34 18Q41 13.6 50 13.4', '#fff', 1, ' opacity=".35"') +
        both(P('M20.8 42.6H28.6Q31.4 42.6 31.4 45.4V56.2Q31.4 59 28.6 59H20.8Q18 59 18 56.2V45.4Q18 42.6 20.8 42.6Z', c) + P('M28.6 42.6Q31.4 42.6 31.4 45.4V56.2Q31.4 59 28.6 59H26.4V42.6Z', '#000', ' opacity=".18"') + '<rect x="20" y="45.4" width="2" height="10.8" rx="1" fill="#fff" opacity=".35"/>');
    },
    deerstalker: function () {
      var T = '#B07A45', D = '#7E5128', L = '', x, y;
      for (x = 26; x <= 74; x += 4.4) L += 'M' + x.toFixed(1) + ' 8V37';
      for (y = 13; y <= 36; y += 4.4) L += 'M20 ' + y.toFixed(1) + 'H80';
      return '<clipPath id="§k"><path d="M25 36C25 18 37 10.5 50 10.5S75 18 75 36Z"/></clipPath>' +
        P('M25 36C25 18 37 10.5 50 10.5S75 18 75 36Z', T) + '<g clip-path="url(#§k)">' + S(L, D, 0.9, ' opacity=".45"') + P('M50 10.5C63 10.5 75 18 75 36H66C66 22 60 13 50 10.5Z', '#000', ' opacity=".1"') + '</g>' +
        both(P('M26.4 33C23.4 27 25 20.6 29.4 18.2L34.4 30.4Z', D)) +
        P('M27.4 35C35.4 32 64.6 32 72.6 35 72.6 39.2 64 41.4 50 41.4S27.4 39.2 27.4 35Z', D) + S('M25.4 35.2H74.6', '#6A4220', 2.4) +
        P('M50 11C46 7 42 8 43 11 42 14 46 14 50 11 54 8 58 7 57 11 58 14 54 14 50 11Z', D) + circ(50, 11, 1.4, '#6A4220');
    },
    police: function () {
      var N = '#1B2544', sq = '';
      for (var i = 0; i < 14; i++) sq += '<rect x="' + (28.5 + i * 3.08).toFixed(2) + '" y="' + (i % 2 ? 29.5 : 32.3) + '" width="3.08" height="2.8" fill="#15151D"/>';
      return P('M24.5 22.5C25 15.5 37 11.5 50 11.5S75 15.5 75.5 22.5C75 26.5 72 29 70 30H30C28 29 25 26.5 24.5 22.5Z', N) + P('M50 11.5C63 11.5 75 15.5 75.5 22.5 75 26.5 72 29 70 30H62C63 22 59 14 50 11.5Z', '#000', ' opacity=".15"') +
        P('M28.5 29.5H71.5V35.1H28.5Z', '#F4F1EA') + sq +
        P('M29 35C36 33 64 33 71 35 69 39.4 62 40.8 50 40.8S31 39.4 29 35Z', '#101018') + S('M33 36.4Q50 34 67 36.4', '#fff', 0.9, ' opacity=".3"') +
        star(50, 21.6, 4.2, '#E6BC4E');
    },
    straw: function () {
      return '<g transform="translate(0 -1.6)">' + P('M9 34C9 27.5 28 24 50 24S91 27.5 91 34C91 39.5 72 42 50 42S9 39.5 9 34Z', '#E6C27B') +
        S('M14.4 33.6C15 29 31 26.6 50 26.6S85 29 85.6 33.6', '#C79E55', 1, ' stroke-dasharray="2 1.6"') +
        P('M9 34C9 39.5 28 42 50 42S91 39.5 91 34C86 38 70 39.6 50 39.6S14 38 9 34Z', '#C99E56') +
        P('M31.5 32C31.5 18 39.5 11.5 50 11.5S68.5 18 68.5 32Z', '#EFCF8E') + S('M34 22H66M33 17.4H67', '#C99E56', 0.8, ' opacity=".6" stroke-dasharray="1.6 1.4"') +
        P('M31.5 25.8H68.5V31.8H31.5Z', '#D6453D') + P('M50 11.5C60.5 11.5 68.5 18 68.5 32H62C62 20 57 13.5 50 11.5Z', '#000', ' opacity=".08"') + '</g>';
    },
    cowboy: function (c) {
      var d = shade(c, 0.3);
      return P('M29.6 32L31 19C32 12.6 39 11 43.4 13.4 46.6 15.2 53.4 15.2 56.6 13.4 61 11 68 12.6 69 19L70.4 32Z', c) + P('M50 15C54 14.8 56 13.6 58.8 12.8 64.6 11.6 68.4 14.6 69 19L70.4 32H62C62 24 58 18 50 15Z', '#000', ' opacity=".12"') +
        S('M44 14.6Q50 19 56 14.6', d, 1.2, ' opacity=".7"') + P('M30 27.4Q50 30.6 70 27.4L70.4 32Q50 35.2 29.6 32Z', d) +
        P('M7 27.6C11 35.6 24 39.6 50 39.6S89 35.6 93 27.6C88 33 77 34.4 70 33.4 64 35 57 35.6 50 35.6S36 35 30 33.4C23 34.4 12 33 7 27.6Z', c) +
        P('M7 27.6C12 36.6 26 41.6 50 41.6S88 36.6 93 27.6C87 36.6 73 39.4 50 39.4S13 36.6 7 27.6Z', d) + S('M12 30Q20 34 30 33.6', '#fff', 1, ' opacity=".3"');
    },
    party: function (c) {
      return '<g transform="rotate(-10 50 26)">' + P('M38.6 28.6L50 2.6 61.4 28.6Q50 31.4 38.6 28.6Z', c) + '<clipPath id="§pc"><path d="M38.6 28.6L50 2.6 61.4 28.6Q50 31.4 38.6 28.6Z"/></clipPath>' +
        '<g clip-path="url(#§pc)">' + S('M36 24L64 12M36 16L64 4M36 32L64 20', '#fff', 2.4, ' opacity=".75"') + P('M50 2.6L61.4 28.6H52Z', '#000', ' opacity=".1"') + '</g>' +
        circ(50, 3, 3.4, '#FFC93C') + circ(49, 2, 1.2, '#fff', ' opacity=".7"') + '</g>';
    },
    flower: function (c, k) {
      var g = '<g transform="translate(' + (k.cover ? '67 27' : '68 31') + ')">', pet = '';
      for (var i = 0; i < 5; i++) pet += '<ellipse cx="0" cy="-5" rx="3.6" ry="5.2" fill="#F0506E" transform="rotate(' + i * 72 + ')"/>';
      return g + pet + '<g opacity=".25">' + S('M0-1V-8M1 0L7-2M-1 0L-7-2M.6 1L4 6M-.6 1L-4 6', '#fff', 0.8) + '</g>' + circ(0, 0, 2.2, '#C8243F') + S('M0 0Q2-4 5.6-6.4', '#FFD166', 0.9) + circ(5.6, -6.4, 1, '#FFD166') + '</g>';
    },
    kulhi: function (c) {
      var d = shade(c, 0.25);
      return P('M24.6 37C22.6 22 34 11.6 50 11.6S77.4 22 75.4 37C66 33.4 58 32.6 50 32.6S34 33.4 24.6 37Z', c) +
        S('M26 30Q40 22 62 13.6M25.6 35Q46 24 72 20.6M36 34Q54 26 75 29.4', d, 1.4, ' opacity=".55"') + S('M30 22Q38 14 48 12.6', '#fff', 1.8, ' opacity=".25"') +
        P('M50 22.4l3 4-3 4-3-4z', '#E6BC4E') + circ(50, 26.4, 1.2, '#E5484D');
    },
    helmet: function (c) {
      return P('M26 34.4C26 19 36 10.6 50 10.6S74 19 74 34.4Z', c) + P('M46.6 10.9Q50 10.4 53.4 10.9V34.4H46.6Z', shade(c, 0.15)) + S('M31 26Q34 16 44 12.6', '#fff', 2, ' opacity=".35"') +
        P('M19.6 34H80.4Q82.6 34 82.6 36.2 82.6 38.6 80.4 38.6H19.6Q17.4 38.6 17.4 36.2 17.4 34 19.6 34Z', shade(c, 0.18));
    },
    chef: function () {
      return circ(37, 17.4, 9, '#F7F6F2') + circ(63, 17.4, 9, '#F7F6F2') + circ(50, 12, 10.6, '#FFFFFF') + circ(44, 18, 7, '#fff') + circ(56, 18, 7, '#fff') +
        S('M41 12Q44 8 49 7.6', '#D8D4CC', 1.2) + P('M30.6 21.6H69.4V35Q50 38.4 30.6 35Z', '#F3F1EC') + S('M31 26.4Q50 28.6 69 26.4', '#D8D4CC', 0.9) + P('M60 21.6H69.4V35Q64.6 36.2 60 36.6Z', '#000', ' opacity=".06"');
    },
    gradcap: function () {
      var B = '#1E1B24', G = '#E6BC4E';
      return P('M31.6 24V33.4C38 37.2 62 37.2 68.4 33.4V24Z', B) + P('M50 9.6L83 19.6 50 29.6 17 19.6Z', '#2A2632') + P('M50 9.6L83 19.6 50 29.6Z', '#000', ' opacity=".18"') +
        circ(50, 19.6, 1.4, G) + S('M50 19.6L75.4 22.4V33', G, 1.2) + P('M73.6 32.4H77.2L78 39H72.8Z', G) + S('M74 34V38.4M75.4 34V38.4M76.8 34V38.4', '#B8862A', 0.5);
    },
    pirate: function () {
      var B = '#1E1B24', G = '#E6BC4E';
      return P('M12 31C18 20 31 17.6 37.6 22 41.6 11.6 58.4 11.6 62.4 22 69 17.6 82 20 88 31 76 35.4 62 30.6 50 36.4 38 30.6 24 35.4 12 31Z', B) +
        S('M12.6 31.2C24 35 38 30.6 50 36.2 62 30.6 76 35 87.4 31.2', G, 1.3) + S('M38 22Q44 14.6 50 14.4', '#fff', 1.4, ' opacity=".18"') +
        circ(50, 23.4, 3.3, '#F4F1EA') + '<rect x="47.8" y="25.4" width="4.4" height="2.6" rx=".8" fill="#F4F1EA"/>' + circ(48.7, 23.2, 0.9, B) + circ(51.3, 23.2, 0.9, B) +
        S('M44.6 27.4L55.4 31.2M55.4 27.4L44.6 31.2', '#F4F1EA', 1.2);
    },
    tophat: function (c) {
      var B = '#22222A';
      return P('M20 34.4C20 31 34 28.8 50 28.8S80 31 80 34.4 66 38.4 50 38.4 20 37.6 20 34.4Z', B) + P('M34 32V7Q34 5 36 5H64Q66 5 66 7V32Q50 34.6 34 32Z', B) +
        P('M34 24H66V29.6Q50 31.6 34 29.6Z', c) + P('M58.6 5H64Q66 5 66 7V32Q62.4 32.8 58.6 33Z', '#000', ' opacity=".25"') + S('M38.4 8V22', '#fff', 1.6, ' opacity=".18"');
    },
    bunny: function (c, k) {
      var W = '#F4F1EA', Pk = '#F4A6BE', t = k.cover ? ' transform="translate(0 -3)"' : '';
      return '<g' + t + '>' + '<g transform="rotate(-12 40 22)">' + P('M36.6 22C33.2 10 35 2.6 39.4 2.6S45.8 10 43.6 22Z', W) + P('M38.4 18.6C36.8 11 37.8 6 39.8 6.2S42.2 11.4 41.8 18.6Z', Pk) + '</g>' +
        '<g transform="rotate(12 60 22)">' + P('M56.4 22C54.2 10 55.6 2.6 60.6 2.6S66.8 10 63.4 22Z', W) + P('M58.2 18.6C57.8 11.4 58.8 6.2 60.2 6S63.2 11 61.6 18.6Z', Pk) + '</g>' +
        S('M26.6 36C26.6 21.4 36.6 14.4 50 14.4S73.4 21.4 73.4 36', W, 2.6) + '</g>';
    },
    halo: function (c, k) {
      return '<g' + (k.bigTop ? ' transform="translate(0 -4.6)"' : '') + '><ellipse cx="50" cy="8.6" rx="15.6" ry="3.8" fill="none" stroke="#FFE39A" stroke-width="5" opacity=".35"/><ellipse cx="50" cy="8.6" rx="15.6" ry="3.8" fill="none" stroke="#F5C542" stroke-width="2.4"/>' +
        S('M38 7.4Q44 5.4 50 5.2', '#fff', 1, ' opacity=".8"') + spark(70, 5.6, 2.2, '#fff', 0.9) + '</g>';
    },
    horns: function (c, k) {
      var R = '#D6283A', t = k.cover ? ' transform="translate(0 -4)"' : '';
      return '<g' + t + '>' + both(P('M33.4 25C28.6 19.4 28.4 12.4 31.4 7.4 32.6 13 36 17 41 19.8Z', R) + S('M31.2 11Q31.4 16 34.4 20', '#fff', 1, ' opacity=".35"')) + '</g>';
    },
    captain: function () {
      var G = '#E6BC4E';
      return P('M22.5 22C23 15 36 11 50 11S77 15 77.5 22C77 26 73 29 70 30H30C27 29 23 26 22.5 22Z', '#F7F4EC') + P('M24 24.5C30 28 70 28 76 24.5 75 27 72.4 29 70 30H30C27.6 29 25 27 24 24.5Z', '#D9D3C6') +
        P('M28.5 29H71.5V35.2H28.5Z', '#1E2A4A') + S('M29 34.6Q50 37.4 71 34.6', G, 1.1) +
        P('M29 35C36 33 64 33 71 35 69 39.5 62 41 50 41S31 39.5 29 35Z', '#14141C') + S('M33 36.4Q50 34 67 36.4', '#fff', 0.9, ' opacity=".35"') +
        S('M44.6 23.6Q43.4 18.6 47 15.6M55.4 23.6Q56.6 18.6 53 15.6', G, 1.3) +
        S('M50 17.6V26M47.2 19.6H52.8M46.6 23.2Q50 27.6 53.4 23.2', G, 1.2) + circ(50, 16.8, 1.1, 'none', ' stroke="' + G + '" stroke-width=".9"');
    },
    crown: function (c, k) {
      var G = '#F5C542', GD = '#D9A22A', t = k.cover ? ' transform="translate(0 -5)"' : '';
      return '<g' + t + '>' + P('M31.5 27L29 11 38.5 18.5 44 7 50 16.5 56 7 61.5 18.5 71 11 68.5 27Z', G) + P('M50 16.5L56 7 61.5 18.5 71 11 68.5 27H55Z', GD, ' opacity=".55"') +
        P('M31 23.4H69V28.6H31Z', GD) + circ(29, 11, 1.9, G) + circ(44, 7, 1.9, G) + circ(56, 7, 1.9, G) + circ(71, 11, 1.9, G) +
        circ(40, 26, 1.5, '#E5484D') + circ(50, 26, 1.9, '#3F7FE8') + circ(60, 26, 1.5, '#2FB67C') + S('M35 20.5L37 13.8', '#fff', 1.4, ' opacity=".5"') +
        spark(76, 12, 3.2, '#fff', 0.9) + '</g>';
    }
  };

  /* ---------------------------------------------------------------- outfits */
  var BODY = 'M6 110C8 88 22 79.5 38 77H62C78 79.5 92 88 94 110Z';
  var BODY_SH = P('M68 78.8C81 82 91.5 90 94 110H77.5C77.5 94.5 75 85.5 68 78.8Z', '#000', ' opacity=".1"') + S('M25.5 88C27.5 93 28.3 98 28.3 110M74.5 88C72.5 93 71.7 98 71.7 110', '#000', 1.2, ' stroke-opacity=".13"') +
    S('M30 80.6Q38 78.4 44 78', '#fff', 1.6, ' opacity=".18"');
  function body(f) { return P(BODY, f) + BODY_SH; }
  function tie(col, y0) {
    return P('M47.6 ' + y0 + 'H52.4L51.5 ' + (y0 + 3.8) + 'H48.5Z', shade(col, 0.1)) + P('M48.5 ' + (y0 + 3.8) + 'H51.5L53.8 100.5 50 110.5 46.2 100.5Z', col) +
      S('M47.4 94L52.8 91.6M46.8 99L53.4 96.2', '#fff', 0.9, ' opacity=".28"');
  }
  function crew(k) { return P('M40.5 77Q50 86.5 59.5 77Z', k.sk) + P('M40.5 77Q50 86.5 59.5 77Q50 82.4 40.5 77Z', k.skS); }
  function collars(fill, y) { y = y || 85.5; return P('M50 ' + y + 'L41.5 76.5 37.5 80.5 44 ' + (y + 2) + 'Z', fill) + P('M50 ' + y + 'L58.5 76.5 62.5 80.5 56 ' + (y + 2) + 'Z', fill); }
  var OUTFITS = {
    tee: function (oc, k) { return { front: body(k.og) + crew(k) + S('M40 76.8Q50 88.5 60 76.8', shade(oc, 0.2), 2.6) }; },
    hoodie: function (oc, k) {
      var D = shade(oc, 0.22);
      return { back: P('M31.5 81C30 70.5 37.5 65.5 50 65.5S70 70.5 68.5 81Z', D),
        front: body(k.og) + P('M40.5 77Q50 86 59.5 77Z', k.sk) + P('M35.5 77.5C37 87 44 91.5 50 91.5S63 87 64.5 77.5C61.5 84 56 87 50 87S38.5 84 35.5 77.5Z', D) +
          S('M45.6 88.6L44.8 97M54.4 88.6L55.2 97', '#fff', 1.5) + circ(44.8, 97.6, 1, '#fff') + circ(55.2, 97.6, 1, '#fff') + S('M36 99Q50 101.6 64 99', '#000', 1, ' opacity=".1"') };
    },
    shirt: function (oc, k) {
      var tc = lum(oc) > 0.55 ? '#26335A' : '#E2B64C';
      return { front: body(k.og) + P('M42 77L50 86L58 77Z', k.sk) + collars(tint(oc, 0.35)) + tie(tc, 84.3) };
    },
    school: function (oc, k) {
      var W = '#F7F5EF';
      return { front: body(W) + P('M42 77L50 86L58 77Z', k.sk) + collars('#fff') + S('M41.5 76.5L37.5 80.5M58.5 76.5L62.5 80.5', '#D8D3C7', 0.8) + tie(oc, 84.3) +
        P('M59.4 89H67.4V96.6H59.4Z', '#EFEBE2') + P('M63.4 90.2l2.6 1v2.2c0 1.6-1.1 2.8-2.6 3.4-1.5-.6-2.6-1.8-2.6-3.4v-2.2z', oc) + star(63.4, 93, 1.1, '#FFD166') };
    },
    polo: function (oc, k) {
      var L = tint(oc, 0.18), D = shade(oc, 0.15);
      return { front: body(k.og) + P('M44 77L50 82.5 56 77Z', k.sk) + P('M48.3 81.5H51.7V93H48.3Z', D, ' opacity=".55"') + circ(50, 85.2, 1, '#fff', ' opacity=".9"') + circ(50, 89.2, 1, '#fff', ' opacity=".9"') +
        P('M50 81.5L40.5 76.2 37 80.2 44.5 85Z', L) + P('M50 81.5L59.5 76.2 63 80.2 55.5 85Z', L) };
    },
    kurta: function (oc, k) {
      var G = '#E2B64C';
      return { front: body(k.og) + P('M40.6 76.6Q50 81.4 59.4 76.6L59.8 79.8Q50 84.6 40.2 79.8Z', tint(oc, 0.22)) + S('M40.4 79.8Q50 84.6 59.8 79.8', G, 0.8, ' stroke-dasharray=".1 1.8"') +
        P('M48.4 82.4H51.6V100H48.4Z', shade(oc, 0.12)) + S('M47.4 83V100M52.6 83V100', G, 0.9, ' stroke-dasharray=".1 1.7"') + circ(50, 86.4, 0.9, G) + circ(50, 91.2, 0.9, G) + circ(50, 96, 0.9, G) };
    },
    libaas: function (oc, k) {
      var G = '#E2B64C';
      return { front: body(k.og) + P('M39.5 77Q50 89 60.5 77Z', k.sk) + S('M38.2 77.2Q50 91.5 61.8 77.2', G, 4.2) + S('M38.2 77.2Q50 91.5 61.8 77.2', '#9A6F1E', 1, ' stroke-dasharray=".1 2.2"') +
        S('M35.6 78.6Q50 96 64.4 78.6', G, 1.1) + P('M50 93.8l2.2 2.8-2.2 2.8-2.2-2.8z', G) + circ(44.2, 95.2, 0.9, G) + circ(55.8, 95.2, 0.9, G) +
        S('M16.6 92.4Q20 88.6 25 86.6M83.4 92.4Q80 88.6 75 86.6', G, 1.6, ' opacity=".9"') };
    },
    feyli: function (oc, k) {
      var B = '#F4EFE4', D = '#2A2320', R = '#8A4B2A';
      return { front: body(k.og) + crew(k) + S('M40 76.8Q50 88.5 60 76.8', shade(oc, 0.2), 2.4) +
        P('M16.6 86.2L29.6 79.2 80 110H58.6Z', B) + P('M16.6 86.2L29.6 79.2 32 80.6 19.4 87.8Z', '#000', ' opacity=".06"') +
        S('M19.8 84.6L64.4 110M22.4 83.2L67.6 110', D, 1.2) + S('M21.1 83.9L66 110', R, 0.9) + S('M26.4 81L75 110M28.4 79.9L77.6 110', D, 1) + S('M27.4 80.4L76.3 110', R, 0.8) };
    },
    fishshirt: function (oc, k) {
      var D = shade(oc, 0.22), L = tint(oc, 0.3), st = '';
      for (var x = 10; x <= 90; x += 5.5) st += 'M' + x.toFixed(1) + ' 76V110';
      return { front: '<clipPath id="§bd"><path d="' + BODY + '"/></clipPath>' + body(k.og) + '<g clip-path="url(#§bd)">' + S(st, D, 1.6, ' opacity=".5"') + S('M0 86H100M0 93.5H100M0 101H100', D, 1.2, ' opacity=".28"') + '</g>' +
        P('M43 77L50 88 57 77Z', k.sk) + P('M50 88L42.4 76.4 37.2 79.4 45 89.6Z', L) + P('M50 88L57.6 76.4 62.8 79.4 55 89.6Z', L) +
        P('M31.6 90H40.6V97.4H31.6Z', L, ' opacity=".55"') + P('M59.4 90H68.4V97.4H59.4Z', L, ' opacity=".55"') + circ(50, 93, 0.9, '#fff') + circ(50, 99, 0.9, '#fff') };
    },
    jersey: function (oc, k) {
      var W = lum(oc) > 0.72 ? '#253766' : '#fff';
      return { front: body(k.og) + P('M42.5 77L50 86 57.5 77Z', k.sk) + S('M42 76.8L50 86.5 58 76.8', W, 2.4) +
        S('M13 93C18 85.5 26 81 36 78.6M87 93C82 85.5 74 81 64 78.6', W, 2.2, ' opacity=".9"') + S('M16.2 96.8C21 89.6 28 85.2 37 82.6M83.8 96.8C79 89.6 72 85.2 63 82.6', W, 1, ' opacity=".55"') +
        P('M62.5 88.4l2.6 1v2.4c0 1.8-1.2 3-2.6 3.6-1.4-.6-2.6-1.8-2.6-3.6v-2.4z', W) + '<text x="36.5" y="97" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="7.5" fill="' + W + '" opacity=".92" text-anchor="middle">10</text>' };
    },
    mvjersey: function (oc, k) {
      var R = '#D21034', G = '#007E3A';
      return { front: body(k.ogR) + P('M42.5 77L50 86 57.5 77Z', k.sk) + S('M42 76.8L50 86.5 58 76.8', G, 2.8) + S('M42 76.8L50 86.5 58 76.8', '#fff', 0.8) +
        S('M13 93C18 85.5 26 81 36 78.6M87 93C82 85.5 74 81 64 78.6', G, 2.6) + S('M15.2 95.6C20 88.2 27.4 83.8 36.6 81.2M84.8 95.6C80 88.2 72.6 83.8 63.4 81.2', '#fff', 1) +
        '<rect x="59.4" y="88" width="8" height="5.6" rx=".6" fill="#fff"/><rect x="60.2" y="88.7" width="6.4" height="4.2" fill="' + R + '"/><rect x="61.4" y="89.5" width="4" height="2.6" fill="' + G + '"/>' +
        P('M63.9 89.9a1.1 1.1 0 1 0 0 1.8.9.9 0 1 1 0-1.8z', '#fff') + '<text x="36.5" y="97" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="7.5" fill="#fff" text-anchor="middle">10</text>' };
    },
    police: function (oc, k) {
      var N = '#22325E', D = '#172444', G = '#E2B64C';
      return { front: body(N) + P('M44 77L50 83 56 77Z', k.sk) + P('M48.4 83.2H51.6L50.9 86H49.1Z', '#101A33') + P('M49.1 86H50.9L52.6 98 50 101 47.4 98Z', '#101A33') +
        P('M50 82.5L40.5 76.4 37 80.5 45 86Z', '#2E4178') + P('M50 82.5L59.5 76.4 63 80.5 55 86Z', '#2E4178') +
        P('M17.8 85.2L31.5 79.6 33 82.8 19.6 88.6Z', D) + P('M82.2 85.2L68.5 79.6 67 82.8 80.4 88.6Z', D) + circ(30.4, 81.6, 0.9, G) + circ(69.6, 81.6, 0.9, G) +
        P('M31.6 92H41.4V95.6H31.6Z', D, ' opacity=".8"') + circ(36.5, 94.4, 0.7, G) +
        P('M63.5 87.2l3.2 1.2v2.8c0 2.2-1.4 3.8-3.2 4.6-1.8-.8-3.2-2.4-3.2-4.6v-2.8z', G, ' stroke="#9A6F1E" stroke-width=".6"') + circ(63.5, 91, 1, '#9A6F1E') };
    },
    trench: function (oc, k) {
      var T = '#C39A5E', D = '#9E763E', L = '#D2AC71';
      return { back: P('M32.6 81.4C30.6 71 35.2 66 42 65.4L44 78Z', D) + P('M67.4 81.4C69.4 71 64.8 66 58 65.4L56 78Z', D),
        front: body(T) + P('M41 77L50 92 59 77Z', '#F3EFE7') + P('M48.6 81H51.4L52.7 92 50 95 47.3 92Z', '#6E2A2A') +
          P('M40.5 76.8L50 95.5 46.5 110H35C33.6 95 33.2 86.5 35 80.5Z', L) + P('M59.5 76.8L50 95.5 53.5 110H65C66.4 95 66.8 86.5 65 80.5Z', L) +
          S('M40.5 76.8L50 95.5M59.5 76.8L50 95.5', D, 0.8) + circ(40.8, 98, 1.4, '#5A4020') + circ(59.2, 98, 1.4, '#5A4020') + S('M22 94H30', D, 1.2, ' opacity=".7"') };
    },
    suit: function (oc, k) {
      var J = '#2B3040', JL = '#394056';
      return { front: body(J) + P('M40 77L50 95 60 77Z', '#F6F3EC') + P('M50 84L42 76.6 39.5 79.8 45.5 86.5Z', '#fff') + P('M50 84L58 76.6 60.5 79.8 54.5 86.5Z', '#fff') +
        P('M47.8 84.2H52.2L51.4 87.6H48.6Z', shade(oc, 0.12)) + P('M48.6 87.6H51.4L53 97.5 50 100.5 47 97.5Z', oc) +
        P('M39.5 76.8L50 97 47.5 110H34C33 95 33 86.5 35.5 80Z', JL) + P('M60.5 76.8L50 97 52.5 110H66C67 95 67 86.5 64.5 80Z', JL) +
        P('M62.4 91.4L63.8 88.8 65.2 90.8 66.6 88.6 68 91.4Z', tint(oc, 0.2)) + S('M62 91.6H68.6', '#000', 0.8, ' opacity=".3"') };
    }
  };

  /* ---------------------------------------------------------------- neck accessories */
  function along(n, fn) { var s = ''; for (var i = 0; i < n; i++) { var p = qpt((i + 0.5) / n, [40.6, 77.4], [50, 91], [59.4, 77.4]); s += fn(p[0].toFixed(2), p[1].toFixed(2), i); } return s; }
  var NECK = {
    necklace: function () { return S('M40.8 77.4Q50 89 59.2 77.4', '#E2B64C', 0.9) + P('M50 82.6l1.6 2.2-1.6 2.2-1.6-2.2z', '#E2B64C') + circ(50, 84.8, 0.6, '#fff', ' opacity=".7"'); },
    beads: function () { var C = ['#E5484D', '#FFC93C', '#3DB8F5', '#2FB67C']; return along(11, function (x, y, i) { return circ(x, y, 1.25, C[i % 4]) + circ(x - 0.35, y - 0.35, 0.4, '#fff', ' opacity=".6"'); }); },
    bowtie: function () { return P('M43.8 77.6L49 80.2 43.8 82.8ZM56.2 77.6 51 80.2 56.2 82.8Z', '#C7283A') + '<rect x="48.4" y="78.6" width="3.2" height="3.2" rx="1" fill="#9E1B2C"/>'; },
    shells: function () { return along(9, function (x, y) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="1.25" ry="1.7" fill="#F6E7C8" stroke="#B8925A" stroke-width=".4"/>' + S('M' + x + ' ' + (y - 1) + 'V' + (+y + 1), '#B8925A', 0.4); }); },
    pearls: function () { return along(13, function (x, y) { return circ(x, y, 1.05, '#F7F1E6') + circ(x - 0.3, y - 0.3, 0.35, '#fff'); }); },
    chain: function () { return along(10, function (x, y, i) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="1.5" ry="1" fill="none" stroke="#E6BC4E" stroke-width="1" transform="rotate(' + (i % 2 ? 60 : -20) + ' ' + x + ' ' + y + ')"/>'; }); },
    medal: function () { return P('M42.8 77.2L48.4 90H51.6L57.2 77.2H53.6L50 86 46.4 77.2Z', '#D21034') + P('M46.4 77.2L50 86 53.6 77.2H51.4L50 81 48.6 77.2Z', '#007E3A') + circ(50, 93, 4.2, '#F2C14E') + circ(50, 93, 3, '#E0A92E') + star(50, 93.2, 2, '#FFE39A') + spark(55.6, 89, 1.4, '#fff', 0.9); }
  };
  var PAINT = {
    stripes: function () { return both('<rect x="35.8" y="55.2" width="9.4" height="2.2" rx="1.1" fill="#1E1B24" opacity=".92"/>'); },
    flag: function () { return both('<rect x="33.4" y="56.6" width="7.4" height="1.6" rx=".8" fill="#D21034" transform="rotate(-12 37 57.4)"/><rect x="33.8" y="59" width="7.4" height="1.6" rx=".8" fill="#007E3A" transform="rotate(-12 37.4 59.8)"/>'); },
    heart: function () { return P('M63.6 61.4C61.8 60.2 60.8 59.2 60.8 58.1 60.8 57.2 61.5 56.6 62.3 56.6 62.9 56.6 63.4 57 63.6 57.5 63.8 57 64.3 56.6 64.9 56.6 65.7 56.6 66.4 57.2 66.4 58.1 66.4 59.2 65.4 60.2 63.6 61.4Z', '#E5484D'); },
    whiskers: function () { return both(S('M32.6 57.4L38 58.2M32.8 60.6L38 59.8M33.6 63.4L38.4 61.4', '#3A2A24', 0.8)); },
    star: function () { return star(36.4, 58.4, 2.6, '#F2C14E') + circ(35.6, 57.4, 0.5, '#fff', ' opacity=".8"'); }
  };

  /* ---------------------------------------------------------------- masks
     under: painted on the skin (before nose/mouth); mid: over mouth + facial hair; eye: over eyes/brows, under glasses. */
  function faceMask(fill, ex, extra) {
    var d = shade(fill, 0.14), D = 'M32.6 55.4Q50 51.8 67.4 55.4L66.4 65.6Q58.6 73 50 73.2 41.4 73 33.6 65.6Z';
    return S('M33.2 56.6L' + (ex + 0.6) + ' 50.4M34 64.6L' + (ex + 0.8) + ' 53.8M66.8 56.6L' + (99.4 - ex) + ' 50.4M66 64.6L' + (99.2 - ex) + ' 53.8', d, 1) +
      P(D, fill) + (extra || '') + S('M34.4 59.2Q50 55.8 65.6 59.2M34.6 62.8Q50 59.6 65.4 62.8', d, 0.9, ' opacity=".7"') + S('M36 56.2Q50 53 64 56.2', '#fff', 1, ' opacity=".35"') +
      P('M59 54.2Q65 54.8 67.4 55.4L66.4 65.6Q63 69 59.4 70.8Z', '#000', ' opacity=".07"');
  }
  function patch(x, ex, right) {
    var s = S(right ? 'M' + (100 - ex) + ' 45.6Q59 41 32 30' : 'M' + ex + ' 45.6Q41 41 68 30', '#1E1B24', 1.4) +
      '<ellipse cx="' + x + '" cy="49.4" rx="5.8" ry="5.2" fill="#1E1B24"/>' + S('M' + (x - 3) + ' 46.6Q' + (x - 1) + ' 45.2 ' + (x + 1.4) + ' 45.4', '#fff', 1, ' opacity=".3"');
    return s;
  }
  var MASKS = {
    patchL: function (k, ex) { return { eye: patch(41, ex) }; },
    patchR: function (k, ex) { return { eye: patch(59, ex, true) }; },
    medblue: function (k, ex) { return { mid: faceMask('#8EC9E8', ex) }; },
    medwhite: function (k, ex) { return { mid: faceMask('#F2F4F5', ex) }; },
    medblack: function (k, ex) { return { mid: faceMask('#2A2932', ex) }; },
    clothdots: function (k, ex) {
      var dots = ''; [[38, 58], [44, 56.6], [50, 56], [56, 56.6], [62, 58], [41, 62.6], [47, 61.4], [53, 61.4], [59, 62.6], [44, 66.6], [50, 66.6], [56, 66.6]].forEach(function (p) { dots += circ(p[0], p[1], 0.9, '#fff', ' opacity=".85"'); });
      return { mid: faceMask('#F07BA8', ex, dots) };
    },
    clothmv: function (k, ex) { return { mid: faceMask('#D21034', ex, '<clipPath id="§mk"><path d="M32.6 55.4Q50 51.8 67.4 55.4L66.4 65.6Q58.6 73 50 73.2 41.4 73 33.6 65.6Z"/></clipPath><g clip-path="url(#§mk)">' + P('M30 60H70V66H30Z', '#007E3A') + '</g>') }; },
    bandana: function () {
      return { mid: P('M28.4 53.6Q50 49.2 71.6 53.6L67 67Q58.6 78.4 50 80.4 41.4 78.4 33 67Z', '#C7283A') + P('M60 51.6Q66 52.4 71.6 53.6L67 67Q63 72.6 58.6 75.6Z', '#000', ' opacity=".1"') +
        S('M29.6 54.6Q50 50.4 70.4 54.6', '#fff', 0.9, ' opacity=".5" stroke-dasharray="1 1.4"') + circ(42, 62, 1.1, '#fff', ' opacity=".7"') + circ(56, 61, 1.1, '#fff', ' opacity=".7"') + circ(49, 69, 1.1, '#fff', ' opacity=".7"') + circ(50, 58.4, 0.7, '#fff', ' opacity=".7"') };
    },
    bandaid: function () { return { mid: '<g transform="rotate(-24 63.4 57.4)"><rect x="58.4" y="55.6" width="10" height="3.8" rx="1.9" fill="#E9BE8E"/><rect x="61.8" y="55.6" width="3.2" height="3.8" fill="#F4D6B2"/>' + circ(59.8, 56.8, 0.3, '#B98A5E') + circ(60.6, 58.2, 0.3, '#B98A5E') + circ(66.2, 56.8, 0.3, '#B98A5E') + circ(67, 58.2, 0.3, '#B98A5E') + '</g>' }; },
    domino: function () {
      var R = '#C7283A';
      return { eye: P('M29.8 47.2Q30 42 36 42.4 42 43 46 44.6 50 46 54 44.6 58 43 64 42.4 70 42 70.2 47.2 70 53 64 54.4 58 55.4 54 52.4 50 50.4 46 52.4 42 55.4 36 54.4 30 53 29.8 47.2ZM41 45.6C38.8 45.6 37.4 47.2 37.4 49.2S38.8 52.8 41 52.8 44.6 51.2 44.6 49.2 43.2 45.6 41 45.6ZM59 45.6C56.8 45.6 55.4 47.2 55.4 49.2S56.8 52.8 59 52.8 62.6 51.2 62.6 49.2 61.2 45.6 59 45.6Z', R, ' fill-rule="evenodd"') +
        S('M32 45Q38 43.2 44 44.8', '#fff', 1, ' opacity=".35"') + P('M70 47.4L76.6 45.4 74.6 50.4Z', shade(R, 0.2)) };
    },
    masquerade: function () {
      var Pp = '#6B2FA0', G = '#E6BC4E';
      return { eye: P('M27 45.4Q30 40.4 37 41.6 43 42.6 46.4 44.8 50 47 53.6 44.8 57 42.6 63 41.6 70 40.4 73 45.4 72 52.4 66 55 58.6 57 54.4 53.2 50 50.4 45.6 53.2 41.4 57 34 55 28 52.4 27 45.4ZM41 45.8C38.8 45.8 37.4 47.4 37.4 49.3S38.8 52.8 41 52.8 44.6 51.2 44.6 49.3 43.2 45.8 41 45.8ZM59 45.8C56.8 45.8 55.4 47.4 55.4 49.3S56.8 52.8 59 52.8 62.6 51.2 62.6 49.3 61.2 45.8 59 45.8Z', Pp, ' fill-rule="evenodd" stroke="' + G + '" stroke-width=".9"') +
        circ(34, 50.6, 0.7, G) + circ(66, 50.6, 0.7, G) + circ(50, 47.8, 0.9, G) + circ(31, 46.4, 0.6, G) + circ(69, 46.4, 0.6, G) +
        P('M70 43.6C76 36 76.4 26 72 18.4 78.6 24.4 80.6 34.6 73.6 44.4Z', '#2FB6A8') + S('M71.4 42Q76 32 73.6 21', G, 0.8) + P('M71.6 44.2C79 40 84 32 83.4 24 86.4 32.4 83.4 40.4 74 45.4Z', '#E0509A') };
    },
    clown: function () {
      return { under: '<ellipse cx="50" cy="64.2" rx="9.4" ry="6.4" fill="#fff" opacity=".92"/>' + both(P('M41 42.6L45 49 41 56 37 49Z', '#fff', ' opacity=".9"') + P('M41 54.2L42.4 57.4 41 60.6 39.6 57.4Z', '#3F7FE8')) +
          both('<ellipse cx="35" cy="58.8" rx="3.2" ry="2.4" fill="#FF5A6E" opacity=".8"/>'),
        mid: circ(50, 54.8, 3.6, '#E5383B') + circ(48.8, 53.6, 1.1, '#fff', ' opacity=".6"') };
    }
  };

  /* ---------------------------------------------------------------- face features */
  var EW = { dot: 3, round: 4.4, almond: 5, sleepy: 4.4, wide: 4.8, lashes: 5, shock: 4.8, starry: 4.6 };
  function lashFlicks(level, x, y, side, st) {
    if (!level || level === 'none') return '';
    var ox = x + side * (EW[st] || 4.4) + side * 0.2, w = level === 'dramatic' ? 1.3 : 1.05;
    var s = 'M' + ox + ' ' + (y - 0.8) + 'l' + side * 1.9 + ' -1.3';
    if (level !== 'subtle') s += 'M' + (ox - side * 1) + ' ' + (y - 2.3) + 'l' + side * 1.5 + ' -1.9';
    if (level === 'dramatic') s += 'M' + (ox - side * 2.4) + ' ' + (y - 3.4) + 'l' + side * 0.9 + ' -2.1';
    return S(s, INK, w);
  }
  function eye(style, x, y, ec, k, e, side, lashes) {
    var closedUp = function (w2) { return S('M' + (x - 4) + ' ' + (y + 1.4) + 'Q' + x + ' ' + (y - 3.8) + ' ' + (x + 4) + ' ' + (y + 1.4), INK, w2); };
    if (e === 'happy') return closedUp(2.3) + lashFlicks(lashes === 'none' ? '' : 'subtle', x, y + 0.6, side, 'round');
    if (e === 'laugh') return closedUp(2.6);
    if (e === 'wink' && side === 1) return S('M' + (x - 4.2) + ' ' + (y + 0.8) + 'Q' + x + ' ' + (y - 2.6) + ' ' + (x + 4.2) + ' ' + (y + 0.8), INK, 2.4);
    if (e === 'blink') return S('M' + (x - 4.2) + ' ' + y + 'Q' + x + ' ' + (y + 3) + ' ' + (x + 4.2) + ' ' + y, INK, 2.1);
    var st = e === 'shocked' ? 'shock' : style, s = '';
    var dy = e === 'sad' ? 0.9 : e === 'thinking' ? -1.3 : e === 'sleepy' ? 0.8 : 0, dx = e === 'thinking' ? 1 : 0;
    var X = x + dx, ecD = mix(ec, INK, 0.35);
    var iris = function (r, pr, hr) {
      return '<g class="dga-iris">' + circ(X, y + 0.3 + dy, r, ec) + P('M' + (X - r) + ' ' + (y + 0.3 + dy) + 'a' + r + ' ' + r + ' 0 0 1 ' + 2 * r + ' 0z', ecD, ' opacity=".55"') +
        circ(X, y + 0.3 + dy, pr, INK) + circ(X + r * 0.36, y - r * 0.4 + dy, hr, '#fff') + circ(X - r * 0.4, y + r * 0.45 + dy, hr * 0.45, '#fff', ' opacity=".85"') + '</g>';
    };
    switch (st) {
      case 'dot': s = '<g class="dga-iris"><ellipse cx="' + X + '" cy="' + (y + dy * 0.5) + '" rx="2.8" ry="3.5" fill="' + mix(ec, INK, 0.62) + '"/>' + circ(X + 1, y - 1.3 + dy * 0.5, 1, '#fff') + circ(X - 0.9, y + 1.2 + dy * 0.5, 0.45, '#fff', ' opacity=".8"') + '</g>'; break;
      case 'almond': case 'lashes':
        s = P('M' + (x - 5) + ' ' + y + 'Q' + x + ' ' + (y - 5.2) + ' ' + (x + 5) + ' ' + y + 'Q' + x + ' ' + (y + 4) + ' ' + (x - 5) + ' ' + y + 'Z', '#fff') + iris(2.6, 1.3, 0.85) +
          S('M' + (x - 5.4) + ' ' + (y + 0.2) + 'Q' + x + ' ' + (y - 5.4) + ' ' + (x + 5.4) + ' ' + (y - 0.3), INK, 1.7);
        if (st === 'lashes') { var ox = x + side * 5.2; s += S('M' + ox + ' ' + (y - 0.6) + 'l' + side * 1.9 + ' -1.5M' + (ox - side * 0.9) + ' ' + (y - 1.9) + 'l' + side * 1.5 + ' -1.9', INK, 1.1); }
        break;
      case 'wide':
        s = '<ellipse cx="' + x + '" cy="' + y + '" rx="4.8" ry="5.3" fill="#fff"/><g class="dga-iris">' + circ(X, y + 0.5 + dy, 3.5, ec) + P('M' + (X - 3.5) + ' ' + (y + 0.5 + dy) + 'a3.5 3.5 0 0 1 7 0z', ecD, ' opacity=".55"') + circ(X, y + 0.5 + dy, 1.8, INK) + circ(X + 1.3, y - 1.3 + dy, 1.4, '#fff') + circ(X - 1.3, y + 2 + dy, 0.7, '#fff') + '</g>' +
          S('M' + (x - 4.9) + ' ' + (y - 0.6) + 'Q' + x + ' ' + (y - 6.6) + ' ' + (x + 4.9) + ' ' + (y - 0.6), INK, 1.5);
        break;
      case 'starry':
        s = '<ellipse cx="' + x + '" cy="' + y + '" rx="4.6" ry="5" fill="#fff"/><g class="dga-iris">' + circ(X, y + 0.4 + dy, 3.3, ec) + circ(X, y + 0.4 + dy, 1.6, INK) + star(X + 1.2, y - 1 + dy, 1.7, '#fff') + circ(X - 1.4, y + 1.8 + dy, 0.6, '#fff') + '</g>' +
          S('M' + (x - 4.7) + ' ' + (y - 0.5) + 'Q' + x + ' ' + (y - 6.4) + ' ' + (x + 4.7) + ' ' + (y - 0.5), INK, 1.5);
        break;
      case 'shock':
        s = '<ellipse cx="' + x + '" cy="' + (y - 0.5) + '" rx="4.8" ry="5.8" fill="#fff"/>' + circ(x, y, 2.2, ec) + circ(x, y, 1.2, INK) + circ(x + 0.8, y - 0.9, 0.6, '#fff');
        break;
      default: // round & sleepy
        s = '<ellipse cx="' + x + '" cy="' + y + '" rx="4.4" ry="4.8" fill="#fff"/>' + iris(3, 1.5, 1.05) +
          S('M' + (x - 4.4) + ' ' + (y - 0.4) + 'Q' + x + ' ' + (y - 6.4) + ' ' + (x + 4.4) + ' ' + (y - 0.4), INK, 1.4);
    }
    var w = EW[st] + 1.4;
    if (st === 'sleepy' || e === 'smug' || e === 'sleepy') {
      var cy = e === 'sleepy' ? y + 0.9 : st === 'sleepy' && e !== 'smug' ? y - 0.8 : y - 0.2;
      s += P('M' + (x - w) + ' ' + (y - 7.6) + 'H' + (x + w) + 'V' + cy + 'Q' + x + ' ' + (cy + 1.2) + ' ' + (x - w) + ' ' + cy + 'Z', k.sk) +
        S('M' + (x - w + 1.2) + ' ' + cy + 'Q' + x + ' ' + (cy + 1.2) + ' ' + (x + w - 1.2) + ' ' + cy, INK, 1.6);
    } else if (e === 'angry') {
      var xi = x - side * w, xo = x + side * w;
      s += P('M' + xo + ' ' + (y - 8) + 'L' + xi + ' ' + (y - 8) + 'L' + xi + ' ' + (y - 0.6) + 'L' + xo + ' ' + (y - 4) + 'Z', k.sk) + S('M' + (xo - side * 0.6) + ' ' + (y - 3.9) + 'L' + (xi + side * 0.6) + ' ' + (y - 0.7), INK, 1.7);
    }
    return s + lashFlicks(lashes, x, y, side, st);
  }
  var BROWS = {
    soft: S('M-4.6 1.2Q0-2.4 4.6.6', '§b', 2.3), straight: S('M-4.8.8L4.8 0', '§b', 2.5),
    thick: P('M-5.2 1.8Q-1-2.8 5.2-.6L4.9 1.6Q-.8-.2-4.8 3.2Z', '§b'), arched: S('M-5 2Q-1.8-3.6 5 .8', '§b', 1.9),
    thin: S('M-4.6.8Q0-1.4 4.6.4', '§b', 1.3), bushy: P('M-5.8 2.4Q-2.2-3.8 5.8-.8L5.6 2.4Q-.8.6-5.4 4.2Z', '§b'),
    angry: P('M-5.2-1.4L5.2 1.4 4.8 3.4-5 .6Z', '§b'), raised: S('M-4.8 1.4Q-.4-4.4 4.8-1.2', '§b', 2.1),
    unibrow: P('M-5.8 2.4Q-2.2-3.8 5.8-.8L5.6 2.4Q-.8.6-5.4 4.2Z', '§b')
  };
  function brows(style, col, e) {
    var p = (BROWS[style] || BROWS.soft).replace(/§b/g, col), BY = style === 'raised' ? 40.6 : 41.5, a1 = 0, a2 = 0, d1 = 0, d2 = 0;
    if (e === 'shocked') { d1 = d2 = -3.6; a1 = a2 = -5; }
    else if (e === 'angry') { d1 = d2 = 1.3; a1 = a2 = 17; }
    else if (e === 'sad') { d1 = d2 = -0.8; a1 = a2 = -15; }
    else if (e === 'smug') { d1 = 0.6; a1 = 7; d2 = -2.6; a2 = -9; }
    else if (e === 'happy' || e === 'laugh') { d1 = d2 = e === 'laugh' ? -2 : -1.4; }
    else if (e === 'thinking') { d1 = 0.4; a1 = 4; d2 = -2.4; a2 = -8; }
    else if (e === 'wink') { d1 = -1; d2 = 0.9; a2 = 6; }
    else if (e === 'sleepy') { d1 = d2 = 0.7; a1 = a2 = -4; }
    var s = '<g transform="translate(41 ' + (BY + d1) + ') rotate(' + a1 + ')">' + p + '</g><g transform="translate(59 ' + (BY + d2) + ') scale(-1 1) rotate(' + a2 + ')">' + p + '</g>';
    if (style === 'unibrow') s += S('M45.6 ' + (42 + d1) + 'Q50 ' + (43.2 + (d1 + d2) / 2) + ' 54.4 ' + (42 + d2), col, 2.2);
    return s;
  }
  var MOUTH_DARK = '#5A1E2B', TONGUE = '#F07A8A';
  function mouth(m, e, lip) {
    var ln = function (d, w) { return lip ? S(d, lip, w + 1.2) + S(d, mix(lip, INK, 0.55), 0.9) : S(d, INK, w); };
    var fl = function (d, f) { return P(d, f) + (lip ? S(d, lip, 1.7) : ''); };
    if (e === 'shocked') return '<ellipse cx="50" cy="64.6" rx="3.3" ry="4.1" fill="' + MOUTH_DARK + '"' + (lip ? ' stroke="' + lip + '" stroke-width="1.6"' : '') + '/><ellipse cx="50" cy="67" rx="2.1" ry="1.3" fill="' + TONGUE + '"/>';
    if (e === 'happy') return fl('M42.6 61Q50 62.6 57.4 61 56.8 70 50 70 43.2 70 42.6 61Z', MOUTH_DARK) + P('M43.8 61.7Q50 63 56.2 61.7L55.8 63.9Q50 64.9 44.2 63.9Z', '#fff') + P('M45.8 68.4Q50 65.2 54.2 68.4 50 70.2 45.8 68.4Z', TONGUE);
    if (e === 'sad') return ln('M45 65.8Q50 61.4 55 65.8', 2.2);
    if (e === 'angry') return P('M44.2 65.6Q50 61.8 55.8 65.6 50 64.2 44.2 65.6Z', MOUTH_DARK, ' stroke="' + (lip || INK) + '" stroke-width="1.8" stroke-linejoin="round"');
    if (e === 'laugh') return fl('M41.6 60.4Q50 62.4 58.4 60.4 57.6 71.6 50 71.6 42.4 71.6 41.6 60.4Z', MOUTH_DARK) + P('M43 61.2Q50 62.8 57 61.2L56.6 63.4Q50 64.6 43.4 63.4Z', '#fff') + P('M45.4 69.6Q50 65.6 54.6 69.6 50 71.8 45.4 69.6Z', TONGUE);
    if (e === 'thinking') return ln('M46.2 64.4Q49.6 63.6 53.6 62', 2.2);
    if (e === 'sleepy') return '<ellipse cx="50.4" cy="64" rx="1.7" ry="2.1" fill="' + MOUTH_DARK + '"' + (lip ? ' stroke="' + lip + '" stroke-width="1.2"' : '') + '/>';
    if (e === 'wink') m = m === 'grin' || m === 'open' ? 'grin' : 'smirk';
    if (e === 'smug') m = 'smirk';
    switch (m) {
      case 'grin': case 'gap':
        return fl('M43.5 61.5Q50 62.6 56.5 61.5 55.6 68.5 50 68.5 44.4 68.5 43.5 61.5Z', MOUTH_DARK) + P('M44.6 62.1Q50 63.2 55.4 62.1L55.1 64Q50 64.9 44.9 64Z', '#fff') +
          (m === 'gap' ? '<rect x="49.2" y="62.3" width="1.6" height="2.4" fill="' + MOUTH_DARK + '"/>' : '') + P('M46.5 67.2Q50 64.8 53.5 67.2 50 68.6 46.5 67.2Z', TONGUE);
      case 'open': return fl('M44 61.6Q50 62.8 56 61.6 55 68 50 68 45 68 44 61.6Z', MOUTH_DARK) + P('M46.2 66.6Q50 64 53.8 66.6 50 68.2 46.2 66.6Z', TONGUE);
      case 'pout': return P('M46.8 63.4Q48.6 61.6 50 62.4 51.4 61.6 53.2 63.4 51.8 65.8 50 65.8 48.2 65.8 46.8 63.4Z', lip || '#D46A78') + S('M47.6 63.6Q50 64.2 52.4 63.6', mix(lip || '#D46A78', INK, 0.5), 0.8) + circ(51.2, 64.6, 0.5, '#fff', ' opacity=".5"');
      case 'tongue': return P('M48.2 63.8Q48.2 68.4 50.6 68.4 53 68.2 52.6 63.6Z', TONGUE) + S('M50.4 64.4V66.6', '#D25C6C', 0.7) + ln('M44.5 62Q50 67 55.5 62', 2.3);
      case 'neutral': return ln('M45.6 63.4Q50 64.2 54.4 63.4', 2.2);
      case 'smirk': return ln('M45 63.8Q51 65.2 55.8 61.2', 2.2);
      default: return ln('M44.5 62Q50 67 55.5 62', 2.3);
    }
  }
  var MO = {
    mo: 'M42 60.2C43.5 57 47.5 56.4 50 58 52.5 56.4 56.5 57 58 60.2 55 60.6 52.6 60.2 50 59.3 47.4 60.2 45 60.6 42 60.2Z',
    handlebar: 'M50 58C47 56.2 43 56.6 40.5 59 39 60.4 37 60.6 36 59 36 61.6 38.6 62.6 41 61.4 44 60 47 60.2 50 59.6 53 60.2 56 60 59 61.4 61.4 62.6 64 61.6 64 59 63 60.6 61 60.4 59.5 59 57 56.6 53 56.2 50 58Z'
  };
  var MOUTH_HOLE = 'M50 60.2C45.6 60.2 42.8 62.4 42.8 64.4S45.6 68.8 50 68.8 57.2 66.4 57.2 64.4 54.4 60.2 50 60.2Z';
  function facial(f, k) {
    var c = k.fh, under = '', over = '', tex = function (d) { return S(d, k.fhD, 0.8, ' opacity=".55"'); };
    if (f === 'stubble') under = '<g clip-path="url(#§h)">' + P('M27 50C28 64 37 74 50 74.5S72 64 73 50C70.6 56 66.6 59.4 62 59.8 58 57.6 54 57.2 50 58 46 57.2 42 57.6 38 59.8 33.4 59.4 29.4 56 27 50Z', c, ' opacity=".2"') + '</g>';
    else if (f === 'beard') {
      under = P('M27.8 47C27.5 62 36 74.5 50 75.2S72.5 62 72.2 47C71 55 67 59.5 62 59.5 58 57.2 54 57 50 58 46 57 42 57.2 38 59.5 33 59.5 29 55 27.8 47Z' + MOUTH_HOLE, c, ' fill-rule="evenodd"') +
        tex('M34 62Q36 67 40 70M66 62Q64 67 60 70M44 70.6Q47 72.6 50 72.8') + S('M36 66Q40 70 44 71.4', '#fff', 1, ' opacity=".12"');
      over = P(MO.mo, c);
    } else if (f === 'shortbeard') {
      under = P('M28.4 49C28.6 61 37 71.2 50 71.8S71.4 61 71.6 49C70.2 55.4 66.4 58.8 62 58.9 58 57.2 54 56.9 50 57.7 46 56.9 42 57.2 38 58.9 33.6 58.8 29.8 55.4 28.4 49Z' + MOUTH_HOLE, c, ' fill-rule="evenodd" opacity=".9"') + tex('M35 63Q38 67 42 69M65 63Q62 67 58 69');
      over = P(MO.mo, c, ' opacity=".95"');
    } else if (f === 'longbeard') {
      under = P('M27.8 47C27.5 64 33 80 50 90 67 80 72.5 64 72.2 47C71 55 67 59.5 62 59.5 58 57.2 54 57 50 58 46 57 42 57.2 38 59.5 33 59.5 29 55 27.8 47Z' + MOUTH_HOLE, c, ' fill-rule="evenodd"') +
        tex('M40 71Q43 79 47 85M60 71Q57 79 53 85M50 72V86M34 62Q36 68 40 72M66 62Q64 68 60 72') + S('M42 74Q45 80 48 84', '#fff', 1, ' opacity=".14"');
      over = P(MO.handlebar, c);
    } else if (f === 'chinstrap') {
      under = S('M28.6 49C29.6 62 38 71 50 71.8S70.4 62 71.4 49', c, 2.8) + P('M46.8 69.6Q50 71.6 53.2 69.6 52.6 72.6 50 73 47.4 72.6 46.8 69.6Z', c);
    } else if (f === 'goatee') { under = P('M45.5 67.2Q50 68.6 54.5 67.2 54.5 72.6 50 73.8 45.5 72.6 45.5 67.2Z', c) + tex('M48 69.4V72.4M52 69.4V72.4'); over = P('M44 60.2C45.5 58 48 57.6 50 58.6 52 57.6 54.5 58 56 60.2 53.5 60.6 52 60.2 50 59.6 48 60.2 46.5 60.6 44 60.2Z', c); }
    else if (f === 'mo' || f === 'handlebar') over = P(MO[f], c) + S('M45 58.4Q47.4 57.6 49 58.4', '#fff', 0.8, ' opacity=".22"');
    else if (f === 'pencil') over = S('M43.5 59.6Q50 57.6 56.5 59.6', c, 1.4);
    return { under: under, over: over };
  }
  function lensFill(key) {
    var v = val('lens', key); return Array.isArray(v) ? 'url(#§ln)' : v;
  }
  function glasses(g, fc, ex, lensKey) {
    if (g === 'none') return '';
    var lens = 'rgba(255,255,255,.28)', arms = S('M34.6 47.6L' + ex + ' 46.4M65.4 47.6L' + (100 - ex) + ' 46.4', fc, 1.6), glint = S('M37.4 46.6L39.4 45.4M55.4 46.6L57.4 45.4', '#fff', 1.1, ' opacity=".7"');
    var tinted = lensFill(lensKey), sheen = S('M37 47.6L40.6 46.2M55 47.6L58.6 46.2', '#fff', 1.3, ' opacity=".5"');
    switch (g) {
      case 'round': return arms + both('<circle cx="41" cy="49" r="5.8" fill="' + lens + '" stroke="' + fc + '" stroke-width="1.8"/>') + S('M46.8 48.4Q50 46.6 53.2 48.4', fc, 1.6) + glint;
      case 'square': return arms + both('<rect x="34.6" y="44.4" width="12.8" height="9.6" rx="2.2" fill="' + lens + '" stroke="' + fc + '" stroke-width="1.8"/>') + S('M47.4 48Q50 46.6 52.6 48', fc, 1.6) + glint;
      case 'rect': return arms + both('<rect x="33.8" y="44.8" width="13.6" height="8.8" rx="1.3" fill="' + lens + '" stroke="' + fc + '" stroke-width="2.2"/>') + S('M47.4 48Q50 46.8 52.6 48', fc, 1.8) + glint;
      case 'cateye': return arms + both(P('M33.6 43.6Q40 44.6 46.8 45.4 47.4 52 42 53.4 36.4 53.8 35 49.2 34.4 47 33.6 43.6Z', lens, ' stroke="' + fc + '" stroke-width="1.8" stroke-linejoin="round"')) + S('M46.8 47.4Q50 46 53.2 47.4', fc, 1.6) + glint;
      case 'reading': return S('M35.4 50.4L' + ex + ' 47M64.6 50.4L' + (100 - ex) + ' 47', fc, 1.4) + both(P('M35.2 49.6H46.8Q46.6 55.2 41 55.6 35.4 55.2 35.2 49.6Z', lens, ' stroke="' + fc + '" stroke-width="1.6" stroke-linejoin="round"')) + S('M46.8 50.4Q50 49 53.2 50.4', fc, 1.4);
      case 'aviator': return arms + both(P('M35 45.2Q41 44 47 45.4 47.4 51 43.6 53.8 39.6 55.4 36.8 53 34.2 50.4 35 45.2Z', tinted, ' fill-opacity=".82" stroke="' + fc + '" stroke-width="1.4" stroke-linejoin="round"')) + S('M47 45.8Q50 44.8 53 45.8M47.2 48.4Q50 47.6 52.8 48.4', fc, 1.2) + sheen;
      case 'sunglasses': return arms + both(P('M34 44.4H47Q47.8 44.4 47.6 45.4L46.5 51Q45.9 53.8 43 53.8H38.4Q35.2 53.8 34.8 51L34 45.4Q33.9 44.4 34 44.4Z', tinted, ' stroke="' + fc + '" stroke-width="1.6" stroke-linejoin="round"')) + S('M33.8 44.6H66.2', fc, 2.2) + sheen;
      case 'sporty': return S('M31.6 46.6L' + ex + ' 45.8M68.4 46.6L' + (100 - ex) + ' 45.8', fc, 1.8) + P('M31.5 45.6Q50 41.4 68.5 45.6 68.6 50.6 64 52.8 58 54.6 54 51.2 52 49.6 50 49.6 48 49.6 46 51.2 42 54.6 36 52.8 31.4 50.6 31.5 45.6Z', tinted, ' stroke="' + fc + '" stroke-width="1.5" stroke-linejoin="round"') + S('M34 46.4Q42 44 50 43.8', '#fff', 1.4, ' opacity=".45"');
      case 'heart': return arms + both(P('M41 54.6C36.4 51.4 34.4 49 34.4 46.6 34.4 44.6 36 43.2 37.8 43.2 39.2 43.2 40.4 44 41 45.2 41.6 44 42.8 43.2 44.2 43.2 46 43.2 47.6 44.6 47.6 46.6 47.6 49 45.6 51.4 41 54.6Z', tinted, ' fill-opacity=".85" stroke="' + fc + '" stroke-width="1.5" stroke-linejoin="round"')) + S('M47.6 46.6Q50 45.4 52.4 46.6', fc, 1.4) + S('M36.6 46.4Q37 45 38.4 44.8M54.6 46.4Q55 45 56.4 44.8', '#fff', 1.1, ' opacity=".6"');
      case 'monocle': return '<circle cx="59" cy="49" r="6" fill="' + lens + '" stroke="' + fc + '" stroke-width="1.9"/>' + S('M64.4 51.6Q70.6 62 66.4 76', fc, 0.9, ' stroke-dasharray="1.2 1"') + S('M55.4 46.6L57.4 45.4', '#fff', 1.1, ' opacity=".7"');
    }
    return '';
  }
  function earrings(t, ex) {
    var x = ex, y = 55.4, G = '#F2C14E';
    if (t === 'studs') return both(circ(x, y, 1.5, G) + circ(x - 0.4, y - 0.5, 0.5, '#fff', ' opacity=".8"'));
    if (t === 'pearls') return both(circ(x, y + 0.6, 2, '#F7F1E6') + circ(x - 0.6, y, 0.7, '#fff'));
    if (t === 'hoops') return both('<circle cx="' + x + '" cy="' + (y + 2.6) + '" r="2.9" fill="none" stroke="' + G + '" stroke-width="1.3"/>');
    if (t === 'drops') return both(circ(x, y, 1, G) + P('M' + x + ' ' + (y + 1) + 'c1.4 2 2 3.2 2 4.2a2 2 0 0 1-4 0c0-1 .6-2.2 2-4.2z', '#3FB6C9') + circ(x - 0.6, y + 4.4, 0.5, '#fff', ' opacity=".7"'));
    if (t === 'shells') return both(circ(x, y, 0.8, G) + '<ellipse cx="' + x + '" cy="' + (y + 3) + '" rx="1.6" ry="2.2" fill="#F6E7C8" stroke="#B8925A" stroke-width=".5"/>' + S('M' + x + ' ' + (y + 1.6) + 'V' + (y + 4.4), '#B8925A', 0.5));
    return '';
  }
  function nose(n, k) {
    switch (n) {
      case 'round': return '<ellipse cx="50" cy="54.8" rx="2.7" ry="2" fill="' + k.skS + '" opacity=".8"/>' + circ(49.2, 54.1, 0.75, '#fff', ' opacity=".45"');
      case 'pointy': return S('M50.6 50.2Q53 54.8 50.4 56.2Q49.4 56.6 48.6 56', k.skD, 1.5);
      case 'wide': return S('M46.2 54.4Q46.8 56.8 49 56.6Q50 57.4 51 56.6Q53.2 56.8 53.8 54.4', k.skD, 1.5);
      case 'small': return circ(48.9, 55.6, 0.75, k.skD) + circ(51.1, 55.6, 0.75, k.skD);
      case 'clown': return circ(50, 54.6, 3.6, '#E5383B') + circ(48.8, 53.4, 1.1, '#fff', ' opacity=".6"');
      default: return S('M47.8 55.4Q50 57.3 52.2 55.4', k.skD, 1.7);
    }
  }
  function marks(m, k) {
    var s = '', fc = mix(k.sk, '#6B3A1E', 0.5);
    if (m === 'freckles' || m === 'both') [[34.6, 56], [37, 55.2], [39.4, 56.2], [35.8, 58.2], [38.4, 58.4], [36.6, 60.2]].forEach(function (p) { s += circ(p[0], p[1], 0.55, fc) + circ(100 - p[0], p[1], 0.55, fc); });
    if (m === 'mole' || m === 'both') s += circ(58.8, 62.8, 0.85, '#3A2218');
    if (m === 'glitter') s += spark(34.4, 55.4, 1.6, '#fff', 0.95) + spark(38.4, 58.4, 1, '#FFE39A') + spark(65.6, 55.4, 1.6, '#fff', 0.95) + spark(61.8, 58.4, 1, '#FFE39A') + circ(36.6, 60.4, 0.5, '#fff') + circ(63.6, 60.4, 0.5, '#fff');
    return s;
  }
  function bgSVG(b, crop) {
    var it = item('bg', b) || item('bg', 'sky'), v = it.value, shape = crop ? '<rect x="-20" y="-20" width="140" height="140"' : '<circle cx="50" cy="50" r="50"';
    var sheen = crop ? '' : '<ellipse cx="34" cy="20" rx="34" ry="22" fill="#fff" opacity=".1"/>';
    if (typeof v === 'string') return shape + ' fill="' + v + '"/>' + sheen;
    if (Array.isArray(v)) {
      var s = '<linearGradient id="§g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="' + v[0] + '"/><stop offset="1" stop-color="' + v[1] + '"/></linearGradient>' + shape + ' fill="url(#§g)"/>';
      if (b === 'stars') s += circ(18, 30, 1, '#fff') + circ(80, 22, 1.3, '#fff') + circ(86, 46, 0.8, '#fff', ' opacity=".7"') + circ(12, 52, 0.9, '#fff', ' opacity=".7"') + circ(30, 12, 0.7, '#fff') + circ(64, 8, 0.8, '#fff', ' opacity=".8"') + circ(90, 62, 0.7, '#fff', ' opacity=".6"') + spark(76, 64, 2, '#FFE39A') + spark(22, 18, 1.6, '#fff', 0.8);
      else if (b === 'gold') s += P('M50 50L20 -10H34ZM50 50L62 -10H74ZM50 50L100 6V22Z', '#fff', ' opacity=".22"') + spark(16, 38, 2.6, '#fff');
      else if (b === 'sunset') s += circ(22, 30, 9, '#FFE29A', ' opacity=".55"');
      else if (b === 'lagoon') s += circ(16, 40, 2.4, '#fff', ' opacity=".35"') + circ(84, 30, 1.8, '#fff', ' opacity=".35"') + circ(80, 52, 1.2, '#fff', ' opacity=".35"');
      return s + sheen;
    }
    var o = shape + ' fill="' + v.base + '"/>', i, j;
    if (v.p === 'dots') { for (i = 0; i < 9; i++) for (j = 0; j < 9; j++) o += circ(6 + i * 11 + (j % 2) * 5.5, 6 + j * 11, 1.8, '#fff', ' opacity=".45"'); }
    else if (v.p === 'waves') { for (j = 0; j < 9; j++) o += S('M-4 ' + (8 + j * 11) + 'q6-4 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0', '#fff', 1.4, ' opacity=".4"'); }
    else if (v.p === 'confetti') { var C = ['#FF6B8B', '#3DB8F5', '#FFC93C', '#2FB67C', '#9B6BFF']; for (i = 0; i < 26; i++) { var x = (i * 37.3) % 96 + 2, y = (i * 23.7 + 7) % 90 + 3; o += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="3.2" height="1.6" rx=".6" fill="' + C[i % 5] + '" transform="rotate(' + (i * 47 % 180) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>'; } }
    else if (v.p === 'lacquer') {
      o += '<circle cx="50" cy="50" r="46" fill="none" stroke="#F2B632" stroke-width="3"/><circle cx="50" cy="50" r="42.6" fill="none" stroke="#1E1414" stroke-width="1.6"/><circle cx="50" cy="50" r="40.4" fill="none" stroke="#2F8A4E" stroke-width="1.4"/><circle cx="50" cy="50" r="36" fill="none" stroke="#F2B632" stroke-width="1"/>';
      for (i = 0; i < 24; i++) o += '<ellipse cx="50" cy="5.6" rx="1.3" ry="2.6" fill="#F2B632" transform="rotate(' + i * 15 + ' 50 50)"/>' + circ(50, 11, 0.8, '#1E1414', ' transform="rotate(' + (i * 15 + 7.5) + ' 50 50)"');
    }
    return o + sheen;
  }

  var CROPS = { head: '14 4 72 72', face: '18 14 64 64', cheeks: '22 32 56 56', nose: '37 41 26 26', eyes: '31 29 38 38', brows: '30 27 40 40', mouth: '35 46 30 30', hair: '8 0 84 84',
    facial: '24 36 52 52', glasses: '24 28 52 52', hat: '4 -3 92 92', ear: '12 36 36 36', neck: '24 58 52 52', body: '12 34 76 76', full: '0 0 100 100' };

  function build(c, o) {
    var e = o.expression, crop = o.crop ? (CROPS[o.crop] || o.crop) : (o.bust === false ? CROPS.head : null);
    var sk = val('skin', c.skin), hv = val('hairColor', c.hairColor), sc = val('scarfColor', c.scarfColor), oc = val('outfitColor', c.outfitColor);
    var h0 = Array.isArray(hv) ? hv[0] : hv, h1 = Array.isArray(hv) ? hv[1] : hv, hc = Array.isArray(hv) ? mix(h0, h1, 0.35) : hv;
    var cover = !!COVER[c.hair];
    var k = { sk: sk, skS: mix(sk, '#7a3320', 0.2), skD: mix(sk, '#5a2414', 0.34), hc: hc, hcB: shade(hc, 0.2), hg: 'url(#§hg)', sc: sc, scS: shade(sc, 0.2), scL: tint(sc, 0.5), sg: 'url(#§sg)',
      og: 'url(#§og)', ogR: 'url(#§or)', fh: h0, fhD: shade(h0, 0.35), cover: cover, bald: c.hair === 'bald', bigTop: /^(afro|mohawk|bun|highbun|spiky)$/.test(c.hair) };
    var fem = c.body === 'f', F = (fem && FACES_F[c.face]) || FACES[c.face], ex = F.l + 0.4;
    var hatId = cover && !HATS_OK_ON_SCARF && !COVER_HATS[c.hat] ? 'none' : c.hat;
    var H = HAIR[c.hair];
    var compress = hatId !== 'none' && !HAT_NOCOMPRESS[hatId] && (hatId !== 'crown' || BIG_HAIR.test(c.hair));
    var hb = compress && H.hatBack ? H.hatBack : H.back, hf = compress && H.hatFront ? H.hatFront : H.front;
    var O = OUTFITS[c.outfit](oc, k);
    var fx = facial(c.facial, k);
    var lipIt = item('lips', c.lips), lip = lipIt && lipIt.value ? lipIt.value : (c.body === 'f' ? mix(sk, '#D0566A', 0.45) : null);
    var size = o.size || 96, vb = crop || '0 0 100 100';
    var title = o.title ? esc(o.title) : '';
    var lensV = val('lens', c.lens);
    var cheeks = c.cheeks, blushOp = cheeks === 'none' ? 0 : cheeks === 'rosy' ? 0.8 : 0.45;
    if (e === 'angry') blushOp = 0.9; else if (/^(happy|shocked|laugh|wink)$/.test(e || '')) blushOp = Math.min(1, (blushOp || 0.3) + 0.2);
    var blushC = e === 'angry' ? '#FF4D5E' : '#FF6F84';
    var ro = {}; ['size', 'crop', 'bust', 'bg', 'ring', 'title', 'animate', 'className', 'expression'].forEach(function (n) { if (o[n] != null && o[n] !== '') ro[n] = o[n]; });
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="' + size + '" height="' + size + '" class="dga-av' + (o.animate ? ' dga-anim' : '') + (o.className ? ' ' + esc(o.className) : '') + '"' +
      ' data-dga="' + CATS.map(function (x) { return c[x]; }).join(',') + '" data-dgo="' + esc(JSON.stringify(ro)) + '"' + (o.animate ? ' style="¤"' : '') +
      (title ? ' role="img" aria-label="' + title + '"><title>' + title + '</title>' : ' aria-hidden="true" focusable="false">');
    s += '<defs><clipPath id="§h"><path d="' + F.d + '"/></clipPath>' + (crop ? '' : '<clipPath id="§c"><circle cx="50" cy="50" r="50"/></clipPath>') +
      '<radialGradient id="§s" cx=".4" cy=".3" r=".78"><stop offset="0" stop-color="' + tint(sk, 0.12) + '"/><stop offset=".55" stop-color="' + sk + '"/><stop offset="1" stop-color="' + mix(sk, k.skS, 0.7) + '"/></radialGradient>' +
      lin('§hg', tint(h0, 0.16), shade(h1, 0.1)) + lin('§og', tint(oc, 0.1), shade(oc, 0.14)) + lin('§or', '#E8243F', '#B50C2A') + lin('§sg', tint(sc, 0.12), shade(sc, 0.12)) +
      '<radialGradient id="§bl"><stop offset="0" stop-color="' + blushC + '"/><stop offset="1" stop-color="' + blushC + '" stop-opacity="0"/></radialGradient>' +
      (Array.isArray(lensV) ? lin('§ln', lensV[0], lensV[1], 0.3, 1) : '') + '</defs>';
    s += crop ? '<g>' : '<g clip-path="url(#§c)">';
    if (o.bg !== false && !(o.bust === false && !o.crop)) s += bgSVG(c.bg, !!crop);
    s += '<g class="dga-fig"><g transform="translate(3 1.7) scale(.94)">';
    if (hb) s += hb(k);
    var BW = fem ? '<g transform="translate(4 0) scale(.92 1)">' : '<g>';
    if (O.back) s += BW + O.back + '</g>';
    if (c.hair !== 'hijab') s += P('M42.5 60V78.5Q50 83 57.5 78.5V60Z', sk) + P('M42.5 62Q50 74 57.5 62V70.5Q50 78.5 42.5 70.5Z', k.skS);
    s += BW + O.front + '</g>';
    if (c.neck !== 'none' && c.hair !== 'hijab' && NECK[c.neck]) s += NECK[c.neck]();
    if (H.mid) s += H.mid(k);
    if (!cover) s += circ(ex, 50, 5, sk) + S('M' + (ex + 0.5) + ' 47.4Q' + (ex - 1.9) + ' 49.6 ' + (ex + 0.3) + ' 52.6', k.skD, 1.4, ' opacity=".6"') +
      circ(100 - ex, 50, 5, mix(sk, k.skS, 0.7)) + S('M' + (99.5 - ex) + ' 47.4Q' + (101.9 - ex) + ' 49.6 ' + (99.7 - ex) + ' 52.6', k.skD, 1.4, ' opacity=".6"');
    s += P(F.d, 'url(#§s)') + '<g clip-path="url(#§h)">' + P('M59 20C71 29 73.5 52 63.5 65.5 59.5 70.5 53 73 44 74L110 110V0Z', k.skS, ' opacity=".42"') +
      P('M20 20H80V33C70 29 60 28 50 28S30 29 20 33Z', k.skS, ' opacity=".18"') + '</g>';
    if (blushOp) s += '<ellipse cx="36.6" cy="58.2" rx="5.2" ry="3.4" fill="url(#§bl)" opacity="' + blushOp + '"/><ellipse cx="63.4" cy="58.2" rx="5.2" ry="3.4" fill="url(#§bl)" opacity="' + blushOp + '"/>';
    s += marks(c.marks, k);
    if (c.paint !== 'none' && PAINT[c.paint]) s += PAINT[c.paint]();
    var MK = c.mask !== 'none' && MASKS[c.mask] ? MASKS[c.mask](k, ex) : {};
    if (MK.under) s += MK.under;
    s += nose(c.nose, k);
    s += fx.under + '<g class="dga-mouth">' + mouth(c.mouth, e, lip) + '</g>' + fx.over;
    if (MK.mid) s += MK.mid;
    var ec = val('eyeColor', c.eyeColor), closed = /^(happy|laugh|blink)$/.test(e || '');
    s += '<g class="dga-eyes' + (closed ? ' dga-closed' : '') + '">' + eye(c.eyes, 41, 49, ec, k, e, -1, c.lashes) + eye(c.eyes, 59, 49, ec, k, e, 1, c.lashes) + '</g>';
    s += brows(c.brows, c.hair === 'bald' || c.hair === 'buzz' ? mix(h0, INK, 0.3) : mix(h0, INK, 0.4), e);
    if (MK.eye) s += MK.eye;
    s += glasses(c.glasses, val('glassesColor', c.glassesColor), ex, c.lens);
    if (hf) s += hf(k);
    if (!cover) s += earrings(c.earrings, ex);
    if (hatId !== 'none') s += HATS[hatId](val('hatColor', c.hatColor), k);
    if (e === 'shocked') s += P('M74 26c2.2 3.2 3.2 5 3.2 6.4a3.2 3.2 0 0 1-6.4 0c0-1.4 1-3.2 3.2-6.4z', '#8FD8FF', ' stroke="#fff" stroke-width=".8"');
    else if (e === 'sad') s += P('M61 54.6c1.2 1.8 1.8 2.8 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.8 1.8-3.6z', '#8FD8FF');
    else if (e === 'angry') s += S('M73.4 25.4l2.2 2.2M79.6 25.4l-2.2 2.2M73.4 31.6l2.2-2.2M79.6 31.6l-2.2-2.2', '#E5484D', 1.8);
    else if (e === 'happy') s += spark(76, 28.6, 3.2, '#fff', 0.9) + spark(22, 37.8, 2.2, '#fff', 0.8);
    else if (e === 'laugh') s += both(P('M33.6 51.4c1.3 1.9 1.9 3 1.9 3.8a1.9 1.9 0 0 1-3.8 0c0-.8.6-1.9 1.9-3.8z', '#8FD8FF')) + spark(78, 26, 3, '#FFE39A') + spark(21, 30, 2.2, '#fff', 0.9);
    else if (e === 'wink') s += spark(72, 40, 2.6, '#FFE39A') + spark(76.6, 35, 1.5, '#fff', 0.9);
    else if (e === 'thinking') s += circ(70.6, 33.6, 1.3, '#fff', ' stroke="' + INK + '" stroke-width=".6"') + circ(74.6, 27.6, 2, '#fff', ' stroke="' + INK + '" stroke-width=".6"') +
      '<ellipse cx="81" cy="18.6" rx="5.4" ry="4.2" fill="#fff" stroke="' + INK + '" stroke-width=".6"/>' + circ(78.8, 18.8, 0.7, INK) + circ(81, 18.8, 0.7, INK) + circ(83.2, 18.8, 0.7, INK);
    else if (e === 'sleepy') s += S('M71.4 29.6h3.6l-3.6 4.4h3.6', '#5A6CB8', 1.2) + S('M77 20.6h5l-5 6h5', '#5A6CB8', 1.5);
    s += '</g></g></g>';
    if (o.ring && !crop) s += '<circle cx="50" cy="50" r="48.4" fill="none" stroke="' + (typeof o.ring === 'string' ? esc(o.ring) : '#fff') + '" stroke-width="3.2"/>';
    return s + '</svg>';
  }

  /* ---------------------------------------------------------------- base css + render */
  /* Idle life (render with {animate:true}): random blink / double blink, breathing, glances, a rare small smile.
     Every avatar gets its own random timings (CSS variables on the <svg>). transform-only; all off under reduced motion. */
  var BASE_CSS = '.dga-av{display:block;overflow:hidden}' +
    '.dga-anim .dga-eyes{transform-box:fill-box;transform-origin:center;animation:var(--dga-bk,dga-blink) var(--dga-bd,5.2s) var(--dga-bo,0s) infinite}' +
    '.dga-anim .dga-eyes.dga-closed{animation:none}' +
    '.dga-anim .dga-iris{animation:dga-glance var(--dga-gl,9s) var(--dga-go,0s) infinite}' +
    '.dga-anim .dga-fig{animation:dga-breathe var(--dga-br,3.8s) ease-in-out var(--dga-bo2,0s) infinite}' +
    '.dga-anim .dga-mouth{transform-box:fill-box;transform-origin:center;animation:dga-smile var(--dga-sm,14s) var(--dga-so,0s) infinite}' +
    '@keyframes dga-blink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}' +
    '@keyframes dga-blink2{0%,84%,88%,90.5%,94.5%,100%{transform:scaleY(1)}86%,92.5%{transform:scaleY(.1)}}' +
    '@keyframes dga-glance{0%,56%,100%{transform:translate(0,0)}59%,68%{transform:translate(1.1px,0)}71%,80%{transform:translate(0,0)}83%,91%{transform:translate(-1.1px,-.2px)}94%{transform:translate(0,0)}}' +
    '@keyframes dga-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-.9px)}}' +
    '@keyframes dga-smile{0%,84%,100%{transform:scale(1)}88%,95%{transform:scale(1.12,1.1)}}' +
    '.dga-react{transform-origin:50% 50%;animation:dga-rpop .55s cubic-bezier(.34,1.56,.64,1)}@keyframes dga-rpop{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}' +
    '@media (prefers-reduced-motion:reduce){.dga-anim .dga-eyes,.dga-anim .dga-iris,.dga-anim .dga-fig,.dga-anim .dga-mouth,.dga-react{animation:none}}';
  function idleVars() {
    var R = Math.random, f = function (n) { return n.toFixed(2) + 's'; }, bd = 3.6 + R() * 3.4, gl = 7 + R() * 6, sm = 11 + R() * 10;
    return '--dga-bk:' + (R() < 0.3 ? 'dga-blink2' : 'dga-blink') + ';--dga-bd:' + f(bd) + ';--dga-bo:' + f(-R() * bd) + ';--dga-br:' + f(3.2 + R() * 1.6) + ';--dga-bo2:' + f(-R() * 4) +
      ';--dga-gl:' + f(gl) + ';--dga-go:' + f(-R() * gl) + ';--dga-sm:' + f(sm) + ';--dga-so:' + f(-R() * sm);
  }
  var baseDone = false;
  function injectCSS(id, css) {
    if (typeof document === 'undefined') return;
    var st = document.getElementById(id);
    if (st) { if (st.textContent !== css) st.textContent = css; return; }
    st = document.createElement('style'); st.id = id; st.textContent = css; (document.head || document.documentElement).appendChild(st);
  }
  var CACHE = {}, CN = 0, SEQ = 0;
  function render(cfg, o) {
    o = o || {};
    if (!baseDone) { injectCSS('dga-base-css', BASE_CSS); baseDone = true; }
    var c = norm(cfg);
    var key = CATS.map(function (x) { return c[x]; }).join(',') + '|' + [o.expression || '', o.bust === false ? 0 : 1, o.crop || '', o.ring || '', o.bg === false ? 0 : 1, o.size || 96, o.title || '', o.animate ? 1 : 0, o.className || ''].join('|');
    var t = CACHE[key];
    if (!t) { if (++CN > 800) { CACHE = {}; CN = 1; } t = CACHE[key] = build(c, o); }
    var id = 'dga' + (++SEQ).toString(36);
    t = t.replace(/§/g, id);
    if (o.animate) t = t.replace('¤', idleVars());
    return t;
  }
  /* react(el, expression, ms=1600): briefly show an expression on an avatar that is already on the page, with a springy pop,
     then go back to how it was. el = the <svg class="dga-av"> or any element containing one. Safe to call often. */
  function react(el, expression, ms) {
    if (!el || typeof document === 'undefined') return false;
    var svg = el.matches && el.matches('svg.dga-av') ? el : el.querySelector && el.querySelector('svg.dga-av');
    if (!svg || !svg.parentNode) return false;
    var host = svg.parentNode, base = host.__dgaBase;
    if (!base) {
      var vals = (svg.getAttribute('data-dga') || '').split(','), cfg = {}, o = {};
      if (vals.length !== CATS.length) return false;
      CATS.forEach(function (c, i) { cfg[c] = vals[i]; });
      try { o = JSON.parse(svg.getAttribute('data-dgo') || '{}'); } catch (e) { }
      base = host.__dgaBase = { cfg: cfg, o: o };
    }
    function put(html, pop) {
      var cur = host.querySelector('svg.dga-av'), t = document.createElement('div'); t.innerHTML = html;
      var n = t.firstChild; if (pop) n.classList.add('dga-react');
      if (cur) host.replaceChild(n, cur); else host.appendChild(n);
    }
    clearTimeout(host.__dgaT);
    put(render(base.cfg, Object.assign({}, base.o, { expression: expression || null })), true);
    host.__dgaT = setTimeout(function () {
      var cur = host.querySelector('svg.dga-av');
      if (cur && cur.classList.contains('dga-react')) put(render(base.cfg, base.o), false); /* skip if the game re-rendered meanwhile */
      host.__dgaBase = null;
    }, ms == null ? 1600 : ms);
    return true;
  }
  function dataURI(cfg, o) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(render(cfg, Object.assign({}, o, { animate: false }))); }

  /* ---------------------------------------------------------------- storage */
  /* load(owned?): with an owned set/array/map, unowned paid items are dropped (same as validate). Without it, only invalid values / conflicts are fixed. */
  function load(owned) {
    try {
      var s = root.localStorage.getItem(KEY); if (!s) return null; var o = JSON.parse(s); if (!o || typeof o !== 'object') return null;
      if (owned) return validate(o, owned);
      var c = norm(o);
      if (!HATS_OK_ON_SCARF && COVER[c.hair] && !COVER_HATS[c.hat]) c.hat = 'none';
      if (c.mask === 'patchR' && c.glasses === 'monocle') c.glasses = 'none';
      return c;
    } catch (e) { return null; }
  }
  function save(cfg) {
    var c = norm(cfg);
    try { root.localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { }
    try { root.dispatchEvent(new CustomEvent('dg-char-change', { detail: c })); } catch (e) { }
    return c;
  }

  /* ---------------------------------------------------------------- presets (Dhogu suspects) */
  var PRESETS = {
    ali: { skin: 'golden', face: 'square', nose: 'round', eyes: 'dot', eyeColor: 'brown', brows: 'thick', mouth: 'smile', hair: 'short', hairColor: 'darkbrown', facial: 'mo', hat: 'deerstalker', outfit: 'trench', bg: 'sky' },
    aisha: { skin: 'light', face: 'oval', nose: 'small', eyes: 'lashes', eyeColor: 'hazel', lashes: 'full', brows: 'arched', mouth: 'smirk', lips: 'berry', hair: 'bun', hairColor: 'black', earrings: 'hoops', neck: 'pearls', outfit: 'libaas', outfitColor: 'violet', bg: 'lilac' },
    ibrahim: { skin: 'brown', face: 'full', nose: 'wide', eyes: 'round', eyeColor: 'darkbrown', brows: 'straight', mouth: 'grin', hair: 'buzz', hairColor: 'black', facial: 'mo', hat: 'police', outfit: 'police', bg: 'sunshine' },
    mariyam: { skin: 'tan', face: 'round', nose: 'button', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'subtle', brows: 'soft', mouth: 'smile', lips: 'rose', marks: 'freckles', hair: 'headscarf', hairColor: 'black', scarfColor: 'rose', outfit: 'libaas', outfitColor: 'teal', bg: 'mint' },
    hussain: { skin: 'deep', face: 'oval', nose: 'pointy', eyes: 'round', eyeColor: 'darkbrown', brows: 'soft', mouth: 'neutral', hair: 'sidepart', hairColor: 'black', glasses: 'round', glassesColor: 'black', outfit: 'shirt', outfitColor: 'maroon', bg: 'pink' }
  };
  Object.keys(PRESETS).forEach(function (n) { PRESETS[n] = norm(PRESETS[n]); });
  /* "Pick a look": ready-made starters for new players (free items only, 4 female + 4 male) */
  var LOOKS = [
    { name: 'Aminath', cfg: { body: 'f', skin: 'golden', face: 'oval', nose: 'small', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'subtle', brows: 'arched', mouth: 'smile', lips: 'rose', hair: 'fringelong', hairColor: 'black', earrings: 'studs', outfit: 'libaas', outfitColor: 'teal', bg: 'pink' } },
    { name: 'Hawwa', cfg: { body: 'f', skin: 'tan', face: 'round', nose: 'button', eyes: 'round', eyeColor: 'brown', lashes: 'full', brows: 'soft', mouth: 'grin', hair: 'hijab', scarfColor: 'lilac', outfit: 'tee', outfitColor: 'violet', bg: 'sunshine' } },
    { name: 'Zara', cfg: { body: 'f', skin: 'deep', face: 'heart', nose: 'small', eyes: 'wide', eyeColor: 'brown', lashes: 'subtle', brows: 'soft', mouth: 'open', lips: 'coral', hair: 'afro', hairColor: 'black', earrings: 'hoops', outfit: 'polo', outfitColor: 'emerald', bg: 'sky' } },
    { name: 'Leena', cfg: { body: 'f', skin: 'light', face: 'round', nose: 'button', eyes: 'round', eyeColor: 'green', lashes: 'subtle', marks: 'freckles', brows: 'thin', mouth: 'smile', hair: 'highbun', hairColor: 'auburn', glasses: 'cateye', glassesColor: 'red', outfit: 'tee', outfitColor: 'sunshine', bg: 'lilac' } },
    { name: 'Ahmed', cfg: { body: 'm', skin: 'brown', face: 'square', nose: 'round', eyes: 'round', eyeColor: 'darkbrown', brows: 'thick', mouth: 'smile', hair: 'short', hairColor: 'black', outfit: 'polo', outfitColor: 'ocean', bg: 'sky' } },
    { name: 'Ismail', cfg: { body: 'm', skin: 'ebony', face: 'full', nose: 'wide', eyes: 'round', eyeColor: 'black', brows: 'straight', mouth: 'grin', hair: 'fade', hairColor: 'black', facial: 'shortbeard', outfit: 'hoodie', outfitColor: 'emerald', bg: 'sunshine' } },
    { name: 'Nadeem', cfg: { body: 'm', skin: 'fair', face: 'oval', nose: 'pointy', eyes: 'almond', eyeColor: 'hazel', brows: 'soft', mouth: 'smirk', hair: 'sidepart', hairColor: 'darkbrown', facial: 'stubble', glasses: 'round', glassesColor: 'black', outfit: 'shirt', outfitColor: 'navy', bg: 'sand' } },
    { name: 'Shifan', cfg: { body: 'm', skin: 'tan', face: 'round', nose: 'button', eyes: 'wide', eyeColor: 'darkbrown', brows: 'soft', mouth: 'grin', hair: 'curlytop', hairColor: 'black', outfit: 'mvjersey', bg: 'coral' } }
  ];
  LOOKS.forEach(function (l) { l.cfg = norm(l.cfg); });

  /* ================================================================ BUILDER ================================================================ */
  function ti(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  var TABS = [
    { id: 'start', name: 'Start', icon: ti('<circle cx="12" cy="8" r="4"/><path d="M4.6 20.4c.8-4 3.8-6.4 7.4-6.4s6.6 2.4 7.4 6.4"/>'), secs: [] },
    { id: 'face', name: 'Face', icon: ti('<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14.2q3.4 3 6.8 0"/><path d="M9 9.6h.01M15 9.6h.01" stroke-width="2.6"/>'),
      secs: [['skin', 'sw'], ['face', 'th', 'face'], ['nose', 'th', 'nose'], ['cheeks', 'th', 'cheeks'], ['marks', 'th', 'cheeks']] },
    { id: 'eyes', name: 'Eyes', icon: ti('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
      secs: [['eyes', 'th', 'eyes'], ['eyeColor', 'sw'], ['lashes', 'th', 'eyes'], ['brows', 'th', 'brows']] },
    { id: 'mouth', name: 'Mouth', icon: ti('<path d="M3.5 11.5q4.2-4.2 8.5-1.6 4.3-2.6 8.5 1.6-3.6 6-8.5 6t-8.5-6z"/><path d="M3.5 11.5h17"/>'),
      secs: [['mouth', 'th', 'mouth'], ['lips', 'sw']] },
    { id: 'hair', name: 'Hair', icon: ti('<path d="M4.5 15C3.4 7.6 7.4 3.6 12 3.6s8.6 4 7.5 11.4"/><path d="M5 12.6C8 12 11.4 9.6 12.6 6.8c1.6 3 3.6 4.8 6.4 5.8"/><path d="M6 20.4c.6-2 2-3 3-3.6M18 20.4c-.6-2-2-3-3-3.6"/>'),
      secs: [['hair', 'th', 'hair'], ['hairColor', 'sw'], ['scarfColor', 'sw']] },
    { id: 'facial', name: 'Beard', icon: ti('<path d="M4.6 8.6c0 7.4 3.4 12 7.4 12s7.4-4.6 7.4-12"/><path d="M8.2 13.8q3.8-2.4 7.6 0"/><path d="M4.6 8.6q3.2 4.2 7.4 3.4 4.2.8 7.4-3.4"/>'),
      secs: [['facial', 'th', 'facial']] },
    { id: 'glasses', name: 'Glasses', icon: ti('<circle cx="6.6" cy="13.4" r="3.8"/><circle cx="17.4" cy="13.4" r="3.8"/><path d="M10.4 13q1.6-1.2 3.2 0M2.8 12.2 1.6 8.6M21.2 12.2l1.2-3.6"/>'),
      secs: [['glasses', 'th', 'glasses'], ['glassesColor', 'sw'], ['lens', 'sw']] },
    { id: 'hat', name: 'Hat', icon: ti('<path d="M5 15.4c0-6 3-10 7-10s7 4 7 10"/><path d="M2.6 15.6q9.4-2.6 18.8 0-.4 2.6-9.4 2.6t-9.4-2.6z"/>'),
      secs: [['hat', 'th', 'hat'], ['hatColor', 'sw']] },
    { id: 'outfit', name: 'Outfit', icon: ti('<path d="M8.6 3.6 3 6.6l2 4.6 2.2-1V20.4h9.6V10.2l2.2 1 2-4.6-5.6-3q-1.4 2.2-3.4 2.2T8.6 3.6z"/>'),
      secs: [['outfit', 'th', 'body'], ['outfitColor', 'sw']] },
    { id: 'extras', name: 'Extras', icon: ti('<path d="M12 3.4l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/><path d="M18.6 15.6l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
      secs: [['neck', 'th', 'neck'], ['earrings', 'th', 'ear']] },
    { id: 'masks', name: 'Masks', icon: ti('<path d="M3 9.4q0-2.6 4-2.6 3 0 5 2 2-2 5-2 4 0 4 2.6 0 5.6-4.6 5.6-2.6 0-4.4-2.4-1.8 2.4-4.4 2.4Q3 15 3 9.4z"/><circle cx="7.6" cy="10.2" r="1.3"/><circle cx="16.4" cy="10.2" r="1.3"/>'),
      secs: [['mask', 'th', 'face'], ['paint', 'th', 'cheeks']] },
    { id: 'bg', name: 'Scene', icon: ti('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 16.4l5-4.6 4.4 4 3-2.6L21 18"/><circle cx="15.6" cy="8.8" r="1.6"/>'),
      secs: [['bg', 'sw']] }
  ];
  var EXPRS = [['', 'Default'], ['happy', 'Happy'], ['laugh', 'Laugh'], ['wink', 'Wink'], ['shocked', 'Shocked'], ['smug', 'Smug'], ['thinking', 'Thinking'], ['sad', 'Sad'], ['angry', 'Angry'], ['sleepy', 'Sleepy']];
  var ICO = {
    dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    none: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M6.2 17.8 17.8 6.2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 6.5v11M6.5 12h11"/></svg>',
    shell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c4.8 0 8.6 3.6 8.6 8.3 0 3.4-2 6.3-5 7.7L12 21l-3.6-1.8c-3-1.4-5-4.3-5-7.7 0-4.7 3.8-8.3 8.6-8.3z" fill="#F4D9A6" stroke="#B8925A" stroke-width="1.4"/><path d="M12 5v14M8.2 6.4 10 18.4M15.8 6.4 14 18.4M5.4 9.4 8.6 17.4M18.6 9.4 15.4 17.4" stroke="#B8925A" stroke-width="1.1" stroke-linecap="round"/></svg>'
  };
  var RARITY_COL = { common: '#8A9396', rare: '#3E86E0', epic: '#8B55E0', legendary: '#D99A1E' };

  var BUILDER_CSS = [
    '.dga-root{--_bg:var(--dga-bg,#F6EFE3);--_sf:var(--dga-surface,#FFFCF6);--_sf2:var(--dga-surface-2,#EFE5D4);--_ink:var(--dga-ink,#1F2B2F);--_mut:var(--dga-muted,#5D6A6C);--_ac:var(--dga-accent,#1E6B4E);--_on:var(--dga-on-accent,#fff);--_gold:var(--dga-gold,#B8925A);--_line:var(--dga-line,rgba(31,43,47,.13));--_ring:var(--dga-focus,#1E6B4E);--_disp:var(--dga-font-display,"Marcellus",Georgia,serif);',
    'position:relative;box-sizing:border-box;width:100%;max-width:980px;margin:0 auto;color:var(--_ink);background:var(--_bg);font-family:var(--dga-font,"Sora",system-ui,-apple-system,"Segoe UI",sans-serif);font-size:15px;line-height:1.35;border-radius:var(--dga-radius,24px);display:flex;flex-direction:column;min-width:0;-webkit-tap-highlight-color:transparent;container:dga/inline-size}',
    '.dga-root.dga-dark{--_bg:var(--dga-bg,#2A1B5E);--_sf:var(--dga-surface,#35246F);--_sf2:var(--dga-surface-2,#402C82);--_ink:var(--dga-ink,#F5F0FF);--_mut:var(--dga-muted,#C3B6EA);--_ac:var(--dga-accent,#FFC93C);--_on:var(--dga-on-accent,#231942);--_gold:var(--dga-gold,#FFC93C);--_line:var(--dga-line,rgba(255,255,255,.15));--_ring:var(--dga-focus,#FFC93C)}',
    '.dga-root *,.dga-root *::before,.dga-root *::after{box-sizing:border-box}',
    '.dga-root button{font:inherit;color:inherit;cursor:pointer;-webkit-appearance:none;appearance:none}',
    '.dga-root :focus{outline:none}.dga-root :focus-visible{outline:3px solid var(--_ring);outline-offset:2px}',
    '.dga-head{display:flex;align-items:center;gap:10px;padding:14px 16px 4px}',
    '.dga-title{flex:1;margin:0;font:400 22px/1.15 var(--_disp);letter-spacing:.2px}',
    '.dga-boli{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 8px;border-radius:99px;background:var(--_sf);border:1px solid var(--_line);font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}',
    '.dga-boli svg,.dga-boli img{width:22px;height:22px}',
    'button.dga-boli{min-height:44px;height:44px;padding:0 10px 0 8px;transition:transform .12s,box-shadow .15s,background-color .15s}',
    'button.dga-boli:hover{box-shadow:0 2px 10px rgba(0,0,0,.1);background:color-mix(in srgb,var(--_gold) 12%,var(--_sf))}button.dga-boli:active{transform:scale(.96)}',
    '.dga-boli .dga-bplus{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--_gold);color:#fff}.dga-boli .dga-bplus svg{width:13px;height:13px}.dga-dark .dga-boli .dga-bplus{color:#231942}',
    '.dga-ib{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:14px;border:1px solid var(--_line);background:var(--_sf)}.dga-ib svg{width:20px;height:20px}',
    '.dga-main{display:flex;flex-direction:column;min-width:0}',
    '.dga-stage{position:sticky;top:var(--dga-sticky-top,0px);z-index:3;background:var(--_bg);display:grid;grid-template-columns:120px minmax(0,1fr);column-gap:14px;row-gap:10px;align-items:center;padding:8px 16px 10px}',
    '.dga-pv{grid-row:1/3;position:relative;width:120px;height:120px;border-radius:50%;filter:drop-shadow(0 8px 14px rgba(0,0,0,.16))}',
    '.dga-pv svg{width:100%;height:100%}',
    '.dga-pop{animation:dga-pop .32s cubic-bezier(.34,1.56,.64,1)}@keyframes dga-pop{40%{transform:scale(1.045)}}',
    '.dga-chips{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;min-width:0;padding:3px;margin:-3px}.dga-chips::-webkit-scrollbar{display:none}.dga-chip{flex:none}',
    '.dga-chip{min-height:36px;padding:6px 12px;border-radius:99px;border:1px solid var(--_line);background:var(--_sf);font-size:13px;font-weight:600}',
    '.dga-chip[aria-pressed="true"]{background:var(--_ink);color:var(--_bg);border-color:var(--_ink)}',
    '.dga-tools{display:flex;gap:8px;flex-wrap:nowrap}',
    '.dga-tool{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;min-width:44px;padding:0 12px;border-radius:14px;border:1px solid var(--_line);background:var(--_sf);font-weight:600;font-size:14px}',
    '.dga-tl{display:none}',
    '.dga-tool svg{width:18px;height:18px;fill:none}.dga-tool svg circle{fill:currentColor}.dga-tool[disabled]{opacity:.45;cursor:default}',
    '.dga-edit{min-width:0;display:flex;flex-direction:column}',
    '.dga-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px 16px 12px}',
    '@container dga (min-width:480px){.dga-tabs{grid-template-columns:repeat(6,minmax(0,1fr))}}',
    '.dga-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0;min-height:54px;padding:6px 3px;border-radius:14px;border:1px solid var(--_line);background:var(--_sf);font-weight:600;font-size:11.5px;line-height:1.1;color:var(--_mut);transition:background-color .15s,color .15s;overflow:hidden}',
    '.dga-tab>span{display:block;max-width:100%;text-align:center;overflow-wrap:anywhere;hyphens:auto}',
    '.dga-tab svg{width:22px;height:22px;flex:none}.dga-tab:hover{color:var(--_ink)}',
    '.dga-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}',
    '.dga-segb{min-height:52px;border-radius:16px;border:2px solid var(--_line);background:var(--_sf);font-weight:700;font-size:16px}',
    '.dga-segb[aria-pressed="true"]{border-color:var(--_ac);background:color-mix(in srgb,var(--_ac) 12%,var(--_sf));color:var(--_ink)}',
    '.dga-looks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '.dga-look{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:6px 2px 8px;border-radius:18px;border:2px solid transparent;background:var(--_sf);box-shadow:0 1px 0 var(--_line);font-size:11px;letter-spacing:-.2px;font-weight:600}',
    '.dga-look svg{width:100%;max-width:72px;height:auto;border-radius:50%}.dga-look>span{max-width:100%;text-align:center;overflow-wrap:anywhere}',
    '.dga-look:hover{transform:translateY(-1px)}.dga-look[aria-pressed="true"]{border-color:var(--_ac)}',
    '.dga-big{width:100%;min-height:56px;margin:16px 0 6px;border-radius:18px;font-size:17px}.dga-big svg{width:24px;height:24px}.dga-big svg circle{fill:currentColor}',
    '.dga-hint{margin:6px 0 0;color:var(--_mut);font-size:13px;text-align:center}',
    '.dga-more{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:44px;border-radius:18px;border:2px dashed var(--_line);background:transparent;font-weight:700;font-size:12px;color:var(--_mut)}',
    '.dga-more:hover{color:var(--_ink);border-color:var(--_ac)}.dga-more b{font-size:18px;line-height:1}',
    '.dga-sws .dga-more{width:auto;min-width:44px;height:44px;flex-direction:row;padding:0 12px;border-radius:99px}',
    '.dga-tab[aria-selected="true"]{background:var(--_ac);color:var(--_on);border-color:var(--_ac);box-shadow:0 3px 10px color-mix(in srgb,var(--_ac) 35%,transparent)}',
    '.dga-panel{padding:4px 16px 16px;min-width:0}',
    '.dga-sec{margin:0 0 18px;min-width:0}.dga-sec h3{margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--_mut);font-weight:700;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;overflow-wrap:anywhere}',
    '.dga-sec h3 small{font-size:11px;letter-spacing:0;text-transform:none;font-weight:500}',
    '.dga-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px}',
    '.dga-opt{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:7px 2px 8px;min-height:44px;border-radius:18px;border:2px solid transparent;background:var(--_sf);box-shadow:0 1px 0 var(--_line);transition:transform .15s,border-color .15s}',
    '.dga-opt:hover{transform:translateY(-1px)}.dga-opt:active{transform:scale(.97)}',
    '.dga-opt[aria-pressed="true"]{border-color:var(--_ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--_ac) 22%,transparent)}',
    '.dga-th{position:relative;display:block;width:100%;max-width:64px;aspect-ratio:1/1;height:auto;border-radius:14px;overflow:hidden;background:var(--_sf2)}.dga-th svg{width:100%;height:100%}@supports not (aspect-ratio:1/1){.dga-th{height:64px}}',
    '.dga-opt.is-none .dga-th::after{content:"";position:absolute;inset:0;background:color-mix(in srgb,var(--_sf) 45%,transparent)}',
    '.dga-nobadge{position:absolute;z-index:1;top:50%;left:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;display:grid;place-items:center;background:var(--_sf);color:var(--_mut);box-shadow:0 1px 4px rgba(0,0,0,.18)}.dga-nobadge svg{width:24px;height:24px}',
    '.dga-opt.is-none .dga-nm{font-weight:800;color:var(--_ink)}',
    '.dga-nm{font-size:11px;font-weight:600;letter-spacing:-.1px;text-align:center;line-height:1.15;max-width:100%;overflow-wrap:anywhere}',
    '.dga-opt .dga-lk{position:static;margin-top:-2px}',
    '.dga-opt.is-off{opacity:.4}',
    '.dga-lk{position:absolute;top:5px;right:5px;display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px 0 4px;border-radius:99px;background:var(--_ink);color:var(--_bg);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}',
    '.dga-lk svg{width:11px;height:11px}.dga-lk.own{background:var(--_ac);color:var(--_on);padding:0 4px}',
    '.dga-rar{position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 2px var(--_sf)}',
    '.dga-sws{display:flex;flex-wrap:wrap;gap:10px}',
    '.dga-sw{position:relative;width:44px;height:44px;border-radius:50%;border:0;background:var(--sw);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}',
    '.dga-sw.is-none{background:var(--_sf);color:var(--_mut);display:grid;place-items:center;box-shadow:inset 0 0 0 1.5px var(--_line)}.dga-sw.is-none>svg{width:26px;height:26px}',
    '.dga-sw[aria-pressed="true"]{box-shadow:inset 0 0 0 1px rgba(0,0,0,.12),0 0 0 3px var(--_bg),0 0 0 5.5px var(--_ac)}',
    '.dga-sw .dga-tick{position:absolute;inset:0;display:grid;place-items:center;color:#fff;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}.dga-sw .dga-tick svg{width:18px;height:18px}',
    '.dga-sw.is-none .dga-tick{display:none}',
    '.dga-sw .dga-lk{top:auto;bottom:-6px;right:-8px;height:18px;font-size:10px}',
    '.dga-note{margin:-2px 0 12px;padding:10px 12px;border-radius:14px;background:var(--_sf);border:1px dashed var(--_line);color:var(--_mut);font-size:13px}',
    '.dga-buy{margin:0 16px 10px;padding:10px 12px;border-radius:18px;background:var(--_sf);border:1px solid var(--_line);display:flex;flex-direction:column;gap:8px}',
    '.dga-buy[hidden]{display:none}.dga-buy p{margin:0;font-size:13px;color:var(--_mut)}',
    '.dga-buyrow{display:flex;align-items:center;gap:10px}.dga-buyrow b{flex:1;font-size:14px}',
    '.dga-price{display:inline-flex;align-items:center;gap:4px;font-weight:700;font-variant-numeric:tabular-nums}.dga-price svg,.dga-price img{width:18px;height:18px}',
    '.dga-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:14px;border:1px solid var(--_line);background:var(--_sf);font-weight:700;font-size:15px}',
    '.dga-btn.pri{background:var(--_ac);color:var(--_on);border-color:var(--_ac)}.dga-btn.gold{background:var(--_gold);color:#fff;border-color:var(--_gold)}.dga-dark .dga-btn.gold{color:#231942}',
    '.dga-foot{position:sticky;bottom:0;z-index:2;display:flex;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(to bottom,transparent,var(--_bg) 22%);border-radius:0 0 var(--dga-radius,24px) var(--dga-radius,24px)}',
    '.dga-foot .dga-btn{flex:1}.dga-foot .dga-btn.pri{flex:2}',
    '.dga-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translate(-50%,8px);max-width:calc(100% - 32px);padding:10px 16px;border-radius:14px;background:var(--_ink);color:var(--_bg);font-size:14px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:5;text-align:center}',
    '.dga-toast.on{opacity:1;transform:translate(-50%,0)}',
    '@container dga (min-width:720px){.dga-main{flex-direction:row;align-items:flex-start}.dga-stage{top:calc(var(--dga-sticky-top,0px) + 12px);width:300px;flex:none;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 16px 12px;background:transparent}',
    '.dga-pv{width:220px;height:220px;margin-bottom:6px}.dga-pv::after{content:"";position:absolute;left:18%;right:18%;bottom:-14px;height:10px;border-radius:50%;background:rgba(0,0,0,.14);filter:blur(4px);z-index:-1}',
    '.dga-chips{flex-wrap:wrap;justify-content:center;overflow:visible}.dga-tools{flex-wrap:wrap;justify-content:center}.dga-tl{display:inline}.dga-edit{flex:1}.dga-tabs{padding-top:16px}}',
    '@container dga (max-width:360px){.dga-grid{grid-template-columns:repeat(auto-fill,minmax(64px,1fr))}.dga-stage{grid-template-columns:104px minmax(0,1fr)}.dga-pv{width:104px;height:104px}.dga-tabs{gap:4px;padding-left:10px;padding-right:10px}.dga-tab{font-size:10.5px}}',
    '@media (prefers-reduced-motion:reduce){.dga-root *{animation:none!important;transition:none!important}}'
  ].join('');

  function fmt(n) { return (n | 0).toLocaleString('en-US'); }

  function openBuilder(el, opts) {
    if (!el) throw new Error('DGAvatar.openBuilder: container element required');
    opts = opts || {};
    injectCSS('dga-builder-css', BUILDER_CSS);
    /* owned: Set / array / {id:true} map of bought item ids, or true = everything unlocked */
    var allOwned = opts.owned === true || opts.owned === '*';
    var owned = new Set(!allOwned && opts.owned ? (typeof opts.owned === 'object' && !Array.isArray(opts.owned) && typeof opts.owned.has !== 'function' ? Object.keys(opts.owned).filter(function (k) { return opts.owned[k]; }) : Array.from(opts.owned)) : []);
    var ownArg = function () { return allOwned ? true : owned; };
    var boli = opts.boli | 0;
    var saved = load();
    /* with an owned list, anything paid the player doesn't own is dropped up front so it can never get "stuck" on */
    var src0 = opts.cfg || saved || random();
    var init = opts.owned ? validate(src0, ownArg()) : norm(src0);
    var cfg = norm(init), hist = [], expr = '', io = null, toastT = 0, destroyed = false, more = {};
    var tab = opts.tab || (saved ? 'face' : 'start'); /* new players (nothing saved yet) land on Start */
    var uid = 'dgab' + (++SEQ).toString(36);
    var isOwned = function (it) { return it.free || allOwned || owned.has(it.id); };
    /* Boli icon: pass opts.boliIcon (HTML, e.g. the site's shell image) so prices match the rest of the game */
    var SHELL = opts.boliIcon || (window.DGAvatar && window.DGAvatar.boliIcon) || ICO.shell;
    var boliLabel = function () { return 'Boli: ' + fmt(boli) + '. Open the store'; };
    var boliInner = SHELL + '<span><span class="dga-bn">' + fmt(boli) + '</span>' + (opts.onBoli ? '' : '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)"> Boli</span>') + '</span>';
    var boliHTML = opts.onBoli
      ? '<button type="button" class="dga-boli" data-act="boli" aria-label="' + boliLabel() + '" title="Open the store">' + boliInner + '<span class="dga-bplus" aria-hidden="true">' + ICO.plus + '</span></button>'
      : '<span class="dga-boli" aria-live="polite">' + boliInner + '</span>';

    el.innerHTML =
      '<div class="dga-root' + (opts.theme === 'dark' ? ' dga-dark' : '') + '" role="region" aria-label="Character builder">' +
      '<div class="dga-head"><h2 class="dga-title" id="' + uid + '-t">' + esc(opts.title || 'Your character') + '</h2>' + boliHTML +
      (opts.onClose ? '<button type="button" class="dga-ib" data-act="close" aria-label="Close character builder">' + ICO.close + '</button>' : '') + '</div>' +
      '<div class="dga-main"><div class="dga-stage"><div class="dga-pv" aria-live="off"></div>' +
      '<div class="dga-chips" role="group" aria-label="Preview expression">' + EXPRS.map(function (x) { return '<button type="button" class="dga-chip" data-expr="' + x[0] + '" aria-pressed="' + (x[0] === '' ? 'true' : 'false') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="dga-tools"><button type="button" class="dga-tool" data-act="random" aria-label="Randomize" title="Randomize">' + ICO.dice + '<span class="dga-tl">Randomize</span></button><button type="button" class="dga-tool" data-act="undo" aria-label="Undo" title="Undo" disabled>' + ICO.undo + '<span class="dga-tl">Undo</span></button><button type="button" class="dga-tool" data-act="reset" aria-label="Reset to start" title="Reset">' + ICO.reset + '<span class="dga-tl">Reset</span></button></div></div>' +
      '<div class="dga-edit"><div class="dga-tabs" role="tablist" aria-label="Customize"></div><div class="dga-panel" role="tabpanel" id="' + uid + '-panel"></div></div></div>' +
      '<div class="dga-buy" hidden></div>' +
      '<div class="dga-foot">' + (opts.onClose ? '<button type="button" class="dga-btn" data-act="close">Cancel</button>' : '') + '<button type="button" class="dga-btn pri" data-act="save">Save character</button></div>' +
      '<div class="dga-toast" role="status" aria-live="polite"></div></div>';

    var R = el.querySelector('.dga-root'), pv = R.querySelector('.dga-pv'), panel = R.querySelector('.dga-panel'), buyEl = R.querySelector('.dga-buy');
    var undoBtn = R.querySelector('[data-act="undo"]'), toastEl = R.querySelector('.dga-toast'), tabsEl = R.querySelector('.dga-tabs'), saveBtn = R.querySelector('[data-act="save"]');

    function tabsNow() { return TABS.filter(function (t) { return !(t.id === 'facial' && cfg.body === 'f'); }); }
    function drawTabs() {
      var T = tabsNow(); if (!T.some(function (t) { return t.id === tab; })) tab = 'face';
      tabsEl.innerHTML = T.map(function (t) {
        var on = t.id === tab;
        return '<button type="button" role="tab" class="dga-tab" id="' + uid + '-tab-' + t.id + '" data-tab="' + t.id + '" aria-controls="' + uid + '-panel" aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '" title="' + t.name + '">' + t.icon + '<span>' + t.name + '</span></button>';
      }).join('');
    }
    function setBoliText() {
      R.querySelector('.dga-bn').textContent = fmt(boli);
      var bb = R.querySelector('button.dga-boli'); if (bb) bb.setAttribute('aria-label', boliLabel());
    }
    function toast(m) { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2600); }
    function drawPreview(pop) {
      pv.innerHTML = render(cfg, { size: 220, animate: true, expression: expr || null, title: 'Your character preview' });
      if (pop) { pv.classList.remove('dga-pop'); void pv.offsetWidth; pv.classList.add('dga-pop'); }
    }
    function thumbCfg(cat, key) {
      var c = Object.assign({}, cfg); c[cat] = key;
      
      if (cat === 'hatColor' && (c.hat === 'none' || !HAT_TINTED[c.hat])) c.hat = 'cap';
      if (cat === 'hair') c.hat = 'none';
      if (cat === 'earrings' && COVER[c.hair]) c.hair = 'bun';
      if (cat === 'earrings' && /^(long|fringelong|curtain|sideswept|wavy|bob|sleekbob|braids|halfup)$/.test(c.hair)) c.hair = 'ponytail';
      if (cat === 'earrings' && c.hat === 'headphones') c.hat = 'none';
      if (cat === 'neck' && c.hair === 'hijab') c.hair = 'bun';
      if (cat === 'neck' && /^(beard|longbeard)$/.test(c.facial)) c.facial = 'none';
      if (cat === 'glassesColor' && c.glasses === 'none') c.glasses = 'round';
      if (cat === 'scarfColor' && !COVER[c.hair]) c.hair = 'hijab';
      if (cat === 'face' && COVER[c.hair]) { c.hair = 'bald'; c.hat = 'none'; }
      if (/^(eyes|eyeColor|lashes|brows|marks|paint|cheeks|nose)$/.test(cat)) c.glasses = 'none';
      if (cat === 'lashes' && c.eyes === 'dot') c.eyes = 'round';
      if (cat === 'facial') c.body = 'm';
      return c;
    }
    function swStyle(it) {
      var v = it.value;
      if (!v) return '';
      if (Array.isArray(v)) return 'background:linear-gradient(160deg,' + v[0] + ',' + v[1] + ')';
      if (typeof v === 'object') return 'background:' + v.css;
      return '--sw:' + v;
    }
    function lockBadge(it) { return isOwned(it) ? '' : '<span class="dga-lk">' + ICO.lock + fmt(it.price) + '</span>'; }
    function ordered(cat) {
      if (cat !== 'hair') return PARTS[cat];
      var first = cfg.body === 'f' ? FEM_HAIR : MALE_HAIR, map = {};
      PARTS.hair.forEach(function (i) { map[i.key] = i; });
      var out = first.map(function (k) { return map[k]; }).filter(Boolean);
      PARTS.hair.forEach(function (i) { if (out.indexOf(i) < 0) out.push(i); });
      return out;
    }
    var SHOW = 8;
    function visible(cat) {
      var list = ordered(cat);
      if (more[cat] || list.length <= SHOW + 1) return { list: list, hidden: 0 };
      var v = list.slice(0, SHOW), sel = list.filter(function (i) { return i.key === cfg[cat]; })[0];
      if (sel && v.indexOf(sel) < 0) v[SHOW - 1] = sel;
      return { list: v, hidden: list.length - v.length };
    }
    function moreBtn(cat, n, sw) {
      if (!n && !more[cat]) return '';
      var open = !!more[cat];
      return '<button type="button" class="dga-more" data-more="' + cat + '" aria-expanded="' + open + '">' + (sw ? '' : '<b aria-hidden="true">' + (open ? '&minus;' : '+') + '</b>') + (open ? 'Fewer' : 'More (' + n + ')') + '</button>';
    }
    function secHTML(sec) {
      var cat = sec[0], kind = sec[1], crop = sec[2];
      if ((cat === 'scarfColor' || cat === 'hatColor' || cat === 'glassesColor' || cat === 'lens') && !relevant(cfg, cat)) return '';
      var head = CAT_NAMES[cat], note = '', what = cfg.hair === 'hijab' ? 'hijab' : 'headscarf';
      if (cat === 'hairColor' && COVER[cfg.hair]) head = 'Hair colour <small>(fringe &amp; brows)</small>';
      if (cat === 'facial') note = '<p class="dga-note">Facial hair uses your hair colour.</p>';
      if (cat === 'hat' && COVER[cfg.hair]) note = '<p class="dga-note">Hats sit on top of your ' + what + '.</p>';
      if (cat === 'earrings' && COVER[cfg.hair]) note = '<p class="dga-note">Earrings are hidden under a ' + what + '.</p>';
      if (cat === 'neck' && cfg.hair === 'hijab') note = '<p class="dga-note">Necklaces are hidden under a hijab.</p>';
      var vis = visible(cat), h = '<section class="dga-sec" aria-label="' + esc(CAT_NAMES[cat]) + '"><h3>' + head + '</h3>' + note;
      if (kind === 'sw') {
        h += '<div class="dga-sws">' + vis.list.map(function (it) {
          var on = cfg[cat] === it.key, lk = !isOwned(it), none = it.key === 'none';
          return '<button type="button" class="dga-sw' + (none ? ' is-none' : '') + '" style="' + swStyle(it) + '" data-cat="' + cat + '" data-key="' + it.key + '" aria-pressed="' + on + '" aria-label="' + esc(it.name + (lk ? ', locked, ' + it.price + ' Boli, ' + it.rarity : '')) + '" title="' + esc(it.name) + '">' +
            (none ? ICO.none : '') + (on ? '<span class="dga-tick">' + ICO.check + '</span>' : '') + lockBadge(it) + '</button>';
        }).join('') + moreBtn(cat, vis.hidden, true) + '</div>';
      } else {
        h += '<div class="dga-grid">' + vis.list.map(function (it) {
          var on = cfg[cat] === it.key, lk = !isOwned(it), off = conflict(cfg, cat, it.key), none = it.key === 'none';
          return '<button type="button" class="dga-opt' + (off ? ' is-off' : '') + (none ? ' is-none' : '') + '" data-cat="' + cat + '" data-key="' + it.key + '" aria-pressed="' + on + '"' + (off ? ' aria-disabled="true"' : '') +
            ' aria-label="' + esc(it.name + (lk ? ', locked, ' + it.price + ' Boli, ' + it.rarity : '') + (off ? ', unavailable' : '')) + '">' +
            (it.rarity !== 'common' ? '<i class="dga-rar" style="background:' + RARITY_COL[it.rarity] + '" aria-hidden="true"></i>' : '') +
            '<span class="dga-th" data-crop="' + crop + '">' + (none ? '<span class="dga-nobadge">' + ICO.none + '</span>' : '') + '</span><span class="dga-nm">' + esc(it.name) + '</span>' + lockBadge(it) + '</button>';
        }).join('') + moreBtn(cat, vis.hidden) + '</div>';
      }
      return h + '</section>';
    }
    function startHTML() {
      var f = cfg.body === 'f';
      var looks = LOOKS.filter(function (l) { return l.cfg.body === cfg.body; }).concat(LOOKS.filter(function (l) { return l.cfg.body !== cfg.body; }));
      return '<section class="dga-sec" aria-label="Body"><h3>I am</h3><div class="dga-seg" role="group" aria-label="Body">' +
        '<button type="button" class="dga-segb" data-body="f" aria-pressed="' + f + '">Female</button><button type="button" class="dga-segb" data-body="m" aria-pressed="' + !f + '">Male</button></div></section>' +
        '<section class="dga-sec" aria-label="Pick a look"><h3>Pick a look</h3><div class="dga-looks">' + looks.map(function (l) {
          var on = JSON.stringify(l.cfg) === JSON.stringify(norm(cfg));
          return '<button type="button" class="dga-look" data-look="' + LOOKS.indexOf(l) + '" aria-pressed="' + on + '" aria-label="Use ' + l.name + '">' + render(l.cfg, { size: 72 }) + '<span>' + l.name + '</span></button>';
        }).join('') + '</div>' +
        '<button type="button" class="dga-btn pri dga-big" data-act="random">' + ICO.dice + 'Surprise me</button>' +
        '<p class="dga-hint">Then tap Face, Hair, Outfit and the rest to make it yours.</p></section>';
    }
    function fillThumb(th) {
      var b = th.parentNode, badge = th.querySelector('.dga-nobadge');
      th.innerHTML = render(thumbCfg(b.getAttribute('data-cat'), b.getAttribute('data-key')), { size: 64, crop: th.getAttribute('data-crop') }) + (badge ? badge.outerHTML : '');
      th.setAttribute('data-done', '1');
    }
    /* The builder never scrolls itself: the page / sheet that hosts it does. So every scrollable
       ancestor's position is kept across a redraw (picking an item must never jump the list). */
    function scrollSnap() {
      var out = [], n = el;
      while (n && n.nodeType === 1) { if (n.scrollHeight > n.clientHeight) out.push([n, n.scrollTop]); n = n.parentElement; }
      var se = document.scrollingElement || document.documentElement;
      if (se) out.push([se, se.scrollTop]);
      return out;
    }
    function scrollBack(s) { s.forEach(function (p) { if (Math.abs(p[0].scrollTop - p[1]) > 0.5) p[0].scrollTop = p[1]; }); }
    function bkey(b) { return ['data-tab', 'data-cat', 'data-key', 'data-look', 'data-body', 'data-more', 'data-act'].map(function (a) { return b.getAttribute(a) || ''; }).join('|'); }
    function skel(node) {
      var c = node.cloneNode(true);
      Array.prototype.forEach.call(c.querySelectorAll('button'), function (b) { var k = document.createElement('i'); k.textContent = bkey(b); b.parentNode.replaceChild(k, b); });
      return c.innerHTML;
    }
    function syncAttrs(a, b) {
      var i;
      for (i = a.attributes.length - 1; i >= 0; i--) { var nm = a.attributes[i].name; if (!b.hasAttribute(nm)) a.removeAttribute(nm); }
      for (i = 0; i < b.attributes.length; i++) { var at = b.attributes[i]; if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); }
    }
    /* same buttons in the same places: update them in place (selected state, locks, thumbnails)
       instead of rebuilding the panel, so focus, scroll and the thumbnails already drawn all stay */
    function morph(tmp) {
      if (!panel.firstChild || skel(panel) !== skel(tmp)) return false;
      var ob = panel.querySelectorAll('button'), nb = tmp.querySelectorAll('button');
      if (ob.length !== nb.length) return false;
      for (var i = 0; i < ob.length; i++) {
        var a = ob[i], b = nb[i], th = a.querySelector('.dga-th'), nth = b.querySelector('.dga-th');
        syncAttrs(a, b);
        if (th && nth) {
          var kids = Array.prototype.slice.call(b.childNodes);
          kids[kids.indexOf(nth)] = th;
          while (a.firstChild) a.removeChild(a.firstChild);
          kids.forEach(function (k) { a.appendChild(k); });
          if (th.getAttribute('data-done')) fillThumb(th); /* thumbnails show your current look, so redraw the ones on screen */
        } else if (a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML;
      }
      return true;
    }
    function drawPanel(keepFocus) {
      var t = TABS.filter(function (x) { return x.id === tab; })[0];
      var ae = document.activeElement, fk = keepFocus && ae && panel.contains(ae) ? ae.getAttribute('data-cat') + ':' + ae.getAttribute('data-key') : null;
      var snap = scrollSnap(), tmp = document.createElement('div');
      tmp.innerHTML = tab === 'start' ? startHTML() : t.secs.map(secHTML).join('');
      panel.setAttribute('aria-labelledby', uid + '-tab-' + tab);
      if (morph(tmp)) { scrollBack(snap); return; }
      /* full redraw (new tab, More / Fewer, a section appearing): hold the height until it is refilled */
      var h = panel.offsetHeight;
      if (h) panel.style.minHeight = h + 'px';
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      while (tmp.firstChild) panel.appendChild(tmp.firstChild);
      var ths = panel.querySelectorAll('.dga-th');
      if (io) io.disconnect();
      if ('IntersectionObserver' in root) {
        io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); fillThumb(en.target); } }); }, { rootMargin: '120px' });
        Array.prototype.forEach.call(ths, function (th) { io.observe(th); });
      } else Array.prototype.forEach.call(ths, fillThumb);
      if (fk) { var n = panel.querySelector('[data-cat="' + fk.split(':')[0] + '"][data-key="' + fk.split(':')[1] + '"]'); if (n) n.focus({ preventScroll: true }); }
      scrollBack(snap);
      var rel = function () { if (!destroyed) panel.style.minHeight = ''; };
      if (root.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(rel); }); else setTimeout(rel, 32);
    }
    function drawBuy() {
      var L = lockedIn(cfg, ownArg());
      saveBtn.textContent = L.length ? 'Save without locked items' : 'Save character';
      if (!L.length) { buyEl.hidden = true; buyEl.innerHTML = ''; return; }
      buyEl.hidden = false;
      buyEl.innerHTML = '<p>You are trying on ' + (L.length > 1 ? 'locked items' : 'a locked item') + '. Unlock ' + (L.length > 1 ? 'them' : 'it') + ' to keep ' + (L.length > 1 ? 'them' : 'it') + ', or Save puts back a free choice.</p>' + L.map(function (it) {
        return '<div class="dga-buyrow"><b>' + esc(it.name) + ' <small style="color:' + RARITY_COL[it.rarity] + ';font-weight:700;text-transform:capitalize">' + it.rarity + '</small></b>' +
          '<span class="dga-price">' + SHELL + fmt(it.price) + '</span><button type="button" class="dga-btn gold" data-act="buy" data-item="' + it.id + '" aria-label="Unlock ' + esc(it.name) + ' for ' + it.price + ' Boli">Unlock</button></div>';
      }).join('');
    }
    function syncUndo() { undoBtn.disabled = !hist.length; }
    function refresh(pop) { drawPreview(pop); drawTabs(); drawPanel(true); drawBuy(); syncUndo(); }
    function setCfg(n, pop) { hist.push(cfg); if (hist.length > 60) hist.shift(); cfg = norm(n); refresh(pop !== false); }
    function choose(cat, key) {
      var it = item(cat, key); if (!it) return;
      var off = conflict(cfg, cat, key); if (off) { toast(off); return; }
      if (cfg[cat] === key) return;
      var n = Object.assign({}, cfg); n[cat] = key;
      /* picking a hat that doesn't fit over a hijab / headscarf: nothing to do - it's disabled with a note */
      setCfg(n);
      if (!isOwned(it)) toast('Trying on ' + it.name + '. Unlock it to keep it.');
    }
    function setBody(b) {
      if (cfg.body === b) return;
      var n = Object.assign({}, cfg); n.body = b;
      if (b === 'f') {
        n.facial = 'none';
        if (FEM_HAIR.indexOf(n.hair) < 0 && MALE_HAIR.indexOf(n.hair) >= 0) n.hair = 'fringelong';
        if (n.lashes === 'none') n.lashes = 'subtle';
        if (/^(bushy|thick|unibrow)$/.test(n.brows)) n.brows = 'arched';
        if (/^(wide|clown)$/.test(n.nose)) n.nose = 'small';
      } else {
        if (MALE_HAIR.indexOf(n.hair) < 0 && FEM_HAIR.indexOf(n.hair) >= 0) n.hair = 'short';
        n.lashes = 'none'; n.lips = 'none';
        if (n.outfit === 'libaas') n.outfit = 'tee';
      }
      setCfg(n);
    }
    function selectTab(id, focus) {
      tab = id; drawTabs();
      if (focus) { var b = tabsEl.querySelector('[data-tab="' + id + '"]'); if (b) b.focus(); }
      panel.scrollTop = 0; drawPanel(false);
    }
    function buy(id) {
      var it = BYID[id]; if (!it) return;
      if (!opts.onBuy) { toast('The store is coming soon.'); return; }
      Promise.resolve(opts.onBuy(it)).then(function (ok) {
        if (destroyed) return;
        if (ok) { owned.add(it.id); if (!opts.boliManaged) { boli = Math.max(0, boli - it.price); setBoliText(); } toast(it.name + ' unlocked!'); refresh(false); }
        else toast(boli < it.price ? 'Not enough Boli yet. Win a few games!' : 'Purchase cancelled.');
      }, function () { toast('Purchase failed. Try again.'); });
    }
    function doSave() {
      var L = lockedIn(cfg, ownArg()), v = validate(cfg, ownArg());
      cfg = v; save(v); refresh(false);
      toast(L.length ? 'Saved. ' + L.map(function (i) { return i.name; }).join(', ') + (L.length > 1 ? ' are' : ' is') + ' locked, so a free choice was used.' : 'Character saved!');
      if (opts.onSave) opts.onSave(v);
    }

    R.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || !R.contains(b)) return;
      if (b.hasAttribute('data-tab')) return selectTab(b.getAttribute('data-tab'));
      if (b.hasAttribute('data-cat')) return choose(b.getAttribute('data-cat'), b.getAttribute('data-key'));
      if (b.hasAttribute('data-more')) { var mc = b.getAttribute('data-more'); more[mc] = !more[mc]; drawPanel(false); var nb = panel.querySelector('[data-more="' + mc + '"]'); if (nb) nb.focus({ preventScroll: true }); return; }
      if (b.hasAttribute('data-body')) return setBody(b.getAttribute('data-body'));
      if (b.hasAttribute('data-look')) { var l = LOOKS[+b.getAttribute('data-look')]; if (l) setCfg(l.cfg); return; }
      if (b.hasAttribute('data-expr')) {
        expr = b.getAttribute('data-expr');
        Array.prototype.forEach.call(R.querySelectorAll('[data-expr]'), function (x) { x.setAttribute('aria-pressed', x === b); });
        return drawPreview(true);
      }
      var a = b.getAttribute('data-act');
      if (a === 'random') { setCfg(random(null, { body: cfg.body })); }
      else if (a === 'undo') { if (hist.length) { cfg = hist.pop(); refresh(true); } }
      else if (a === 'reset') { if (JSON.stringify(cfg) !== JSON.stringify(init)) setCfg(init); }
      else if (a === 'save') doSave();
      else if (a === 'buy') buy(b.getAttribute('data-item'));
      else if (a === 'boli' && opts.onBoli) opts.onBoli();
      else if (a === 'close' && opts.onClose) opts.onClose();
    });
    tabsEl.addEventListener('keydown', function (ev) {
      var T = tabsNow(), n = T.length, i = T.findIndex(function (t) { return t.id === tab; }), j = i;
      var cols = getComputedStyle(tabsEl).gridTemplateColumns.split(' ').length || 6;
      if (ev.key === 'ArrowRight') j = (i + 1) % n; else if (ev.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (ev.key === 'ArrowDown') j = Math.min(n - 1, i + cols); else if (ev.key === 'ArrowUp') j = Math.max(0, i - cols);
      else if (ev.key === 'Home') j = 0; else if (ev.key === 'End') j = n - 1; else return;
      ev.preventDefault(); selectTab(T[j].id, true);
    });
    R.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && opts.onClose) opts.onClose(); if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && hist.length) { ev.preventDefault(); cfg = hist.pop(); refresh(true); } });

    refresh(false);
    return {
      getConfig: function () { return norm(cfg); },
      setConfig: function (c) { setCfg(c); },
      setBoli: function (n) { boli = n | 0; setBoliText(); },
      setOwned: function (s) { allOwned = s === true || s === '*'; owned = new Set(allOwned ? [] : Array.from(s || [])); refresh(false); },
      destroy: function () { destroyed = true; if (io) io.disconnect(); clearTimeout(toastT); el.innerHTML = ''; }
    };
  }

  root.DGAvatar = {
    version: 3,
    storageKey: KEY,
    catalog: catalog,
    parts: PARTS,
    categories: CAT_NAMES,
    defaults: norm(DEFAULTS),
    presets: PRESETS,
    looks: LOOKS,
    expressions: ['happy', 'laugh', 'wink', 'shocked', 'smug', 'thinking', 'sad', 'angry', 'sleepy', 'blink'],
    react: react,
    item: function (id) { return BYID[id] || (id === 'bg.night' ? BYID['bg.stars'] : null); },
    normalize: norm,
    render: render,
    dataURI: dataURI,
    random: random,
    load: load,
    save: save,
    validate: validate,
    lockedItems: lockedIn,
    conflict: conflict,
    openBuilder: openBuilder
  };
})(typeof window !== 'undefined' ? window : this);
