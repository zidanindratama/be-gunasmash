import assert from 'node:assert/strict';
import test from 'node:test';

import { createSlug, pickAttendanceStatus, seedDatabase } from '../../../prisma/seed.js';

function fakeFaker(now: number) {
  let userNumber = 0;
  let announcementNumber = 0;
  return {
    person: { firstName: () => `First${++userNumber}`, lastName: () => `Last${userNumber}` },
    internet: { email: ({ firstName, lastName }: any) => `${firstName}.${lastName}@EXAMPLE.com` },
    image: {
      avatar: () => 'https://images.example/avatar.png',
      urlLoremFlickr: ({ category }: any) => `https://images.example/${category}.png`,
    },
    helpers: {
      arrayElement: (items: unknown[]) => items[0],
      arrayElements: (items: any[], count: number) => items.slice(0, count),
    },
    date: {
      weekday: () => 'Saturday',
      between: () => new Date(now - 24 * 60 * 60 * 1000),
    },
    location: { streetAddress: () => '1 Main Street' },
    datatype: { boolean: () => true },
    lorem: {
      words: () => 'weekly training',
      paragraphs: (count: number) => `paragraphs-${count}`,
      sentence: () => `Seed Blog ${++announcementNumber}.`,
    },
  };
}

function fakePrisma() {
  const calls: { method: string; args: any[] }[] = [];
  const users: any[] = [];
  const announcements: any[] = [];
  const sessions: any[] = [];
  const attendance: any[] = [];
  const blogs: any[] = [];
  const record = (method: string, result: (args: any[]) => unknown = () => ({})) => async (...args: any[]) => {
    calls.push({ method, args });
    return result(args);
  };
  let userId = 0;
  let announcementId = 0;
  let sessionId = 0;
  const client: any = {
    attendance: { deleteMany: record('attendance.deleteMany'), createMany: record('attendance.createMany', ([arg]) => { attendance.push(...arg.data); return { count: arg.data.length }; }) },
    attendanceSession: {
      deleteMany: record('attendanceSession.deleteMany'),
      create: record('attendanceSession.create', ([arg]) => { const session = { id: `session-${++sessionId}`, ...arg.data }; sessions.push(session); return session; }),
    },
    announcement: { deleteMany: record('announcement.deleteMany'), create: record('announcement.create', ([arg]) => { const announcement = { id: `announcement-${++announcementId}`, ...arg.data }; announcements.push(announcement); return announcement; }) },
    blog: { deleteMany: record('blog.deleteMany'), create: record('blog.create', ([arg]) => { blogs.push(arg.data); return { id: `blog-${blogs.length}`, ...arg.data }; }) },
    user: {
      deleteMany: record('user.deleteMany'),
      create: record('user.create', ([arg]) => { const user = { id: `user-${++userId}`, ...arg.data }; users.push(user); return user; }),
      createMany: record('user.createMany', ([arg]) => { users.push(...arg.data.map((data: any) => ({ id: `user-${++userId}`, ...data }))); return { count: arg.data.length }; }),
      findMany: record('user.findMany', () => users),
    },
  };
  return { client, calls, users, announcements, sessions, attendance, blogs };
}

test('seed helpers create stable slugs and map random thresholds to attendance statuses', () => {
  assert.equal(createSlug('My New Blog!', () => 12345), `my-new-blog-${(12345).toString(36)}`);
  assert.equal(pickAttendanceStatus(() => 0.749), 'PRESENT');
  assert.equal(pickAttendanceStatus(() => 0.75), 'LATE');
  assert.equal(pickAttendanceStatus(() => 0.85), 'EXCUSED');
  assert.equal(pickAttendanceStatus(() => 0.95), 'ABSENT');
});

test('seedDatabase clears and repopulates all models using injected database and deterministic dependencies', async () => {
  const now = new Date('2025-05-10T10:00:00.000Z').getTime();
  const db = fakePrisma();
  const hashes: any[] = [];
  const logs: unknown[][] = [];
  let randomCalls = 0;
  await seedDatabase({
    prismaClient: db.client,
    fakerApi: fakeFaker(now) as any,
    hashPassword: async (...args: any[]) => { hashes.push(args); return `hashed-${hashes.length}`; },
    now: () => now,
    random: () => [0.1, 0.8, 0.9, 0.99][randomCalls++ % 4]!,
    log: (...args) => logs.push(args),
  });

  assert.deepEqual(db.calls.slice(0, 5).map((call) => call.method), [
    'attendance.deleteMany', 'attendanceSession.deleteMany', 'announcement.deleteMany', 'blog.deleteMany', 'user.deleteMany',
  ]);
  assert.deepEqual(hashes, [['password123', 10], ['password', 10]]);
  assert.equal(db.users.length, 22);
  assert.deepEqual(
    db.users.slice(0, 2).map(({ name, email, role }) => ({ name, email, role })),
    [
      { name: 'Andi Pratama', email: 'admin@gmail.com', role: 'ADMIN' },
      { name: 'Siti Aisyah', email: 'member@gmail.com', role: 'MEMBER' },
    ],
  );
  assert.equal(db.users.filter((user) => user.role === 'ADMIN').length, 1);
  assert.equal(db.users.filter((user) => user.role === 'MEMBER').length, 21);
  assert.equal(db.announcements.length, 15);
  assert.equal(db.sessions.length, 15);
  assert.equal(db.attendance.length, 240);
  assert.deepEqual(new Set(db.attendance.map((item) => item.status)), new Set(['PRESENT', 'LATE', 'EXCUSED', 'ABSENT']));
  assert.equal(db.blogs.length, 10);
  assert.ok(db.blogs.every((blog) => blog.slug.endsWith((now).toString(36))));
  assert.equal(randomCalls, 240);
  assert.ok(logs.some((entry) => String(entry[0]).includes('Seeding completed')));
});

test('seedDatabase stops and propagates errors before continuing to later writes', async () => {
  const failure = new Error('seed cleanup failed');
  const db = fakePrisma();
  db.client.attendance.deleteMany = async () => { throw failure; };
  await assert.rejects(seedDatabase({ prismaClient: db.client, fakerApi: fakeFaker(Date.now()) as any, log: () => {} }), failure);
  assert.deepEqual(db.calls, []);
});
