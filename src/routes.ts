import { Router } from 'express';

import { announcementsRouter } from './modules/announcements/announcements.controller.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { blogsRouter } from './modules/blogs/blogs.controller.js';
import { uploadRouter } from './modules/uploads/upload.controller.js';
import { usersRouter } from './modules/users/users.controller.js';
import { attendanceRouter } from './modules/attendance/attendance.controller.js';
import { statsRouter } from './modules/stats/stats.controller.js';
import { ok } from './modules/common/http/response.js';
import { env } from './modules/config/env.js';

export const router = Router();

router.get('/', (_req, res) => {
  res.json(
    ok({
      name: 'BE GunaSmash API',
      status: 'ok',
      environment: env.NODE_ENV,
      version: '1.0.0',
      uptime: process.uptime().toFixed(2) + 's',
      timestamp: new Date().toISOString(),
    }),
  );
});

router.use('/api/stats', statsRouter);
router.use('/api/auth', authRouter);
router.use('/api/users', usersRouter);
router.use('/api/announcements', announcementsRouter);
router.use('/api/attendance', attendanceRouter);
router.use('/api/blogs', blogsRouter);
router.use('/api/uploads', uploadRouter);
