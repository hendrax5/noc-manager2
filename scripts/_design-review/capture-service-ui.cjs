/* Visual check for the service-work-types master screen. Not a test. */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(__dirname, 'shots');
fs.mkdirSync(outDir, { recursive: true });

const rows = [
  { id: 1, name: 'Instalasi Baru', operation: 'Installation', defaultJobCategoryId: 3, sortOrder: 0, active: true, usageCount: 18 },
  { id: 2, name: 'Upgrade Bandwidth', operation: 'Upgrade', defaultJobCategoryId: 3, sortOrder: 1, active: true, usageCount: 4 },
  { id: 3, name: 'Perubahan Layanan', operation: 'Change', defaultJobCategoryId: null, sortOrder: 2, active: true, usageCount: 0 },
  { id: 4, name: 'BOD Sementara', operation: 'BOD', defaultJobCategoryId: null, sortOrder: 3, active: false, usageCount: 0 },
];

async function main() {
  const built = await esbuild.build({
    stdin: { contents: "import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/settings/service-work-types/ServiceWorkTypesClient';createRoot(document.getElementById('app')).render(<Client categories={[{id:3,name:'Provisioning'},{id:4,name:'Assurance'}]}/>);", resolveDir: root, sourcefile: 'service-fixture.jsx', loader: 'jsx' },
    bundle: true, write: false, outdir: 'out', loader: { '.js': 'jsx' }, jsx: 'automatic',
  });
  const js = built.outputFiles.find(x => x.path.endsWith('.js')).text;
  const css = built.outputFiles.find(x => x.path.endsWith('.css')).text;
  const sheets = ['ui-tokens.css', 'globals.css', 'legacy-ui.css', 'ui-foundation.css'].map(f => path.join(root, 'app', f));
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); return; }
    if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
    if (req.url.startsWith('/styles/')) { res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(sheets[Number(req.url.split('/').pop())])); return; }
    if (req.url.startsWith('/api/service-work-types')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(rows)); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${sheets.map((_, i) => `<link rel="stylesheet" href="/styles/${i}">`).join('')}<link rel="stylesheet" href="/app.css"></head><body><main class="container"><header class="page-header"><h1>Jenis Pekerjaan Layanan</h1><p>Jenis pekerjaan menentukan perubahan circuit. Job Category menentukan poin.</p></header><div id="app"></div></main><script src="/app.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const [width, height] of [[1280, 900], [768, 900], [390, 900], [390, 600]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(base);
      await page.waitForSelector('tbody tr');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `service-${width}.png`), fullPage: true });
      if (width === 1280) {
        await page.getByRole('button', { name: 'Tambah jenis pekerjaan' }).click();
        await page.waitForSelector('dialog[open]');
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(outDir, 'service-dialog.png') });
        await page.getByLabel('Saran Job Category').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(outDir, 'service-picker.png') });
      }
      if (width === 390) {
        await page.getByRole('button', { name: 'Tambah jenis pekerjaan' }).click();
        await page.waitForSelector('dialog[open]');
        await page.getByLabel('Saran Job Category').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(outDir, height === 600 ? 'service-picker-short.png' : 'service-picker-mobile.png') });
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      console.log(width, 'overflowX', overflow);
      await page.close();
    }

    const dark = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await dark.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', 'dark')));
    await dark.goto(base);
    await dark.waitForSelector('tbody tr');
    await dark.getByRole('button', { name: 'Tambah jenis pekerjaan' }).click();
    await dark.waitForSelector('dialog[open]');
    await dark.getByLabel('Saran Job Category').click();
    await dark.waitForTimeout(200);
    await dark.screenshot({ path: path.join(outDir, 'service-picker-dark.png') });
    await dark.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log('shots ->', outDir);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
