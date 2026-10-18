import assert from 'node:assert/strict';
import test from 'node:test';

import { fail, ok } from '../../../src/modules/common/http/response.js';

test('ok wraps its payload in the standard success envelope', () => {
  const payload = { id: 'user-1', role: 'MEMBER' };

  assert.deepEqual(ok(payload), { success: true, data: payload });
});

test('fail returns the standard error envelope and optional metadata', () => {
  assert.deepEqual(fail('Not found'), {
    success: false,
    error: { message: 'Not found' },
  });
  assert.deepEqual(fail('Conflict', { field: 'email' }), {
    success: false,
    error: { message: 'Conflict', field: 'email' },
  });
});
