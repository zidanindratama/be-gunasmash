import { Router, type Request } from 'express';

import { createBlog, getBlog, listBlogs, removeBlog, updateBlog } from './blogs.service.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import { verifyAccess } from '../common/auth/jwt.js';
import { ok } from '../common/http/response.js';
import { BlogSchema, BlogUpdateSchema } from '../common/validators/schemas.js';

export const blogsRouter = Router();

function canViewUnpublished(req: Request) {
  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;

  try {
    const payload = verifyAccess(token);
    return (
      typeof payload === 'object' && payload !== null && 'role' in payload && payload.role === 'ADMIN'
    );
  } catch {
    return false;
  }
}

blogsRouter.get('/', async (req, res, next) => {
  try {
    const data = await listBlogs(req.query, canViewUnpublished(req));
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

blogsRouter.get('/:slug', async (req, res, next) => {
  try {
    const data = await getBlog(req.params.slug as string);
    if (!data.published && !canViewUnpublished(req)) {
      return res.status(404).json({ success: false, error: { message: 'Blog not found' } });
    }
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

blogsRouter.patch('/:slug', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = BlogUpdateSchema.parse(req.body);
    const data = await updateBlog(req.params.slug as string, dto);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

blogsRouter.delete('/:slug', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await removeBlog(req.params.slug as string);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});
