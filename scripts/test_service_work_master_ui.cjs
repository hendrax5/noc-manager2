const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
async function main() {
  const root = path.resolve(__dirname, '..');
  const built = await esbuild.build({ stdin: { contents: "import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/settings/service-work-types/ServiceWorkTypesClient';createRoot(document.getElementById('app')).render(<Client categories={[{id:3,name:'Provisioning'},{id:4,name:'Assurance'}]}/>);", resolveDir: root, sourcefile: 'master-fixture.jsx', loader: 'jsx' }, bundle: true, write: false, outdir: 'out', loader: { '.js': 'jsx' }, jsx: 'automatic' });
  const js = built.outputFiles.find(x => x.path.endsWith('.js')).text, css = built.outputFiles.find(x => x.path.endsWith('.css')).text;
  const rows = [
    { id: 1, name: 'Instalasi Baru', operation: 'Installation', defaultJobCategoryId: null, sortOrder: 0, active: true, usageCount: 2 },
    { id: 2, name: 'Terminasi sementara', operation: 'Terminate', defaultJobCategoryId: 3, sortOrder: 1, active: true, usageCount: 0 },
  ];
  let forbidden = false;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); return; }
    if (req.url.startsWith('/api/service-work-types')) {
      res.setHeader('Content-Type', 'application/json');
      if (forbidden) { res.statusCode = 403; res.end(JSON.stringify({ error: 'Forbidden' })); return; }
      if (req.method === 'GET') { assert.equal(req.url, '/api/service-work-types?includeInactive=true'); res.end(JSON.stringify(rows)); return; }
      const id = Number(req.url.split('/').pop());
      if (req.method === 'DELETE') {
        const row = rows.find(x => x.id === id);
        if (!row) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Jenis pekerjaan tidak ditemukan.' })); return; }
        if (row.usageCount > 0) { res.statusCode = 409; res.end(JSON.stringify({ error: `Jenis pekerjaan ini dipakai ${row.usageCount} tiket dan tidak dapat dihapus.`, usageCount: row.usageCount })); return; }
        rows.splice(rows.indexOf(row), 1); res.end(JSON.stringify({ deleted: true, id })); return;
      }
      let text = ''; for await (const part of req) text += part;
      const body = JSON.parse(text || '{}'), index = rows.findIndex(row => row.id === id);
      if (req.method === 'PATCH') {
        assert.equal('operation' in body, false, 'edit must not send operation');
        Object.assign(rows[index], body); res.end(JSON.stringify(rows[index])); return;
      }
      if (rows.some(row => row.name.trim().toLowerCase() === body.name.trim().toLowerCase())) { res.statusCode = 409; res.end(JSON.stringify({ error: 'Nama jenis pekerjaan sudah ada.' })); return; }
      const row = { ...body, id: rows.length + 1, usageCount: 0 };
      rows.push(row); res.statusCode = 201; res.end(JSON.stringify(row)); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Master Jenis Pekerjaan QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ui-font:system-ui;--ui-mono:monospace;--ui-ink:#111;--ui-text:#222;--ui-muted:#555;--ui-bg:#f5f6f8;--ui-surface:#fff;--ui-subtle:#f6f7f8;--ui-line:#ccc;--ui-control-line:#aaa;--ui-accent:#14645f;--ui-accent-hover:#0d4d49;--ui-tint:#eaf6f4;--ui-on-accent:#fff;--ui-focus:#06c;--ui-danger:#a22;--ui-danger-bg:#fee;--ui-success:#176043;--ui-success-bg:#e2f3eb;--card-bg:#fff;--text-color:#222;--heading-color:#111;--muted-text:#555;--input-bg:#fff;--input-text:#222;--border-color:#ccc;--secondary-color:#14645f;--accent-hover:#0d4d49;--hover-bg:#f5f5f5;--danger-text:#a22;--danger-bg:#fee;--success-text:#176043;--radius-sm:6px;--radius-md:9px;--ui-radius:5px;--ui-radius-lg:8px;--ui-control-height:2.75rem;--ui-speed:150ms;--ui-hairline:1px;--ui-space-1:.25rem;--ui-space-2:.5rem;--ui-space-3:.75rem;--ui-space-4:1rem;--ui-space-5:1.25rem;--ui-space-6:1.5rem;--ui-space-8:2rem;--ui-type-xs:.6875rem;--ui-type-sm:.75rem;--ui-type-meta:.8125rem;--ui-type-body:.875rem;--ui-type-section:1rem;--ui-type-subtitle:1.125rem;--ui-shadow:0 6px 16px rgb(0 0 0 / .12);--ui-overlay:rgb(13 32 43 / .6)}body{font:14px Arial;margin:16px}*{box-sizing:border-box} ${css}</style><h1>Jenis Pekerjaan Layanan</h1><main id="app"></main><script src="/app.js"></script></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const dialog = page.getByRole('dialog');

    // Create through the dialog.
    await page.getByRole('button', { name: 'Tambah jenis pekerjaan', exact: true }).click();
    await dialog.waitFor();
    const box = await dialog.boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= 1000, 'dialog fits the viewport');
    await page.getByLabel('Nama jenis pekerjaan', { exact: true }).fill('Upgrade premium');

    // Select-only combobox: keyboard path for Operasi, pointer path for Job Category.
    const operation = page.getByLabel('Operasi layanan');
    await operation.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.match(await operation.innerText(), /Upgrade/);
    assert.equal(await operation.getAttribute('aria-expanded'), 'false');
    const category = page.getByLabel('Saran Job Category');
    await category.click();
    await page.getByRole('option', { name: 'Provisioning', exact: true }).click();
    assert.match(await category.innerText(), /Provisioning/);

    // Escape closes the listbox, not the dialog.
    await category.click();
    assert.equal(await page.getByRole('listbox').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('listbox').count(), 0);
    assert.equal(await dialog.isVisible(), true);

    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Upgrade premium' }).waitFor();
    assert.equal(rows.find(row => row.name === 'Upgrade premium').defaultJobCategoryId, 3);

    // Duplicate names are rejected in place, before the request.
    await page.getByRole('button', { name: 'Tambah jenis pekerjaan', exact: true }).click();
    await page.getByLabel('Nama jenis pekerjaan', { exact: true }).fill('UPGRADE PREMIUM');
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    assert.match(await dialog.getByRole('alert').innerText(), /sudah dipakai/);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });

    // Operation is immutable; category can be cleared.
    const created = page.getByRole('row').filter({ hasText: 'Upgrade premium' });
    await created.getByRole('button', { name: 'Edit Upgrade premium', exact: true }).click();
    assert.equal(await page.getByLabel('Operasi layanan').isDisabled(), true);
    const editCategory = page.getByLabel('Saran Job Category');
    await editCategory.click();
    await page.keyboard.type('Assu');
    await page.keyboard.press('Enter');
    assert.match(await editCategory.innerText(), /Assurance/);
    await editCategory.click();
    await page.getByRole('option', { name: 'Tanpa saran', exact: true }).click();
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Upgrade premium' }).waitFor();
    assert.equal(rows.find(row => row.name === 'Upgrade premium').defaultJobCategoryId, null);

    // Status switch updates without a dialog.
    await page.getByRole('row').filter({ hasText: 'Upgrade premium' }).getByRole('switch', { name: /Upgrade premium/ }).click();
    await page.waitForFunction(() => document.body.innerText.includes('Nonaktif'));
    assert.equal(rows.find(row => row.name === 'Upgrade premium').active, false);

    // Search empty state.
    await page.getByLabel('Cari jenis pekerjaan').fill('missing');
    assert.equal(await page.locator('tbody tr').count(), 0);
    await page.getByRole('button', { name: 'Bersihkan pencarian', exact: true }).click();

    // Delete: unused master is removable after confirm; used master explains why not.
    await page.getByRole('button', { name: 'Hapus Terminasi sementara', exact: true }).click();
    await dialog.waitFor();
    await page.getByRole('button', { name: 'Hapus permanen', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Terminasi sementara' }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Hapus Instalasi Baru', exact: true }).click();
    await dialog.waitFor();
    assert.ok((await dialog.innerText()).includes('Tidak bisa dihapus'));
    await page.getByRole('button', { name: 'Tutup', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });

    // Narrow layout.
    await page.setViewportSize({ width: 320, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const short = await page.evaluate(() => [...document.querySelectorAll('button')].filter(button => button.getClientRects().length && button.getBoundingClientRect().height < 43.5).map(button => button.textContent.trim()));
    assert.deepEqual(short, []);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const axeResult = await page.evaluate(async () => window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
    assert.deepEqual(axeResult.violations.map(violation => violation.id), []);

    // Permission failure surfaces as an alert with an empty list.
    forbidden = true; await page.reload();
    assert.match(await page.getByRole('alert').innerText(), /Forbidden/);
    assert.equal(await page.locator('tbody tr').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: dialog create, inline duplicate feedback, immutable operation, category clear, status switch, search empty state, confirmed delete, used-master guard, 320px layout and 44px targets. Synthetic API only.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
