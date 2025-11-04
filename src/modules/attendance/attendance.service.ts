import { AttendanceStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import type { SessionQueryDto } from '../common/validators/schemas.js';
import {
  isSameLocalDate,
  normalizeLocalDate,
  parseYMD,
} from '../common/time/announcement-window.js';

async function getOrCreateSession(announcementId: string, date: Date) {
  const sessionDate = normalizeLocalDate(date);
  let session = await prisma.attendanceSession.findUnique({
    where: { announcementId_date: { announcementId, date: sessionDate } },
  });
  if (!session) {
    session = await prisma.attendanceSession.create({
      data: { announcementId, date: sessionDate, openedAt: new Date() },
    });
  }
  return session;
}

export async function memberCheckIn(userId: string, announcementId: string, note?: string) {
  const ann = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!ann) {
    const err: any = new Error('Announcement not found');
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const annDate = new Date(ann.datetime);
  if (!isSameLocalDate(now, annDate)) {
    const err: any = new Error('Attendance is closed for this schedule');
    err.status = 403;
    throw err;
  }

  const session = await getOrCreateSession(announcementId, annDate);

  const att = await prisma.attendance.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId } },
    update: { status: AttendanceStatus.PRESENT, note },
    create: { sessionId: session.id, userId, status: AttendanceStatus.PRESENT, note },
  });

  return { session, attendance: att };
}

export async function adminCheckIn(params: {
  adminId: string;
  announcementId: string;
  userId: string;
  date?: string;
  status?: AttendanceStatus;
  note?: string;
}) {
  const ann = await prisma.announcement.findUnique({ where: { id: params.announcementId } });
  if (!ann) {
    const err: any = new Error('Announcement not found');
    err.status = 404;
    throw err;
  }

  let base = new Date(ann.datetime);
  if (params.date) {
    const parsed = parseYMD(params.date);
    if (!parsed) {
      const err: any = new Error('Invalid date format. Use YYYY or YYYY-MM or YYYY-MM-DD');
      err.status = 400;
      throw err;
    }
    base = parsed;
  }

  const session = await getOrCreateSession(params.announcementId, base);

  const att = await prisma.attendance.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: params.userId } },
    update: { status: params.status ?? AttendanceStatus.PRESENT, note: params.note },
    create: {
      sessionId: session.id,
      userId: params.userId,
      status: params.status ?? AttendanceStatus.PRESENT,
      note: params.note,
    },
  });

  return { session, attendance: att };
}

export async function sessionSummary(query: SessionQueryDto) {
  const ann = await prisma.announcement.findUnique({ where: { id: query.announcementId } });
  if (!ann) {
    const err: any = new Error('Announcement not found');
    err.status = 404;
    throw err;
  }

  let base = new Date(ann.datetime);
  if (query.date) {
    const parsed = parseYMD(query.date);
    if (!parsed) {
      const err: any = new Error('Invalid date format. Use YYYY or YYYY-MM or YYYY-MM-DD');
      err.status = 400;
      throw err;
    }
    base = parsed;
  }

  const sessionDate = normalizeLocalDate(base);

  const session = await prisma.attendanceSession.findUnique({
    where: { announcementId_date: { announcementId: query.announcementId, date: sessionDate } },
    select: { id: true, date: true, state: true, openedAt: true, closedAt: true },
  });

  const totalMembers = await prisma.user.count({ where: { role: 'MEMBER' } });

  if (!session) {
    return {
      session: null,
      counts: { totalMembers, present: 0, absent: totalMembers },
      presentUsers: [],
      absentUsers: await prisma.user.findMany({
        where: { role: 'MEMBER' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
        take: query.limit ?? 20,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
      }),
    };
  }

  const attRows = await prisma.attendance.findMany({
    where: { sessionId: session.id },
    select: { userId: true },
  });

  const presentIds = Array.from(new Set(attRows.map((r) => r.userId)));

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const presentUsers = presentIds.length
    ? await prisma.user.findMany({
        where: { id: { in: presentIds } },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      })
    : [];

  const absentUsers = await prisma.user.findMany({
    where: { role: 'MEMBER', id: { notIn: presentIds } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    skip,
    take: limit,
  });

  return {
    session,
    counts: {
      totalMembers,
      present: presentIds.length,
      absent: Math.max(0, totalMembers - presentIds.length),
    },
    presentUsers,
    absentUsers,
  };
}

export async function exportSessionCsv(query: SessionQueryDto) {
  const sum = await sessionSummary(query);
  const lines = [
    'type,name,email',
    ...sum.presentUsers.map((u) => `present,${csvSafe(u.name)},${csvSafe(u.email)}`),
    ...sum.absentUsers.map((u) => `absent,${csvSafe(u.name)},${csvSafe(u.email)}`),
  ];
  return lines.join('\n');
}

function csvSafe(v?: string | null) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
