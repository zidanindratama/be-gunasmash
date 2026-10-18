import assert from 'node:assert/strict';
import test from 'node:test';

import { parseListQuery, shapeList } from '../../../src/modules/common/utils/query.js';

test('parseListQuery applies defaults and trims search text', () => {
  assert.deepEqual(parseListQuery({ search: '  smash  ' }), {
    page: 1,
    limit: 10,
    skip: 0,
    search: 'smash',
    orderBy: undefined,
    where: {},
  });
});

test('parseListQuery clamps pagination and accepts array query values', () => {
  assert.deepEqual(parseListQuery({ page: ['0', '8'], limit: '1000' }), {
    page: 1,
    limit: 100,
    skip: 0,
    search: '',
    orderBy: undefined,
    where: {},
  });
  assert.equal(parseListQuery({ page: '-2', limit: '0' }).limit, 10);
});

test('parseListQuery parses object sorting and JSON filters', () => {
  assert.deepEqual(
    parseListQuery({ sort: '{"createdAt":"asc","ignored":"sideways"}', filter: '{"role":"ADMIN"}' }),
    {
      page: 1,
      limit: 10,
      skip: 0,
      search: '',
      orderBy: { createdAt: 'asc' },
      where: { role: 'ADMIN' },
    },
  );
});

test('parseListQuery supports colon sorting and ignores malformed filters', () => {
  assert.deepEqual(parseListQuery({ sort: 'name:desc', filter: '{bad' }), {
    page: 1,
    limit: 10,
    skip: 0,
    search: '',
    orderBy: { name: 'desc' },
    where: {},
  });
});

test('parseListQuery ignores JSON filters that are not objects', () => {
  assert.deepEqual(parseListQuery({ filter: '[]' }).where, {});
});

test('shapeList calculates page count and preserves items', () => {
  const items = ['a', 'b'];
  assert.deepEqual(shapeList(items, 5, 2, 2), {
    items,
    meta: { total: 5, page: 2, limit: 2, pages: 3 },
  });
  assert.equal(shapeList([], 0, 1, 10).meta.pages, 0);
});
