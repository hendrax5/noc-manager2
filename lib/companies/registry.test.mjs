import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMPANIES,
  sanitizeCompanies,
  parseCompanyNames,
  companiesFromConfig,
  normalizeCompany,
  companyOptions,
  companyNamesText,
} from './registry.js';

test('sanitizeCompanies uppercase codes and dedupes', () => {
  const list = sanitizeCompanies([
    { code: 'ion', name: 'ION', group: 'ion' },
    { code: 'ION', name: 'ION lagi' },
    { code: 'sdc', name: 'SDC', aliases: ['prodc'] },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].code, 'ION');
  assert.equal(list[1].code, 'SDC');
  assert.deepEqual(list[1].aliases, ['PRODC']);
  assert.equal(list[0].serviceSelectable, true);
});

test('sanitizeCompanies rejects alias that collides with another code', () => {
  assert.throws(() => sanitizeCompanies([
    { code: 'ION', name: 'ION' },
    { code: 'SDC', name: 'SDC', aliases: ['ION'] },
  ]), /bentrok/);
});

test('parseCompanyNames maps known names and keeps unknown ones', () => {
  const list = parseCompanyNames('ION, SDC, Sistercompany, INDOTEL');
  assert.deepEqual(list.map(item => item.code), ['ION', 'SDC', 'SISTER', 'INDOTEL']);
  assert.equal(list[2].serviceSelectable, false);
  assert.equal(list[3].serviceSelectable, true);
});

test('companiesFromConfig prefers stored companies over companyNames', () => {
  const stored = companiesFromConfig({ companies: [{ code: 'ION', name: 'ION' }], companyNames: 'ION, SDC' });
  assert.equal(stored.length, 1);
  const fallback = companiesFromConfig({ companyNames: 'ION, SDC' });
  assert.deepEqual(fallback.map(item => item.code), ['ION', 'SDC']);
});

test('normalizeCompany accepts code, name and alias', () => {
  assert.equal(normalizeCompany('ION'), 'ION');
  assert.equal(normalizeCompany('prodc'), 'SDC');
  assert.equal(normalizeCompany('Sistercompany'), 'SISTER');
  assert.equal(normalizeCompany('indotel', DEFAULT_COMPANIES), 'INDOTEL');
  assert.throws(() => normalizeCompany('TIDAK ADA', DEFAULT_COMPANIES), /harus salah satu/);
});

test('companyOptions filters inactive and non-service companies', () => {
  const options = companyOptions(DEFAULT_COMPANIES, { serviceOnly: true });
  assert.ok(options.some(option => option.value === 'INDOTEL'));
  assert.ok(!options.some(option => option.value === 'SISTER'));
});

test('companyNamesText lists active display names', () => {
  const text = companyNamesText(DEFAULT_COMPANIES);
  assert.match(text, /ION/);
  assert.match(text, /Sistercompany/);
});
