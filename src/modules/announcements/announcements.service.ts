import type { Prisma, AnnouncementType } from '@prisma/client';
import { parseListQuery, shapeList } from '../common/utils/query.js';
import { prisma } from '../prisma/client.js';

const ANN_TYPES: AnnouncementType[] = [
  'TRAINING',
  'SPARRING',
  'TOURNAMENT',
  'BRIEFING',
  'RECRUITMENT',
  'EVENT',
  'INFO',
];

function isPlaceholder(v: string) {
  const s = v.trim();
  return (
    s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null' || s.includes('{{') // e.g. "{{ann_type}}"
  );
}

function normalizeTypes(input: unknown): AnnouncementType[] {
  const arr = Array.isArray(input) ? input : input != null ? [input] : [];
  const up = arr
    .flatMap((v) => String(v).split(',')) // dukung "TRAINING,EVENT"
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0 && !isPlaceholder(s)) as string[];

  const valid = up.filter((s) => (ANN_TYPES as string[]).includes(s)) as AnnouncementType[];
  return Array.from(new Set(valid));
}

export async function listAnnouncements(q: any) {
  const { page, limit, skip, search, orderBy, where } = parseListQuery(q);
  const cond: Prisma.AnnouncementWhereInput = { ...where };

  if (search) {
    cond.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }

  const types = normalizeTypes(q?.type);
  if (types.length === 1) cond.type = types[0];
  else if (types.length > 1) cond.type = { in: types };

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where: cond,
      skip,
      take: limit,
      orderBy: orderBy || { datetime: 'desc' },
    }),
    prisma.announcement.count({ where: cond }),
  ]);

  return shapeList(items, total, page, limit);
}

export async function createAnnouncement(
  input: {
    title: string;
    type?: AnnouncementType;
    datetime: string;
    location: string;
    locationLink?: string | null;
    imageUrl?: string | null;
  },
  userId: string,
) {
  const ann = await prisma.announcement.create({
    data: {
      title: input.title,
      type: (input.type ?? 'INFO') as AnnouncementType,
      datetime: new Date(input.datetime),
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
    title: string;
    type: AnnouncementType;
    datetime: string;
    location: string;
    locationLink?: string | null;
    imageUrl?: string | null;
  }>,
) {
  const ann = await prisma.announcement.update({
    where: { id },
    data: {
      title: input.title,
      type: input.type,
      datetime: input.datetime === undefined ? undefined : new Date(input.datetime),
      location: input.location,
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
