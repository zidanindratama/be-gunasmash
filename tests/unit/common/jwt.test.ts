import assert from 'node:assert/strict';
import test from 'node:test';

import {
  signAccessToken,
  signRefreshToken,
  verifyAccess,
  verifyRefresh,
} from '../../../src/modules/common/auth/jwt.js';

test('access and refresh token helpers sign and verify their expected payloads', () => {
  const payload = { sub: 'user-1', role: 'ADMIN' as const };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);

  assert.equal((verifyAccess(access) as any).sub, payload.sub);
  assert.equal((verifyAccess(access) as any).role, payload.role);
  assert.equal((verifyRefresh(refresh) as any).sub, payload.sub);
  assert.equal((verifyRefresh(refresh) as any).role, payload.role);
  assert.throws(() => verifyAccess(refresh));
  assert.throws(() => verifyRefresh(`${refresh.slice(0, -1)}x`));
});
