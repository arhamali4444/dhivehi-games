/* Dhivehi Games - shared character avatars v4 "Soft realism" (window.DGAvatar)
   Dependency-free, no modules. Include with <script src="/shared/avatar.js"></script>.
   Art: painterly soft-realism bust - glowing skin, eyes with catchlights, hair built from layered locks with sheen,
   real shoulders and arms with layered garments, elegant hijab wraps. A thin rim light is added at seat size.

   QUICK API (unchanged from v3; every v3 saved character still loads and keeps its look)
   DGAvatar.render(cfg, {size, expression, animate, ring, title, crop, bust, bg}) -> SVG string
     size <= 48: a light <svg> wrapper around one cached image (cheap for seats and lists).
     animate:true (bigger sizes) = idle life: blink, breathing, glances, a rare small smile (off with reduced motion)
     expression = 'happy' | 'laugh' | 'wink' | 'shocked' | 'smug' | 'thinking' | 'sad' | 'angry' | 'sleepy' | 'blink'
   DGAvatar.react(el, expression, ms = 1600)
     Briefly switches an avatar already on the page to an expression with a springy pop, then returns to idle.
   DGAvatar.random(seed?, {body:'f'|'m'}?)  DGAvatar.load(owned?)  DGAvatar.save(cfg)  DGAvatar.validate(cfg, owned)
   DGAvatar.openBuilder(el, {cfg, owned, boli, onSave, onBuy, onBoli, onClose, theme, boliIcon, boliManaged, tab, title})
     3 easy steps: 1) Female / Male + skin tone  2) pick one of 12 looks  3) optional "Make it yours" (Hair, Hair colour, Eyes, Outfit, Accessories, More).
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
  // Every v3 id is kept (saved characters and bought items stay valid). Prices are kept as data; the games decide whether to charge.
  var SPEC = {
    body: [['f', 'Female'], ['m', 'Male']],
    skin: [['porcelain', 'Porcelain', '#F3D8C4'], ['light', 'Light', '#EBC4A2'], ['fair', 'Fair', '#DEAB82'], ['golden', 'Golden', '#CB9669'],
      ['tan', 'Tan', '#B47E53'], ['brown', 'Brown', '#935F3C'], ['deep', 'Deep', '#73462B'], ['ebony', 'Ebony', '#55311F']],
    face: [['round', 'Round'], ['oval', 'Oval'], ['square', 'Square'], ['heart', 'Heart'], ['full', 'Full']],
    nose: [['button', 'Button'], ['round', 'Round'], ['pointy', 'Pointed'], ['wide', 'Wide'], ['small', 'Tiny'], ['clown', 'Clown', 0, 100, 'rare']],
    cheeks: [['soft', 'Soft blush'], ['none', 'No blush'], ['rosy', 'Rosy']],
    marks: [['none', 'Clear skin'], ['freckles', 'Freckles'], ['mole', 'Beauty mark'], ['both', 'Both'], ['glitter', 'Glitter', 0, 150, 'rare']],
    eyes: [['almond', 'Almond'], ['round', 'Round'], ['wide', 'Sparkly'], ['sleepy', 'Sleepy'], ['dot', 'Button'], ['lashes', 'Lashes'], ['starry', 'Starry', 0, 300, 'epic']],
    eyeColor: [['darkbrown', 'Dark brown', '#3B2416'], ['brown', 'Brown', '#71472A'], ['black', 'Black', '#1C1618'], ['hazel', 'Hazel', '#8F6C2E'], ['honey', 'Honey', '#B5832E'],
      ['green', 'Green', '#3E8E5A'], ['teal', 'Teal', '#1F8C8C'], ['blue', 'Blue', '#3F7FC7'], ['grey', 'Grey', '#7D8A96'], ['amber', 'Amber', '#C08A2A'],
      ['violet', 'Violet', '#8A55E0', 120, 'rare'], ['ice', 'Ice blue', '#8FD3F2', 120, 'rare'], ['gold', 'Gold', '#E6B63A', 300, 'epic']],
    lashes: [['none', 'Natural'], ['subtle', 'Subtle'], ['full', 'Full'], ['dramatic', 'Dramatic', 0, 120, 'rare']],
    brows: [['soft', 'Soft'], ['arched', 'Arched'], ['straight', 'Straight'], ['thick', 'Thick'], ['thin', 'Thin'], ['bushy', 'Bushy'], ['angry', 'Stern'], ['raised', 'Raised'], ['unibrow', 'Unibrow', 0, 80, 'rare']],
    mouth: [['smile', 'Smile'], ['grin', 'Grin'], ['neutral', 'Neutral'], ['smirk', 'Smirk'], ['open', 'Open smile'], ['pout', 'Pout'], ['tongue', 'Cheeky'], ['gap', 'Gap tooth', 0, 100, 'rare']],
    lips: [['none', 'Natural'], ['rose', 'Rose', '#D9667A'], ['red', 'Red', '#C7283A'], ['coral', 'Coral', '#F0736A'], ['nude', 'Nude', '#B9786A'],
      ['berry', 'Berry', '#8E2A4E', 100, 'rare'], ['plum', 'Plum', '#6A2A55', 100, 'rare'], ['goldgloss', 'Gold gloss', '#D9AA3A', 300, 'epic']],
    hair: [['waves', 'Long waves'], ['sleek', 'Sleek straight'], ['curtain', 'Curtain bangs'], ['sidefringe', 'Side fringe'], ['ponytail', 'High ponytail'], ['lowbun', 'Low side bun'],
      ['topbun', 'Top bun'], ['braids', 'Twin braids'], ['afro', 'Curly afro'], ['bob', 'Chin bob'], ['pixie', 'Pixie'], ['halfup', 'Half-up'],
      ['hijab', 'Classic hijab'], ['shayla', 'Shayla drape'], ['khimar', 'Khimar cape'], ['turban', 'Turban wrap'],
      ['fade', 'Skin fade'], ['crop', 'Textured crop'], ['quiff', 'Quiff'], ['slick', 'Slick back'], ['curlytop', 'Curly top'], ['manbun', 'Man bun'], ['buzz', 'Buzz cut'],
      ['sidepart', 'Side part'], ['wavy', 'Wavy medium'], ['dreads', 'Locs'], ['mohawk', 'Mohawk', 0, 200, 'rare'], ['messy', 'Messy fringe'], ['cornrows', 'Cornrows'], ['bald', 'Bald'],
      /* v3 styles (still valid, drawn with the nearest v4 style) */
      ['short', 'Short crop'], ['undercut', 'Undercut'], ['tufts', 'Kid spiky'], ['spiky', 'Spiky'], ['curly', 'Curly'], ['long', 'Long straight'], ['fringelong', 'Long with fringe'],
      ['sideswept', 'Side-swept bangs'], ['sleekbob', 'Sleek bob'], ['fringepony', 'Fringe ponytail'], ['bun', 'Bun'], ['highbun', 'High bun & fringe'], ['headscarf', 'Headscarf']],
    hairColor: [['black', 'Black', '#1E1B24'], ['darkbrown', 'Dark brown', '#3A2519'], ['brown', 'Brown', '#6A4128'], ['chestnut', 'Chestnut', '#7A3A1F'], ['auburn', 'Auburn', '#8C3A22'],
      ['caramel', 'Caramel', '#A26B39'], ['honey', 'Honey blonde', '#C79352'], ['ginger', 'Ginger', '#C8642E'], ['blonde', 'Blonde', '#E2B75E'], ['grey', 'Grey', '#A7A4AE'], ['white', 'Snow', '#ECE7DF'],
      ['burgundy', 'Burgundy', '#5A1D2B'],
      ['pink', 'Bubblegum', '#FF7FB0', 150, 'rare'], ['blue', 'Ocean blue', '#4C86F0', 150, 'rare'], ['mint', 'Lagoon mint', '#36CFAE', 150, 'rare'], ['purple', 'Ube', '#8D5CF0', 150, 'rare'],
      ['fire', 'Fire red', '#E0362F', 150, 'rare'], ['lagoon', 'Lagoon tips', ['#1D2438', '#3BB3C2'], 150, 'rare'], ['ombre', 'Ombre', ['#3A2519', '#E7BD68'], 250, 'epic'], ['sunset', 'Sunset', ['#FF6FA8', '#FFB347'], 400, 'epic']],
    facial: [['none', 'Clean-shaven'], ['stubble', 'Stubble'], ['mo', 'Moustache'], ['pencil', 'Thin moustache'], ['chevron', 'Chevron moustache'], ['handlebar', 'Handlebar', 0, 120, 'rare'], ['goatee', 'Goatee'],
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
      ['pilot', 'Pilot cap', 0, 200, 'rare'], ['divemask', 'Dive mask', 0, 150, 'rare'], ['tiara', 'Tiara', 0, 300, 'epic'], ['spacehelmet', 'Space helmet', 0, 350, 'epic'],
      ['halo', 'Halo', 0, 350, 'epic'], ['captain', 'Captain hat', 0, 450, 'epic'], ['crown', 'Crown', 0, 1200, 'legendary']],
    mask: [['none', 'No mask'], ['patchL', 'Eye patch (L)'], ['patchR', 'Eye patch (R)'], ['medblue', 'Medical mask'], ['medwhite', 'White mask'], ['medblack', 'Black mask'],
      ['clothdots', 'Dotty mask'], ['clothmv', 'Red & green mask'], ['bandana', 'Bandana'], ['bandaid', 'Band-aid'],
      ['domino', 'Hero mask', 0, 150, 'rare'], ['clown', 'Clown face', 0, 150, 'rare'], ['masquerade', 'Masquerade', 0, 350, 'epic']],
    hatColor: [['red', 'Red', '#E5484D'], ['navy', 'Navy', '#26336B'], ['emerald', 'Emerald', '#1E7A55'], ['yellow', 'Yellow', '#F2B33D'],
      ['black', 'Black', '#26252D'], ['white', 'White', '#F1ECE2'], ['pink', 'Pink', '#F07BA8'], ['sky', 'Sky', '#4FA3E0'], ['brown', 'Brown', '#8A5A33'], ['tan', 'Tan', '#C9A46A'],
      ['gold', 'Gold', '#D9AA3A', 150, 'rare']],
    outfit: [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['polo', 'Polo shirt'], ['shirt', 'Shirt & tie'], ['school', 'School uniform'], ['kurta', 'Kurta'], ['libaas', 'Libaas dress'],
      ['feyli', 'Feyli sarong & shirt'], ['fishshirt', "Fisherman's shirt"], ['jersey', 'Football jersey'], ['mvjersey', 'Maldives jersey'], ['police', 'Police uniform'],
      ['trench', 'Detective', 0, 450, 'epic'], ['suit', 'Suit & tie', 0, 250, 'rare'],
      ['blouse', 'Button blouse'], ['tank', 'Tank top'], ['offsh', 'Off-shoulder top'], ['sundress', 'Strappy sundress'], ['wrap', 'Wrap dress'], ['maxi', 'Tiered maxi dress'],
      ['puff', 'Puff-sleeve blouse'], ['crophood', 'Crop hoodie'], ['blazer', 'Blazer'], ['abaya', 'Abaya'], ['sequin', 'Sequin party top', 0, 150, 'rare'], ['fjersey', 'Sports jersey'],
      ['fdenim', 'Denim jacket'], ['kaftan', 'Beach kaftan'], ['cardigan', 'Cardigan'], ['fgrad', 'Graduation gown'],
      ['mtank', 'Tank top'], ['hawaii', 'Resort shirt'], ['mlinen', 'Linen shirt'], ['bomber', 'Bomber jacket'], ['leather', 'Leather jacket'], ['tux', 'Tuxedo', 0, 250, 'rare'],
      ['mdenim', 'Denim jacket'], ['track', 'Tracksuit'], ['mgrad', 'Graduation gown'], ['athletic', 'Sleeveless athletic'],
      ['boduberu', 'Boduberu performer'], ['pirate', 'Pirate', 0, 300, 'epic'], ['chef', 'Chef', 0, 200, 'rare'], ['pilot', 'Pilot', 0, 200, 'rare'], ['astro', 'Astronaut', 0, 400, 'epic'],
      ['hero', 'Superhero', 0, 400, 'epic'], ['diver', 'Diver', 0, 200, 'rare'], ['royal', 'Royal robe', 0, 1200, 'legendary']],
    outfitColor: [['auto', 'Original', { p: 'auto', base: '#E0715F', css: 'conic-gradient(#E0715F,#F2B33D,#2FB67C,#2F7FD1,#8C6FD6,#E0715F)' }],
      ['coral', 'Coral', '#F0645A'], ['ocean', 'Ocean', '#2F7FD1'], ['emerald', 'Emerald', '#1E8A5E'], ['sunshine', 'Sunshine', '#F4B63F'],
      ['violet', 'Violet', '#7B4FD6'], ['navy', 'Navy', '#253766'], ['white', 'White', '#F3EFE7'], ['black', 'Black', '#2A2A33'],
      ['maroon', 'Maroon', '#8E2F45'], ['pink', 'Pink', '#F28DB5'], ['teal', 'Teal', '#179C93'], ['sand', 'Sand', '#D8C3A0'],
      ['neon', 'Neon lime', '#A6E22E', 150, 'rare'], ['gold', 'Gold', '#D9AA3A', 300, 'epic']],
    scarfColor: [['rose', 'Rose', '#C57483'], ['mauve', 'Mauve', '#9A7187'], ['sand', 'Sand', '#D6BF9F'], ['cream', 'Cream', '#EADCC2'], ['teal', 'Teal', '#0F8C7E'], ['navy', 'Navy', '#27386A'], ['black', 'Black', '#25232B'],
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
  /* CATS order is part of the data-dga attribute that react() reads back - same categories and order as v3 */
  var DEFAULTS = { v: 4, body: 'm', skin: 'golden', face: 'round', nose: 'button', cheeks: 'soft', marks: 'none', eyes: 'round', eyeColor: 'darkbrown', lashes: 'none', brows: 'soft',
    mouth: 'smile', lips: 'none', hair: 'short', hairColor: 'black', facial: 'none', glasses: 'none', glassesColor: 'black', lens: 'dark', hat: 'none', hatColor: 'red',
    outfit: 'tee', outfitColor: 'ocean', scarfColor: 'rose', neck: 'none', paint: 'none', earrings: 'none', bg: 'sky', mask: 'none' };
  var COVER = { headscarf: 1, hijab: 1, shayla: 1, khimar: 1, turban: 1 }, NECKCOVER = { hijab: 1, shayla: 1, khimar: 1 };
  var HAT_TINTED = { cap: 1, capback: 1, beanie: 1, bucket: 1, fisher: 1, headband: 1, headphones: 1, cowboy: 1, party: 1, kulhi: 1, helmet: 1, tophat: 1 };
  var LENS_GLASSES = { sunglasses: 1, aviator: 1, sporty: 1, heart: 1 };
  function item(cat, key) { return BYID[cat + '.' + key] || null; }
  function val(cat, key) { var i = item(cat, key); return i ? i.value : item(cat, DEFAULTS[cat]).value; }

  /* v3 keys that v4 draws with a new style. They stay valid (old saves keep working) but the builder no longer lists them. */
  var LEGACY_HAIR = { short: 1, undercut: 1, tufts: 1, spiky: 1, curly: 1, long: 1, fringelong: 1, sideswept: 1, sleekbob: 1, fringepony: 1, bun: 1, highbun: 1, headscarf: 1 };
  PARTS.hair.forEach(function (it) { if (LEGACY_HAIR[it.key]) it.legacy = true; });
  var F_KEYS = ['waves', 'sleek', 'curtain', 'sidefringe', 'ponytail', 'lowbun', 'topbun', 'braids', 'afro', 'bob', 'pixie', 'halfup', 'hijab', 'shayla', 'khimar', 'turban'];
  var M_KEYS = ['fade', 'crop', 'quiff', 'slick', 'curlytop', 'manbun', 'buzz', 'sidepart', 'wavy', 'dreads', 'mohawk', 'messy', 'cornrows', 'bald'];
  var FEM_HAIR = F_KEYS, MALE_HAIR = M_KEYS;
  var FEM_HINT = /^(waves|sleek|curtain|sidefringe|ponytail|lowbun|topbun|braids|bob|pixie|halfup|hijab|shayla|khimar|turban|long|fringelong|sideswept|wavy|sleekbob|fringepony|bun|highbun|headscarf)$/;
  var OUT_F = ['tank', 'offsh', 'sundress', 'wrap', 'maxi', 'puff', 'crophood', 'blazer', 'abaya', 'libaas', 'sequin', 'fjersey', 'fdenim', 'kaftan', 'cardigan', 'fgrad'];
  var OUT_M = ['mtank', 'polo', 'hawaii', 'mlinen', 'suit', 'hoodie', 'bomber', 'leather', 'jersey', 'feyli', 'kurta', 'tux', 'mdenim', 'track', 'mgrad', 'athletic'];
  var OUT_B = { f: ['tee', 'blouse', 'hoodie', 'polo', 'shirt', 'school', 'mvjersey', 'police'], m: ['tee', 'shirt', 'school', 'fishshirt', 'mvjersey', 'police'] };
  var OUT_C = ['pirate', 'chef', 'pilot', 'astro', 'hero', 'boduberu', 'diver', 'trench', 'royal'];
  function norm(cfg) {
    var c = {}, src = cfg && typeof cfg === 'object' ? cfg : {};
    CATS.forEach(function (cat) {
      var k = src[cat]; if (ALIASES[cat] && ALIASES[cat][k]) k = ALIASES[cat][k];
      c[cat] = item(cat, k) ? k : DEFAULTS[cat];
    });
    /* v1/v2 configs have no body: guess it (beard -> male, feminine hair / lipstick / lashes -> female, else male) */
    if (!item('body', src.body)) c.body = c.facial !== 'none' ? 'm' : (FEM_HINT.test(c.hair) || c.lips !== 'none' || c.lashes !== 'none') ? 'f' : 'm';
    if (c.body === 'f') c.facial = 'none';
    c.v = 4; return c;
  }
  function ownedHas(owned, id) {
    if (owned === true || owned === '*') return true;
    if (!owned) return false;
    if (typeof owned.has === 'function') return owned.has(id);
    if (Array.isArray(owned)) return owned.indexOf(id) >= 0;
    return !!owned[id];
  }
  function coverName(h) { return h === 'turban' || h === 'headscarf' ? 'head wrap' : h === 'khimar' ? 'khimar' : h === 'shayla' ? 'shayla' : 'hijab'; }
  /* Fall back unowned / paid / invalid parts to free defaults and resolve conflicts. */
  function validate(cfg, owned) {
    var c = norm(cfg);
    CATS.forEach(function (cat) { var it = item(cat, c[cat]); if (!it.free && !ownedHas(owned, it.id)) c[cat] = DEFAULTS[cat]; });
    if (COVER[c.hair]) { c.earrings = 'none'; if (NECKCOVER[c.hair]) c.neck = 'none'; }
    if (c.mask === 'patchR' && c.glasses === 'monocle') c.glasses = 'none';
    return c;
  }
  /* Why an option is unavailable with the current config (for UI). Returns reason string or ''. */
  function conflict(cfg, cat, key) {
    var c = norm(cfg), what = coverName(c.hair);
    if (cat === 'earrings' && COVER[c.hair] && key !== 'none') return 'Earrings are hidden under a ' + what;
    if (cat === 'neck' && NECKCOVER[c.hair] && key !== 'none') return 'Necklaces are hidden under a ' + what;
    if (cat === 'mask' && key === 'patchR' && c.glasses === 'monocle') return 'The monocle is on that eye. Take it off first';
    if (cat === 'glasses' && key === 'monocle' && c.mask === 'patchR') return 'The eye patch is on that eye. Take it off first';
    return '';
  }
  function relevant(c, cat) {
    if (cat === 'scarfColor') return !!COVER[c.hair];
    if (cat === 'hatColor') return !!HAT_TINTED[c.hat];
    if (cat === 'glassesColor') return c.glasses !== 'none';
    if (cat === 'lens') return !!LENS_GLASSES[c.glasses];
    if (cat === 'outfitColor') return !(OUTS[c.outfit] && OUTS[c.outfit].g === 'c');
    if (cat === 'earrings' || cat === 'neck' || cat === 'glasses') return !conflict(c, cat, c[cat]);
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
  /* random(seed?, {body:'f'|'m'}?) - deterministic for a seed, free items only, v4 styles */
  function random(seed, ro) {
    var r = mulberry(hashStr(seed == null ? String(Math.random()) + Date.now() : String(seed))());
    var body = ro && (ro.body === 'f' || ro.body === 'm') ? ro.body : (r() < 0.5 ? 'f' : 'm'), fem = body === 'f';
    function pick(cat, w, only) {
      var list = PARTS[cat].filter(function (i) { return i.free && !i.legacy && (!only || only.indexOf(i.key) >= 0); }), tot = 0, ws = list.map(function (i) { var x = w && w[i.key] != null ? w[i.key] : 1; tot += x; return x; });
      var n = r() * tot; for (var k = 0; k < list.length; k++) { n -= ws[k]; if (n <= 0) return list[k].key; } return list[list.length - 1].key;
    }
    var c = { v: 4, body: body };
    c.skin = pick('skin'); c.face = pick('face', fem ? { square: 0.3, full: 0.6 } : { heart: 0.3 });
    c.eyes = pick('eyes', { almond: 4, round: 2, wide: 1.2, sleepy: 0.6, dot: 0.3, lashes: fem ? 1 : 0 });
    c.eyeColor = pick('eyeColor', { darkbrown: 4, brown: 3, black: 2, hazel: 1.2 });
    c.brows = fem ? pick('brows', { arched: 3, soft: 3, thin: 1, straight: 0.6, bushy: 0, thick: 0.2, angry: 0, unibrow: 0, raised: 0.3 }) : pick('brows', { straight: 3, thick: 2.5, soft: 2, bushy: 0.6, arched: 0.3, thin: 0.2, angry: 0.3, raised: 0.3 });
    c.mouth = pick('mouth', { smile: 4, grin: 1.5, smirk: 0.8, neutral: 0.6, open: 0.5, pout: 0.3, tongue: 0.2 });
    c.nose = pick('nose', fem ? { small: 2, button: 2, wide: 0.3 } : null); c.cheeks = pick('cheeks', { soft: 4, none: fem ? 0.5 : 2, rosy: 1 });
    c.hair = pick('hair', fem ? { hijab: 1.2, shayla: 0.7, khimar: 0.4, turban: 0.5 } : { bald: 0.4 }, fem ? F_KEYS : M_KEYS);
    c.hairColor = pick('hairColor', { black: 5, darkbrown: 3.5, brown: 2, chestnut: 1, auburn: 0.6, ginger: 0.4, caramel: 0.8, honey: 0.6, blonde: 0.5, grey: 0.4, white: 0.2, burgundy: 0.3 });
    var cover = !!COVER[c.hair];
    c.marks = r() < 0.18 ? pick('marks', { none: 0 }) : 'none';
    c.lashes = fem ? pick('lashes', { none: 0.3, subtle: 2, full: 1.4 }) : 'none';
    c.lips = fem && r() < 0.5 ? pick('lips', { none: 0 }) : 'none';
    c.facial = fem || r() < 0.55 ? 'none' : pick('facial', { none: 0 });
    c.glasses = r() < 0.2 ? pick('glasses', { none: 0 }) : 'none';
    c.glassesColor = pick('glassesColor'); c.lens = pick('lens');
    c.hat = !cover && r() < 0.14 ? pick('hat', { none: 0, police: 0.2, deerstalker: 0.3, chef: 0.2, gradcap: 0.2 }) : 'none';
    c.hatColor = pick('hatColor');
    c.outfit = pick('outfit', null, (fem ? OUT_F : OUT_M).concat(OUT_B[body]));
    c.outfitColor = r() < 0.6 ? 'auto' : pick('outfitColor', { auto: 0 }); c.scarfColor = pick('scarfColor');
    c.neck = !NECKCOVER[c.hair] && r() < 0.16 ? pick('neck', { none: 0 }) : 'none';
    c.paint = r() < 0.04 ? pick('paint', { none: 0 }) : 'none';
    c.mask = r() < 0.04 ? pick('mask', { none: 0 }) : 'none';
    c.earrings = !cover && r() < (fem ? 0.55 : 0.1) ? pick('earrings', { none: 0 }) : 'none';
    c.bg = pick('bg');
    return norm(c);
  }

  /* ---------------------------------------------------------------- svg helpers (v3) */
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
  /* ---------------------------------------------------------------- v3 hats, face paint, masks, glasses and scenes: drawn in the v3 head space and mapped onto the v4 head */
  var HATS = {
    capback: function (c, k) {
      return P('M35.5 13.5C39 7 61 7 64.5 13.5 60.5 15.2 39.5 15.2 35.5 13.5Z', shade(c, 0.22)) +
        P('M25.5 35C25 19 36 11.5 50 11.5S75 19 74.5 35Z', c) + P('M50 11.5C64 11.5 75 19 74.5 35H65.5C65.5 22 60 14 50 11.5Z', '#000', ' opacity=".12"') + S('M31 26Q36 16 46 13.4', '#fff', 1.8, ' opacity=".22"') +
        P('M43 35.2C43 29.6 46 27.2 50 27.2S57 29.6 57 35.2Z', k.cover ? k.sc : k.bald ? k.sk : k.hc) + S('M42 31.8H58', shade(c, 0.3), 1.6) + S('M25.8 35H74.2', shade(c, 0.2), 2.2);
    },
    fisher: function (c) {
      var ribs = ''; for (var x = 30; x <= 70; x += 3.2) ribs += 'M' + x.toFixed(1) + ' 20V29';
      return P('M29.6 31C29.6 19.6 38.6 13.6 50 13.6S70.4 19.6 70.4 31Z', c) + S(ribs, '#000', 0.8, ' opacity=".12"') + P('M50 13.6C61.4 13.6 70.4 19.6 70.4 31H63C63 21 58 15.6 50 13.6Z', '#000', ' opacity=".1"') +
        P('M28.4 27.6H71.6Q73.4 27.6 73.4 29.4V33.6Q73.4 35.4 71.6 35.4H28.4Q26.6 35.4 26.6 33.6V29.4Q26.6 27.6 28.4 27.6Z', shade(c, 0.16)) + S('M28 31.4H72', '#000', 0.8, ' opacity=".14"');
    },
    headband: function (c) {
      return P('M27.6 34.2Q50 27.4 72.4 34.2L72.9 40Q50 33.4 27.1 40Z', c) + S('M27.6 37.1Q50 30.6 72.6 37.1', '#fff', 1.3, ' opacity=".85"') + P('M60 31.4Q66 32 72.4 34.2L72.9 40Q67 38 60.6 37Z', '#000', ' opacity=".1"');
    },
    headphones: function (c, k) {
      var d = shade(c, 0.35);
      return S('M24.5 48C21.6 23 35 11.8 50 11.8S78.4 23 75.5 48', d, 4.2) + S('M24.5 48C21.6 23 35 11.8 50 11.8S78.4 23 75.5 48', c, 2.4) + S('M34 18Q41 13.6 50 13.4', '#fff', 1, ' opacity=".35"') +
        both(P('M20.8 42.6H28.6Q31.4 42.6 31.4 45.4V56.2Q31.4 59 28.6 59H20.8Q18 59 18 56.2V45.4Q18 42.6 20.8 42.6Z', c) + P('M28.6 42.6Q31.4 42.6 31.4 45.4V56.2Q31.4 59 28.6 59H26.4V42.6Z', '#000', ' opacity=".18"') + '<rect x="20" y="45.4" width="2" height="10.8" rx="1" fill="#fff" opacity=".35"/>');
    },
    police: function () {
      var N = '#1B2544', sq = '';
      for (var i = 0; i < 14; i++) sq += '<rect x="' + (28.5 + i * 3.08).toFixed(2) + '" y="' + (i % 2 ? 29.5 : 32.3) + '" width="3.08" height="2.8" fill="#15151D"/>';
      return P('M24.5 22.5C25 15.5 37 11.5 50 11.5S75 15.5 75.5 22.5C75 26.5 72 29 70 30H30C28 29 25 26.5 24.5 22.5Z', N) + P('M50 11.5C63 11.5 75 15.5 75.5 22.5 75 26.5 72 29 70 30H62C63 22 59 14 50 11.5Z', '#000', ' opacity=".15"') +
        P('M28.5 29.5H71.5V35.1H28.5Z', '#F4F1EA') + sq +
        P('M29 35C36 33 64 33 71 35 69 39.4 62 40.8 50 40.8S31 39.4 29 35Z', '#101018') + S('M33 36.4Q50 34 67 36.4', '#fff', 0.9, ' opacity=".3"') +
        star(50, 21.6, 4.2, '#E6BC4E');
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
    }
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
  function bgSVG(b, crop) {
    var it = item('bg', b) || item('bg', 'sky'), v = it.value, shape = crop ? '<rect x="-20" y="-20" width="140" height="180"' : '<circle cx="50" cy="50" r="50"';
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
  /* ================================================================ v4 renderer */
const f=n=>Math.round(n*100)/100;
const pt=p=>f(p[0])+' '+f(p[1]);
function bez(P){let d='M'+pt(P[0]);for(let i=1;i+2<P.length;i+=3)d+='C'+pt(P[i])+' '+pt(P[i+1])+' '+pt(P[i+2]);return d}
function rbez(P){const R=P.slice().reverse();let d='L'+pt(R[0]);for(let i=1;i+2<R.length;i+=3)d+='C'+pt(R[i])+' '+pt(R[i+1])+' '+pt(R[i+2]);return d}
const lockD=(a,b)=>bez(a)+rbez(b)+'Z';
const lerpP=(a,b,t)=>a.map((p,i)=>[p[0]+(b[i][0]-p[0])*t,p[1]+(b[i][1]-p[1])*t]);
const mir=P=>P.map(p=>[100-p[0],p[1]]);
const mirD=d=>d.replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g,(m,x,y)=>f(100-parseFloat(x))+' '+y);
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function sampleBez(P,n){if((P.length-1)%3){const out=[];for(let k=0;k<n;k++){const T=k/(n-1)*(P.length-1),s=Math.min(Math.floor(T),P.length-2),t=T-s;out.push([P[s][0]+(P[s+1][0]-P[s][0])*t,P[s][1]+(P[s+1][1]-P[s][1])*t])}return out}
 const segs=(P.length-1)/3,out=[];for(let k=0;k<n;k++){const T=k/(n-1)*segs;const s=Math.min(Math.floor(T),segs-1),t=T-s,mt=1-t;const p0=P[s*3],p1=P[s*3+1],p2=P[s*3+2],p3=P[s*3+3];out.push([0,1].map(j=>mt*mt*mt*p0[j]+3*mt*mt*t*p1[j]+3*mt*t*t*p2[j]+t*t*t*p3[j]))}return out}

/* ================= shared geometry ================= */
const FACE={
 f:'M50 25C61.6 25 66.6 33.5 66.6 44C66.6 52.6 63.2 59.6 57.6 63.9C55.1 65.9 52.6 66.9 50 66.9C47.4 66.9 44.9 65.9 42.4 63.9C36.8 59.6 33.4 52.6 33.4 44C33.4 33.5 38.4 25 50 25Z',
 m:'M50 24.5C62 24.5 67.3 33 67.3 44C67.3 52 65.2 58 60.8 62.4C57.6 65.6 54 67.4 50 67.4C46 67.4 42.4 65.6 39.2 62.4C34.8 58 32.7 52 32.7 44C32.7 33 38 24.5 50 24.5Z'};
const OPEN='M50 27.3C59.6 27.3 64.9 34 65 43.8C65.1 52.6 62.6 59.3 57.8 63.7C55.2 66.1 52.6 67.3 50 67.3C47.4 67.3 44.8 66.1 42.2 63.7C37.4 59.3 34.9 52.6 35 43.8C35.1 34 40.4 27.3 50 27.3Z';

/* ================= HAIR DATA ================= */
// lock = {t:'lock',a,b,n}; edges are poly-cubic point lists of equal length
const L=(a,b,n,o)=>Object.assign({t:'lock',a,b,n},o||{});
const LB_a=[[50,14.4],[33,13],[23.6,23.6],[23.4,38],[23.2,50],[18.4,58],[20,68],[21.6,78],[17,88],[20.4,100]];
const LB_b=[[50,26],[50,40],[50,50],[50,60],[50,70],[50,80],[50,88],[50,94],[50,98],[50,100]];
const LS_a=[[50,15],[33,14],[25.4,24],[25.4,38],[25.2,52],[25.6,66],[25.8,80],[25.8,88],[25.8,94],[26.2,100]];
const WV_a=[[50,15.2],[36,14.2],[27.2,22.6],[26.6,35],[26,45],[21,49],[22.2,57],[23.4,65],[28.2,67],[26.6,75],[25,83],[22.6,88],[27.4,97]];
const WV_b=[[50,20.6],[43,21],[37.2,27],[35.2,36.4],[34.4,45],[35.2,50],[33,57],[31,64],[36,68],[34.8,75],[33.6,82],[31,87.6],[29.8,96.6]];
const WV2_a=[[50,15.2],[64,14.2],[72.8,22.6],[73.4,35],[74,45],[78.6,50],[77.4,58],[76.2,66],[71.8,68],[73.2,75.6],[74.6,82],[76.4,86],[72.6,92.4]];
const WV2_b=[[50,20.6],[57,21],[62.8,27],[64.8,36.4],[65.6,45],[65.2,50],[67.2,58],[69,65],[64.4,68.6],[65.4,75.6],[66.4,82],[68.8,86.4],[70.6,92]];
const SL_a=[[45,15.8],[36,15.2],[29.2,23],[28.6,35],[28.2,48],[28,62],[28,76],[28,85],[28.2,91],[29.6,97]];
const SL_b=[[45,21],[40.5,22.5],[36.3,28.5],[35.3,38],[34.7,49],[35,60],[34.4,72],[34.2,82],[34.2,90],[34.4,96]];
const SR_a=[[45,15.8],[58,14.2],[71.4,22],[71.6,35],[71.8,48],[72,62],[72,76],[72,85],[71.8,91],[70.4,97]];
const SR_b=[[45,21],[52,22],[60.5,25.5],[64.4,36],[65.3,48],[65,60],[65.6,72],[65.8,82],[65.8,90],[65.6,96]];
const CAPF='M31.8 43C30.4 28.5 38 17 50 16.8C62 17 69.6 28.5 68.2 43L66.7 43C66.3 37 64.7 33 62.3 30.3C58.6 27.3 54.5 26.6 50 26.8C45.5 26.6 41.4 27.3 37.7 30.3C35.3 33 33.7 37 33.3 43Z';
const CAPF_HL=[[33.3,43],[33.7,37],[35.3,33],[37.7,30.3],[41.4,27.3],[45.5,26.6],[50,26.8],[54.5,26.6],[58.6,27.3],[62.3,30.3],[64.7,33],[66.3,37],[66.7,43]];
const capM=(top=18.4,hl=28.3,sb=45)=>`M31.7 ${sb}C30.3 30 37 ${top+.3} 50 ${top}C63 ${top+.3} 69.7 30 68.3 ${sb}L66.8 ${sb}C66.4 38.6 65.1 35 63.5 32.6C60 29.3 55 ${hl} 50 ${hl}C45 ${hl} 40 29.3 36.5 32.6C34.9 35 33.6 38.6 33.2 ${sb}Z`;
const HLM=[[33.2,45],[33.6,38.6],[34.9,35],[36.5,32.6],[40,29.3],[45,28.3],[50,28.3],[55,28.3],[60,29.3],[63.5,32.6],[65.1,35],[66.4,38.6],[66.8,45]];
const CP_L_a=[[50,15.6],[38,15.6],[30.4,25],[31,39],[32,45],[34,50],[36.5,54]];
const CP_L_b=[[50,24.2],[44.4,24.4],[38.2,28.2],[35.4,37.6],[34.3,43],[34.6,47.5],[36.5,54]];
const CP_R_a=mir(CP_L_a),CP_R_b=mir(CP_L_b);
const sheenC={t:'sheen',d:'M36.5 21.5C41 17.8 47 17 50.5 17.3',w:2.6};
const sheenC2={t:'sheen',d:'M53 17.2C57.5 17.3 61.5 18.8 64.2 21.5',w:2};

// ---- raw helpers for special pieces
function bun(x,y,r){return {t:'bun',x,y,r}}

const HAIRS={
 // ---------------- WOMEN
 waves:{g:'f',name:'Long waves',desc:'Soft S-waves, centre part',
  back:[L(LB_a,LB_b,5),L(mir(LB_a),mir(LB_b),5)],
  front:[L(WV_a,WV_b,10),L(WV2_a,WV2_b,10),sheenC,sheenC2,
   {t:'fly',d:'M40 16.4C35 16 30.6 19.6 28.4 24.5M58.5 16.2C64 16.5 68.4 19.6 70.4 24M29 48C26.8 51 26.3 54 27 57M72 60C74.6 62.5 75.4 65.5 74.8 68'}]},
 sleek:{g:'f',name:'Sleek straight',desc:'Glass-shine, side part',
  back:[L(LS_a,LB_b,5),L(mir(LS_a),mir(LB_b),5)],
  front:[L(SL_a,SL_b,8),L(SR_a,SR_b,11),{t:'sheen',d:'M34.5 26C38 19.6 44 16.8 46 16.8M48 17C55 16 62 18 66.5 23',w:2.4},{t:'sheen',d:'M31.2 40C30.9 48 31 56 31.2 62M68.8 42C69 50 69 58 68.9 64',w:1.6}]},
 curtain:{g:'f',name:'Curtain bangs',desc:'Face-framing fringe',
  back:[L(LB_a,LB_b,5),L(mir(LB_a),mir(LB_b),5)],
  front:[L(WV_a,WV_b,9),L(WV2_a,WV2_b,9),
   L([[50,19.4],[45.6,19.8],[40,24.6],[37.2,32.4],[36.1,37.4],[35.8,41.8],[36.5,46.5]],[[50,21.4],[48.4,26.2],[44.6,30],[41.8,34.6],[40.3,37.6],[39.2,41.2],[37.6,46.5]],5),
   L(mir([[50,19.4],[45.6,19.8],[40,24.6],[37.2,32.4],[36.1,37.4],[35.8,41.8],[36.5,46.5]]),mir([[50,21.4],[48.4,26.2],[44.6,30],[41.8,34.6],[40.3,37.6],[39.2,41.2],[37.6,46.5]]),5),
   sheenC,sheenC2,{t:'fly',d:'M44 20C41 21.5 38.6 24.6 37.6 28M56 20C59 21.5 61.4 24.6 62.4 28'}]},
 sidefringe:{g:'f',name:'Side fringe',desc:'Swept fringe, long',
  back:[L(LS_a,LB_b,5),L(mir(LS_a),mir(LB_b),5)],
  front:[L(SL_a,SL_b,8),L(SR_a,SR_b,9),
   L([[41,18.2],[51,16.6],[61.5,19.4],[65.8,27.5],[67,32],[67.2,37],[66.6,42.4]],[[41,21.4],[45,28.6],[54,32.4],[61.8,37.3],[63.8,38.8],[65.2,40.8],[66.6,42.4]],9),
   {t:'sheen',d:'M42 19.5C48 17 56 17.6 61 21',w:2.4},{t:'fly',d:'M44 18C38 18.4 33.6 21.6 31.6 26'}]},
 ponytail:{g:'f',name:'High ponytail',desc:'Snatched & swingy',
  back:[L([[55,12.4],[71,6.8],[82.6,19],[80.6,33],[78.8,45],[83.6,55],[77.6,68],[75,77],[78.4,84],[73.4,92]],[[56.6,18.2],[63.6,17.4],[68.2,25.6],[68,35.6],[67.2,46],[70,55.6],[68.4,66],[67.4,75],[69.8,83],[71.8,92]],10)],
  front:[{t:'shape',d:CAPF,hl:CAPF_HL,rad:{line:[[33.3,43],[34,33],[40,27],[50,26.8],[60,27],[66,33],[66.7,43]],to:[57,15.6],n:18,k:.12}},
   {t:'raw',f:X=>`<ellipse cx="57.2" cy="15.4" rx="2.6" ry="1.9" fill="${X.H.dk}" transform="rotate(-18 57.2 15.4)"/>`},
   {t:'sheen',d:'M37 23.5C41.5 19.4 47 18 52 18.2',w:2.6},
   {t:'fly',d:'M34.2 36C32.4 41 33.6 46 32.2 51.5M65.8 36C67.6 41 66.4 46 67.8 51.5M50 17C47 15 44 15.4 42 17'}]},
 lowbun:{g:'f',name:'Low side bun',desc:'Soft & polished',
  back:[bun(68.4,60.6,6.8),{t:'raw',f:X=>`<path d="M64 53C66 55 67.5 56.5 70 55.8" stroke="${X.H.dk}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`}],
  front:[L(CP_L_a,CP_L_b,8),L(CP_R_a,CP_R_b,8),sheenC,sheenC2,{t:'fly',d:'M35 41C33.4 45 34.4 49 33.2 53.4M65.4 40C67.2 45 66 49 67.4 53'}]},
 braids:{g:'f',name:'Twin braids',desc:'Braided over shoulders',
  back:[],
  front:[L(CP_L_a,CP_L_b,8),L(CP_R_a,CP_R_b,8),
   {t:'braid',P:[[35.5,50],[33,62],[29.5,72],[30,84],[30.2,90],[30,93],[30.4,97]],n:22,w:5.6},
   {t:'braid',P:mir([[35.5,50],[33,62],[29.5,72],[30,84],[30.2,90],[30,93],[30.4,97]]),n:22,w:5.6},
   sheenC,sheenC2]},
 afro:{g:'f',name:'Curly afro',desc:'Big, soft coils',
  back:[{t:'afro',cx:50,cy:36,rx:25.5,ry:22.5,r:6.4}],
  front:[{t:'afrofront'}]},
 bob:{g:'f',name:'Chin bob',desc:'Glossy, side part',
  back:[{t:'shape',d:'M30.4 38C29.2 50 30 59 33.8 65L66.2 65C70 59 70.8 50 69.6 38Z',dark:1}],
  front:[L([[44,16.4],[35,16],[29.4,24],[29.4,36],[29.4,48],[30,58],[34,65.2]],[[44,21],[39.5,22],[36,28],[35.2,38],[34.8,48],[35.6,56.4],[38,64.6]],8),
   L([[44,16.4],[58,15],[70.6,24],[70.6,36],[70.6,48],[70,58],[66,65.2]],[[44,21],[52,22],[61,26],[64.7,37],[65.2,48],[64.4,56.4],[62,64.6]],10),
   {t:'sheen',d:'M33 26C36 20 41 17 45 16.8M47 17C55 16 63 18.4 67 23.6',w:2.4},{t:'sheen',d:'M31 40C30.8 48 31.3 54 32.5 59M69 40C69.2 48 68.7 54 67.5 59',w:1.4}]},
 pixie:{g:'f',name:'Pixie',desc:'Short & swept',
  back:[],
  front:[{t:'shape',d:'M32.2 45C30.6 29 37.5 17.8 50 17.4C63 17.8 69.8 29 67.8 45L66.4 45C66 38 64.8 34.5 63 32C60 29.5 55 28.5 50 28.6C45 28.5 40 29.5 37 32C35.2 34.5 34 38 33.6 45Z',hl:HLM,rad:{line:[[33.6,45],[34.2,34],[42,28.6],[50,28.6],[58,28.6],[65.8,34],[66.4,45]],to:[44,16],n:14,k:.1}},
   L([[37,21],[47,16.8],[60,18.6],[64.8,27.6],[65.8,31.6],[65.4,35.4],[63,38.2]],[[37,23.6],[41,29.6],[49,32.2],[55.6,34.4],[58.4,35.4],[60.8,36.8],[63,38.2]],9),
   L([[33.6,38],[33.2,41],[33.4,44],[34.6,47.2]],[[35.2,37.6],[35,41],[35.2,44],[34.6,47.2]],2),
   {t:'sheen',d:'M40 21C45 18 52 17.6 57 19.4',w:2.2}]},
 halfup:{g:'f',name:'Half-up',desc:'Top knot + waves',
  back:[L(LB_a,LB_b,5),L(mir(LB_a),mir(LB_b),5)],
  front:[L(WV_a,WV_b,9),L(WV2_a,WV2_b,9),
   {t:'shape',d:'M31.4 36C31.6 23 39.6 16 50 16C60.4 16 68.4 23 68.6 36C66 30.6 62 27 56 26C52 25.4 48 25.4 44 26C38 27 34 30.6 31.4 36Z',hl:[[31.4,36],[34,30.6],[38,27],[44,26],[48,25.4],[52,25.4],[56,26]],rad:{line:[[31.4,36],[36,28.6],[44,26],[50,25.6],[56,26],[64,28.6],[68.6,36]],to:[50,14],n:16,k:.06}},
   bun(50,13.2,4.6),sheenC,sheenC2]},
 hijab:{g:'f',name:'Classic wrap',desc:'Wrapped & pinned',hijab:'wrap'},
 shayla:{g:'f',name:'Shayla drape',desc:'Soft drape over shoulder',hijab:'shayla'},
 khimar:{g:'f',name:'Khimar cape',desc:'Layered, with brooch',hijab:'khimar'},
 turban:{g:'f',name:'Turban wrap',desc:'Modern twisted wrap',hijab:'turban'},
 // ---------------- MEN
 fade:{g:'m',name:'Skin fade',desc:'Clean & sharp',
  front:[{t:'shape',d:capM(19.2,28.6,45),hl:HLM,fade:1,rad:{line:[[33.2,45],[34,36],[40,29.2],[50,28.6],[60,29.2],[66,36],[66.8,45]],to:[50,17],n:22,k:.05,short:1}},{t:'sheen',d:'M39 22C44 19.4 52 19 58 20.6',w:2.2}]},
 crop:{g:'m',name:'Textured crop',desc:'Choppy fringe',
  front:[{t:'shape',d:capM(18.4,28.6,45),hl:HLM,fade:1,rad:{line:[[33.2,45],[34,36],[40,29.2],[50,28.6],[60,29.2],[66,36],[66.8,45]],to:[50,17],n:22,k:.05,short:1}},
   {t:'shape',d:'M35.6 34C35.8 25 42 20.6 50 20.4C58 20.6 64.2 25 64.4 34C63.4 32.6 62.6 32.4 61.8 33.6C61 31.8 60 31.6 59 33.2C58 31.4 56.8 31.2 55.8 33.4C54.8 31.6 53.4 31.4 52.4 33.6C51.4 31.8 50 31.6 49 33.8C48 32 46.6 31.8 45.6 33.6C44.6 31.8 43.4 31.6 42.4 33.2C41.4 31.6 40.2 31.8 39.4 33.2C38.6 32 37.4 32.2 36.6 33.4Z',rad:{line:[[36.6,33.4],[42,33],[50,33.6],[58,33],[63.6,33.4]],to:[48,19],n:18,k:-.08}},
   {t:'sheen',d:'M40 23.4C45 21 53 21 58 22.4',w:2}]},
 quiff:{g:'m',name:'Quiff',desc:'Volume up front',
  front:[{t:'shape',d:capM(19.4,29,45),hl:HLM,fade:1,rad:{line:[[33.2,45],[34,36],[40,29.6],[50,29],[60,29.6],[66,36],[66.8,45]],to:[50,18],n:18,k:.05,short:1}},
   {t:'shape',d:'M35.8 33.4C33.4 25 38.4 15.6 49.6 14.2C58.4 13.2 65.4 16.2 66 21.4C66.4 25.4 64.4 28.8 63.2 32C60.8 26.8 57.4 24.4 52.4 24C46.2 23.6 40 27.6 35.8 33.4Z',rad:{line:[[35.8,33.4],[40.4,27.8],[46.2,24.2],[52.4,24],[57.6,24.6],[61,27.6],[63.2,32]],to:[54,14],n:18,k:-.14}},
   {t:'sheen',d:'M39.6 22C43 17.4 49 15.4 55.4 15.4',w:2.6}]},
 slick:{g:'m',name:'Slick back',desc:'Glossy, swept back',
  front:[{t:'shape',d:capM(16.6,28.4,45),hl:HLM,rad:{line:[[33.2,45],[34,36],[40,29.2],[50,28.4],[60,29.2],[66,36],[66.8,45]],to:[50,4],n:22,k:.18}},
   {t:'sheen',d:'M38.6 24C43 19.6 50 18.4 57 19.6',w:2.8},{t:'sheen',d:'M36 32C37.8 27.6 41 25 44 24',w:1.4}]},
 curlytop:{g:'m',name:'Curly top',desc:'Coils + low fade',
  front:[{t:'shape',d:capM(21,29.6,45),hl:HLM,fade:1,rad:{line:[[33.2,45],[34,37],[40,30],[50,29.6],[60,30],[66,37],[66.8,45]],to:[50,20],n:18,k:.05,short:1}},
   {t:'fluff',c:[[36.6,28.6,3.6],[40.2,24.2,4],[45,21,4.2],[50.6,19.8,4.3],[56,21,4.2],[60.6,24,4],[63.8,28.4,3.6],[39,30.6,3],[44,27.6,3.4],[49.4,26.6,3.5],[55,27.4,3.4],[60.4,30.4,3],[43.4,17.8,3.2],[49.8,15.6,3.4],[56.2,17.4,3.2],[46.6,31.2,2.6],[52.8,31,2.6]]}]},
 manbun:{g:'m',name:'Man bun',desc:'Pulled back, top knot',
  front:[{t:'shape',d:capM(17.4,28.4,45),hl:HLM,rad:{line:[[33.2,45],[34,36],[40,29.2],[50,28.4],[60,29.2],[66,36],[66.8,45]],to:[50,14.5],n:20,k:.12}},
   bun(50,12.6,5.2),{t:'raw',f:X=>`<rect x="46.6" y="16" width="6.8" height="1.8" rx=".9" fill="${X.H.dk}"/>`},{t:'sheen',d:'M38.6 25C43 21 50 20 57 21',w:2.4}]},
 buzz:{g:'m',name:'Buzz cut',desc:'Tight & tidy',
  front:[{t:'buzz',d:capM(22.4,28.8,44)}]},
 sidepart:{g:'m',name:'Side part',desc:'Classic gentleman',
  front:[{t:'shape',d:'M31.7 45C30 29.6 36 17.4 46 16.8C60 16.2 70 26 68.3 45L66.8 45C66.4 38.6 65.1 35 63.5 32.6C60 29.3 55 28.3 50 28.3C45 28.3 40 29.3 36.5 32.6C34.9 35 33.6 38.6 33.2 45Z',hl:HLM,fade:1,rad:{line:[[41,17.4],[41.6,21],[42,24.4],[43,28.4]],to:[70,30],n:16,k:-.2}},
   {t:'shape',d:'M31.7 45C30.6 33 34 23 41 17.4C41.6 21.6 42 25 43 28.4C40 29.2 37.8 30.8 36.5 32.6C34.9 35 33.6 38.6 33.2 45Z',fade:1,rad:{line:[[41,17.4],[41.6,21],[42,24.4],[43,28.4]],to:[31,40],n:9,k:.1}},
   {t:'raw',f:X=>`<path d="M41 17.6C41.6 21.4 42 24.8 42.8 28.2" stroke="${X.H.dk}" stroke-width=".55" fill="none" opacity=".8"/>`},
   {t:'sheen',d:'M45 19.6C52 18 60 19.6 64.6 24',w:2.6}]},
 wavy:{g:'m',name:'Wavy medium',desc:'Surfer length',
  back:[{t:'shape',d:'M30.4 36C29.4 46 29.4 54 31.6 60L68.4 60C70.6 54 70.6 46 69.6 36Z',dark:1}],
  front:[L([[44,17],[35,16.6],[29.6,24],[29.6,34],[29.6,42],[28,48],[29.6,54],[30.6,57],[29.6,59],[31.4,61]],[[44,21.6],[40,22.6],[36.2,28],[35.2,36],[34.4,42],[35.8,47],[34.4,52],[33.6,55.4],[34.6,58],[33.6,61]],8),
   L([[44,17],[57,15.4],[70.4,23],[70.4,34],[70.4,42],[72,48],[70.4,54],[69.4,57],[70.4,59],[68.6,61]],[[44,21.6],[52,23],[60.4,26.6],[64.6,35],[65.6,42],[64.2,47],[65.6,52],[66.4,55.4],[65.4,58],[66.4,61]],10),
   {t:'sheen',d:'M34 26C37 20.4 42 17.6 45 17.4M47 17.6C54 16.4 62 18 66.4 23.4',w:2.4}]},
 dreads:{g:'m',name:'Locs',desc:'Shoulder-length locs',
  back:[{t:'ropes',side:'back'}],
  front:[{t:'shape',d:capM(18,28.8,44),hl:HLM,rad:{line:[[33.2,44],[34,36],[40,29.4],[50,28.8],[60,29.4],[66,36],[66.8,44]],to:[50,16],n:14,k:.05}},{t:'ropes',side:'front'}]},
 mohawk:{g:'m',name:'Mohawk fade',desc:'Bold crest',
  front:[{t:'buzz',d:capM(22.6,29,44),faint:1},
   {t:'shape',d:'M42.4 30C41.2 22 41.6 14.4 44.4 8.6C45.4 12 46.4 14.2 47.4 15.6C48 11.2 49.4 7.4 51.6 5C52.2 9.4 53 12.4 54.4 14.6C55.8 12 57.6 10.2 59.4 9.4C59 14 58.6 18.6 58.4 22C58.2 25.4 58 28 57.6 30C54 29.2 46 29.2 42.4 30Z',rad:{line:[[42.4,30],[46,29.4],[50,29.2],[54,29.4],[57.6,30]],to:[51,6],n:12,k:-.02}},
   {t:'sheen',d:'M46 22C47 16 48.6 12 50.8 8',w:1.8}]},
 messy:{g:'m',name:'Messy fringe',desc:'Soft, tousled',
  front:[{t:'shape',d:capM(18,29,45),hl:HLM,fade:1,rad:{line:[[33.2,45],[34,36],[40,29.4],[50,29],[60,29.4],[66,36],[66.8,45]],to:[50,17],n:16,k:.05,short:1}},
   L([[34.4,33],[37,22.6],[46,18.4],[52,19]],[[37.6,37.6],[40,30],[45,25],[52,22.6]],4),
   L([[40,36.8],[40.6,27],[46,20.4],[53,19.6]],[[43.6,38.4],[45.2,31],[49,25.4],[55,22.4]],4),
   L([[46.6,38],[47,28],[51,21],[57,20]],[[50.4,37.4],[51.4,30],[54.4,25],[59.6,23.6]],4),
   L([[53,36.8],[54.4,28.4],[57.4,22.6],[62,22.2]],[[56.8,35.6],[58,30],[60.4,26.6],[64,26.4]],4),
   L([[59.6,34.4],[61,29],[63,25.4],[65.6,27]],[[63.8,34.4],[64.6,31.4],[65.6,29],[66.6,30.6]],3),
   {t:'sheen',d:'M40 24C44 20.4 50 19.4 56 20.4',w:2.2}]},
 cornrows:{g:'m',name:'Cornrows',desc:'Neat braided rows',
  front:[{t:'shape',d:capM(19.6,28.8,44),hl:HLM},{t:'raw',f:X=>{let s='';[36.4,40.6,45.2,50,54.8,59.4,63.6].forEach(x=>{const d=`M${x} ${x<42||x>58?33:29.6}C${f(x+(x-50)*.08)} 25 ${f(50+(x-50)*.72)} 20.6 ${f(50+(x-50)*.5)} 18.4`;s+=`<path d="${d}" fill="none" stroke="${X.H.dk}" stroke-width="2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${X.H.hl}" stroke-width="1.3" stroke-dasharray=".9 .6" opacity=".55"/>`});return s}}]},
 topbun:{g:'f',name:'Top bun',desc:'Sleek high bun',
  front:[{t:'shape',d:CAPF,hl:CAPF_HL,rad:{line:[[33.3,43],[34,33],[40,27],[50,26.8],[60,27],[66,33],[66.7,43]],to:[50,14],n:18,k:.1}},
   bun(50,11.4,5.8),{t:'raw',f:X=>`<rect x="46.4" y="15.6" width="7.2" height="1.8" rx=".9" fill="${X.H.dk}"/>`},
   {t:'sheen',d:'M37 23.5C41.5 19.4 47 18 52 18.2',w:2.6},{t:'fly',d:'M34.2 36C32.4 41 33.6 46 32.2 51.5M65.8 36C67.6 41 66.4 46 67.8 51.5'}]},
 bald:{g:'m',name:'Bald',desc:'Smooth',front:[]}
};
const HAIR_ALIAS={short:'crop',undercut:'fade',tufts:'crop',spiky:'crop',long:'sleek',fringelong:'sidefringe',sideswept:'sidefringe',sleekbob:'bob',fringepony:'ponytail',bun:'topbun',highbun:'topbun',headscarf:'turban'};
function hairKey(c){const k=c.hair;if(k==='curly')return c.body==='m'?'curlytop':'afro';if(k==='wavy')return c.body==='m'?'wavy':'waves';return HAIRS[k]?k:(HAIR_ALIAS[k]||'crop')}

function skinSet(s){return{s,hi:mix(s,'#FFF3E8',.3),lo:mix(s,'#6A2A22',.3),deep:mix(s,'#3A1510',.45),bl:mix(s,'#E0525E',.5),ol:mix(s,'#2E140C',.62),rim:mix(s,'#FFFFFF',.55)}}
function hairSet(v){const c=Array.isArray(v)?v[0]:v,c2=Array.isArray(v)?v[1]:null;const l=lum(c);const hl=l<.16?mix(c,'#958893',.48):l<.32?mix(c,'#D9B08A',.36):mix(c,'#FFF4DE',.42);
 return{c,c2,hl,top:mix(c,hl,.3),sh:mix(c,'#000',.3),dk:mix(c,'#000',.55),spec:mix(hl,'#FFFFFF',.5),ol:mix(c,'#0B0608',.62)}}

/* ---- hair layer */
function strandSet(a,b,n,X,pal,clipId){let s='';const R=X.rnd;for(let i=1;i<=n;i++){let t=i/(n+1)+(R()-.5)*.55/(n+1);const P=lerpP(a,b,t).map((p,k)=>k===0?p:[p[0]+(R()-.5)*.7,p[1]+(R()-.5)*.5]);const q=pal[(i+Math.floor(R()*3))%pal.length];s+=`<path d="${bez(P)}" stroke="${q[0]}" stroke-width="${q[1]}" opacity="${q[2]}"/>`}return s}
function softStroke(P,col,w,op,X){return `<path d="${bez(P)}" stroke="${col}" stroke-width="${w}" opacity="${op}" ${X.nf?'':`filter="url(#§bl)"`}/>`}
function hairLayer(items,X,layer){let s='';items.forEach((it,i)=>{s+=HR[it.t](it,X,layer,i)});return s}
const HR={
 lock(it,X,layer,i){const{a,b}=it,H=X.H,back=layer==='back',D=lockD(a,b),id=`§k${layer[0]}${i}`;let s=`<clipPath id="${id}"><path d="${D}"/></clipPath>`;
  if(X.st==='r3'){s+=`<path d="${D}" fill="${back?H.sh:(H.c2?`url(#§h)`:H.c)}"/><g clip-path="url(#${id})" fill="none" stroke-linecap="round"><path d="${lockD(lerpP(a,b,.6),b)}" fill="${H.dk}" opacity="${back?.3:.42}"/>`;
   if(!X.lod&&!back)s+=strandSet(a,b,3,X,[[H.ol,.28,.55]])+`<path d="${bez(lerpP(a,b,.28))}" stroke="${H.hl}" stroke-width=".9" opacity=".7" stroke-dasharray="6 3 2 4"/>`;
   return s+`</g><path d="${D}" fill="none" stroke="${H.ol}" stroke-width=".5" stroke-linejoin="round"/>`}
  s+=`<path d="${D}" fill="url(#§${back?'hb':'h'})"/><g clip-path="url(#${id})" fill="none" stroke-linecap="round">`;
  if(back){if(!X.lod)s+=strandSet(a,b,it.n||4,X,[[H.dk,.6,.5],[H.hl,.3,.2]]);return s+'</g>'}
  if(X.st==='r1'){if(!X.lod){s+=softStroke(lerpP(a,b,.32),H.hl,2.6,.42,X)+softStroke(lerpP(a,b,.9),H.dk,2.2,.55,X)}
   s+=strandSet(a,b,X.lod?2:(it.n||8),X,[[H.sh,.36,.6],[H.hl,.26,.6],[H.dk,.45,.45],[H.top,.3,.55],[H.spec,.18,.4]]);}
  else{s+=softStroke(lerpP(a,b,.92),H.dk,2,.6,X)+softStroke(lerpP(a,b,.33),H.hl,2.8,.6,X)+`<path d="${bez(lerpP(a,b,.3))}" stroke="${H.spec}" stroke-width=".9" opacity=".85"/>`;if(!X.lod)s+=strandSet(a,b,3,X,[[H.sh,.35,.35]])}
  return s+'</g>'},
 shape(it,X,layer,i){const H=X.H,id=`§s${layer[0]}${i}`,r3=X.st==='r3';let fill=it.fade?`url(#§hf)`:(r3&&!H.c2?H.c:`url(#§h)`);if(it.dark)fill=`url(#§hb)`;
  let s=`<clipPath id="${id}"><path d="${it.d}"/></clipPath><path d="${it.d}" fill="${fill}"/><g clip-path="url(#${id})" fill="none" stroke-linecap="round">`;
  if(!it.dark){if(!r3)s+=`<path d="${it.d}" fill="url(#§hv)" ${it.fade?'opacity=".6"':''}/>`;if(it.rad)s+=radSet(it.rad,X,it.fade)}
  s+='</g>';if(r3)s+=`<path d="${it.d}" fill="none" stroke="${H.ol}" stroke-width=".5" stroke-linejoin="round" ${it.fade?'opacity=".35"':''}/>`;return s},
 sheen(it,X){if(X.st==='r3')return `<path d="${it.d}" fill="none" stroke="${X.H.hl}" stroke-width="${it.w*.4}" stroke-linecap="round" stroke-dasharray="5 2.4 1.6 3" opacity=".75"/>`;
  const H=X.H;let s=`<path d="${it.d}" fill="none" stroke="${H.hl}" stroke-width="${it.w}" stroke-linecap="round" opacity="${X.st==='r2'?.6:.45}" ${X.nf?'':`filter="url(#§bl)"`}/>`;
  if(!X.lod)s+=`<path d="${it.d}" fill="none" stroke="${H.spec}" stroke-width="${X.st==='r2'?.6:.35}" stroke-linecap="round" stroke-dasharray="${X.st==='r2'?'':'3 1.4 5 2'}" opacity="${X.st==='r2'?.7:.55}"/>`;return s},
 fly(it,X){if(X.lod||X.st==='r3')return '';return `<path d="${it.d}" fill="none" stroke="${X.H.top}" stroke-width=".26" stroke-linecap="round" opacity="${X.st==='r1'?.75:.35}"/>`},
 raw(it,X,layer){return it.f(X,layer)},
 afro(it,X){const R=rng(11),pts=[[it.cx,it.cy+2,it.rx*.8]];
  for(let k=0;k<30;k++){const a=Math.PI*(.84+k/29*1.32);pts.push([it.cx+Math.cos(a)*it.rx*(.9+R()*.08),it.cy+Math.sin(a)*it.ry*(.9+R()*.08)+2,it.r*(.8+R()*.35)])}
  return HR.fluff({c:pts.map(p=>p.map(f)),box:[it.cx-it.rx-5,it.cy-it.ry-4,it.rx*2+10,it.ry*2+14],n:170},X)},
 afrofront(it,X){const pts=[];for(let k=0;k<13;k++){const a=Math.PI*(1.14+k/12*.72);pts.push([f(50+Math.cos(a)*17),f(42.6+Math.sin(a)*15.4),2.4+(k%3)*.4])}return HR.fluff({c:pts,box:[30,24,40,24],n:40,edge:1},X)},
 fluff(it,X){const H=X.H,u=X.u,r3=X.st==='r3',R=rng(21+it.c.length);let s='';
  const fill=r3?H.c:`url(#§af)`;
  if(r3)it.c.forEach(([x,y,r])=>{s+=`<circle cx="${x}" cy="${y}" r="${f(r+.5)}" fill="${H.ol}"/>`});
  it.c.forEach(([x,y,r])=>{s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`});
  if(r3)it.c.forEach(([x,y,r])=>{if(r>3)s+=`<path d="M${f(x-r*.45)} ${f(y+r*.2)}a${f(r*.45)} ${f(r*.4)} 0 1 1 ${f(r*.7)} ${f(r*.25)}" fill="none" stroke="${H.dk}" stroke-width=".35"/>`});
  if(X.lod)return s;
  // coil texture: many tiny arcs spread over the cloud
  const id='§fl'+it.c.length;s+=`<clipPath id="${id}">${it.c.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</clipPath><g clip-path="url(#${id})" fill="none" stroke-linecap="round">`;
  const n=it.n||(it.c.length*9),b=it.box||[30,8,40,28];
  for(let i=0;i<n;i++){const x=b[0]+R()*b[2],y=b[1]+R()*b[3],r=.7+R()*.9,a=R()*6.28;const x1=x+Math.cos(a)*r,y1=y+Math.sin(a)*r,x2=x+Math.cos(a+2.6)*r,y2=y+Math.sin(a+2.6)*r;
   s+=`<path d="M${f(x1)} ${f(y1)}A${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(y2)}" stroke="${i%3===0?H.hl:H.dk}" stroke-width="${i%3===0?.3:.42}" opacity="${r3?.5:(i%3===0?.55:.6)}"/>`}
  if(!r3&&!it.edge&&!X.nf)s+=`<ellipse cx="44" cy="${f(b[1]+b[3]*.28)}" rx="${f(b[2]*.3)}" ry="${f(b[3]*.16)}" fill="${H.hl}" opacity="${X.st==='r2'?.35:.22}" filter="url(#§bl2)"/>`;
  return s+'</g>'},
 buzz(it,X){const H=X.H,id='§bz';let s=`<clipPath id="${id}"><path d="${it.d}"/></clipPath><path d="${it.d}" fill="${H.c}" opacity="${it.faint?.38:.72}"/>`;
  if(!X.lod){s+=`<g clip-path="url(#${id})" opacity="${it.faint?.4:.7}">`;const R=rng(3);for(let i=0;i<90;i++){const x=31+R()*38,y=20+R()*26;s+=`<path d="M${f(x)} ${f(y)}l${f((x-50)*.02)} -.7" stroke="${i%3?H.dk:H.hl}" stroke-width=".35" stroke-linecap="round"/>`}s+='</g>'}
  if(X.st==='r3')s+=`<path d="${it.d}" fill="none" stroke="${H.ol}" stroke-width=".4" opacity=".5"/>`;return s},
 bun(it,X){const H=X.H,{x,y,r}=it,r3=X.st==='r3';let s=`<circle cx="${x}" cy="${y}" r="${r}" fill="${r3?H.c:`url(#§cu)`}" ${r3?`stroke="${H.ol}" stroke-width=".5"`:''}/>`;if(X.lod)return s;
  // twisted coil: overlapping arcs that spiral in, lit from top-left
  for(let i=0;i<7;i++){const rr=r*(.92-i*.11),a0=i*.9;const x1=x+Math.cos(a0)*rr,y1=y+Math.sin(a0)*rr,x2=x+Math.cos(a0+2.4)*rr,y2=y+Math.sin(a0+2.4)*rr;
   s+=`<path d="M${f(x1)} ${f(y1)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x2)} ${f(y2)}" fill="none" stroke="${r3?H.ol:(i%2?H.dk:H.hl)}" stroke-width="${r3?.3:(i%2?.55:.4)}" opacity="${r3?.6:.7}" stroke-linecap="round"/>`}
  if(!r3&&!X.nf)s+=`<ellipse cx="${f(x-r*.3)}" cy="${f(y-r*.35)}" rx="${f(r*.45)}" ry="${f(r*.25)}" fill="${H.spec}" opacity=".35" filter="url(#§bl)"/>`;
  return s},
 braid(it,X){const H=X.H,P=sampleBez(it.P,it.n);let s='';const w=it.w;
  s+=`<path d="${bez(it.P)}" fill="none" stroke="${X.st==='r3'?H.ol:H.sh}" stroke-width="${w*.95}" stroke-linecap="round"/>`+(X.st==='r3'?`<path d="${bez(it.P)}" fill="none" stroke="${H.c}" stroke-width="${w*.8}" stroke-linecap="round"/>`:'');
  for(let i=0;i<P.length-1;i++){const p=P[i],q=P[i+1],ang=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI,side=i%2?1:-1,sc=1-i/P.length*.35;
   const nx=-(q[1]-p[1]),ny=q[0]-p[0],nl=Math.hypot(nx,ny)||1,ox=nx/nl*w*.2*side*sc,oy=ny/nl*w*.2*side*sc;const cx=f(p[0]+ox),cy=f(p[1]+oy),rx=f(w*.62*sc),ry=f(w*.36*sc),rot=f(ang+side*38);
   if(X.st==='r3')s+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${H.c}" stroke="${H.ol}" stroke-width=".4"/>`;
   else s+=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="url(#§cu)"/>`+(X.lod?'':`<path d="M${f(cx-rx*.5)} ${cy}h${f(rx*.9)}" transform="rotate(${rot} ${cx} ${cy})" stroke="${H.spec}" stroke-width=".3" opacity=".6"/>`)}
  const e=P[P.length-1];s+=`<rect x="${f(e[0]-1.4)}" y="${f(e[1]-1)}" width="2.8" height="1.4" rx=".7" fill="${H.dk}"/><path d="M${f(e[0]-1.2)} ${f(e[1]+.4)}L${f(e[0]-1.8)} ${f(e[1]+3.4)}L${f(e[0]+1.8)} ${f(e[1]+3.4)}L${f(e[0]+1.2)} ${f(e[1]+.4)}Z" fill="${X.st==='r3'?H.c:`url(#§h)`}"/>`;return s},
 ropes(it,X){const H=X.H;const back=it.side==='back';const list=back?[[34,30,30,44,27,60,28,74],[38,24,33,40,32,58,33,72],[62,24,67,40,68,58,67,72],[66,30,70,44,73,60,72,74],[44,22,40,38,39,54,40,66],[56,22,60,38,61,54,60,66]]:[[35.6,32,33.4,42,32.6,54,31.6,66],[64.4,32,66.6,42,67.4,54,68.4,66],[39,28.6,36.8,36,35.8,42,35.2,48],[61,28.6,63.2,36,64.2,42,64.8,48]];
  let s='';list.forEach(q=>{const d=`M${q[0]} ${q[1]}C${q[2]} ${q[3]} ${q[4]} ${q[5]} ${q[6]} ${q[7]}`;const w=back?3.2:2.6;
   if(X.st==='r3')s+=`<path d="${d}" stroke="${H.ol}" stroke-width="${w+.9}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${H.c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
   else s+=`<path d="${d}" stroke="${back?H.sh:H.c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`+(X.lod?'':`<path d="${d}" stroke="${H.dk}" stroke-width="${w*.85}" stroke-dasharray=".7 1" fill="none" opacity=".55"/><path d="${d}" stroke="${H.hl}" stroke-width=".4" fill="none" opacity=".5" transform="translate(-.5 0)"/>`)});return s}
};
function radSet(r,X,fade){const H=X.H,pts=sampleBez(r.line,X.lod?5:(r.n||14)),R=X.rnd,r3=X.st==='r3';let s='';
 pts.forEach((p,i)=>{const to=[r.to[0]+(R()-.5)*3,r.to[1]+(R()-.5)*1.5];let end=to;if(r.short){end=[p[0]+(to[0]-p[0])*.55,p[1]+(to[1]-p[1])*.55]}
  const cx=p[0]+(end[0]-p[0])*.3+(p[0]-50)*(r.k||.1),cy=p[1]+(end[1]-p[1])*.65;const col=r3?H.ol:[H.sh,H.hl,H.dk,H.top][i%4];
  s+=`<path d="M${f(p[0])} ${f(p[1])}Q${f(cx)} ${f(cy)} ${f(end[0])} ${f(end[1])}" stroke="${col}" stroke-width="${r3?.28:(i%4===1?.3:.4)}" opacity="${r3?.5:(fade?.45:.55)}"/>`});return s}

/* ---- face parts (every v3 option has a v4 look; expressions are drawn, not animated, so react() just re-renders) */
const FACEP={oval:[1,1,0],round:[1.04,1.1,-.8],square:[1.03,1.22,-.4],heart:[1.04,.86,.5],full:[1.08,1.14,-.5]};
function facePath(m,k){const p=FACEP[k]||FACEP.oval;return FACE[m?'m':'f'].replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g,(q,xs,ys)=>{let x=+xs,y=+ys;const j=y>50?1+(p[1]-1)*Math.min(1,(y-50)/14):1;x=50+(x-50)*p[0]*j;if(y>56)y+=p[2]*(y-56)/11;return f(x)+' '+f(y)})}
function ears(X){const S=X.S,m=X.m;const ex=f(50-(m?17:16.3)*X.fw),rx=m?2.7:2.3,ry=m?4.6:4.2;let s='';
 [[ex,1],[f(100-ex),-1]].forEach(([x,k])=>{s+=`<ellipse cx="${x}" cy="47.6" rx="${rx}" ry="${ry}" fill="url(#§sk)"/><path d="M${f(x+k*.9)} 44.6C${f(x-k*.9)} 44.6 ${f(x-k*1.1)} 48 ${f(x-k*.2)} 50.4" fill="none" stroke="${S.lo}" stroke-width=".7" opacity=".7"/>`});return s}
function earrings(X,c){const e=c.earrings;if(!e||e==='none')return '';const gold='#D8AE52',gl='#FFE7A8';let s='';const d=(X.m?16.8:16.2)*X.fw,xs=[f(50-d),f(50+d)];
 xs.forEach(x=>{if(e==='studs')s+=`<circle cx="${x}" cy="51.2" r="1" fill="${gl}" stroke="${gold}" stroke-width=".35"/>`;
  if(e==='hoops')s+=`<circle cx="${x}" cy="54.2" r="2.8" fill="none" stroke="${gold}" stroke-width=".75"/><path d="M${f(x-2.2)} 55.6a2.8 2.8 0 0 0 3.2 1.3" stroke="${gl}" stroke-width=".35" fill="none"/>`;
  if(e==='pearls')s+=`<path d="M${x} 51.2V53.8" stroke="${gold}" stroke-width=".4"/><circle cx="${x}" cy="55.3" r="1.5" fill="#F7F1E8"/><circle cx="${f(x-.5)}" cy="54.8" r=".45" fill="#fff"/><circle cx="${x}" cy="55.3" r="1.5" fill="none" stroke="#CFC3B3" stroke-width=".25"/>`;
  if(e==='drops')s+=`<circle cx="${x}" cy="51.4" r=".7" fill="${gold}"/><path d="M${x} 52.2L${f(x-1.2)} 55.4L${x} 57.6L${f(x+1.2)} 55.4Z" fill="#2E8C7E" stroke="${gold}" stroke-width=".35"/>`;
  if(e==='shells')s+=`<circle cx="${x}" cy="51.4" r=".6" fill="${gold}"/><ellipse cx="${x}" cy="54" rx="1.2" ry="1.7" fill="#F6E7C8" stroke="#B8925A" stroke-width=".35"/><path d="M${x} 52.8V55.2" stroke="#B8925A" stroke-width=".35"/>`;});return s}
function nose(X,n){const S=X.S,m=X.m;let s='';
 if(!X.nf)s+=`<path d="M51 45.8C51.4 48.8 51.8 51 52.6 52.6" stroke="${S.lo}" stroke-width="1" fill="none" opacity=".4" filter="url(#§bl)"/>`;
 else if(!X.lod)s+=`<path d="M51 46.2C51.4 49 51.8 51 52.4 52.4" stroke="${S.lo}" stroke-width=".5" fill="none" opacity=".35"/>`;
 const w=n==='wide'?1.5:n==='small'?.72:n==='round'?1.15:1, y0=n==='pointy'?54.4:53.9;
 if(n==='pointy')s+=`<path d="M50.8 46C51.6 49.6 52.2 52 52.4 53.4" stroke="${S.lo}" stroke-width=".55" fill="none" opacity=".55"/>`;
 s+=`<path d="M${f(50-2.5*w-(m?.5:0))} ${y0}C${f(50-1.6*w)} ${f(y0+1.1)} ${f(50-.7*w)} ${f(y0+.8)} 50 ${f(y0+1.2)}C${f(50+.7*w)} ${f(y0+.8)} ${f(50+1.6*w)} ${f(y0+1.1)} ${f(50+2.5*w+(m?.5:0))} ${y0}" fill="none" stroke="${S.ol}" stroke-width="${X.lod?.7:.55}" opacity=".55" stroke-linecap="round"/>`;
 if(!X.lod)s+=`<ellipse cx="50.2" cy="${f(y0-1.6)}" rx="${f(1.3*(n==='round'?1.3:1))}" ry="${n==='round'?1.2:.9}" fill="${S.hi}" opacity=".55"/><circle cx="50.5" cy="${f(y0-1.9)}" r=".35" fill="#fff" opacity=".45"/>`;
 if(n==='clown')s+=`<circle cx="50" cy="52.6" r="2.7" fill="#E23A3A"/><circle cx="49.1" cy="51.7" r=".8" fill="#fff" opacity=".75"/>`;
 return s}
function mouth(X,c,lip,e){const m=X.m,lp=`url(#§lp)`,dl=mix(lip,'#2A0A0E',.45),hl=X.lod?'':`<ellipse cx="51" cy="60.5" rx="1.7" ry=".5" fill="#fff" opacity=".38"/>`;
 const lips=m&&c.lips==='none'?null:1;
 const K={
  smile:()=>m&&!lips?`<path d="M45.6 58.9C47.5 58.2 49 58.3 50 58.6C51 58.3 52.5 58.2 54.4 58.9C52.6 59.6 47.4 59.6 45.6 58.9Z" fill="${lip}" opacity=".7"/><path d="M45.8 59.2C48 60.3 52 60.3 54.2 59.2" fill="none" stroke="${dl}" stroke-width=".6" stroke-linecap="round"/><path d="M46.8 60.4C48.4 62.2 51.6 62.2 53.2 60.4C51.8 61 48.2 61 46.8 60.4Z" fill="${lp}" opacity=".85"/>`+(X.lod?'':`<ellipse cx="50.6" cy="61.1" rx="1.5" ry=".35" fill="#fff" opacity=".22"/>`)
   :`<path d="M45.4 58.6C46.8 57.8 48.4 57.4 50 58.1C51.6 57.4 53.2 57.8 54.6 58.6C53 59.3 51.5 59.4 50 59.3C48.5 59.4 47 59.3 45.4 58.6Z" fill="${lp}"/><path d="M45.8 58.9C47.5 59.6 52.5 59.6 54.2 58.9C53.4 61.3 51.8 62 50 62C48.2 62 46.6 61.3 45.8 58.9Z" fill="${lp}"/><path d="M45 58.4C47 59.7 53 59.7 55 58.4" fill="none" stroke="${dl}" stroke-width=".5" stroke-linecap="round"/><path d="M44.6 57.9Q45 58.5 45.4 58.5M55.4 57.9Q55 58.5 54.6 58.5" stroke="${dl}" stroke-width=".35" fill="none" opacity=".6"/>`+hl,
  grin:(gap)=>`<path d="M45 58.2C47.4 59 52.6 59 55 58.2C54.4 61.6 52.4 63 50 63C47.6 63 45.6 61.6 45 58.2Z" fill="#5A1F25"/><path d="M45.8 58.7C48 59.3 52 59.3 54.2 58.7L54 60C52 60.6 48 60.6 46 60Z" fill="#FFF9F3"/>`+(gap?`<rect x="49.6" y="58.9" width=".9" height="1.4" fill="#5A1F25"/>`:'')+`<path d="M45 58.2C47.4 59 52.6 59 55 58.2C54.4 61.6 52.4 63 50 63C47.6 63 45.6 61.6 45 58.2Z" fill="none" stroke="${m&&!lips?dl:lip}" stroke-width="${m&&!lips?.45:.8}"/>`,
  laugh:()=>`<path d="M44.6 58.2C47 59 53 59 55.4 58.2C54.8 62.6 52.6 64.4 50 64.4C47.4 64.4 45.2 62.6 44.6 58.2Z" fill="#5A1F25"/><path d="M45.6 58.7C48 59.3 52 59.3 54.4 58.7L54.1 59.9C52 60.4 48 60.4 45.9 59.9Z" fill="#FFF9F3"/><path d="M47 63.1C48.5 61.9 51.5 61.9 53 63.1C52 64 48 64 47 63.1Z" fill="#D8646A"/><path d="M44.6 58.2C47 59 53 59 55.4 58.2C54.8 62.6 52.6 64.4 50 64.4C47.4 64.4 45.2 62.6 44.6 58.2Z" fill="none" stroke="${m&&!lips?dl:lip}" stroke-width="${m&&!lips?.45:.8}"/>`,
  oh:(r)=>`<ellipse cx="50" cy="60.6" rx="${f(2.2*r)}" ry="${f(2.7*r)}" fill="#5A1F25" stroke="${m&&!lips?dl:lip}" stroke-width="${m&&!lips?.5:.9}"/>`,
  neutral:()=>`<path d="M46 59.4C48.4 59.8 51.6 59.8 54 59.4" fill="none" stroke="${dl}" stroke-width=".65" stroke-linecap="round"/>`+(m&&!lips?`<path d="M47 60.4C48.4 61.6 51.6 61.6 53 60.4C51.8 60.9 48.2 60.9 47 60.4Z" fill="${lp}" opacity=".8"/>`:`<path d="M46.4 59.6C48 60.2 52 60.2 53.6 59.6C52.8 61.4 51.4 61.9 50 61.9C48.6 61.9 47.2 61.4 46.4 59.6Z" fill="${lp}"/><path d="M46.4 59.2C47.6 58.4 48.8 58.2 50 58.7C51.2 58.2 52.4 58.4 53.6 59.2C52 59.7 48 59.7 46.4 59.2Z" fill="${lp}"/>`+hl),
  smirk:()=>`<path d="M46.2 59.8C48.4 60.4 51.8 60.2 54.4 58.4" fill="none" stroke="${dl}" stroke-width=".7" stroke-linecap="round"/>`+(m&&!lips?`<path d="M47.2 60.8C48.8 61.8 51.4 61.4 52.8 60.4C51.4 60.8 48.8 61 47.2 60.8Z" fill="${lp}" opacity=".8"/>`:`<path d="M46.6 60C48.6 61.8 52 61.4 53.8 59.2C52 60.4 48.6 60.8 46.6 60Z" fill="${lp}"/><path d="M46.4 59.8C48 58.8 50 58.6 51.4 59C52.4 58.4 53.6 58.2 54.4 58.4C52.6 59.6 49 60.2 46.4 59.8Z" fill="${lp}"/>`),
  pout:()=>`<path d="M47.2 58.8C48.2 58 49.2 57.8 50 58.3C50.8 57.8 51.8 58 52.8 58.8C51.8 59.4 48.2 59.4 47.2 58.8Z" fill="${lp}"/><path d="M47.4 59C48.4 59.6 51.6 59.6 52.6 59C52.2 61 51 61.6 50 61.6C49 61.6 47.8 61 47.4 59Z" fill="${lp}"/><path d="M47.2 58.9C48.6 59.5 51.4 59.5 52.8 58.9" fill="none" stroke="${dl}" stroke-width=".45"/>`+(X.lod?'':`<ellipse cx="50.4" cy="60.4" rx=".9" ry=".35" fill="#fff" opacity=".4"/>`),
  sad:()=>`<path d="M46.2 61.2C48 59.8 52 59.8 53.8 61.2" fill="none" stroke="${dl}" stroke-width=".75" stroke-linecap="round"/>`+(m&&!lips?'':`<path d="M46.6 61C48.4 59.9 51.6 59.9 53.4 61C52 61.6 48 61.6 46.6 61Z" fill="${lp}" opacity=".8"/>`),
  angry:()=>`<path d="M46 61C47.6 60 52.4 60 54 61C52.6 61.6 47.4 61.6 46 61Z" fill="#5A1F25"/><path d="M46.4 60.6C48.4 60.1 51.6 60.1 53.6 60.6" stroke="#FFF9F3" stroke-width=".5" fill="none"/><path d="M45.8 61.1C47.6 59.8 52.4 59.8 54.2 61.1" fill="none" stroke="${dl}" stroke-width=".6" stroke-linecap="round"/>`,
  think:()=>`<path d="M46.6 60.2C48.6 60.6 51.6 60.2 53.8 58.8" fill="none" stroke="${dl}" stroke-width=".7" stroke-linecap="round"/>`+(m&&!lips?'':`<path d="M47.4 60.4C49.6 61.6 52 61 53.4 59.4C52 60.2 49.6 60.8 47.4 60.4Z" fill="${lp}"/>`)
 };
 let k=c.mouth;
 if(e)k={happy:'grin',laugh:'laugh',wink:'smirk',shocked:'oh',smug:'smirk',thinking:'think',sad:'sad',angry:'angry',sleepy:'ohs',blink:k}[e]||k;
 if(k==='oh')return K.oh(1);if(k==='ohs')return K.oh(.55);if(k==='grin'||k==='gap')return K.grin(k==='gap');if(k==='open')return K.laugh();
 if(k==='tongue')return K.smile()+`<path d="M48.4 60.4C48.4 63.6 51.6 63.6 51.6 60.4Z" fill="#E77A86"/><path d="M50 60.8V62.6" stroke="#B85460" stroke-width=".35"/>`;
 return (K[k]||K.smile)()}
function eyes(X,c,ic,e){const S=X.S,m=X.m,lod=X.lod;const cy=m?46.4:46.6,xs=m?[42.4,57.6]:[42.2,57.8];
 const E=m?'M-4 .3C-2.8-1.8 2.4-2.3 4.1-.3C2.7 1.7-2.5 1.9-4 .3Z':'M-4.1.4C-3-2.1 2.3-2.7 4.3-.5C2.8 1.9-2.5 2.2-4.1.4Z';
 const lid=m?'M-4.2.3C-2.9-2 2.4-2.5 4.3-.35':'M-4.3.45C-3.1-2.2 2.3-2.9 4.5-.55';
 const es=c.eyes;let sx=1,sy=1,ir=2.3;
 if(es==='round'){sy=1.14;sx=.98}else if(es==='wide'){sx=1.08;sy=1.14;ir=2.4}else if(es==='dot'){sx=.9;sy=.92;ir=2.05}else if(es==='starry')sy=1.08;
 if(e==='shocked'){sx*=1.06;sy*=1.3;ir=1.9}
 let drop=es==='sleepy'?.3:0;if(e==='sleepy')drop=.62;if(e==='smug'||e==='angry')drop=Math.max(drop,.34);
 let lv={none:m?0:.6,subtle:1,full:2,dramatic:3}[c.lashes];if(lv==null)lv=m?0:1;if(es==='lashes')lv=Math.max(lv,2);
 const gx=e==='thinking'?.7:0,gy=e==='thinking'?-.9:0;
 const flick=l=>l<=0?'':l<1?`<path d="M4.3-.6L5.3-1.2" stroke="${X.lash}" stroke-width=".5" stroke-linecap="round"/>`:lod?`<path d="M4.2-.6L5.6-1.6" stroke="${X.lash}" stroke-width="${l>1?1:.8}" stroke-linecap="round"/>`:`<path d="M4.3-.6L${f(5.7+l*.25)}-${f(1.5+l*.15)}M3.7-1.3L${f(4.8+l*.2)}-${f(2.6+l*.2)}M2.7-1.9L${f(3.3+l*.1)}-${f(3.2+l*.25)}${l>1?'M1.5-2.3L1.7-3.6M.3-2.5L.2-3.5':''}${l>2?'M-1-2.5L-1.3-3.4':''}" stroke="${X.lash}" stroke-width="${f(.36+l*.06)}" stroke-linecap="round" fill="none"/>`;
 const closedArc=up=>`<path d="${up?'M-3.9.9C-2.2-1.6 2.2-1.8 4.1.4':'M-4 .1C-2 1.5 2 1.5 4.2 0'}" fill="none" stroke="${X.lash}" stroke-width="1.05" stroke-linecap="round"/>`+(lv>0?`<path d="${up?'M4.1.4L5.4-.4':'M4.2 0L5.4.8'}" stroke="${X.lash}" stroke-width=".6" stroke-linecap="round"/>`:'');
 let s='';const allClosed=/^(happy|laugh|blink)$/.test(e||'');
 xs.forEach((x,k)=>{const fl=k===0?-1:1,cid='§e'+k;
  if(allClosed||(e==='wink'&&k===1)){s+=`<g transform="translate(${x} ${cy}) scale(${fl} 1)">${closedArc(e!=='blink')}</g>`;return}
  let g=`<g transform="translate(${x} ${cy}) scale(${f(fl*sx)} ${f(sy)})">`;
  if(!X.nf)g+=`<ellipse cx=".3" cy="-1.9" rx="5.2" ry="2.8" fill="${S.lo}" opacity=".26" filter="url(#§bl)"/>`;
  g+=`<clipPath id="${cid}"><path d="${E}"/></clipPath><path d="${E}" fill="#FBF5F0"/><g clip-path="url(#${cid})"><g class="dga-iris${k===0?' dga-irl':''}"><circle cx="${f(.1+gx*fl)}" cy="${f(.15+gy)}" r="${ir}" fill="url(#§ir)"/>`;
  if(!lod)g+=`<circle cx="${f(.1+gx*fl)}" cy="${f(.15+gy)}" r="${ir}" fill="none" stroke="${mix(ic,'#000',.55)}" stroke-width=".38"/>`;
  g+=`<circle cx="${f(.1+gx*fl)}" cy="${f(.15+gy)}" r="${f(ir*.46)}" fill="#120B09"/></g><ellipse cx="0" cy="-2.2" rx="5" ry="1.7" fill="#3A2418" opacity=".24"/>`;
  if(drop)g+=`<rect x="-5" y="-3.6" width="10.4" height="${f(1.3+drop*3.4)}" fill="${S.s}"/>`;
  g+='</g>';
  g+=`<g transform="translate(0 ${f(drop*3)})"><path d="${lid}" fill="none" stroke="${X.lash}" stroke-width="${m?(lod?1:.8):(lod?1.2:1.05)}" stroke-linecap="round"/>${flick(lv)}</g>`;
  if(!lod)g+=`<path d="${m?'M-3.3 1C-1.5 1.9 1.8 1.8 3.5.6':'M-3.4 1.1C-1.5 2.1 2 2 3.8.4'}" fill="none" stroke="${S.ol}" stroke-width=".32" opacity=".45"/><path d="${m?'M-3.4-1.9C-1.8-3.1 1.8-3.3 3.8-2':'M-3.5-2.2C-1.9-3.5 1.9-3.8 3.9-2.4'}" fill="none" stroke="${S.ol}" stroke-width=".32" opacity=".38"/>`;
  g+='</g>';
  if(drop<.5){const cx=f(x+.95+gx),cyy=f(cy-.75*sy+gy);g+=es==='starry'&&!lod?star(cx,cyy,.95,'#fff'):`<circle cx="${cx}" cy="${cyy}" r=".62" fill="#fff"/>`;if(!lod)g+=`<circle cx="${f(x-.7+gx)}" cy="${f(cy+.85*sy+gy)}" r=".28" fill="#fff" opacity=".75"/>`}
  s+=g});
 return `<g class="dga-eyes${allClosed?' dga-closed':''}">${s}</g>`}
const BROW={f:'M-4.6 1.1C-3.2-.5.6-1.6 3.2-1.1C4.2-.9 4.9-.3 5.3.4C4.1-.2 3.2-.3 2.4-.2C-.2-.1-2.9.6-4.6 1.8Z',m:'M-4.8.7C-3-1 1-1.6 5.1-.5L5 .6C1.4 0-2.6.6-4.7 2.1Z'};
function brows(X,st,e){const m=X.m;let y=m?40.6:41.2;const xs=m?[42.2,57.8]:[42,58];
 const arch=/^(arched|thin|raised)$/.test(st)||(!m&&st==='soft');const B=arch?BROW.f:BROW.m;
 const th={thin:.7,thick:1.35,bushy:1.6,unibrow:1.2}[st]||1;let rot=st==='angry'?-9:0,dy=st==='raised'?-1.2:0;
 if(e==='angry')rot=-13;else if(e==='sad')rot=12;else if(e==='shocked')dy-=1.8;else if(/^(happy|laugh)$/.test(e||''))dy-=.6;
 let s='';xs.forEach((x,k)=>{let r=rot,d=dy;if(e==='thinking'&&k===1)d-=1.4;if(e==='smug'&&k===0)d-=.9;if(e==='wink'&&k===0)d-=.6;
  s+=`<path transform="translate(${x} ${f(y+d)}) scale(${k?1:-1} 1) rotate(${r}) scale(1 ${th})" d="${B}" fill="${X.brow}" opacity=".94"/>`});
 if(st==='unibrow')s+=`<path d="M46.6 ${f(y+dy+.7)}Q50 ${f(y+dy)} 53.4 ${f(y+dy+.7)}" stroke="${X.brow}" stroke-width="1.1" fill="none" opacity=".9"/>`;
 return s}
function facial(X,c,part){const fc=c.facial;if(!X.m||!fc||fc==='none')return '';const H=X.H;const col=`url(#§h)`;let s='';
 const MO='M44.2 57.6C46.2 55.9 48.4 55.8 50 56.6C51.6 55.8 53.8 55.9 55.8 57.6C54.4 58.4 52.4 58 50 58.2C47.6 58 45.6 58.4 44.2 57.6Z';
 const CHEV='M43.8 58.2C45 55.4 48 55.2 50 56.2C52 55.2 55 55.4 56.2 58.2C54.6 57.6 52.4 57.6 50 58C47.6 57.6 45.4 57.6 43.8 58.2Z';
 const PENCIL='M45 57.9C47 57.1 49 57.1 50 57.6C51 57.1 53 57.1 55 57.9C53 58.1 51.5 58.1 50 58.2C48.5 58.1 47 58.1 45 57.9Z';
 if(part==='beard'){
  const reg={stubble:'M33.4 47C34 56 38 63 43 66.4C45.6 68.2 47.8 68.8 50 68.8C52.2 68.8 54.4 68.2 57 66.4C62 63 66 56 66.6 47C65 52.6 61.8 56.6 58 57.6C55 58.2 52.6 56.8 50 56.8C47.4 56.8 45 58.2 42 57.6C38.2 56.6 35 52.6 33.4 47Z',
   shortbeard:'M33.2 46.4C33.6 56 37.6 63.4 42.8 67C45.4 68.8 47.8 69.6 50 69.6C52.2 69.6 54.6 68.8 57.2 67C62.4 63.4 66.4 56 66.8 46.4C65.2 52.4 62 56.6 58 57.6C55 58.2 52.6 56.8 50 56.8C47.4 56.8 45 58.2 42 57.6C38 56.6 34.8 52.4 33.2 46.4Z',
   beard:'M32.8 45C33 57 36.6 65.4 42.4 69.6C45 71.4 47.6 72.4 50 72.4C52.4 72.4 55 71.4 57.6 69.6C63.4 65.4 67 57 67.2 45C65.6 51.6 62.2 56.4 58 57.6C55 58.2 52.6 56.8 50 56.8C47.4 56.8 45 58.2 42 57.6C37.8 56.4 34.4 51.6 32.8 45Z',
   longbeard:'M32.8 45C33 57 36 66 41 71.6C44 75 47 77.4 50 77.6C53 77.4 56 75 59 71.6C64 66 67 57 67.2 45C65.6 51.6 62.2 56.4 58 57.6C55 58.2 52.6 56.8 50 56.8C47.4 56.8 45 58.2 42 57.6C37.8 56.4 34.4 51.6 32.8 45Z',
   chinstrap:'M33.4 46.6C33.8 56 37.8 63.4 43 67C45.6 68.8 47.8 69.4 50 69.4C52.2 69.4 54.4 68.8 57 67C62.2 63.4 66.2 56 66.6 46.6L65.2 47C64.4 55 60.8 61.6 56 65C53.8 66.4 52 66.8 50 66.8C48 66.8 46.2 66.4 44 65C39.2 61.6 35.6 55 34.8 47Z',
   goatee:'M46 61.4C47 63.2 53 63.2 54 61.4C54.8 64.2 53.2 67.4 50 67.6C46.8 67.4 45.2 64.2 46 61.4Z'}[fc];
  if(!reg)return '';
  const id='§bdc';
  if(fc==='stubble'){s+=`<path d="${reg}" fill="${H.c}" opacity="${X.lod?.28:.2}"/>`;if(!X.lod){s+=`<clipPath id="${id}"><path d="${reg}"/></clipPath><g clip-path="url(#${id})">`;const R=rng(5);for(let i=0;i<120;i++)s+=`<circle cx="${f(33+R()*34)}" cy="${f(47+R()*23)}" r=".22" fill="${H.dk}" opacity=".55"/>`;s+='</g>'}return s}
  s+=`<clipPath id="${id}"><path d="${reg}"/></clipPath><path d="${reg}" fill="${col}" ${fc==='shortbeard'||fc==='chinstrap'?'opacity=".92"':''}/>`;
  if(!X.lod){s+=`<g clip-path="url(#${id})" stroke-linecap="round"><path d="${reg}" fill="url(#§hv)"/>`;const R=rng(9),yh=fc==='longbeard'?31:26;for(let i=0;i<60;i++){const x=33+R()*34,y=47+R()*yh;s+=`<path d="M${f(x)} ${f(y)}l${f((x-50)*.025)} 1.2" stroke="${i%3?H.dk:H.hl}" stroke-width=".35" opacity=".6"/>`}s+='</g>'}
  if(!X.nf)s+=`<path d="${reg}" fill="none" stroke="${H.c}" stroke-width=".8" opacity=".5" filter="url(#§bl)"/>`;
  return s}
 if(fc==='stubble')return X.lod?'':`<path d="${MO}" fill="${H.c}" opacity=".22"/>`;
 if(fc==='chinstrap')return '';
 const d=fc==='handlebar'||fc==='chevron'?CHEV:fc==='pencil'?PENCIL:MO;
 s+=`<path d="${d}" fill="${col}"/>`;
 if(fc==='handlebar')s+=`<path d="M44.2 57.8C42.6 58 41.8 56.6 42.6 55.4M55.8 57.8C57.4 58 58.2 56.6 57.4 55.4" fill="none" stroke="${H.c}" stroke-width="1" stroke-linecap="round"/>`;
 if(!X.lod)s+=`<path d="M46 57C47.4 56.4 48.8 56.4 49.6 57M50.4 57C51.2 56.4 52.6 56.4 54 57" stroke="${H.hl}" stroke-width=".3" fill="none" opacity=".6"/>`;
 return s}
function marks(X,mk){if(!mk||mk==='none')return '';const S=X.S;let s='';
 if(mk==='freckles'||mk==='both'){const R=rng(7);for(let i=0;i<14;i++){const x=(i%2?56:38.6)+R()*6,y=50.6+R()*4.6;s+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.28+R()*.22)}" fill="${S.ol}" opacity=".4"/>`}}
 if(mk==='mole'||mk==='both')s+=`<circle cx="57.2" cy="57.6" r=".6" fill="#3A2218" opacity=".85"/>`;
 if(mk==='glitter')s+=sparkle(39.4,51.6,1.3)+sparkle(60.6,51.6,1.3)+`<circle cx="41.6" cy="54" r=".35" fill="#FFE39A"/><circle cx="58.4" cy="54" r=".35" fill="#FFE39A"/>`;
 return s}

/* ---- hijab */
function hijabSvg(X,c,kind){const K=X.sc,u=X.u,r3=X.st==='r3',lod=X.lod;const fill=r3?K.c:`url(#§sc)`;
 const bl=(!r3&&!X.nf)?`filter="url(#§bl)"`:'';
 const fold=(d,w,op)=>r3?`<path d="${d}" fill="none" stroke="${K.ol}" stroke-width=".45" opacity=".7" stroke-linecap="round"/>`:`<path d="${d}" fill="none" stroke="${K.dk}" stroke-width="${w}" opacity="${op}" stroke-linecap="round" ${bl}/>`;
 const shine=(d,w,op)=>r3?(lod?'':`<path d="${d}" fill="none" stroke="${K.lt}" stroke-width=".6" opacity=".8" stroke-linecap="round"/>`):`<path d="${d}" fill="none" stroke="${K.lt}" stroke-width="${w}" opacity="${op}" stroke-linecap="round" ${bl}/>`+(X.st==='r2'&&!lod?`<path d="${d}" fill="none" stroke="#fff" stroke-width=".4" opacity=".3" stroke-linecap="round"/>`:'');
 const under=lum(K.c)>.62?mix(K.c,'#5A4A40',.4):mix(K.c,'#F5EEE6',.55);
 let s='';
 if(kind==='turban'){
  const T='M31.4 52C27.8 40 29.4 18.6 50 15.6C70.6 18.6 72.2 40 68.6 52C67.6 45 66.6 37.4 63.4 32C59.4 28.6 54.8 27.8 50 27.8C45.2 27.8 40.6 28.6 36.6 32C33.4 37.4 32.4 45 31.4 52Z';
  s+=`<path d="${T}" fill="${fill}"/>`+(r3?'':`<path d="${T}" fill="url(#§sct)"/>`);
  s+=fold('M34 46C32.6 36 36 26 44 21',1.2,.45)+fold('M66 46C67.4 36 64 26 56 21',1.2,.45)+fold('M40 30C44 26 48 24.6 50 24.6',1,.35);
  const B1='M35.6 33.4C39 25.2 46 20.6 56.6 18.6L58.8 21.6C49.4 23.4 43 27.6 39.6 34.6Z',B2=mirD(B1);
  s+=`<path d="${B2}" fill="${r3?K.sh:K.sh}"/><path d="${B1}" fill="${r3?K.c:mix(K.c,K.lt,.35)}"/>`+shine('M37.4 32C40.6 25.4 46.6 21.8 55.4 20',1.2,.5)+fold('M39.6 34.6C43 27.6 49.4 23.4 58.8 21.6',.9,.4);
  s+=`<ellipse cx="50" cy="21.4" rx="4.2" ry="3.2" fill="${r3?K.c:mix(K.c,K.lt,.2)}"/>`+fold('M46.6 21C48.4 19.6 51.6 19.6 53.4 21',.8,.5);
  if(r3)s+=`<path d="${T}" fill="none" stroke="${K.ol}" stroke-width=".5"/><path d="${B1}" fill="none" stroke="${K.ol}" stroke-width=".45"/><ellipse cx="50" cy="21.4" rx="4.2" ry="3.2" fill="none" stroke="${K.ol}" stroke-width=".45"/>`;
  s+=`<circle cx="66.4" cy="48" r="1" fill="#D8AE52"/>`;
  return s}
 const OUT=kind==='khimar'?'M50 16.2C65.4 16.2 73.4 27 73.4 41C73.4 52 71 60 68 65C76 70 82 78 83 90C83.6 97 84 106 84 132L16 132C16 106 16.4 97 17 90C18 78 24 70 32 65C29 60 26.6 52 26.6 41C26.6 27 34.6 16.2 50 16.2Z':'M50 16.2C65.4 16.2 73.4 27 73.4 41C73.4 51 71.6 59 68 65C73 70 79 76 82 86C83.4 91 84 96 84 100C84 110 83.6 118 83.4 124C72 128 28 128 16.6 124C16.4 118 16 110 16 100C16 96 16.6 91 18 86C21 76 27 70 32 65C28.4 59 26.6 51 26.6 41C26.6 27 34.6 16.2 50 16.2Z';
 // underscarf band just inside the opening
 s+=`<path d="M36 39.4C36.8 31.8 42.4 28.2 50 28.2C57.6 28.2 63.2 31.8 64 39.4" fill="none" stroke="${under}" stroke-width="1.7"/>`;
 s+=`<path d="${OUT} ${OPEN}" fill-rule="evenodd" fill="${fill}"/>`;
 if(!r3)s+=`<path d="${OUT} ${OPEN}" fill-rule="evenodd" fill="url(#§sct)"/>`;
 // folds around the face + dome
 s+=fold('M35.2 30C31 37.6 30.4 51 34.6 60.6',1.5,.4)+fold('M64.8 30C69 37.6 69.6 51 65.4 60.6',1.5,.45)+fold('M41 16.6C35.2 21 31.2 28 29.6 38',1.3,.35)+fold('M58.6 16.2C64.4 19.4 69 25.4 71 33.4',1.3,.4);
 s+=shine('M44.6 15.8C39.4 19.2 35.8 25 34.2 32.6',1.8,.4)+shine('M31.8 44C31.6 51 33 57 36 61.6',1.1,.35);
 // drape
 s+=fold('M32.6 67C28.6 74.6 24.6 84 22.6 100',1.4,.4)+fold('M40 73C38 82 37 91 38 100',1.2,.35)+fold('M68.4 66.4C73 74 76.6 86 77.6 100',1.4,.45)+fold('M60 73.4C62.6 82 64.6 91 65 100',1.2,.35);
 s+=shine('M36.4 70C33.2 79 30.8 89 30 100',1.8,.35)+shine('M72 70C74.4 78 75.8 87 76.2 94',1.2,.25);
 if(kind==='wrap'){
  const W='M71.4 41C73.2 50 71.6 60 66.4 66.2C58.4 73.8 46.4 76.4 36.4 79C32.4 80 28.8 81.8 26.6 84.6L21.8 80.4C25.4 75.8 30.6 73 36 71.2C45.6 68.2 55.6 66 61.6 60.6C65.6 56.6 67.6 49.6 68 42Z';
  if(!r3)s+=`<path d="${W}" fill="#000" opacity=".22" transform="translate(0 1.6)" ${bl}/>`;
  s+=`<path d="${W}" fill="${r3?mix(K.c,K.lt,.2):`url(#§sc)`}"/>`+(r3?`<path d="${W}" fill="none" stroke="${K.ol}" stroke-width=".45"/>`:`<path d="${W}" fill="${K.lt}" opacity=".22"/>`);
  s+=fold('M69.6 46C69.6 54 67.4 61 63.6 64.8C57 71 46.4 73.8 36.2 76.2C31.6 77.4 27.6 79.6 24.4 82.6',1.1,.5)+shine('M68.8 43C69 51 67 58 62.6 62.4C56.6 68.2 46 70.8 36.2 73.4C31.4 74.8 27.6 77 24.2 80.6',1.3,.6);
  s+=`<circle cx="69.8" cy="44.6" r="1.35" fill="#F7F1E8"/><circle cx="69.4" cy="44.2" r=".42" fill="#fff"/><circle cx="69.8" cy="44.6" r="1.35" fill="none" stroke="#CFC3B3" stroke-width=".25"/>`;
 }
 if(kind==='shayla'){
  const T=mirD('M66.6 62C63 72 53 78.6 40 81C33 82.2 26 81.8 20.4 80L18.2 87C26 91 37 91.6 47 88.6C59 85 68.6 77.6 71.6 66Z');
  if(!r3)s+=`<path d="${T}" fill="#000" opacity=".2" transform="translate(0 1.6)" ${bl}/>`;
  s+=`<path d="${T}" fill="${r3?mix(K.c,K.lt,.2):`url(#§sc)`}"/>`+(r3?`<path d="${T}" fill="none" stroke="${K.ol}" stroke-width=".45"/>`:`<path d="${T}" fill="${K.lt}" opacity=".2"/>`);
  s+=shine(mirD('M68 65C64.6 73.6 55 80 42 83C35 84.4 27 84.2 21 82.4'),1.6,.5)+fold(mirD('M70.4 68C66 78 56 84.6 44 87C36 88.4 28 88 20 85.6'),1.2,.45)+fold(mirD('M60 74.6C56 80 50 83.4 43 85'),.8,.3);
  const PL='M36.4 33.2C40 27.4 45 25.2 50 25.2C55 25.2 60 27.4 63.6 33.2C60 30.4 55.4 29.2 50 29.2C44.6 29.2 40 30.4 36.4 33.2Z';
  s+=`<path d="${PL}" fill="${r3?mix(K.c,K.lt,.25):`url(#§sc)`}"/>`+(r3?`<path d="${PL}" fill="none" stroke="${K.ol}" stroke-width=".4"/>`:`<path d="${PL}" fill="${K.lt}" opacity=".25"/>`)+fold('M37.6 32.4C41 28.8 45.4 27.4 50 27.4C54.6 27.4 59 28.8 62.4 32.4',.7,.4);
 }
 if(kind==='khimar'){
  const P='M31 66C38 73.6 62 73.6 69 66C74 76 76 86 75 95C66 99 34 99 25 95C24 86 26 76 31 66Z';
  s+=`<path d="${P}" fill="${r3?K.c:`url(#§sc)`}"/>`+(r3?`<path d="${P}" fill="none" stroke="${K.ol}" stroke-width=".45"/>`:`<path d="${P}" fill="${K.lt}" opacity=".1"/>`);
  s+=fold('M40 72C39 80 38 88 38.6 97',1,.35)+fold('M50 73C50 82 50 90 50 98',.9,.3)+fold('M60 72C61 80 62 88 61.4 97',1,.35)+shine('M44.6 73C44 82 44 90 44.6 97.6',1.3,.35)+shine('M31 67.4C28 76 26.6 86 26.6 94',1,.3);
  s+=fold('M25.4 94.6C34 98.4 66 98.4 74.6 94.6',.8,.45);
  s+=`<circle cx="50" cy="70.4" r="1.7" fill="#D8AE52"/><circle cx="50" cy="70.4" r=".9" fill="#FFE7A8"/><circle cx="49.6" cy="70" r=".35" fill="#fff"/>`;
 }
 if(r3)s+=`<path d="${OUT} ${OPEN}" fill="none" stroke="${K.ol}" stroke-width=".5"/>`;
 return s}

/* ---- outfit engine v2: layered garments on a real body (arms, shoulders, neckline). Female-space coords; men use a wider frame. */
const SIL='M45 70L45 74C44 75.8 40.4 77.4 34.6 78.6C26.6 80.3 21.8 84 21 90.6C20.2 100 19.6 116 19.2 132L80.8 132C80.4 116 79.8 100 79 90.6C78.2 84 73.4 80.3 65.4 78.6C59.6 77.4 56 75.8 55 74L55 70Z';
const ARM_L='M21 90.6C21.8 84 26.4 80.4 31.6 79.4C29.4 83.4 28.2 87.6 28 92C27.6 104 27.2 118 27 132L19.2 132C19.6 116 20.2 100 21 90.6Z';
const ARML='M31.6 79.4C29.4 83.4 28.2 87.6 28 92C27.6 104 27.2 118 27 132';
const aO=y=>y<90.6?21+(90.6-y)*.5:21-(y-90.6)*.0435, aI=y=>y<92?28+(92-y)*.3:28-(y-92)*.025;
const TANKCUT='M8 60L39.4 60L39.4 76.4C39 83 36.4 89.4 28.6 93.8L8 93.8Z';
const ATHCUT='M8 60L36.8 60L36.8 77.4C36.4 84 33.8 89.8 28.8 94.4L8 94.4Z';
const STRAPCUT='M0 40H100V88.8C88 88.8 70 88.4 62 88.2C58 88 55 89.6 50 90C45 89.6 42 88 38 88.2C30 88.4 12 88.8 0 88.8Z';
const OFFCUT='M0 40H100V87.4C92 86.6 84 86.8 76 88C68 89.4 58 90.2 50 90.2C42 90.2 32 89.4 24 88C16 86.8 8 86.6 0 87.4Z';
const OFFLINE=[[0,87.4],[8,86.6],[16,86.8],[24,88],[32,89.4],[42,90.2],[50,90.2],[58,90.2],[68,89.4],[76,88],[84,86.8],[92,86.6],[100,87.4]];
const RAGLAN='M44.8 70L28 92L27 132L73 132L72 92L55.2 70Z';
function nkGeo(n){const p=n.split(':');const t=p[0],d=+p[1]||80,w=+p[2]||5.4;const x0=f(50-w),x1=f(50+w),ys=f(74+Math.max(0,45-x0)*.42);return{t,d,w,x0,x1,ys}}
function nkEdge(n){const g=nkGeo(n);if(g.t==='v')return `M${g.x0} ${g.ys}L50 ${g.d}L${g.x1} ${g.ys}`;
 if(g.t==='sq')return `M${g.x0} ${g.ys}L${g.x0} ${f(g.d-1.2)}Q${g.x0} ${g.d} ${f(g.x0+1.2)} ${g.d}L${f(g.x1-1.2)} ${g.d}Q${g.x1} ${g.d} ${g.x1} ${f(g.d-1.2)}L${g.x1} ${g.ys}`;
 if(g.t==='open')return `M${g.x0} ${g.ys}C${f(g.x0+1.4)} ${f(g.ys+12)} 47.8 104 48 132M52 132C52.2 104 ${f(g.x1-1.4)} ${f(g.ys+12)} ${g.x1} ${g.ys}`;
 return `M${g.x0} ${g.ys}Q50 ${f(2*g.d-g.ys)} ${g.x1} ${g.ys}`}
function nkCut(n){if(!n)return '';const g=nkGeo(n);if(g.t==='open')return `<path d="M${g.x0} 40L${g.x0} ${g.ys}C${f(g.x0+1.4)} ${f(g.ys+12)} 47.8 104 48 132L52 132C52.2 104 ${f(g.x1-1.4)} ${f(g.ys+12)} ${g.x1} ${g.ys}L${g.x1} 40Z"/>`;
 return `<path d="M${g.x0} 40${nkEdge(n).replace(/^M/,'L')}L${g.x1} 40Z"/>`}
const SLY={cap:87.6,short:99,elbow:111,off:99};
function slCut(s){if(s==='none'||s==='tank'||s==='strap'||s==='ath')return `<path d="${ARM_L}"/><path d="${mirD(ARM_L)}"/>`+(s==='tank'?`<path d="${TANKCUT}"/><path d="${mirD(TANKCUT)}"/>`:'')+(s==='ath'?`<path d="${ATHCUT}"/><path d="${mirD(ATHCUT)}"/>`:'');
 const y=SLY[s];if(!y)return '';const d=`M6 ${y}L${f(aI(y)+.3)} ${y}L27.3 132L6 132Z`;return `<path d="${d}"/><path d="${mirD(d)}"/>`}
function slHem(s,col,w){const y=SLY[s];if(!y)return '';const d=`M${f(aO(y)-.4)} ${y}Q${f((aO(y)+aI(y))/2)} ${f(y+.9)} ${f(aI(y)+.2)} ${y}`;return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w||.9}" opacity=".7"/><path d="${mirD(d)}" fill="none" stroke="${col}" stroke-width="${w||.9}" opacity=".7"/>`}
function pal(c){return{c,dk:mix(c,'#000000',.36),lt:mix(c,'#ffffff',.4),ol:mix(c,'#0B0608',.62),sh:mix(c,'#000000',.18)}}
function paint(X){const r3=X.st==='r3',lod=X.lod,bl=(!r3&&!X.nf)?`filter="url(#§bl)"`:'';return{r3,lod,bl,
 fold:(d,col,w,op)=>r3?`<path d="${d}" fill="none" stroke="${col}" stroke-width=".4" opacity=".55" stroke-linecap="round"/>`:(lod?'':`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w||1.3}" opacity="${op||.42}" stroke-linecap="round" ${bl}/>`),
 shine:(d,w,op)=>(r3||lod)?'':`<path d="${d}" fill="none" stroke="#fff" stroke-width="${w||1.3}" opacity="${op||.28}" stroke-linecap="round" ${bl}/>`,
 sh:(d,fill,K,extra)=>`<path d="${d}" fill="${fill}" ${extra||''}/>`+(r3?`<path d="${d}" fill="none" stroke="${K.ol}" stroke-width=".42" stroke-linejoin="round"/>`:''),
 ln:(d,col,w,op,extra)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" ${op!=null?`opacity="${op}"`:''} stroke-linecap="round" ${extra||''}/>`}}
const BT=(x,y,col,r)=>{r=r||.6;return `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/><circle cx="${f(x-r*.3)}" cy="${f(y-r*.3)}" r="${f(r*.35)}" fill="#fff" opacity=".55"/>`};
const GOLD='#D8AE52',GOLDL='#FFE7A8',GOLDD='#8C6A22';
function texture(X,tex,K,pid){if(!tex||X.lod)return '';
 const pat=(w,h,body,op)=>`<pattern id="${pid}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern><rect x="0" y="60" width="100" height="80" fill="url(#${pid})" ${op?`opacity="${op}"`:''}/>`;
 const pet=(cx,cy,r,rx,ry,col)=>[0,72,144,216,288].map(a=>{const x=f(cx+Math.cos(a*Math.PI/180)*r),y=f(cy+Math.sin(a*Math.PI/180)*r);return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${x} ${y})" fill="${col}"/>`}).join('');
 switch(tex){
 case 'rib':return pat(1.5,4,`<path d="M.75 0V4" stroke="${K.dk}" stroke-width=".35" opacity=".3"/>`);
 case 'knit':return pat(2.4,2,`<path d="M0 .3L1.2 1.6L2.4 .3" stroke="${K.dk}" stroke-width=".34" fill="none" opacity=".45"/>`);
 case 'denim':return pat(1.4,1.4,`<path d="M0 1.4L1.4 0" stroke="${K.lt}" stroke-width=".3" opacity=".38"/>`);
 case 'linen':return pat(1.6,2.2,`<path d="M.8 0V2.2" stroke="${K.dk}" stroke-width=".2" opacity=".22"/><path d="M0 1.1H1.6" stroke="${K.lt}" stroke-width=".2" opacity=".25"/>`);
 case 'sequin':return pat(2,2,`<circle cx="1" cy="1" r=".8" fill="${K.lt}" opacity=".5"/><circle cx=".7" cy=".7" r=".26" fill="#fff" opacity=".8"/><circle cx="0" cy="0" r=".5" fill="${K.dk}" opacity=".35"/>`);
 case 'floral':return pat(7,7,pet(3.5,3.5,.8,.62,.62,'#fff')+`<circle cx="3.5" cy="3.5" r=".45" fill="#F2C14E"/><ellipse cx="6.2" cy="6" rx=".9" ry=".4" fill="#3E8E5A" transform="rotate(-30 6.2 6)"/>`);
 case 'hawaii':return pat(12,12,pet(4,4,1.5,1.4,.9,'#F28A6B')+`<circle cx="4" cy="4" r=".6" fill="#FFE08A"/><path d="M7.6 9.4C9.4 7.2 11.8 7.6 12.2 9.4C10.6 11 8.8 11 7.6 9.4Z" fill="#2E6B4F"/><path d="M.6 10.8C1.8 9.4 3.6 9.6 4.2 10.8C3 12 1.6 12 .6 10.8Z" fill="#E8F2EA"/><circle cx="9.4" cy="2.6" r=".7" fill="#fff" opacity=".9"/>`);
 case 'stripe':return pat(4,3.2,`<rect y="0" width="4" height="1.4" fill="${K.acc||'#2A3A5E'}" opacity=".85"/>`);
 case 'mesh':return pat(1.2,1.2,`<circle cx=".6" cy=".6" r=".22" fill="${K.dk}" opacity=".35"/>`);
 case 'print':return pat(6,6,`<path d="M3 1.2L4.2 3L3 4.8L1.8 3Z" fill="#fff" opacity=".5"/><circle cx="0" cy="0" r=".5" fill="#F2C14E" opacity=".85"/><circle cx="6" cy="6" r=".5" fill="#F2C14E" opacity=".85"/>`);
 case 'print2':return pat(5,5,`<circle cx="2.5" cy="2.5" r="1.1" fill="none" stroke="#fff" stroke-width=".35" opacity=".6"/><circle cx="2.5" cy="2.5" r=".35" fill="#8E3B2E" opacity=".7"/>`);
 case 'check':return pat(3,3,`<path d="M0 .5H3M.5 0V3" stroke="${K.dk}" stroke-width=".35" opacity=".45"/><path d="M0 2H3" stroke="${K.lt}" stroke-width=".2" opacity=".4"/>`);
 case 'feyli':return `<rect x="0" y="116" width="100" height="1.7" fill="#1F2229"/><rect x="0" y="118.4" width="100" height=".7" fill="#6B4125"/><rect x="0" y="119.8" width="100" height="1.7" fill="#1F2229"/><rect x="0" y="126" width="100" height=".6" fill="#1F2229" opacity=".7"/>`;
 case 'quilt':return pat(4,4,`<path d="M0 0L4 4M4 0L0 4" stroke="${K.dk}" stroke-width=".3" opacity=".35"/>`);
 }return ''}
/* shared detail pieces */
const shirtCollar=(K,P,fill)=>{const L='M44.6 73.2L41.2 79.2L47.6 80.6L50 78.4Z';fill=fill||mix(K.c,'#ffffff',.18);return P.sh(L,fill,K)+P.sh(mirD(L),fill,K)+(P.r3?'':P.ln(L,K.dk,.45,.55)+P.ln(mirD(L),K.dk,.45,.55))};
const tie=(col,P,K,pat)=>{const T='M48.6 79.4L51.4 79.4L52.2 81.4L53 106L50 109.6L47 106L47.8 81.4Z';const k=pal(col);return `<path d="M48.4 77.6L51.6 77.6L51.4 80L48.6 80Z" fill="${k.dk}"/>`+P.sh(T,col,k)+(pat&&!P.lod?`<path d="M47.8 86L52.6 83M47.6 92L52.8 88.8M47.4 98L53 94.6M47.2 104L53 100.4" stroke="${k.lt}" stroke-width=".6" opacity=".6"/>`:'')+P.fold('M50.8 81.6L51.6 106',k.dk,.8,.5)};
const placket=(K,P,y0,btns,x)=>{x=x||50;return P.ln(`M${x} ${y0}L${x} 132`,K.dk,.5,.55)+btns.map(y=>BT(x+.9,y,K.lt,.55)).join('')};
const pocket=(K,P,x,y,w,h,btn)=>P.ln(`M${x} ${y}L${x} ${y+h}L${x+w} ${y+h}L${x+w} ${y}`,K.dk,.45,.6)+P.sh(`M${f(x-.4)} ${f(y-.2)}L${f(x+w+.4)} ${f(y-.2)}L${f(x+w+.4)} ${f(y+2.2)}L${f(x+w/2)} ${f(y+3)}L${f(x-.4)} ${f(y+2.2)}Z`,mix(K.c,'#000000',.08),K)+(btn?BT(x+w/2,y+2.1,btn,.45):'');
function lapel(K,P,x0,ys,yb,kind,fill){fill=fill||mix(K.c,'#ffffff',.08);let L;
 if(kind==='shawl')L=`M${x0} ${ys}C${f(x0-4.6)} ${f(ys+4)} ${f(x0-4.2)} ${f(ys+18)} 49.6 ${yb}L${f(x0+.6)} ${f(ys+1)}Z`;
 else if(kind==='wide')L=`M${x0} ${ys}L${f(x0-8)} ${f(ys+3.4)}L${f(x0-4.6)} ${f(ys+12.4)}L${f(x0-7.4)} ${f(ys+15)}L49.6 ${yb}Z`;
 else L=`M${x0} ${ys}L${f(x0-5.2)} ${f(ys+2.8)}L${f(x0-2.6)} ${f(ys+9.8)}L${f(x0-4.8)} ${f(ys+11.6)}L49.6 ${yb}Z`;
 const R=mirD(L);let s=P.sh(L,fill,K)+P.sh(R,fill,K)+P.fold(L.replace(/Z$/,''),K.dk,.9,.55)+P.fold(R.replace(/Z$/,''),K.dk,.9,.55);
 if(kind==='shawl')s+=P.shine(`M${f(x0-1.6)} ${f(ys+3)}C${f(x0-3)} ${f(ys+8)} ${f(x0-1.6)} ${f(ys+16)} 47 ${f(yb-8)}`,1.1,.6)+P.shine(mirD(`M${f(x0-1.6)} ${f(ys+3)}C${f(x0-3)} ${f(ys+8)} ${f(x0-1.6)} ${f(ys+16)} 47 ${f(yb-8)}`),1,.3);
 return s}
const ribBand=(K,P,d,w)=>P.ln(d,K.dk,w,.5)+(P.lod?'':P.ln(d,K.lt,w*.7,.35,'stroke-dasharray=".25 .55"'));
const cuffs=(K,P,y,h)=>{const d=`M${f(aO(y)-.3)} ${y}L${f(aI(y)+.2)} ${y}L${f(aI(y+h)+.2)} ${y+h}L${f(aO(y+h)-.3)} ${y+h}Z`;return P.sh(d,mix(K.c,'#000000',.12),K)+P.sh(mirD(d),mix(K.c,'#000000',.12),K)};
const hoodBack=K=>`<path d="M33.4 81C31.6 70.4 38.6 64.4 50 64.4C61.4 64.4 68.4 70.4 66.6 81Z" fill="${mix(K.c,'#000000',.28)}"/><path d="M36 79C35.4 72 41 67.6 50 67.6C59 67.6 64.6 72 64 79" fill="none" stroke="${mix(K.c,'#000000',.45)}" stroke-width="1" opacity=".6"/>`;
const capeBack=(col,x)=>{const k=pal(col);return `<path d="M31 78.6C19 81 11.6 94 9.4 112L6 132L94 132L90.6 112C88.4 94 81 81 69 78.6Z" fill="${k.dk}"/><path d="M31 78.6C22 82 16 94 14 112L12 132" fill="none" stroke="${k.c}" stroke-width="2.4" opacity=".6"/><path d="M69 78.6C78 82 84 94 86 112L88 132" fill="none" stroke="${k.sh}" stroke-width="2" opacity=".6"/>`+(x||'')};
const bell=(K,P,y)=>{const d=`M${f(aO(y)-.2)} ${y}C${f(aO(y)-3)} ${y+8} ${f(aO(y)-5)} ${y+14} ${f(aO(y)-6.4)} 132L${f(aI(y)+.6)} 132L${f(aI(y)+.2)} ${y}Z`;return P.sh(d,K.g,K)+P.sh(mirD(d),K.g,K)+P.fold(`M${f(aO(y)-1)} ${y+4}C${f(aO(y)-2.4)} ${y+10} ${f(aO(y)-3)} ${y+14} ${f(aO(y)-3.4)} 132`,K.dk,1,.4)};
const number=(t,x,y,col,sz)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${sz||9}" fill="${col}">${t}</text>`;
const star4=(x,y,r,col)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;d+=(i?'L':'M')+f(x+Math.cos(a)*rr)+' '+f(y+Math.sin(a)*rr)}return `<path d="${d}Z" fill="${col}"/>`};
const sparkle=(x,y,r)=>`<path d="M${x} ${f(y-r)}Q${x} ${y} ${f(x+r)} ${y}Q${x} ${y} ${x} ${f(y+r)}Q${x} ${y} ${f(x-r)} ${y}Q${x} ${y} ${x} ${f(y-r)}Z" fill="#fff" opacity=".9"/>`;
const drum=(P)=>`<ellipse cx="74" cy="126" rx="13" ry="8.4" fill="#6E4226"/><path d="M61 124V131M87 124V131" stroke="#4A2A16" stroke-width=".6"/><ellipse cx="74" cy="122.6" rx="12.4" ry="6.8" fill="#EADBBE"/><ellipse cx="74" cy="122.6" rx="12.4" ry="6.8" fill="none" stroke="#5A3418" stroke-width=".9"/>`+(P.lod?'':`<path d="M63 126L66 121M68 128.6L70 121.2M74 129.4L74.4 121M80 128.6L78.6 121.2M85 126L82.4 121" stroke="#3A2416" stroke-width=".45"/><ellipse cx="71" cy="121" rx="5" ry="2" fill="#fff" opacity=".35"/>`);
const ruffle=(pts,col,dk,P,dy)=>{let d='';for(let i=0;i<pts.length-1;i++){const p=pts[i],q=pts[i+1];if(i===0)d+=`M${f(p[0])} ${f(p[1])}`;d+=`Q${f((p[0]+q[0])/2)} ${f((p[1]+q[1])/2+dy)} ${f(q[0])} ${f(q[1])}`}
 const band=d+`L${f(pts[pts.length-1][0])} ${f(pts[pts.length-1][1]-1.2)}`+pts.slice().reverse().map(p=>`L${f(p[0])} ${f(p[1]-1.2)}`).join('')+'Z';
 return `<path d="${band}" fill="${col}"/>`+P.ln(d,dk,.45,.6)+(P.lod?'':pts.map((p,i)=>i%2?'':P.ln(`M${f(p[0])} ${f(p[1]-.8)}L${f(p[0])} ${f(p[1]+dy*.6)}`,dk,.3,.35)).join(''))};
const along=(P,n,x0,x1)=>sampleBez(P,n*3).filter(p=>p[0]>=x0&&p[0]<=x1);

const OUTS={
 /* ---------- basics (kept from v3 keys) */
 tee:{n:'T-shirt',g:'u',c:'#1F7F7B',L:[{neck:'round:81.6:5.4',sl:'short'}]},
 shirt:{n:'Shirt & tie',g:'u',c:'#8DB7DE',L:[{neck:'v:79.4:5',sl:'long',fx:(X,K,P)=>shirtCollar(K,P)+placket(K,P,79,[92,99,106,113,120,127])+tie('#2A3A5E',P,K,1)+cuffs(K,P,126,3)}]},
 school:{n:'School uniform',g:'u',c:'#F4F4F2',L:[{neck:'v:79.4:4.8',sl:'short',fx:(X,K,P)=>shirtCollar(K,P)+tie('#27365C',P,K,1)+pocket(K,P,59,88,7,7)+'<path d="M60.6 90.6h3.8v3l-1.9 1.2-1.9-1.2z" fill="#27365C"/>'}]},
 fishshirt:{n:'Fisherman\'s shirt',g:'u',c:'#5E86B8',L:[{neck:'v:86:5',sl:'elbow',tex:'check',fx:(X,K,P)=>{const cl='M44.6 73.4L38.8 77.8L45.4 86.4L50 86Z';return P.sh(cl,K.g,K)+P.sh(mirD(cl),K.g,K)+placket(K,P,86,[93,101,109,117,125])+cuffs(K,P,106.4,4.6)+pocket(K,P,59,90,6.4,6)}}]},
 police:{n:'Police uniform',g:'u',c:'#27365C',L:[{neck:'v:79.4:4.6',sl:'short',fx:(X,K,P)=>shirtCollar(K,P)+tie('#111318',P,K)+P.sh('M31.8 79.6L42.6 76.4L43.4 78.8L32.8 82.2Z','#1B2544',pal('#1B2544'))+P.sh(mirD('M31.8 79.6L42.6 76.4L43.4 78.8L32.8 82.2Z'),'#1B2544',pal('#1B2544'))+pocket(K,P,33,92,8,7,'#C9A04F')+pocket(K,P,59,92,8,7,'#C9A04F')+star4(63,89,2.2,'#E6BC4E')}]},
 blouse:{n:'Button blouse',g:'f',c:'#EFE4D2',L:[{neck:'round:79.6:5.2',sl:'short',fx:(X,K,P)=>placket(K,P,80,[85,92,99,106,113])}]},
 /* ---------- women */
 tank:{n:'Tank top',g:'f',c:'#E0715F',L:[{neck:'round:85:7.4',sl:'tank',tex:'rib',fx:(X,K,P)=>P.ln('M39.4 76.4C39 83 36.4 89.4 28.6 93.8',K.dk,.7,.6)+P.ln(mirD('M39.4 76.4C39 83 36.4 89.4 28.6 93.8'),K.dk,.7,.6)}]},
 offsh:{n:'Off-shoulder top',g:'f',c:'#F4EFE8',L:[{sl:'off',cut:`<path d="${OFFCUT}"/>`,inside:(X,K,P)=>P.fold('M30 104C38 106 62 106 70 104',K.dk,1.2,.3),fx:(X,K,P)=>ruffle(along(OFFLINE,14,19.6,80.4).map(p=>[p[0],p[1]+.2]),mix(K.c,'#ffffff',.25),K.dk,P,2.8)+slHem('off',K.dk,.7)+(P.lod?'':P.ln('M21.4 94L27.4 94.6M78.6 94L72.6 94.6',K.dk,.3,.4))}]},
 sundress:{n:'Strappy sundress',g:'f',c:'#86B6E0',L:[{sl:'strap',cut:`<path d="${STRAPCUT}"/>`,tex:'floral',inside:(X,K,P)=>(P.lod?'':[92,94.6,97.2].map(y=>P.ln(`M31 ${y}Q35 ${y+.6} 39 ${y}Q43 ${y+.6} 47 ${y}Q51 ${y+.6} 55 ${y}Q59 ${y+.6} 63 ${y}Q67 ${y+.6} 71 ${y}`,K.dk,.3,.5)).join(''))+P.fold('M40 104C39 114 37 124 36 132',K.dk,1.1,.35)+P.fold('M60 104C61 114 63 124 64 132',K.dk,1.1,.35),
  fx:(X,K,P)=>P.ln('M41.2 88.6L43.4 74.8',K.c,1.1)+P.ln(mirD('M41.2 88.6L43.4 74.8'),K.c,1.1)+P.ln('M38 88.4C42 88 45 89.6 50 90C55 89.6 58 88 62 88.4',K.dk,.5,.6)}]},
 wrap:{n:'Wrap dress',g:'f',c:'#2F8A63',L:[{neck:'v:95:4.8',sl:'elbow',inside:(X,K,P)=>P.fold('M55.2 75.2C52.6 88 45 104 35.6 114.6',K.dk,1.8,.55)+P.ln('M54.8 74.6C52.2 87.4 44.6 103.4 35.2 114',K.lt,.45,.6)+P.fold('M58 100C60 110 62 120 62.6 132',K.dk,1.2,.35),
  fx:(X,K,P)=>{const b=mix(K.c,'#000000',.12);return P.sh('M28.6 113L71.4 113L71.4 116.6L28.6 116.6Z',b,K)+P.sh('M62 114.8C58.4 111.6 57.4 118 62 114.8Z',b,K)+P.sh('M62 114.8C66.6 111.4 67.4 118.2 62 114.8Z',b,K)+P.sh('M61.6 115.6L59.6 124L61.4 124.4L62.6 116Z',b,K)+P.sh('M62.6 115.6L65.4 123.4L63.8 124.2L62 116Z',b,K)}}]},
 maxi:{n:'Tiered maxi dress',g:'f',c:'#D39A3A',L:[{neck:'round:80.6:5.6',sl:'cap',tex:'print2',inside:(X,K,P)=>[108,122].map(y=>P.ln(`M26 ${y}Q50 ${y+1.6} 74 ${y}`,K.dk,.7,.6)+(P.lod?'':[30,36,42,48,54,60,66,70].map(x=>P.ln(`M${x} ${y+1}L${x+.4} ${y+4}`,K.dk,.3,.4)).join(''))).join('')+P.ln('M30 94Q50 96.4 70 94',K.dk,.8,.6),
  fx:(X,K,P)=>ruffle(along([[20.6,87.6],[23,88.4],[26,88.6],[29,87.8]],6,0,100),mix(K.c,'#ffffff',.18),K.dk,P,2.2)+ruffle(along(mir([[20.6,87.6],[23,88.4],[26,88.6],[29,87.8]]).reverse(),6,0,100),mix(K.c,'#ffffff',.18),K.dk,P,2.2)+P.sh('M48.6 94.6C46 92.4 45 97.6 48.6 95.6Z',K.dk,K)+P.sh('M51.4 94.6C54 92.4 55 97.6 51.4 95.6Z',K.dk,K)+P.ln('M49.4 95.8L48.4 102M50.6 95.8L51.6 102',K.dk,.5)}]},
 puff:{n:'Puff-sleeve blouse',g:'f',c:'#FBF6EE',L:[{neck:'high:76.4:5',sl:'elbow',inside:(X,K,P)=>placket(K,P,80,[84,90,96,102,108])+P.fold('M34 98C36 110 36 122 35 132',K.dk,1,.3),
  fx:(X,K,P)=>{const pf='M31.4 79.2C24 77.8 17.2 81.6 16.6 89C16.2 94.4 18.4 98 21.6 99.4C24.6 97 27.4 94.6 28.2 92.4C28.8 87.6 29.8 82.6 31.4 79.2Z';let s=P.sh(pf,K.g,K)+P.sh(mirD(pf),K.g,K);
   if(!P.lod)s+=['M19.4 84C21 88 22.4 93 22.8 97.6','M23.6 81.4C24.6 86 25.6 91 25.6 96','M27.6 80.4C27.8 85 27.6 89.6 27 93.6'].map(d=>P.fold(d,K.dk,.7,.45)+P.fold(mirD(d),K.dk,.7,.45)).join('')+P.shine('M20.6 83C19.4 86 19.4 90 20.4 93',1,.6);
   const cl='M45 74.4C42.8 76.6 42.8 80 45.8 80.8C48 81.2 49.8 79.6 50 77.6Z';s+=P.sh(cl,'#ffffff',K)+P.sh(mirD(cl),'#ffffff',K)+P.ln(cl,K.dk,.35,.5)+P.ln(mirD(cl),K.dk,.35,.5);
   return s+cuffs(K,P,108.4,2.8)}}]},
 crophood:{n:'Crop hoodie',g:'f',c:'#B39DDB',back:K=>hoodBack(K),L:[{c:'#34405E',sl:'none',top:110,fx:(X,K,P)=>BT(50,115.4,GOLD,.7)+P.ln('M50 116.4L50 132',K.lt,.4,.5)},{neck:'round:80:5.4',sl:'long',hem:112.4,inside:(X,K,P)=>`<path d="M20 108.6L80 108.6L80 112.4L20 112.4Z" fill="${K.sh}"/>`+(P.lod?'':P.ln('M20 110.5L80 110.5',K.dk,.5,.4,'stroke-dasharray=".4 .6"'))+P.fold('M36 90C40 96 44 104 46 108',K.dk,1,.3),
  fx:(X,K,P)=>ribBand(K,P,'M44.4 74.6Q50 81.4 55.6 74.6',1.8)+P.ln('M46.8 80.6C46.6 84 46.2 87 46.6 90.4M53.2 80.6C53.4 84 53.8 87 53.4 90.4',K.lt,.6)+`<rect x="46" y="90.2" width="1.2" height="2" rx=".5" fill="#EDE7DC"/><rect x="52.8" y="90.2" width="1.2" height="2" rx=".5" fill="#EDE7DC"/>`+cuffs(K,P,127,3)}]},
 blazer:{n:'Blazer',g:'f',c:'#27365C',L:[{c:'#F4F0E8',neck:'round:80.6:5'},{neck:'v:104:5.6',sl:'long',inside:(X,K,P)=>P.fold('M38 90C39 100 40 110 40 120',K.dk,1,.3),fx:(X,K,P)=>lapel(K,P,44.4,74.25,104,'notch')+BT(50.6,107.6,K.dk,.85)+BT(50.6,116,K.dk,.85)+pocket(K,P,31,114,8,1)+pocket(K,P,61,114,8,1)+cuffs(K,P,128,2)}]},
 abaya:{n:'Abaya',g:'f',c:'#1F1D24',L:[{neck:'round:77.6:5.2',sl:'long',trim:GOLD,inside:(X,K,P)=>`<path d="M48.2 78.2L51.8 78.2L52.2 132L47.8 132Z" fill="${GOLDD}"/>`+(P.lod?'':`<path d="M50 79V132" stroke="${GOLD}" stroke-width="2.2" stroke-dasharray="1 .8"/><path d="M50 79V132" stroke="${GOLDL}" stroke-width=".6" stroke-dasharray=".4 1.4"/>`)+P.shine('M38 84C40 96 40.6 112 40 132',1.6,.18),
  fx:(X,K,P)=>bell(K,P,108)+P.ln(`M${f(aO(108)-6.4)} 131.4L${f(aI(108)+.6)} 131.4`,GOLD,1)+P.ln(mirD(`M${f(aO(108)-6.4)} 131.4L${f(aI(108)+.6)} 131.4`),GOLD,1)+(P.lod?'':P.ln('M44.8 74.9Q50 81.2 55.2 74.9',GOLDL,.5,.8,'stroke-dasharray=".4 .8" transform="translate(0 1.4)"'))}]},
 libaas:{n:'Libaas dress',g:'f',c:'#1F7F7B',L:[{neck:'round:79:5.4',sl:'elbow',inside:(X,K,P)=>P.fold('M36 98C37 108 37 120 36 132',K.dk,1.2,.35)+P.fold('M64 98C63 108 63 120 64 132',K.dk,1.2,.35)+P.shine('M40 86C42 84.6 45 84 47 84.2',1.2,.3),
  fx:(X,K,P)=>`<path d="M44.4 75.4Q50 81.8 55.6 75.4" fill="none" stroke="${GOLD}" stroke-width="2.4"/><path d="M44.4 75.4Q50 81.8 55.6 75.4" fill="none" stroke="${GOLDD}" stroke-width=".7" stroke-dasharray=".5 .8"/><path d="M45.2 77.8Q50 83.6 54.8 77.8" fill="none" stroke="${GOLD}" stroke-width=".55"/><path d="M50 80.8L48.8 84.4L50 88.4L51.2 84.4Z" fill="${GOLD}"/>`+[1,-1].map(k=>{const d=`M${f(aO(108.6)-.4)} 108.6L${f(aI(108.6)+.2)} 108.6`;return P.ln(k>0?d:mirD(d),GOLD,1.6)+P.ln(k>0?d:mirD(d),GOLDD,.5,1,'stroke-dasharray=".4 .7"')}).join('')}]},
 sequin:{n:'Sequin party top',g:'f',c:'#8C6FD6',L:[{c:'#2A2A33',sl:'none',top:113},{neck:'sq:84:6.6',sl:'cap',tex:'sequin',hem:114,inside:(X,K,P)=>P.shine('M30 88C33 100 34 106 34 114',2.4,.35)+P.shine('M60 90C62 98 63 106 63 113',1.4,.25),fx:(X,K,P)=>P.lod?'':sparkle(36,96,1.6)+sparkle(58,90,1.2)+sparkle(44,108,1)+sparkle(66,104,1.4)+sparkle(26,90,1)}]},
 fjersey:{n:'Sports jersey',g:'f',c:'#C8343A',L:[{neck:'v:83:5',sl:'short',inside:(X,K,P)=>P.ln('M29 104L29 132M71 104L71 132',"#ffffff",1.2,.8)},{c:'#1E8A55',neck:'round:80:5',sl:'short',cut:`<path d="${RAGLAN}"/>`},{c:'#C8343A',sl:'none',cut:'<rect x="0" y="0" width="100" height="200"/>',fx:(X,K,P)=>P.ln('M44.6 74.2L50 83L55.4 74.2','#1E8A55',1.8)+P.ln('M45.2 75.6L50 83.6L54.8 75.6','#ffffff',.5)+number('10',60,103,'#ffffff',8)}]},
 fdenim:{n:'Denim jacket',g:'f',c:'#6E95C4',L:[{c:'#F4F0E8',neck:'round:80:5'},{neck:'open:0:5.2',sl:'long',tex:'denim',inside:(X,K,P)=>P.ln('M20 87.6C30 86 40 86.6 47 87M53 87C60 86.6 70 86 80 87.6',"#E0A052",.4,.8,'stroke-dasharray=".7 .5"')+P.ln('M20 122L80 122',K.dk,.8,.6),
  fx:(X,K,P)=>{const cl='M44.8 73.4L38.2 78.8L43 84.4L46.8 80Z';return P.sh(cl,mix(K.c,'#ffffff',.1),K)+P.sh(mirD(cl),mix(K.c,'#ffffff',.1),K)+pocket(K,P,33,90,8,6,'#C9A04F')+pocket(K,P,59,90,8,6,'#C9A04F')+BT(46.4,96,'#C9A04F',.5)+BT(46.4,106,'#C9A04F',.5)+BT(46.4,116,'#C9A04F',.5)+cuffs(K,P,127,3)}}]},
 kaftan:{n:'Beach kaftan',g:'f',c:'#3FA7B5',L:[{neck:'v:90:4.6',sl:'long',tex:'print',trim:GOLD,fx:(X,K,P)=>{const w='M33 79C24 80.4 16.4 87 12 99C10 104.6 10.6 110 12.4 113C18 114.6 23.4 114 27.6 111.6L28.2 93Z';
   return P.sh(w,K.g,K)+P.sh(mirD(w),K.g,K)+P.fold('M26 84C21 90 17 98 15.6 108',K.dk,1.2,.4)+P.fold(mirD('M26 84C21 90 17 98 15.6 108'),K.dk,1.2,.4)+P.ln('M12.4 113C18 114.6 23.4 114 27.6 111.6',GOLD,.9)+P.ln(mirD('M12.4 113C18 114.6 23.4 114 27.6 111.6'),GOLD,.9)+P.ln('M50 90L49 97M50 90L51 97.4',GOLD,.5)+BT(49,97.4,GOLD,.6)+BT(51,97.8,GOLD,.6)}}]},
 cardigan:{n:'Cardigan',g:'f',c:'#D9C3A0',L:[{c:'#2F3B55',neck:'round:79.4:5'},{neck:'v:114:6.2',sl:'long',tex:'knit',fx:(X,K,P)=>P.ln('M43.8 74.5L50 114',mix(K.c,'#ffffff',.2),2.2)+P.ln('M56.2 74.5L50 114',mix(K.c,'#ffffff',.2),2.2)+BT(47.4,96,K.dk,.6)+BT(48.4,103,K.dk,.6)+BT(49.2,110,K.dk,.6)+cuffs(K,P,126,4)+pocket(K,P,31,116,8,.1)}]},
 fgrad:{n:'Graduation gown',g:'f',c:'#1E1F2A',hat:'grad',L:[{c:'#F4F0E8',neck:'round:78:5'},{neck:'v:100:6',sl:'long',fx:(X,K,P)=>bell(K,P,100)+P.sh('M44 74.2L40.6 74.8C42 90 44.6 110 45 132L49.2 132C48.6 110 47 90 44 74.2Z','#C9A04F',pal('#C9A04F'))+P.sh(mirD('M44 74.2L40.6 74.8C42 90 44.6 110 45 132L49.2 132C48.6 110 47 90 44 74.2Z'),'#1F7F7B',pal('#1F7F7B'))}]},
 /* ---------- men */
 mtank:{n:'Tank top',g:'m',c:'#C9CBD0',L:[{neck:'round:86:7.6',sl:'tank',tex:'rib',fx:(X,K,P)=>P.ln('M39.4 76.4C39 83 36.4 89.4 28.6 93.8',K.dk,.7,.6)+P.ln(mirD('M39.4 76.4C39 83 36.4 89.4 28.6 93.8'),K.dk,.7,.6)}]},
 polo:{n:'Polo shirt',g:'m',c:'#27365C',L:[{neck:'v:81:3.6',sl:'short',fx:(X,K,P)=>{const cl='M44.6 73.2L40.8 77.6L46.6 79.4L49.4 76.8Z';return P.sh(cl,mix(K.c,'#ffffff',.1),K)+P.sh(mirD(cl),mix(K.c,'#ffffff',.1),K)+P.sh('M48.6 77L51.4 77L51.4 88L48.6 88Z',mix(K.c,'#000000',.1),K)+BT(50,81,K.lt,.5)+BT(50,85.4,K.lt,.5)+slHem('short','#ffffff',.6)+(P.lod?'':P.sh('M60.6 88.6L62.4 85.6L64.2 88.6Z','#F2C14E',pal('#F2C14E')))}}]},
 hawaii:{n:'Resort shirt',g:'m',c:'#1F8F8A',L:[{neck:'v:88:5',sl:'short',tex:'hawaii',fx:(X,K,P)=>{const cl='M44.6 73.4L38.6 77.6L44.4 86.6L49.6 88Z';return P.sh(cl,K.g,K)+P.sh(mirD(cl),K.g,K)+P.fold(cl.replace(/Z$/,''),K.dk,.9,.5)+P.fold(mirD(cl).replace(/Z$/,''),K.dk,.9,.5)+placket(K,P,88,[95,104,113,122])}}]},
 mlinen:{n:'Linen shirt',g:'m',c:'#F1ECE3',L:[{neck:'v:92:5.2',sl:'elbow',tex:'linen',fx:(X,K,P)=>{const cl='M44.6 73.4L38.8 77.8L45.4 88.4L50 92Z';return P.sh(cl,mix(K.c,'#ffffff',.3),K)+P.sh(mirD(cl),mix(K.c,'#ffffff',.3),K)+P.fold(cl.replace(/Z$/,''),K.dk,.8,.5)+P.fold(mirD(cl).replace(/Z$/,''),K.dk,.8,.5)+placket(K,P,92,[98,107,116,125])+cuffs(K,P,106.4,4.6)+pocket(K,P,60,92,6.4,6)}}]},
 suit:{n:'Suit & tie',g:'m',c:'#3A3D48',L:[{c:'#F4F4F2',neck:'v:79:4.6',sl:'long',fx:(X,K,P)=>shirtCollar(K,P)+tie('#8E2F45',P,K,1)},{neck:'v:106:5.8',sl:'long',inside:(X,K,P)=>P.fold('M38 92C39 102 40 112 40 124',K.dk,1,.3),fx:(X,K,P)=>lapel(K,P,44.2,74.34,106,'notch')+BT(50.6,110,K.dk,.8)+BT(50.6,118,K.dk,.8)+pocket(K,P,31,116,9,1)+pocket(K,P,60,116,9,1)+P.sh('M60.4 88.6L63.4 86.4L65.6 88.4L68.4 87L68.4 89.4L60.4 89.4Z','#F4F0E8',pal('#F4F0E8'))+P.ln('M59.8 89.6L68.8 89.6',K.dk,.6)}]},
 hoodie:{n:'Hoodie',g:'u',c:'#23734F',back:K=>hoodBack(K),L:[{neck:'round:80.6:5.6',sl:'long',inside:(X,K,P)=>P.ln('M38 132L40 112L60 112L62 132',K.dk,.7,.55)+P.fold('M40 112L38 132',K.dk,1.2,.35)+ribBand(K,P,'M20 129.6L80 129.6',2.4),fx:(X,K,P)=>ribBand(K,P,'M44.2 74.6Q50 81.6 55.8 74.6',2)+P.ln('M46.6 80.4C46.4 84 46 87 46.4 90.4M53.4 80.4C53.6 84 54 87 53.6 90.4','#F4F0E8',.7)+`<rect x="45.8" y="90.2" width="1.2" height="2" rx=".5" fill="#C9C2B5"/><rect x="53" y="90.2" width="1.2" height="2" rx=".5" fill="#C9C2B5"/>`+cuffs(K,P,127,3)}]},
 bomber:{n:'Bomber jacket',g:'m',c:'#55603F',L:[{c:'#2A2A33',neck:'round:80:5'},{neck:'open:0:4.4',sl:'long',inside:(X,K,P)=>P.shine('M24 88C22.6 96 22 104 22 112',2,.35)+P.shine('M36 84C38 83 41 82.6 43 82.8',1.6,.35)+ribBand(K,P,'M20 129L80 129',3)+P.fold('M34 100C38 101 42 101 45 100',K.dk,1,.35),
  fx:(X,K,P)=>ribBand(K,P,'M43.8 73.4C46 75.4 54 75.4 56.2 73.4',2.2)+P.ln('M45.4 76C46.4 88 47.6 106 47.8 132',"#C9C2B5",.5,.8,'stroke-dasharray=".4 .4"')+P.ln('M54.6 76C53.6 88 52.4 106 52.2 132',"#C9C2B5",.5,.8,'stroke-dasharray=".4 .4"')+P.sh('M21.6 96L26.6 96.4L26.4 101.6L21.4 101.2Z',mix(K.c,'#000000',.12),K)+P.ln('M22 97.4L26 97.7','#C9C2B5',.4)+cuffs(K,P,126,4)}]},
 leather:{n:'Leather jacket',g:'m',c:'#1E1C21',L:[{c:'#E6E2DA',neck:'round:80:5'},{neck:'open:0:5.6',sl:'long',inside:(X,K,P)=>P.shine('M24 86C22.6 94 22 104 21.8 114',1.8,.4)+P.shine('M33 84C35 96 36 106 36 118',1.2,.3)+P.ln('M32 104L40 98',"#9A9AA2",.5)+P.ln('M60 98L68 104',"#9A9AA2",.5)+ribBand(K,P,'M20 128.6L80 128.6',2.4),
  fx:(X,K,P)=>lapel(K,P,44.4,74.25,98,'wide',mix(K.c,'#ffffff',.06))+BT(38.2,78.6,'#B9BCC4',.5)+BT(61.8,78.6,'#B9BCC4',.5)+P.ln('M55.4 88C55 100 54.6 112 54.4 132','#9A9AA2',.5,.9,'stroke-dasharray=".4 .4"')+cuffs(K,P,126,4)}]},
 jersey:{n:'Football jersey',g:'m',c:'#1F6FB8',L:[{neck:'round:79.6:5',sl:'short',inside:(X,K,P)=>P.ln('M26 82C31 80.4 36 79 41 77.6',"#ffffff",1.2,.9)+P.ln(mirD('M26 82C31 80.4 36 79 41 77.6'),"#ffffff",1.2,.9),fx:(X,K,P)=>P.ln('M44.6 74.3Q50 83.2 55.4 74.3','#ffffff',1.6)+number('7',50,110,'#ffffff',14)+slHem('short','#ffffff',.9)}]},
 feyli:{n:'Feyli sarong & shirt',g:'m',c:'#F2EEE6',L:[{neck:'round:78.6:5',sl:'short',fx:(X,K,P)=>placket(K,P,79,[84,90,96,102,108])},{c:'#F7F4EE',sl:'none',top:113,tex:'feyli',fx:(X,K,P)=>P.ln('M27 113.4L73 113.4',K.dk,.8,.6)+P.fold('M40 116L39 132M58 116L60 132',K.dk,1.2,.35)+P.sh('M27.2 112.6L72.8 112.6L72.8 115.4L27.2 115.4Z','#EFEBE3',K)+P.fold('M28 115.2L72 115.2',K.dk,.9,.45)+P.fold('M44 115.6C45 118 46.4 120 48 121',K.dk,.8,.4)}]},
 kurta:{n:'Kurta',g:'m',c:'#EFE4D2',L:[{neck:'high:75.4:4.6',sl:'long',inside:(X,K,P)=>`<path d="M48.4 76L51.6 76L51.6 100L48.4 100Z" fill="#8E2F45"/>`+(P.lod?'':`<path d="M50 77V99" stroke="${GOLD}" stroke-width="1.8" stroke-dasharray=".6 .7"/>`)+[80,86,92].map(y=>BT(50,y,GOLD,.5)).join('')+P.fold('M38 96C39 106 39 118 38 132',K.dk,1,.3)+P.fold('M62 96C61 106 61 118 62 132',K.dk,1,.3),
  fx:(X,K,P)=>P.sh('M44.8 71.4C47 73 53 73 55.2 71.4L55.4 75.2C53 76.8 47 76.8 44.6 75.2Z','#8E2F45',pal('#8E2F45'))+(P.lod?'':P.ln('M45.2 73.8C47.4 75.2 52.6 75.2 54.8 73.8',GOLD,.5,1,'stroke-dasharray=".5 .5"'))+cuffs(K,P,127,3)}]},
 tux:{n:'Tuxedo',g:'m',c:'#16161C',L:[{c:'#FFFFFF',neck:'v:79:4.4',sl:'long',inside:(X,K,P)=>P.lod?'':P.ln('M47.4 80V110M52.6 80V110',"#D9D6D0",.35)+[88,95,102].map(y=>BT(50,y,'#1A1A20',.45)).join(''),fx:(X,K,P)=>{const cl='M45.6 72.8L44 77.4L48.4 77.6Z';return P.sh(cl,'#ffffff',K)+P.sh(mirD(cl),'#ffffff',K)+`<path d="M50 78L45.4 75.6L45.2 80.6Z" fill="#111114"/><path d="M50 78L54.6 75.6L54.8 80.6Z" fill="#111114"/><circle cx="50" cy="78" r="1.1" fill="#26262E"/>`}},{neck:'v:110:6',sl:'long',fx:(X,K,P)=>lapel(K,P,44,74.42,110,'shawl','#2B2B34')+BT(50.6,113,'#2B2B34',.8)+P.sh('M61 88.6L63.6 86.4L66 88.4L68.6 87L68.6 89.4L61 89.4Z','#ffffff',pal('#ffffff'))}]},
 mdenim:{n:'Denim jacket',g:'m',c:'#5E86B8',L:[{c:'#2A2A33',neck:'round:80:5'},{neck:'open:0:5.2',sl:'long',tex:'denim',inside:(X,K,P)=>P.ln('M20 87.6C30 86 40 86.6 47 87M53 87C60 86.6 70 86 80 87.6',"#E0A052",.4,.8,'stroke-dasharray=".7 .5"')+P.ln('M20 122L80 122',K.dk,.8,.6),
  fx:(X,K,P)=>{const cl='M44.8 73.4L38.2 78.8L43 84.4L46.8 80Z';return P.sh(cl,mix(K.c,'#ffffff',.1),K)+P.sh(mirD(cl),mix(K.c,'#ffffff',.1),K)+pocket(K,P,33,90,8,6,'#C9A04F')+pocket(K,P,59,90,8,6,'#C9A04F')+BT(46.4,96,'#C9A04F',.5)+BT(46.4,106,'#C9A04F',.5)+BT(46.4,116,'#C9A04F',.5)+cuffs(K,P,127,3)}}]},
 track:{n:'Tracksuit',g:'m',c:'#C8343A',L:[{c:'#F4F0E8',neck:'round:80:5'},{neck:'v:92:4.4',sl:'long',inside:(X,K,P)=>P.ln('M50 92L50 132','#DAD6CE',.7,.9,'stroke-dasharray=".35 .35"')+ribBand(K,P,'M20 129.6L80 129.6',2.4),
  fx:(X,K,P)=>P.sh('M44.8 70.6L45.4 75.4L50 92L44 76.4L43.6 71.4Z',mix(K.c,'#000000',.1),K)+P.sh(mirD('M44.8 70.6L45.4 75.4L50 92L44 76.4L43.6 71.4Z'),mix(K.c,'#000000',.1),K)+[['M22.2 86.4C21.4 96 20.8 112 20.4 132',1],['M24 84.6C23.2 96 22.6 112 22.2 132',1]].map(a=>P.ln(a[0],'#ffffff',.9)+P.ln(mirD(a[0]),'#ffffff',.9)).join('')+`<rect x="49.2" y="91.6" width="1.6" height="3" rx=".5" fill="#C9C2B5"/>`}]},
 mgrad:{n:'Graduation gown',g:'m',c:'#1E1F2A',hat:'grad',L:[{c:'#F4F4F2',neck:'v:79:4.6',sl:'long',fx:(X,K,P)=>shirtCollar(K,P)+tie('#27365C',P,K)},{neck:'v:100:6',sl:'long',fx:(X,K,P)=>bell(K,P,100)+P.sh('M44 74.2L40.6 74.8C42 90 44.6 110 45 132L49.2 132C48.6 110 47 90 44 74.2Z','#C9A04F',pal('#C9A04F'))+P.sh(mirD('M44 74.2L40.6 74.8C42 90 44.6 110 45 132L49.2 132C48.6 110 47 90 44 74.2Z'),'#8E2F45',pal('#8E2F45'))}]},
 athletic:{n:'Sleeveless athletic',g:'m',c:'#F2B33D',L:[{neck:'v:84:5.4',sl:'ath',tex:'mesh',fx:(X,K,P)=>P.ln('M36.8 77.4C36.4 84 33.8 89.8 28.8 94.4','#5B2C8C',1.3)+P.ln(mirD('M36.8 77.4C36.4 84 33.8 89.8 28.8 94.4'),'#5B2C8C',1.3)+P.ln('M44.6 74.2L50 84L55.4 74.2','#5B2C8C',1.5)+number('23',50,108,'#5B2C8C',10)+P.ln('M33 130L67 130','#5B2C8C',1)}]},
 /* ---------- fun costumes (both) */
 pirate:{n:'Pirate',g:'c',c:'#2B2530',hat:'tricorn',L:[{c:'#F3EEE4',neck:'v:95:5',sl:'long',tex:'stripe',acc:'#2A3A5E',fx:(X,K,P)=>P.ln('M47.6 82L52.4 84M47.8 86L52.2 88M48.2 90L51.8 92',"#6B4125",.5)+cuffs(K,P,126,3)},{neck:'open:0:9.6',sl:'none',fx:(X,K,P)=>BT(41.6,92,GOLD,.7)+BT(42.6,102,GOLD,.7)+BT(58.4,92,GOLD,.7)+BT(57.4,102,GOLD,.7)+P.sh('M27.4 114L72.6 114L72.6 120.4L27.4 120.4Z','#B8283A',pal('#B8283A'))+P.sh('M33 118L29 132L33.6 132L35.4 120Z','#B8283A',pal('#B8283A'))+P.fold('M28 116.6L72 116.6',"#6A1520",.8,.5)}]},
 chef:{n:'Chef',g:'c',c:'#FBFAF7',hat:'chef',L:[{neck:'high:75.4:5',sl:'long',inside:(X,K,P)=>P.fold('M58.4 76C58.8 92 59.2 112 59.2 132',K.dk,1.1,.45)+P.ln('M58 76C58.4 92 58.8 112 58.8 132','#D9D4CA',.5)+[86,96,106,116].map(y=>BT(44.6,y,'#C9C2B5',.7)+BT(55.4,y,'#C9C2B5',.7)).join(''),fx:(X,K,P)=>P.sh('M45 74.4L55 74.4L52.6 79.6L50 78L47.4 79.6Z','#D9463C',pal('#D9463C'))+P.sh('M48.2 78.6L51.8 78.6L52.6 83L50 82L47.4 83Z','#D9463C',pal('#D9463C'))+cuffs(K,P,126,4)}]},
 pilot:{n:'Pilot',g:'c',c:'#FFFFFF',hat:'pilot',L:[{neck:'v:79.4:4.6',sl:'short',fx:(X,K,P)=>shirtCollar(K,P)+tie('#1F2433',P,K)+[[1],[-1]].map(()=>'').join('')+P.sh('M31.8 79.6L42.6 76.4L43.4 78.8L32.8 82.2Z','#1F2433',pal('#1F2433'))+P.sh(mirD('M31.8 79.6L42.6 76.4L43.4 78.8L32.8 82.2Z'),'#1F2433',pal('#1F2433'))+P.ln('M34.8 80.2L41.6 78.2M35.4 81.4L41.9 79.4',GOLD,.35)+P.ln(mirD('M34.8 80.2L41.6 78.2M35.4 81.4L41.9 79.4'),GOLD,.35)+P.sh('M58 87.6C60 86.6 62 86.6 63 87.4C64 86.6 66 86.6 68 87.6C66 88.8 64 88.8 63 88.4C62 88.8 60 88.8 58 87.6Z',GOLD,pal(GOLD))+pocket(K,P,33,92,8,7)+pocket(K,P,59,92,8,7)}]},
 astro:{n:'Astronaut',g:'c',c:'#EFEFEC',hat:'helmet',L:[{neck:'high:74.4:6.6',sl:'long',inside:(X,K,P)=>P.ln('M30 84C34 90 36 100 36 132M70 84C66 90 64 100 64 132',K.dk,.5,.4)+P.fold('M40 104C44 106 56 106 60 104',K.dk,1.2,.35),fx:(X,K,P)=>`<path d="M42.4 73.2C45 75.6 55 75.6 57.6 73.2L58 76.6C55 79.6 45 79.6 42 76.6Z" fill="#9AA3AE"/><path d="M42.6 74C45 76.2 55 76.2 57.4 74" stroke="#E6EBF0" stroke-width=".6" fill="none"/>`+P.sh('M43 92L57 92L57 102L43 102Z','#D9DCE0',pal('#D9DCE0'))+`<circle cx="46" cy="95" r=".9" fill="#D9463C"/><circle cx="49" cy="95" r=".9" fill="#3DB8F5"/><circle cx="52" cy="95" r=".9" fill="#F2C14E"/><rect x="45" y="98" width="10" height="1.8" rx=".6" fill="#3A4A5C"/><circle cx="25.4" cy="88" r="2.6" fill="#27365C"/>`+star4(25.4,88,1.7,'#fff')+P.ln('M38 104C36 110 34 116 34.6 122','#9AA3AE',1.4)+cuffs(K,P,124,6)}]},
 hero:{n:'Superhero',g:'c',c:'#2F5FD0',back:()=>capeBack('#D9363E'),L:[{neck:'round:77:5',sl:'long',inside:(X,K,P)=>P.shine('M34 86C36 96 37 104 37 112',1.8,.35)+P.fold('M40 108C44 110 56 110 60 108',K.dk,1.2,.4),fx:(X,K,P)=>P.sh('M50 84L58 92L50 101L42 92Z','#F2C14E',pal('#F2C14E'))+star4(50,92.2,4.2,'#D9363E')+P.sh('M27.6 117L72.4 117L72.4 121L27.6 121Z','#F2C14E',pal('#F2C14E'))+`<rect x="47.4" y="116.4" width="5.2" height="5.2" rx="1" fill="#D9A43A"/>`+BT(35.4,78.4,GOLD,1.3)+BT(64.6,78.4,GOLD,1.3)+cuffs(Object.assign(pal('#D9363E'),{c:'#D9363E'}),P,122,10)}]},
 boduberu:{n:'Boduberu performer',g:'c',c:'#F4F0E8',L:[{neck:'round:78.6:5',sl:'short'},{c:'#F7F4EE',sl:'none',top:113,tex:'feyli'},{c:'#8E2430',sl:'none',cut:'<rect x="0" y="0" width="100" height="200"/>',fx:(X,K,P)=>P.sh('M24.6 81.4L29.8 79.4L80 120L72 124Z','#8E2430',pal('#8E2430'))+P.ln('M27.2 80.4L76 122','#E0B34A',.9,1,'stroke-dasharray="1.6 .8"')+drum(P)}]},
 diver:{n:'Diver',g:'c',c:'#1D2027',hat:'divemask',L:[{neck:'high:74.4:5.2',sl:'long',inside:(X,K,P)=>P.sh('M31.6 79.4C29.4 83.4 28.2 87.6 28 92L28 132L33 132C34 110 34 92 38.6 77.6Z','#1FA3A0',pal('#1FA3A0'))+P.sh(mirD('M31.6 79.4C29.4 83.4 28.2 87.6 28 92L28 132L33 132C34 110 34 92 38.6 77.6Z'),'#1FA3A0',pal('#1FA3A0'))+P.shine('M24 88C22.6 96 22 104 22 112',1.6,.4)+P.shine('M40 84C42 83 45 82.6 47 82.8',1.4,.35),fx:(X,K,P)=>P.ln('M50 75L50 97','#9AA3AE',.8,1,'stroke-dasharray=".4 .35"')+`<rect x="49.1" y="96.4" width="1.8" height="3.4" rx=".6" fill="#C9CDD4"/>`+P.ln('M30 104L70 104','#1FA3A0',1.2)}]},
 trench:{n:'Detective',g:'c',c:'#B8955E',hat:'deerstalker',L:[{c:'#F4F0E8',neck:'v:79:4.6',sl:'long',fx:(X,K,P)=>shirtCollar(K,P)+tie('#7A2233',P,K)},{neck:'v:102:6.4',sl:'long',inside:(X,K,P)=>P.fold('M36 96C38 108 38 120 37 132',K.dk,1.2,.4)+P.fold('M64 96C62 108 62 120 63 132',K.dk,1.2,.4),fx:(X,K,P)=>P.sh('M43.6 74.4L40.4 67.8L37.2 71.6L38.8 78Z',mix(K.c,'#000000',.12),K)+P.sh(mirD('M43.6 74.4L40.4 67.8L37.2 71.6L38.8 78Z'),mix(K.c,'#000000',.12),K)+lapel(K,P,43.6,74.59,102,'wide')+BT(44.6,106,'#3A2A1A',.8)+BT(55.4,106,'#3A2A1A',.8)+BT(44.6,112,'#3A2A1A',.8)+BT(55.4,112,'#3A2A1A',.8)+P.sh('M27.4 117L72.6 117L72.6 121L27.4 121Z',mix(K.c,'#000000',.2),K)+`<rect x="47.6" y="116.4" width="4.8" height="5.2" rx=".6" fill="none" stroke="#6B5B3E" stroke-width=".8"/>`+P.sh('M27 83L33.6 80.8L34 83L27.6 85.2Z',mix(K.c,'#000000',.15),K)+P.sh(mirD('M27 83L33.6 80.8L34 83L27.6 85.2Z'),mix(K.c,'#000000',.15),K)+cuffs(K,P,126,3)}]},
 royal:{n:'Royal robe',g:'c',c:'#8E1B2C',hat:'crown',back:()=>capeBack('#7A1626'),L:[{c:'#F4E7C8',neck:'round:78:5',sl:'long',tex:'print',fx:(X,K,P)=>''},{neck:'open:0:9',sl:'long',inside:(X,K,P)=>P.shine('M24 86C22.6 96 22 106 22 116',2.2,.3)+P.shine('M36 90C37 100 38 110 38 120',1.4,.25),fx:(X,K,P)=>{const fur='M20.6 92C22 82 30 77.4 41 75.6L43 79.8C36 81.4 31.4 85 29.4 92.8L28 132L22.6 132C22.4 118 21.4 104 20.6 92Z';let s=P.sh(fur,'#FBF8F1',pal('#FBF8F1'))+P.sh(mirD(fur),'#FBF8F1',pal('#FBF8F1'));
   if(!P.lod){const spots=[[25,90],[24.4,102],[25.4,114],[24.8,126],[33,82],[27.4,96],[27,108],[27,120]];spots.forEach(([x,y])=>{s+=`<path d="M${x} ${y}l-.5 1.6h1z" fill="#1A1A1A"/><path d="M${f(100-x)} ${y}l-.5 1.6h1z" fill="#1A1A1A"/>`})}
   s+=P.ln('M34 84Q50 100 66 84',GOLD,.9)+`<circle cx="50" cy="93.6" r="2.6" fill="${GOLD}"/><circle cx="50" cy="93.6" r="1.4" fill="#B8283A"/>`;return s}}]}
};
function outfitBack(X,c,O){return O.back?O.back(pal(X.oc||O.c)):''}
function garment(X,c,O){const P=paint(X),u=X.u;let s='';const main=O.L.length-1;
 O.L.forEach((Ly,i)=>{const col=(i===main&&X.oc&&O.g!=='c')?X.oc:(Ly.c||O.c);const K=pal(col),id=`§m${i}`,gid=`§g${i}`,pid=`§p${i}`;K.acc=Ly.acc;
  K.g=P.r3?col:`url(#${gid})`;
  s+=`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="16" y1="0" x2="84" y2="0"><stop offset="0" stop-color="${mix(col,'#000000',.2)}"/><stop offset=".28" stop-color="${mix(col,'#ffffff',.12)}"/><stop offset=".58" stop-color="${col}"/><stop offset="1" stop-color="${mix(col,'#000000',.34)}"/></linearGradient>`;
  const sl=Ly.sl||'short';
  s+=`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="140"><path d="${SIL}" fill="#fff"/><g fill="#000">${nkCut(Ly.neck)}${slCut(sl)}${Ly.hem?`<rect x="0" y="${Ly.hem}" width="100" height="40"/>`:''}${Ly.top?`<rect x="0" y="0" width="100" height="${Ly.top}"/>`:''}${Ly.cut||''}</g></mask>`;
  let inner=`<rect x="0" y="60" width="100" height="80" fill="${K.g}"/>`+texture(X,Ly.tex,K,pid);
  if(P.r3)inner+=`<path d="M66 79C76 81.6 80 86 80.4 100L80.8 132L68 132C69 110 69 92 66 79Z" fill="${K.dk}" opacity=".42"/>`;
  else if(!X.lod)inner+=P.fold(ARML,K.dk,1.6,.5)+P.fold(mirD(ARML),K.dk,1.6,.55)+P.fold('M33.6 96C35 106 35.4 118 34.8 132',K.dk,1.2,.3)+P.fold('M66.4 96C65 106 64.6 118 65.2 132',K.dk,1.2,.36)+P.fold('M24 86C22.6 92 22 100 21.8 108',K.lt,1.6,.3)+P.fold('M40 80.6C44 83.6 56 83.6 60 80.6',K.dk,1.4,.25);
  if(!P.r3&&(X.st==='r2'||X.lod))inner+=`<path d="M65.4 78.6C73.4 80.3 78.2 84 79 90.6C79.8 100 80.4 116 80.8 132" fill="none" stroke="#fff" stroke-width="${X.lod?1.4:1}" opacity=".5"/>`;
  if(Ly.neck)inner+=`<path d="${nkEdge(Ly.neck)}" fill="none" stroke="${Ly.trim||(P.r3?K.ol:K.dk)}" stroke-width="${Ly.trim?1.6:.9}" opacity="${Ly.trim?1:.6}"/>`;
  inner+=slHem(sl,P.r3?K.ol:K.dk);
  if(Ly.inside)inner+=Ly.inside(X,K,P);
  s+=`<g mask="url(#${id})">${inner}</g>`;
  if(Ly.fx)s+=Ly.fx(X,K,P);
 });
 return s}
function necklace(X,c){const n=c.neck;if(!n||n==='none')return '';const g='#D8AE52',gl='#FFE7A8';const m=X.m;const y=m?77.6:78;
 if(n==='chain')return `<path d="M${m?44.4:45.2} 74.4Q50 ${y+8} ${m?55.6:54.8} 74.4" fill="none" stroke="${g}" stroke-width=".7"/><path d="M${m?44.4:45.2} 74.4Q50 ${y+8} ${m?55.6:54.8} 74.4" fill="none" stroke="${gl}" stroke-width=".3" stroke-dasharray=".5 .7"/><path d="M50 ${y+4}l-1.4 1.6 1.4 2.4 1.4-2.4z" fill="${g}"/>`;
 if(n==='pearls'){let s='';for(let i=0;i<=14;i++){const t=i/14,x=45.2+(54.8-45.2)*t,yy=74.6+(1-(2*t-1)**2)*7;s+=`<circle cx="${f(x)}" cy="${f(yy)}" r=".78" fill="#F7F1E8" stroke="#CFC3B3" stroke-width=".2"/><circle cx="${f(x-.25)}" cy="${f(yy-.25)}" r=".22" fill="#fff"/>`}return s}
 if(n==='shells'){let s=`<path d="M44.6 74.4Q50 84 55.4 74.4" fill="none" stroke="#6A4A2E" stroke-width=".35"/>`;[[46.4,78.4],[48.2,80.2],[50,80.8],[51.8,80.2],[53.6,78.4]].forEach(([x,yy])=>{s+=`<ellipse cx="${x}" cy="${yy+.6}" rx="1" ry="1.4" fill="#F4E9D6" stroke="#B9A488" stroke-width=".25"/><path d="M${x} ${yy-.4}V${yy+1.6}" stroke="#8C7556" stroke-width=".25"/>`});return s}
 const x0=m?44.4:45.2,x1=100-x0;
 if(n==='necklace')return `<path d="M${x0} 74.4Q50 ${y+6} ${x1} 74.4" fill="none" stroke="${g}" stroke-width=".45"/><path d="M50 ${y+2.6}l1.2 1.7-1.2 1.7-1.2-1.7z" fill="${g}"/><circle cx="49.7" cy="${y+3.8}" r=".35" fill="#fff" opacity=".8"/>`;
 if(n==='beads'){let s='';const C=['#E5484D','#FFC93C','#3DB8F5','#2FB67C'];for(let i=0;i<=11;i++){const t=i/11,x=x0+(x1-x0)*t,yy=74.8+(1-(2*t-1)**2)*6.6;s+=`<circle cx="${f(x)}" cy="${f(yy)}" r=".85" fill="${C[i%4]}"/><circle cx="${f(x-.25)}" cy="${f(yy-.25)}" r=".25" fill="#fff" opacity=".6"/>`}return s}
 if(n==='bowtie')return `<path d="M45.6 75.6L49.2 77.6L45.6 79.6ZM54.4 75.6L50.8 77.6L54.4 79.6Z" fill="#C7283A"/><rect x="48.8" y="76.5" width="2.4" height="2.3" rx=".7" fill="#9E1B2C"/>`;
 if(n==='medal')return `<path d="M${x0-.6} 74.2L48.6 86H51.4L${x1+.6} 74.2H${x1-2.4}L50 82.6L${x0+2.4} 74.2Z" fill="#D21034"/><path d="M${x0+2.4} 74.2L50 82.6L${x1-2.4} 74.2H${x1-4.2}L50 78.6L${x0+4.2} 74.2Z" fill="#007E3A"/><circle cx="50" cy="88.6" r="3.4" fill="#F2C14E"/><circle cx="50" cy="88.6" r="2.4" fill="#E0A92E"/>`+star4(50,88.8,1.6,'#FFE39A');
 return ''}
const HAT4={cap:1,bucket:1,beanie:1,straw:1,chef:1,deerstalker:1,crown:1,gradcap:1,pilot:1,spacehelmet:1,divemask:1,tiara:1};
function hat4(X,h,hc){const r3=false;let s='';const col=/^(cap|bucket|beanie)$/.test(h)&&hc?hc:({straw:'#D8B57A'}[h]||'#888888');const dk=mix(col,'#000',.3),lt=mix(col,'#fff',.3),ol=mix(col,'#000',.6);const bl=(!X.nf&&!r3)?`filter="url(#§bl)"`:'';
 if(h==='cap'){const C='M30.4 33C29.8 20 38 12.4 50 12.4C62 12.4 70.2 20 69.6 33C62 30.4 38 30.4 30.4 33Z',B='M29 32.2C38 29.2 62 29.2 71 32.2C73.2 33.4 72.2 36 70 35.8C60 34.2 40 34.2 30 35.8C27.8 36 26.8 33.4 29 32.2Z';
  s+=`<path d="M31 36C40 34.4 60 34.4 69 36" stroke="#000" stroke-width="2.4" opacity=".25" fill="none" ${bl}/><path d="${C}" fill="${col}"/>`+(r3?'':`<path d="M50 12.4C62 12.4 70.2 20 69.6 33C66 31.8 62 31.2 58 31C60 25 58 17 50 12.4Z" fill="${dk}" opacity=".45"/>`)+`<path d="M50 12.6V30.6M40 14.6C38 20 37.6 26 38 30.8M60 14.6C62 20 62.4 26 62 30.8" stroke="${dk}" stroke-width=".4" fill="none"/><circle cx="50" cy="12.8" r="1.1" fill="${dk}"/><path d="${B}" fill="${dk}"/><path d="M30 33C40 30.6 60 30.6 70 33" stroke="${lt}" stroke-width=".5" fill="none" opacity=".7"/>`;if(r3)s+=`<path d="${C}" fill="none" stroke="${ol}" stroke-width=".5"/><path d="${B}" fill="none" stroke="${ol}" stroke-width=".5"/>`}
 if(h==='bucket'){const C='M34 30C34 20 40 14.6 50 14.6C60 14.6 66 20 66 30Z',B='M26 33.6C30 29.4 40 28.4 50 28.4C60 28.4 70 29.4 74 33.6C70 35.4 62 35 50 35C38 35 30 35.4 26 33.6Z';s+=`<path d="${B}" fill="${dk}"/><path d="${C}" fill="${col}"/><path d="M34.2 28.4C42 27.2 58 27.2 65.8 28.4" stroke="#8C6A3E" stroke-width="1.6" fill="none"/>`+(r3?`<path d="${C}" fill="none" stroke="${ol}" stroke-width=".5"/><path d="${B}" fill="none" stroke="${ol}" stroke-width=".5"/>`:`<path d="M58 15.6C63 18 66 23 66 30L60 30C61 24 60 19 58 15.6Z" fill="${dk}" opacity=".35"/>`)}
 if(h==='beanie'){const C='M30.6 37C29.6 21 38 13 50 13C62 13 70.4 21 69.4 37Z';s+=`<path d="${C}" fill="${col}"/>`;for(let i=0;i<12;i++){const x=32+i*3.3;s+=`<path d="M${x} 31V37" stroke="${dk}" stroke-width=".55" opacity=".6"/>`}s+=`<path d="M30.4 31C40 29.4 60 29.4 69.6 31" stroke="${dk}" stroke-width=".8" fill="none"/>`+(r3?`<path d="${C}" fill="none" stroke="${ol}" stroke-width=".5"/>`:`<path d="M52 13.4C62 14 70 22 69.4 31L63 30.4C63 22 58 16 52 13.4Z" fill="${dk}" opacity=".35"/><ellipse cx="44" cy="20" rx="5" ry="3" fill="#fff" opacity=".15" ${bl}/>`)}
 const K2=pal;const SH=(d,fill,k)=>`<path d="${d}" fill="${fill}"/>`+(r3?`<path d="${d}" fill="none" stroke="${k.ol}" stroke-width=".45"/>`:'');
 if(h==='tricorn'){const k=K2('#221E26');s+=SH('M36 28C36 18 42 12.6 50 12.6C58 12.6 64 18 64 28Z',k.c,k)+SH('M24.4 29.4C30 23.4 39 21.8 50 23C61 21.8 70 23.4 75.6 29.4C70.6 29 66 29.8 61.6 31.8C57 27.6 43 27.6 38.4 31.8C34 29.8 29.4 29 24.4 29.4Z','#2E2933',k)+`<path d="M24.8 29.2C30 23.8 39 22.2 50 23.4C61 22.2 70 23.8 75.2 29.2" fill="none" stroke="${GOLD}" stroke-width=".8"/>`+(X.lod?'':`<path d="M44 16.6C46 15 54 15 56 16.6" stroke="#fff" stroke-width=".8" opacity=".25" fill="none"/>`)}
 if(h==='chef'){const k=K2('#FFFFFF');s+=`<path d="M36 24C33 12 42 9 45 13C47 7 56 7 57 13C61 9 69 13 64 24Z" fill="#fff"/>`+(r3?`<path d="M36 24C33 12 42 9 45 13C47 7 56 7 57 13C61 9 69 13 64 24" fill="none" stroke="#9A9A9A" stroke-width=".45"/>`:`<path d="M45 13C44 17 44 20 45 24M57 13C58 17 57.6 20 56.6 24" stroke="#D5D2CC" stroke-width="1" fill="none" ${bl}/>`)+SH('M35 23.6C42 22.6 58 22.6 65 23.6L65.4 31C58 29.6 42 29.6 34.6 31Z','#F6F4F0',{ol:'#9A9A9A'})+`<path d="M35 26.6C42 25.6 58 25.6 65 26.6" stroke="#E2DED6" stroke-width=".6" fill="none"/>`}
 if(h==='pilot'){s+=SH('M31 30C30.6 20.6 39 16 50 16C61 16 69.4 20.6 69 30Z','#1F2433',{ol:'#000'})+`<path d="M31.4 27.6C40 26 60 26 68.6 27.6L68.8 30.6C60 29.2 40 29.2 31.2 30.6Z" fill="#111"/><path d="M32 28.4C40 27 60 27 68 28.4" stroke="${GOLD}" stroke-width=".7" fill="none"/>`+SH('M32 30.4C40 28.6 60 28.6 68 30.4C66.4 34 60 35.2 50 35.2C40 35.2 33.6 34 32 30.4Z','#0E0E12',{ol:'#000'})+`<path d="M46 22.4C47.4 21.4 48.8 21.6 50 22.6C51.2 21.6 52.6 21.4 54 22.4C52.6 23.6 51 23.8 50 23.4C49 23.8 47.4 23.6 46 22.4Z" fill="${GOLD}"/>`+(X.lod?'':`<path d="M38 32C42 31 48 30.6 52 30.8" stroke="#fff" stroke-width=".6" opacity=".35" fill="none"/>`)}
 if(h==='deerstalker'){const id='§ck';s+=`<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#9C7A4E"/><path d="M0 .5H3M.5 0V3" stroke="#5E4428" stroke-width=".4"/><path d="M0 2H3" stroke="#C9A878" stroke-width=".25"/></pattern>`+SH('M31 32C30 20 38 13.6 50 13.6C62 13.6 70 20 69 32Z',X.lod?'#8A6A42':`url(#${id})`,{ol:'#3E2C16'})+SH('M35 31C42 29.4 58 29.4 65 31C63 35 37 35 35 31Z','#7A5A34',{ol:'#3E2C16'})+`<path d="M44 14.6C46 12.6 54 12.6 56 14.6" stroke="#5E4428" stroke-width=".8" fill="none"/><circle cx="50" cy="13.4" r="1" fill="#5E4428"/>`+(r3||X.lod?'':`<path d="M58 15C63 18 66 23 66.6 30L61 30C61 24 60 19 58 15Z" fill="#000" opacity=".18"/>`)}
 if(h==='crown'){s+=SH('M34.6 27.4L33.4 14.4L40.4 19.6L45 10.4L50 17.6L55 10.4L59.6 19.6L66.6 14.4L65.4 27.4C60 25.6 40 25.6 34.6 27.4Z',GOLD,{ol:GOLDD})+`<path d="M34.8 24.4C40 22.8 60 22.8 65.2 24.4" stroke="${GOLDD}" stroke-width=".7" fill="none"/><circle cx="50" cy="21" r="1.4" fill="#C8343A"/><circle cx="42" cy="22.4" r="1" fill="#2F7FD1"/><circle cx="58" cy="22.4" r="1" fill="#2E9C6A"/><circle cx="45" cy="10.4" r=".9" fill="${GOLDL}"/><circle cx="55" cy="10.4" r=".9" fill="${GOLDL}"/>`+(X.lod?'':`<path d="M37 20L38 25" stroke="${GOLDL}" stroke-width=".7" opacity=".8"/>`)}
 if(h==='tiara'){s+=`<path d="M35.4 25.4C41 19.6 59 19.6 64.6 25.4" fill="none" stroke="${GOLD}" stroke-width="1"/><path d="M41 21.6L42.4 17.4L44 21M47.4 20.4L50 14.4L52.6 20.4M56 21L57.6 17.4L59 21.6" fill="none" stroke="${GOLD}" stroke-width=".8" stroke-linejoin="round"/><circle cx="50" cy="18.6" r="1.3" fill="#B8E0F2"/><circle cx="42.6" cy="19.8" r=".8" fill="#F7F1E8"/><circle cx="57.4" cy="19.8" r=".8" fill="#F7F1E8"/>`+(X.lod?'':sparkle(50,15.6,1.4))}
 if(h==='gradcap'){s+=SH('M36 27.4C36 23.4 64 23.4 64 27.4L64 31C56 29.4 44 29.4 36 31Z','#1E1F2A',{ol:'#000'})+SH('M22.4 20.6L50 12.2L77.6 20.6L50 29Z','#26273A',{ol:'#000'})+(X.lod?'':`<path d="M26 20.6L50 13.4" stroke="#fff" stroke-width=".6" opacity=".25"/>`)+`<circle cx="50" cy="20.6" r=".9" fill="${GOLD}"/><path d="M50 20.6L70 23.6L70.6 34" fill="none" stroke="${GOLD}" stroke-width=".6"/><path d="M69.4 33.4L71.8 33.4L72.4 38.4L68.8 38.4Z" fill="${GOLD}"/>`}
 if(h==='divemask'){s+=`<path d="M31.4 30.6C38 28.4 62 28.4 68.6 30.6" stroke="#20242B" stroke-width="2.4" fill="none"/>`+SH('M38.6 21.6C43 20 57 20 61.4 21.6C63 23 63 28 61.4 29.6C57.4 31 52.6 30.8 50 29.6C47.4 30.8 42.6 31 38.6 29.6C37 28 37 23 38.6 21.6Z','#1FA3A0',{ol:'#0E4A48'})+`<path d="M40 22.8C44 21.8 48.6 21.8 49.2 23.4L49 28.4C46 29.4 42 29.4 40 28.4Z" fill="#BFE9F2" opacity=".85"/><path d="M60 22.8C56 21.8 51.4 21.8 50.8 23.4L51 28.4C54 29.4 58 29.4 60 28.4Z" fill="#BFE9F2" opacity=".85"/>`+(X.lod?'':`<path d="M41.4 23.6L44 23" stroke="#fff" stroke-width=".7" opacity=".8"/>`)+`<path d="M66.4 30C68.4 24 68.6 16 66.8 9.6" stroke="#F2C14E" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M66.4 9.4L68.6 8.6" stroke="#20242B" stroke-width="1.6" stroke-linecap="round"/>`}
 if(h==='spacehelmet'){s+=`<circle cx="50" cy="43" r="28.6" fill="#DDF2FF" opacity=".16"/><circle cx="50" cy="43" r="28.6" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/><circle cx="50" cy="43" r="28.6" fill="none" stroke="#9AA3AE" stroke-width=".4"/>`+(X.lod?'':`<path d="M30 30C34 21 42 16.4 50 16" stroke="#fff" stroke-width="2.6" opacity=".55" fill="none" stroke-linecap="round" ${bl}/><path d="M31.6 30.6C35 23.6 41 19.2 47 18" stroke="#fff" stroke-width=".7" opacity=".85" fill="none" stroke-linecap="round"/><ellipse cx="66" cy="56" rx="2.4" ry="1.2" fill="#fff" opacity=".5" transform="rotate(-40 66 56)"/>`)}
 if(h==='straw'){s+=`<ellipse cx="50" cy="31.6" rx="27" ry="5.4" fill="${col}"/><path d="M35 31C35 19 41 14 50 14C59 14 65 19 65 31Z" fill="${lt}"/><path d="M35.2 27.4C42 26 58 26 64.8 27.4L65 31C58 29.8 42 29.8 35 31Z" fill="#1E6F6A"/>`;if(!X.lod)for(let i=0;i<9;i++)s+=`<path d="M${36+i*3.4} 17V26" stroke="${dk}" stroke-width=".3" opacity=".45"/>`}
 return s}


OUTS.mvjersey = Object.assign({}, OUTS.fjersey, { n: 'Maldives jersey', g: 'u' });
[['pirate', 'pirate'], ['astro', 'spacehelmet'], ['fgrad', 'gradcap'], ['mgrad', 'gradcap'], ['diver', 'divemask'], ['chef', 'chef'], ['pilot', 'pilot'], ['trench', 'deerstalker'], ['royal', 'crown']].forEach(function (p) { if (OUTS[p[0]]) OUTS[p[0]].hat = p[1]; });

/* ================================================================ build one character */
/* v3 accessories (hats, glasses, masks, face paint, reaction extras) are drawn in the v3 head space and mapped onto the v4 head */
const T3 = 'translate(50 46.6) scale(.82) translate(-50 -49)';
const HAT_SQUASH = /^(cap|capback|beanie|fisher|bucket|police|straw|cowboy|kulhi|helmet|chef|gradcap|deerstalker|pirate|tophat|captain|pilot)$/;
const S3 = S;
function shellOpen(c, o, vb, size) {
  const title = o.title ? esc(o.title) : '';
  const ro = {}; ['size', 'crop', 'bust', 'bg', 'ring', 'title', 'animate', 'className', 'expression'].forEach(function (n) { if (o[n] != null && o[n] !== '') ro[n] = o[n]; });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="' + size + '" height="' + size + '" class="dga-av' + (o.animate ? ' dga-anim' : '') + (o.className ? ' ' + esc(o.className) : '') + '"' +
    ' data-dga="' + CATS.map(function (x) { return c[x]; }).join(',') + '" data-dgo="' + esc(JSON.stringify(ro)) + '"' + (o.animate ? ' style="¤"' : '') +
    (title ? ' role="img" aria-label="' + title + '"><title>' + title + '</title>' : ' aria-hidden="true" focusable="false">');
}
function bgFirst(b) { const v = val('bg', b); return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : (v && v.base) || '#7CC4FF'; }
function build(c, o) {
  const e = o.expression || '', crop = o.crop ? (CROPS[o.crop] || o.crop) : (o.bust === false ? CROPS.head : null);
  const size = o.size || 96, D = o._d != null ? o._d : (size <= 48 ? 2 : size <= 100 ? 1 : 0);
  const m = c.body === 'm', hk = hairKey(c), hs = HAIRS[hk] || HAIRS.crop, hij = hs.hijab;
  const X = { st: 'r1', m, D, lod: D === 2, nf: D > 0, rnd: rng(hash(hk + c.skin + c.outfit + c.hairColor + c.face)), fw: (FACEP[c.face] || FACEP.oval)[0] };
  const S = X.S = skinSet(val('skin', c.skin)), H = X.H = hairSet(val('hairColor', c.hairColor));
  X.lash = mix(S.s, '#140A08', .86);
  X.brow = mix(H.c2 ? H.c : H.c, S.s, lum(H.c) > .5 ? .25 : .12);
  const face = facePath(m, c.face), blur = X.nf ? '' : 'filter="url(#§bl)"';
  const ocv = c.outfitColor === 'auto' ? null : val('outfitColor', c.outfitColor); X.oc = typeof ocv === 'string' ? ocv : null;
  const ic = val('eyeColor', c.eyeColor);
  const lipIt = item('lips', c.lips), lipC = lipIt && lipIt.value ? lipIt.value : (m ? mix(S.s, '#9A4640', .32) : mix(S.s, '#C4545F', .45));
  const cover = !!COVER[c.hair], hatId = c.hat, squash = hatId !== 'none' && HAT_SQUASH.test(hatId) && !hij;
  let cheeks = c.cheeks, blushOp = cheeks === 'none' ? 0 : cheeks === 'rosy' ? (m ? .5 : .9) : (m ? .28 : .62);
  if (e === 'angry') blushOp = .95; else if (/^(happy|shocked|laugh|wink)$/.test(e)) blushOp = Math.min(1, (blushOp || .3) + .2);
  const bgc = bgFirst(c.bg);
  /* ---- defs */
  let d = '<defs>' + (X.nf ? '' : '<filter id="§bl" filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="150"><feGaussianBlur stdDeviation=".75"/></filter>') +
    (crop ? '' : '<clipPath id="§c"><circle cx="50" cy="50" r="50"/></clipPath>') +
    `<radialGradient id="§sk" cx=".45" cy=".42" r=".68"><stop offset="0" stop-color="${S.hi}"/><stop offset=".5" stop-color="${S.s}"/><stop offset=".86" stop-color="${mix(S.s, S.lo, .6)}"/><stop offset="1" stop-color="${S.lo}"/></radialGradient>` +
    `<linearGradient id="§nk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(S.s, S.lo, .9)}"/><stop offset=".45" stop-color="${mix(S.s, S.lo, .35)}"/><stop offset="1" stop-color="${S.s}"/></linearGradient>` +
    `<linearGradient id="§bd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${S.lo}"/><stop offset=".2" stop-color="${S.s}"/><stop offset=".5" stop-color="${mix(S.s, S.hi, .55)}"/><stop offset=".8" stop-color="${S.s}"/><stop offset="1" stop-color="${S.lo}"/></linearGradient>` +
    `<radialGradient id="§bs"><stop offset="0" stop-color="${e === 'angry' ? '#FF4D5E' : S.bl}"/><stop offset="1" stop-color="${S.bl}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="§gl"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  if (D === 2) d += `<linearGradient id="§rim" x1="0" y1="0" x2="1" y2="0"><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${mix(bgc, '#fff', .55)}" stop-opacity=".95"/></linearGradient>`;
  if (H.c2) d += `<linearGradient id="§h" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="96"><stop offset="0" stop-color="${H.top}"/><stop offset=".3" stop-color="${H.c}"/><stop offset=".62" stop-color="${mix(H.c, H.c2, .6)}"/><stop offset="1" stop-color="${H.c2}"/></linearGradient>`;
  else d += `<linearGradient id="§h" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="100"><stop offset="0" stop-color="${H.top}"/><stop offset=".22" stop-color="${H.c}"/><stop offset=".75" stop-color="${H.c}"/><stop offset="1" stop-color="${mix(H.c, H.hl, .25)}"/></linearGradient>`;
  d += `<linearGradient id="§hb" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="100"><stop offset="0" stop-color="${H.sh}"/><stop offset="1" stop-color="${H.c2 ? mix(H.c2, '#000', .35) : H.dk}"/></linearGradient>` +
    `<linearGradient id="§hf" gradientUnits="userSpaceOnUse" x1="0" y1="26" x2="0" y2="46"><stop offset="0" stop-color="${H.c}"/><stop offset=".3" stop-color="${H.c}"/><stop offset="1" stop-color="${H.c}" stop-opacity=".12"/></linearGradient>` +
    `<radialGradient id="§hv" cx=".5" cy=".2" r=".85"><stop offset="0" stop-color="${H.hl}" stop-opacity=".35"/><stop offset=".45" stop-color="${H.c}" stop-opacity="0"/><stop offset="1" stop-color="${H.dk}" stop-opacity=".55"/></radialGradient>` +
    `<radialGradient id="§cu" cx=".38" cy=".32" r=".72"><stop offset="0" stop-color="${H.hl}"/><stop offset=".5" stop-color="${H.c2 ? mix(H.c, H.c2, .5) : H.c}"/><stop offset="1" stop-color="${H.dk}"/></radialGradient>` +
    `<radialGradient id="§af" gradientUnits="userSpaceOnUse" cx="44" cy="20" r="36"><stop offset="0" stop-color="${mix(H.c, H.hl, .55)}"/><stop offset=".42" stop-color="${H.c2 ? mix(H.c, H.c2, .4) : H.c}"/><stop offset="1" stop-color="${H.c2 ? mix(H.c2, '#000', .3) : H.dk}"/></radialGradient>` +
    `<radialGradient id="§ir" cx=".5" cy=".64" r=".62"><stop offset="0" stop-color="${mix(ic, '#F2D9A0', .42)}"/><stop offset=".55" stop-color="${ic}"/><stop offset="1" stop-color="${mix(ic, '#000', .5)}"/></radialGradient>` +
    `<linearGradient id="§lp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(lipC, '#000', .16)}"/><stop offset="1" stop-color="${mix(lipC, '#fff', .14)}"/></linearGradient>` +
    `<clipPath id="§fc"><path d="${face}"/></clipPath>`;
  if (squash) d += '<clipPath id="§hq"><path d="M-20 29H120V160H-20ZM-20-20H23V29H-20ZM77-20H120V29H77Z"/></clipPath>';
  if (hij) {
    const sc = val('scarfColor', c.scarfColor); X.sc = { c: sc, sh: mix(sc, '#1A0F14', .3), dk: mix(sc, '#1A0F14', .5), lt: mix(sc, '#FFFFFF', .38), ol: mix(sc, '#1A0F14', .62) };
    d += `<linearGradient id="§sc" gradientUnits="userSpaceOnUse" x1="18" y1="0" x2="82" y2="0"><stop offset="0" stop-color="${X.sc.sh}"/><stop offset=".26" stop-color="${X.sc.c}"/><stop offset=".44" stop-color="${mix(X.sc.c, X.sc.lt, .55)}"/><stop offset=".6" stop-color="${X.sc.c}"/><stop offset=".86" stop-color="${mix(X.sc.c, X.sc.sh, .6)}"/><stop offset="1" stop-color="${X.sc.sh}"/></linearGradient>` +
      `<radialGradient id="§sct" cx=".42" cy=".08" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  }
  const lensV = val('lens', c.lens);
  if (Array.isArray(lensV) && c.glasses !== 'none') d += lin('§ln', lensV[0], lensV[1], 0.3, 1);
  d += '</defs>';
  /* ---- svg shell (same attributes as v3, so react() and the games keep working) */
  let s = shellOpen(c, o, crop || '0 0 100 100', size);
  s += d + (crop ? '<g>' : '<g clip-path="url(#§c)">');
  if (o.bg !== false && !(o.bust === false && !o.crop)) s += bgSVG(c.bg, !!crop) + '<circle cx="50" cy="42" r="36" fill="url(#§gl)"/>';
  if (o.animate) {
    /* animated: the figure sits in its own HTML layer (a <div> in a <foreignObject>, clipped by the same circle), so the
       breathing is a plain CSS transform the compositor runs off the main thread; the background stays in the outer SVG */
    const vbA = (crop || '0 0 100 100').split(/[\s,]+/);
    s += '</g><foreignObject x="' + vbA[0] + '" y="' + vbA[1] + '" width="' + vbA[2] + '" height="' + vbA[3] + '"' + (crop ? '' : ' clip-path="url(#§c)"') + '>' +
      '<div xmlns="http://www.w3.org/1999/xhtml" class="dga-fig"><svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (crop || '0 0 100 100') + '" preserveAspectRatio="none"><g>';
  } else s += '<g class="dga-fig">';
  s += (crop ? '<g>' : '<g transform="translate(50 47) scale(1.12) translate(-50 -47)">');
  const O = OUTS[c.outfit] || OUTS.tee;
  const TX = m ? ' transform="translate(50 0) scale(1.15 1) translate(-50 0)"' : '';
  s += `<g${TX}>${outfitBack(X, c, O)}</g>`;
  if (!hij && hs.back) s += (squash ? '<g clip-path="url(#§hq)">' : '<g>') + hairLayer(hs.back, X, 'back') + '</g>';
  /* body, neck, clothes */
  s += `<g${TX}><path d="${SIL}" fill="url(#§bd)"/>` + (X.nf ? '' : paint(X).fold(ARML, S.lo, 1.4, .6) + paint(X).fold(mirD(ARML), S.lo, 1.4, .6)) + '</g>';
  const nk = m ? 'M43.4 56L43.4 76C46 78.6 54 78.6 56.6 76L56.6 56Z' : 'M45 56L45 76.4C47 78.4 53 78.4 55 76.4L55 56Z';
  s += `<path d="${nk}" fill="url(#§nk)"/>` + (X.nf ? '' : `<ellipse cx="50" cy="62" rx="${m ? 8 : 7}" ry="4.6" fill="${S.deep}" opacity=".45" ${blur}/>`);
  s += `<g${TX}>${garment(X, c, O)}</g>`;
  if (!NECKCOVER[c.hair] && !hij) s += necklace(X, c); else if (hk === 'turban') s += necklace(X, c);
  /* head */
  if (!hij) s += ears(X) + earrings(X, c);
  s += `<path d="${face}" fill="url(#§sk)"/>`;
  let fs = '';
  if (blushOp) fs += `<ellipse cx="40.4" cy="53.4" rx="5" ry="3.2" fill="url(#§bs)" opacity="${blushOp}"/><ellipse cx="59.6" cy="53.4" rx="5" ry="3.2" fill="url(#§bs)" opacity="${blushOp}"/>`;
  if (!X.nf) {
    fs += `<ellipse cx="47.6" cy="33" rx="7" ry="3.4" fill="#fff" opacity=".14" ${blur}/><ellipse cx="50.4" cy="49.6" rx=".9" ry="2.6" fill="#fff" opacity=".18" ${blur}/><ellipse cx="50" cy="64.2" rx="3" ry="1.2" fill="#fff" opacity=".12" ${blur}/>` +
      `<path d="M36 50C37 56 40.6 61 45 64" stroke="${S.lo}" stroke-width="2.4" fill="none" opacity=".25" ${blur}/><path d="M64 50C63 56 59.4 61 55 64" stroke="${S.lo}" stroke-width="2.4" fill="none" opacity=".3" ${blur}/>`;
    (hij ? [] : (hs.front || [])).forEach(function (it) {
      if (it.t === 'lock') fs += `<path d="${bez(it.b.map(p => [p[0] + (p[0] < 50 ? .5 : -.5), p[1] + .7]))}" stroke="${S.deep}" stroke-width="2" fill="none" opacity=".32" ${blur}/>`;
      else if (it.hl) fs += `<path d="${bez(it.hl.map(p => [p[0], p[1] + .8]))}" stroke="${S.deep}" stroke-width="2.2" fill="none" opacity=".34" ${blur}/>`;
    });
    if (hij) fs += `<path d="${OPEN}" stroke="${S.deep}" stroke-width="3.2" fill="none" opacity=".4" ${blur}/>`;
  } else if (X.lod) fs += `<path d="${face}" fill="none" stroke="url(#§rim)" stroke-width="1.6" opacity=".8"/>`;
  s += `<g clip-path="url(#§fc)">${fs}</g>` + marks(X, c.marks);
  const k3 = { sk: S.s, skS: mix(S.s, '#7a3320', 0.2), skD: mix(S.s, '#5a2414', 0.34), hc: H.c, hcB: shade(H.c, 0.2), sc: X.sc ? X.sc.c : '#C57483', cover: cover, bald: c.hair === 'bald', bigTop: /^(afro|mohawk|topbun|quiff|curlytop|manbun|halfup|ponytail)$/.test(hk) };
  const ex3 = 29.4;
  if (c.paint !== 'none' && PAINT[c.paint]) s += `<g transform="${T3}">${PAINT[c.paint]()}</g>`;
  const MK = c.mask !== 'none' && MASKS[c.mask] ? MASKS[c.mask](k3, ex3) : {};
  if (MK.under) s += `<g transform="${T3}">${MK.under}</g>`;
  s += nose(X, c.nose) + facial(X, c, 'beard') + '<g class="dga-mouth">' + mouth(X, c, lipC, e) + '</g>' + facial(X, c, 'mo');
  if (MK.mid) s += `<g transform="${T3}">${MK.mid}</g>`;
  s += eyes(X, c, ic, e) + brows(X, c.brows, e);
  if (MK.eye) s += `<g transform="${T3}">${MK.eye}</g>`;
  if (!hij) s += (squash ? '<g clip-path="url(#§hq)">' : '') + hairLayer(hs.front || [], X, 'front') + (squash ? '</g>' : '');
  else s += hijabSvg(X, c, hij);
  if (c.glasses !== 'none') s += `<g transform="${T3}">${glasses(c.glasses, val('glassesColor', c.glassesColor), ex3, c.lens)}</g>`;
  if (hatId !== 'none') s += HAT4[hatId] ? hat4(X, hatId, val('hatColor', c.hatColor)) : (HATS[hatId] ? `<g transform="translate(0 -1.4) ${T3}">${HATS[hatId](val('hatColor', c.hatColor), k3)}</g>` : '');
  let xe = '';
  if (e === 'shocked') xe = P('M74 26c2.2 3.2 3.2 5 3.2 6.4a3.2 3.2 0 0 1-6.4 0c0-1.4 1-3.2 3.2-6.4z', '#8FD8FF', ' stroke="#fff" stroke-width=".8"');
  else if (e === 'sad') xe = P('M61 54.6c1.2 1.8 1.8 2.8 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.8 1.8-3.6z', '#8FD8FF');
  else if (e === 'angry') xe = S3('M73.4 25.4l2.2 2.2M79.6 25.4l-2.2 2.2M73.4 31.6l2.2-2.2M79.6 31.6l-2.2-2.2', '#E5484D', 1.8);
  else if (e === 'happy') xe = spark(76, 28.6, 3.2, '#fff', 0.9) + spark(22, 37.8, 2.2, '#fff', 0.8);
  else if (e === 'laugh') xe = both(P('M33.6 51.4c1.3 1.9 1.9 3 1.9 3.8a1.9 1.9 0 0 1-3.8 0c0-.8.6-1.9 1.9-3.8z', '#8FD8FF')) + spark(78, 26, 3, '#FFE39A') + spark(21, 30, 2.2, '#fff', 0.9);
  else if (e === 'wink') xe = spark(72, 40, 2.6, '#FFE39A') + spark(76.6, 35, 1.5, '#fff', 0.9);
  else if (e === 'thinking') xe = circ(70.6, 33.6, 1.3, '#fff', ' stroke="' + INK + '" stroke-width=".6"') + circ(74.6, 27.6, 2, '#fff', ' stroke="' + INK + '" stroke-width=".6"') +
    '<ellipse cx="81" cy="18.6" rx="5.4" ry="4.2" fill="#fff" stroke="' + INK + '" stroke-width=".6"/>' + circ(78.8, 18.8, 0.7, INK) + circ(81, 18.8, 0.7, INK) + circ(83.2, 18.8, 0.7, INK);
  else if (e === 'sleepy') xe = S3('M71.4 29.6h3.6l-3.6 4.4h3.6', '#5A6CB8', 1.2) + S3('M77 20.6h5l-5 6h5', '#5A6CB8', 1.5);
  if (xe) s += `<g transform="${T3}">${xe}</g>`;
  s += o.animate ? '</g></g></svg></div></foreignObject>' : '</g></g></g>';
  if (o.ring && !crop) s += '<circle cx="50" cy="50" r="48.4" fill="none" stroke="' + (typeof o.ring === 'string' ? esc(o.ring) : '#fff') + '" stroke-width="3.2"/>';
  return s + '</svg>';
}

/* ---------------------------------------------------------------- render: live SVG for big / animated avatars, a cached image for small ones */
var CACHE = {}, CN = 0, SEQ = 0, URLS = {}, UN = 0;
function imgURL(svg) {
  var u = URLS[svg]; if (u) return u;
  if (++UN > 400) { URLS = {}; UN = 1; }
  try { if (root.Blob && root.URL && URL.createObjectURL) u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); } catch (e) { u = null; }
  if (!u) u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return (URLS[svg] = u);
}
function render(cfg, o) {
  o = o || {};
  if (!baseDone) { injectCSS('dga-base-css', BASE_CSS); baseDone = true; }
  var c = norm(cfg), size = o.size || 96, small = (size <= 48 || o._img) && !o._live;
  var key = CATS.map(function (x) { return c[x]; }).join(',') + '|' + [o.expression || '', o.bust === false ? 0 : 1, o.crop || '', o.ring || '', o.bg === false ? 0 : 1, size, o.title || '', !small && o.animate ? 1 : 0, o.className || '', small ? 'i' : ''].join('|');
  var t = CACHE[key];
  if (!t) {
    if (++CN > 800) { CACHE = {}; CN = 1; }
    if (small) {
      var inner = build(c, Object.assign({}, o, { animate: false, title: '', className: '', _d: 2 })).replace(/§/g, 'i');
      /* keep the v3 <svg class="dga-av" data-dga ...> shell (CSS and react() rely on it), but paint it with one cached image */
      var head = shellOpen(c, Object.assign({}, o, { animate: false }), '0 0 100 100', size);
      t = head + '<image href="' + imgURL(inner) + '" x="0" y="0" width="100" height="100" preserveAspectRatio="none"/></svg>';
    } else t = build(c, o);
    CACHE[key] = t;
  }
  if (small) return t;
  var id = 'dga' + (++SEQ).toString(36);
  t = t.replace(/§/g, id);
  if (o.animate) { t = t.replace('¤', idleVars()); idleKick(); }
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
function dataURI(cfg, o) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(build(norm(cfg), Object.assign({ size: 96 }, o, { animate: false })).replace(/§/g, 'u')); }

/* ---------------------------------------------------------------- storage */
/* load(owned?): with an owned set/array/map, unowned paid items are dropped (same as validate). Without it, only invalid values / conflicts are fixed.
   v3 saves (v:1) load unchanged - every old option still exists, v4 simply draws it in the new style. */
function load(owned) {
  try {
    var s = root.localStorage.getItem(KEY); if (!s) return null; var o = JSON.parse(s); if (!o || typeof o !== 'object') return null;
    if (owned) return validate(o, owned);
    var c = norm(o);
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

  /* ---------------------------------------------------------------- base css + render */
  /* Idle life (render with {animate:true}): random blink / double blink, breathing, glances, a rare small smile.
     Same look and timings as v4.0, which ran all four as endless CSS animations on SVG parts. Those can't be composited,
     so every avatar was restyled, laid out and repainted on every frame. Now:
     - breathing moves the figure's own HTML layer (see build: <foreignObject><div class="dga-fig">), which the compositor
       animates off the main thread; it pauses while the avatar is off screen (.dga-off);
     - one shared scheduler (idleTick) plays each blink / glance / smile as a short one-shot, only for avatars on screen,
       at most cfg.maxFx at a time. Between moves nothing on the main thread animates.
     Every avatar still gets its own random timings. All off under reduced motion, in the games' smooth mode, or while the tab is hidden. */
  var BASE_CSS = '.dga-av{display:block;overflow:hidden}' +
    '.dga-anim .dga-fig{width:100%;height:100%;animation:dga-breathe var(--dga-br,3.8s) ease-in-out var(--dga-bo2,0s) infinite}' +
    '.dga-anim .dga-fig>svg{display:block;width:100%;height:100%;overflow:visible}.dga-off .dga-fig{animation-play-state:paused}.dga-calm .dga-fig{animation:none}' +
    '@keyframes dga-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-.9px)}}' +
    '.dga-anim .dga-eyes,.dga-anim .dga-mouth{transform-box:fill-box;transform-origin:center}' +
    '.dga-anim .dga-iris{transition:transform var(--dga-gt,.3s) ease}.dga-anim .dga-mouth{transition:transform var(--dga-st,.6s) ease}' +
    '.dga-anim.dga-b1 .dga-eyes{animation:dga-blink var(--dga-bt,.31s) ease}.dga-anim.dga-b2 .dga-eyes{animation:dga-blink2 var(--dga-bt,.55s) ease}' +
    '.dga-anim .dga-eyes.dga-closed{animation:none}' +
    '.dga-anim.dga-gr .dga-iris{transform:translate(1.1px,0)}.dga-anim.dga-gr .dga-irl{transform:translate(-1.1px,0)}' +
    '.dga-anim.dga-gl .dga-iris{transform:translate(-1.1px,-.2px)}.dga-anim.dga-gl .dga-irl{transform:translate(1.1px,-.2px)}' +
    '.dga-anim.dga-sm .dga-mouth{transform:scale(1.12,1.1)}' +
    '@keyframes dga-blink{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.1)}}' +
    '@keyframes dga-blink2{0%,38.1%,61.9%,100%{transform:scaleY(1)}19.05%,80.95%{transform:scaleY(.1)}}' +
    '.dga-react{transform-origin:50% 50%;animation:dga-rpop .55s cubic-bezier(.34,1.56,.64,1)}@keyframes dga-rpop{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}' +
    '@media (prefers-reduced-motion:reduce){.dga-anim .dga-eyes,.dga-anim .dga-iris,.dga-anim .dga-fig,.dga-anim .dga-mouth,.dga-react{animation:none;transition:none}}';
  function idleVars() { var R = Math.random; return '--dga-br:' + (3.2 + R() * 1.6).toFixed(2) + 's;--dga-bo2:' + (-R() * 4).toFixed(2) + 's'; }
  /* ---- idle scheduler: one timer for every animated avatar on the page */
  var IDLE = { list: [], io: null, t: 0, rm: null, busy: [], cfg: { ms: 200, maxFx: 2, moves: true, lead: '.on,.meav,.dga-root,.dga-lead' } };
  function idleKick() { if (!IDLE.t && typeof document !== 'undefined' && root.setTimeout) IDLE.t = setTimeout(idleTick, 50); }
  function idleState(el, now) {
    var R = Math.random, bd = 3.6 + R() * 3.4, gl = 7 + R() * 6, sm = 11 + R() * 10;
    /* same random ranges as v4.0; the first move lands at a random point of its cycle, like the old negative delays */
    return { vis: !IDLE.io, on: {}, b2: R() < 0.3, bd: bd, gl: gl, sm: sm, q: [],
      nb: now + R() * bd * 1000, ng: now + R() * gl * 1000, ns: now + R() * sm * 1000, eyes: el.querySelector('.dga-eyes') };
  }
  function idleAt(s, t, fn) { var i = s.q.length; while (i && s.q[i - 1][0] > t) i--; s.q.splice(i, 0, [t, fn]); }
  function fxFree(now, ms) {
    IDLE.busy = IDLE.busy.filter(function (t) { return t > now; });
    if (!IDLE.cfg.moves || IDLE.busy.length >= IDLE.cfg.maxFx) return false;
    IDLE.busy.push(now + ms); return true;
  }
  function idleTick() {
    IDLE.t = 0;
    var now = Date.now(), found = document.querySelectorAll('svg.dga-anim'), i, el, s;
    if (IDLE.rm == null) IDLE.rm = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : false;
    if (IDLE.io == null) IDLE.io = 'IntersectionObserver' in root ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.target.__dgi) { e.target.__dgi.vis = e.isIntersecting; e.target.classList.toggle('dga-off', !e.isIntersecting); } }); }) : false;
    for (i = 0; i < found.length; i++) { el = found[i]; if (!el.__dgi) { el.__dgi = idleState(el, now); IDLE.list.push(el); if (IDLE.io) IDLE.io.observe(el); } }
    IDLE.list = IDLE.list.filter(function (e) { if (e.isConnected) return true; if (IDLE.io) IDLE.io.unobserve(e); return false; });
    if (!IDLE.list.length) return; /* nothing to animate: sleep until the next render({animate:true}) */
    if ((IDLE.rm && IDLE.rm.matches) || document.hidden) { IDLE.t = setTimeout(idleTick, 1000); return; }
    /* lead avatars get the full idle life: yours (.meav), the one whose turn it is (the games mark that seat .on) and the
       builder preview. When a lead is on screen, the other avatars stay calm: no breathing, glances or smiles, and they
       blink half as often. With no lead on screen (a lobby, a list), every avatar is lead. */
    var lead = 0;
    for (i = 0; i < IDLE.list.length; i++) { el = IDLE.list[i]; el.__dgi.lead = !!(el.closest && el.closest(IDLE.cfg.lead)); if (el.__dgi.lead && el.__dgi.vis) lead++; }
    for (i = 0; i < IDLE.list.length; i++) {
      el = IDLE.list[i]; s = el.__dgi;
      while (s.q.length && s.q[0][0] <= now) s.q.shift()[1]();
      var calm = lead > 0 && !s.lead;
      if (calm !== !!s.calm) { s.calm = calm; el.classList.toggle('dga-calm', calm); }
      if (!s.vis) continue;
      /* the games' smooth mode (.dg-lite / .smooth) switches the idle life off, like its CSS did for the old animations */
      if (el.closest && el.closest('.dg-lite,.smooth')) continue;
      /* each kind of move (blink, glance, smile) runs one at a time per avatar; different kinds may overlap, as before */
      if (!s.on.b && now >= s.nb) {
        var bt = s.bd * (s.b2 ? 0.105 : 0.06);
        if (s.eyes && s.eyes.classList.contains('dga-closed')) s.nb = now + s.bd * 1000;
        else if (fxFree(now, bt * 1000)) {
          el.style.setProperty('--dga-bt', bt.toFixed(2) + 's'); el.classList.add(s.b2 ? 'dga-b2' : 'dga-b1'); s.on.b = 1;
          idleAt(s, now + bt * 1000 + 40, (function (e) { return function () { e.classList.remove('dga-b1', 'dga-b2'); e.__dgi.on.b = 0; }; })(el));
          s.nb = now + s.bd * (calm ? 2000 : 1000);
        } else s.nb = now + 300 + Math.random() * 700;
      }
      if (!calm && !s.on.g && now >= s.ng) {
        var gt = s.gl * 0.03, G = s.gl * 1000;
        if (fxFree(now, gt * 1000)) {
          (function (e, t0) {
            e.style.setProperty('--dga-gt', gt.toFixed(2) + 's'); e.classList.add('dga-gr'); s.on.g = 1;
            idleAt(s, t0 + G * 0.12, function () { e.classList.remove('dga-gr'); });
            idleAt(s, t0 + G * 0.24, function () { e.classList.add('dga-gl'); });
            idleAt(s, t0 + G * 0.35, function () { e.classList.remove('dga-gl'); });
            idleAt(s, t0 + G * 0.38, function () { e.__dgi.on.g = 0; });
          })(el, now);
          s.ng = now + G;
        } else s.ng = now + 300 + Math.random() * 700;
      }
      if (!calm && !s.on.s && now >= s.ns) {
        var S = s.sm * 1000;
        if (fxFree(now, S * 0.04)) {
          (function (e, t0, sm) {
            e.style.setProperty('--dga-st', (sm * 0.04).toFixed(2) + 's'); e.classList.add('dga-sm'); s.on.s = 1;
            idleAt(s, t0 + S * 0.11, function () { e.style.setProperty('--dga-st', (sm * 0.05).toFixed(2) + 's'); e.classList.remove('dga-sm'); });
            idleAt(s, t0 + S * 0.16, function () { e.__dgi.on.s = 0; });
          })(el, now, s.sm);
          s.ns = now + S;
        } else s.ns = now + 300 + Math.random() * 700;
      }
    }
    IDLE.t = setTimeout(idleTick, IDLE.cfg.ms);
  }
  var baseDone = false;
  function injectCSS(id, css) {
    if (typeof document === 'undefined') return;
    var st = document.getElementById(id);
    if (st) { if (st.textContent !== css) st.textContent = css; return; }
    st = document.createElement('style'); st.id = id; st.textContent = css; (document.head || document.documentElement).appendChild(st);
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
  /* "Pick a look": 12 ready-made characters per body (free items only) */
  var LOOKS = [
    ['Aminath', { body: 'f', skin: 'golden', face: 'oval', nose: 'small', eyes: 'almond', eyeColor: 'brown', lashes: 'full', brows: 'arched', mouth: 'smile', lips: 'rose', hair: 'waves', hairColor: 'darkbrown', outfit: 'libaas', outfitColor: 'teal', neck: 'necklace', bg: 'mint' }],
    ['Hawwa', { body: 'f', skin: 'tan', face: 'round', nose: 'button', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'subtle', brows: 'soft', mouth: 'smile', lips: 'nude', hair: 'hijab', scarfColor: 'rose', outfit: 'blouse', outfitColor: 'auto', bg: 'pink' }],
    ['Zara', { body: 'f', skin: 'deep', face: 'heart', nose: 'small', eyes: 'wide', eyeColor: 'brown', lashes: 'full', brows: 'soft', mouth: 'grin', lips: 'coral', hair: 'afro', hairColor: 'black', outfit: 'tee', outfitColor: 'coral', earrings: 'hoops', bg: 'sunshine' }],
    ['Mariyam', { body: 'f', skin: 'golden', face: 'oval', nose: 'button', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'subtle', brows: 'arched', mouth: 'smile', lips: 'rose', hair: 'shayla', scarfColor: 'sand', outfit: 'libaas', outfitColor: 'pink', bg: 'sand' }],
    ['Leena', { body: 'f', skin: 'light', face: 'round', nose: 'button', eyes: 'round', eyeColor: 'green', lashes: 'subtle', marks: 'freckles', brows: 'thin', mouth: 'smile', hair: 'bob', hairColor: 'auburn', outfit: 'blazer', outfitColor: 'auto', glasses: 'cateye', glassesColor: 'red', bg: 'lilac' }],
    ['Shiuna', { body: 'f', skin: 'tan', face: 'oval', nose: 'small', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'full', brows: 'arched', mouth: 'smirk', hair: 'ponytail', hairColor: 'black', outfit: 'crophood', outfitColor: 'auto', earrings: 'studs', bg: 'mint' }],
    ['Nashwa', { body: 'f', skin: 'fair', face: 'heart', nose: 'small', eyes: 'almond', eyeColor: 'hazel', lashes: 'full', brows: 'arched', mouth: 'smile', lips: 'coral', hair: 'curtain', hairColor: 'chestnut', outfit: 'wrap', outfitColor: 'auto', bg: 'pink' }],
    ['Aisha', { body: 'f', skin: 'brown', face: 'oval', nose: 'button', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'subtle', brows: 'soft', mouth: 'smile', hair: 'khimar', scarfColor: 'navy', outfit: 'blouse', outfitColor: 'auto', bg: 'sky' }],
    ['Raya', { body: 'f', skin: 'brown', face: 'round', nose: 'button', eyes: 'wide', eyeColor: 'darkbrown', lashes: 'full', brows: 'soft', mouth: 'grin', hair: 'braids', hairColor: 'darkbrown', outfit: 'maxi', outfitColor: 'auto', bg: 'sunshine' }],
    ['Fathimath', { body: 'f', skin: 'golden', face: 'oval', nose: 'small', eyes: 'almond', eyeColor: 'brown', lashes: 'full', brows: 'arched', mouth: 'smile', lips: 'rose', hair: 'lowbun', hairColor: 'black', outfit: 'libaas', outfitColor: 'maroon', earrings: 'drops', bg: 'coral' }],
    ['Hana', { body: 'f', skin: 'light', face: 'heart', nose: 'small', eyes: 'round', eyeColor: 'blue', lashes: 'subtle', brows: 'thin', mouth: 'smile', hair: 'pixie', hairColor: 'honey', outfit: 'fdenim', outfitColor: 'auto', earrings: 'hoops', bg: 'sky' }],
    ['Maisha', { body: 'f', skin: 'deep', face: 'oval', nose: 'small', eyes: 'almond', eyeColor: 'darkbrown', lashes: 'full', brows: 'arched', mouth: 'smile', lips: 'nude', hair: 'turban', scarfColor: 'emerald', outfit: 'blouse', outfitColor: 'auto', bg: 'mint' }],
    ['Ahmed', { body: 'm', skin: 'brown', face: 'square', nose: 'round', eyes: 'almond', eyeColor: 'darkbrown', brows: 'thick', mouth: 'smile', hair: 'crop', hairColor: 'black', facial: 'shortbeard', outfit: 'mlinen', outfitColor: 'auto', bg: 'sky' }],
    ['Ismail', { body: 'm', skin: 'ebony', face: 'full', nose: 'wide', eyes: 'round', eyeColor: 'black', brows: 'straight', mouth: 'grin', hair: 'curlytop', hairColor: 'black', facial: 'stubble', outfit: 'hoodie', outfitColor: 'emerald', bg: 'mint' }],
    ['Nadeem', { body: 'm', skin: 'fair', face: 'oval', nose: 'pointy', eyes: 'almond', eyeColor: 'hazel', brows: 'soft', mouth: 'smirk', hair: 'quiff', hairColor: 'brown', glasses: 'round', glassesColor: 'black', outfit: 'shirt', outfitColor: 'auto', bg: 'sand' }],
    ['Ibrahim', { body: 'm', skin: 'golden', face: 'square', nose: 'round', eyes: 'almond', eyeColor: 'darkbrown', brows: 'thick', mouth: 'smile', hair: 'sidepart', hairColor: 'black', facial: 'mo', outfit: 'kurta', outfitColor: 'auto', bg: 'sunshine' }],
    ['Hussain', { body: 'm', skin: 'tan', face: 'oval', nose: 'button', eyes: 'almond', eyeColor: 'darkbrown', brows: 'straight', mouth: 'smile', hair: 'slick', hairColor: 'black', facial: 'beard', outfit: 'leather', outfitColor: 'auto', bg: 'slate' }],
    ['Ali', { body: 'm', skin: 'deep', face: 'round', nose: 'wide', eyes: 'round', eyeColor: 'darkbrown', brows: 'straight', mouth: 'grin', hair: 'fade', hairColor: 'black', outfit: 'mvjersey', outfitColor: 'auto', bg: 'emerald' }],
    ['Shifan', { body: 'm', skin: 'light', face: 'oval', nose: 'button', eyes: 'wide', eyeColor: 'brown', brows: 'soft', mouth: 'grin', hair: 'messy', hairColor: 'darkbrown', outfit: 'bomber', outfitColor: 'auto', bg: 'lilac' }],
    ['Moosa', { body: 'm', skin: 'golden', face: 'square', nose: 'round', eyes: 'almond', eyeColor: 'darkbrown', brows: 'thick', mouth: 'smile', hair: 'manbun', hairColor: 'darkbrown', facial: 'goatee', outfit: 'mlinen', outfitColor: 'white', bg: 'coral' }],
    ['Rayyan', { body: 'm', skin: 'brown', face: 'full', nose: 'wide', eyes: 'almond', eyeColor: 'darkbrown', brows: 'straight', mouth: 'grin', hair: 'dreads', hairColor: 'black', outfit: 'boduberu', outfitColor: 'auto', bg: 'sunshine' }],
    ['Azim', { body: 'm', skin: 'tan', face: 'oval', nose: 'pointy', eyes: 'almond', eyeColor: 'darkbrown', brows: 'straight', mouth: 'smirk', hair: 'cornrows', hairColor: 'black', facial: 'stubble', outfit: 'track', outfitColor: 'auto', bg: 'sky' }],
    ['Imran', { body: 'm', skin: 'brown', face: 'square', nose: 'round', eyes: 'round', eyeColor: 'black', brows: 'bushy', mouth: 'smile', hair: 'buzz', hairColor: 'black', facial: 'chevron', outfit: 'feyli', outfitColor: 'auto', bg: 'sand' }],
    ['Faris', { body: 'm', skin: 'fair', face: 'oval', nose: 'button', eyes: 'almond', eyeColor: 'hazel', brows: 'soft', mouth: 'smile', hair: 'wavy', hairColor: 'honey', facial: 'stubble', outfit: 'hawaii', outfitColor: 'auto', bg: 'sky' }]
  ].map(function (l) { return { name: l[0], cfg: norm(l[1]) }; });

  /* ================================================================ BUILDER: 3 easy steps ================================================================ */
  function ti(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  var ICO = {
    dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/></svg>',
    undo: ti('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    back: ti('<path d="m15 18-6-6 6-6"/>'),
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    none: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M6.2 17.8 17.8 6.2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 6.5v11M6.5 12h11"/></svg>',
    shell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c4.8 0 8.6 3.6 8.6 8.3 0 3.4-2 6.3-5 7.7L12 21l-3.6-1.8c-3-1.4-5-4.3-5-7.7 0-4.7 3.8-8.3 8.6-8.3z" fill="#F4D9A6" stroke="#B8925A" stroke-width="1.4"/><path d="M12 5v14M8.2 6.4 10 18.4M15.8 6.4 14 18.4M5.4 9.4 8.6 17.4M18.6 9.4 15.4 17.4" stroke="#B8925A" stroke-width="1.1" stroke-linecap="round"/></svg>',
    hair: ti('<path d="M5 20c0-9 2-15 7-15s7 6 7 15"/><path d="M9 9c2 1 4 1 6 0"/>'),
    col: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg>',
    eye: ti('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    shirt: ti('<path d="M8.6 3.6 3 6.6l2 4.6 2.2-1V20.4h9.6V10.2l2.2 1 2-4.6-5.6-3q-1.4 2.2-3.4 2.2T8.6 3.6z"/>'),
    gem: ti('<path d="M6 3h12l3 6-9 12L3 9Z"/><path d="M3 9h18"/>'),
    more: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };
  var RARITY_COL = { common: '#8A9396', rare: '#3E86E0', epic: '#8B55E0', legendary: '#D99A1E' };
  var EXPRS = [['', 'Default'], ['happy', 'Happy'], ['laugh', 'Laugh'], ['wink', 'Wink'], ['shocked', 'Shocked'], ['smug', 'Smug'], ['thinking', 'Thinking'], ['sad', 'Sad'], ['angry', 'Angry'], ['sleepy', 'Sleepy']];
  var CHIPS = [['hair', 'Hair', ICO.hair], ['color', 'Hair colour', ICO.col], ['eyes', 'Eyes', ICO.eye], ['outfit', 'Outfit', ICO.shirt], ['acc', 'Accessories', ICO.gem], ['more', 'More', ICO.more]];
  var TAB_CHIP = { hair: 'hair', facial: 'hair', outfit: 'outfit', glasses: 'acc', hat: 'acc', extras: 'acc', masks: 'acc', eyes: 'eyes', face: 'more', mouth: 'more', bg: 'more' };
  /* thumbnail crops in v4 head space */
  var TH = { hair: '14 6 72 72', facial: '26 38 48 48', eyes: '32 32 36 36', face: '16 16 68 68', nose: '38 42 24 24', cheeks: '28 38 44 44', mouth: '38 50 24 24', glasses: '26 28 48 48', hat: '10 0 80 80', ear: '22 36 30 30', neck: '28 60 44 44', body: '12 58 76 76', mask: '26 30 48 48', paint: '24 36 52 52', brows: '32 30 36 36' };

  var BUILDER_CSS = [
    '.dga-root{--_bg:var(--dga-bg,#F6EFE3);--_sf:var(--dga-surface,#FFFCF6);--_sf2:var(--dga-surface-2,#EFE5D4);--_ink:var(--dga-ink,#1F2B2F);--_mut:var(--dga-muted,#5D6A6C);--_ac:var(--dga-accent,#1E6B4E);--_on:var(--dga-on-accent,#fff);--_gold:var(--dga-gold,#B8925A);--_line:var(--dga-line,rgba(31,43,47,.13));--_ring:var(--dga-focus,#1E6B4E);--_disp:var(--dga-font-display,"Marcellus",Georgia,serif);',
    'position:relative;box-sizing:border-box;width:100%;max-width:980px;margin:0 auto;color:var(--_ink);background:var(--_bg);font-family:var(--dga-font,"Sora",system-ui,-apple-system,"Segoe UI",sans-serif);font-size:15px;line-height:1.35;border-radius:var(--dga-radius,24px);display:flex;flex-direction:column;min-width:0;-webkit-tap-highlight-color:transparent;container:dga/inline-size}',
    '.dga-root.dga-dark{--_bg:var(--dga-bg,#2A1B5E);--_sf:var(--dga-surface,#35246F);--_sf2:var(--dga-surface-2,#402C82);--_ink:var(--dga-ink,#F5F0FF);--_mut:var(--dga-muted,#C3B6EA);--_ac:var(--dga-accent,#FFC93C);--_on:var(--dga-on-accent,#231942);--_gold:var(--dga-gold,#FFC93C);--_line:var(--dga-line,rgba(255,255,255,.15));--_ring:var(--dga-focus,#FFC93C)}',
    '.dga-root *,.dga-root *::before,.dga-root *::after{box-sizing:border-box}',
    '.dga-root button{font:inherit;color:inherit;cursor:pointer;-webkit-appearance:none;appearance:none}',
    '.dga-root :focus{outline:none}.dga-root :focus-visible{outline:3px solid var(--_ring);outline-offset:2px}',
    '.dga-head{display:flex;align-items:center;gap:8px;padding:12px 14px 6px}',
    '.dga-title{flex:1;min-width:0;margin:0;font:400 19px/1.15 var(--_disp);letter-spacing:.2px;overflow-wrap:normal;word-break:normal}@container dga (max-width:430px){.dga-head{flex-wrap:wrap;row-gap:6px}.dga-title{order:-1;flex:1 0 100%;text-align:center}.dga-head .dga-boli{margin-left:auto}}',
    '.dga-boli{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 8px;border-radius:99px;background:var(--_sf);border:1px solid var(--_line);font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;flex:none}',
    '.dga-boli svg,.dga-boli img{width:22px;height:22px}',
    'button.dga-boli{min-height:44px;height:44px;padding:0 10px 0 8px}',
    '.dga-boli .dga-bplus{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--_gold);color:#fff}.dga-boli .dga-bplus svg{width:13px;height:13px}.dga-dark .dga-boli .dga-bplus{color:#231942}',
    '.dga-ib{display:inline-grid;place-items:center;width:44px;height:44px;flex:none;border-radius:14px;border:1px solid var(--_line);background:var(--_sf)}.dga-ib svg{width:20px;height:20px}.dga-ib[disabled]{opacity:.4;cursor:default}',
    '.dga-stage{position:sticky;top:var(--dga-sticky-top,0px);z-index:3;margin:0 14px;height:clamp(150px,34vh,236px);border-radius:24px;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;background:var(--_sf2);box-shadow:0 10px 24px -18px rgba(0,0,0,.5)}',
    '@supports (height:1dvh){.dga-stage{height:clamp(150px,34dvh,236px)}}',
    '.dga-pv{position:absolute;inset:0}.dga-pv svg{width:100%;height:100%;display:block}',
    '.dga-pop{animation:dga-pop .34s cubic-bezier(.34,1.56,.64,1)}@keyframes dga-pop{40%{transform:scale(1.035)}}',
    '.dga-stage .dga-ib{position:absolute;top:10px;background:color-mix(in srgb,var(--_sf) 88%,transparent);border-color:transparent;z-index:2}.dga-stage .dga-undo{left:10px}.dga-stage .dga-rand{right:10px}',
    '.dga-name{position:relative;z-index:2;margin-bottom:10px;padding:5px 14px;border-radius:99px;background:color-mix(in srgb,var(--_sf) 92%,transparent);font-weight:800;font-size:13px;max-width:calc(100% - 24px);overflow-wrap:anywhere;text-align:center}',
    '.dga-steps{position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:2}.dga-steps i{width:20px;height:5px;border-radius:9px;background:color-mix(in srgb,var(--_ink) 18%,transparent)}.dga-steps i.on{background:var(--_ac)}',
    '.dga-panel{padding:14px 14px 10px;min-width:0}',
    '.dga-sec{margin:0 0 18px;min-width:0}.dga-sec h3{margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--_mut);font-weight:700;overflow-wrap:anywhere}',
    '.dga-q{margin:0 0 10px;font-size:16px;font-weight:800}.dga-hint{margin:-4px 0 12px;color:var(--_mut);font-size:13px}',
    '.dga-seg{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.dga-gcard{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:20px;border:2px solid var(--_line);background:var(--_sf);font-weight:800;font-size:15px}.dga-gcard[aria-pressed="true"]{border-color:var(--_ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--_ac) 22%,transparent)}',
    '.dga-gcard .dga-th{max-width:96px;border-radius:18px}',
    '.dga-skins{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 6px}',
    '.dga-skin{display:flex;flex-direction:column;align-items:center;gap:5px;border:0;background:none;padding:2px;font-size:12px;font-weight:600;min-height:44px}',
    '.dga-skin b{width:46px;height:46px;border-radius:50%;display:block;border:3px solid var(--_sf);box-shadow:inset 0 -6px 10px rgba(0,0,0,.17),0 0 0 2px transparent}.dga-skin[aria-pressed="true"] b{box-shadow:inset 0 -6px 10px rgba(0,0,0,.17),0 0 0 2.5px var(--_ac)}',
    '.dga-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}',
    '@container dga (max-width:340px){.dga-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '.dga-opt{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 3px 8px;min-height:44px;min-width:0;border-radius:18px;border:2px solid transparent;background:var(--_sf);box-shadow:0 1px 0 var(--_line);transition:transform .15s,border-color .15s}',
    '.dga-opt:active{transform:scale(.97)}.dga-opt[aria-pressed="true"]{border-color:var(--_ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--_ac) 22%,transparent)}.dga-opt.is-off{opacity:.4}',
    '.dga-th{position:relative;display:block;width:100%;max-width:78px;aspect-ratio:1/1;height:auto;border-radius:14px;overflow:hidden;background:var(--_sf2)}.dga-th svg{width:100%;height:100%;display:block}@supports not (aspect-ratio:1/1){.dga-th{height:72px}}',
    '.dga-nm{font-size:12px;font-weight:700;text-align:center;line-height:1.15;max-width:100%;overflow-wrap:anywhere}',
    '.dga-nobadge{position:absolute;z-index:1;top:50%;left:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;display:grid;place-items:center;background:var(--_sf);color:var(--_mut);box-shadow:0 1px 4px rgba(0,0,0,.18)}.dga-nobadge svg{width:24px;height:24px}',
    '.dga-lk{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px 0 4px;border-radius:99px;background:var(--_ink);color:var(--_bg);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}.dga-lk svg{width:11px;height:11px}',
    '.dga-rar{position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 2px var(--_sf);z-index:1}',
    '.dga-sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:10px 6px}',
    '.dga-sw{display:flex;flex-direction:column;align-items:center;gap:5px;border:0;background:none;padding:2px;font-size:11.5px;font-weight:600;line-height:1.15;text-align:center;min-width:0;overflow-wrap:anywhere}',
    '.dga-sw b{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--sw);box-shadow:inset 0 -6px 10px rgba(0,0,0,.18),inset 0 5px 8px rgba(255,255,255,.3);color:#fff}.dga-sw b svg{width:18px;height:18px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}',
    '.dga-sw[aria-pressed="true"] b{box-shadow:inset 0 -6px 10px rgba(0,0,0,.18),0 0 0 3px var(--_bg),0 0 0 5.5px var(--_ac)}',
    '.dga-note{margin:-2px 0 12px;padding:10px 12px;border-radius:14px;background:var(--_sf);border:1px dashed var(--_line);color:var(--_mut);font-size:13px}',
    '.dga-xchips{display:flex;flex-wrap:wrap;gap:6px}.dga-xchip{min-height:40px;padding:6px 12px;border-radius:99px;border:1px solid var(--_line);background:var(--_sf);font-size:13px;font-weight:600}.dga-xchip[aria-pressed="true"]{background:var(--_ink);color:var(--_bg);border-color:var(--_ink)}',
    '.dga-buy{margin:0 14px 10px;padding:10px 12px;border-radius:18px;background:var(--_sf);border:1px solid var(--_line);display:flex;flex-direction:column;gap:8px}.dga-buy[hidden]{display:none}.dga-buy p{margin:0;font-size:13px;color:var(--_mut)}',
    '.dga-buyrow{display:flex;align-items:center;gap:10px}.dga-buyrow b{flex:1;font-size:14px}.dga-price{display:inline-flex;align-items:center;gap:4px;font-weight:700}.dga-price svg,.dga-price img{width:18px;height:18px}',
    '.dga-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 16px;border-radius:16px;border:1.5px solid var(--_line);background:var(--_sf);font-weight:800;font-size:15.5px;line-height:1.15;text-align:center}',
    '.dga-btn.pri{background:var(--_ac);color:var(--_on);border-color:var(--_ac)}.dga-btn.gold{background:var(--_gold);color:#fff;border-color:var(--_gold);min-height:44px}.dga-dark .dga-btn.gold{color:#231942}',
    '.dga-foot{position:sticky;bottom:0;z-index:4;padding:8px 14px calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(to bottom,color-mix(in srgb,var(--_bg) 0%,transparent),var(--_bg) 14px);border-radius:0 0 var(--dga-radius,24px) var(--dga-radius,24px)}',
    '.dga-cta{display:flex;gap:8px}.dga-cta .dga-btn{flex:1}.dga-cta .dga-btn.pri{flex:1.4}',
    '.dga-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}',
    '.dga-chip{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:4px 6px;border-radius:14px;border:1.5px solid var(--_line);background:var(--_sf);font-size:13px;font-weight:700;line-height:1.15;text-align:center;min-width:0;overflow-wrap:break-word}.dga-chip svg{width:16px;height:16px;flex:none}@container dga (max-width:360px){.dga-chip svg{display:none}.dga-chip{font-size:12.5px;padding:4px}}',
    '.dga-chip[aria-pressed="true"]{background:var(--_ink);color:var(--_bg);border-color:var(--_ink)}',
    '.dga-done{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;border-radius:var(--dga-radius,24px);background:radial-gradient(90% 60% at 50% 38%,var(--_sf) 0%,var(--_bg) 70%);overflow:hidden;animation:dga-pop .45s cubic-bezier(.2,1.4,.4,1)}.dga-done[hidden]{display:none}',
    '.dga-done h3{margin:0;font:400 28px/1.1 var(--_disp)}.dga-done p{margin:0;color:var(--_mut);font-size:14px}.dga-done .dga-dav{width:min(220px,60vw);aspect-ratio:1/1}.dga-done .dga-dav svg{width:100%;height:100%}',
    '.dga-conf{position:absolute;inset:0;pointer-events:none}.dga-conf i{position:absolute;top:-14px;width:8px;height:12px;border-radius:2px;animation:dga-fall 1.6s ease-in forwards}@keyframes dga-fall{to{transform:translateY(110vh) rotate(540deg)}}',
    '.dga-toast{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translate(-50%,8px);max-width:calc(100% - 32px);padding:10px 16px;border-radius:14px;background:var(--_ink);color:var(--_bg);font-size:14px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:10;text-align:center}.dga-toast.on{opacity:1;transform:translate(-50%,0)}',
    '@container dga (min-width:700px){.dga-stage{height:280px;max-width:520px;margin:0 auto;width:calc(100% - 28px)}.dga-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}.dga-chips{grid-template-columns:repeat(6,minmax(0,1fr))}.dga-skins{grid-template-columns:repeat(8,minmax(0,1fr))}}',
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
    var boli = opts.boli | 0, saved = load();
    var src0 = opts.cfg || saved || random();
    var init = opts.owned ? validate(src0, ownArg()) : norm(src0);
    var cfg = norm(init), hist = [], lookName = '', destroyed = false, toastT = 0, rxT = 0, doneT = 0, io = null, expr = '';
    /* new players (nothing saved yet) start at step 1; returning players go straight to "Make it yours" */
    var step = opts.tab === 'start' ? 1 : opts.tab ? 3 : (saved ? 3 : 1);
    var chip = TAB_CHIP[opts.tab] || 'hair';
    var isOwned = function (it) { return it.free || allOwned || owned.has(it.id); };
    var SHELL = opts.boliIcon || (root.DGAvatar && root.DGAvatar.boliIcon) || ICO.shell;
    var boliLabel = function () { return 'Boli: ' + fmt(boli) + '. Open the store'; };
    var boliInner = SHELL + '<span class="dga-bn">' + fmt(boli) + '</span>';
    var boliHTML = opts.onBoli ? '<button type="button" class="dga-boli" data-act="boli" aria-label="' + boliLabel() + '" title="Open the store">' + boliInner + '<span class="dga-bplus" aria-hidden="true">' + ICO.plus + '</span></button>' : '<span class="dga-boli" aria-live="polite">' + boliInner + '</span>';
    el.innerHTML = '<div class="dga-root' + (opts.theme === 'dark' ? ' dga-dark' : '') + '" role="region" aria-label="Character builder">' +
      '<div class="dga-head"><button type="button" class="dga-ib dga-bk" data-act="back" aria-label="Back">' + ICO.back + '</button><h2 class="dga-title">' + esc(opts.title || 'Your character') + '</h2>' + boliHTML +
      (opts.onClose ? '<button type="button" class="dga-ib" data-act="close" aria-label="Close character builder">' + ICO.close + '</button>' : '') + '</div>' +
      '<div class="dga-stage"><div class="dga-pv" aria-live="off"></div><button type="button" class="dga-ib dga-undo" data-act="undo" aria-label="Undo" title="Undo" disabled>' + ICO.undo + '</button>' +
      '<div class="dga-steps" aria-hidden="true"><i></i><i></i><i></i></div><button type="button" class="dga-ib dga-rand" data-act="random" aria-label="Shuffle" title="Shuffle">' + ICO.dice + '</button><span class="dga-name"></span></div>' +
      '<div class="dga-panel"></div><div class="dga-buy" hidden></div><div class="dga-foot"></div>' +
      '<div class="dga-done" hidden><div class="dga-conf"></div><div class="dga-dav"></div><h3>Looks great!</h3><p>Saved. This is how everyone at the table will see you.</p></div>' +
      '<div class="dga-toast" role="status" aria-live="polite"></div></div>';
    var R = el.querySelector('.dga-root'), pv = R.querySelector('.dga-pv'), panel = R.querySelector('.dga-panel'), foot = R.querySelector('.dga-foot'), buyEl = R.querySelector('.dga-buy');
    var undoBtn = R.querySelector('[data-act="undo"]'), toastEl = R.querySelector('.dga-toast'), nameEl = R.querySelector('.dga-name'), doneEl = R.querySelector('.dga-done');

    function toast(m) { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2600); }
    function setBoliText() { R.querySelector('.dga-bn').textContent = fmt(boli); var bb = R.querySelector('button.dga-boli'); if (bb) bb.setAttribute('aria-label', boliLabel()); }
    function gender() { return cfg.body === 'm' ? 'm' : 'f'; }
    /* the big preview: shows the scene, reacts with a smile on every change */
    function drawPreview(react) {
      clearTimeout(rxT);
      var e = expr || (react ? (react === true ? 'happy' : react) : null);
      pv.innerHTML = render(cfg, { size: 240, crop: '-12 2 124 84', animate: !e, expression: e, title: 'Your character preview', _live: true }); var psv = pv.querySelector('svg'); if (psv) psv.setAttribute('preserveAspectRatio', 'xMidYMin slice');
      if (react) { pv.classList.remove('dga-pop'); void pv.offsetWidth; pv.classList.add('dga-pop'); if (!expr) rxT = setTimeout(function () { if (!destroyed) drawPreview(false); }, 1300); }
      nameEl.textContent = lookName || (opts.title && opts.title !== 'Your character' ? opts.title : 'You');
      undoBtn.disabled = !hist.length;
    }
    function thumbCfg(cat, key) {
      var c = Object.assign({}, cfg); c[cat] = key;
      if (/^(hair|facial)$/.test(cat)) { c.hat = 'none'; c.mask = 'none'; }
      if (cat === 'hatColor' && !HAT_TINTED[c.hat]) c.hat = 'cap';
      if (cat === 'earrings' && (COVER[c.hair] || /^(waves|sleek|curtain|sidefringe|bob|braids|halfup|afro|long|fringelong|sideswept|wavy|sleekbob|curly)$/.test(c.hair))) c.hair = 'topbun';
      if (cat === 'neck' && (NECKCOVER[c.hair] || COVER[c.hair])) c.hair = 'topbun';
      if (cat === 'neck' && /^(beard|longbeard)$/.test(c.facial)) c.facial = 'none';
      if (cat === 'glassesColor' && c.glasses === 'none') c.glasses = 'round';
      if (cat === 'lens' && !LENS_GLASSES[c.glasses]) c.glasses = 'sunglasses';
      if (cat === 'scarfColor' && !COVER[c.hair]) c.hair = 'hijab';
      if (/^(eyes|eyeColor|lashes|brows|marks|paint|cheeks|nose|mask)$/.test(cat)) { c.glasses = 'none'; if (cat !== 'mask') c.mask = 'none'; }
      if (cat === 'facial') c.body = 'm';
      if (cat === 'outfit') { c.hat = 'none'; c.mask = 'none'; c.outfitColor = 'auto'; }
      return c;
    }
    function lockBadge(it) { return isOwned(it) ? '' : '<span class="dga-lk">' + ICO.lock + fmt(it.price) + '</span>'; }
    function swStyle(it) { var v = it.value; if (!v) return ''; if (Array.isArray(v)) return 'background:linear-gradient(160deg,' + v[0] + ',' + v[1] + ')'; if (typeof v === 'object') return 'background:' + (v.css || v.base); return '--sw:' + v; }
    function items(cat, keys) {
      var list = keys ? keys.map(function (k) { return item(cat, k); }).filter(Boolean) : PARTS[cat].filter(function (i) { return !i.legacy; });
      var sel = item(cat, cfg[cat]); if (sel && list.indexOf(sel) < 0) list.unshift(sel); /* an old v3 choice stays visible and selected */
      return list;
    }
    function sec(title, cat, list, kind, crop, note) {
      var h = '<section class="dga-sec" data-sec="' + cat + '"><h3>' + title + '</h3>' + (note ? '<p class="dga-note">' + note + '</p>' : '');
      if (kind === 'sw') return h + '<div class="dga-sws">' + list.map(function (it) {
        var on = cfg[cat] === it.key, lk = !isOwned(it), none = it.key === 'none';
        return '<button type="button" class="dga-sw" data-cat="' + cat + '" data-key="' + it.key + '" aria-pressed="' + on + '" aria-label="' + esc(it.name + (lk ? ', locked, ' + it.price + ' Boli' : '')) + '"><b style="' + (none ? 'background:var(--_sf);color:var(--_mut)' : swStyle(it)) + '">' + (none ? ICO.none : on ? ICO.check : '') + '</b>' + esc(it.name) + lockBadge(it) + '</button>';
      }).join('') + '</div></section>';
      return h + '<div class="dga-grid">' + list.map(function (it) {
        var on = cfg[cat] === it.key, lk = !isOwned(it), off = conflict(cfg, cat, it.key), none = it.key === 'none';
        return '<button type="button" class="dga-opt' + (off ? ' is-off' : '') + '" data-cat="' + cat + '" data-key="' + it.key + '" aria-pressed="' + on + '"' + (off ? ' aria-disabled="true"' : '') + ' aria-label="' + esc(it.name + (lk ? ', locked, ' + it.price + ' Boli' : '') + (off ? ', unavailable' : '')) + '">' +
          (it.rarity !== 'common' ? '<i class="dga-rar" style="background:' + RARITY_COL[it.rarity] + '" aria-hidden="true"></i>' : '') +
          '<span class="dga-th" data-crop="' + crop + '">' + (none ? '<span class="dga-nobadge">' + ICO.none + '</span>' : '') + '</span><span class="dga-nm">' + esc(it.name) + '</span>' + lockBadge(it) + '</button>';
      }).join('') + '</div></section>';
    }
    function outfitList(keys) { return keys.map(function (k) { var it = item('outfit', k); if (it && OUTS[k]) it.name = OUTS[k].n; return it; }).filter(Boolean); }
    function panelHTML() {
      var g = gender(), c = cfg, cov = !!COVER[c.hair], h = '';
      if (step === 1) {
        h = '<p class="dga-q">I am…</p><div class="dga-seg">' + ['f', 'm'].map(function (b) {
          return '<button type="button" class="dga-gcard" data-body="' + b + '" aria-pressed="' + (g === b) + '"><span class="dga-th" data-look="g' + b + '"></span>' + (b === 'f' ? 'Female' : 'Male') + '</button>';
        }).join('') + '</div><p class="dga-q" style="margin-top:18px">Skin tone</p><div class="dga-skins">' + PARTS.skin.map(function (it) {
          return '<button type="button" class="dga-skin" data-cat="skin" data-key="' + it.key + '" aria-pressed="' + (c.skin === it.key) + '"><b style="background:radial-gradient(circle at 35% 30%,' + tint(it.value, .25) + ',' + it.value + ' 55%,' + mix(it.value, '#5a2a1a', .25) + ')"></b>' + esc(it.name) + '</button>';
        }).join('') + '</div>';
        return h;
      }
      if (step === 2) return '<p class="dga-q">Pick a look</p><p class="dga-hint">Tap one. You can change anything later.</p><div class="dga-grid">' + LOOKS.map(function (l, i) {
        if (l.cfg.body !== g) return '';
        return '<button type="button" class="dga-opt" data-look="' + i + '" aria-pressed="' + (lookName === l.name) + '"><span class="dga-th" data-look="' + i + '"></span><span class="dga-nm">' + esc(l.name) + '</span></button>';
      }).join('') + '</div>';
      if (chip === 'hair') {
        h = sec('Hair style', 'hair', items('hair', g === 'f' ? F_KEYS : M_KEYS), 'th', TH.hair);
        if (cov) h += sec('Scarf colour', 'scarfColor', items('scarfColor'), 'sw');
        if (g === 'm') h += sec('Beard &amp; moustache', 'facial', items('facial'), 'th', TH.facial);
        if (panel.__other) h += sec('More styles', 'hair', (g === 'f' ? M_KEYS : F_KEYS).map(function (k) { return item('hair', k); }), 'th', TH.hair);
        else h += '<section class="dga-sec"><h3>Other styles</h3><div class="dga-xchips"><button type="button" class="dga-xchip" data-other="1">' + (g === 'f' ? 'Show the men\'s styles too' : 'Show the women\'s styles too') + '</button></div></section>';
        return h;
      }
      if (chip === 'color') return (cov ? sec('Scarf colour', 'scarfColor', items('scarfColor'), 'sw') : '') + sec(cov ? 'Hair colour (fringe &amp; brows)' : 'Hair colour', 'hairColor', items('hairColor'), 'sw');
      if (chip === 'eyes') return sec('Eye colour', 'eyeColor', items('eyeColor'), 'th', TH.eyes) + sec('Eye shape', 'eyes', items('eyes'), 'th', TH.eyes) + sec('Eyebrows', 'brows', items('brows'), 'th', TH.brows);
      if (chip === 'outfit') return sec(g === 'f' ? 'Outfits' : 'Outfits', 'outfit', outfitList(g === 'f' ? OUT_F : OUT_M), 'th', TH.body) + sec('Everyday basics', 'outfit', outfitList(OUT_B[g]), 'th', TH.body) +
        sec('Fun costumes', 'outfit', outfitList(OUT_C), 'th', TH.body) + (relevant(c, 'outfitColor') ? sec('Outfit colour', 'outfitColor', items('outfitColor'), 'sw') : '');
      if (chip === 'acc') return sec('Glasses', 'glasses', items('glasses'), 'th', TH.glasses) + (c.glasses !== 'none' ? sec('Frame colour', 'glassesColor', items('glassesColor'), 'sw') : '') +
        (g === 'f' || c.earrings !== 'none' ? sec('Earrings', 'earrings', items('earrings'), 'th', TH.ear, cov ? 'Earrings are hidden under a ' + coverName(c.hair) + '.' : '') : '') +
        sec('Necklace', 'neck', items('neck'), 'th', TH.neck, NECKCOVER[c.hair] ? 'Necklaces are hidden under a ' + coverName(c.hair) + '.' : '') +
        sec('Hats', 'hat', items('hat'), 'th', TH.hat, cov ? 'Hats sit on top of your ' + coverName(c.hair) + '.' : '') + (relevant(c, 'hatColor') ? sec('Hat colour', 'hatColor', items('hatColor'), 'sw') : '') +
        sec('Masks &amp; eye patch', 'mask', items('mask'), 'th', TH.mask);
      /* More: everything else, for players who like to fine-tune */
      return '<section class="dga-sec"><h3>Try an expression</h3><div class="dga-xchips">' + EXPRS.map(function (x) { return '<button type="button" class="dga-xchip" data-expr="' + x[0] + '" aria-pressed="' + (expr === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></section>' +
        sec('Skin tone', 'skin', items('skin'), 'sw') + sec('Face shape', 'face', items('face'), 'th', TH.face) + sec('Nose', 'nose', items('nose'), 'th', TH.nose) + sec('Mouth', 'mouth', items('mouth'), 'th', TH.mouth) +
        sec('Lip colour', 'lips', items('lips'), 'sw') + sec('Eyelashes', 'lashes', items('lashes'), 'th', TH.eyes) + sec('Blush', 'cheeks', items('cheeks'), 'th', TH.cheeks) + sec('Freckles &amp; marks', 'marks', items('marks'), 'th', TH.cheeks) +
        (relevant(c, 'lens') ? sec('Lens colour', 'lens', items('lens'), 'sw') : '') + sec('Face paint', 'paint', items('paint'), 'th', TH.paint) + sec('Background', 'bg', items('bg'), 'sw');
    }
    function footHTML() {
      if (step === 1) return '<div class="dga-cta"><button type="button" class="dga-btn pri" data-act="next">Next: pick a look</button></div>';
      if (step === 2) return '<div class="dga-cta"><button type="button" class="dga-btn" data-act="mine">Make it yours</button><button type="button" class="dga-btn pri" data-act="save">Looks great!</button></div>';
      return '<div class="dga-chips" role="group" aria-label="Customize">' + CHIPS.map(function (x) { return '<button type="button" class="dga-chip" data-chip="' + x[0] + '" aria-pressed="' + (chip === x[0]) + '">' + x[2] + '<span>' + x[1] + '</span></button>'; }).join('') + '</div>' +
        '<div class="dga-cta"><button type="button" class="dga-btn pri" data-act="save">Looks great!</button></div>';
    }
    function fillThumb(th) {
      var b = th.closest('button'), badge = th.querySelector('.dga-nobadge'), lk = th.getAttribute('data-look'), html;
      if (lk && lk[0] === 'g') { var bd = lk[1], gc = Object.assign({}, cfg, { body: bd }); if (bd !== cfg.body) { var L0 = LOOKS.filter(function (l) { return l.cfg.body === bd; })[0].cfg; gc = Object.assign({}, L0, { skin: cfg.skin }); } html = render(gc, { size: 96, crop: TH.hair, _img: true }); }
      else if (lk) { var L = LOOKS[+lk]; html = render(Object.assign({}, L.cfg, +lk % 12 < 3 ? { skin: cfg.skin } : {}), { size: 96, crop: '8 8 84 84', _img: true }); }
      else html = render(thumbCfg(b.getAttribute('data-cat'), b.getAttribute('data-key')), { size: 64, crop: th.getAttribute('data-crop'), _img: true });
      th.innerHTML = html + (badge ? badge.outerHTML : ''); th.setAttribute('data-done', '1');
    }
    /* The builder never scrolls itself: the page / sheet that hosts it does. Every scrollable ancestor keeps its position across updates. */
    function scrollSnap() { var out = [], n = el; while (n && n.nodeType === 1) { if (n.scrollHeight > n.clientHeight) out.push([n, n.scrollTop]); n = n.parentElement; } var se = document.scrollingElement || document.documentElement; if (se) out.push([se, se.scrollTop]); return out; }
    function scrollBack(s) { s.forEach(function (p) { if (Math.abs(p[0].scrollTop - p[1]) > 0.5) p[0].scrollTop = p[1]; }); }
    function sig() { return Array.prototype.map.call(panel.querySelectorAll('[data-sec]'), function (x) { return x.getAttribute('data-sec'); }).join(',') + '|' + panel.querySelectorAll('button').length; }
    function observe() {
      if (io) io.disconnect();
      var ths = panel.querySelectorAll('.dga-th:not([data-done])');
      if ('IntersectionObserver' in root) { io = new IntersectionObserver(function (ents) { ents.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); fillThumb(en.target); } }); }, { rootMargin: '160px' }); Array.prototype.forEach.call(ths, function (th) { io.observe(th); }); }
      else Array.prototype.forEach.call(ths, fillThumb);
    }
    function drawPanel(keepScroll) {
      var snap = keepScroll ? scrollSnap() : null, h = panel.offsetHeight;
      if (keepScroll && h) panel.style.minHeight = h + 'px';
      panel.innerHTML = panelHTML(); observe();
      foot.innerHTML = footHTML();
      Array.prototype.forEach.call(R.querySelectorAll('.dga-steps i'), function (x, i) { x.classList.toggle('on', i < step); });
      R.querySelector('.dga-bk').style.display = step > 1 ? '' : 'none';
      if (snap) { scrollBack(snap); var rel = function () { if (!destroyed) panel.style.minHeight = ''; }; if (root.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(rel); }); else setTimeout(rel, 32); }
      drawBuy();
    }
    /* picking an item: same buttons stay in place, only their state and thumbnails change, so the list can never jump */
    function update() {
      var before = sig(), tmp = document.createElement('div'); tmp.innerHTML = panelHTML();
      var nb = tmp.querySelectorAll('button'), ob = panel.querySelectorAll('button');
      var same = nb.length === ob.length && Array.prototype.every.call(nb, function (b, i) { return b.getAttribute('data-cat') === ob[i].getAttribute('data-cat') && b.getAttribute('data-key') === ob[i].getAttribute('data-key') && b.getAttribute('data-look') === ob[i].getAttribute('data-look') && b.getAttribute('data-expr') === ob[i].getAttribute('data-expr') && b.getAttribute('aria-label') === ob[i].getAttribute('aria-label'); });
      if (!same || before !== sig()) return drawPanel(true);
      var snap = scrollSnap();
      Array.prototype.forEach.call(ob, function (a, i) {
        var b = nb[i];['aria-pressed', 'aria-disabled', 'class', 'aria-label'].forEach(function (at) { var v = b.getAttribute(at); if (v == null) a.removeAttribute(at); else if (a.getAttribute(at) !== v) a.setAttribute(at, v); });
        var sw = a.querySelector('.dga-sw b, b'); if (a.classList.contains('dga-sw')) { var nbb = b.querySelector('b'); if (sw && nbb && sw.innerHTML !== nbb.innerHTML) sw.innerHTML = nbb.innerHTML; }
        var th = a.querySelector('.dga-th[data-done]'); if (th) fillThumb(th);
      });
      foot.innerHTML = footHTML(); scrollBack(snap); drawBuy();
    }
    function drawBuy() {
      var L = lockedIn(cfg, ownArg());
      if (!L.length) { buyEl.hidden = true; buyEl.innerHTML = ''; return; }
      buyEl.hidden = false;
      buyEl.innerHTML = '<p>You are trying on ' + (L.length > 1 ? 'locked items' : 'a locked item') + '. Unlock ' + (L.length > 1 ? 'them' : 'it') + ' to keep ' + (L.length > 1 ? 'them' : 'it') + ', or saving puts back a free choice.</p>' + L.map(function (it) {
        return '<div class="dga-buyrow"><b>' + esc(it.name) + '</b><span class="dga-price">' + SHELL + fmt(it.price) + '</span><button type="button" class="dga-btn gold" data-act="buy" data-item="' + it.id + '" aria-label="Unlock ' + esc(it.name) + ' for ' + it.price + ' Boli">Unlock</button></div>';
      }).join('');
    }
    function setCfg(n, react, name) { hist.push({ c: cfg, n: lookName }); if (hist.length > 60) hist.shift(); cfg = norm(n); if (name !== undefined) lookName = name; drawPreview(react === undefined ? true : react); update(); }
    function choose(cat, key) {
      var it = item(cat, key); if (!it) return;
      var off = conflict(cfg, cat, key); if (off) { toast(off); return; }
      if (cfg[cat] === key) return;
      var n = Object.assign({}, cfg); n[cat] = key;
      if (cat === 'outfit') { n.outfitColor = 'auto'; var was = OUTS[cfg.outfit], O = OUTS[key]; if (O && O.hat && !COVER[cfg.hair] && item('hat', O.hat)) n.hat = O.hat === 'crown' && cfg.body === 'f' ? 'tiara' : O.hat; else if (was && was.hat && cfg.hat === was.hat) n.hat = 'none'; }
      if (cat === 'hair' && COVER[key]) n.earrings = 'none';
      setCfg(n, key === 'none' ? 'blink' : true);
      if (!isOwned(it)) toast('Trying on ' + it.name + '. Unlock it to keep it.');
    }
    function setBody(b) {
      if (cfg.body === b) return;
      var L0 = LOOKS.filter(function (l) { return l.cfg.body === b; })[0];
      setCfg(Object.assign({}, L0.cfg, { skin: cfg.skin }), true, '');
    }
    function goStep(s) { step = s; if (s < 3) expr = ''; drawPanel(false); drawPreview(false); }
    function buy(id) {
      var it = BYID[id]; if (!it) return;
      if (!opts.onBuy) { toast('The store is coming soon.'); return; }
      Promise.resolve(opts.onBuy(it)).then(function (ok) {
        if (destroyed) return;
        if (ok) { owned.add(it.id); if (!opts.boliManaged) { boli = Math.max(0, boli - it.price); setBoliText(); } toast(it.name + ' unlocked!'); update(); }
        else toast(boli < it.price ? 'Not enough Boli yet. Win a few games!' : 'Purchase cancelled.');
      }, function () { toast('Purchase failed. Try again.'); });
    }
    function doSave() {
      var L = lockedIn(cfg, ownArg()), v = validate(cfg, ownArg());
      cfg = v; save(v);
      if (L.length) toast('Saved. ' + L.map(function (i) { return i.name; }).join(', ') + (L.length > 1 ? ' are' : ' is') + ' locked, so a free choice was used.');
      /* the "Looks great!" moment, then hand back to the game */
      doneEl.querySelector('.dga-dav').innerHTML = render(v, { size: 220, expression: 'laugh', _live: true });
      var cf = doneEl.querySelector('.dga-conf'), C = ['#1E6B4E', '#E0795B', '#C9A04F', '#7FB2E6', '#E29AB0'], ch = '';
      for (var i = 0; i < 34; i++) ch += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + C[i % 5] + ';animation-delay:' + (Math.random() * .45).toFixed(2) + 's"></i>';
      cf.innerHTML = ch; doneEl.hidden = false; drawPreview(false);
      clearTimeout(doneT);
      doneT = setTimeout(function () { if (destroyed) return; doneEl.hidden = true; if (opts.onSave) opts.onSave(v); }, opts.onSave ? 1150 : 1600);
    }
    R.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || !R.contains(b)) return;
      if (b.hasAttribute('data-cat')) return choose(b.getAttribute('data-cat'), b.getAttribute('data-key'));
      if (b.hasAttribute('data-body')) return setBody(b.getAttribute('data-body'));
      if (b.hasAttribute('data-look')) { var l = LOOKS[+b.getAttribute('data-look')]; if (l) setCfg(Object.assign({}, l.cfg, +b.getAttribute('data-look') % 12 < 3 ? { skin: cfg.skin } : {}), 'laugh', l.name); return; }
      if (b.hasAttribute('data-chip')) { chip = b.getAttribute('data-chip'); expr = ''; drawPanel(false); if (panel.scrollIntoView && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: 'start' }); return; }
      if (b.hasAttribute('data-other')) { panel.__other = true; drawPanel(true); return; }
      if (b.hasAttribute('data-expr')) { expr = b.getAttribute('data-expr'); Array.prototype.forEach.call(R.querySelectorAll('[data-expr]'), function (x) { x.setAttribute('aria-pressed', x === b); }); drawPreview(!!expr); return; }
      var a = b.getAttribute('data-act');
      if (a === 'random') setCfg(random(null, { body: cfg.body }), 'laugh', '');
      else if (a === 'undo') { var h = hist.pop(); if (h) { cfg = h.c; lookName = h.n; drawPreview('wink'); update(); } }
      else if (a === 'next') goStep(2);
      else if (a === 'mine') { chip = 'hair'; goStep(3); }
      else if (a === 'back') goStep(Math.max(1, step - 1));
      else if (a === 'save') doSave();
      else if (a === 'buy') buy(b.getAttribute('data-item'));
      else if (a === 'boli' && opts.onBoli) opts.onBoli();
      else if (a === 'close' && opts.onClose) opts.onClose();
    });
    R.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && opts.onClose) opts.onClose(); if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z' && hist.length) { ev.preventDefault(); var h = hist.pop(); cfg = h.c; lookName = h.n; drawPreview(false); update(); } });
    drawPanel(false); drawPreview(false);
    return {
      getConfig: function () { return norm(cfg); },
      setConfig: function (c) { setCfg(c); },
      setBoli: function (n) { boli = n | 0; setBoliText(); },
      setOwned: function (s) { allOwned = s === true || s === '*'; owned = new Set(allOwned ? [] : Array.from(s || [])); update(); },
      destroy: function () { destroyed = true; if (io) io.disconnect(); clearTimeout(toastT); clearTimeout(rxT); clearTimeout(doneT); el.innerHTML = ''; }
    };
  }

  root.DGAvatar = {
    version: 4,
    storageKey: KEY,
    catalog: catalog,
    parts: PARTS,
    categories: CAT_NAMES,
    defaults: norm(DEFAULTS),
    presets: PRESETS,
    looks: LOOKS,
    expressions: ['happy', 'laugh', 'wink', 'shocked', 'smug', 'thinking', 'sad', 'angry', 'sleepy', 'blink'],
    react: react,
    _idle: IDLE,
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
