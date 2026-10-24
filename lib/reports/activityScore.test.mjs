import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreActivity} from './activityScore.js';

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
