import { Router } from 'express';
import {
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  removeAnnouncement,
  updateAnnouncement,
} from './announcements.service';
import { ok } from '../common/http/response';
import { authGuard, rolesGuard } from '../common/auth/guards';
import { AnnouncementSchema } from '../common/validators/schemas';

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
    const data = await getAnnouncement(req.params.id);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.post('/', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = AnnouncementSchema.parse(req.body);
    const data = await createAnnouncement(dto, (req as any).user.sub);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.patch('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = AnnouncementSchema.partial().parse(req.body);
    const data = await updateAnnouncement(req.params.id, dto);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

announcementsRouter.delete('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await removeAnnouncement(req.params.id);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});
