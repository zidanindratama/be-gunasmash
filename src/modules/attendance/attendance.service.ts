import { Prisma, AttendanceStatus } from '@prisma/client';
import {
  isNowWithinAnnouncementWindow,
  normalizeLocalDate,
  parseTimeRangeToDates,
} from '../common/time/announcement-window';
import { prisma } from '../prisma/client';
import { SessionQueryDto } from '../common/validators/schemas';

async function getOrCreateSession(announcementId: string, date?: Date) {
  const base = date ?? new Date();
  const sessionDate = normalizeLocalDate(base);

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
  if (!isNowWithinAnnouncementWindow(ann.day, ann.time, now)) {
    const err: any = new Error('Attendance is closed for this schedule');
    err.status = 403;
    throw err;
  }

  const { targetDate } = parseTimeRangeToDates(ann.day, ann.time, now);
  const session = await getOrCreateSession(announcementId, targetDate);

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

  let base = new Date();
  if (params.date) {
    const [y, m, d] = params.date.split('-').map(Number);
    base = new Date(y, (m || 1) - 1, d || 1);
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

  let base = new Date();
  if (query.date) {
    const [y, m, d] = query.date.split('-').map(Number);
    base = new Date(y, (m || 1) - 1, d || 1);
  }

  const sessionDate = normalizeLocalDate(base);
  const session = await prisma.attendanceSession.findUnique({
    where: { announcementId_date: { announcementId: query.announcementId, date: sessionDate } },
    include: { items: { include: { user: true } } },
  });

  const totalMembers = await prisma.user.count({ where: { role: 'MEMBER' } });
  const presentIds = new Set<string>((session?.items ?? []).map((i) => i.userId));

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const presentUsers = await prisma.user.findMany({
    where: { id: { in: Array.from(presentIds) as string[] } },
    select: { id: true, name: true, email: true },
    skip,
    take: limit,
    orderBy: { name: 'asc' },
  });

  const absentUsers = await prisma.user.findMany({
    where: { role: 'MEMBER', id: { notIn: Array.from(presentIds) as string[] } },
    select: { id: true, name: true, email: true },
    skip,
    take: limit,
    orderBy: { name: 'asc' },
  });

  return {
    session: session
      ? {
          id: session.id,
          date: session.date,
          openedAt: session.openedAt,
          closedAt: session.closedAt,
        }
      : null,
    counts: {
      totalMembers,
      present: presentIds.size,
      absent: Math.max(0, totalMembers - presentIds.size),
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
