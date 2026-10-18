import assert from 'node:assert/strict';
import test from 'node:test';

import { z } from 'zod';


import { authGuard, rolesGuard } from '../../../src/modules/common/auth/guards.js';
import { signAccessToken } from '../../../src/modules/common/auth/jwt.js';
import { notFound, onError } from '../../../src/modules/common/middlewares/error.js';
import { corsMiddleware } from '../../../src/modules/config/cors.js';

import type { ZodError } from 'zod';

function responseMock() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, string>(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
      return this;
    },
    getHeader(name: string) {
      return this.headers.get(name.toLowerCase());
    },
    end() {
      return this;
    },
  };
}

test('authGuard rejects missing, malformed and invalid bearer tokens', () => {
  for (const authorization of [undefined, 'Basic abc', 'Bearer ', 'Bearer a b']) {
    const req = { headers: { authorization } } as any;
    const res = responseMock();
    let calledNext = false;

    authGuard(req, res as any, () => { calledNext = true; });

    assert.equal(res.statusCode, 401);
    assert.equal(calledNext, false);
  }

  const req = { headers: { authorization: 'Bearer not-a-jwt' } } as any;
  const res = responseMock();
  authGuard(req, res as any, () => assert.fail('invalid token must not call next'));
  assert.equal(res.statusCode, 401);
  assert.match((res.body as any).error.message, /invalid or expired/i);
});

test('authGuard attaches a verified payload and calls next', () => {
  const token = signAccessToken({ sub: 'member-1', role: 'MEMBER' });
  const req = { headers: { authorization: `Bearer ${token}` } } as any;
  let calledNext = false;

  authGuard(req, responseMock() as any, () => { calledNext = true; });

  assert.equal(req.user.sub, 'member-1');
  assert.equal(req.user.role, 'MEMBER');
  assert.equal(typeof req.user.iat, 'number');
  assert.equal(calledNext, true);
});

test('rolesGuard allows configured roles and rejects missing or disallowed roles', () => {
  for (const role of ['ADMIN', 'MEMBER']) {
    const req = { user: { role } } as any;
    let calledNext = false;
    rolesGuard(['ADMIN', 'MEMBER'])(req, responseMock() as any, () => { calledNext = true; });
    assert.equal(calledNext, true);
  }

  for (const user of [undefined, {}, { role: 'UNKNOWN' }, { role: 'MEMBER' }]) {
    const res = responseMock();
    rolesGuard(['ADMIN'])({ user } as any, res as any, () => assert.fail('denied role must not call next'));
    assert.equal(res.statusCode, 403);
  }
});

test('error middleware maps validation, unique-conflict, client and unknown errors', () => {
  const zodError = z.string().min(2).safeParse('').error as ZodError;
  const cases = [
    { error: zodError, status: 400, message: 'Validation error' },
    { error: Object.assign(new Error('duplicate'), { code: 'P2002' }), status: 409, message: 'A record with this value already exists' },
    { error: Object.assign(new Error('Forbidden'), { status: 403 }), status: 403, message: 'Forbidden' },
    { error: new Error('database detail'), status: 500, message: 'Internal server error' },
  ];

  for (const { error, status, message } of cases) {
    const res = responseMock();
    onError(error, {} as any, res as any, () => {});
    assert.equal(res.statusCode, status);
    assert.equal((res.body as any).error.message, message);
  }
});

test('notFound sends the standard 404 error body', () => {
  const res = responseMock();
  notFound({} as any, res as any);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { success: false, error: { message: 'Not Found' } });
});

test('CORS allows configured origins and rejects lookalike hostnames', async () => {
  async function invoke(origin?: string) {
    const req = { method: 'GET', headers: origin ? { origin } : {} } as any;
    const res = responseMock();
    let calledNext = false;
    let error: unknown;
    await new Promise<void>((resolve) => {
      corsMiddleware(req, res as any, (err?: unknown) => {
        error = err;
        calledNext = true;
        resolve();
      });
    });
    return { res, calledNext, error };
  }

  const local = await invoke('http://localhost:3000');
  assert.equal(local.calledNext, true);
  assert.equal(local.res.getHeader('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(local.res.getHeader('access-control-allow-credentials'), 'true');

  const vercel = await invoke('https://app.vercel.app');
  assert.equal(vercel.res.getHeader('access-control-allow-origin'), 'https://app.vercel.app');

  const lookalike = await invoke('https://evilvercel.app');
  assert.equal(lookalike.res.getHeader('access-control-allow-origin'), undefined);
  const unrelated = await invoke('https://localhost.attacker.example');
  assert.equal(unrelated.res.getHeader('access-control-allow-origin'), undefined);
  const wrongPort = await invoke('http://localhost:4000');
  assert.equal(wrongPort.res.getHeader('access-control-allow-origin'), undefined);
  const wrongProtocol = await invoke('https://localhost:3000');
  assert.equal(wrongProtocol.res.getHeader('access-control-allow-origin'), undefined);
  const malformed = await invoke('not an origin');
  assert.equal(malformed.res.getHeader('access-control-allow-origin'), undefined);

  const noOrigin = await invoke();
  assert.equal(noOrigin.calledNext, true);
  assert.equal(noOrigin.error, undefined);
});
