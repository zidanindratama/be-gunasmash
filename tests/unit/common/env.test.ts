import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEnv } from '../../../src/modules/config/env.js';

const requiredEnvironment = {
  DATABASE_URL: 'mongodb://unit-test.invalid/test',
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  CLOUDINARY_CLOUD_NAME: 'unit-test-cloud',
  CLOUDINARY_API_KEY: 'unit-test-api-key',
  CLOUDINARY_API_SECRET: 'unit-test-api-secret',
};

test('loadEnv applies development defaults while preserving required values', () => {
  assert.deepEqual(loadEnv(requiredEnvironment), {
    NODE_ENV: 'development',
    PORT: '4000',
    ...requiredEnvironment,
    JWT_ACCESS_EXPIRES: '15m',
    JWT_REFRESH_EXPIRES: '7d',
    CORS_WHITELIST: 'localhost,vercel.app',
  });
});

test('loadEnv accepts explicit optional values', () => {
  const result = loadEnv({
    ...requiredEnvironment,
    NODE_ENV: 'production',
    PORT: '8080',
    JWT_ACCESS_EXPIRES: '30m',
    JWT_REFRESH_EXPIRES: '14d',
    CORS_WHITELIST: 'example.com',
  });
  assert.equal(result.NODE_ENV, 'production');
  assert.equal(result.PORT, '8080');
  assert.equal(result.JWT_ACCESS_EXPIRES, '30m');
  assert.equal(result.JWT_REFRESH_EXPIRES, '14d');
  assert.equal(result.CORS_WHITELIST, 'example.com');
});

test('loadEnv identifies each missing required variable', () => {
  for (const key of Object.keys(requiredEnvironment)) {
    const input = { ...requiredEnvironment };
    delete (input as Record<string, string>)[key];
    assert.throws(() => loadEnv(input), new RegExp(`Missing env ${key}`));
  }
});
