/* =====================================================================================
   Raalhu Rumble art (Dhivehi Games)                                     raalhu/art.js
   Tank sprites (the approved Version A designs), arena painting, pick-up crates and icons.
   Tanks are side views facing right in a 140 x 120 box, ground at y = 114. Each tank has one
   glass cockpit dome; the game draws the player's DGAvatar pilot inside it (layers()).
   ===================================================================================== */
(function (root) {
'use strict';
const TAU = Math.PI * 2, K = '#17202B';
const f = (c, w = 3) => `fill="${c}" stroke="${K}" stroke-width="${w}" stroke-linejoin="round"`;
const limb = (d, c, w = 5) => `<path d="${d}" stroke="${K}" stroke-width="${w + 4}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const hl = (d, o = .4) => `<path d="${d}" fill="#fff" opacity="${o}"/>`;
const wheel = (x, y, r, c = '#3A4452') => `<circle cx="${x}" cy="${y}" r="${r}" ${f(c)}/><circle cx="${x}" cy="${y}" r="${r * .45}" fill="#F2C230" stroke="${K}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r * .15}" fill="${K}"/>`;
const tread = (x, w, y = 94, h = 20) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ${f('#2B3440')}/>` + Array.from({ length: Math.round(w / 22) }, (_, i) => wheel(x + 11 + i * (w - 22) / Math.max(1, Math.round(w / 22) - 1), y + h / 2, 6.5, '#4A5566')).join('');
const collar = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="9" rx="4" ${f('#56627A')}/>`;
/* c(cx, cy, r) marks the cockpit: everything before it is drawn under the pilot, everything after on top */
const BOT = {
dhoni: c => `${limb('M18 68 V30', '#6B4226', 3)}<path d="M18 30 L38 36 L18 43Z" ${f('#FF5A4E', 2.5)}/>
${tread(16, 98)}
<path d="M8 64 H106 Q121 60 127 36 Q137 58 124 80 Q112 96 70 96 H26 Q10 90 8 64Z" ${f('#F6F1E7')}/>
<path d="M11 73 H122 Q119 81 115 86 H22 Q14 81 11 73Z" fill="#17909A"/>
<path d="M21 88 H112 Q104 96 70 96 H26 Q19 93 21 88Z" fill="#9C5B2F"/>
<path d="M8 64 H106 Q121 60 127 36 Q137 58 124 80 Q112 96 70 96 H26 Q10 90 8 64Z" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>
${hl('M14 66.5 H100 V70 H15Z', .55)}
${collar(34, 56, 44)}${c(56, 40, 19)}
<g transform="rotate(-9 82 48)"><rect x="80" y="41" width="40" height="13" rx="5" ${f('#3B414C')}/><rect x="114" y="38.5" width="9" height="18" rx="3" ${f('#2A2F38')}/>${hl('M84 43.5 H114 V46 H84Z', .3)}</g>
<circle cx="82" cy="50" r="9" ${f('#C9A45C')}/>`,
crab: c => `${limb('M52 80 L36 96 L31 113', '#B13A2A')}${limb('M64 84 L56 100 L54 113', '#B13A2A')}${limb('M84 84 L92 100 L96 113', '#C8412E')}${limb('M96 80 L110 96 L116 113', '#C8412E')}
${limb('M38 70 L24 62', '#6C7684', 5)}<path d="M12 50 Q10 40 20 40 Q26 42 24 50 L20 52Z" ${f('#E4553F', 2.5)}/><path d="M13 55 Q16 64 24 60 L22 54Z" ${f('#C8412E', 2.5)}/>
<ellipse cx="72" cy="76" rx="44" ry="21" ${f('#E4553F')}/>
<path d="M33 72 Q72 48 111 72 Q72 62 33 72Z" fill="#F58467"/>${hl('M44 64 Q70 54 96 62 Q70 58 44 66Z', .45)}
<circle cx="50" cy="84" r="2.2" fill="${K}" opacity=".35"/><circle cx="94" cy="84" r="2.2" fill="${K}" opacity=".35"/>
${limb('M92 58 L99 34', '#6C7684', 4)}<circle cx="100" cy="31" r="6.5" ${f('#fff', 2.5)}/><circle cx="102" cy="31" r="2.6" fill="${K}"/><path d="M93 22 L106 26" stroke="${K}" stroke-width="3.5" stroke-linecap="round"/>
${collar(52, 58, 36)}${c(70, 44, 18)}
${limb('M108 72 L120 60', '#6C7684', 6)}
<path d="M112 52 Q115 30 131 31 Q140 35 136 46 L124 46 Q120 50 124 56Z" ${f('#E4553F')}/><path d="M116 58 Q120 70 134 64 Q139 59 136 53 L124 56Z" ${f('#C8412E')}/>${hl('M118 44 Q121 35 130 35 Q124 38 121 46Z', .45)}`,
beru: c => `${wheel(38, 100, 13)}${wheel(98, 100, 13)}
<rect x="22" y="80" width="94" height="16" rx="6" ${f('#2F3B4C')}/>
<rect x="30" y="46" width="72" height="38" rx="12" ${f('#F3F0E8')}/>
<rect x="31.5" y="68" width="69" height="14" fill="#23467A"/><path d="M32 73 H100 M32 78 H100" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>
<rect x="30" y="46" width="72" height="38" rx="12" fill="none" stroke="${K}" stroke-width="3"/>
${hl('M38 50 H92 V54 H38Z', .6)}
${limb('M66 20 V10', '#8C96A3', 2.5)}<circle cx="66" cy="8" r="4" ${f('#FF5A4E', 2)}/>
${collar(46, 36, 40)}${c(66, 24, 17)}
<rect x="86" y="54" width="40" height="30" rx="4" ${f('#A8652F')}/>
<path d="M90 56 L96 82 L102 56 L108 82 L114 56 L120 82" stroke="#F1E3C4" stroke-width="1.6" fill="none"/>
<ellipse cx="126" cy="69" rx="6" ry="15" ${f('#EFE0C0')}/>
${limb('M92 50 L118 42', '#56627A', 5)}<circle cx="120" cy="41" r="5" ${f('#56627A', 2.5)}/>
<path d="M132 50 Q138 69 132 88" stroke="#FF8A5C" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
plane: c => `${limb('M42 88 L38 98', '#59636F', 3)}${limb('M88 88 L92 98', '#59636F', 3)}
<path d="M10 97 H104 Q116 97 118 104 Q116 111 104 111 H14 Q8 111 8 104 Q8 97 10 97Z" ${f('#F2C230')}/>${hl('M16 99.5 H100 V102 H16Z', .5)}
<path d="M16 66 L8 34 H22 L34 58Z" ${f('#FF5A4E')}/>
<path d="M14 72 Q14 58 32 56 H100 Q126 58 128 73 Q126 88 100 90 H32 Q14 88 14 72Z" ${f('#F7F4EE')}/>
<path d="M16 80 Q60 92 126 78 Q122 88 100 90 H32 Q18 88 16 80Z" fill="#FF5A4E"/>
<path d="M14 72 Q14 58 32 56 H100 Q126 58 128 73 Q126 88 100 90 H32 Q14 88 14 72Z" fill="none" stroke="${K}" stroke-width="3"/>
${hl('M30 60 H100 V63 H30Z', .6)}
<rect x="30" y="52" width="74" height="9" rx="4.5" ${f('#E9E4DA')}/><rect x="30" y="52" width="14" height="9" rx="4.5" fill="#FF5A4E" stroke="${K}" stroke-width="3"/>
${collar(68, 52, 34)}${c(86, 40, 16)}
<ellipse cx="135" cy="73" rx="3.5" ry="24" fill="#DFF3F8" opacity=".6"/><circle cx="131" cy="73" r="5" ${f('#3A424F', 2.5)}/>`,
golem: c => `${limb('M42 46 L30 20', '#F2708A', 6)}${limb('M36 36 L22 30', '#F2708A', 5)}${limb('M52 42 L56 16', '#F59A55', 6)}${limb('M55 30 L66 24', '#F59A55', 5)}
<circle cx="30" cy="18" r="4.5" ${f('#FF9AAE', 2)}/><circle cx="56" cy="13" r="4.5" ${f('#FFB27A', 2)}/>
<rect x="36" y="92" width="24" height="22" rx="8" ${f('#B89A84')}/><rect x="78" y="92" width="24" height="22" rx="8" ${f('#B89A84')}/>
<path d="M20 74 Q18 40 62 38 Q108 38 110 72 Q112 100 66 100 Q22 100 20 74Z" ${f('#DDBEA4')}/>
<path d="M30 84 q6 -6 12 0 t12 0 M34 52 q5 -4 10 0 t10 0" stroke="${K}" stroke-opacity=".25" stroke-width="2" fill="none"/>
${hl('M34 48 Q60 40 92 46 Q62 44 34 52Z', .5)}
<circle cx="36" cy="66" r="5" ${f('#8FCFC0', 2)}/><circle cx="44" cy="92" r="3.5" ${f('#F2708A', 2)}/>
${c(76, 64, 18)}
<ellipse cx="118" cy="82" rx="14" ry="13" ${f('#C9A48C')}/>${hl('M110 76 Q116 71 124 74 Q116 74 112 79Z', .5)}
<g transform="translate(8 96)"><path d="M0 0 Q7 -6 14 0 Q7 6 0 0Z M-5 -4 L0 0 L-5 4Z" fill="#FF8A3D" stroke="${K}" stroke-width="1.5"/><path d="M5 -3.5 V3.5 M9 -3.5 V3.5" stroke="#fff" stroke-width="1.4"/></g>`,
fisher: c => `<path d="M34 60 Q60 2 132 10" stroke="${K}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M34 60 Q60 2 132 10" stroke="#D8B26A" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<path d="M132 10 V50" stroke="#EAF6F9" stroke-width="1.2"/><path d="M132 50 v6 a4 4 0 0 1 -8 0" stroke="${K}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
${tread(18, 90)}
<rect x="22" y="58" width="84" height="40" rx="14" ${f('#F29A2E')}/>
<path d="M36 80 Q46 70 58 77 L65 72 L64 84 L58 80 Q46 88 36 80Z" fill="#fff" opacity=".9"/>
${hl('M30 62 H98 V66 H30Z', .45)}
<circle cx="34" cy="60" r="7" ${f('#AEB8C2', 2.5)}/>
${collar(60, 52, 34)}${c(77, 38, 17)}
<path d="M58 30 Q77 12 96 30Z" ${f('#17909A', 2.5)}/><path d="M92 28 L108 31 L94 33Z" ${f('#0F6C74', 2.5)}/>`,
catapult: c => `${wheel(34, 102, 11, '#6B3E22')}${wheel(98, 102, 11, '#6B3E22')}
${limb('M42 80 L52 58 L62 80', '#9C5F31', 6)}
${limb('M52 64 L24 30', '#B7793F', 6)}
<path d="M10 30 Q20 42 32 28 Q28 22 20 23 Q12 23 10 30Z" ${f('#7C4726')}/>
<circle cx="21" cy="17" r="11" ${f('#F0A23A')}/>${hl('M15 12 Q20 8 25 10 Q19 11 16 16Z', .5)}<path d="M21 7 q-5 -6 -10 -4 M21 7 q4 -7 10 -5" stroke="#5E9632" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<rect x="14" y="78" width="108" height="22" rx="7" ${f('#B7793F')}/>
<path d="M40 80 V98 M66 80 V98 M92 80 V98" stroke="${K}" stroke-opacity=".3" stroke-width="2"/>${hl('M20 81 H116 V84 H20Z', .4)}
<circle cx="52" cy="62" r="5" ${f('#C9A45C', 2.5)}/>
${collar(70, 68, 38)}${c(89, 54, 17)}`,
manta: c => `<ellipse cx="70" cy="110" rx="34" ry="5" fill="#7FF3FF" opacity=".5"/><path d="M52 94 L48 104 M88 94 L92 104" stroke="#8FF6FF" stroke-width="4" stroke-linecap="round" opacity=".8"/>
<path d="M18 76 Q8 80 2 92" stroke="${K}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M16 76 Q40 58 70 56 Q106 56 126 70 Q134 76 126 82 Q102 92 70 92 Q36 92 16 76Z" ${f('#24425F')}/>
<path d="M22 80 Q60 96 124 81 Q104 92 70 93 Q40 92 22 80Z" fill="#E3EDF2"/>
<path d="M16 76 Q40 58 70 56 Q106 56 126 70 Q134 76 126 82 Q102 92 70 92 Q36 92 16 76Z" fill="none" stroke="${K}" stroke-width="3"/>
<path d="M44 62 Q52 26 86 30 Q74 44 78 58Z" ${f('#1A3350')}/>${hl('M52 58 Q56 38 76 34 Q64 42 60 58Z', .25)}
<path d="M124 70 Q138 60 136 78Z" ${f('#1A3350', 2.5)}/>
<circle cx="40" cy="72" r="2.5" fill="#fff" opacity=".6"/><circle cx="50" cy="68" r="2" fill="#fff" opacity=".6"/>
${collar(80, 54, 30)}${c(95, 44, 16)}`
};
const TEAM = { dhoni: '#FF5A4E', crab: '#F2C230', golem: '#F08BD8', beru: '#8C9BFF', fisher: '#4FD1A5', catapult: '#9BE15D', plane: '#FFB86B', manta: '#6CD8FF' };
/* the cockpit of each tank (viewBox units) */
const CK = {};
Object.keys(BOT).forEach(k => { BOT[k]((cx, cy, r) => { CK[k] = { cx, cy, R: r * 1.22 }; return ''; }); });
let UID = 0;
const svgOpen = (w, extra) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 120" width="${w}" height="${Math.round(w * 120 / 140)}"${extra || ''}>`;
const glassDefs = u => `<defs><radialGradient id="${u}gl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#9FE8FF" stop-opacity=".06"/><stop offset="1" stop-color="#7FD8F0" stop-opacity=".32"/></radialGradient><radialGradient id="${u}bk" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#5FC8E0"/><stop offset="1" stop-color="#0E3A4C"/></radialGradient></defs>`;
function domeUnder(u, cx, cy, R) { return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${u}bk)"/>`; }
function domeOver(u, cx, cy, R) { return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${u}gl)"/><path d="M${cx - R * .72} ${cy - R * .18} A${R * .78} ${R * .78} 0 0 1 ${cx - R * .08} ${cy - R * .78}" stroke="#fff" stroke-width="${R * .1}" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${K}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="${R - 2.5}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>`; }
/* a whole tank as one SVG string for the page (select screen, lists, how to play). pilot = an avatar <svg> string or '' */
function tankSVG(kind, pilot, w) {
 w = w || 140; const u = 'rt' + (UID++) + '_';
 const cock = (cx, cy, r) => { const R = r * 1.22; let av = '';
  if (pilot) av = String(pilot).replace(/\swidth="[\d.]+"\s+height="[\d.]+"/, '').replace(/^\s*<svg\b/, `<svg x="${cx - R}" y="${cy - R}" width="${R * 2}" height="${R * 2}"`);
  return domeUnder(u, cx, cy, R) + `<clipPath id="${u}cc"><circle cx="${cx}" cy="${cy}" r="${R - 1}"/></clipPath><g clip-path="url(#${u}cc)">${av}</g>` + domeOver(u, cx, cy, R); };
 return svgOpen(w, ' overflow="visible" aria-hidden="true"') + glassDefs(u) + BOT[kind](cock) + '</svg>';
}
/* the three canvas layers: under (tank up to the dome background), glass (dome shine), over (parts drawn on top of the dome) */
function layers(kind) {
 const u = 'ly' + kind + '_', MARK = '\u0001'; const body = BOT[kind](() => MARK), i = body.indexOf(MARK), ck = CK[kind];
 const under = svgOpen(280) + glassDefs(u) + body.slice(0, i) + domeUnder(u, ck.cx, ck.cy, ck.R) + '</svg>';
 const glass = svgOpen(280) + glassDefs(u) + domeOver(u, ck.cx, ck.cy, ck.R) + '</svg>';
 const over = svgOpen(280) + body.slice(i + 1) + '</svg>';
 return { under, glass, over, ck };
}
const durl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

/* ---------------------------------------------------------------- arena painting (world units, 812 x 375) */
function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawPalm(g, x, y, s = 1, col = '#2E7D4F') {
 g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#8A6A48'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6, -40, 10, -78); g.stroke();
 g.strokeStyle = 'rgba(60,40,20,.35)'; g.setLineDash([2, 6]); g.stroke(); g.setLineDash([]);
 g.fillStyle = col; for (let i = 0; i < 7; i++) { const a = -Math.PI * .95 + i * Math.PI * .3; g.save(); g.translate(10, -78); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(22, -12, 44, 6); g.quadraticCurveTo(22, -2, 0, 4); g.fill(); g.restore(); }
 g.fillStyle = '#6B4A2A'; g.beginPath(); g.arc(8, -74, 4, 0, TAU); g.arc(14, -72, 4, 0, TAU); g.fill(); g.restore();
}
function postBottom(plats, p, px, H) { let b = H + 60; plats.forEach(q => { if (q !== p && q.y > p.y + 12 && px >= q.x && px <= q.x + q.w) b = Math.min(b, q.y + 4); }); return b; }
function drawPlat(g, p, plats, H) {
 const { x, y, w, k } = p; g.lineJoin = 'round'; const BOT_ = H + 60;
 if (k === 'sand') {
  const gr = g.createLinearGradient(0, y, 0, H); gr.addColorStop(0, '#FBEBC8'); gr.addColorStop(.25, '#EFD29E'); gr.addColorStop(1, '#C9A36A'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - 18, BOT_); g.quadraticCurveTo(x - 4, y + 18, x + 14, y + 2); g.quadraticCurveTo(x + 20, y, x + 30, y); g.lineTo(x + w - 30, y); g.quadraticCurveTo(x + w - 20, y, x + w - 14, y + 2); g.quadraticCurveTo(x + w + 4, y + 18, x + w + 18, BOT_); g.closePath(); g.fill(); g.strokeStyle = 'rgba(120,80,30,.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 24, y + 1, w - 48, 3); const r = rng(x * 3 + 7); for (let i = 0; i < 70; i++) { g.fillStyle = r() < .5 ? 'rgba(150,100,50,.25)' : 'rgba(255,255,255,.5)'; g.fillRect(x + r() * w, y + 6 + r() * (H - y - 6), 1.6, 1.6); }
  for (let i = 0; i < 3; i++) { const bx = x + 30 + r() * (w - 60); g.fillStyle = '#4E9A52'; g.beginPath(); g.ellipse(bx, y - 1, 12, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#6DBA62'; g.beginPath(); g.ellipse(bx - 3, y - 3, 7, 4, 0, Math.PI, 0); g.fill(); }
 } else if (k === 'jetty') {
  for (let px = x + 14; px < x + w; px += 56) { const pb = postBottom(plats, p, px, H); g.fillStyle = '#8A6A48'; g.fillRect(px, y + 10, 10, pb - y - 10); g.fillStyle = 'rgba(60,40,20,.35)'; for (let yy = y + 16; yy < pb; yy += 8) g.fillRect(px, yy, 10, 2); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(px + 1, y + 10, 3, pb - y - 10); }
  g.fillStyle = '#B98552'; rr(g, x, y, w, 11, 3); g.fill(); g.strokeStyle = '#5A3A20'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 3, y + 2, w - 6, 2);
  g.strokeStyle = 'rgba(90,58,32,.5)'; g.lineWidth = 1; for (let px = x + 14; px < x + w; px += 14) { g.beginPath(); g.moveTo(px, y + 1); g.lineTo(px, y + 10); g.stroke(); }
  g.strokeStyle = '#C9A15A'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, y - 14); g.quadraticCurveTo(x + w / 2, y - 6, x + w - 4, y - 14); g.stroke(); g.fillStyle = '#8A6A48'; g.fillRect(x + 1, y - 18, 5, 18); g.fillRect(x + w - 6, y - 18, 5, 18);
 } else if (k === 'rock') {
  const gr = g.createLinearGradient(0, y, 0, H); gr.addColorStop(0, '#E6D6BE'); gr.addColorStop(1, '#9E8A70'); g.fillStyle = gr; const r = rng(x + 5);
  g.beginPath(); g.moveTo(x, BOT_); g.lineTo(x + 6, y + 14); g.quadraticCurveTo(x + 4, y, x + 18, y); g.lineTo(x + w - 18, y); g.quadraticCurveTo(x + w - 4, y, x + w - 6, y + 14); g.lineTo(x + w, BOT_); g.closePath(); g.fill(); g.strokeStyle = 'rgba(80,60,40,.45)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 16, y + 1, w - 32, 3);
  const cc = ['#F2708A', '#F59A55', '#B07BE0', '#5FD0B0']; for (let i = 0; i < 9; i++) { const cx = x + 10 + r() * (w - 20), cy = y + 18 + r() * (H - y - 20); g.fillStyle = cc[i % 4]; g.beginPath(); g.arc(cx, cy, 4 + r() * 6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(cx - 2, cy - 2, 2, 0, TAU); g.fill(); }
  g.fillStyle = '#5FB06A'; g.beginPath(); g.ellipse(x + w * .3, y, 10, 4, 0, Math.PI, 0); g.fill();
 } else if (k === 'wreck') {
  g.fillStyle = '#6B4A32'; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + w, y + 4); g.lineTo(x + w - 20, BOT_); g.lineTo(x + 26, BOT_); g.closePath(); g.fill(); g.strokeStyle = '#3A2616'; g.lineWidth = 2.5; g.stroke();
  g.strokeStyle = 'rgba(30,18,8,.45)'; g.lineWidth = 1.5; for (let yy = y + 18; yy < H; yy += 12) { g.beginPath(); g.moveTo(x + 4, yy); g.lineTo(x + w - 6, yy); g.stroke(); }
  g.fillStyle = '#2A1A0E'; [0.25, 0.5, 0.75].forEach(t => { g.beginPath(); g.arc(x + w * t, y + 34, 7, 0, TAU); g.fill(); g.strokeStyle = '#C9A45C'; g.lineWidth = 2; g.stroke(); });
  g.fillStyle = '#9C7048'; rr(g, x - 4, y, w + 8, 11, 3); g.fill(); g.strokeStyle = '#3A2616'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, y + 2, w, 2);
  g.fillStyle = '#F2708A'; g.beginPath(); g.arc(x + 34, y + 64, 8, 0, TAU); g.arc(x + w - 40, y + 84, 7, 0, TAU); g.fill();
 } else if (k === 'quay') {
  g.fillStyle = '#CFC8BC'; g.fillRect(x, y, w, BOT_ - y); g.strokeStyle = 'rgba(90,80,70,.3)'; g.lineWidth = 1.5;
  for (let yy = y + 18; yy < H; yy += 16) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); for (let xx = x + ((yy / 16) % 2 ? 0 : 24); xx < x + w; xx += 48) { g.beginPath(); g.moveTo(xx, yy - 16); g.lineTo(xx, yy); g.stroke(); } }
  g.fillStyle = '#EFEAE0'; g.fillRect(x, y - 2, w, 9); g.fillStyle = '#F2C230'; g.fillRect(x, y + 7, w, 3); g.strokeStyle = '#6A6258'; g.lineWidth = 2; g.strokeRect(x, y - 2, w, BOT_);
  g.fillStyle = '#262B33'; for (let xx = x + 40; xx < x + w - 20; xx += 90) { g.beginPath(); g.arc(xx, y + 26, 11, 0, TAU); g.fill(); g.fillStyle = '#3A414C'; g.beginPath(); g.arc(xx, y + 26, 5, 0, TAU); g.fill(); g.fillStyle = '#262B33'; }
 } else if (k === 'dhoni') {
  g.fillStyle = '#C98548'; rr(g, x + 26, y - 26, 58, 26, 5); g.fill(); g.strokeStyle = '#2A2F38'; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#0C1820'; g.fillRect(x + 32, y - 20, 46, 10);
  g.fillStyle = '#F6F1E7'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w - 10, y); g.quadraticCurveTo(x + w + 10, y - 6, x + w + 16, y - 34); g.quadraticCurveTo(x + w + 22, y + 10, x + w - 14, y + 44); g.lineTo(x + 18, y + 44); g.quadraticCurveTo(x - 4, y + 30, x, y); g.closePath(); g.fill(); g.strokeStyle = '#2A2F38'; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = '#17909A'; g.fillRect(x + 4, y + 12, w - 8, 9); g.fillStyle = '#9C5B2F'; g.fillRect(x + 14, y + 30, w - 30, 12);
  g.fillStyle = '#B98552'; g.fillRect(x - 2, y - 3, w, 5);
 } else if (k === 'crates') {
  const cs = ['#C98548', '#2F6FD6', '#FF5A4E', '#3FB98A']; let i = 0;
  for (let yy = y; yy < BOT_; yy += 36) { for (let xx = x; xx < x + w; xx += 46) { g.fillStyle = cs[(i++) % 4]; g.fillRect(xx, yy, 44, 34); g.strokeStyle = 'rgba(20,20,20,.45)'; g.lineWidth = 2; g.strokeRect(xx, yy, 44, 34); g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); for (let k2 = 6; k2 < 44; k2 += 8) { g.moveTo(xx + k2, yy + 3); g.lineTo(xx + k2, yy + 31); } g.stroke(); } }
 } else if (k === 'roof') {
  g.fillStyle = '#F2E6D0'; g.fillRect(x + 6, y + 8, w - 12, BOT_ - y); g.fillStyle = '#2F6FD6'; for (let yy = y + 30; yy < H; yy += 34) for (let xx = x + 16; xx < x + w - 24; xx += 34) g.fillRect(xx, yy, 18, 20);
  g.fillStyle = '#E4553F'; g.beginPath(); g.moveTo(x - 6, y + 10); g.lineTo(x + w + 6, y + 10); g.lineTo(x + w - 4, y); g.lineTo(x + 4, y); g.closePath(); g.fill(); g.strokeStyle = '#8E2F22'; g.lineWidth = 2; g.stroke();
 }
}
function drawFar(g, kind, x0, x1) {
 const hz = 196, W = 812;
 if (kind === 'villas') {
  g.fillStyle = '#F6E3BA'; g.beginPath(); g.ellipse(210, hz + 2, 120, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#2F7A58'; g.beginPath(); g.ellipse(210, hz - 6, 100, 16, 0, Math.PI, 0); g.fill();
  [140, 175, 215, 250].forEach((px, i) => drawPalm(g, px, hz - 6, .32 + i % 2 * .06, '#2F7A58'));
  g.strokeStyle = '#8A6A48'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(400, hz - 6); g.lineTo(720, hz - 6); g.stroke();
  for (let vx = 420; vx <= 700; vx += 46) { g.fillStyle = '#8A6A48'; g.fillRect(vx - 1, hz - 8, 2, 10); g.fillStyle = '#EFE3CC'; g.fillRect(vx - 11, hz - 17, 22, 10); g.fillStyle = '#9C6B3A'; g.beginPath(); g.moveTo(vx - 14, hz - 16); g.lineTo(vx, hz - 26); g.lineTo(vx + 14, hz - 16); g.closePath(); g.fill(); }
 }
 if (kind === 'reef') {
  g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = -4; i < 20; i++) { g.beginPath(); g.ellipse(80 + i * 52, hz + 14 + ((i + 8) % 3) * 2, 22, 2.2, 0, 0, TAU); g.fill(); }
  g.fillStyle = '#F6E3BA'; g.beginPath(); g.ellipse(690, hz + 1, 60, 5, 0, Math.PI, 0); g.fill(); g.fillStyle = '#2F7A58'; g.beginPath(); g.ellipse(690, hz - 4, 46, 11, 0, Math.PI, 0); g.fill(); drawPalm(g, 680, hz - 4, .3, '#2F7A58'); drawPalm(g, 705, hz - 4, .26, '#2F7A58');
 }
 if (kind === 'city') {
  const r = rng(3); const cs = ['#F4E3C8', '#F7C9B8', '#CFE7EE', '#FFF3D9', '#E6D7F2', '#D5EBD0']; let xx = Math.min(-10, x0 - 10);
  while (xx < Math.max(W, x1)) { const bw = 26 + r() * 34, bh = 18 + r() * 48; g.fillStyle = cs[Math.floor(r() * cs.length)]; g.fillRect(xx, hz - bh, bw, bh + 4); g.fillStyle = 'rgba(40,70,90,.35)'; for (let wy = hz - bh + 6; wy < hz - 4; wy += 8) for (let wx = xx + 4; wx < xx + bw - 4; wx += 7) g.fillRect(wx, wy, 3, 4); xx += bw + 2; }
  g.strokeStyle = '#E4553F'; g.lineWidth = 3; g.beginPath(); g.moveTo(640, hz); g.lineTo(640, hz - 92); g.lineTo(700, hz - 92); g.moveTo(640, hz - 80); g.lineTo(680, hz - 92); g.stroke();
 }
}
const THEME = { jetty: { far: 'villas', sky: '#56BDEB', deco: [{ k: 'palm', x: 780, y: 276 }] }, reef: { far: 'reef', sky: '#3FAEE6', deco: [] }, harbour: { far: 'city', sky: '#56BDEB', deco: [{ k: 'lamp', x: 40, y: 296 }] } };
/* the static backdrop (sky, sun, far island, sea, platforms) in world units; x0..x1 / y0 = how far the screen reaches past the world */
function paintArena(g, arena, plats, x0, x1, y0, lite) {
 const W = 812, H = 375, T = THEME[arena] || THEME.jetty, top = Math.min(0, y0);
 const sky = g.createLinearGradient(0, top, 0, 200); sky.addColorStop(0, arena === 'reef' ? '#2E9BD8' : '#46AEE3'); sky.addColorStop(Math.max(0, (0 - top) / (200 - top)), T.sky); sky.addColorStop(1, '#CFF3F6'); g.fillStyle = sky; g.fillRect(x0, top, x1 - x0, 200 - top);
 const sun = g.createRadialGradient(660, 54, 0, 660, 54, 170); sun.addColorStop(0, 'rgba(255,250,220,.95)'); sun.addColorStop(.12, 'rgba(255,245,200,.6)'); sun.addColorStop(1, 'rgba(255,245,200,0)'); g.fillStyle = sun; g.fillRect(x0, top, x1 - x0, 200 - top);
 const sea = g.createLinearGradient(0, 196, 0, H); sea.addColorStop(0, '#1C8FB8'); sea.addColorStop(.25, '#2BB3C8'); sea.addColorStop(1, '#62D8D2'); g.fillStyle = sea; g.fillRect(x0, 196, x1 - x0, H + 80 - 196);
 g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; const r = rng(9); for (let i = 0; i < (lite ? 20 : 44); i++) { const y = 200 + r() * 170, x = x0 + r() * (x1 - x0), l = 10 + r() * 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); }
 drawFar(g, T.far, x0, x1);
 if (arena === 'reef') { for (let i = -2; i < 12; i++) { const x = 40 + i * 80 + r() * 30; g.fillStyle = ['#F2708A', '#F59A55', '#B07BE0', '#5FD0B0'][(i + 4) % 4]; g.beginPath(); g.ellipse(x, H - 6, 18 + r() * 14, 14 + r() * 10, 0, Math.PI, 0); g.fill(); } }
 plats.forEach(p => drawPlat(g, p, plats, H));
 T.deco.forEach(d => { if (d.k === 'palm') drawPalm(g, d.x, d.y, .95); if (d.k === 'lamp') { g.fillStyle = '#39414D'; g.fillRect(d.x, d.y - 70, 4, 70); g.fillRect(d.x, d.y - 70, 18, 4); g.fillStyle = '#FFE3A0'; g.beginPath(); g.arc(d.x + 18, d.y - 64, 5, 0, TAU); g.fill(); } });
}

/* ---------------------------------------------------------------- pick-up crates (drawn at 0,0 = ground point) */
const PICK_COL = { shell: '#7FF3E6', dbl: '#FF7254', fins: '#6CD8FF', anchor: '#FFD27A' };
function drawPickIcon(g, k, s) {
 g.save(); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
 if (k === 'shell') { g.fillStyle = '#7FF3E6'; g.strokeStyle = K; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -8); g.lineTo(7, -5); g.lineTo(7, 1); g.quadraticCurveTo(6, 6, 0, 8); g.quadraticCurveTo(-6, 6, -7, 1); g.lineTo(-7, -5); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = 'rgba(23,32,43,.5)'; g.beginPath(); g.moveTo(0, -5); g.lineTo(0, 5); g.moveTo(-4, -1); g.lineTo(4, -1); g.stroke(); }
 else if (k === 'dbl') { for (let i = 0; i < 2; i++) { const y = i ? 3.5 : -3.5; g.fillStyle = '#E6ECEF'; g.strokeStyle = K; g.lineWidth = 1.3; rr(g, -7, y - 2.4, 11, 4.8, 2); g.fill(); g.stroke(); g.fillStyle = '#FF5A4E'; g.beginPath(); g.moveTo(4, y - 2.4); g.quadraticCurveTo(9, y, 4, y + 2.4); g.closePath(); g.fill(); g.stroke(); } }
 else if (k === 'fins') { g.fillStyle = '#6CD8FF'; g.strokeStyle = K; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-8, 5); g.quadraticCurveTo(-4, -9, 7, -7); g.quadraticCurveTo(1, -2, 2, 5); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-4, 2); g.lineTo(-1, -4); g.moveTo(-1, 3); g.lineTo(2, -4); g.stroke(); }
 else if (k === 'anchor') { g.strokeStyle = K; g.lineWidth = 4.4; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 7); g.moveTo(-6, 3); g.quadraticCurveTo(0, 10, 6, 3); g.moveTo(-4, -2); g.lineTo(4, -2); g.stroke(); g.strokeStyle = '#FFD27A'; g.lineWidth = 2.2; g.stroke(); g.fillStyle = '#FFD27A'; g.strokeStyle = K; g.lineWidth = 1.3; g.beginPath(); g.arc(0, -8, 2.6, 0, TAU); g.fill(); g.stroke(); }
 g.restore();
}
function drawPick(g, pk, t) {
 const bob = Math.sin(t * 2.4 + pk.id) * 1.6, y = pk.y - 1;
 g.save(); g.translate(pk.x, y);
 g.fillStyle = 'rgba(20,30,30,.22)'; g.beginPath(); g.ellipse(0, 1, 14, 3, 0, 0, TAU); g.fill();
 g.translate(0, bob);
 g.fillStyle = '#C98548'; g.strokeStyle = K; g.lineWidth = 2; rr(g, -11, -17, 22, 17, 3); g.fill(); g.stroke(); g.strokeStyle = 'rgba(23,32,43,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-11, -9); g.lineTo(11, -9); g.moveTo(-4, -17); g.lineTo(-4, 0); g.moveTo(4, -17); g.lineTo(4, 0); g.stroke();
 const c = PICK_COL[pk.k]; const pulse = .5 + .5 * Math.sin(t * 4 + pk.id);
 g.fillStyle = c; g.globalAlpha = .28 + .2 * pulse; g.beginPath(); g.arc(0, -30, 15, 0, TAU); g.fill(); g.globalAlpha = 1;
 g.fillStyle = '#10303F'; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(0, -30, 11, 0, TAU); g.fill(); g.stroke();
 g.translate(0, -30); drawPickIcon(g, pk.k, 1);
 g.restore();
}

/* ---------------------------------------------------------------- icons (buttons, how to play) */
const IC = {
 stay: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M5 20h14"/><rect x="8" y="9" width="8" height="8" rx="2"/></svg>',
 jump: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c2-9 7-13 14-13" stroke-dasharray="2 3"/><path d="M14 4l4 3-3 4"/></svg>',
 missile: '<svg viewBox="0 0 24 24"><path d="M3 12h3l2-3h9l4 3-4 3H8l-2-3" fill="#E6ECEF" stroke="#fff" stroke-width="1"/><path d="M17 9l4 3-4 3z" fill="#FF7254"/><path d="M1 12h3" stroke="#FFD27A" stroke-width="2" stroke-linecap="round"/></svg>',
 bomb: '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="7" fill="#2A2F38" stroke="#fff" stroke-width="1.2"/><circle cx="8.5" cy="11.5" r="2" fill="#fff" opacity=".35"/><path d="M15 8q2-4 5-3" stroke="#C9A45C" stroke-width="1.8" fill="none"/><circle cx="20" cy="5" r="2" fill="#FFD27A"/></svg>',
 shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" fill="#7FF3E6" fill-opacity=".35" stroke="#7FF3E6" stroke-width="2"/></svg>',
 special: '<svg viewBox="0 0 24 24" fill="#FFD27A"><path d="M12 2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17l-6 3.4 1.3-6.7-5-4.7 6.8-.8z"/></svg>',
 lock: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
 tide: '<svg viewBox="0 0 24 24" fill="none" stroke="#7FF3E6" stroke-width="2.2" stroke-linecap="round"><path d="M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1"/><path d="M12 11V3M8.5 6.5 12 3l3.5 3.5"/></svg>',
 menu: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 bot: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="8" width="14" height="11" rx="4"/><path d="M12 8V4M9 13h.01M15 13h.01"/></svg>',
 globe: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>',
 sound: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><g class="snd"><path d="M16.5 8.5a5 5 0 0 1 0 7"/></g><path class="mute" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
 back: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
 close: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 replay: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
 full: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
 book: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5M8 7.5h8"/></svg>',
 eye: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
};
function pickSVG(k, size) {
 size = size || 28; const body = {
  shell: '<path d="M0 -8L7 -5V1Q6 6 0 8Q-6 6 -7 1V-5Z" fill="#7FF3E6" stroke="#17202B" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 -5V5M-4 -1H4" stroke="rgba(23,32,43,.5)" stroke-width="1.6"/>',
  dbl: '<g stroke="#17202B" stroke-width="1.3"><rect x="-7" y="-5.9" width="11" height="4.8" rx="2" fill="#E6ECEF"/><path d="M4 -5.9Q9 -3.5 4 -1.1Z" fill="#FF5A4E"/><rect x="-7" y="1.1" width="11" height="4.8" rx="2" fill="#E6ECEF"/><path d="M4 1.1Q9 3.5 4 5.9Z" fill="#FF5A4E"/></g>',
  fins: '<path d="M-8 5Q-4 -9 7 -7Q1 -2 2 5Z" fill="#6CD8FF" stroke="#17202B" stroke-width="1.5" stroke-linejoin="round"/><path d="M-4 2L-1 -4M-1 3L2 -4" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>',
  anchor: '<path d="M0 -6V7M-6 3Q0 10 6 3M-4 -2H4" stroke="#17202B" stroke-width="4.4" fill="none" stroke-linecap="round"/><path d="M0 -6V7M-6 3Q0 10 6 3M-4 -2H4" stroke="#FFD27A" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="0" cy="-8" r="2.6" fill="#FFD27A" stroke="#17202B" stroke-width="1.3"/>' }[k] || '';
 return `<svg viewBox="-12 -12 24 24" width="${size}" height="${size}" aria-hidden="true"><circle r="11" fill="#10303F" stroke="${PICK_COL[k]}" stroke-width="2"/>${body}</svg>`;
}

root.RRArt = { K, BOT, CK, TEAM, tankSVG, layers, durl, paintArena, drawPlat, drawPalm, drawPick, drawPickIcon, pickSVG, PICK_COL, IC, rr, rng, THEME };
})(typeof window !== 'undefined' ? window : globalThis);
