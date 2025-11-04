import bcrypt from 'bcryptjs';
import { Router, type Request } from 'express';
import csv from 'fast-csv';
import { Parser } from 'json2csv';
import multer from 'multer';

import { listUsers, getUser, updateUserRole, removeUserAuto } from './users.service.js';
import { authGuard, rolesGuard } from '../common/auth/guards.js';
import { ok } from '../common/http/response.js';
import { PromoteSchema } from '../common/validators/schemas.js';
import { prisma } from '../prisma/client.js';

export const usersRouter = Router();

usersRouter.get('/', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await listUsers(req.query);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

usersRouter.get('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const data = await getUser(req.params.id as string);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

usersRouter.patch('/:id/role', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const dto = PromoteSchema.parse(req.body);
    const data = await updateUserRole(req.params.id as string, dto.role);
    res.json(ok(data));
  } catch (e) {
    next(e);
  }
});

usersRouter.delete('/:id', authGuard, rolesGuard(['ADMIN']), async (req, res, next) => {
  try {
    const u = (req as any).user || {};
    const actorId = u.id ?? u.sub ?? u.userId ?? u.uid;
    if (!actorId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const result = await removeUserAuto(req.params.id as string, actorId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    if (e?.status)
      return res.status(e.status).json({ success: false, error: { message: e.message } });
    next(e);
  }
});

const upload = multer({ storage: multer.memoryStorage() });

function assertFile(req: Request): asserts req is Request & { file: Express.Multer.File } {
  if (!req.file) throw Object.assign(new Error('File required'), { status: 400 });
}

usersRouter.post(
  '/import',
  authGuard,
  rolesGuard(['ADMIN']),
  upload.single('file'),
  async (req, res, next) => {
    try {
      assertFile(req);
      const rows: any[] = [];
      await new Promise<void>((resolve, reject) => {
        csv
          .parseString(req.file.buffer.toString('utf8'), { headers: true, ignoreEmpty: true })
          .on('error', reject)
          .on('data', (r) => rows.push(r))
          .on('end', () => resolve());
      });
      let created = 0;
      for (const r of rows) {
        const name = String(r.name || '').trim();
        const email = String(r.email || '')
          .trim()
          .toLowerCase();
        const passwordRaw = String(r.password || 'password123');
        if (!name || !email) continue;
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) continue;
        const hash = await bcrypt.hash(passwordRaw, 10);
        await prisma.user.create({ data: { name, email, password: hash } });
        created += 1;
      }
      res.json(ok({ created }));
    } catch (e) {
      next(e);
    }
  },
);

usersRouter.get('/export/csv', authGuard, rolesGuard(['ADMIN']), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const data = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    const parser = new Parser({ fields: ['id', 'name', 'email', 'role'] });
    const csvText = parser.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('members.csv');
    res.send(csvText);
  } catch (e) {
    next(e);
  }
});
