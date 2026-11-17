import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreActivity, loadTeamOperationalWindow} from './activityScore.js';

test('normalises and ranks inside each department cohort', () => {
  const scored = scoreActivity([
    {userId: 1, departmentId: 1, company: 'ION', resolved: 10, responses: 10, points: 100},
    {userId: 2, departmentId: 1, company: 'ION', resolved: 5, responses: 5, points: 50},
    {userId: 3, departmentId: 2, company: 'ION', resolved: 100, responses: 100, points: 1000},
    {userId: 4, departmentId: 2, company: 'ION', resolved: 1, responses: 1, points: 1},
  ]);
  const byId = new Map(scored.map(row => [row.userId, row]));
  assert.equal(byId.get(1).score, 100);
  assert.equal(byId.get(1).rank, 1);
  assert.equal(byId.get(2).score, 50);
  assert.equal(byId.get(2).rank, 2);
  assert.equal(byId.get(3).score, 100);
  assert.equal(byId.get(3).rank, 1);
  assert.equal(byId.get(4).score, 0.6);
  assert.equal(byId.get(4).rank, 2);
});

test('keeps companies in separate cohorts and handles empty activity', () => {
  const scored = scoreActivity([
    {userId: 1, departmentId: 1, company: 'ION', resolved: 4, responses: 4, points: 40},
    {userId: 2, departmentId: 1, company: 'SDC', resolved: 0, responses: 0, points: 0},
    {userId: 3, departmentId: 1, company: 'SDC', resolved: 2, responses: 2, points: 20},
  ]);
  const byId = new Map(scored.map(row => [row.userId, row]));
  assert.equal(byId.get(1).rank, 1);
  assert.equal(byId.get(1).score, 100);
  assert.equal(byId.get(2).rank, 2);
  assert.equal(byId.get(2).score, 0);
  assert.equal(byId.get(3).rank, 1);
  assert.equal(byId.get(3).score, 100);
});

test('gives equal scores the same competition rank', () => {
  const scored = scoreActivity([
    {userId: 1, departmentId: 1, company: 'ION', resolved: 5, responses: 5, points: 50},
    {userId: 2, departmentId: 1, company: 'ION', resolved: 5, responses: 5, points: 50},
    {userId: 3, departmentId: 1, company: 'ION', resolved: 1, responses: 1, points: 10},
  ]);
  const byId = new Map(scored.map(row => [row.userId, row]));
  assert.equal(byId.get(1).rank, 1);
  assert.equal(byId.get(2).rank, 1);
  assert.equal(byId.get(3).rank, 3);
});

test('loadTeamOperationalWindow buckets WIB boundaries and computes response speed and SLA metrics in single span query', async () => {
  let ticketQueries = 0;
  const mockDb = {
    ticket: {
      findMany: async () => {
        ticketQueries += 1;
        return [
          // 2026-09-30T17:30:00Z is 2026-10-01 00:30 WIB -> belongs to 2026-10!
          {
            id: 101,
            assigneeId: 1,
            createdAt: new Date('2026-09-30T17:00:00Z'),
            resolvedAt: new Date('2026-09-30T17:30:00Z'),
            firstRespondedAt: new Date('2026-09-30T17:20:00Z'), // 10 mins after assignment at 17:10Z
            resolutionDueAt: new Date('2026-09-30T18:00:00Z'),
            slaBreaches: 0,
            awardedScore: 15,
          },
          {
            id: 102,
            assigneeId: 1,
            createdAt: new Date('2026-10-02T01:00:00Z'),
            resolvedAt: new Date('2026-10-02T03:00:00Z'),
            firstRespondedAt: new Date('2026-10-02T01:30:00Z'), // 30 mins after createdAt
            resolutionDueAt: new Date('2026-10-02T02:00:00Z'), // late
            slaBreaches: 1,
            awardedScore: 5,
          },
          // Belongs to 2026-09 WIB
          {
            id: 103,
            assigneeId: 1,
            createdAt: new Date('2026-09-10T01:00:00Z'),
            resolvedAt: new Date('2026-09-10T02:00:00Z'),
            firstRespondedAt: new Date('2026-09-10T01:40:00Z'),
            resolutionDueAt: null,
            slaBreaches: 0,
            awardedScore: 10,
          },
        ];
      },
    },
    comment: {
      findMany: async () => [
        {authorId: 1, createdAt: new Date('2026-10-02T01:10:00Z')},
        {authorId: 1, createdAt: new Date('2026-09-10T01:10:00Z')},
      ],
    },
    ticketHistory: {
      findMany: async args => {
        if (args.where?.ticketId) {
          return [{ticketId: 101, createdAt: new Date('2026-09-30T17:10:00Z')}];
        }
        return [
          {actorId: 1, awardedScore: 20, createdAt: new Date('2026-10-03T05:00:00Z')},
          {actorId: 1, awardedScore: 5, createdAt: new Date('2026-09-10T02:00:00Z')},
        ];
      },
    },
  };

  const {byMonth} = await loadTeamOperationalWindow(mockDb, {userIds: [1, 2], monthKeys: ['2026-09', '2026-10']});
  assert.equal(ticketQueries, 1);

  const oct1 = byMonth.get('2026-10').get(1);
  assert.equal(oct1.resolved, 2);
  assert.equal(oct1.responses, 1);
  assert.equal(oct1.points, 40); // 15 + 5 + 20
  assert.equal(oct1.medianResponseMinutes, 10); // sorted [10, 30], ceil(2*0.5)-1 = index 0 = 10
  assert.equal(oct1.p90ResponseMinutes, 30);
  assert.equal(oct1.slaCleanPct, 50);
  assert.equal(oct1.onTimePct, 50);

  const sep1 = byMonth.get('2026-09').get(1);
  assert.equal(sep1.resolved, 1);
  assert.equal(sep1.points, 15);
  assert.equal(sep1.medianResponseMinutes, 40);
  assert.equal(sep1.slaCleanPct, 100);
  assert.equal(sep1.onTimePct, null);

  const oct2 = byMonth.get('2026-10').get(2);
  assert.equal(oct2.resolved, 0);
  assert.equal(oct2.medianResponseMinutes, null);
  assert.equal(oct2.slaCleanPct, null);
});
