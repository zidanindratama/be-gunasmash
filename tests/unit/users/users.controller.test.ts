import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';

import { prisma } from '../../../src/modules/prisma/client.js';
import { usersRouter } from '../../../src/modules/users/users.controller.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler(path: string, method: string) {
  const route = (usersRouter as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `missing ${method.toUpperCase()} ${path} route`);
  return route.route.stack.at(-1).handle;
}

function response() {
  const state: any = { body: undefined, statusCode: 200, headers: {}, attachmentName: undefined, sent: undefined };
  const res: any = {
    json: (body: unknown) => { state.body = body; return res; },
    status: (code: number) => { state.statusCode = code; return res; },
    header: (key: string, value: string) => { state.headers[key] = value; return res; },
    attachment: (filename: string) => { state.attachmentName = filename; return res; },
    send: (body: unknown) => { state.sent = body; return res; },
  };
  return { res, state };
}

test('CSV import reports missing file through next', async () => {
  const errors: any[] = [];
  const { res } = response();
  await routeHandler('/import', 'post')({}, res, (error: unknown) => errors.push(error));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'File required');
  assert.equal(errors[0].status, 400);
});

test('user routes validate Mongo IDs and role DTOs before calling Prisma', async (t) => {
  let writes = 0;
  replace(prisma.user, 'update', async () => { writes++; return { id: '507f1f77bcf86cd799439011', name: 'A', email: 'a@example.com', role: 'ADMIN' }; }, t);
  const invalidIdErrors: unknown[] = [];
  await routeHandler('/:id/role', 'patch')({ params: { id: 'bad' }, body: { role: 'ADMIN' } }, response().res,
    (error: unknown) => invalidIdErrors.push(error));
  assert.equal(invalidIdErrors.length, 1);
  assert.equal(writes, 0);

  const invalidRoleErrors: unknown[] = [];
  await routeHandler('/:id/role', 'patch')({ params: { id: '507f1f77bcf86cd799439011' }, body: { role: 'OWNER' } }, response().res,
    (error: unknown) => invalidRoleErrors.push(error));
  assert.equal(invalidRoleErrors.length, 1);
  assert.equal(writes, 0);
});

test('delete user route requires actor identity before invoking deletion service', async (t) => {
  let lookups = 0;
  replace(prisma.user, 'findUnique', async () => { lookups++; return null; }, t);
  const { res, state } = response();
  await routeHandler('/:id', 'delete')({ params: { id: '507f1f77bcf86cd799439011' }, user: {} }, res, () => assert.fail('should map missing actor locally'));
  assert.equal(state.statusCode, 401);
  assert.deepEqual(state.body, { success: false, error: { message: 'Unauthorized' } });
  assert.equal(lookups, 0);
});

test('user detail/update routes map validated identifiers and sanitized service data', async (t) => {
  const id = '507f1f77bcf86cd799439011';
  const record = { id, name: 'Member', email: 'm@example.com', role: 'MEMBER', avatarUrl: null, password: 'secret' };
  let findArgs: any;
  replace(prisma.user, 'findUnique', async (arg) => { findArgs = arg; return record; }, t);
  const detail = response();
  await routeHandler('/:id', 'get')({ params: { id } }, detail.res, (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(findArgs, { where: { id } });
  assert.equal('password' in detail.state.body.data, false);

  let updateArgs: any;
  replace(prisma.user, 'findUnique', async () => ({ email: record.email }), t);
  replace(prisma.user, 'update', async (arg) => { updateArgs = arg; return { ...record, name: 'Updated' }; }, t);
  const updated = response();
  await routeHandler('/:id', 'patch')({ params: { id }, body: { name: 'Updated' } }, updated.res,
    (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(updateArgs.data, { name: 'Updated', email: undefined, role: undefined, avatarUrl: undefined });
  assert.equal(updated.state.body.data.name, 'Updated');
});

test('delete user route maps service status errors to an HTTP response', async (t) => {
  let lookups = 0;
  replace(prisma.user, 'findUnique', async () => ++lookups === 1 ? { id: 'admin' } : null, t);
  const { res, state } = response();
  await routeHandler('/:id', 'delete')({ params: { id: '507f1f77bcf86cd799439011' }, user: { sub: 'admin' } }, res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(state.statusCode, 404);
  assert.deepEqual(state.body, { success: false, error: { message: 'User not found' } });
});

test('CSV import normalizes rows, skips invalid and duplicate entries, hashes defaults, and counts creates', async (t) => {
  const finds: any[] = [];
  const creates: any[] = [];
  const hashes: any[] = [];
  replace(prisma.user, 'findUnique', async (arg) => {
    finds.push(arg);
    return arg.where.email === 'taken@example.com' ? { id: 'existing' } : null;
  }, t);
  replace(prisma.user, 'create', async (arg) => { creates.push(arg); return { id: 'new' }; }, t);
  replace(bcrypt, 'hash', async (...args) => { hashes.push(args); return 'hashed'; }, t);
  const buffer = Buffer.from([
    'name,email,password',
    '  Alice  , ALICE@Example.com ,custompass',
    ',missing@example.com,secret',
    'Duplicate,taken@example.com,secret',
    'Bob,bob@example.com,',
  ].join('\n'));
  const { res, state } = response();
  const errors: unknown[] = [];

  await routeHandler('/import', 'post')({ file: { buffer } }, res, (error: unknown) => errors.push(error));

  assert.deepEqual(errors, []);
  assert.deepEqual(state.body, { success: true, data: { created: 2 } });
  assert.deepEqual(finds, [
    { where: { email: 'alice@example.com' } },
    { where: { email: 'taken@example.com' } },
    { where: { email: 'bob@example.com' } },
  ]);
  assert.deepEqual(hashes, [['custompass', 10], ['password123', 10]]);
  assert.deepEqual(creates, [
    { data: { name: 'Alice', email: 'alice@example.com', password: 'hashed' } },
    { data: { name: 'Bob', email: 'bob@example.com', password: 'hashed' } },
  ]);
});

test('CSV import forwards Prisma and password hashing errors', async (t) => {
  const failure = new Error('database unavailable');
  replace(prisma.user, 'findUnique', async () => { throw failure; }, t);
  const { res } = response();
  const errors: unknown[] = [];
  await routeHandler('/import', 'post')({ file: { buffer: Buffer.from('name,email\nA,a@example.com') } }, res,
    (error: unknown) => errors.push(error));
  assert.deepEqual(errors, [failure]);
});

test('CSV export emits only declared public columns with headers and attachment name', async (t) => {
  let args: any;
  replace(prisma.user, 'findMany', async (arg) => {
    args = arg;
    return [
      { id: 'u1', name: 'Alice, A', email: 'a@example.com', role: 'ADMIN', password: 'secret' },
      { id: 'u2', name: 'Bob "B"', email: 'b@example.com', role: 'MEMBER', password: 'secret' },
    ];
  }, t);
  const { res, state } = response();
  const errors: unknown[] = [];

  await routeHandler('/export/csv', 'get')({}, res, (error: unknown) => errors.push(error));

  assert.deepEqual(errors, []);
  assert.deepEqual(args, { orderBy: { createdAt: 'desc' } });
  assert.equal(state.headers['Content-Type'], 'text/csv');
  assert.equal(state.attachmentName, 'members.csv');
  assert.equal(state.sent.split('\n')[0].replace(/\r$/, ''), '"id","name","email","role"');
  assert.match(state.sent, /"u1","Alice, A","a@example.com","ADMIN"/);
  assert.match(state.sent, /"u2","Bob ""B""","b@example.com","MEMBER"/);
  assert.equal(state.sent.includes('secret'), false);
});
