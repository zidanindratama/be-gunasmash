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

function createSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') +
    '-' +
    Date.now().toString(36)
  );
}

function pickAttendanceStatus(): AttendanceStatus {
  const rand = Math.random();
  if (rand < 0.75) return 'PRESENT';
  if (rand < 0.85) return 'LATE';
  if (rand < 0.95) return 'EXCUSED';
  return 'ABSENT';
}

async function main() {
  console.log('🌱 Starting seeding...');

  await prisma.attendance.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Database cleaned.');

  const passwordHash = await bcrypt.hash('password123', 10);
  const testPasswordHash = await bcrypt.hash(TEST_ACCOUNTS.password, 10);

  const admin = await prisma.user.create({
    data: {
      name: TEST_ACCOUNTS.admin.name,
      email: TEST_ACCOUNTS.admin.email,
      password: testPasswordHash,
      role: 'ADMIN',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    },
  });

  await prisma.user.create({
    data: {
      name: TEST_ACCOUNTS.member.name,
      email: TEST_ACCOUNTS.member.email,
      password: testPasswordHash,
      role: 'MEMBER',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=member',
    },
  });

  console.log(`👤 Created test accounts: ${TEST_ACCOUNTS.admin.email}, ${TEST_ACCOUNTS.member.email}`);

  const usersData = Array.from({ length: CONFIG.USERS_COUNT }).map(() => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      name: `${firstName} ${lastName}`,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      password: passwordHash,
      role: 'MEMBER' as Role,
      avatarUrl: faker.image.avatar(),
    };
  });

  await prisma.user.createMany({ data: usersData });
  const allUsers = await prisma.user.findMany();
  const members = allUsers.filter((u) => u.role === 'MEMBER');

  console.log(`👥 Created ${members.length} members.`);

  const announcementTypes: AnnouncementType[] = [
    'TRAINING',
    'SPARRING',
    'TOURNAMENT',
    'INFO',
    'EVENT',
  ];

  for (let i = 0; i < CONFIG.ANNOUNCEMENTS_COUNT; i++) {
    const type = faker.helpers.arrayElement(announcementTypes);
    const title =
      type === 'TRAINING'
        ? `Latihan Rutin ${faker.date.weekday()}`
        : toTitleCase(faker.lorem.words(3));

    const datetime = faker.date.between({
      from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const announcement = await prisma.announcement.create({
      data: {
        title,
        type,
        datetime,
        location: faker.location.streetAddress(),
        locationLink: faker.datatype.boolean() ? 'https://maps.google.com' : null,
        imageUrl: faker.image.urlLoremFlickr({ category: 'sports' }),
        content: faker.lorem.paragraphs(2),
        createdBy: admin.id,
      },
    });

    if (datetime < new Date()) {
      const sessionDate = new Date(datetime.getFullYear(), datetime.getMonth(), datetime.getDate());

      const session = await prisma.attendanceSession.create({
        data: {
          announcementId: announcement.id,
          date: sessionDate,
          state: 'CLOSED',
          openedAt: datetime,
          closedAt: new Date(datetime.getTime() + 3 * 60 * 60 * 1000),
        },
      });

      const attendees = faker.helpers.arrayElements(
        members,
        Math.floor(members.length * CONFIG.ATTENDANCE_RATE),
      );

      const attendanceData = attendees.map((member) => ({
        sessionId: session.id,
        userId: member.id,
        status: pickAttendanceStatus(),
        note: faker.datatype.boolean() ? faker.lorem.sentence() : null,
      }));

      await prisma.attendance.createMany({ data: attendanceData });
    }
  }

  console.log(`📢 Created ${CONFIG.ANNOUNCEMENTS_COUNT} announcements & attendance records.`);

  for (let i = 0; i < CONFIG.BLOGS_COUNT; i++) {
    const title = faker.lorem.sentence({ min: 3, max: 6 }).replace('.', '');

    await prisma.blog.create({
      data: {
        title,
        slug: createSlug(title),
        content: `
# ${title}

${faker.lorem.paragraphs(2)}

## Detail

${faker.lorem.paragraphs(3)}
        `,
        coverUrl: faker.image.urlLoremFlickr({ category: 'abstract' }),
        tags: faker.helpers.arrayElements(['tips', 'latihan', 'turnamen', 'kesehatan'], {
          min: 1,
          max: 3,
        }),
        published: faker.datatype.boolean(),
        createdBy: admin.id,
      },
    });
  }

  console.log(`📝 Created ${CONFIG.BLOGS_COUNT} blogs.`);
  console.log('✅ Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
