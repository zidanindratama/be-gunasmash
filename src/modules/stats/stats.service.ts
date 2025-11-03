import { AttendanceStatus } from '@prisma/client';
import { normalizeLocalDate } from '../common/time/announcement-window.js';
import { prisma } from '../prisma/client.js';

export async function getGlobalStats() {
  const [
    totalUsers,
    totalAdmins,
    totalMembers,
    totalAnnouncements,
    totalBlogs,
    publishedBlogs,
    totalSessions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'MEMBER' } }),
    prisma.announcement.count(),
    prisma.blog.count(),
    prisma.blog.count({ where: { published: true } }),
    prisma.attendanceSession.count(),
  ]);

  const today = normalizeLocalDate(new Date());
  const [todaySessions, upcomingOpenSessions] = await Promise.all([
    prisma.attendanceSession.count({ where: { date: today } }),
    prisma.attendanceSession.count({ where: { date: { gte: today }, state: 'OPEN' } }),
  ]);

  return {
    users: { total: totalUsers, admins: totalAdmins, members: totalMembers },
    announcements: { total: totalAnnouncements },
    blogs: {
      total: totalBlogs,
      published: publishedBlogs,
      unpublished: Math.max(0, totalBlogs - publishedBlogs),
    },
    sessions: { total: totalSessions, today: todaySessions, upcomingOpen: upcomingOpenSessions },
  };
}

export async function getAttendanceStatsBySession(announcementId: string, date?: string) {
  let base = new Date();

  if (date) {
    const [yStr, mStr, dStr] = date.split('-');
    const y = Number(yStr);
    if (!Number.isFinite(y)) {
      throw Object.assign(new Error('Invalid date format. Use YYYY or YYYY-MM or YYYY-MM-DD'), {
        status: 400,
      });
    }
    const m = mStr ? Number(mStr) : 1;
    const d = dStr ? Number(dStr) : 1;

    const mm = Math.min(Math.max(m, 1), 12) - 1;
    const dd = Math.max(d, 1);
    base = new Date(y, mm, dd);
  }

  const sessionDate = normalizeLocalDate(base);

  const session = await prisma.attendanceSession.findUnique({
    where: { announcementId_date: { announcementId, date: sessionDate } },
    select: { id: true, date: true, state: true, openedAt: true, closedAt: true },
  });

  if (!session) {
    const totalMembers = await prisma.user.count({ where: { role: 'MEMBER' } });
    return {
      session: null,
      counts: { present: 0, late: 0, excused: 0, absent: totalMembers },
      totalMembers,
    };
  }

  const [present, late, excused, totalMembers] = await Promise.all([
    prisma.attendance.count({ where: { sessionId: session.id, status: AttendanceStatus.PRESENT } }),
    prisma.attendance.count({ where: { sessionId: session.id, status: AttendanceStatus.LATE } }),
    prisma.attendance.count({ where: { sessionId: session.id, status: AttendanceStatus.EXCUSED } }),
    prisma.user.count({ where: { role: 'MEMBER' } }),
  ]);

  const marked = present + late + excused;
  const absent = Math.max(0, totalMembers - marked);

  return {
    session,
    counts: { present, late, excused, absent },
    totalMembers,
  };
}
