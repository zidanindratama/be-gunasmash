import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';

import { passport } from '../../../src/modules/auth/passport-local.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replaceMethod(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function verifyStrategy() {
  return (passport as any)._strategies.local._verify as (
    email: string,
    password: string,
    done: (error: unknown, user?: unknown) => void,
  ) => Promise<void>;
}

test('local strategy returns a safe identity after matching credentials', async (t) => {
  const storedUser = { id: 'u-1', role: 'MEMBER', password: 'hash' };
  let query: unknown;
  replaceMethod(prisma.user, 'findUnique', async (arg) => { query = arg; return storedUser; }, t);
  let compareArgs: unknown[] = [];
  replaceMethod(bcrypt, 'compare', async (...args) => { compareArgs = args; return true; }, t);

  const result = await new Promise<{ error: unknown; user?: unknown }>((resolve) => {
    void verifyStrategy()('member@example.com', 'secret1', (error, user) => resolve({ error, user }));
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.user, { id: storedUser.id, role: storedUser.role });
  assert.deepEqual(query, { where: { email: 'member@example.com' } });
  assert.deepEqual(compareArgs, ['secret1', storedUser.password]);
});

test('local strategy rejects an unknown email without comparing passwords', async (t) => {
  replaceMethod(prisma.user, 'findUnique', async () => null, t);
  let compared = false;
  replaceMethod(bcrypt, 'compare', async () => { compared = true; return true; }, t);

  const result = await new Promise<{ error: unknown; user?: unknown }>((resolve) => {
    void verifyStrategy()('unknown@example.com', 'secret1', (error, user) => resolve({ error, user }));
  });

  assert.equal(result.error, null);
  assert.equal(result.user, false);
  assert.equal(compared, false);
});

test('local strategy rejects an incorrect password', async (t) => {
  replaceMethod(prisma.user, 'findUnique', async () => ({ id: 'u-1', role: 'MEMBER', password: 'hash' }), t);
  replaceMethod(bcrypt, 'compare', async () => false, t);

  const result = await new Promise<{ error: unknown; user?: unknown }>((resolve) => {
    void verifyStrategy()('member@example.com', 'wrong-password', (error, user) => resolve({ error, user }));
  });
  assert.equal(result.error, null);
  assert.equal(result.user, false);
});

test('local strategy forwards Prisma failures to Passport', async (t) => {
  const failure = new Error('database unavailable');
  replaceMethod(prisma.user, 'findUnique', async () => { throw failure; }, t);

  const result = await new Promise<{ error: unknown; user?: unknown }>((resolve) => {
    void verifyStrategy()('member@example.com', 'secret1', (error, user) => resolve({ error, user }));
  });
  assert.equal(result.error, failure);
  assert.equal(result.user, undefined);
});

test('local strategy forwards bcrypt comparison failures to Passport', async (t) => {
  replaceMethod(prisma.user, 'findUnique', async () => ({ id: 'u1', role: 'MEMBER', password: 'hash' }), t);
  const failure = new Error('compare failed');
  replaceMethod(bcrypt, 'compare', async () => { throw failure; }, t);
  const result = await new Promise<{ error: unknown; user?: unknown }>((resolve) => {
    void verifyStrategy()('member@example.com', 'secret1', (error, user) => resolve({ error, user }));
  });
  assert.equal(result.error, failure);
  assert.equal(result.user, undefined);
});
