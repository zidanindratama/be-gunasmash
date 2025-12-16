import type { Prisma } from '@prisma/client';

import { parseListQuery, shapeList } from '../common/utils/query.js';
import { prisma } from '../prisma/client.js';

export async function listBlogs(q: any) {
  const { page, limit, skip, search, orderBy, where } = parseListQuery(q);

  const cond: Prisma.BlogWhereInput = { ...where };

  if (search) {
    cond.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
    ];
  }

  if (cond.published !== undefined) {
    const val = Array.isArray(cond.published) ? cond.published[0] : cond.published;

    if (String(val) === 'true') {
      cond.published = true;
    } else if (String(val) === 'false') {
      cond.published = false;
    } else {
      delete cond.published;
    }
  }

  const [items, total] = await Promise.all([
    prisma.blog.findMany({
      where: cond,
      skip,
      take: limit,
      orderBy: orderBy || { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }),
    prisma.blog.count({ where: cond }),
  ]);

  const shaped = shapeList(
    items.map((b) => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      content: b.content,
      coverUrl: b.coverUrl,
      tags: b.tags,
      published: b.published,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      author: b.author
        ? {
            id: b.author.id,
            name: b.author.name,
            avatarUrl: b.author.avatarUrl,
          }
        : null,
    })),
    total,
    page,
    limit,
  );

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

export async function getBlog(slug: string) {
  const blog = await prisma.blog.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });
  if (!blog) throw Object.assign(new Error('Blog not found'), { status: 404 });
  return blog;
}

export async function updateBlog(
  slug: string,
  input: Partial<{
    title: string;
    slug: string;
    content: string;
    coverUrl?: string | null;
    tags: string[];
    published: boolean;
  }>,
) {
  const blog = await prisma.blog.update({ where: { slug }, data: input });
  return blog;
}

export async function removeBlog(slug: string) {
  await prisma.blog.delete({ where: { slug } });
  return {};
}
