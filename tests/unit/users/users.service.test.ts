import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../../../src/modules/prisma/client.js';
import { listUsers, getUser, updateUserRole, updateUser, removeUser, removeUserAuto } from '../../../src/modules/users/users.service.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

test('listUsers builds search, role filter and pagination query and removes sensitive fields', async (t) => {
  let listArgs: any;
  let countArgs: any;
  replace(prisma.user, 'findMany', async (arg) => { listArgs = arg; return [{
    id: 'u1', name: 'A', email: 'a@example.com', role: 'MEMBER', avatarUrl: null, password: 'secret',
  }]; }, t);
  replace(prisma.user, 'count', async (arg) => { countArgs = arg; return 21; }, t);

  const result = await listUsers({ page: '2', limit: '10', search: ' A ', filter: JSON.stringify({ role: ['ADMIN', 'MEMBER'] }), sort: 'name:asc' });

  assert.equal(listArgs.skip, 10);
  assert.equal(listArgs.take, 10);
  assert.deepEqual(listArgs.orderBy, { name: 'asc' });
  assert.deepEqual(listArgs.where, {
    role: { in: ['ADMIN', 'MEMBER'] },
    OR: [
      { name: { contains: 'A', mode: 'insensitive' } },
      { email: { contains: 'A', mode: 'insensitive' } },
    ],
  });
  assert.deepEqual(countArgs, { where: listArgs.where });
  assert.deepEqual(result, {
    items: [{ id: 'u1', name: 'A', email: 'a@example.com', role: 'MEMBER', avatarUrl: null }],
    meta: { total: 21, page: 2, limit: 10, pages: 3 },
  });
});

test('listUsers uses default ordering and returns empty pagination correctly', async (t) => {
  let listArgs: any;
  replace(prisma.user, 'findMany', async (arg) => { listArgs = arg; return []; }, t);
  replace(prisma.user, 'count', async () => 0, t);
  assert.deepEqual(await listUsers({}), { items: [], meta: { total: 0, page: 1, limit: 10, pages: 0 } });
  assert.deepEqual(listArgs.orderBy, { createdAt: 'desc' });
  assert.equal(listArgs.skip, 0);
});

test('listUsers propagates query failures', async (t) => {
  const failure = new Error('query failed');
  replace(prisma.user, 'findMany', async () => { throw failure; }, t);
  replace(prisma.user, 'count', async () => 0, t);
  await assert.rejects(listUsers({}), failure);
});

test('getUser returns a safe projection and reports missing users', async (t) => {
  const fullUser = { id: 'u1', name: 'Member', email: 'm@example.com', role: 'MEMBER', avatarUrl: null, password: 'secret' };
  let args: any;
  replace(prisma.user, 'findUnique', async (arg) => { args = arg; return fullUser; }, t);
  assert.deepEqual(await getUser('u1'), { id: 'u1', name: 'Member', email: 'm@example.com', role: 'MEMBER', avatarUrl: null });
  assert.deepEqual(args, { where: { id: 'u1' } });

  replace(prisma.user, 'findUnique', async () => null, t);
  await assert.rejects(getUser('missing'), { message: 'User not found', status: 404 });
});

test('updateUserRole writes the requested role and returns a safe user', async (t) => {
  let args: any;
  replace(prisma.user, 'update', async (arg) => { args = arg; return { id: 'u1', name: 'Member', email: 'm@example.com', role: 'ADMIN', password: 'secret' }; }, t);
  assert.deepEqual(await updateUserRole('u1', 'ADMIN'), { id: 'u1', name: 'Member', email: 'm@example.com', role: 'ADMIN' });
  assert.deepEqual(args, { where: { id: 'u1' }, data: { role: 'ADMIN' } });
});

test('updateUser checks existing and duplicate email before writing profile changes', async (t) => {
  const calls: any[] = [];
  replace(prisma.user, 'findUnique', async (arg) => {
    calls.push(arg);
    return calls.length === 1 ? { email: 'old@example.com' } : null;
  }, t);
  let updateArgs: any;
  replace(prisma.user, 'update', async (arg) => { updateArgs = arg; return {
    id: 'u1', name: 'New', email: 'new@example.com', role: 'MEMBER', avatarUrl: null, password: 'secret',
  }; }, t);

  const result = await updateUser('u1', { name: 'New', email: 'new@example.com', avatarUrl: null });
  assert.deepEqual(calls, [{ where: { id: 'u1' } }, { where: { email: 'new@example.com' } }]);
  assert.deepEqual(updateArgs, { where: { id: 'u1' }, data: { name: 'New', email: 'new@example.com', role: undefined, avatarUrl: null } });
  assert.deepEqual(result, { id: 'u1', name: 'New', email: 'new@example.com', role: 'MEMBER', avatarUrl: null });
});

test('updateUser rejects missing users and conflicting email without updating', async (t) => {
  let updates = 0;
  replace(prisma.user, 'findUnique', async () => null, t);
  replace(prisma.user, 'update', async () => { updates++; return {}; }, t);
  await assert.rejects(updateUser('missing', { name: 'New' }), { message: 'User not found', status: 404 });

  let lookups = 0;
  replace(prisma.user, 'findUnique', async () => ++lookups === 1 ? { email: 'old@example.com' } : { id: 'other' }, t);
  await assert.rejects(updateUser('u1', { email: 'taken@example.com' }), { message: 'Email already in use', status: 409 });
  assert.equal(updates, 0);
});

function transactionHarness(t: any, counts: [number, number, number], actions: Record<string, (..._args: any[]) => unknown> = {}) {
  const calls: { method: string; args: any[] }[] = [];
  const delegate = (method: string) => async (...args: any[]) => {
    calls.push({ method, args });
    if (actions[method]) return actions[method](...args);
    if (method.endsWith('.count')) return counts.shift();
    if (method === 'findMany') return [];
    return {};
  };
  const tx: any = {
    attendance: { count: delegate('attendance.count'), deleteMany: delegate('attendance.deleteMany') },
    announcement: { count: delegate('announcement.count'), updateMany: delegate('announcement.updateMany'), findMany: delegate('announcement.findMany'), deleteMany: delegate('announcement.deleteMany') },
    blog: { count: delegate('blog.count'), updateMany: delegate('blog.updateMany'), deleteMany: delegate('blog.deleteMany') },
    attendanceSession: { findMany: delegate('attendanceSession.findMany'), deleteMany: delegate('attendanceSession.deleteMany') },
    user: { delete: delegate('user.delete') },
  };
  replace(prisma, '$transaction', async (callback: (tx: any) => unknown) => callback(tx), t);
  return { calls };
}

test('removeUser refuses related records unless forced or reassigned', async (t) => {
  replace(prisma.user, 'findUnique', async () => ({ id: 'u1' }), t);
  const { calls } = transactionHarness(t, [2, 1, 0]);
  await assert.rejects(removeUser('u1'), (error: any) => {
    assert.equal(error.status, 409);
    assert.deepEqual(error.details, { attendances: 2, announcements: 1, blogs: 0 });
    return true;
  });
  assert.equal(calls.some((call) => call.method === 'user.delete'), false);
});

test('removeUser validates user and reassignment target before transaction', async (t) => {
  let lookups = 0;
  replace(prisma.user, 'findUnique', async () => ++lookups <= 2 ? { id: 'u1' } : null, t);
  await assert.rejects(removeUser('u1', { reassignTo: 'u1' }), { message: 'Cannot reassign to the same user', status: 400 });
  await assert.rejects(removeUser('u1', { reassignTo: 'missing' }), { message: 'Reassign target not found', status: 400 });
  lookups = 100;
  await assert.rejects(removeUser('missing'), { message: 'User not found', status: 404 });
});

test('removeUser reassigns owned content and deletes attendances and user transactionally', async (t) => {
  replace(prisma.user, 'findUnique', async () => ({ id: 'u1' }), t);
  const { calls } = transactionHarness(t, [3, 2, 1]);
  assert.deepEqual(await removeUser('u1', { reassignTo: 'admin' }), {});
  assert.deepEqual(calls.map((call) => call.method), [
    'attendance.count', 'announcement.count', 'blog.count', 'attendance.deleteMany',
    'announcement.updateMany', 'blog.updateMany', 'user.delete',
  ]);
  assert.deepEqual(calls[4]?.args[0], { where: { createdBy: 'u1' }, data: { createdBy: 'admin' } });
  assert.deepEqual(calls[6]?.args[0], { where: { id: 'u1' } });
});

test('removeUser force-cleans linked sessions, attendances, announcements and blogs', async (t) => {
  replace(prisma.user, 'findUnique', async () => ({ id: 'u1' }), t);
  const { calls } = transactionHarness(t, [1, 1, 1], {
    'announcement.findMany': async () => [{ id: 'ann1' }],
    'attendanceSession.findMany': async () => [{ id: 'session1' }],
  });
  await removeUser('u1', { force: true });
  assert.deepEqual(calls.map((call) => call.method), [
    'attendance.count', 'announcement.count', 'blog.count', 'attendance.deleteMany',
    'announcement.findMany', 'attendanceSession.findMany', 'attendance.deleteMany',
    'attendanceSession.deleteMany', 'announcement.deleteMany', 'blog.deleteMany', 'user.delete',
  ]);
});

test('removeUserAuto prevents self deletion, validates actor/target and returns cleanup counts', async (t) => {
  await assert.rejects(removeUserAuto('same', 'same'), { message: 'You cannot delete yourself', status: 400 });
  let userLookups: any[] = [];
  replace(prisma.user, 'findUnique', async (arg) => {
    userLookups.push(arg);
    return userLookups.length === 1 ? { id: 'admin' } : { id: 'member' };
  }, t);
  const { calls } = transactionHarness(t, [2, 3, 4]);
  assert.deepEqual(await removeUserAuto('member', 'admin'), {
    removedAttendances: 2,
    reassigned: { announcements: 3, blogs: 4, toUserId: 'admin' },
  });
  assert.deepEqual(userLookups, [{ where: { id: 'admin' } }, { where: { id: 'member' } }]);
  assert.deepEqual(calls.map((call) => call.method), [
    'attendance.count', 'announcement.count', 'blog.count', 'attendance.deleteMany',
    'announcement.updateMany', 'blog.updateMany', 'user.delete',
  ]);
});

test('removeUserAuto reports missing actor and target', async (t) => {
  replace(prisma.user, 'findUnique', async () => null, t);
  await assert.rejects(removeUserAuto('member', 'admin'), { message: 'Actor not found', status: 400 });
  let calls = 0;
  replace(prisma.user, 'findUnique', async () => ++calls === 1 ? { id: 'admin' } : null, t);
  await assert.rejects(removeUserAuto('member', 'admin'), { message: 'User not found', status: 404 });
});
