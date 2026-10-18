import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../../../src/modules/prisma/client.js';
import { statsRouter } from '../../../src/modules/stats/stats.controller.js';

function replace(target: any, key: string, implementation: (...args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler(path: string) {
  const route = (statsRouter as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods.get);
  assert.ok(route, `missing GET ${path} route`);
  return route.route.stack.at(-1).handle;
}

function response() {
  const state: any = { body: undefined, statusCode: 200 };
  const res: any = {
    json: (body: unknown) => { state.body = body; return res; },
    status: (statusCode: number) => { state.statusCode = statusCode; return res; },
  };
  return { res, state };
}

test('attendance stats route rejects invalid query and forwards validated query data', async (t) => {
  const invalid = response();
  const invalidErrors: unknown[] = [];
  await routeHandler('/attendance')({ query: { date: '2025-02-30' } }, invalid.res,
    (error: unknown) => invalidErrors.push(error));
  assert.equal(invalid.state.statusCode, 400);
  assert.equal(invalid.state.body.success, false);
  assert.deepEqual(invalidErrors, []);

  let sessionQueries = 0;
  replace(prisma.announcement, 'findUnique', async () => ({ id: 'ann1', datetime: new Date('2025-05-10T10:00:00Z') }), t);
  replace(prisma.attendanceSession, 'findUnique', async () => { sessionQueries++; return null; }, t);
  replace(prisma.user, 'count', async () => 3, t);
  const valid = response();
  await routeHandler('/attendance')({ query: { announcementId: 'ann1' } }, valid.res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(valid.state.body.success, true);
  assert.equal(valid.state.body.data.totalMembers, 3);
  assert.equal(sessionQueries, 1);
});

test('global stats route returns the aggregated service payload', async (t) => {
  let userCount = 0;
  let blogCount = 0;
  replace(prisma.user, 'count', async () => ++userCount === 1 ? 5 : 1, t);
  replace(prisma.announcement, 'count', async () => 2, t);
  replace(prisma.blog, 'count', async () => ++blogCount === 1 ? 3 : 2, t);
  replace(prisma.attendanceSession, 'count', async () => 4, t);
  const { res, state } = response();
  await routeHandler('/')({}, res, (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(state.body.data, {
    users: { total: 5, admins: 1, members: 1 },
    announcements: { total: 2 },
    blogs: { total: 3, published: 2, unpublished: 1 },
    sessions: { total: 4, today: 4, upcomingOpen: 4 },
  });
});
