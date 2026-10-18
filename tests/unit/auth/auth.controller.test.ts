import assert from 'node:assert/strict';
import test from 'node:test';

import bcrypt from 'bcryptjs';

import { authRouter } from '../../../src/modules/auth/auth.controller.js';
import { signRefreshToken } from '../../../src/modules/common/auth/jwt.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replaceMethod(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler(path: string, method: string, index = -1) {
  const route = (authRouter as any).stack.find((layer: any) =>
    layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `missing ${method.toUpperCase()} ${path} route`);
  return route.route.stack.at(index).handle;
}

function response() {
  const state: any = { cookies: [], cleared: [], body: undefined, statusCode: 200 };
  const res: any = {
    cookie: (...args: unknown[]) => { state.cookies.push(args); return res; },
    clearCookie: (...args: unknown[]) => { state.cleared.push(args); return res; },
    json: (body: unknown) => { state.body = body; return res; },
    status: (code: number) => { state.statusCode = code; return res; },
  };
  return { res, state };
}

async function waitForResponse(handler: any, req: unknown, res: any, next: (error: unknown) => void) {
  await new Promise<void>((resolve) => {
    const originalJson = res.json;
    res.json = (body: unknown) => { originalJson(body); resolve(); return res; };
    handler(req, res, (error: unknown) => { next(error); resolve(); });
  });
}

test('sign-up route validates input and returns access token plus safe user with refresh cookie', async (t) => {
  const user = {
    id: 'u-1', name: 'Zidan', email: 'zidan@example.com', role: 'MEMBER', password: 'hashed',
  };
  replaceMethod(prisma.user, 'findUnique', async () => null, t);
  replaceMethod(prisma.user, 'create', async () => user, t);
  replaceMethod(bcrypt, 'hash', async () => 'hashed', t);
  const { res, state } = response();
  const errors: unknown[] = [];

  await routeHandler('/sign-up', 'post')(
    { body: { name: 'Zidan', email: user.email, password: 'secret1' } }, res,
    (error: unknown) => errors.push(error),
  );

  assert.deepEqual(errors, []);
  assert.equal(state.body.success, true);
  assert.deepEqual(state.body.data.user, { id: user.id, name: user.name, email: user.email, role: user.role });
  assert.equal(typeof state.body.data.accessToken, 'string');
  assert.equal(state.cookies[0][0], 'refreshToken');
  assert.equal(typeof state.cookies[0][1], 'string');
  assert.equal(state.cookies[0][2].httpOnly, true);
});

test('sign-up route forwards validation failure without invoking Prisma', async (t) => {
  let queried = false;
  replaceMethod(prisma.user, 'findUnique', async () => { queried = true; return null; }, t);
  const { res } = response();
  const errors: any[] = [];

  await routeHandler('/sign-up', 'post')({ body: { name: 'x', email: 'bad', password: 'short' } }, res,
    (error: unknown) => errors.push(error));

  assert.equal(queried, false);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
});

test('refresh route rejects a missing refresh cookie', async () => {
  const { res } = response();
  const errors: any[] = [];
  await routeHandler('/refresh', 'post')({ cookies: {} }, res, (error: unknown) => errors.push(error));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Unauthorized');
  assert.equal(errors[0].status, 401);
});

test('sign-in route maps successful Passport authentication to token and safe user response', async (t) => {
  const user = { id: 'u1', name: 'Member', email: 'member@example.com', role: 'MEMBER' as const, password: 'hash' };
  replaceMethod(prisma.user, 'findUnique', async () => user, t);
  replaceMethod(bcrypt, 'compare', async () => true, t);
  const { res, state } = response();
  const errors: unknown[] = [];
  await waitForResponse(routeHandler('/sign-in', 'post'), { body: { email: user.email, password: 'secret1' } }, res,
    (error: unknown) => errors.push(error));
  assert.deepEqual(errors, []);
  assert.equal(state.body.success, true);
  assert.deepEqual(state.body.data.user, { id: user.id, name: user.name, email: user.email, role: user.role });
  assert.equal(typeof state.body.data.accessToken, 'string');
  assert.equal(state.cookies[0][0], 'refreshToken');
});

test('sign-in route rejects invalid DTO and failed credentials', async (t) => {
  const { res: invalidRes } = response();
  const invalidErrors: any[] = [];
  await waitForResponse(routeHandler('/sign-in', 'post'), { body: { email: 'bad', password: 'x' } }, invalidRes,
    (error: unknown) => invalidErrors.push(error));
  assert.equal(invalidErrors[0]?.message, 'Validation error');
  assert.equal(invalidErrors[0]?.status, 400);

  replaceMethod(prisma.user, 'findUnique', async () => ({ id: 'u1', role: 'MEMBER', password: 'hash' }), t);
  replaceMethod(bcrypt, 'compare', async () => false, t);
  const { res } = response();
  const errors: any[] = [];
  await waitForResponse(routeHandler('/sign-in', 'post'), { body: { email: 'm@example.com', password: 'secret1' } }, res,
    (error: unknown) => errors.push(error));
  assert.equal(errors[0]?.message, 'Invalid credentials');
  assert.equal(errors[0]?.status, 401);
});

test('refresh route verifies signed refresh token and issues rotated credentials', async (t) => {
  const user = { id: 'u1', name: 'Member', email: 'member@example.com', role: 'MEMBER' as const };
  replaceMethod(prisma.user, 'findUnique', async () => user, t);
  const { res, state } = response();
  const errors: unknown[] = [];
  await routeHandler('/refresh', 'post')({ cookies: { refreshToken: signRefreshToken({ sub: 'u1', role: 'ADMIN' }) } }, res,
    (error: unknown) => errors.push(error));
  assert.deepEqual(errors, []);
  assert.deepEqual(state.body.data.user, user);
  assert.equal(typeof state.body.data.accessToken, 'string');
  assert.equal(state.cookies[0][0], 'refreshToken');
});

test('profile route rejects empty updates and maps a valid update to the authenticated subject', async (t) => {
  const { res: invalidRes, state: invalidState } = response();
  await routeHandler('/me', 'patch')({ user: { sub: 'u1' }, body: {} }, invalidRes, (error: unknown) => assert.fail(String(error)));
  assert.equal(invalidState.statusCode, 400);

  const updated = { id: 'u1', name: 'New Name', email: 'm@example.com', role: 'MEMBER', avatarUrl: null, createdAt: new Date('2025-01-01T00:00:00Z') };
  let args: any;
  replaceMethod(prisma.user, 'update', async (arg) => { args = arg; return updated; }, t);
  const { res, state } = response();
  await routeHandler('/me', 'patch')({ user: { sub: 'u1' }, body: { name: 'New Name' } }, res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(args.where.id, 'u1');
  assert.deepEqual(state.body.data, updated);
});

test('logout clears the refresh cookie at the root path', async () => {
  const { res, state } = response();
  await routeHandler('/logout', 'delete')({}, res, () => assert.fail('logout should not call next'));
  assert.deepEqual(state.cleared, [['refreshToken', { path: '/' }]]);
  assert.deepEqual(state.body, { success: true, data: { message: 'Logged out successfully' } });
});

test('me route returns only public user fields for authenticated identity', async (t) => {
  const user = {
    id: 'u-1', name: 'Member', email: 'member@example.com', role: 'MEMBER', avatarUrl: null, password: 'secret',
  };
  let query: unknown;
  replaceMethod(prisma.user, 'findUnique', async (arg) => { query = arg; return user; }, t);
  const { res, state } = response();

  await routeHandler('/me', 'get', -1)({ user: { sub: user.id } }, res, (error: unknown) => assert.fail(String(error)));

  assert.deepEqual(query, { where: { id: user.id } });
  assert.deepEqual(state.body.data, {
    id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl,
  });
  assert.equal('password' in state.body.data, false);
});
