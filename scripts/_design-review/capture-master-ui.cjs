/* Design-review render harness: renders the real TroubleMastersClient against a fake
   API and the app's real stylesheet stack, then captures screenshots. Not a test. */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'scripts', '_design-review', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const rows = [
  { id: 1, kind: 'symptom', name: 'Down', description: 'Layanan tidak dapat diakses sama sekali.', sortOrder: 0, active: true, usageCount: 12 },
  { id: 2, kind: 'symptom', name: 'Packet Loss', description: 'Paket hilang sebagian, koneksi tidak stabil.', sortOrder: 1, active: true, usageCount: 4 },
  { id: 3, kind: 'symptom', name: 'High Latency', description: 'Waktu respons di atas ambang SLA.', sortOrder: 2, active: true, usageCount: 0 },
  { id: 4, kind: 'symptom', name: 'Flapping', description: 'Link naik turun berulang dalam 24 jam.', sortOrder: 3, active: false, usageCount: 0 },
  { id: 5, kind: 'cause', name: 'FO CUT', description: 'Kabel fiber optik putus.', sortOrder: 0, active: true, usageCount: 7 },
  { id: 6, kind: 'cause', name: 'Belum diketahui', description: 'Masih dalam investigasi.', sortOrder: 1, active: true, usageCount: 2 },
];

async function main() {
  const built = await esbuild.build({
    stdin: {
      contents: "import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/settings/trouble-masters/TroubleMastersClient';createRoot(document.getElementById('app')).render(<Client/>);",
      resolveDir: root,
      sourcefile: 'master-fixture.jsx',
      loader: 'jsx',
    },
    bundle: true,
    write: false,
    outdir: 'out',
    loader: { '.js': 'jsx' },
    jsx: 'automatic',
  });
  const js = built.outputFiles.find(x => x.path.endsWith('.js')).text;
  const css = built.outputFiles.find(x => x.path.endsWith('.css')).text;

  const sheets = ['ui-tokens.css', 'globals.css', 'legacy-ui.css', 'ui-foundation.css'].map(f => path.join(root, 'app', f));
  const server = http.createServer(async (req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); return; }
    if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
    if (req.url.startsWith('/styles/')) {
      const file = sheets[Number(req.url.split('/').pop())];
      res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(file)); return;
    }
    if (req.url.startsWith('/api/trouble-masters')) {
      const id = Number(req.url.split('/').pop());
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') { res.end(JSON.stringify(rows)); return; }
      let text = ''; for await (const part of req) text += part;
      if (req.method === 'DELETE') {
        const index = rows.findIndex(row => row.id === id);
        if (index < 0) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Master tidak ditemukan.' })); return; }
        res.end(JSON.stringify({ deleted: true, id })); return;
      }
      const body = JSON.parse(text || '{}');
      if (req.method === 'PATCH') {
        const row = rows.find(x => x.id === id);
        if (!row) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Master tidak ditemukan.' })); return; }
        Object.assign(row, body);
        res.end(JSON.stringify(row)); return;
      }
      const row = { ...body, id: rows.length + 1, usageCount: 0 };
      rows.push(row); res.statusCode = 201; res.end(JSON.stringify(row)); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      ${sheets.map((_, i) => `<link rel="stylesheet" href="/styles/${i}">`).join('')}
      <link rel="stylesheet" href="/app.css">
      </head><body><main class="container"><header class="page-header"><h1>Master Data Trouble</h1><p>Kelola gejala dan penyebab standar. Perubahan nama tidak mengubah riwayat tiket.</p></header><div id="app"></div></main><script src="/app.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const report = [];
  try {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.addInitScript(t => { document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', t)); }, theme);
      await page.goto(base);
      await page.waitForSelector('tbody tr');
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outDir, `after-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Tambah Gejala' }).click();
      await page.waitForSelector('dialog[open]');
      await page.waitForTimeout(250);
      const dialogBox = await page.locator('dialog[open]').boundingBox();
      const viewport = page.viewportSize();
      report.push({ theme, dialogTop: Math.round(dialogBox.y), dialogBottom: Math.round(dialogBox.y + dialogBox.height), viewportHeight: viewport.height });
      await page.screenshot({ path: path.join(outDir, `after-${theme}-dialog.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      await page.getByRole('button', { name: 'Hapus Down' }).click();
      await page.waitForSelector('dialog[open]');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `after-${theme}-delete.png`) });
      await page.keyboard.press('Escape');
      await page.close();
    }
    for (const width of [390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(base);
      await page.waitForSelector('tbody tr');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `after-w${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Tambah Gejala' }).click();
      await page.waitForSelector('dialog[open]');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `after-w${width}-dialog.png`) });
      await page.keyboard.press('Escape');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      report.push({ width, overflowX: overflow });
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(base);
    await page.waitForSelector('tbody tr');
    await page.getByLabel('Cari Gejala').fill('zzz');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, 'after-search-empty.png'), fullPage: true });
    await page.getByLabel('Cari Gejala').fill('');
    await page.getByRole('button', { name: 'Penyebab 2' }).click().catch(() => {});
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(outDir, 'after-cause.png'), fullPage: true });
    await page.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify(report, null, 1));
  console.log('shots ->', outDir);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
