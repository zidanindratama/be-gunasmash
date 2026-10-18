import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import type { Role, AnnouncementType, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIG = {
  USERS_COUNT: 20,
  ANNOUNCEMENTS_COUNT: 15,
  BLOGS_COUNT: 10,
  ATTENDANCE_RATE: 0.8,
};

const TEST_ACCOUNTS = {
  admin: { name: 'GunaSmash Admin', email: 'admin@gmail.com' },
  member: { name: 'GunaSmash Member', email: 'member@gmail.com' },
  password: 'password',
};

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export function createSlug(title: string, now: () => number = Date.now) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') +
    '-' +
    now().toString(36)
  );
}

export function pickAttendanceStatus(random: () => number = Math.random): AttendanceStatus {
  const rand = random();
  if (rand < 0.75) return 'PRESENT';
  if (rand < 0.85) return 'LATE';
  if (rand < 0.95) return 'EXCUSED';
  return 'ABSENT';
}

export async function seedDatabase(dependencies: {
  prismaClient?: PrismaClient;
  fakerApi?: typeof faker;
  hashPassword?: typeof bcrypt.hash;
  now?: () => number;
  random?: () => number;
  log?: (...args: unknown[]) => void;
} = {}) {
  const client = dependencies.prismaClient ?? prisma;
  const fake = dependencies.fakerApi ?? faker;
  const hashPassword = dependencies.hashPassword ?? bcrypt.hash;
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const log = dependencies.log ?? console.log;
  log('🌱 Starting seeding...');

  await client.attendance.deleteMany();
  await client.attendanceSession.deleteMany();
  await client.announcement.deleteMany();
  await client.blog.deleteMany();
  await client.user.deleteMany();

  log('🧹 Database cleaned.');

  const passwordHash = await hashPassword('password123', 10);
  const testPasswordHash = await hashPassword(TEST_ACCOUNTS.password, 10);

  const admin = await client.user.create({
    data: {
      name: TEST_ACCOUNTS.admin.name,
      email: TEST_ACCOUNTS.admin.email,
      password: testPasswordHash,
      role: 'ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
  });

  await client.user.create({
    data: {
      name: TEST_ACCOUNTS.member.name,
      email: TEST_ACCOUNTS.member.email,
      password: testPasswordHash,
      role: 'MEMBER',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member',
    },
  });

  log(`👤 Created test accounts: ${TEST_ACCOUNTS.admin.email}, ${TEST_ACCOUNTS.member.email}`);

  const usersData = Array.from({ length: CONFIG.USERS_COUNT }).map(() => {
    const firstName = fake.person.firstName();
    const lastName = fake.person.lastName();
    return {
      name: `${firstName} ${lastName}`,
      email: fake.internet.email({ firstName, lastName }).toLowerCase(),
      password: passwordHash,
      role: 'MEMBER' as Role,
      avatarUrl: fake.image.avatar(),
    };
  });

  await client.user.createMany({ data: usersData });
  const allUsers = await client.user.findMany();
  const members = allUsers.filter((u) => u.role === 'MEMBER');

  log(`👥 Created ${members.length} members.`);

  const announcementTypes: AnnouncementType[] = [
    'TRAINING',
    'SPARRING',
    'TOURNAMENT',
    'INFO',
    'EVENT',
  ];

  for (let i = 0; i < CONFIG.ANNOUNCEMENTS_COUNT; i++) {
    const type = fake.helpers.arrayElement(announcementTypes);
    const title =
      type === 'TRAINING'
        ? `Latihan Rutin ${fake.date.weekday()}`
        : toTitleCase(fake.lorem.words(3));

    const datetime = fake.date.between({
      from: new Date(now() - 60 * 24 * 60 * 60 * 1000),
      to: new Date(now() + 30 * 24 * 60 * 60 * 1000),
    });

    const announcement = await client.announcement.create({
      data: {
        title,
        type,
        datetime,
        location: fake.location.streetAddress(),
        locationLink: fake.datatype.boolean() ? 'https://maps.google.com' : null,
        imageUrl: fake.image.urlLoremFlickr({ category: 'sports' }),
        content: fake.lorem.paragraphs(2),
        createdBy: admin.id,
      },
    });

    if (datetime < new Date()) {
      const sessionDate = new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate());

      const session = await client.attendanceSession.create({
        data: {
          announcementId: announcement.id,
          date: sessionDate,
          state: 'CLOSED',
          openedAt: datetime,
          closedAt: new Date(datetime.getTime() + 3 * 60 * 60 * 1000),
        },
      });

      const attendees = fake.helpers.arrayElements(
        members,
        Math.floor(members.length * CONFIG.ATTENDANCE_RATE),
      );

      const attendanceData = attendees.map((member) => ({
        sessionId: session.id,
        userId: member.id,
        status: pickAttendanceStatus(random),
        note: fake.datatype.boolean() ? fake.lorem.sentence() : null,
      }));

      await client.attendance.createMany({ data: attendanceData });
    }
  }

  log(`📢 Created ${CONFIG.ANNOUNCEMENTS_COUNT} announcements & attendance records.`);

  for (let i = 0; i < CONFIG.BLOGS_COUNT; i++) {
    const title = fake.lorem.sentence({ min: 3, max: 6 }).replace('.', '');

    await client.blog.create({
      data: {
        title,
        slug: createSlug(title, now),
        content: `
# ${title}

${fake.lorem.paragraphs(2)}

## Detail

${fake.lorem.paragraphs(3)}
        `,
        coverUrl: fake.image.urlLoremFlickr({ category: 'abstract' }),
        tags: fake.helpers.arrayElements(['tips', 'latihan', 'turnamen', 'kesehatan'], {
          min: 1,
          max: 3,
        }),
        published: fake.datatype.boolean(),
        createdBy: admin.id,
      },
    });
  }

  log(`📝 Created ${CONFIG.BLOGS_COUNT} blogs.`);
  log('✅ Seeding completed.');
}


async function main() {
  try {
    await seedDatabase({ prismaClient: prisma });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
