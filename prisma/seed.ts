import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { PrismaClient, AttendanceStatus, AnnouncementType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import type { Role as RoleType } from '@prisma/client';

const prisma = new PrismaClient();

const SEED = process.env.SEED ? Number(process.env.SEED) : undefined;
if (!Number.isNaN(SEED) && typeof SEED === 'number') {
  faker.seed(SEED);
}

const USERS_N = Number(process.env.SEED_USERS || 20);
const ANNS_N = Number(process.env.SEED_ANNOUNCEMENTS || 20);
const BLOGS_N = Number(process.env.SEED_BLOGS || 20);

const ATT_PRESENT_RATE = Number(process.env.ATT_PRESENT_RATE ?? 0.75);
const ATT_LATE_RATE = Number(process.env.ATT_LATE_RATE ?? 0.12);
const ATT_EXCUSED_RATE = Number(process.env.ATT_EXCUSED_RATE ?? 0.08);

function pickRole(i: number): RoleType {
  return i < Math.max(1, Math.floor(USERS_N * 0.2)) ? 'ADMIN' : 'MEMBER';
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function uniqueSlug(base: string) {
  return `${slugify(base)}-${Date.now().toString(36)}-${faker.string.alphanumeric(4).toLowerCase()}`;
}

function toTitleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => (w[0]?.toUpperCase() ?? '') + w.slice(1));
}

const LOC_POOL = [
  'Sport Center Kampus H',
  'GOR Gloria',
  'GOR Cempaka',
  'Hall Kampus E',
  'Lapangan Indoor Kampus J',
  'GOR Bimasakti',
];

const TAG_POOL = [
  'news',
  'update',
  'tips',
  'event',
  'club',
  'training',
  'match',
  'tech',
  'guide',
  'announcement',
];

function normalizeLocalDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function pickStatus(): AttendanceStatus {
  const r = Math.random();
  if (r < ATT_PRESENT_RATE) return AttendanceStatus.PRESENT;
  if (r < ATT_PRESENT_RATE + ATT_LATE_RATE) return AttendanceStatus.LATE;
  if (r < ATT_PRESENT_RATE + ATT_LATE_RATE + ATT_EXCUSED_RATE) return AttendanceStatus.EXCUSED;
  return AttendanceStatus.PRESENT;
}

function pickAnnouncementType(): AnnouncementType {
  const pool: AnnouncementType[] = [
    'TRAINING',
    'TRAINING',
    'TRAINING',
    'SPARRING',
    'SPARRING',
    'RECRUITMENT',
    'BRIEFING',
    'TOURNAMENT',
    'EVENT',
    'INFO',
  ];
  return faker.helpers.arrayElement(pool);
}

async function ensureBaseAnnouncements() {
  const base = [
    {
      title: 'Latihan Rutin Rabu',
      type: 'TRAINING' as AnnouncementType,
      location: 'Sport Center Kampus H',
      locationLink: 'https://www.google.com/maps/search/?api=1&query=Sport%20Center%20Kampus%20H',
    },
    {
      title: 'Latihan Rutin Minggu',
      type: 'TRAINING' as AnnouncementType,
      location: 'GOR Gloria',
      locationLink: 'https://www.google.com/maps/search/?api=1&query=GOR%20Gloria',
    },
  ];

  const anyAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const creatorId =
    anyAdmin?.id ??
    (
      await prisma.user.create({
        data: {
          name: 'Auto Admin',
          email: `admin+${Date.now().toString(36)}@example.com`,
          password: await bcrypt.hash('password123', 10),
          role: 'ADMIN',
        },
      })
    ).id;

  const ids: string[] = [];
  const dtMinus2h = new Date(Date.now() - 2 * 60 * 60 * 1000);

  for (const b of base) {
    const created = await prisma.announcement.create({
      data: {
        title: b.title,
        type: b.type,
        datetime: dtMinus2h,
        location: b.location,
        locationLink: b.locationLink,
        imageUrl: null,
        createdBy: creatorId,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
}

async function seedAttendanceForAnnouncements(announcementIds?: string[]) {
  const anns = announcementIds?.length
    ? await prisma.announcement.findMany({ where: { id: { in: announcementIds } } })
    : await prisma.announcement.findMany();

  const members = await prisma.user.findMany({ where: { role: 'MEMBER' }, select: { id: true } });
  const memberIds = members.map((m) => m.id);

  for (const ann of anns) {
    const baseDate = normalizeLocalDate(new Date(ann.datetime));
    const session = await prisma.attendanceSession.upsert({
      where: { announcementId_date: { announcementId: ann.id, date: baseDate } },
      create: { announcementId: ann.id, date: baseDate, openedAt: new Date(baseDate) },
      update: {},
      select: { id: true },
    });

    const targetCount = Math.round(
      memberIds.length * (ATT_PRESENT_RATE + ATT_LATE_RATE + ATT_EXCUSED_RATE),
    );
    const presentIds = faker.helpers.arrayElements(memberIds, Math.max(0, targetCount));

    for (const uid of presentIds) {
      await prisma.attendance.upsert({
        where: { sessionId_userId: { sessionId: session.id, userId: uid } },
        create: {
          sessionId: session.id,
          userId: uid,
          status: pickStatus(),
          note: faker.datatype.boolean({ probability: 0.15 })
            ? faker.lorem.sentence({ min: 3, max: 8 })
            : null,
          createdAt: new Date(baseDate),
        },
        update: {},
      });
    }
  }
}

async function main() {
  await prisma.attendance.deleteMany({});
  await prisma.attendanceSession.deleteMany({});
  await prisma.blog.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.user.deleteMany({});

  const hash = await bcrypt.hash('password123', 10);

  const zidan = await prisma.user.create({
    data: {
      name: 'Muhamad Zidan Indratama',
      email: 'zidanindratama03@gmail.com',
      password: hash,
      role: 'ADMIN',
      avatarUrl: 'https://i.pravatar.cc/256?u=zidanindratama03',
      createdAt: new Date(),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const users = [zidan];

  for (let i = 0; i < USERS_N; i++) {
    const name = `${faker.person.firstName()} ${faker.person.lastName()}`;
    const emailRaw = faker.internet
      .email({
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' ') || 'user',
        provider: faker.helpers.arrayElement(['example.com', 'mail.test', 'dev.local']),
      })
      .toLowerCase()
      .replace(/\s+/g, '');
    const [local, domain] = emailRaw.split('@');
    const email = `${local}+${Date.now().toString(36)}${faker.string.alphanumeric(3).toLowerCase()}@${domain}`;

    const u = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        role: pickRole(i),
        avatarUrl: faker.datatype.boolean()
          ? `https://i.pravatar.cc/256?u=${faker.string.uuid()}`
          : null,
        createdAt: faker.date.recent({ days: 90 }),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    users.push(u);
  }

  const userIds = users.map((u) => u.id);
  const anyUser = () => faker.helpers.arrayElement(userIds);

  const baseAnnIds = await ensureBaseAnnouncements();

  for (let i = 0; i < ANNS_N; i++) {
    const type = pickAnnouncementType();
    const title =
      type === 'RECRUITMENT'
        ? `Open Recruitment ${faker.word.noun()}`
        : type === 'SPARRING'
          ? `Sparring ${toTitleCase(faker.word.adjective())}`
          : type === 'TRAINING'
            ? `Latihan ${toTitleCase(faker.word.adjective())}`
            : toTitleCase(faker.lorem.words({ min: 2, max: 4 }));

    const location = faker.helpers.arrayElement(LOC_POOL);
    const q = encodeURIComponent(location);
    const locationLink = faker.datatype.boolean()
      ? `https://www.google.com/maps/search/?api=1&query=${q}`
      : null;
    const imageUrl = faker.datatype.boolean()
      ? `https://picsum.photos/seed/ann-${faker.string.uuid()}/800/400`
      : null;

    const dt = faker.date.between({
      from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await prisma.announcement.create({
      data: {
        title,
        type,
        datetime: dt,
        location,
        locationLink,
        imageUrl,
        createdBy: anyUser(),
        createdAt: faker.date.recent({ days: 60 }),
      },
    });
  }

  for (let i = 0; i < BLOGS_N; i++) {
    const base = faker.lorem.words({ min: 3, max: 6 });
    const title = toTitleCase(base);
    const slug = uniqueSlug(title);
    const content = [
      `# ${title}`,
      '',
      faker.lorem.paragraphs({ min: 2, max: 3 }, '\n\n'),
      '',
      '## Section',
      '',
      faker.lorem.paragraphs({ min: 2, max: 4 }, '\n\n'),
      '',
      `> ${faker.lorem.sentence({ min: 8, max: 14 })}`,
    ].join('\n');

    const tags = faker.helpers.arrayElements(TAG_POOL, { min: 1, max: 4 });
    const published = faker.datatype.boolean({ probability: 0.6 });

    await prisma.blog.create({
      data: {
        title,
        slug,
        content,
        coverUrl: faker.datatype.boolean()
          ? `https://picsum.photos/seed/blog-${faker.string.uuid()}/1200/630`
          : null,
        tags,
        createdBy: anyUser(),
        published,
        createdAt: faker.date.recent({ days: 90 }),
      },
    });
  }

  await seedAttendanceForAnnouncements(baseAnnIds);

  console.log(
    'Done.',
    `\nAdmin (Zidan) : ${zidan.email}`,
    `\nUsers         : ${users.length - 1}`,
    `\nAnnouncements : ${await prisma.announcement.count()}`,
    `\nBlogs         : ${await prisma.blog.count()}`,
    `\nSessions      : ${await prisma.attendanceSession.count()}`,
    `\nAttendances   : ${await prisma.attendance.count()}`,
  );
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
