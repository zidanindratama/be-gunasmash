import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../../../src/modules/prisma/client.js';
import { getGlobalStats, getAttendanceStatsBySession } from '../../../src/modules/stats/stats.service.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

test('getGlobalStats maps counts and uses the fixed local day for session stats', async (t) => {
  const fixed = new Date('2025-05-10T10:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now: fixed });
  const userCalls: any[] = [];
  const sessionCalls: any[] = [];
  replace(prisma.user, 'count', async (arg) => { userCalls.push(arg); return arg?.where?.role === 'ADMIN' ? 2 : arg?.where?.role === 'MEMBER' ? 8 : 10; }, t);
  replace(prisma.announcement, 'count', async () => 5, t);
  let blogCalls = 0;
  replace(prisma.blog, 'count', async () => ++blogCalls === 1 ? 6 : 4, t);
  replace(prisma.attendanceSession, 'count', async (arg) => { sessionCalls.push(arg); return arg?.where?.state ? 3 : arg?.where?.date ? 2 : 9; }, t);

  assert.deepEqual(await getGlobalStats(), {
    users: { total: 10, admins: 2, members: 8 },
    announcements: { total: 5 },
    blogs: { total: 6, published: 4, unpublished: 2 },
    sessions: { total: 9, today: 2, upcomingOpen: 3 },
  });
  assert.deepEqual(userCalls, [undefined, { where: { role: 'ADMIN' } }, { where: { role: 'MEMBER' } }]);
  assert.deepEqual(sessionCalls, [undefined, { where: { date: new Date(2025, 4, 10) } }, { where: { date: { gte: new Date(2025, 4, 10) }, state: 'OPEN' } }]);
});

test('getGlobalStats clamps unpublished count and propagates count failures', async (t) => {
  replace(prisma.user, 'count', async () => 0, t);
  replace(prisma.announcement, 'count', async () => 0, t);
  replace(prisma.blog, 'count', async () => 2, t);
  replace(prisma.attendanceSession, 'count', async () => 0, t);
  const result = await getGlobalStats();
  assert.equal(result.blogs.unpublished, 0);
  const failure = new Error('count failed');
  replace(prisma.user, 'count', async () => { throw failure; }, t);
  await assert.rejects(getGlobalStats(), failure);
});

test('attendance stats return all members absent when session does not exist', async (t) => {
  let lookup: any;
  replace(prisma.announcement, 'findUnique', async (arg) => { lookup = arg; return { id: 'ann1', datetime: new Date('2025-05-10T10:00:00Z') }; }, t);
  replace(prisma.attendanceSession, 'findUnique', async () => null, t);
  replace(prisma.user, 'count', async (arg) => { assert.deepEqual(arg, { where: { role: 'MEMBER' } }); return 8; }, t);
  assert.deepEqual(await getAttendanceStatsBySession('ann1'), {
    session: null, counts: { present: 0, late: 0, excused: 0, absent: 8 }, totalMembers: 8,
  });
  assert.deepEqual(lookup, { where: { id: 'ann1' }, select: { id: true, datetime: true } });
});

test('attendance stats map status counts and clamp absence when attendance exceeds members', async (t) => {
  let sessionQuery: any;
  let attendanceQueries: any[] = [];
  const session = { id: 's1', date: new Date(2025, 4, 10), state: 'OPEN', openedAt: null, closedAt: null };
  replace(prisma.announcement, 'findUnique', async () => ({ id: 'ann1', datetime: new Date('2025-05-10T10:00:00Z') }), t);
  replace(prisma.attendanceSession, 'findUnique', async (arg) => { sessionQuery = arg; return session; }, t);
  replace(prisma.attendance, 'count', async (arg) => {
    attendanceQueries.push(arg);
    return arg.where.status === 'PRESENT' ? 4 : arg.where.status === 'LATE' ? 2 : 1;
  }, t);
  replace(prisma.user, 'count', async () => 5, t);
  assert.deepEqual(await getAttendanceStatsBySession('ann1', '2025-05-10'), {
    session, counts: { present: 4, late: 2, excused: 1, absent: 0 }, totalMembers: 5,
  });
  assert.deepEqual(sessionQuery.where.announcementId_date, { announcementId: 'ann1', date: new Date(2025, 4, 10) });
  assert.deepEqual(attendanceQueries.map((query) => query.where.status), ['PRESENT', 'LATE', 'EXCUSED']);
});

test('attendance stats rejects missing announcement and invalid calendar dates', async (t) => {
  replace(prisma.announcement, 'findUnique', async () => null, t);
  await assert.rejects(getAttendanceStatsBySession('missing'), { message: 'Announcement not found', status: 404 });
  replace(prisma.announcement, 'findUnique', async () => ({ id: 'ann1', datetime: new Date() }), t);
  await assert.rejects(getAttendanceStatsBySession('ann1', '2025-02-30'), { message: 'Invalid date format. Use YYYY or YYYY-MM or YYYY-MM-DD', status: 400 });
});
