import assert from 'node:assert/strict';
import test from 'node:test';

import { blogsRouter } from '../../../src/modules/blogs/blogs.controller.js';
import { signAccessToken } from '../../../src/modules/common/auth/jwt.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

function routeHandler(path: string, method: string) {
  const route = (blogsRouter as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `missing ${method.toUpperCase()} ${path} route`);
  return route.route.stack.at(-1).handle;
}

function response() {
  const state: any = { body: undefined, statusCode: 200 };
  const res: any = {
    json: (body: unknown) => { state.body = body; return res; },
    status: (statusCode: number) => { state.statusCode = statusCode; return res; },
  };
  return { res, state };
}

test('draft blog detail is hidden from anonymous and member requests but visible to an admin token', async (t) => {
  const draft = { id: 'b1', slug: 'draft', title: 'Draft', published: false, author: null };
  let queries = 0;
  replace(prisma.blog, 'findUnique', async () => { queries++; return draft; }, t);
  const handler = routeHandler('/:slug', 'get');

  const anonymous = response();
  await handler({ params: { slug: 'draft' }, headers: {} }, anonymous.res, (error: unknown) => assert.fail(String(error)));
  assert.equal(anonymous.state.statusCode, 404);
  assert.deepEqual(anonymous.state.body, { success: false, error: { message: 'Blog not found' } });

  const member = response();
  await handler({ params: { slug: 'draft' }, headers: { authorization: `Bearer ${signAccessToken({ sub: 'm1', role: 'MEMBER' })}` } }, member.res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(member.state.statusCode, 404);

  const admin = response();
  await handler({ params: { slug: 'draft' }, headers: { authorization: `Bearer ${signAccessToken({ sub: 'a1', role: 'ADMIN' })}` } }, admin.res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(admin.state.body.success, true);
  assert.equal(admin.state.body.data.published, false);
  assert.equal(queries, 3);
});

test('invalid access token does not grant unpublished blog visibility', async (t) => {
  replace(prisma.blog, 'findUnique', async () => ({ id: 'b1', slug: 'draft', published: false }), t);
  const { res, state } = response();
  await routeHandler('/:slug', 'get')({ params: { slug: 'draft' }, headers: { authorization: 'Bearer invalid' } }, res,
    (error: unknown) => assert.fail(String(error)));
  assert.equal(state.statusCode, 404);
});

test('blog create/update/delete routes validate fields and use route identity/slug', async (t) => {
  let created: any;
  let updated: any;
  let deleted: any;
  replace(prisma.blog, 'create', async (arg) => { created = arg; return { id: 'b1', ...arg.data }; }, t);
  replace(prisma.blog, 'update', async (arg) => { updated = arg; return { id: 'b1', ...arg.data }; }, t);
  replace(prisma.blog, 'delete', async (arg) => { deleted = arg; return {}; }, t);
  const body = { title: 'News', slug: 'news', content: 'Article', tags: ['updates'], published: true };
  const create = response();
  await routeHandler('/', 'post')({ user: { sub: 'admin1' }, body }, create.res, (error: unknown) => assert.fail(String(error)));
  assert.equal(created.data.createdBy, 'admin1');
  assert.equal(created.data.coverUrl, null);
  assert.equal(create.state.body.data.published, true);

  const update = response();
  await routeHandler('/:slug', 'patch')({ params: { slug: 'news' }, body: { published: false } }, update.res,
    (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(updated, { where: { slug: 'news' }, data: { published: false } });

  const remove = response();
  await routeHandler('/:slug', 'delete')({ params: { slug: 'news' } }, remove.res,
    (error: unknown) => assert.fail(String(error)));
  assert.deepEqual(deleted, { where: { slug: 'news' } });
});

test('blog create route forwards schema validation errors', async () => {
  const errors: unknown[] = [];
  await routeHandler('/', 'post')({ user: { sub: 'admin1' }, body: { title: 'x' } }, response().res,
    (error: unknown) => errors.push(error));
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
});
