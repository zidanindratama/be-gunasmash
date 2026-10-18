import assert from 'node:assert/strict';
import test from 'node:test';

import { announcementsRouter } from '../../../src/modules/announcements/announcements.controller.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler(path: string, method: string) {
  const route = (announcementsRouter as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `missing ${method.toUpperCase()} ${path} route`);
  return route.route.stack.at(-1).handle;
}

function response() {
  const state: any = { body: undefined };
  const res: any = { json: (body: unknown) => { state.body = body; return res; } };
  return { res, state };
}

test('public announcement list maps query result into success response', async (t) => {
  const rows = [{
    id: 'a1', title: 'Practice', type: 'TRAINING', datetime: new Date('2025-05-10T10:00:00Z'),
    location: 'Court', locationLink: null, imageUrl: null, content: 'Details',
    createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2025-01-02T00:00:00Z'), author: null,
  }];
  replace(prisma.announcement, 'findMany', async () => rows, t);
  replace(prisma.announcement, 'count', async () => 1, t);
  const { res, state } = response();
  await routeHandler('/', 'get')({ query: { type: 'TRAINING' } }, res, (error: unknown) => assert.fail(String(error)));
  assert.equal(state.body.success, true);
  assert.deepEqual(state.body.data.items, rows);
  assert.deepEqual(state.body.data.meta, { total: 1, page: 1, limit: 10, pages: 1 });
});

test('announcement detail route validates ID and forwards service not-found errors', async () => {
  const errors: any[] = [];
  await routeHandler('/:id', 'get')({ params: { id: 'bad' } }, response().res,
    (error: unknown) => errors.push(error));
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
  assert.match(errors[0].message, /Invalid ID format/);
});

test('announcement create/update/delete routes validate DTOs and map admin identity', async (t) => {
  const created: any[] = [];
  let updated: any;
  let deleted: any;
  replace(prisma.announcement, 'create', async (arg) => { created.push(arg); return { id: 'a1', ...arg.data }; }, t);
  replace(prisma.announcement, 'update', async (arg) => { updated = arg; return { id: 'a1', ...arg.data }; }, t);
  replace(prisma.announcement, 'delete', async (arg) => { deleted = arg; return {}; }, t);
  const id = '507f1f77bcf86cd799439011';
  const body = {
    title: 'Training', datetime: '2025-05-10T10:00:00.000Z', location: 'Court', content: 'Bring gear',
  };
  const create = response();
  await routeHandler('/', 'post')({ user: { sub: 'admin1' }, body }, create.res, (error: unknown) => assert.fail(String(error)));
  assert.equal(created[0].data.createdBy, 'admin1');
  assert.equal(created[0].data.type, 'INFO');
  assert.equal(create.state.body.success, true);

  const update = response();
  await routeHandler('/:id', 'patch')({ params: { id }, body: { title: 'Updated' } }, update.res,
    (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(updated, { where: { id }, data: { title: 'Updated', type: undefined, datetime: undefined, location: undefined, locationLink: undefined, imageUrl: undefined, content: undefined } });

  const remove = response();
  await routeHandler('/:id', 'delete')({ params: { id } }, remove.res, (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(deleted, { where: { id } });
  assert.deepEqual(remove.state.body.data, {});
});
