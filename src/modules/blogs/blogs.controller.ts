import { Router } from 'express';

import { createBlog, getBlog, listBlogs, removeBlog, updateBlog } from './blogs.service.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import { ok } from '../common/http/response.js';
import { BlogSchema } from '../common/validators/schemas.js';

export const blogsRouter = Router();

blogsRouter.get('/', async (req, res, next) => {
  try {
    const data = await listBlogs(req.query);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

blogsRouter.get('/:id', async (req, res, next) => {
  try {
    const data = await getBlog(req.params.id);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

blogsRouter.post('/', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = BlogSchema.parse(req.body);
    const data = await createBlog(dto, (req as any).user.sub);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

blogsRouter.patch('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = BlogSchema.partial().parse(req.body);
    const data = await updateBlog(req.params.id as string, dto);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

blogsRouter.delete('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await removeBlog(req.params.id as string);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});
