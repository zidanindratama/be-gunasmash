import { parseListQuery, shapeList } from '../common/utils/query.js';
import { prisma } from '../prisma/client.js';

import type { Prisma } from '@prisma/client';

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

export async function removeUser(id: string) {
  await prisma.user.delete({ where: { id } });
  return {};
}
