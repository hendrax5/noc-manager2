import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHintText,
  extractCapacityHints,
  adoptableCapacity,
  suggestedTargetCapacity,
} from './capacityHints.js';

const CID = 'SAP-C-0006-0160';
const ticket = (id, createdAt, text, kind = 'comment') => ({ ticketId: id, trackingId: `HSK-${id}`, createdAt, text, kind });

test('device description and rate-limit yield the current bandwidth with CID context', () => {
  const text = [
    'Sudah dilakukan aktivasi untuk link berikut.<br />',
    'description INDOTEL-RISKOWI-DUTA-PAMUNGKAS-300M-SAP-C-0006-0160<br />',
    'rate-limit ingress cir 305000 cbs 262500',
  ].join('\r\n');
  const hints = extractCapacityHints({ cid: CID, texts: [ticket(14590, '2025-05-20T22:46:21', text)] });
  const description = hints.existing.find((candidate) => candidate.kind === 'description');
  assert.equal(description.mbps, 300);
  assert.equal(description.confidence, 'high');
  const cir = hints.existing.find((candidate) => candidate.kind === 'rate-limit');
  assert.equal(cir.mbps, 305);
  assert.equal(cir.approximate, true);
  const resolution = adoptableCapacity(hints.existing);
  assert.equal(resolution.status, 'ready');
  assert.equal(resolution.mbps, 300);
});

test('client/device name that embeds bandwidth before the CID is a medium hint', () => {
  const hints = extractCapacityHints({
    cid: CID,
    texts: [ticket(40215, '2026-09-07T12:16:56', 'kendala Broadcast disalah satu client "INDOTEL-RISKOWI-DUTA-PAMUNGKAS-500M-SAP-C-0006-0160" untuk sementara client tersebut di shutdown.')],
  });
  const name = hints.existing.find((candidate) => candidate.kind === 'client-name');
  assert.equal(name.mbps, 500);
  assert.equal(name.confidence, 'medium');
  assert.equal(adoptableCapacity(hints.existing).status, 'ready');
});

test('newest history wins over an older config dump (upgrade history)', () => {
  const hints = extractCapacityHints({
    cid: CID,
    texts: [
      ticket(14590, '2025-05-20T22:46:21', 'description INDOTEL-RISKOWI-DUTA-PAMUNGKAS-300M-SAP-C-0006-0160'),
      ticket(40215, '2026-09-07T12:16:56', 'client "INDOTEL-RISKOWI-DUTA-PAMUNGKAS-500M-SAP-C-0006-0160" down'),
    ],
  });
  const resolution = adoptableCapacity(hints.existing);
  assert.equal(resolution.status, 'ready');
  assert.equal(resolution.mbps, 500);
});

test('same-moment conflicting evidence still needs a human', () => {
  const hints = extractCapacityHints({
    cid: CID,
    texts: [
      ticket(1, '2026-09-07T12:16:56', 'description INDOTEL-RISKOWI-DUTA-PAMUNGKAS-300M-SAP-C-0006-0160'),
      ticket(2, '2026-09-07T12:16:56', 'client "INDOTEL-RISKOWI-DUTA-PAMUNGKAS-500M-SAP-C-0006-0160" down'),
    ],
  });
  const resolution = adoptableCapacity(hints.existing);
  assert.equal(resolution.status, 'ambiguous');
  assert.deepEqual(resolution.candidates.map((candidate) => candidate.mbps).sort((a, b) => a - b), [300, 500]);
});

test('explicit existing-capacity wording is recognised for BOD/upgrade requests', () => {
  const hints = extractCapacityHints({
    cid: CID,
    texts: [ticket(32567, '2026-10-28T03:28:53', `Nama Customer & Site : Yay. Abdi Karya\nKapasitas Existing : 300 Mbps\nKapasitas BOD : 300 Mbps\nKapasitas Total : 600 Mbps`, 'comment')],
  });
  const explicit = hints.existing.filter((candidate) => candidate.kind === 'text');
  assert.equal(explicit.length, 1);
  assert.equal(explicit[0].mbps, 300);
  assert.equal(explicit[0].confidence, 'low', 'without the CID in the text it stays a suggestion, not an automatic value');
  assert.equal(hints.existing.some((candidate) => candidate.mbps === 600), false, 'BOD total must not become the service capacity');
});

test('target capacity is parsed from EWO upgrade wording', () => {
  const cases = [
    ['Berikut EWO ... Upgrade ke 1G. Mohon dibantu upgrade. RFS 01 November 2026.', 1000],
    ['Site DABUK REJO (Upgrade ke 1,5G). Mohon dibantu.', 1500],
    ['Site STERLINK (Upgrade ke 300 Mbps).', 300],
    ['Request upgrade dari 2Gb menjadi 2.5Gbps', 2500],
    ['Upgrade ke 65 Gbps', 65000],
  ];
  for (const [text, expected] of cases) {
    const hints = extractCapacityHints({ cid: CID, texts: [ticket(1, '2026-10-28T03:31:29', text)] });
    assert.equal(suggestedTargetCapacity(hints.target)?.mbps, expected, text);
  }
});

test('single-service tickets trust their config dump even without the CID in the line', () => {
  const hints = extractCapacityHints({
    cid: 'C-0581-078-01',
    texts: [ticket(11840, '2025-04-19T11:19:25', 'description INDOTEL-PT-INTERNET-SOLUSI-MANDIRI-1G', 'comment')].map((item) => ({ ...item, singleService: true })),
  });
  assert.equal(hints.existing[0].mbps, 1000);
  assert.equal(hints.existing[0].confidence, 'medium');
  assert.equal(adoptableCapacity(hints.existing).status, 'ready');
});

test('config dump for another CID is not adopted even on a single-service ticket', () => {
  const hints = extractCapacityHints({
    cid: 'C-0581-139-01',
    texts: [ticket(11954, '2023-11-29T11:57:58', 'description ae0.2635-MITRA.KITA.BRILIANT-15Gbps-I-0586-002-01', 'comment')].map((item) => ({ ...item, singleService: true })),
  });
  assert.equal(adoptableCapacity(hints.existing).status, 'missing');
});

test('config dump that contradicts the router CIR is downgraded', () => {
  const hints = extractCapacityHints({
    cid: 'SAP-C-0006-0198',
    texts: [ticket(14725, '2025-06-04T03:52:29', 'description INDOTEL-FUAD-IKSAN(PERORANGAN)-500G-SAP-C-0006-0198\nqos lr outbound cir 512000 cbs 51200', 'comment')].map((item) => ({ ...item, singleService: true })),
  });
  assert.equal(adoptableCapacity(hints.existing).status, 'missing');
});

test('aliases of the service CID count as the same circuit', () => {
  const hints = extractCapacityHints({
    cid: 'SAP-C-0006-0198',
    aliases: ['C-0628-001'],
    texts: [ticket(14725, '2025-06-04T03:52:29', 'description INDOTEL-FUAD-IKSAN(PERORANGAN)-500G-C-0628-001\nqos lr outbound cir 512000', 'comment')],
  });
  assert.equal(adoptableCapacity(hints.existing).status, 'missing', 'still rejected by the CIR conflict');
});

test('HTML markup, entities and separators are normalised', () => {
  assert.equal(normalizeHintText('a<br />b&amp;c&nbsp;d'), 'a\nb&c d');
  const hints = extractCapacityHints({
    cid: CID,
    texts: [ticket(1, '2026-01-02T03:04:05', 'description&nbsp;INDOTEL-X-1G_SAP-C-0006-0160<br />qos lr outbound cir 1024000 cbs 10240000', 'comment')],
  });
  assert.equal(hints.existing.find((candidate) => candidate.kind === 'description')?.mbps, 1000);
  assert.equal(hints.existing.find((candidate) => candidate.kind === 'rate-limit')?.mbps, 1024);
});

test('evidence without the CID is kept as a low-confidence hint only', () => {
  const hints = extractCapacityHints({
    cid: CID,
    texts: [ticket(1, '2026-01-01T00:00:00', 'description OTHER-SITE-200M-SAP-C-9999-0001')],
  });
  assert.equal(hints.existing[0].mbps, 200);
  assert.equal(hints.existing[0].confidence, 'low');
  assert.equal(adoptableCapacity(hints.existing).status, 'missing');
});

test('blank or unit-less text yields no hints', () => {
  const hints = extractCapacityHints({ cid: CID, texts: [ticket(1, '2026-01-01T00:00:00', 'description INDOTEL-SITE-300-SAP-C-0006-0160')] });
  assert.deepEqual(hints.existing, []);
  assert.deepEqual(hints.target, []);
});
