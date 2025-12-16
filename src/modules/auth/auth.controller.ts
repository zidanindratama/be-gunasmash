import { Router } from 'express';

import { signUp, issueTokens, updateMyProfile } from './auth.service.js';
import { passport } from './passport-local.js';
import { authGuard } from '../common/auth/guards.js';
import { verifyRefresh } from '../common/auth/jwt.js';
import { ok } from '../common/http/response.js';
import { SignInSchema, SignUpSchema } from '../common/validators/schemas.js';
import { prisma } from '../prisma/client.js';
import z, { ZodError } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? ('lax' as const) : undefined,
  secure: isProduction,
  path: '/',
};

type Role = 'ADMIN' | 'MEMBER';

function isJwtPayload(v: unknown): v is { sub: string; role: Role } {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as any).sub === 'string' &&
    ((v as any).role === 'ADMIN' || (v as any).role === 'MEMBER')
  );
}

export const authRouter = Router();

authRouter.post('/sign-up', async (req, res, next) => {
  try {
    const dto = SignUpSchema.parse(req.body);
    const out = await signUp({ name: dto.name, email: dto.email, password: dto.password });
    res.cookie('refreshToken', out.refreshToken, cookieOptions);
    res.json(ok({ accessToken: out.accessToken, user: out.user }));
  } catch (e) {
    next(e);
  }
});

authRouter.post('/sign-in', (req, res, next) => {
  try {
    SignInSchema.parse(req.body);
  } catch (e) {
    return next(Object.assign(new Error('Validation error'), { status: 400 }));
  }
  passport.authenticate('local', async (err: unknown, u: any) => {
    try {
      if (err) throw err;
      if (!u) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
      const out = await issueTokens(u.id as string);
      res.cookie('refreshToken', out.refreshToken, cookieOptions);
      res.json(ok({ accessToken: out.accessToken, user: out.user }));
    } catch (e2) {
      next(e2);
    }
  })(req, res, next);
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    const payload = verifyRefresh(token);
    if (!isJwtPayload(payload)) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    const out = await issueTokens(payload.sub); // Menggunakan cookieOptions yang diperbaiki
    res.cookie('refreshToken', out.refreshToken, cookieOptions);
    res.json(ok({ accessToken: out.accessToken, user: out.user }));
  } catch (e) {
    next(e);
  }
});

authRouter.delete('/logout', async (_req, res) => {
  res.clearCookie('refreshToken', { path: '/' });
  res.json(ok({}));
});

authRouter.get('/me', authGuard, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: (req as any).user.sub } });
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
    res.json(
      ok({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      }),
    );
  } catch (e) {
    next(e);
  }
});

authRouter.patch('/me', authGuard, async (req, res, next) => {
  try {
    const updateSchema = z
      .object({
        name: z.string().min(2, 'Name must be at least 2 characters.').optional(),
        avatarUrl: z.string().url('Invalid URL format for avatar.').optional(),
      })
      .refine((data) => data.name !== undefined || data.avatarUrl !== undefined, {
        message: 'At least one field (name or avatarUrl) must be provided for update.',
        path: ['name', 'avatarUrl'],
      });

    const dto = updateSchema.parse(req.body);

    const userId = (req as any).user.sub;

    const updatedUser = await updateMyProfile(userId, dto);

    res.json(ok(updatedUser));
  } catch (e) {
    if (e instanceof ZodError) {
      return res.status(400).json({ success: false, error: e.flatten() });
    }
    next(e);
  }
});
