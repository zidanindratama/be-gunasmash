import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { PrismaClient, AttendanceStatus } from '@prisma/client';
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

const SESSIONS_PAST = Number(process.env.SESSIONS_PAST ?? 1);
const SESSIONS_THIS = Number(process.env.SESSIONS_THIS ?? 1);
const SESSIONS_NEXT = Number(process.env.SESSIONS_NEXT ?? 1);
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

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function randomTimeRange() {
  const startH = faker.number.int({ min: 6, max: 19 });
  const endH = faker.number.int({ min: startH + 1, max: Math.min(startH + 4, 21) });
  const mins = [0, 30];
  const m1 = faker.helpers.arrayElement(mins);
  const m2 = faker.helpers.arrayElement(mins);
  return `${pad(startH)}.${pad(m1)}–${pad(endH)}.${pad(m2)}`;
}

const DAY_POOL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
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

const ID_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function normalizeLocalDate(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function nextDow(base: Date, targetDow: number) {
  const diff = (targetDow - base.getDay() + 7) % 7;
  const t = new Date(base);
  t.setDate(base.getDate() + diff);
  return normalizeLocalDate(t);
}
function getOccurrenceDates(dayName: string) {
  const dow = ID_DAYS.indexOf(dayName);
  const today = new Date();
  const todayNorm = normalizeLocalDate(today);
  const thisWeek = nextDow(today, dow);
  const pasts: Date[] = [];
  const nexts: Date[] = [];

  for (let i = SESSIONS_PAST; i >= 1; i--) {
    const d = new Date(thisWeek);
    d.setDate(thisWeek.getDate() - 7 * i);
    pasts.push(normalizeLocalDate(d));
  }

  const thisOnes =
    SESSIONS_THIS > 0
      ? [
          thisWeek.getTime() > todayNorm.getTime()
            ? normalizeLocalDate(thisWeek)
            : normalizeLocalDate(thisWeek),
        ]
      : [];

  for (let i = 0; i < SESSIONS_NEXT; i++) {
    const d = new Date(thisWeek);
    d.setDate(thisWeek.getDate() + 7 * (i + 1));
    nexts.push(normalizeLocalDate(d));
  }
  return [...pasts, ...thisOnes, ...nexts];
}
function pickStatus(): AttendanceStatus {
  const r = Math.random();
  if (r < ATT_PRESENT_RATE) return AttendanceStatus.PRESENT;
  if (r < ATT_PRESENT_RATE + ATT_LATE_RATE) return AttendanceStatus.LATE;
  if (r < ATT_PRESENT_RATE + ATT_LATE_RATE + ATT_EXCUSED_RATE) return AttendanceStatus.EXCUSED;
  return AttendanceStatus.PRESENT;
}

async function ensureBaseAnnouncements() {
  const base = [
    {
      day: 'Rabu',
      time: '15.00–18.00',
      location: 'Sport Center Kampus H',
      locationLink: 'https://www.google.com/maps/search/?api=1&query=Sport%20Center%20Kampus%20H',
    },
    {
      day: 'Minggu',
      time: '11.00–14.00',
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
  for (const b of base) {
    const found = await prisma.announcement.findFirst({
      where: { day: b.day, time: b.time, location: b.location },
      select: { id: true },
    });
    if (found?.id) {
      ids.push(found.id);
      continue;
    }
    const created = await prisma.announcement.create({
      data: {
        day: b.day,
        time: b.time,
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
    const dates = getOccurrenceDates(ann.day);
    for (const date of dates) {
      const session = await prisma.attendanceSession.upsert({
        where: { announcementId_date: { announcementId: ann.id, date } },
        create: { announcementId: ann.id, date, openedAt: new Date(date) },
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
            createdAt: new Date(date),
          },
          update: {},
        });
      }
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
    const email = `${local}+${Date.now().toString(36)}${faker.string
      .alphanumeric(3)
      .toLowerCase()}@${domain}`;

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
    const day = faker.helpers.arrayElement(DAY_POOL);
    const time = randomTimeRange();
    const location = faker.helpers.arrayElement(LOC_POOL);
    const q = encodeURIComponent(location);
    const locationLink = faker.datatype.boolean()
      ? `https://www.google.com/maps/search/?api=1&query=${q}`
      : null;
    const imageUrl = faker.datatype.boolean()
      ? `https://picsum.photos/seed/ann-${faker.string.uuid()}/800/400`
      : null;

    await prisma.announcement.create({
      data: {
        day,
        time,
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
