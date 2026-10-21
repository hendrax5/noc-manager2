import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Evaluate query orchestration against a recording Prisma double, without a DB.
async function loadDashboard(prisma) {
  const source = (await readFile(new URL('./dashboard.js', import.meta.url), 'utf8'))
    .replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, '')
    .replaceAll('export async function ', 'async function ');
  const andWhere = (...parts) => ({ AND: parts.filter(p => p && Object.keys(p).length) });
  return new Function('prisma', 'andWhere', 'workTypeWhere', 'getPersonalCategoryIds', 'excludePersonalFromLiveOps', 'expandStatusesForQuery', `${source}; return {buildDashboardOverview,listLiveOpsTickets};`)(
    prisma, andWhere, value => ['Unclassified', 'Trouble', 'Installation'].includes(value) ? { workType: value } : {},
    async () => [99], ids => ({jobCategoryId: {notIn: ids}}), values => values
  );
}
const contains = (where, fragment) => JSON.stringify(where).includes(JSON.stringify(fragment).slice(1, -1));

test('overview applies classification, department OR and configured categories to every sky query', async () => {
  const calls = [];
  const prisma = {
    ticket: { count: async args => { calls.push(args.where); return 0; }, findMany: async args => { calls.push(args.where); return []; } },
    jobCategory: { findMany: async () => [{id: 1, name: 'Network', score: 1, active: true}] },
    user: { findMany: async args => { calls.push(args.select.tickets.where, args.select._count.select.tickets.where); return []; } },
  };
  const { buildDashboardOverview } = await loadDashboard(prisma);
  const department = { OR: [{assigneeId: 7}, {departmentId: 2}] };
  await buildDashboardOverview({scope: {AND: [department, {workType: 'Trouble'}]}, categoryNames: ['Network'], includeSkyView: true});
  assert.ok(calls.length > 10);
  for (const where of calls) {
    assert.ok(contains(where, {workType: 'Trouble'}), JSON.stringify(where));
    assert.ok(contains(where, department), JSON.stringify(where));
  }
  for (const where of calls.slice(-4)) assert.ok(contains(where, {name: {in: ['Network']}}));
});

test('live operations ANDs work classification with scope and personal-category exclusion', async () => {
  let query;
  const { listLiveOpsTickets } = await loadDashboard({ticket: {findMany: async args => {query = args; return [];}}});
  const department = {OR: [{assigneeId: 7}, {departmentId: 2}]};
  await listLiveOpsTickets({scope: department, workType: 'Installation', allowedCategories: ['Network'], category: 'Forbidden'});
  assert.ok(contains(query.where, department));
  assert.ok(contains(query.where, {workType: 'Installation'}));
  assert.ok(contains(query.where, {jobCategoryId: {notIn: [99]}}));
  assert.ok(contains(query.where, {name: {in: []}}));
});
