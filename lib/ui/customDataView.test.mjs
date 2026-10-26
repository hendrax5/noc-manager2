import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  formatCustomValue,
  displayableCustomEntries,
  INTERNAL_CUSTOM_KEYS,
} from './customDataView.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('formats scalar values as text', () => {
  assert.equal(formatCustomValue('PT INDO TELEMEDIA'), 'PT INDO TELEMEDIA');
  assert.equal(formatCustomValue(0), '0');
  assert.equal(formatCustomValue(42), '42');
  assert.equal(formatCustomValue(false), 'false');
  assert.equal(formatCustomValue(true), 'true');
  assert.equal(formatCustomValue(null), '');
  assert.equal(formatCustomValue(undefined), '');
});

test('never returns a raw object for JSON-shaped values', () => {
  const routing = [{ serviceId: 872, customerId: 626, orderCompany: null }];
  const nested = { a: { b: [1, 2] } };
  const circular = {};
  circular.self = circular;

  for (const value of [routing, nested, circular, { x: 1 }, [], [1, 'a']]) {
    const text = formatCustomValue(value);
    assert.equal(typeof text, 'string');
    assert.equal(text === value, false);
  }

  assert.match(formatCustomValue(routing), /serviceId/);
  assert.match(formatCustomValue(nested), /\{/);
  assert.equal(formatCustomValue(circular), '[object Object]');
});

test('guards non-finite numbers', () => {
  assert.equal(formatCustomValue(NaN), '');
  assert.equal(formatCustomValue(Infinity), '');
});

test('parameter list drops falsy values and internal routing metadata', () => {
  const entries = displayableCustomEntries({
    'Customer Name': 'PT INDO TELEMEDIA SOLUSI (ION PARTNERSHIP)',
    serviceRouting: [{ serviceId: 872, customerId: 626, orderCompany: null }],
    routingStatus: 'needs_mapping',
    hasDowntime: false,
    startDowntime: null,
    downtimeMinutes: 0,
  });

  const keys = entries.map(([key]) => key);
  assert.deepEqual(keys, ['Customer Name', 'routingStatus']);
  assert.ok(INTERNAL_CUSTOM_KEYS.has('serviceRouting'));
});

test('parameter list tolerates non-object input', () => {
  for (const value of [null, undefined, 'text', 42, []]) {
    assert.deepEqual(displayableCustomEntries(value), []);
  }
});

test('customData render sites use the shared safe formatter', () => {
  const sites = [
    'app/tickets/[id]/TicketDetailClient.js',
    'app/assets/[id]/ServiceDetailClient.js',
  ];

  for (const relative of sites) {
    const source = readFileSync(path.join(repoRoot, relative), 'utf8');
    assert.match(source, /from ["']@\/lib\/ui\/customDataView["']/, `${relative} must import the shared helper`);
    assert.match(source, /formatCustomValue\(/, `${relative} must format values before rendering`);
  }
});
