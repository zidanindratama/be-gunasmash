import { parseListQuery, shapeList } from '../common/utils/query.js';
import { prisma } from '../prisma/client.js';

import type { Prisma } from '@prisma/client';

type RemoveUserOpts = {
  force?: boolean;
  reassignTo?: string | null;
};

export async function listUsers(q: any) {
  const { page, limit, skip, search, orderBy, where } = parseListQuery(q);
  const cond: Prisma.UserWhereInput = { ...where };
  if (search)
    cond.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: cond,
      skip,
      take: limit,
      orderBy: orderBy || { createdAt: 'desc' },
    }),
    prisma.user.count({ where: cond }),
  ]);
  const shaped = shapeList(
    items.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    total,
    page,
    limit,
  );
  return shaped;
}

export async function getUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw Object.assign(new Error('User not found'), { status: 404 });
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl };
}

export async function updateUserRole(id: string, role: 'ADMIN' | 'MEMBER') {
  const u = await prisma.user.update({ where: { id }, data: { role } });
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function removeUser(id: string, opts: RemoveUserOpts = {}) {
  const { force = false, reassignTo = null } = opts;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  if (reassignTo && reassignTo === id) {
    throw Object.assign(new Error('Cannot reassign to the same user'), { status: 400 });
  }

  if (reassignTo) {
    const target = await prisma.user.findUnique({ where: { id: reassignTo } });
    if (!target) throw Object.assign(new Error('Reassign target not found'), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const [attCount, annCount, blogCount] = await Promise.all([
      tx.attendance.count({ where: { userId: id } }),
      tx.announcement.count({ where: { createdBy: id } }),
      tx.blog.count({ where: { createdBy: id } }),
    ]);

    if (!force && !reassignTo && (attCount || annCount || blogCount)) {
      const err = Object.assign(new Error('User has related records'), {
        status: 409,
        details: { attendances: attCount, announcements: annCount, blogs: blogCount },
      });
      throw err;
    }

    await tx.attendance.deleteMany({ where: { userId: id } });

    if (reassignTo) {
      await Promise.all([
        tx.announcement.updateMany({ where: { createdBy: id }, data: { createdBy: reassignTo } }),
        tx.blog.updateMany({ where: { createdBy: id }, data: { createdBy: reassignTo } }),
      ]);
    } else if (force) {
      if (annCount) {
        const anns = await tx.announcement.findMany({
          where: { createdBy: id },
          select: { id: true },
        });
        const annIds = anns.map((a) => a.id);

        if (annIds.length) {
          const sessions = await tx.attendanceSession.findMany({
            where: { announcementId: { in: annIds } },
            select: { id: true },
          });
          const sessIds = sessions.map((s) => s.id);

          if (sessIds.length) {
            await tx.attendance.deleteMany({ where: { sessionId: { in: sessIds } } });
            await tx.attendanceSession.deleteMany({ where: { id: { in: sessIds } } });
          }
          await tx.announcement.deleteMany({ where: { id: { in: annIds } } });
        }
      }

      if (blogCount) {
        await tx.blog.deleteMany({ where: { createdBy: id } });
      }
    }

    await tx.user.delete({ where: { id } });

    return {};
  });
}

export async function removeUserAuto(id: string, actorId: string) {
  if (id === actorId) {
    throw Object.assign(new Error('You cannot delete yourself'), { status: 400 });
  }

  const actor = await prisma.user.findUnique({ where: { id: actorId } });
  if (!actor) throw Object.assign(new Error('Actor not found'), { status: 400 });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  return prisma.$transaction(async (tx) => {
    const [attCount, annCount, blogCount] = await Promise.all([
      tx.attendance.count({ where: { userId: id } }),
      tx.announcement.count({ where: { createdBy: id } }),
      tx.blog.count({ where: { createdBy: id } }),
    ]);

    if (attCount) {
      await tx.attendance.deleteMany({ where: { userId: id } });
    }

    if (annCount) {
      await tx.announcement.updateMany({ where: { createdBy: id }, data: { createdBy: actorId } });
    }
    if (blogCount) {
      await tx.blog.updateMany({ where: { createdBy: id }, data: { createdBy: actorId } });
    }

    await tx.user.delete({ where: { id } });

    return {
      removedAttendances: attCount,
      reassigned: {
        announcements: annCount,
        blogs: blogCount,
        toUserId: actorId,
      },
    };
  });
}
