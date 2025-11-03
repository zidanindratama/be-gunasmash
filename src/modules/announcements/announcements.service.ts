import type { Prisma } from '@prisma/client';
import { parseListQuery, shapeList } from '../common/utils/query.js';
import { prisma } from '../prisma/client.js';

export async function listAnnouncements(q: any) {
  const { page, limit, skip, search, orderBy, where } = parseListQuery(q);

  const cond: Prisma.AnnouncementWhereInput = { ...where };
  if (search) {
    cond.OR = [
      { day: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where: cond,
      skip,
      take: limit,
      orderBy: orderBy || { createdAt: 'desc' },
    }),
    prisma.announcement.count({ where: cond }),
  ]);

  return shapeList(items, total, page, limit);
}

export async function createAnnouncement(
  input: {
    day: string;
    time: string;
    location: string;
    locationLink?: string | null;
    imageUrl?: string | null;
  },
  userId: string,
) {
  const ann = await prisma.announcement.create({
    data: {
      day: input.day,
      time: input.time,
      location: input.location,
      locationLink: input.locationLink ?? null,
      imageUrl: input.imageUrl ?? null,
      createdBy: userId,
    },
  });
  return ann;
}

export async function getAnnouncement(id: string) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) {
    const err: any = new Error('Announcement not found');
    err.status = 404;
    throw err;
  }
  return ann;
}

export async function updateAnnouncement(
  id: string,
  input: Partial<{
    day: string;
    time: string;
    location: string;
    locationLink?: string | null;
    imageUrl?: string | null;
  }>,
) {
  const ann = await prisma.announcement.update({
    where: { id },
    data: {
      ...input,
      locationLink: input.locationLink === undefined ? undefined : (input.locationLink ?? null),
      imageUrl: input.imageUrl === undefined ? undefined : (input.imageUrl ?? null),
    },
  });
  return ann;
}

export async function removeAnnouncement(id: string) {
  await prisma.announcement.delete({ where: { id } });
  return {};
}
