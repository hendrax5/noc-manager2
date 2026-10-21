const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
async function main() {
  const root = path.resolve(__dirname, '..');
  const built = await esbuild.build({ stdin: { contents: "import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/settings/service-work-types/ServiceWorkTypesClient';createRoot(document.getElementById('app')).render(<Client categories={[{id:3,name:'Provisioning'}]}/>);", resolveDir: root, sourcefile: 'master-fixture.jsx', loader: 'jsx' }, bundle: true, write: false, outdir: 'out', loader: { '.js': 'jsx' }, jsx: 'automatic' });
  const js = built.outputFiles.find(x => x.path.endsWith('.js')).text, css = built.outputFiles.find(x => x.path.endsWith('.css')).text;
  const rows = [{ id: 1, name: 'Instalasi Baru', operation: 'Installation', defaultJobCategoryId: null, sortOrder: 0, active: true }];
  let forbidden = false;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); return; }
    if (req.url.startsWith('/api/service-work-types')) {
      res.setHeader('Content-Type', 'application/json');
      if (forbidden) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Forbidden' })); return; }
      if (req.method === 'GET') { assert.equal(req.url, '/api/service-work-types?includeInactive=true'); res.end(JSON.stringify(rows)); return; }
      let text = ''; for await (const part of req) text += part;
      const body = JSON.parse(text), id = Number(req.url.split('/').pop());
      if (rows.some(row => row.id !== id && row.name.trim().toLowerCase() === body.name.trim().toLowerCase())) { res.statusCode = 409; res.end(JSON.stringify({ error: 'Nama jenis pekerjaan sudah ada.' })); return; }
      const index = rows.findIndex(row => row.id === id);
      if (req.method === 'PATCH') assert.equal('operation' in body, false, 'edit must not send operation');
      const row = { ...(rows[index] || {}), ...body, id: req.method === 'PATCH' ? id : rows.length + 1 };
      if (index >= 0) rows[index] = row; else rows.push(row);
      res.end(JSON.stringify(row)); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html lang="id"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--card-bg:#fff;--text-color:#222;--input-bg:#fff;--input-text:#222;--border-color:#ccc;--secondary-color:#14645f;--radius-sm:6px;--radius-md:9px;--danger-text:#a22;--table-header-bg:#eee}body{font:14px Arial;margin:16px}*{box-sizing:border-box}${css}</style><h1>Jenis Pekerjaan Layanan</h1><main id="app"></main><script src="/app.js"></script></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel('Nama jenis pekerjaan', { exact: true }).fill('Upgrade premium');
    await page.getByLabel('Operasi layanan').selectOption('Upgrade');
    await page.getByLabel('Saran Job Category').selectOption('3');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Upgrade premium' }).waitFor();
    assert.equal(rows[1].defaultJobCategoryId, 3);
    await page.getByLabel('Nama jenis pekerjaan', { exact: true }).fill('UPGRADE PREMIUM');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    assert.match(await page.getByRole('alert').innerText(), /sudah ada/);
    await page.getByRole('button', { name: 'Edit Upgrade premium', exact: true }).click();
    assert.equal(await page.getByLabel('Operasi layanan').isDisabled(), true);
    await page.getByLabel('Aktif (tersedia untuk tiket baru)').uncheck();
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Upgrade premium' }).getByText('Nonaktif', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Upgrade premium', exact: true }).click();
    await page.getByLabel('Aktif (tersedia untuk tiket baru)').check();
    await page.getByLabel('Saran Job Category').selectOption('');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Upgrade premium' }).getByText('Aktif', { exact: true }).waitFor();
    assert.equal(rows[1].defaultJobCategoryId, null);
    await page.getByLabel('Cari jenis pekerjaan').fill('missing');
    assert.equal(await page.locator('tbody tr').count(), 0);
    await page.setViewportSize({ width: 320, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByLabel('Cari jenis pekerjaan').fill('');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    forbidden = true; await page.reload();
    assert.equal(await page.getByRole('alert').innerText(), 'Forbidden');
    assert.equal(await page.locator('tbody tr').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: actual master UI add, mapping, duplicate feedback, immutable operation, disable/reactivate, search, forbidden feedback and 320px. Synthetic API only; fresh DB ACL tested by backend suite.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
