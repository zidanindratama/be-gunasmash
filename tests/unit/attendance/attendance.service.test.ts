import assert from 'node:assert/strict';
import test from 'node:test';

import {
  memberCheckIn, adminCheckIn, cancelAttendance, sessionSummary, exportSessionCsv,
  createSession, listSessions, getSessionDetail, updateSession, removeSession, listMemberSessions,
} from '../../../src/modules/attendance/attendance.service.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function freezeTime(t: any, iso = '2025-05-10T10:00:00.000Z') {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
}

const announcement = (datetime = '2025-05-10T10:00:00.000Z') => ({ id: 'ann1', datetime: new Date(datetime) });

test('memberCheckIn creates today session and upserts PRESENT with the composite key and note', async (t) => {
  freezeTime(t);
  let sessionLookup: any;
  let sessionCreate: any;
  let upsert: any;
  const session = { id: 's1', state: 'OPEN' };
  const attendance = { id: 'att1' };
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async (arg) => { sessionLookup = arg; return null; }, t);
  replace(prisma.attendanceSession, 'create', async (arg) => { sessionCreate = arg; return session; }, t);
  replace(prisma.attendance, 'upsert', async (arg) => { upsert = arg; return attendance; }, t);

  assert.deepEqual(await memberCheckIn('user1', 'ann1', 'Here'), { session, attendance });
  assert.deepEqual(sessionLookup, { where: { announcementId_date: { announcementId: 'ann1', date: new Date(2025, 4, 10) } } });
  assert.deepEqual(sessionCreate, { data: { announcementId: 'ann1', date: new Date(2025, 4, 10), openedAt: new Date('2025-05-10T10:00:00.000Z') } });
  assert.deepEqual(upsert, {
    where: { sessionId_userId: { sessionId: 's1', userId: 'user1' } },
    update: { status: 'PRESENT', note: 'Here' },
    create: { sessionId: 's1', userId: 'user1', status: 'PRESENT', note: 'Here' },
  });
});

test('memberCheckIn rejects missing announcements, different dates, closed window and closed sessions', async (t) => {
  replace(prisma.announcement, 'findUnique', async () => null, t);
  await assert.rejects(memberCheckIn('u1', 'missing'), { message: 'Announcement not found', status: 404 });

  freezeTime(t);
  replace(prisma.announcement, 'findUnique', async () => announcement('2025-05-09T10:00:00.000Z'), t);
  await assert.rejects(memberCheckIn('u1', 'ann1'), { message: 'Attendance is closed for this schedule', status: 403 });

  replace(prisma.announcement, 'findUnique', async () => announcement('2025-05-10T00:00:00.000Z'), t);
  await assert.rejects(memberCheckIn('u1', 'ann1'), { message: 'Attendance window has closed for this schedule', status: 403 });

  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1', state: 'CLOSED' }), t);
  let upserts = 0;
  replace(prisma.attendance, 'upsert', async () => { upserts++; return {}; }, t);
  await assert.rejects(memberCheckIn('u1', 'ann1'), { message: 'Attendance session is closed', status: 403 });
  assert.equal(upserts, 0);
});

test('memberCheckIn reuses existing open session and propagates upsert failure', async (t) => {
  freezeTime(t);
  const session = { id: 's2', state: 'OPEN' };
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async () => session, t);
  let creates = 0;
  replace(prisma.attendanceSession, 'create', async () => { creates++; return session; }, t);
  const failure = new Error('write failed');
  replace(prisma.attendance, 'upsert', async () => { throw failure; }, t);
  await assert.rejects(memberCheckIn('u1', 'ann1'), failure);
  assert.equal(creates, 0);
});

test('adminCheckIn parses explicit date and stores requested status/note', async (t) => {
  let create: any;
  let upsert: any;
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async () => null, t);
  replace(prisma.attendanceSession, 'create', async (arg) => { create = arg; return { id: 's1', state: 'OPEN' }; }, t);
  replace(prisma.attendance, 'upsert', async (arg) => { upsert = arg; return { status: 'LATE' }; }, t);
  const result = await adminCheckIn({ adminId: 'admin', announcementId: 'ann1', userId: 'u1', date: '2025-05-11', status: 'LATE', note: 'late bus' });
  assert.deepEqual(create, { data: { announcementId: 'ann1', date: new Date(2025, 4, 11), openedAt: new Date() } });
  assert.deepEqual(upsert, {
    where: { sessionId_userId: { sessionId: 's1', userId: 'u1' } },
    update: { status: 'LATE', note: 'late bus' },
    create: { sessionId: 's1', userId: 'u1', status: 'LATE', note: 'late bus' },
  });
  assert.equal((result.attendance as any).status, 'LATE');
});

test('adminCheckIn defaults status to PRESENT, rejects invalid date and missing announcement', async (t) => {
  replace(prisma.announcement, 'findUnique', async () => null, t);
  await assert.rejects(adminCheckIn({ adminId: 'admin', announcementId: 'missing', userId: 'u1' }), { message: 'Announcement not found', status: 404 });
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  await assert.rejects(adminCheckIn({ adminId: 'admin', announcementId: 'ann1', userId: 'u1', date: '2025-02-30' }), { message: 'Invalid date format. Use YYYY or YYYY-MM or YYYY-MM-DD', status: 400 });
  let upsert: any;
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1', state: 'CLOSED' }), t);
  replace(prisma.attendance, 'upsert', async (arg) => { upsert = arg; return {}; }, t);
  await adminCheckIn({ adminId: 'admin', announcementId: 'ann1', userId: 'u1' });
  assert.equal(upsert.create.status, 'PRESENT');
});

test('cancelAttendance deletes the matching member record and handles missing session/record', async (t) => {
  let lookup: any;
  let deletion: any;
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async (arg) => { lookup = arg; return { id: 's1' }; }, t);
  replace(prisma.attendance, 'deleteMany', async (arg) => { deletion = arg; return { count: 1 }; }, t);
  assert.deepEqual(await cancelAttendance('ann1', 'u1'), { message: 'Attendance cancelled successfully' });
  assert.deepEqual(lookup, { where: { announcementId_date: { announcementId: 'ann1', date: new Date(2025, 4, 10) } }, select: { id: true } });
  assert.deepEqual(deletion, { where: { sessionId: 's1', userId: 'u1' } });
  replace(prisma.attendanceSession, 'findUnique', async () => null, t);
  await assert.rejects(cancelAttendance('ann1', 'u1'), { message: 'Session not found for this date' });
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1' }), t);
  replace(prisma.attendance, 'deleteMany', async () => ({ count: 0 }), t);
  await assert.rejects(cancelAttendance('ann1', 'u1'), { message: 'Attendance record not found for cancellation', status: 404 });
});

test('sessionSummary returns all members absent when no session exists and applies paging/search', async (t) => {
  let sessionQuery: any;
  let absentQuery: any;
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async (arg) => { sessionQuery = arg; return null; }, t);
  replace(prisma.user, 'count', async () => 7, t);
  replace(prisma.user, 'findMany', async (arg) => { absentQuery = arg; return [{ id: 'u1', name: 'A', email: 'a@example.com' }]; }, t);
  const result = await sessionSummary({ announcementId: 'ann1', date: '2025-05-10', page: 2, limit: 3, search: 'a' } as any);
  assert.deepEqual(sessionQuery.where, { announcementId_date: { announcementId: 'ann1', date: new Date(2025, 4, 10) } });
  assert.deepEqual(result.counts, { totalMembers: 7, attended: 0, present: 0, late: 0, excused: 0, absent: 7 });
  assert.deepEqual(absentQuery, {
    where: { role: 'MEMBER', OR: [
      { name: { contains: 'a', mode: 'insensitive' } }, { email: { contains: 'a', mode: 'insensitive' } },
    ] },
    select: { id: true, name: true, email: true }, orderBy: { name: 'asc' }, take: 3, skip: 3,
  });
  assert.deepEqual(result.presentUsers, []);
  assert.deepEqual(result.absentUsers, [{ id: 'u1', name: 'A', email: 'a@example.com' }]);
});

test('sessionSummary counts statuses and unique attendees and separates absent users', async (t) => {
  const session = { id: 's1', date: new Date(2025, 4, 10), state: 'OPEN', openedAt: null, closedAt: null };
  let attendanceQuery: any;
  const userQueries: any[] = [];
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async () => session, t);
  replace(prisma.user, 'count', async () => 5, t);
  replace(prisma.attendance, 'findMany', async (arg) => { attendanceQuery = arg; return [
    { userId: 'u1', status: 'PRESENT' }, { userId: 'u2', status: 'LATE' },
    { userId: 'u3', status: 'EXCUSED' }, { userId: 'u1', status: 'PRESENT' },
  ]; }, t);
  replace(prisma.user, 'findMany', async (arg) => {
    userQueries.push(arg);
    return userQueries.length === 1
      ? [{ id: 'u1', name: 'Alice', email: 'a@example.com' }, { id: 'u2', name: 'Bob', email: 'b@example.com' }, { id: 'u3', name: 'Carol', email: 'c@example.com' }]
      : [{ id: 'u4', name: 'Dora', email: 'd@example.com' }, { id: 'u5', name: 'Eli', email: 'e@example.com' }];
  }, t);
  const result = await sessionSummary({ announcementId: 'ann1', page: 1, limit: 20 } as any);
  assert.deepEqual(attendanceQuery, { where: { sessionId: 's1' }, select: { userId: true, status: true } });
  assert.deepEqual(result.counts, { totalMembers: 5, attended: 3, present: 2, late: 1, excused: 1, absent: 2 });
  assert.deepEqual(result.presentUsers.map((u: any) => u.attendanceStatus), ['PRESENT', 'LATE', 'EXCUSED']);
  assert.deepEqual(userQueries[0]?.where, { id: { in: ['u1', 'u2', 'u3'] } });
  assert.deepEqual(userQueries[1]?.where, { role: 'MEMBER', id: { notIn: ['u1', 'u2', 'u3'] } });
  assert.equal(result.absentUsers.length, 2);
});

test('sessionSummary rejects missing announcement and malformed date', async (t) => {
  replace(prisma.announcement, 'findUnique', async () => null, t);
  await assert.rejects(sessionSummary({ announcementId: 'missing' } as any), { message: 'Announcement not found', status: 404 });
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  await assert.rejects(sessionSummary({ announcementId: 'ann1', date: '2025-02-30' } as any), { message: 'Invalid date format. Use YYYY or YYYY-MM or YYYY-MM-DD', status: 400 });
});

test('exportSessionCsv emits status rows and escapes comma, quote and newline', async (t) => {
  freezeTime(t);
  replace(prisma.announcement, 'findUnique', async () => announcement(), t);
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1', date: new Date(2025, 4, 10), state: 'OPEN', openedAt: null, closedAt: null }), t);
  replace(prisma.user, 'count', async () => 4, t);
  replace(prisma.attendance, 'findMany', async () => [
    { userId: 'u1', status: 'PRESENT' }, { userId: 'u2', status: 'LATE' }, { userId: 'u3', status: 'EXCUSED' },
  ], t);
  let usersQueryCount = 0;
  replace(prisma.user, 'findMany', async () => ++usersQueryCount === 1 ? [
    { id: 'u1', name: 'Alice, A', email: 'a@example.com' },
    { id: 'u2', name: 'Bob "B"', email: 'b@example.com' },
    { id: 'u3', name: 'Carol\nC', email: 'c@example.com' },
  ] : [{ id: 'u4', name: 'Dora', email: 'd@example.com' }], t);
  assert.equal(await exportSessionCsv({ announcementId: 'ann1' } as any), [
    'type,name,email',
    'present,"Alice, A",a@example.com',
    'late,"Bob ""B""",b@example.com',
    'excused,"Carol\nC",c@example.com',
    'absent,Dora,d@example.com',
  ].join('\n'));
});

test('createSession creates linked TRAINING announcement and state/date mapping', async (t) => {
  let announcementArgs: any;
  let sessionArgs: any;
  replace(prisma.announcement, 'create', async (arg) => { announcementArgs = arg; return { id: 'ann-new' }; }, t);
  replace(prisma.attendanceSession, 'create', async (arg) => { sessionArgs = arg; return { id: 's-new' }; }, t);
  await createSession({ title: 'Morning Practice', date: '2025-05-10T10:00:00.000Z', status: 'CLOSED' }, 'admin1');
  assert.deepEqual(announcementArgs, { data: {
    title: 'Morning Practice', type: 'TRAINING', datetime: new Date('2025-05-10T10:00:00.000Z'),
    location: 'TBA', content: 'Attendance Session', createdBy: 'admin1',
  } });
  assert.deepEqual(sessionArgs, { data: {
    announcementId: 'ann-new', date: new Date(2025, 4, 10), state: 'CLOSED', openedAt: null, closedAt: null,
  } });
});

test('listSessions maps status/search/sort/paging into related query and summary shape', async (t) => {
  let query: any;
  let count: any;
  replace(prisma.attendanceSession, 'findMany', async (arg) => { query = arg; return [{
    id: 's1', announcementId: 'ann1', date: new Date(2025, 4, 10), state: 'OPEN', openedAt: null, closedAt: null,
    announcement: { title: 'Practice', datetime: new Date('2025-05-10T10:00:00Z') }, _count: { items: 4 },
  }]; }, t);
  replace(prisma.attendanceSession, 'count', async (arg) => { count = arg; return 1; }, t);
  const result = await listSessions({ page: '2', limit: '5', search: 'pract', filter: JSON.stringify({ status: ['OPEN', 'CLOSED'] }), sort: 'title:asc' });
  assert.deepEqual(query.where, {
    announcement: { title: { contains: 'pract', mode: 'insensitive' } }, state: { in: ['OPEN', 'CLOSED'] },
  });
  assert.equal(query.skip, 5);
  assert.equal(query.take, 5);
  assert.deepEqual(query.orderBy, { announcement: { title: 'asc' } });
  assert.deepEqual(count, { where: query.where });
  assert.deepEqual(result.items[0], {
    id: 's1', announcementId: 'ann1', title: 'Practice', date: new Date('2025-05-10T10:00:00Z'),
    startTime: null, endTime: null, status: 'OPEN', _count: { attendances: 4 },
  });
});

test('getSessionDetail validates IDs and returns announcement-mapped session fields', async (t) => {
  let args: any;
  const session = { id: '507f1f77bcf86cd799439011', announcementId: 'a1', date: new Date(2025, 4, 10), state: 'OPEN', openedAt: null, closedAt: null, announcement: { title: 'Practice', datetime: new Date('2025-05-10T10:00:00Z') } };
  replace(prisma.attendanceSession, 'findUnique', async (arg) => { args = arg; return session; }, t);
  await assert.rejects(getSessionDetail('bad'), { message: 'Attendance Session not found', status: 404 });
  assert.deepEqual(await getSessionDetail(session.id), {
    id: session.id, announcementId: 'a1', title: 'Practice', date: session.announcement.datetime,
    state: 'OPEN', openedAt: null, closedAt: null,
  });
  assert.equal(args.where.id, session.id);
});

test('updateSession applies paired session and announcement updates transactionally', async (t) => {
  freezeTime(t);
  let txArgs: any[] = [];
  let transactionArgs: any;
  const session = { id: 's1', announcementId: 'a1', state: 'OPEN', openedAt: null };
  replace(prisma.attendanceSession, 'findUnique', async () => session, t);
  replace(prisma.attendanceSession, 'update', async (arg) => { txArgs = txArgs || []; txArgs.push(['session', arg]); return { id: 's1' }; }, t);
  replace(prisma.announcement, 'update', async (arg) => { txArgs = txArgs || []; txArgs.push(['announcement', arg]); return {}; }, t);
  replace(prisma, '$transaction', async (arg) => { transactionArgs = arg; return Promise.all(arg); }, t);
  await updateSession('s1', { title: 'Updated', date: '2025-05-11T10:00:00.000Z', status: 'OPEN' });
  assert.equal(transactionArgs.length, 2);
  assert.deepEqual(txArgs, [
    ['session', { where: { id: 's1' }, data: { date: new Date(2025, 4, 11), openedAt: new Date('2025-05-10T10:00:00.000Z'), state: 'OPEN' } }],
    ['announcement', { where: { id: 'a1' }, data: { datetime: new Date('2025-05-11T10:00:00.000Z'), title: 'Updated' } }],
  ]);
});

test('removeSession deletes attendances, session, then announcement in a transaction', async (t) => {
  const calls: string[] = [];
  replace(prisma.attendanceSession, 'findUnique', async () => ({ id: 's1', announcementId: 'a1' }), t);
  const tx = {
    attendance: { deleteMany: async (arg: unknown) => { calls.push(`attendance:${JSON.stringify(arg)}`); } },
    attendanceSession: { delete: async (arg: unknown) => { calls.push(`session:${JSON.stringify(arg)}`); } },
    announcement: { delete: async (arg: unknown) => { calls.push(`announcement:${JSON.stringify(arg)}`); } },
  };
  replace(prisma, '$transaction', async (callback: any) => callback(tx), t);
  assert.deepEqual(await removeSession('s1'), { message: 'Session and related data deleted successfully' });
  assert.deepEqual(calls, [
    'attendance:{"where":{"sessionId":"s1"}}', 'session:{"where":{"id":"s1"}}', 'announcement:{"where":{"id":"a1"}}',
  ]);
});

test('removeSession reports a missing session and listMemberSessions filters future open sessions', async (t) => {
  replace(prisma.attendanceSession, 'findUnique', async () => null, t);
  await assert.rejects(removeSession('missing'), { message: 'Session not found', status: 404 });
  freezeTime(t);
  let query: any;
  replace(prisma.attendanceSession, 'findMany', async (arg) => {
    query = arg;
    return [
      { announcementId: 'a1', announcement: { id: 'a1', title: 'Practice', datetime: new Date('2025-05-11T10:00:00Z'), location: 'Court' }, items: [{ status: 'PRESENT' }] },
      { announcementId: 'a2', announcement: null, items: [] },
      { announcementId: 'a3', announcement: { id: 'a3', title: 'Future', datetime: new Date('2025-05-12T10:00:00Z'), location: 'Hall' }, items: [{ status: 'LATE' }] },
    ];
  }, t);
  assert.deepEqual(await listMemberSessions('u1'), [
    { id: 'a1', title: 'Practice', date: new Date('2025-05-11T10:00:00Z'), location: 'Court', isUserAttended: true },
    { id: 'a3', title: 'Future', date: new Date('2025-05-12T10:00:00Z'), location: 'Hall', isUserAttended: false },
  ]);
  assert.deepEqual(query.where, { state: 'OPEN', date: { gte: new Date(2025, 4, 10) } });
  assert.deepEqual(query.orderBy, { date: 'asc' });
});
