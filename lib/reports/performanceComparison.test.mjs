import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRollingMonthKeys,
  resolveCompareMonthKey,
  computeMetricDelta,
  buildComparisonMap,
  classifyMemberTrend,
  selectTeamHighlights,
  summarizeTeamKpis,
  clampTrendCount,
} from './performanceComparison.js';

test('buildRollingMonthKeys crosses year boundary accurately and clamps count', () => {
  assert.deepEqual(buildRollingMonthKeys('2026-02', 6), [
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
  ]);
  assert.deepEqual(buildRollingMonthKeys('2026-03', 3), ['2026-01', '2026-02', '2026-03']);
  assert.equal(clampTrendCount('3'), 3);
  assert.equal(clampTrendCount('99'), 6);
  assert.equal(clampTrendCount('invalid', 6), 6);
});

test('resolveCompareMonthKey validates optional compareMonth and rejects malformed keys', () => {
  assert.equal(resolveCompareMonthKey('2026-01'), '2025-12');
  assert.equal(resolveCompareMonthKey('2026-05', '2026-02'), '2026-02');
  assert.throws(() => resolveCompareMonthKey('2026-05', '2026-13'), e => /tidak valid/i.test(e.message));
});

test('computeMetricDelta handles zero baseline, lower-is-better durations, pp units, and null values', () => {
  const newAct = computeMetricDelta(5, 0, { higherIsBetter: true, unit: 'count', minPercentBase: 2 });
  assert.equal(newAct.delta, 5);
  assert.equal(newAct.percentDelta, null);
  assert.equal(newAct.isNewActivity, true);
  assert.equal(newAct.polarity, 'improved');

  // Faster response time (30 -> 15 mins) is improved!
  const faster = computeMetricDelta(15, 30, { higherIsBetter: false, unit: 'minutes', minPercentBase: 5, deadbandAbs: 3 });
  assert.equal(faster.delta, -15);
  assert.equal(faster.percentDelta, -50);
  assert.equal(faster.polarity, 'improved');

  // Slower response time (15 -> 30 mins) is declined!
  const slower = computeMetricDelta(30, 15, { higherIsBetter: false, unit: 'minutes', minPercentBase: 5, deadbandAbs: 3 });
  assert.equal(slower.delta, 15);
  assert.equal(slower.polarity, 'declined');

  // Percentage point change with small deadband
  const slaFlat = computeMetricDelta(95, 94, { higherIsBetter: true, unit: 'pp', deadbandAbs: 2 });
  assert.equal(slaFlat.delta, 1);
  assert.equal(slaFlat.percentDelta, null);
  assert.equal(slaFlat.polarity, 'flat');

  const unavailable = computeMetricDelta(null, 80, { unit: 'pp' });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.polarity, 'neutral');
});

test('classifyMemberTrend distinguishes up, down, flat, new, and inactive cleanly', () => {
  const up = classifyMemberTrend({
    current: { resolved: 18, points: 140, responses: 40, medianResponseMinutes: 12, responseSampleCount: 10, slaCleanPct: 95 },
    previous: { resolved: 10, points: 80, responses: 25, medianResponseMinutes: 25, responseSampleCount: 8, slaCleanPct: 90 },
  });
  assert.equal(up, 'up');

  const down = classifyMemberTrend({
    current: { resolved: 4, points: 30, responses: 10, medianResponseMinutes: 40, responseSampleCount: 4, slaCleanPct: 75 },
    previous: { resolved: 14, points: 110, responses: 35, medianResponseMinutes: 18, responseSampleCount: 10, slaCleanPct: 96 },
  });
  assert.equal(down, 'down');

  const flat = classifyMemberTrend({
    current: { resolved: 10, points: 82, responses: 20, medianResponseMinutes: 20, responseSampleCount: 5, slaCleanPct: 94 },
    previous: { resolved: 10, points: 80, responses: 20, medianResponseMinutes: 21, responseSampleCount: 5, slaCleanPct: 94 },
  });
  assert.equal(flat, 'flat');

  const newMember = classifyMemberTrend({
    current: { resolved: 3, points: 25, responses: 6 },
    previous: { resolved: 0, points: 0, responses: 0 },
  });
  assert.equal(newMember, 'new');

  const inactiveMember = classifyMemberTrend({
    current: { resolved: 0, points: 0, responses: 0 },
    previous: { resolved: 0, points: 0, responses: 0 },
  });
  assert.equal(inactiveMember, 'inactive');
});

test('selectTeamHighlights enforces minimum sample guard and avoids praising members with SLA breach', () => {
  const makeRow = (userId, name, cur, prev) => {
    const deltas = buildComparisonMap(cur, prev);
    const trendDirection = classifyMemberTrend({ current: cur, previous: prev, deltas });
    return { userId, name, department: 'NOC', company: 'ION', ...cur, previous: prev, deltas, trendDirection };
  };

  const rows = [
    // Noise: only 1 ticket solved this month -> should NOT enter topImprovers
    makeRow(1, 'Noise User', { resolved: 1, points: 5, responses: 2, slaCleanPct: 100 }, { resolved: 0, points: 0, responses: 0, slaCleanPct: null }),
    // Solid improver
    makeRow(2, 'Rina', { resolved: 16, points: 130, responses: 30, medianResponseMinutes: 10, responseSampleCount: 10, slaCleanPct: 96 }, { resolved: 9, points: 75, responses: 20, medianResponseMinutes: 22, responseSampleCount: 8, slaCleanPct: 90 }),
    // High volume gain BUT SLA dropped to 70% -> must enter needsAttention, NOT topImprovers
    makeRow(3, 'Budi SLA Drop', { resolved: 20, points: 160, responses: 40, medianResponseMinutes: 15, responseSampleCount: 10, slaCleanPct: 70 }, { resolved: 10, points: 80, responses: 20, medianResponseMinutes: 15, responseSampleCount: 8, slaCleanPct: 95 }),
    // Big output & speed drop
    makeRow(4, 'Agus Drop', { resolved: 4, points: 30, responses: 12, medianResponseMinutes: 45, responseSampleCount: 4, slaCleanPct: 90 }, { resolved: 14, points: 110, responses: 30, medianResponseMinutes: 15, responseSampleCount: 10, slaCleanPct: 95 }),
  ];

  const { topImprovers, needsAttention } = selectTeamHighlights(rows);
  assert.deepEqual(topImprovers.map(x => x.userId), [2]);
  assert.ok(topImprovers[0].reasons.some(r => r.includes('Tiket selesai') || r.includes('Respons')));

  assert.deepEqual(needsAttention.map(x => x.userId).sort((a, b) => a - b), [3, 4]);
  assert.ok(needsAttention.find(x => x.userId === 3).reasons.some(r => r.includes('SLA')));
  assert.ok(needsAttention.find(x => x.userId === 4).reasons.some(r => r.includes('turun')));
});

test('summarizeTeamKpis computes team totals, weighted SLA, and median response time deltas', () => {
  const curRows = [
    { userId: 1, resolved: 10, points: 100, slaCleanCount: 9, medianResponseMinutes: 15, responseSampleCount: 8 },
    { userId: 2, resolved: 10, points: 80, slaCleanCount: 10, medianResponseMinutes: 25, responseSampleCount: 6 },
  ];
  const prevRows = [
    { userId: 1, resolved: 6, points: 60, slaCleanCount: 5, medianResponseMinutes: 30, responseSampleCount: 6 },
    { userId: 2, resolved: 4, points: 40, slaCleanCount: 4, medianResponseMinutes: 30, responseSampleCount: 4 },
  ];
  const summary = summarizeTeamKpis(curRows, prevRows, {
    currentResponseSamples: [10, 15, 20, 25],
    previousResponseSamples: [25, 30, 35, 40],
  });
  assert.equal(summary.resolved.current, 20);
  assert.equal(summary.resolved.previous, 10);
  assert.equal(summary.resolved.perMember, 10);
  assert.equal(summary.resolved.delta.polarity, 'improved');
  assert.equal(summary.points.current, 180);
  assert.equal(summary.slaCleanPct.current, 95);
  assert.equal(summary.slaCleanPct.previous, 90);
  assert.equal(summary.slaCleanPct.delta.delta, 5);
  assert.equal(summary.medianResponseMinutes.current, 15);
  assert.equal(summary.medianResponseMinutes.previous, 30);
  assert.equal(summary.medianResponseMinutes.delta.polarity, 'improved');
});
