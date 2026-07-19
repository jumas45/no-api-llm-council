// Generates Chrome Web Store listing images (screenshots + promo tiles) from
// the app screenshots in ./assets and the extension icon. Output is written to
// "docs/Google Web Store/" (git-ignored) at the exact sizes the store requires,
// as 24-bit PNGs with no alpha channel.
//
//   npm run store-assets
//
// Store specs: screenshots 1280x800, small promo 440x280, marquee 1400x560.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs/Google Web Store');
const ASSETS = path.join(ROOT, 'assets');
const ICON = path.join(ROOT, 'public/icons/icon-128.png');
fs.mkdirSync(OUT, { recursive: true });

const FONT = 'Segoe UI, Arial, sans-serif';
const C = {
  base0: '#0c1328', base1: '#080b18',
  green: '#19c37d', orange: '#e08a63', blue: '#5b8df0',
  white: '#ffffff', muted: '#aeb7d4',
};
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Branded background: navy gradient + three model glows echoing the icon.
function bgSvg(W, H) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${C.base0}"/>
      <stop offset="1" stop-color="${C.base1}"/>
    </linearGradient>
    <radialGradient id="gg" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.green}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${C.green}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gb" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.blue}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
    <radialGradient id="go" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.orange}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="${W * 0.5}"  cy="${-H * 0.05}" rx="${W * 0.5}"  ry="${H * 0.55}" fill="url(#gg)"/>
  <ellipse cx="${W * 0.08}" cy="${H * 0.95}"  rx="${W * 0.45}" ry="${H * 0.6}"  fill="url(#gb)"/>
  <ellipse cx="${W * 0.95}" cy="${H * 0.9}"   rx="${W * 0.42}" ry="${H * 0.6}"  fill="url(#go)"/>
</svg>`;
}

// Fit an image into maxW x maxH (no crop), round corners. Returns {buf,w,h}.
async function card(input, maxW, maxH, radius = 14) {
  const m = await sharp(input).metadata();
  const s = Math.min(maxW / m.width, maxH / m.height);
  const w = Math.round(m.width * s), h = Math.round(m.height * s);
  const resized = await sharp(input).resize(w, h).toBuffer();
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}"/></svg>`);
  const buf = await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { buf, w, h };
}
async function shadow(w, h, radius = 14, pad = 60, blur = 20, op = 0.55) {
  return sharp(Buffer.from(`<svg width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="${radius}" fill="#000" fill-opacity="${op}"/></svg>`)).blur(blur).png().toBuffer();
}
const iconBuf = size => sharp(ICON).resize(size, size).png().toBuffer();

async function finish(base, W, H, name) {
  const out = path.join(OUT, name);
  await sharp(base).flatten({ background: C.base1 }).png({ compressionLevel: 9 }).toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`  ${name.padEnd(34)} ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}`);
}

function chip(x, y, label, color) {
  const w = 34 + label.length * 11;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="40" rx="20" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.14"/>
    <circle cx="${x + 20}" cy="${y + 20}" r="6" fill="${color}"/>
    <text x="${x + 34}" y="${y + 26}" font-family="${FONT}" font-size="18" font-weight="600" fill="${C.white}">${esc(label)}</text>
  </g>`;
}

// ---------- Screenshots (1280x800) ----------
async function landscapeShot(src, headline, sub, name) {
  const W = 1280, H = 800;
  const c = await card(path.join(ASSETS, src), 1140, 560, 14);
  const cx = Math.round((W - c.w) / 2), cy = 200 + Math.round((560 - c.h) / 2);
  const sh = await shadow(c.w, c.h);
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="${W / 2}" y="96" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="700" fill="${C.white}">${esc(headline)}</text>
    <text x="${W / 2}" y="140" text-anchor="middle" font-family="${FONT}" font-size="22" fill="${C.muted}">${esc(sub)}</text>
  </svg>`;
  const composed = await sharp(Buffer.from(bgSvg(W, H))).composite([
    { input: sh, left: cx - 60, top: cy - 50 },
    { input: c.buf, left: cx, top: cy },
    { input: Buffer.from(text), top: 0, left: 0 },
  ]).png().toBuffer();
  await finish(composed, W, H, name);
}

async function portraitShot(src, lines, sub, name) {
  const W = 1280, H = 800;
  const c = await card(path.join(ASSETS, src), 590, 680, 14);
  const cx = 640 + Math.round((640 - c.w) / 2), cy = 60 + Math.round((680 - c.h) / 2);
  const sh = await shadow(c.w, c.h);
  let ty = 300;
  const head = lines.map(l => { const t = `<text x="70" y="${ty}" font-family="${FONT}" font-size="46" font-weight="700" fill="${C.white}">${esc(l)}</text>`; ty += 58; return t; }).join('');
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${head}
    <text x="70" y="${ty + 12}" font-family="${FONT}" font-size="22" fill="${C.muted}">${esc(sub)}</text>
    ${chip(70, ty + 44, 'No API keys', C.green)}
    ${chip(232, ty + 44, 'Stays in your browser', C.blue)}
  </svg>`;
  const composed = await sharp(Buffer.from(bgSvg(W, H))).composite([
    { input: sh, left: cx - 60, top: cy - 50 },
    { input: c.buf, left: cx, top: cy },
    { input: Buffer.from(text), top: 0, left: 0 },
  ]).png().toBuffer();
  await finish(composed, W, H, name);
}

// ---------- Small promo tile (440x280) ----------
async function smallPromo() {
  const W = 440, H = 280;
  const icon = await iconBuf(76);
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="34" y="60" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="1.5" fill="${C.green}">NO KEYS · NO API CALLS</text>
    <text x="32" y="104" font-family="${FONT}" font-size="42" font-weight="800" fill="${C.white}">No API</text>
    <text x="32" y="148" font-family="${FONT}" font-size="42" font-weight="800" fill="${C.white}">LLM Council</text>
    <text x="34" y="184" font-family="${FONT}" font-size="16" fill="${C.muted}">Three AI models debate —</text>
    <text x="34" y="206" font-family="${FONT}" font-size="16" fill="${C.muted}">one better answer.</text>
    ${chip(34, 226, 'ChatGPT', C.green)}
    ${chip(162, 226, 'Claude', C.orange)}
    ${chip(274, 226, 'Gemini', C.blue)}
  </svg>`;
  const composed = await sharp(Buffer.from(bgSvg(W, H))).composite([
    { input: icon, left: W - 76 - 26, top: 26 },
    { input: Buffer.from(text), top: 0, left: 0 },
  ]).png().toBuffer();
  await finish(composed, W, H, 'promo-small-440x280.png');
}

// ---------- Marquee promo tile (1400x560) ----------
async function marqueePromo() {
  const W = 1400, H = 560;
  const icon = await iconBuf(112);
  const c = await card(path.join(ASSETS, 'no-api-llm-council-final-output.png'), 640, 470, 14);
  const cx = 712, cy = Math.round((H - c.h) / 2);
  const sh = await shadow(c.w, c.h);
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <text x="200" y="112" font-family="${FONT}" font-size="16" font-weight="700" letter-spacing="1.5" fill="${C.green}">NO API · NO KEYS · NO BACKGROUND CALLS</text>
    <text x="200" y="150" font-family="${FONT}" font-size="18" fill="${C.muted}">Karpathy's llm-council, in your browser</text>
    <text x="72" y="252" font-family="${FONT}" font-size="52" font-weight="800" fill="${C.white}">No API LLM Council</text>
    <text x="72" y="306" font-family="${FONT}" font-size="24" fill="${C.muted}">A 3-stage debate across ChatGPT, Claude &amp; Gemini,</text>
    <text x="72" y="340" font-family="${FONT}" font-size="24" fill="${C.muted}">driven in your own tabs. One better answer.</text>
    ${chip(72, 378, 'ChatGPT', C.green)}
    ${chip(220, 378, 'Claude', C.orange)}
    ${chip(332, 378, 'Gemini', C.blue)}
    <text x="72" y="470" font-family="${FONT}" font-size="17" fill="#8b95b6">First Opinions → Anonymized Peer Review → Chairman's Synthesis</text>
  </svg>`;
  const composed = await sharp(Buffer.from(bgSvg(W, H))).composite([
    { input: sh, left: cx - 60, top: cy - 50 },
    { input: c.buf, left: cx, top: cy },
    { input: icon, left: 72, top: 76 },
    { input: Buffer.from(text), top: 0, left: 0 },
  ]).png().toBuffer();
  await finish(composed, W, H, 'promo-marquee-1400x560.png');
}

console.log('Screenshots (1280x800):');
await landscapeShot('no-api-llm-council-final-output.png',
  'One question. Three AI models. One better answer.',
  'The council debates in the side panel, right next to your chat.',
  'screenshot-1-final-output.png');
await portraitShot('no-api-llm-council-in-progress.png',
  ['Watch the 3-stage', 'debate unfold live'],
  'First Opinions → Peer Review → Synthesis, step by step.',
  'screenshot-2-in-progress.png');
await landscapeShot('no-api-llm-council-output.png',
  'Anonymized peer review keeps every model honest',
  'Each model critiques and ranks the others without seeing the authors.',
  'screenshot-3-peer-review.png');
await landscapeShot('no-api-llm-council-history.png',
  'Every council session, saved locally',
  'Revisit, reuse, or export any past debate — all stored in your browser.',
  'screenshot-4-history.png');
await portraitShot('no-api-llm-council-settings.png',
  ['Your council,', 'your rules'],
  'Pick members and chairman, or edit the prompt templates.',
  'screenshot-5-settings.png');
console.log('Promo tiles:');
await smallPromo();
await marqueePromo();
console.log('Done ->', OUT);
