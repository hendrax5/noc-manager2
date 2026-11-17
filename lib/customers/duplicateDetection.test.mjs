import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCustomerName,
  customerSimilarity,
  findCustomerDuplicateSuggestions,
  suggestCustomerForCircuitSource,
} from './duplicateDetection.js';

test('normalizeCustomerName strips legal entity prefixes and punctuation', () => {
  assert.equal(normalizeCustomerName('PT. Contoh Digital, Tbk.'), 'contoh digital');
  assert.equal(normalizeCustomerName('CV Contoh   Digital'), 'contoh digital');
  assert.equal(normalizeCustomerName('PT'), 'pt');
});

test('findCustomerDuplicateSuggestions detects legal-form duplicates and ignores archived records', () => {
  const customers = [
    { id: 10, name: 'PT Contoh Digital', contactEmail: 'noc@contoh.id', active: true },
    { id: 24, name: 'Contoh Digital', active: true },
    { id: 30, name: 'PT Contoh Digital Lama', active: false, archivedAt: '2026-10-01T00:00:00Z' },
    { id: 40, name: 'PT Lain Sekali', active: true },
  ];
  const counts = new Map([[10, 5], [24, 1]]);
  const suggestions = findCustomerDuplicateSuggestions(customers, { serviceCounts: counts });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].targetId, 10);
  assert.equal(suggestions[0].sourceId, 24);
  assert.equal(suggestions[0].score, 1);
  assert.equal(suggestions[0].targetServiceCount, 5);
  assert.equal(suggestions[0].sourceServiceCount, 1);
});

test('findCustomerDuplicateSuggestions detects minor typos', () => {
  assert.ok(customerSimilarity('PT Nusantara Telekom', 'PT Nusantrara Telekom') >= 0.84);
  const res = findCustomerDuplicateSuggestions([
    { id: 1, name: 'PT Nusantara Telekom' },
    { id: 2, name: 'PT Nusantrara Telekom' },
  ]);
  assert.equal(res.length, 1);
});

test('suggestCustomerForCircuitSource matches canonical names and merged aliases without guessing SAP numbers', () => {
  const customers = [
    {
      id: 5,
      name: 'PT Mega Jaringan Nusantara',
      mergedAliases: [{ id: 2, name: 'PT MJN Lama' }],
    },
    { id: 6, name: 'PT Alpha Omega' },
  ];

  const matchByCanonical = suggestCustomerForCircuitSource(
    ['PT Mega Jaringan Nusantara - Link Jakarta'],
    customers,
  );
  assert.equal(matchByCanonical[0].customerId, 5);
  assert.equal(matchByCanonical[0].matchedViaAlias, null);

  const matchByAlias = suggestCustomerForCircuitSource(
    ['PT MJN Lama - Metro E'],
    customers,
  );
  assert.equal(matchByAlias[0].customerId, 5);
  assert.equal(matchByAlias[0].matchedViaAlias, 'PT MJN Lama');

  // SAP numeric tokens never falsely match unrelated customers
  const noMatch = suggestCustomerForCircuitSource(['SAP-C-0005-0001'], customers);
  assert.equal(noMatch.length, 0);
});
