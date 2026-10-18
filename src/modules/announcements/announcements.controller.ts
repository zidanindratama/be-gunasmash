import { Router } from 'express';

import {
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  removeAnnouncement,
  updateAnnouncement,
} from './announcements.service.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import { ok } from '../common/http/response.js';
import { AnnouncementSchema, AnnouncementUpdateSchema, MongoIdSchema } from '../common/validators/schemas.js';

export const announcementsRouter = Router();

announcementsRouter.get('/', async (req, res, next) => {
  try {
    const data = await listAnnouncements(req.query);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = MongoIdSchema.parse(req.params.id);
    const data = await getAnnouncement(id);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.post('/', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = AnnouncementSchema.parse(req.body);
    const userId = (req as any).user.sub ?? (req as any).user.id;
    const data = await createAnnouncement(dto, userId);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.patch('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const id = MongoIdSchema.parse(req.params.id);
    const dto = AnnouncementUpdateSchema.parse(req.body);
    const data = await updateAnnouncement(id, dto);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.delete('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const id = MongoIdSchema.parse(req.params.id);
    const data = await removeAnnouncement(id);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});
