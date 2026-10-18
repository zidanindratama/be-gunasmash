import assert from 'node:assert/strict';
import test from 'node:test';

import { listBlogs, createBlog, getBlog, updateBlog, removeBlog } from '../../../src/modules/blogs/blogs.service.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

test('public list forces published-only while applying search, tags, paging and sort', async (t) => {
  let query: any;
  let count: any;
  replace(prisma.blog, 'findMany', async (arg) => { query = arg; return [{
    id: 'b1', title: 'Training', slug: 'training', content: 'Body', coverUrl: null, tags: ['training'],
    published: true, createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2025-01-02T00:00:00Z'),
    author: { id: 'u1', name: 'Coach', avatarUrl: null, password: 'secret' },
  }]; }, t);
  replace(prisma.blog, 'count', async (arg) => { count = arg; return 1; }, t);
  const result = await listBlogs({ page: '2', limit: '5', search: 'training', tag: '  event ', sort: 'createdAt:asc', published: 'false' });
  assert.deepEqual(query.where, {
    OR: [
      { title: { contains: 'training', mode: 'insensitive' } },
      { content: { contains: 'training', mode: 'insensitive' } },
      { tags: { has: 'training' } },
    ],
    published: true,
    tags: { has: 'event' },
  });
  assert.equal(query.skip, 5);
  assert.equal(query.take, 5);
  assert.deepEqual(query.orderBy, { createdAt: 'asc' });
  assert.deepEqual(count, { where: query.where });
  assert.equal(result.items[0]?.author?.name, 'Coach');
  assert.equal('password' in (result.items[0]?.author ?? {}), false);
  assert.deepEqual(result.meta, { total: 1, page: 2, limit: 5, pages: 1 });
});

test('admin list can filter published or drafts and ignores invalid published filters', async (t) => {
  let query: any;
  replace(prisma.blog, 'findMany', async (arg) => { query = arg; return []; }, t);
  replace(prisma.blog, 'count', async () => 0, t);
  await listBlogs({ published: 'false' }, true);
  assert.equal(query.where.published, false);
  await listBlogs({ published: 'invalid' }, true);
  assert.equal('published' in query.where, false);
  await listBlogs({ filter: JSON.stringify({ published: ['true', 'false'] }) }, true);
  assert.equal(query.where.published, true);
});

test('listBlogs returns empty results and propagates query failures', async (t) => {
  replace(prisma.blog, 'findMany', async () => [], t);
  replace(prisma.blog, 'count', async () => 0, t);
  assert.deepEqual(await listBlogs({}), { items: [], meta: { total: 0, page: 1, limit: 10, pages: 0 } });
  const failure = new Error('query failed');
  replace(prisma.blog, 'findMany', async () => { throw failure; }, t);
  await assert.rejects(listBlogs({}), failure);
});

test('createBlog maps author and omitted cover to null', async (t) => {
  let args: any;
  const blog = { id: 'b1' };
  replace(prisma.blog, 'create', async (arg) => { args = arg; return blog; }, t);
  assert.equal(await createBlog({ title: 'Title', slug: 'title', content: 'Body', tags: ['news'], published: false }, 'admin'), blog);
  assert.deepEqual(args, { data: {
    title: 'Title', slug: 'title', content: 'Body', coverUrl: null, tags: ['news'], published: false, createdBy: 'admin',
  } });
});

test('getBlog queries by slug with safe author projection and reports missing blogs', async (t) => {
  let args: any;
  const blog = { slug: 'post', published: false };
  replace(prisma.blog, 'findUnique', async (arg) => { args = arg; return blog; }, t);
  assert.equal(await getBlog('post'), blog);
  assert.deepEqual(args, { where: { slug: 'post' }, include: { author: { select: { id: true, name: true, avatarUrl: true } } } });
  replace(prisma.blog, 'findUnique', async () => null, t);
  await assert.rejects(getBlog('missing'), { message: 'Blog not found', status: 404 });
});

test('updateBlog forwards partial fields and removeBlog deletes by slug', async (t) => {
  let updateArgs: any;
  let deleteArgs: any;
  replace(prisma.blog, 'update', async (arg) => { updateArgs = arg; return {}; }, t);
  replace(prisma.blog, 'delete', async (arg) => { deleteArgs = arg; return {}; }, t);
  await updateBlog('old-slug', { slug: 'new-slug', published: true });
  assert.deepEqual(updateArgs, { where: { slug: 'old-slug' }, data: { slug: 'new-slug', published: true } });
  assert.deepEqual(await removeBlog('new-slug'), {});
  assert.deepEqual(deleteArgs, { where: { slug: 'new-slug' } });
});
