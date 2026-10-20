import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import bcrypt from 'bcryptjs';

import { issueTokens, signUp, updateMyProfile } from '../../../src/modules/auth/auth.service.js';
import { verifyAccess, verifyRefresh } from '../../../src/modules/common/auth/jwt.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function stubMethod<T extends object>(
  t: TestContext,
  target: T,
  key: keyof T,
  implementation: (..._args: any[]) => any,
) {
  const calls: { arguments: unknown[] }[] = [];
  const original = (target as any)[key];
  (target as any)[key] = (...args: unknown[]) => {
    calls.push({ arguments: args });
    return implementation(...args);
  };
  t.after(() => { (target as any)[key] = original; });
  return {
    calls,
    callCount: () => calls.length,
  };
}

test('signUp checks email, hashes the password, creates a member and returns safe user data', async (t) => {
  const created = {
    id: '507f1f77bcf86cd799439011',
    name: 'Andi Pratama',
    email: 'andi@example.com',
    role: 'MEMBER' as const,
    password: 'hashed-password',
  };
  const findUnique = stubMethod(t, prisma.user as any, 'findUnique', async () => null);
  const hash = stubMethod(t, bcrypt as any, 'hash', async () => 'hashed-password');
  const create = stubMethod(t, prisma.user as any, 'create', async () => created);

  const result = await signUp({ name: 'Andi Pratama', email: created.email, password: 'plain-password' });

  assert.deepEqual(findUnique.calls[0]?.arguments[0], { where: { email: created.email } });
  assert.deepEqual(hash.calls[0]?.arguments, ['plain-password', 10]);
  assert.deepEqual(create.calls[0]?.arguments[0], {
    data: { name: 'Andi Pratama', email: created.email, password: 'hashed-password' },
  });
  assert.deepEqual(result.user, { id: created.id, name: created.name, email: created.email, role: 'MEMBER' });
  assert.equal('password' in result.user, false);
  assert.equal((verifyAccess(result.accessToken) as any).sub, created.id);
  assert.equal((verifyRefresh(result.refreshToken) as any).role, 'MEMBER');
});

test('signUp rejects a duplicate email before hashing or creating a user', async (t) => {
  const findUnique = stubMethod(t, prisma.user as any, 'findUnique', async () => ({ id: 'existing' }));
  const hash = stubMethod(t, bcrypt as any, 'hash', async () => 'unused');
  const create = stubMethod(t, prisma.user as any, 'create', async () => ({}) as any);

  await assert.rejects(signUp({ name: 'Member', email: 'taken@example.com', password: 'secret1' }), {
    message: 'Email already used',
    status: 409,
  });
  assert.equal(findUnique.callCount(), 1);
  assert.equal(hash.callCount(), 0);
  assert.equal(create.callCount(), 0);
});

test('signUp propagates dependency errors', async (t) => {
  const failure = new Error('database unavailable');
  stubMethod(t, prisma.user as any, 'findUnique', async () => { throw failure; });
  await assert.rejects(signUp({ name: 'Member', email: 'member@example.com', password: 'secret1' }), failure);
});

test('signUp propagates password hashing and user creation failures', async (t) => {
  const hashFailure = new Error('hash failed');
  stubMethod(t, prisma.user as any, 'findUnique', async () => null);
  stubMethod(t, bcrypt as any, 'hash', async () => { throw hashFailure; });
  await assert.rejects(signUp({ name: 'Member', email: 'm@example.com', password: 'secret1' }), hashFailure);

  const createFailure = new Error('insert failed');
  stubMethod(t, bcrypt as any, 'hash', async () => 'hashed');
  stubMethod(t, prisma.user as any, 'create', async () => { throw createFailure; });
  await assert.rejects(signUp({ name: 'Member', email: 'new@example.com', password: 'secret1' }), createFailure);
});

test('issueTokens returns current user and signs current role', async (t) => {
  const user = { id: 'user-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' as const };
  const findUnique = stubMethod(t, prisma.user as any, 'findUnique', async () => user);

  const result = await issueTokens(user.id);

  assert.deepEqual(findUnique.calls[0]?.arguments[0], { where: { id: user.id } });
  assert.deepEqual(result.user, user);
  assert.equal((verifyAccess(result.accessToken) as any).role, 'ADMIN');
});

test('issueTokens returns a 404 for an unknown user', async (t) => {
  stubMethod(t, prisma.user as any, 'findUnique', async () => null);
  await assert.rejects(issueTokens('missing-user'), { message: 'User not found', status: 404 });
});

test('updateMyProfile rejects an empty update without querying Prisma', async (t) => {
  const update = stubMethod(t, prisma.user as any, 'update', async () => ({}) as any);
  await assert.rejects(updateMyProfile('user-1', {}), { message: 'No fields provided for update', status: 400 });
  assert.equal(update.callCount(), 0);
});

test('updateMyProfile sends only profile fields and returns the selected safe fields', async (t) => {
  const user = {
    id: 'user-1',
    name: 'Updated',
    email: 'member@example.com',
    role: 'MEMBER',
    avatarUrl: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  };
  const update = stubMethod(t, prisma.user as any, 'update', async () => user);

  const result = await updateMyProfile(user.id, { name: 'Updated' });

  assert.deepEqual(update.calls[0]?.arguments[0], {
    where: { id: user.id },
    data: { name: 'Updated', avatarUrl: undefined },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, createdAt: true },
  });
  assert.deepEqual(result, user);
  assert.equal('password' in result, false);
});
