import { AttendanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import type { SessionQueryDto, AttendanceListQueryDto } from '../common/validators/schemas.js';
import {
  isSameLocalDate,
  normalizeLocalDate,
  parseYMD,
} from '../common/time/announcement-window.js';
import { parseListQuery, shapeList } from '../common/utils/query.js';

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

export async function cancelAttendance(announcementId: string, userId: string) {
  const ann = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!ann) {
    const err: any = new Error('Announcement not found');
    err.status = 404;
    throw err;
  }

  const sessionDate = normalizeLocalDate(new Date(ann.datetime));
  const session = await prisma.attendanceSession.findUnique({
    where: { announcementId_date: { announcementId, date: sessionDate } },
    select: { id: true },
  });

  if (!session) throw new Error('Session not found for this date');

  const result = await prisma.attendance.deleteMany({
    where: {
      sessionId: session.id,
      userId: userId,
    },
  });

  if (result.count === 0) {
    const err: any = new Error('Attendance record not found for cancellation');
    err.status = 404;
    throw err;
  }

  return { message: 'Attendance cancelled successfully' };
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
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const searchFilter: Prisma.UserWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }
    : {};

  if (!session) {
    const absentUsersWhere: Prisma.UserWhereInput = {
      role: 'MEMBER',
      ...searchFilter,
    };

    return {
      session: null,
      counts: { totalMembers, present: 0, absent: totalMembers },
      presentUsers: [],
      absentUsers: await prisma.user.findMany({
        where: absentUsersWhere,
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
        take: limit,
        skip: skip,
      }),
    };
  }

  const attRows = await prisma.attendance.findMany({
    where: { sessionId: session.id },
    select: { userId: true },
  });

  const presentIds = Array.from(new Set(attRows.map((r) => r.userId)));

  const presentUsersWhere: Prisma.UserWhereInput = {
    id: { in: presentIds },
    ...searchFilter,
  };

  const presentUsers = presentIds.length
    ? await prisma.user.findMany({
        where: presentUsersWhere,
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
        skip: skip,
        take: limit,
      })
    : [];

  const absentUsersWhere: Prisma.UserWhereInput = {
    role: 'MEMBER',
    id: { notIn: presentIds },
    ...searchFilter,
  };

  const absentUsers = await prisma.user.findMany({
    where: absentUsersWhere,
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    skip: skip,
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

export async function createSession(
  input: { title: string; date: string; status: 'OPEN' | 'CLOSED' },
  userId: string,
) {
  const dateObj = new Date(input.date);

  const ann = await prisma.announcement.create({
    data: {
      title: input.title,
      type: 'TRAINING',
      datetime: dateObj,
      location: 'TBA',
      content: 'Attendance Session',
      createdBy: userId,
    },
  });

  const sessionDateOnly = normalizeLocalDate(dateObj);

  const session = await prisma.attendanceSession.create({
    data: {
      announcementId: ann.id,
      date: sessionDateOnly,
      state: input.status === 'OPEN' ? 'OPEN' : 'CLOSED',
      openedAt: input.status === 'OPEN' ? dateObj : null,
      closedAt: null,
    },
  });

  return session;
}

export async function listSessions(q: any) {
  const { page, limit, skip, search, orderBy } = parseListQuery(q);

  const where: Prisma.AttendanceSessionWhereInput = {};

  if (search) {
    where.announcement = {
      title: { contains: search, mode: 'insensitive' },
    };
  }

  if (q.status) {
    where.state = q.status;
  }

  const [items, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        announcement: {
          select: { title: true, datetime: true },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.attendanceSession.count({ where }),
  ]);

  const shaped = shapeList(
    items.map((session) => ({
      id: session.id,
      announcementId: session.announcementId,
      title: session.announcement?.title || 'Untitled Session',
      date: session.announcement?.datetime || session.date,
      startTime: session.openedAt,
      endTime: session.closedAt,
      status: session.state,
      _count: {
        attendances: session._count.items,
      },
    })),
    total,
    page,
    limit,
  );

  return shaped;
}

export async function getSessionDetail(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      announcementId: true,
      date: true,
      state: true,
      openedAt: true,
      closedAt: true,
      announcement: {
        select: { title: true, datetime: true },
      },
    },
  });

  if (!session) {
    const err: any = new Error('Attendance Session not found');
    err.status = 404;
    throw err;
  }

  return {
    id: session.id,
    announcementId: session.announcementId,
    title: session.announcement?.title || 'Untitled Session',
    date: session.announcement?.datetime,
    state: session.state,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
  };
}

export async function updateSession(
  id: string,
  input: { title?: string; date?: string; status?: 'OPEN' | 'CLOSED' },
) {
  const existingSession = await prisma.attendanceSession.findUnique({
    where: { id },
  });

  if (!existingSession) throw new Error('Session not found');

  const updates: any = {};
  const announcementUpdates: any = {};

  if (input.date) {
    const dateObj = new Date(input.date);

    updates.date = normalizeLocalDate(dateObj);
    announcementUpdates.datetime = dateObj;

    if (input.status === 'OPEN' || existingSession.state === 'OPEN') {
      updates.openedAt = dateObj;
    }
  }

  if (input.status) {
    updates.state = input.status;
    if (input.status === 'CLOSED') {
      updates.closedAt = new Date();
    } else if (input.status === 'OPEN' && !existingSession.openedAt) {
      updates.openedAt = new Date();
    }
  }

  if (input.title) {
    announcementUpdates.title = input.title;
  }

  const [updatedSession] = await prisma.$transaction([
    prisma.attendanceSession.update({
      where: { id },
      data: updates,
    }),
    prisma.announcement.update({
      where: { id: existingSession.announcementId },
      data: announcementUpdates,
    }),
  ]);

  return updatedSession;
}

export async function removeSession(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, announcementId: true },
  });

  if (!session) {
    const err: any = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { sessionId: session.id } });
    await tx.attendanceSession.delete({ where: { id: session.id } });
    await tx.announcement.delete({ where: { id: session.announcementId } });
  });

  return { message: 'Session and related data deleted successfully' };
}

export async function listMemberSessions(userId: string) {
  const today = normalizeLocalDate(new Date());

  const relevantSessions = await prisma.attendanceSession.findMany({
    where: {
      state: 'OPEN',
      date: { gte: today },
    },
    include: {
      announcement: {
        select: {
          id: true,
          title: true,
          datetime: true,
          location: true,
        },
      },
      items: {
        where: { userId: userId },
        select: { status: true },
      },
    },
    orderBy: { date: 'asc' },
  });

  return relevantSessions
    .map((session) => {
      const isAttended = session.items.length > 0 && session.items[0]?.status === 'PRESENT';

      if (!session.announcement) {
        return null;
      }

      return {
        id: session.announcementId,
        title: session.announcement.title,
        date: session.announcement.datetime,
        location: session.announcement.location,
        isUserAttended: isAttended,
      };
    })
    .filter((item): item is Exclude<typeof item, null> => item !== null);
}
