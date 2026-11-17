import {prisma} from '@/lib/prisma';
import {cohortRows} from '@/lib/reports/kinerjaServer';
import {canReadReport} from '@/lib/reports/reportScope';
import {aggregateEvaluations} from '@/lib/reports/monthlyEvaluation';
import {loadTeamOperationalWindow,scoreActivity} from '@/lib/reports/activityScore';
import {
  buildRollingMonthKeys,
  resolveCompareMonthKey,
  buildComparisonMap,
  classifyMemberTrend,
  selectTeamHighlights,
  summarizeTeamKpis,
  clampTrendCount,
} from '@/lib/reports/performanceComparison';
import {kinerjaAccess,respond,failure} from '../shared';

function reasonsOf(row) {
  const source = row.evidence?.missingReasons?.length ? row.evidence.missingReasons : row.explanations;
  const list = Array.isArray(source) ? source : source ? [source] : [];
  return [...new Set(list.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))].slice(0, 6);
}

const stripInternal = row => {
  const {responseValues: _omit, ...rest} = row;
  return rest;
};

export async function GET(req) {
  try {
    const a = await kinerjaAccess(req);
    const compareMonth = resolveCompareMonthKey(a.month, a.query.get('compareMonth'));
    const trendCount = clampTrendCount(a.query.get('trendMonths'), 6);
    const trendKeys = buildRollingMonthKeys(a.month, trendCount);
    const windowMonths = [...new Set([...trendKeys, compareMonth])];

    const selected = a.users.filter(u => canReadReport(a.scope, u.id));
    const canViewTeam = selected.some(u => u.id !== Number(a.actor.id));
    const allRows = await cohortRows(prisma, {month: a.month, users: selected, mode: a.mode});
    const rows = allRows.filter(
      r =>
        (!a.query.get('company') || r.company === a.query.get('company')) &&
        (!a.query.get('departmentId') || String(r.departmentId) === a.query.get('departmentId')),
    );

    const groups = new Map();
    for (const r of rows) {
      const key = r.departmentId + ':' + r.company;
      if (!groups.has(key)) groups.set(key, {departmentId: r.departmentId, department: r.department, company: r.company, rows: []});
      groups.get(key).rows.push(r);
    }

    const [publications, windowData] = await Promise.all([
      prisma.performancePublication.findMany({
        where: {monthKey: a.month},
        select: {id: true, departmentId: true, company: true, version: true},
        orderBy: {version: 'desc'},
      }),
      loadTeamOperationalWindow(prisma, {userIds: rows.map(r => r.userId), monthKeys: windowMonths}),
    ]);

    const scoredByMonth = new Map();
    for (const mKey of windowMonths) {
      const monthMap = windowData.byMonth.get(mKey);
      const scored = scoreActivity(
        rows.map(r => ({
          userId: r.userId,
          name: r.name,
          departmentId: r.departmentId,
          department: r.department,
          company: r.company,
          total: r.total,
          status: r.status,
          reviewState: r.reviewState,
          reasons: reasonsOf(r),
          ...(monthMap?.get(r.userId) || {
            resolved: 0,
            responses: 0,
            points: 0,
            medianResponseMinutes: null,
            p90ResponseMinutes: null,
            responseSampleCount: 0,
            responseValues: [],
            slaCleanCount: 0,
            slaCleanPct: null,
            onTimeCount: 0,
            onTimeDueCount: 0,
            onTimePct: null,
          }),
        })),
      );
      scoredByMonth.set(mKey, new Map(scored.map(row => [row.userId, row])));
    }

    const currentMap = scoredByMonth.get(a.month) || new Map();
    const compareMap = scoredByMonth.get(compareMonth) || new Map();

    const currentResponseSamples = [];
    const previousResponseSamples = [];
    const payloadRows = [];
    const previousScoredList = [];

    for (const r of rows) {
      const cur = currentMap.get(r.userId);
      if (!cur) continue;
      const prev = compareMap.get(r.userId) || {
        userId: r.userId,
        departmentId: r.departmentId,
        company: r.company,
        resolved: 0,
        responses: 0,
        points: 0,
        score: 0,
        rank: null,
        medianResponseMinutes: null,
        responseSampleCount: 0,
        responseValues: [],
        slaCleanCount: 0,
        slaCleanPct: null,
        onTimeCount: 0,
        onTimeDueCount: 0,
        onTimePct: null,
      };

      if (cur.responseValues?.length) currentResponseSamples.push(...cur.responseValues);
      if (prev.responseValues?.length) previousResponseSamples.push(...prev.responseValues);
      previousScoredList.push(prev);

      const trend = trendKeys.map(mKey => {
        const entry = scoredByMonth.get(mKey)?.get(r.userId);
        return {
          month: mKey,
          resolved: entry?.resolved || 0,
          responses: entry?.responses || 0,
          points: entry?.points || 0,
          medianResponseMinutes: entry?.medianResponseMinutes ?? null,
          slaCleanPct: entry?.slaCleanPct ?? null,
          onTimePct: entry?.onTimePct ?? null,
          score: entry?.score ?? 0,
          rank: entry?.rank ?? null,
        };
      });

      const deltas = buildComparisonMap(cur, prev);
      const trendDirection = classifyMemberTrend({current: cur, previous: prev, deltas, history: trend});

      payloadRows.push({
        ...stripInternal(cur),
        previous: {
          month: compareMonth,
          resolved: prev.resolved || 0,
          responses: prev.responses || 0,
          points: prev.points || 0,
          score: prev.score ?? 0,
          rank: prev.rank ?? null,
          medianResponseMinutes: prev.medianResponseMinutes ?? null,
          responseSampleCount: prev.responseSampleCount || 0,
          slaCleanCount: prev.slaCleanCount || 0,
          slaCleanPct: prev.slaCleanPct ?? null,
          onTimePct: prev.onTimePct ?? null,
        },
        deltas,
        trendDirection,
        trend,
      });
    }

    const activitySummary = payloadRows.reduce(
      (sum, row) => ({
        resolved: sum.resolved + row.resolved,
        responses: sum.responses + row.responses,
        points: sum.points + row.points,
      }),
      {resolved: 0, responses: 0, points: 0},
    );

    const byGroup = new Map();
    for (const row of payloadRows) {
      const key = row.departmentId + ':' + (row.company || '');
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(row);
    }

    const average = values => (values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0);
    const perMember = (list, field) => (list.length ? Math.round((list.reduce((sum, row) => sum + (row[field] || 0), 0) / list.length) * 10) / 10 : 0);

    const comparison = [...byGroup.values()]
      .map(members => {
        const previousMembers = members.map(member => compareMap.get(member.userId)).filter(Boolean);
        const currentScore = average(members.map(member => member.score || 0));
        const previousScore = average(previousMembers.map(member => member.score || 0));
        const currentPoints = perMember(members, 'points');
        const previousPoints = perMember(previousMembers, 'points');
        const curResp = average(members.map(m => m.medianResponseMinutes).filter(v => v != null));
        const prevResp = average(previousMembers.map(m => m.medianResponseMinutes).filter(v => v != null));
        return {
          departmentId: members[0].departmentId,
          department: members[0].department,
          company: members[0].company,
          members: members.length,
          activeMembers: members.filter(member => (member.score || 0) > 0).length,
          currentScore,
          previousScore,
          scoreDelta: Math.round((currentScore - previousScore) * 10) / 10,
          currentPoints,
          previousPoints,
          pointsDelta: Math.round((currentPoints - previousPoints) * 10) / 10,
          currentResolved: perMember(members, 'resolved'),
          previousResolved: perMember(previousMembers, 'resolved'),
          resolvedDelta: Math.round((perMember(members, 'resolved') - perMember(previousMembers, 'resolved')) * 10) / 10,
          currentMedianResponseMinutes: members.some(m => m.medianResponseMinutes != null) ? curResp : null,
          previousMedianResponseMinutes: previousMembers.some(m => m.medianResponseMinutes != null) ? prevResp : null,
          previousActive: previousMembers.filter(member => (member.score || 0) > 0).length,
        };
      })
      .sort((left, right) => right.scoreDelta - left.scoreDelta);

    const trendSeries = trendKeys.map(mKey => {
      const monthRows = [...(scoredByMonth.get(mKey)?.values() || [])];
      const samples = monthRows.flatMap(m => m.responseValues || []).sort((x, y) => x - y);
      const totalRes = monthRows.reduce((s, r) => s + (r.resolved || 0), 0);
      const cleanCnt = monthRows.reduce((s, r) => s + (r.slaCleanCount || 0), 0);
      return {
        month: mKey,
        resolved: totalRes,
        responses: monthRows.reduce((s, r) => s + (r.responses || 0), 0),
        points: monthRows.reduce((s, r) => s + (r.points || 0), 0),
        medianResponseMinutes: samples.length ? Math.round(samples[Math.ceil(samples.length * 0.5) - 1] * 10) / 10 : null,
        slaCleanPct: totalRes > 0 ? Math.round((cleanCnt / totalRes) * 1000) / 10 : null,
      };
    });

    const teamSummary = summarizeTeamKpis(payloadRows, previousScoredList, {
      currentResponseSamples,
      previousResponseSamples,
    });
    const highlights = canViewTeam ? selectTeamHighlights(payloadRows) : {topImprovers: [], needsAttention: []};

    const reasonCounts = new Map();
    for (const row of payloadRows) for (const reason of row.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    const readiness = {
      users: rows.length,
      assigned: rows.filter(r => r.assignmentStable).length,
      withPolicy: rows.filter(r => Boolean(r.policy)).length,
      withContext: rows.filter(r => Number(r.evidence?.scheduledMinutes) > 0).length,
      reviewedActivities: rows.reduce((sum, r) => sum + Number(r.evidence?.coverage?.qualityReviewed || 0), 0),
      ready: rows.filter(r => r.status === 'ready').length,
      insufficient: rows.filter(r => r.status === 'insufficient_data').length,
      excluded: rows.filter(r => r.status === 'excluded').length,
      unpublished: rows.filter(r => r.status === 'unpublished').length,
      topReasons: [...reasonCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([text, count]) => ({text, count})),
    };

    return respond({
      month: a.month,
      previousMonth: compareMonth,
      compareMonth,
      trendMonths: trendKeys,
      mode: a.mode,
      currentUserId: Number(a.actor.id),
      canPublish:
        a.flags.performance_ranking_publication &&
        a.mode === 'official' &&
        (a.actor.role === 'Admin' || a.actor.permissions?.includes('lock_evaluations')),
      canViewTeam,
      aggregate: aggregateEvaluations(rows),
      readiness,
      activitySummary,
      teamSummary,
      highlights,
      trendSeries,
      comparison,
      groups: [...groups.values()].map(g => ({
        ...g,
        rows: undefined,
        ...aggregateEvaluations(g.rows),
        publicationVersion: publications.find(p => p.departmentId === g.departmentId && p.company === g.company)?.version || 0,
      })),
      rows: payloadRows,
      departments: [...new Map(allRows.map(r => [r.departmentId, {id: r.departmentId, name: r.department}])).values()],
      companies: [...new Set(allRows.map(r => r.company).filter(Boolean))],
    });
  } catch (e) {
    return failure(e);
  }
}
