/* Render audit for the trouble master screen: measured contrast, target sizes,
   accessible names, dialog focus containment. Not a test. */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', '..');
const rows = [
  { id: 1, kind: 'symptom', name: 'Down', description: 'Layanan tidak dapat diakses sama sekali.', sortOrder: 0, active: true, usageCount: 12 },
  { id: 2, kind: 'symptom', name: 'Packet Loss', description: 'Paket hilang sebagian, koneksi tidak stabil.', sortOrder: 1, active: true, usageCount: 4 },
  { id: 3, kind: 'symptom', name: 'High Latency', description: 'Waktu respons di atas ambang SLA.', sortOrder: 2, active: true, usageCount: 0 },
  { id: 4, kind: 'symptom', name: 'Flapping', description: 'Link naik turun berulang dalam 24 jam.', sortOrder: 3, active: false, usageCount: 0 },
];

const CONTRAST_HELPER = `
  function parse(color) {
    const match = color.match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  function luminance({ r, g, b }) {
    const channel = value => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }
  function ratio(a, b) { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  function backgroundOf(element) {
    let node = element;
    while (node && node !== document.documentElement) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0.5) return color;
      node = node.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  }
  function measure(element) {
    const style = getComputedStyle(element);
    return { ratio: ratio(parse(style.color), backgroundOf(element)), color: style.color, background: getComputedStyle(element).backgroundColor };
  }
`;

async function main() {
  const built = await esbuild.build({
    stdin: { contents: "import React from 'react';import{createRoot}from'react-dom/client';import Client from './app/settings/trouble-masters/TroubleMastersClient';createRoot(document.getElementById('app')).render(<Client/>);", resolveDir: root, sourcefile: 'master-fixture.jsx', loader: 'jsx' },
    bundle: true, write: false, outdir: 'out', loader: { '.js': 'jsx' }, jsx: 'automatic',
  });
  const js = built.outputFiles.find(x => x.path.endsWith('.js')).text;
  const css = built.outputFiles.find(x => x.path.endsWith('.css')).text;
  const sheets = ['ui-tokens.css', 'globals.css', 'legacy-ui.css', 'ui-foundation.css'].map(f => path.join(root, 'app', f));
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); return; }
    if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
    if (req.url.startsWith('/styles/')) { res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(sheets[Number(req.url.split('/').pop())])); return; }
    if (req.url.startsWith('/api/trouble-masters')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(rows)); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${sheets.map((_, i) => `<link rel="stylesheet" href="/styles/${i}">`).join('')}<link rel="stylesheet" href="/app.css"></head><body><main class="container"><header class="page-header"><h1>Master Data Trouble</h1><p>Kelola gejala dan penyebab standar.</p></header><div id="app"></div></main><script src="/app.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.addInitScript(t => { document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', t)); }, theme);
      await page.goto(base);
      await page.waitForSelector('tbody tr');
      await page.waitForTimeout(200);

      const checks = await page.evaluate(helper => {
        eval(helper);
        const q = selector => document.querySelector(selector);
        const targets = [
          ['primary button', q('button[class*="primary"]')],
          ['secondary button', q('button[class*="secondary"]')],
          ['delete ghost', q('button[class*="dangerGhost"]')],
          ['row name', q('[class*="name"]')],
          ['row description', q('[class*="description"]')],
          ['muted usage text', q('[class*="usage"]')],
          ['status switch (off)', q('[role="switch"][aria-checked="false"]')],
          ['table header', q('thead th')],
          ['tab (selected)', q('button[aria-pressed="true"]')],
          ['tab count', q('[class*="tabCount"]')],
          ['summary', q('[class*="summary"]')],
        ];
        return targets.filter(([, element]) => element).map(([name, element]) => ({ name, ...measure(element), fontSize: getComputedStyle(element).fontSize, fontWeight: getComputedStyle(element).fontWeight }));
      }, CONTRAST_HELPER);
      results.push({ theme, checks });

      // Hover state of the primary action
      const primary = page.getByRole('button', { name: 'Tambah Gejala' });
      await primary.hover();
      await page.waitForTimeout(300);
      results.push({ theme, hoverPrimary: await primary.evaluate((element, helper) => { eval(helper); return measure(element); }, CONTRAST_HELPER) });

      // Accessible names for every interactive control
      results.push({ theme, unnamed: await page.evaluate(() => [...document.querySelectorAll('button,a[href],input,textarea,select,[role="switch"]')].filter(element => element.getClientRects().length && !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.labels?.length || element.textContent.trim() || element.getAttribute('title'))).map(element => element.outerHTML.slice(0, 80))) });

      // Dialog: focus lands inside and Tab stays contained
      await primary.click();
      await page.getByRole('dialog').waitFor();
      const focusInside = await page.evaluate(() => document.activeElement?.closest('dialog') !== null);
      const trapped = await page.evaluate(async () => {
        const dialog = document.querySelector('dialog[open]');
        for (let index = 0; index < 14; index += 1) {
          const focusable = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')];
          const current = focusable.indexOf(document.activeElement);
          const next = focusable[(current + 1) % focusable.length];
          next.focus();
          if (!dialog.contains(document.activeElement)) return false;
        }
        return true;
      });
      const escapeCloses = await (async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(150); return page.evaluate(() => document.querySelector('dialog[open]') === null); })();
      results.push({ theme, dialog: { focusInside, trapped, escapeCloses } });

      // Destructive confirmation for an unused master
      await page.getByRole('button', { name: 'Hapus High Latency' }).click();
      await page.getByRole('dialog').waitFor();
      await page.waitForTimeout(200);
      results.push({ theme, deleteDialog: await page.evaluate(helper => {
        eval(helper);
        const dangerous = document.querySelector('dialog[open] button[class*="danger"]:not([class*="dangerGhost"])');
        const copy = document.querySelector('dialog[open] p');
        return { danger: dangerous ? measure(dangerous) : null, copy: copy ? measure(copy) : null };
      }, CONTRAST_HELPER) });
      await page.keyboard.press('Escape');
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  const lines = [];
  for (const entry of results) {
    if (entry.checks) {
      lines.push(`\n[${entry.theme}] contrast (text 4.5 / large 3.0)`);
      for (const check of entry.checks) {
        const large = parseFloat(check.fontSize) >= 24 || (parseFloat(check.fontSize) >= 18.66 && parseInt(check.fontWeight, 10) >= 700);
        const required = large ? 3 : 4.5;
        lines.push(`  ${check.ratio.toFixed(2).padStart(5)} : 1  min ${required}  ${check.ratio >= required ? 'PASS' : 'FAIL'}  ${check.name} (${check.fontSize}, ${check.color} on ${check.color === check.background ? 'inherited' : check.background})`);
      }
    }
    if (entry.hoverPrimary) lines.push(`  hover primary: ${entry.hoverPrimary.ratio.toFixed(2)} : 1 (${entry.hoverPrimary.color} on ${entry.hoverPrimary.background})`);
    if (entry.unnamed) lines.push(`  controls without accessible name: ${entry.unnamed.length ? entry.unnamed.join(' | ') : 'none'}`);
    if (entry.dialog) lines.push(`  dialog: focusInside=${entry.dialog.focusInside} trapped=${entry.dialog.trapped} escapeCloses=${entry.dialog.escapeCloses}`);
    if (entry.deleteDialog?.danger) lines.push(`  delete confirm button: ${entry.deleteDialog.danger.ratio.toFixed(2)} : 1 (${entry.deleteDialog.danger.color} on ${entry.deleteDialog.danger.background})`);
    if (entry.deleteDialog?.copy) lines.push(`  delete confirm copy: ${entry.deleteDialog.copy.ratio.toFixed(2)} : 1`);
  }
  console.log(lines.join('\n'));
  const failures = results.flatMap(entry => (entry.checks || []).filter(check => check.ratio < (parseFloat(check.fontSize) >= 24 ? 3 : 4.5)));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
