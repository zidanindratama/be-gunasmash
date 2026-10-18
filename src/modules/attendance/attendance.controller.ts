import { Router } from 'express';
import { ZodError, z } from 'zod';

import {
  adminCheckIn,
  memberCheckIn,
  sessionSummary,
  exportSessionCsv,
  createSession,
  listSessions,
  updateSession,
  removeSession,
  getSessionDetail,
  cancelAttendance,
  listMemberSessions,
} from './attendance.service.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import { ok } from '../common/http/response.js';
import {
  AdminCheckInSchema,
  MemberCheckInSchema,
  SessionQuerySchema,
  CreateSessionSchema,
} from '../common/validators/schemas.js';

export const attendanceRouter = Router();

attendanceRouter.get('/', authGuard, async (req, res, next) => {
  try {
    const data = await listSessions(req.query);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ success: false, error: e.flatten() });
    next(e);
  }
});

attendanceRouter.get('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await getSessionDetail(req.params.id as string);
    res.json(ok(data));
  } catch (e) {
    if ((e as any).status === 404) {
      return res.status(404).json({ success: false, error: { message: (e as Error).message } });
    }
    next(e);
  }
});

attendanceRouter.patch('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(3).optional(),
      date: z.string().datetime().optional(),
      status: z.enum(['OPEN', 'CLOSED']).optional(),
    });

    const dto = schema.parse(req.body);

    const data = await updateSession(req.params.id as string, dto);

    res.json(ok(data));
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ success: false, error: e.flatten() });
    next(e);
  }
});

attendanceRouter.post('/', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = CreateSessionSchema.parse(req.body);
    const userId = (req as any).user.sub ?? (req as any).user.id;
    const data = await createSession(dto, userId);
    res.json(ok(data));
  } catch (e) {
    if (e instanceof ZodError) return res.status(400).json({ success: false, error: e.flatten() });
    next(e);
  }
});

attendanceRouter.post(
  '/check-in',
  authGuard,
  rolesGuard(['ADMIN', 'MEMBER']),
  async (req, res, next) => {
    try {
      const dto = MemberCheckInSchema.parse(req.body);
      const userId = (req as any).user.sub ?? (req as any).user.id;
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
      const adminId = (req as any).user.sub ?? (req as any).user.id;

      if (dto.status === 'ABSENT' && dto.userId && dto.announcementId) {
        const data = await cancelAttendance(dto.announcementId, dto.userId);
        return res.json(ok(data));
      }

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

attendanceRouter.get(
  '/member/sessions',
  authGuard,
  rolesGuard(['MEMBER']),
  async (req, res, next) => {
    try {
      const userId = (req as any).user.sub ?? (req as any).user.id;
      const data = await listMemberSessions(userId);
      res.json(ok({ items: data }));
    } catch (e) {
      next(e);
    }
  },
);

attendanceRouter.delete('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await removeSession(req.params.id as string);
    res.json(ok(data));
  } catch (e) {
    if ((e as any).status === 404) {
      return res.status(404).json({ success: false, error: { message: (e as Error).message } });
    }
    next(e);
  }
});
