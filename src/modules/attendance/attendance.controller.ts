import { Router } from 'express';
import { ZodError } from 'zod';
import {
  adminCheckIn,
  memberCheckIn,
  sessionSummary,
  exportSessionCsv,
} from './attendance.service.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import {
  AdminCheckInSchema,
  MemberCheckInSchema,
  SessionQuerySchema,
} from '../common/validators/schemas.js';
import { ok } from '../common/http/response.js';

export const attendanceRouter = Router();

attendanceRouter.post(
  '/check-in',
  authGuard,
  rolesGuard(['ADMIN', 'MEMBER']),
  async (req, res, next) => {
    try {
      const dto = MemberCheckInSchema.parse(req.body);
      const userId = (req as any).user.sub as string;
      const data = await memberCheckIn(userId, dto.announcementId, dto.note);
      res.json(ok(data));
    } catch (e) {
      if (e instanceof ZodError)
        return res.status(400).json({ success: false, error: e.flatten() });
      next(e);
    }
  },
);

attendanceRouter.post(
  '/admin/check-in',
  authGuard,
  rolesGuard(['ADMIN']),
  async (req, res, next) => {
    try {
      const dto = AdminCheckInSchema.parse(req.body);
      const adminId = (req as any).user.sub as string;
      const data = await adminCheckIn({
        adminId,
        announcementId: dto.announcementId,
        userId: dto.userId,
        date: dto.date,
        status: dto.status,
        note: dto.note,
      });
      res.json(ok(data));
    } catch (e) {
      if (e instanceof ZodError)
        return res.status(400).json({ success: false, error: e.flatten() });
      next(e);
    }
  },
);

attendanceRouter.get(
  '/session/summary',
  authGuard,
  rolesGuard(['ADMIN']),
  async (req, res, next) => {
    try {
      const dto = SessionQuerySchema.parse(req.query);
      const data = await sessionSummary(dto);
      res.json(ok(data));
    } catch (e) {
      next(e);
    }
  },
);

attendanceRouter.get(
  '/session/export',
  authGuard,
  rolesGuard(['ADMIN']),
  async (req, res, next) => {
    try {
      const dto = SessionQuerySchema.parse(req.query);
      const csv = await exportSessionCsv(dto);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance-${dto.announcementId}-${dto.date ?? 'today'}.csv"`,
      );
      res.send(csv);
    } catch (e) {
      next(e);
    }
  },
);
