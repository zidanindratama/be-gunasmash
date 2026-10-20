import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AdminCheckInSchema,
  AnnouncementSchema,
  AttendanceListQuerySchema,
  AttendanceStatsQuerySchema,
  BlogSchema,
  BlogUpdateSchema,
  CreateSessionSchema,
  MemberCheckInSchema,
  MongoIdSchema,
  PromoteSchema,
  SessionQuerySchema,
  SignInSchema,
  SignUpSchema,
  UserUpdateSchema,
} from '../../../src/modules/common/validators/schemas.js';

test('sign-up and sign-in schemas normalize email and reject invalid credentials', () => {
  assert.equal(SignUpSchema.parse({ name: '  Andi Pratama ', email: ' andi@example.com ', password: 'secret1' }).name, 'Andi Pratama');
  assert.equal(SignUpSchema.parse({ name: 'Andi Pratama', email: ' andi@example.com ', password: 'secret1' }).email, 'andi@example.com');
  assert.equal(SignInSchema.parse({ email: ' andi@example.com ', password: 'secret1' }).email, 'andi@example.com');
  assert.equal(SignUpSchema.safeParse({ name: 'A', email: 'bad', password: '123' }).success, false);
  assert.equal(SignInSchema.safeParse({ email: 'valid@example.com', password: '123' }).success, false);
});

test('announcement schema applies defaults and validates URL/date fields', () => {
  const parsed = AnnouncementSchema.parse({
    title: ' Latihan ',
    datetime: '2025-01-01T10:00:00.000Z',
    location: ' Lapangan ',
    content: 'Info',
  });
  assert.equal(parsed.title, 'Latihan');
  assert.equal(parsed.type, 'INFO');
  assert.equal(AnnouncementSchema.safeParse({ ...parsed, imageUrl: 'bad-url' }).success, false);
  assert.equal(AnnouncementSchema.safeParse({ ...parsed, type: 'INVALID' }).success, false);
  assert.equal(AnnouncementSchema.safeParse({ ...parsed, content: '' }).success, false);
  assert.equal(AnnouncementSchema.safeParse({ title: 'Valid', datetime: '2025-01-01', location: 'Place', content: 'Text' }).success, false);
});

test('blog schemas apply tag/published defaults and validate update values', () => {
  const parsed = BlogSchema.parse({ title: 'Blog', slug: 'blog', content: 'Text' });
  assert.deepEqual(parsed.tags, []);
  assert.equal(parsed.published, false);
  assert.equal(BlogSchema.safeParse({ ...parsed, published: 'false' }).success, true);
  assert.equal(BlogUpdateSchema.safeParse({ published: 'false' }).success, false);
  assert.equal(BlogSchema.safeParse({ ...parsed, tags: [''] }).success, false);
  assert.equal(BlogUpdateSchema.safeParse({ coverUrl: null }).success, true);
});

test('Mongo ID, role and attendance schemas enforce their boundaries and defaults', () => {
  assert.equal(MongoIdSchema.safeParse('507f1f77bcf86cd799439011').success, true);
  assert.equal(MongoIdSchema.safeParse('not-an-object-id').success, false);
  assert.equal(PromoteSchema.safeParse({ role: 'ROOT' }).success, false);
  assert.equal(MemberCheckInSchema.safeParse({ announcementId: 'a', note: 'x'.repeat(201) }).success, false);

  const admin = AdminCheckInSchema.parse({ announcementId: 'a', userId: 'u' });
  assert.equal(admin.status, 'PRESENT');
  assert.equal(AdminCheckInSchema.safeParse({ announcementId: 'a', userId: 'u', status: 'UNKNOWN' }).success, false);
  assert.equal(AdminCheckInSchema.safeParse({ announcementId: 'a', userId: 'u', note: 'x'.repeat(201) }).success, false);
  assert.equal(AdminCheckInSchema.safeParse({ announcementId: 'a', userId: 'u', date: '2025/01/01' }).success, false);
  assert.equal(AdminCheckInSchema.safeParse({ announcementId: 'a', userId: 'u', date: '2025-02-30' }).success, true);
});

test('session and attendance query schemas coerce pagination and validate limits', () => {
  const session = SessionQuerySchema.parse({ announcementId: 'a', page: '2', limit: '25' });
  assert.equal(session.page, 2);
  assert.equal(session.limit, 25);
  assert.deepEqual(SessionQuerySchema.parse({ announcementId: 'a' }), {
    announcementId: 'a', page: 1, limit: 20,
  });
  assert.equal(SessionQuerySchema.safeParse({ announcementId: 'a', limit: '101' }).success, false);
  assert.equal(AttendanceStatsQuerySchema.safeParse({ announcementId: 'a', date: '2025-02-30' }).success, true);
  assert.equal(AttendanceStatsQuerySchema.safeParse({ announcementId: 'a', date: '2025/02/01' }).success, false);
  assert.equal(AttendanceListQuerySchema.safeParse({ status: 'UNKNOWN' }).success, false);
  assert.equal(AttendanceListQuerySchema.safeParse({ announcementId: 'a', userId: 'u', status: 'LATE', page: '1' }).success, true);
});

test('user updates allow nullable avatar and reject invalid email', () => {
  assert.deepEqual(UserUpdateSchema.parse({ avatarUrl: null }), { avatarUrl: null });
  assert.equal(UserUpdateSchema.parse({ email: ' user@example.com ' }).email, 'user@example.com');
  assert.equal(UserUpdateSchema.safeParse({ email: 'invalid' }).success, false);
  assert.equal(CreateSessionSchema.safeParse({ title: 'x', date: 'invalid', status: 'OPEN' }).success, false);
  assert.equal(CreateSessionSchema.safeParse({ title: 'Training', date: '2025-01-01T10:00:00.000Z', status: 'OPEN' }).success, true);
  assert.equal(CreateSessionSchema.safeParse({ title: 'Ok', date: '2025-01-01T10:00:00.000Z', status: 'INVALID' }).success, false);
});
