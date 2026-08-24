// Visual + behavioural verification: serves dist/, plays a full sprint in
// Chromium at a plausible human pace, and screenshots every screen.
//
//   npm run verify -- <out-dir> [thinkMs] [light|dark]
//
// This found the backspace glyph falling back to a box, the stage composition
// stranding the problem mid-void, and the rating running away when a solver's
// latency does not scale with difficulty. Worth keeping runnable.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

const root = 'dist';
const server = createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (p === '/' || p === '\\') p = '/index.html';
    const file = join(root, p);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(4321, r));

const out = process.argv[2] ?? 'shots';
const scheme = process.argv[4] ?? 'light';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}/1-start-${scheme}.png` });

// Start a run and answer questions the way a player would.
await page.getByRole('button', { name: /start|play/i }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/2-sprint-${scheme}.png` });

// Solve items by reading the problem off the screen and typing the answer.
let solvedCount = 0;
const thinkMs = Number(process.argv[3] ?? 1500);
for (let i = 0; i < 60; i++) {
  const text = await page.locator('.problem').innerText().catch(() => null);
  if (!text) break;
  const m = text.replace(/\s+/g, ' ').match(/^(\d+)\s*([+−×÷])\s*(\d+)$/);
  if (!m) { console.log('unparsed problem:', JSON.stringify(text)); break; }
  const [, a, op, b] = m;
  const load = String(a).length + String(b).length + (op === '×' || op === '÷' ? 3 : 0);
  await page.waitForTimeout(thinkMs * 0.25 * load + Math.random() * 400);
  const x = Number(a), y = Number(b);
  const answer = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;
  // Deliberately miss one item, to exercise the penalty path.
  const typed = i === 4 ? String(answer + 1).padStart(String(answer).length, '0').slice(-String(answer).length) : String(answer);
  for (const ch of typed) { await page.keyboard.press(ch); await page.waitForTimeout(110); }
  solvedCount++;
  if (i === 4) { await page.waitForTimeout(120); await page.screenshot({ path: `${out}/3-miss-${scheme}.png` }); }
  await page.waitForTimeout(40);
}
console.log('answered', solvedCount, 'items');

// Jump to the end rather than waiting out the full two minutes.
await page.evaluate(() => { /* let the clock run out naturally below */ });
await page.waitForSelector('.reveal', { timeout: 130000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/4-reveal-${scheme}.png`, fullPage: true });

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
server.close();
