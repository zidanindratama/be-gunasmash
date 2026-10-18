import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listAnnouncements, createAnnouncement, getAnnouncement, updateAnnouncement, removeAnnouncement,
} from '../../../src/modules/announcements/announcements.service.js';
import { prisma } from '../../../src/modules/prisma/client.js';

function replace(target: any, key: string, implementation: (..._args: any[]) => unknown, t: any) {
  const original = target[key];
  target[key] = implementation;
  t.after(() => { target[key] = original; });
}

test('listAnnouncements normalizes type lists, maps search/pagination/order and author projection', async (t) => {
  let query: any;
  let count: any;
  const announcement = {
    id: 'a1', title: 'Practice', type: 'TRAINING', datetime: new Date('2025-04-01T10:00:00Z'),
    location: 'Court', locationLink: null, imageUrl: null, content: 'Training',
    createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2025-01-02T00:00:00Z'),
    author: { id: 'u1', name: 'Coach', avatarUrl: 'avatar', password: 'secret' },
  };
  replace(prisma.announcement, 'findMany', async (arg) => { query = arg; return [announcement]; }, t);
  replace(prisma.announcement, 'count', async (arg) => { count = arg; return 1; }, t);

  const result = await listAnnouncements({
    page: '2', limit: '5', search: ' practice ', sort: 'datetime:asc',
    type: 'training, null,{{placeholder}},training, invalid',
  });

  assert.deepEqual(query, {
    where: {
      OR: [
        { title: { contains: 'practice', mode: 'insensitive' } },
        { location: { contains: 'practice', mode: 'insensitive' } },
        { content: { contains: 'practice', mode: 'insensitive' } },
      ],
      type: { in: ['TRAINING'] },
    },
    skip: 5,
    take: 5,
    orderBy: { datetime: 'asc' },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
  assert.deepEqual(count, { where: query.where });
  assert.deepEqual(result, {
    items: [{
      id: 'a1', title: 'Practice', type: 'TRAINING', datetime: announcement.datetime,
      location: 'Court', locationLink: null, imageUrl: null, content: 'Training',
      createdAt: announcement.createdAt, updatedAt: announcement.updatedAt,
      author: { id: 'u1', name: 'Coach', avatarUrl: 'avatar' },
    }],
    meta: { total: 1, page: 2, limit: 5, pages: 1 },
  });
});

test('listAnnouncements defaults to all types when query type is invalid or empty and propagates Prisma errors', async (t) => {
  let query: any;
  replace(prisma.announcement, 'findMany', async (arg) => { query = arg; return []; }, t);
  replace(prisma.announcement, 'count', async () => 0, t);
  await listAnnouncements({ type: 'invalid,undefined,{{bad}}' });
  assert.equal('type' in query.where, false);
  assert.deepEqual(query.orderBy, { datetime: 'desc' });

  const failure = new Error('database failure');
  replace(prisma.announcement, 'findMany', async () => { throw failure; }, t);
  await assert.rejects(listAnnouncements({}), failure);
});

test('createAnnouncement maps defaults, date, nullable optional fields and creator', async (t) => {
  let args: any;
  const result = { id: 'a1' };
  replace(prisma.announcement, 'create', async (arg) => { args = arg; return result; }, t);
  assert.equal(await createAnnouncement({
    title: 'Open practice', datetime: '2025-05-01T10:00:00.000Z', location: 'Court', content: 'Bring gear',
  }, 'admin-1'), result);
  assert.deepEqual(args, { data: {
    title: 'Open practice', type: 'INFO', datetime: new Date('2025-05-01T10:00:00.000Z'),
    location: 'Court', locationLink: null, imageUrl: null, content: 'Bring gear', createdBy: 'admin-1',
  } });
});

test('createAnnouncement preserves provided type and nullable URLs', async (t) => {
  let args: any;
  replace(prisma.announcement, 'create', async (arg) => { args = arg; return {}; }, t);
  await createAnnouncement({
    title: 'Event', type: 'EVENT', datetime: '2025-06-01T10:00:00.000Z', location: 'Hall',
    locationLink: null, imageUrl: 'https://example.com/image.png', content: 'Details',
  }, 'admin-2');
  assert.equal(args.data.type, 'EVENT');
  assert.equal(args.data.locationLink, null);
  assert.equal(args.data.imageUrl, 'https://example.com/image.png');
});

test('getAnnouncement returns an existing record and reports missing records', async (t) => {
  let args: any;
  const record = { id: 'a1' };
  replace(prisma.announcement, 'findUnique', async (arg) => { args = arg; return record; }, t);
  assert.equal(await getAnnouncement('a1'), record);
  assert.deepEqual(args, { where: { id: 'a1' } });
  replace(prisma.announcement, 'findUnique', async () => null, t);
  await assert.rejects(getAnnouncement('missing'), { message: 'Announcement not found', status: 404 });
});

test('updateAnnouncement preserves omitted values and converts explicit dates and nulls', async (t) => {
  let args: any;
  const updated = { id: 'a1' };
  replace(prisma.announcement, 'update', async (arg) => { args = arg; return updated; }, t);
  assert.equal(await updateAnnouncement('a1', {
    datetime: '2025-07-01T12:30:00.000Z', locationLink: null, imageUrl: 'https://example.com/new.png',
  }), updated);
  assert.deepEqual(args, { where: { id: 'a1' }, data: {
    title: undefined, type: undefined, datetime: new Date('2025-07-01T12:30:00.000Z'),
    location: undefined, locationLink: null, imageUrl: 'https://example.com/new.png', content: undefined,
  } });
});

test('updateAnnouncement leaves undefined dates and URLs untouched and removeAnnouncement deletes by ID', async (t) => {
  let updateArgs: any;
  let deleteArgs: any;
  replace(prisma.announcement, 'update', async (arg) => { updateArgs = arg; return {}; }, t);
  replace(prisma.announcement, 'delete', async (arg) => { deleteArgs = arg; return {}; }, t);
  await updateAnnouncement('a2', { title: 'Updated' });
  assert.equal(updateArgs.data.datetime, undefined);
  assert.equal(updateArgs.data.locationLink, undefined);
  assert.equal(updateArgs.data.imageUrl, undefined);
  assert.deepEqual(await removeAnnouncement('a2'), {});
  assert.deepEqual(deleteArgs, { where: { id: 'a2' } });
});
