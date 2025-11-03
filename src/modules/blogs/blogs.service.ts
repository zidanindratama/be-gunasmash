import { parseListQuery, shapeList } from '../common/utils/query';
import { prisma } from '../prisma/client';

import type { Prisma } from '@prisma/client';

export async function listBlogs(q: any) {
  const { page, limit, skip, search, orderBy, where } = parseListQuery(q);
  const cond: Prisma.BlogWhereInput = { ...where };
  if (search)
    cond.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
    ];
  const [items, total] = await Promise.all([
    prisma.blog.findMany({
      where: cond,
      skip,
      take: limit,
      orderBy: orderBy || { createdAt: 'desc' },
    }),
    prisma.blog.count({ where: cond }),
  ]);
  const shaped = shapeList(items, total, page, limit);
  return shaped;
}

export async function createBlog(
  input: {
    title: string;
    slug: string;
    content: string;
    coverUrl?: string | null;
    tags: string[];
    published: boolean;
  },
  userId: string,
) {
  const blog = await prisma.blog.create({
    data: { ...input, coverUrl: input.coverUrl || null, createdBy: userId },
  });
  return blog;
}

export async function getBlog(id: string) {
  const blog = await prisma.blog.findUnique({ where: { id } });
  if (!blog) throw Object.assign(new Error('Blog not found'), { status: 404 });
  return blog;
}

export async function updateBlog(
  id: string,
  input: Partial<{
    title: string;
    slug: string;
    content: string;
    coverUrl?: string | null;
    tags: string[];
    published: boolean;
  }>,
) {
  const blog = await prisma.blog.update({ where: { id }, data: input });
  return blog;
}

export async function removeBlog(id: string) {
  await prisma.blog.delete({ where: { id } });
  return {};
}
