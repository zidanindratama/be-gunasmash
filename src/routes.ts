import { Router } from 'express';

import { announcementsRouter } from './modules/announcements/announcements.controller';
import { authRouter } from './modules/auth/auth.controller';
import { blogsRouter } from './modules/blogs/blogs.controller';
import { uploadRouter } from './modules/uploads/upload.controller';
import { usersRouter } from './modules/users/users.controller';
import { attendanceRouter } from './modules/attendance/attendance.controller';
import { statsRouter } from './modules/stats/stats.controller';

export const router = Router();
router.use('/stats', statsRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/announcements', announcementsRouter);
router.use('/attendance', attendanceRouter);
router.use('/blogs', blogsRouter);
router.use('/uploads', uploadRouter);
