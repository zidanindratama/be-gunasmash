import { Router } from 'express';
import { ZodError } from 'zod';
import { getAttendanceStatsBySession, getGlobalStats } from './stats.service.js';
import { ok } from '../common/http/response.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import { AttendanceStatsQuerySchema } from '../common/validators/schemas.js';

export const statsRouter = Router();

statsRouter.get('/', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await getGlobalStats();
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

statsRouter.get('/attendance', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = AttendanceStatsQuerySchema.parse(req.query);
    const data = await getAttendanceStatsBySession(dto.announcementId, dto.date);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ success: false, error: e.flatten() });
    next(e);
  }
});
