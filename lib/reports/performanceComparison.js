import { WorkflowError } from '../workflows/policy.js';
import { jakartaMonthRange } from './monthPeriod.js';

const round1 = value => Math.round(value * 10) / 10;

const finiteOrNull = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function clampTrendCount(raw, fallback = 6) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  if (num <= 3) return 3;
  if (num >= 6) return 6;
  return Math.round(num);
}

/** Returns chronological YYYY-MM keys ending at `monthKey` with length `count` (1..12). */
export function buildRollingMonthKeys(monthKey, count = 6) {
  jakartaMonthRange(monthKey);
  const safeCount = Math.max(1, Math.min(12, Math.round(Number(count) || 6)));
  const [year, month] = monthKey.split('-').map(Number);
  const keys = [];
  for (let offset = safeCount - 1; offset >= 0; offset -= 1) {
    keys.push(new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 7));
  }
  return keys;
}

/** Validates an optional YYYY-MM comparison key, rejecting non-month strings cleanly. */
export function resolveCompareMonthKey(monthKey, compareMonth) {
  if (!compareMonth) {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  }
  if (typeof compareMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(compareMonth)) {
    throw new WorkflowError('Bulan pembanding tidak valid.');
  }
  jakartaMonthRange(compareMonth);
  return compareMonth;
}

/**
 * Computes absolute, percent/percentage-point delta and improvement polarity between two values.
 * For "lower is better" metrics such as response minutes, a negative delta is `improved`.
 */
export function computeMetricDelta(
  currentRaw,
  previousRaw,
  { higherIsBetter = true, unit = 'count', minPercentBase = 1, deadbandPct = 5, deadbandAbs = 1 } = {},
) {
  const current = finiteOrNull(currentRaw);
  const previous = finiteOrNull(previousRaw);
  if (current == null || previous == null) {
    return {
      current,
      previous,
      delta: null,
      percentDelta: null,
      polarity: 'neutral',
      isNewActivity: false,
      status: 'unavailable',
    };
  }

  const delta = round1(current - previous);
  const isPercentPoint = unit === 'pp';
  const isNewActivity = !isPercentPoint && previous === 0 && current > 0;
  const percentDelta =
    !isPercentPoint && Math.abs(previous) >= minPercentBase
      ? round1((delta / Math.abs(previous)) * 100)
      : null;

  const effDeadbandAbs = isPercentPoint ? Math.max(2, deadbandAbs) : deadbandAbs;
  let polarity = 'flat';
  const absDelta = Math.abs(delta);
  const absPct = percentDelta != null ? Math.abs(percentDelta) : null;

  if (delta !== 0) {
    const significant = isPercentPoint
      ? absDelta >= effDeadbandAbs
      : absDelta >= effDeadbandAbs && (absPct == null || absPct >= deadbandPct || absDelta >= minPercentBase * 2);

    if (significant) {
      polarity = (higherIsBetter ? delta > 0 : delta < 0) ? 'improved' : 'declined';
    }
  }

  return {
    current: round1(current),
    previous: round1(previous),
    delta,
    percentDelta,
    polarity,
    isNewActivity,
    status: 'available',
  };
}

export function buildComparisonMap(currentRow = {}, previousRow = {}) {
  return {
    resolved: computeMetricDelta(currentRow.resolved ?? 0, previousRow.resolved ?? 0, {
      higherIsBetter: true,
      unit: 'count',
      minPercentBase: 2,
      deadbandAbs: 1,
    }),
    points: computeMetricDelta(currentRow.points ?? 0, previousRow.points ?? 0, {
      higherIsBetter: true,
      unit: 'count',
      minPercentBase: 5,
      deadbandAbs: 3,
    }),
    responses: computeMetricDelta(currentRow.responses ?? 0, previousRow.responses ?? 0, {
      higherIsBetter: true,
      unit: 'count',
      minPercentBase: 3,
      deadbandAbs: 2,
    }),
    score: computeMetricDelta(currentRow.score ?? null, previousRow.score ?? null, {
      higherIsBetter: true,
      unit: 'count',
      minPercentBase: 5,
      deadbandAbs: 3,
    }),
    medianResponseMinutes: computeMetricDelta(
      currentRow.medianResponseMinutes ?? null,
      previousRow.medianResponseMinutes ?? null,
      {
        higherIsBetter: false,
        unit: 'minutes',
        minPercentBase: 5,
        deadbandAbs: 3,
        deadbandPct: 10,
      },
    ),
    slaCleanPct: computeMetricDelta(currentRow.slaCleanPct ?? null, previousRow.slaCleanPct ?? null, {
      higherIsBetter: true,
      unit: 'pp',
      deadbandAbs: 2,
    }),
    onTimePct: computeMetricDelta(currentRow.onTimePct ?? null, previousRow.onTimePct ?? null, {
      higherIsBetter: true,
      unit: 'pp',
      deadbandAbs: 2,
    }),
  };
}

function hasAnyActivity(row) {
  if (!row) return false;
  return (row.resolved || 0) > 0 || (row.points || 0) > 0 || (row.responses || 0) > 0;
}

/**
 * Classifies an individual member's direction based on operational KPI deltas
 * plus optional multi-month history consistency.
 */
export function classifyMemberTrend({ current = {}, previous = {}, deltas = null, history = [] } = {}) {
  const activeNow = hasAnyActivity(current);
  const activePrev = hasAnyActivity(previous);

  if (!activeNow && !activePrev) return 'inactive';
  if (activeNow && !activePrev) return 'new';
  if (!activeNow && activePrev) return 'down';

  const d = deltas || buildComparisonMap(current, previous);
  let signal = 0;

  if (d.resolved.polarity === 'improved') {
    signal += (d.resolved.percentDelta ?? 0) >= 20 || d.resolved.delta >= 3 ? 2 : 1.25;
  } else if (d.resolved.polarity === 'declined') {
    signal -= (d.resolved.percentDelta ?? 0) <= -20 || d.resolved.delta <= -3 ? 2 : 1.25;
  }

  if (d.points.polarity === 'improved') {
    signal += (d.points.percentDelta ?? 0) >= 20 || d.points.delta >= 15 ? 2 : 1.25;
  } else if (d.points.polarity === 'declined') {
    signal -= (d.points.percentDelta ?? 0) <= -20 || d.points.delta <= -15 ? 2 : 1.25;
  }

  const enoughResponseSamples =
    (current.responseSampleCount ?? current.resolved ?? 0) >= 2 &&
    (previous.responseSampleCount ?? previous.resolved ?? 0) >= 2;
  if (enoughResponseSamples) {
    if (d.medianResponseMinutes.polarity === 'improved') signal += 1;
    else if (d.medianResponseMinutes.polarity === 'declined') signal -= 1;
  }

  if ((current.resolved ?? 0) >= 2 && (previous.resolved ?? 0) >= 2) {
    if (d.slaCleanPct.polarity === 'improved') signal += 1;
    else if (d.slaCleanPct.polarity === 'declined') signal -= 1.25;
  }

  // Mild tiebreaker using baseline across earlier months in trend history (excluding current month)
  if (Math.abs(signal) < 1.25 && Array.isArray(history) && history.length >= 3) {
    const prior = history.slice(0, -1).filter(hasAnyActivity);
    if (prior.length >= 2) {
      const avgResolved = prior.reduce((s, r) => s + (r.resolved || 0), 0) / prior.length;
      const avgPoints = prior.reduce((s, r) => s + (r.points || 0), 0) / prior.length;
      if ((current.resolved || 0) > avgResolved * 1.15 && (current.points || 0) >= avgPoints) {
        signal += 0.75;
      } else if ((current.resolved || 0) < avgResolved * 0.85 && (current.points || 0) <= avgPoints) {
        signal -= 0.75;
      }
    }
  }

  if (signal >= 1.5) return 'up';
  if (signal <= -1.5) return 'down';
  return 'flat';
}

const fmtId = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);

function buildAttentionReasons(row) {
  const reasons = [];
  const d = row.deltas || {};
  const prev = row.previous || {};

  if ((prev.resolved || 0) >= 3 && d.resolved?.polarity === 'declined' && (d.resolved.percentDelta ?? 0) <= -25) {
    reasons.push(`Tiket selesai turun ${fmtId(d.resolved.delta)} (${fmtId(d.resolved.percentDelta)}%)`);
  }
  if ((prev.points || 0) >= 15 && d.points?.polarity === 'declined' && (d.points.percentDelta ?? 0) <= -25) {
    reasons.push(`Poin turun ${fmtId(d.points.delta)} (${fmtId(d.points.percentDelta)}%)`);
  }
  if ((row.resolved || 0) >= 3 && row.slaCleanPct != null && row.slaCleanPct < 85) {
    reasons.push(`Kepatuhan SLA ${fmtId(row.slaCleanPct)}% (< 85%)`);
  }
  if (
    (row.responseSampleCount ?? row.resolved ?? 0) >= 3 &&
    (prev.medianResponseMinutes || 0) >= 5 &&
    d.medianResponseMinutes?.polarity === 'declined' &&
    (d.medianResponseMinutes.percentDelta ?? 0) >= 30
  ) {
    reasons.push(`Median respons melambat +${fmtId(d.medianResponseMinutes.delta)} mnt`);
  }
  if (!reasons.length && (prev.resolved || 0) >= 4 && (row.resolved || 0) === 0) {
    reasons.push(`Belum ada tiket selesai (bulan lalu ${fmtId(prev.resolved)} tiket)`);
  }
  return reasons;
}

function buildImproverReasons(row) {
  const reasons = [];
  const d = row.deltas || {};
  if (d.resolved?.polarity === 'improved' && d.resolved.delta > 0) {
    const pct = d.resolved.percentDelta != null ? ` (+${fmtId(d.resolved.percentDelta)}%)` : '';
    reasons.push(`Tiket selesai +${fmtId(d.resolved.delta)}${pct}`);
  }
  if (d.points?.polarity === 'improved' && d.points.delta > 0) {
    const pct = d.points.percentDelta != null ? ` (+${fmtId(d.points.percentDelta)}%)` : '';
    reasons.push(`Poin +${fmtId(d.points.delta)}${pct}`);
  }
  if (d.medianResponseMinutes?.polarity === 'improved' && d.medianResponseMinutes.delta < 0) {
    reasons.push(`Respons ${fmtId(Math.abs(d.medianResponseMinutes.delta))} mnt lebih cepat`);
  }
  if (d.slaCleanPct?.polarity === 'improved' && d.slaCleanPct.delta > 0) {
    reasons.push(`SLA membaik +${fmtId(d.slaCleanPct.delta)} pp`);
  }
  return reasons;
}

/**
 * Selects up to `maxPerGroup` "Paling Meningkat" and "Perlu Perhatian" members
 * with concrete Indonesian reasons and minimum-sample noise guards.
 */
export function selectTeamHighlights(rows = [], { maxPerGroup = 3 } = {}) {
  const attentionCandidates = [];
  const flaggedAttentionIds = new Set();

  for (const row of rows) {
    const reasons = buildAttentionReasons(row);
    if (!reasons.length) continue;
    const d = row.deltas || {};
    const severity =
      (row.slaCleanPct != null && row.slaCleanPct < 85 ? (85 - row.slaCleanPct) * 2 : 0) +
      (d.resolved?.percentDelta != null && d.resolved.percentDelta < 0 ? Math.abs(d.resolved.percentDelta) * 0.6 : 0) +
      (d.points?.percentDelta != null && d.points.percentDelta < 0 ? Math.abs(d.points.percentDelta) * 0.4 : 0) +
      (d.medianResponseMinutes?.polarity === 'declined' ? Math.min(40, Math.abs(d.medianResponseMinutes.percentDelta || 0) * 0.4) : 0);

    flaggedAttentionIds.add(row.userId);
    attentionCandidates.push({
      userId: row.userId,
      name: row.name,
      department: row.department,
      company: row.company,
      reasons: reasons.slice(0, 2),
      severity: round1(severity),
    });
  }

  attentionCandidates.sort((a, b) => b.severity - a.severity || a.userId - b.userId);

  const improverCandidates = [];
  for (const row of rows) {
    if (flaggedAttentionIds.has(row.userId)) continue;
    const minVolume = (row.resolved || 0) >= 3 || (row.points || 0) >= 15;
    if (!minVolume || row.trendDirection !== 'up') continue;
    if (row.slaCleanPct != null && row.slaCleanPct < 85) continue;

    const reasons = buildImproverReasons(row);
    if (!reasons.length) continue;

    const d = row.deltas || {};
    const gainScore =
      (d.resolved?.delta > 0 ? d.resolved.delta * 6 : 0) +
      (d.points?.delta > 0 ? d.points.delta * 0.8 : 0) +
      (d.medianResponseMinutes?.polarity === 'improved' ? Math.min(20, Math.abs(d.medianResponseMinutes.delta || 0) * 0.5) : 0) +
      (d.slaCleanPct?.polarity === 'improved' ? d.slaCleanPct.delta * 1.5 : 0);

    improverCandidates.push({
      userId: row.userId,
      name: row.name,
      department: row.department,
      company: row.company,
      reasons: reasons.slice(0, 2),
      gainScore: round1(gainScore),
    });
  }

  improverCandidates.sort((a, b) => b.gainScore - a.gainScore || a.userId - b.userId);

  return {
    topImprovers: improverCandidates.slice(0, maxPerGroup),
    needsAttention: attentionCandidates.slice(0, maxPerGroup),
  };
}

function medianOf(values) {
  const sorted = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return round1(sorted[Math.ceil(sorted.length * 0.5) - 1]);
}

/**
 * Summarizes 4 operational KPIs across a filtered set of team rows + optional raw team response samples.
 */
export function summarizeTeamKpis(rows = [], previousRows = [], extra = {}) {
  const memberCount = rows.length || 0;
  const totalResolved = rows.reduce((s, r) => s + (r.resolved || 0), 0);
  const prevTotalResolved = previousRows.reduce((s, r) => s + (r.resolved || 0), 0);
  const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
  const prevTotalPoints = previousRows.reduce((s, r) => s + (r.points || 0), 0);

  const curMedianResponse = extra.currentResponseSamples?.length
    ? medianOf(extra.currentResponseSamples)
    : medianOf(rows.map(r => r.medianResponseMinutes));
  const prevMedianResponse = extra.previousResponseSamples?.length
    ? medianOf(extra.previousResponseSamples)
    : medianOf(previousRows.map(r => r.medianResponseMinutes));

  const curSlaNum = rows.reduce((s, r) => s + (r.slaCleanCount ?? 0), 0);
  const curSlaDen = rows.reduce((s, r) => s + (r.slaCleanCount != null ? (r.resolved || 0) : 0), 0);
  const prevSlaNum = previousRows.reduce((s, r) => s + (r.slaCleanCount ?? 0), 0);
  const prevSlaDen = previousRows.reduce((s, r) => s + (r.slaCleanCount != null ? (r.resolved || 0) : 0), 0);

  const fallbackPct = list => {
    const active = list.filter(r => r.slaCleanPct != null && (r.resolved || 0) > 0);
    if (!active.length) return null;
    return round1(active.reduce((s, r) => s + r.slaCleanPct, 0) / active.length);
  };

  const curSlaPct = curSlaDen > 0 ? round1((curSlaNum / curSlaDen) * 100) : fallbackPct(rows);
  const prevSlaPct = prevSlaDen > 0 ? round1((prevSlaNum / prevSlaDen) * 100) : fallbackPct(previousRows);

  return {
    memberCount,
    resolved: {
      current: totalResolved,
      previous: prevTotalResolved,
      perMember: memberCount ? round1(totalResolved / memberCount) : 0,
      delta: computeMetricDelta(totalResolved, prevTotalResolved, {
        higherIsBetter: true,
        unit: 'count',
        minPercentBase: 3,
        deadbandAbs: 1,
      }),
    },
    points: {
      current: totalPoints,
      previous: prevTotalPoints,
      perMember: memberCount ? round1(totalPoints / memberCount) : 0,
      delta: computeMetricDelta(totalPoints, prevTotalPoints, {
        higherIsBetter: true,
        unit: 'count',
        minPercentBase: 10,
        deadbandAbs: 5,
      }),
    },
    medianResponseMinutes: {
      current: curMedianResponse,
      previous: prevMedianResponse,
      sampleCount: extra.currentResponseSamples?.length ?? rows.reduce((s, r) => s + (r.responseSampleCount || 0), 0),
      delta: computeMetricDelta(curMedianResponse, prevMedianResponse, {
        higherIsBetter: false,
        unit: 'minutes',
        minPercentBase: 5,
        deadbandAbs: 3,
        deadbandPct: 10,
      }),
    },
    slaCleanPct: {
      current: curSlaPct,
      previous: prevSlaPct,
      cleanCount: curSlaNum,
      totalCount: curSlaDen || totalResolved,
      delta: computeMetricDelta(curSlaPct, prevSlaPct, {
        higherIsBetter: true,
        unit: 'pp',
        deadbandAbs: 2,
      }),
    },
  };
}
