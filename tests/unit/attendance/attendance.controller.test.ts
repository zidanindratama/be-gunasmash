import assert from 'node:assert/strict';
import test from 'node:test';

import { attendanceRouter } from '../../../src/modules/attendance/attendance.controller.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler(path: string, method: string) {
  const route = (attendanceRouter as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `missing ${method.toUpperCase()} ${path} route`);
  return route.route.stack.at(-1).handle;
}

function response() {
  const state: any = { body: undefined, statusCode: 200, headers: {}, sent: undefined };
  const res: any = {
    json: (body: unknown) => { state.body = body; return res; },
    status: (statusCode: number) => { state.statusCode = statusCode; return res; },
    setHeader: (key: string, value: string) => { state.headers[key] = value; return res; },
    send: (body: unknown) => { state.sent = body; return res; },
  };
  return { res, state };
}

test('member check-in route validates DTO and passes authenticated subject/note to service behavior', async (t) => {
  const fixedNow = new Date('2025-05-10T10:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  replace(prisma.announcement, 'findUnique', async () => ({ id: 'ann1', datetime: fixedNow }), t);
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1', state: 'OPEN' }), t);
  let upsert: any;
  replace(prisma.attendance, 'upsert', async (arg) => { upsert = arg; return { id: 'att1' }; }, t);
  const { res, state } = response();
  await routeHandler('/check-in', 'post')({ user: { sub: 'member1' }, body: { announcementId: 'ann1', note: 'present' } }, res,
    (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(upsert.where, { sessionId_userId: { sessionId: 's1', userId: 'member1' } });
  assert.equal(upsert.create.note, 'present');
  assert.equal(state.body.success, true);

  const invalid = response();
  await routeHandler('/check-in', 'post')({ user: { sub: 'member1' }, body: { note: 'missing ID' } }, invalid.res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(invalid.state.statusCode, 400);
  assert.equal(invalid.state.body.success, false);
});

test('admin ABSENT status cancels an existing record rather than upserting attendance', async (t) => {
  replace(prisma.announcement, 'findUnique', async () => ({ id: 'ann1', datetime: new Date() }), t);
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1' }), t);
  let deletion: any;
  let upserts = 0;
  replace(prisma.attendance, 'deleteMany', async (arg) => { deletion = arg; return { count: 1 }; }, t);
  replace(prisma.attendance, 'upsert', async () => { upserts++; return {}; }, t);
  const { res, state } = response();
  await routeHandler('/admin/check-in', 'post')({
    user: { sub: 'admin1' }, body: { announcementId: 'ann1', userId: 'member1', status: 'ABSENT' },
  }, res, (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(deletion, { where: { sessionId: 's1', userId: 'member1' } });
  assert.equal(upserts, 0);
  assert.deepEqual(state.body.data, { message: 'Attendance cancelled successfully' });
});

test('summary and export routes map query results and CSV response headers', async (t) => {
  replace(prisma.announcement, 'findUnique', async () => ({ id: 'ann1', datetime: new Date() }), t);
  replace(prisma.attendanceSession, 'findUnique', async () => null, t);
  replace(prisma.user, 'count', async () => 0, t);
  replace(prisma.user, 'findMany', async () => [], t);
  const summary = response();
  await routeHandler('/session/summary', 'get')({ query: { announcementId: 'ann1' } }, summary.res,
    (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(summary.state.body.data.counts, {
    totalMembers: 0, attended: 0, present: 0, late: 0, excused: 0, absent: 0,
  });

  const exported = response();
  await routeHandler('/session/export', 'get')({ query: { announcementId: 'ann1' } }, exported.res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(exported.state.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.equal(exported.state.headers['Content-Disposition'], 'attachment; filename="attendance-ann1-today.csv"');
  assert.equal(exported.state.sent, 'type,name,email');
});
