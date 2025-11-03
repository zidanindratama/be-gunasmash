import { verifyAccess } from './jwt.js';

import type { NextFunction, Request, Response } from 'express';

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  try {
    const payload = verifyAccess(token);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
  }
}

export function rolesGuard(roles: Array<'ADMIN' | 'MEMBER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: string };
    if (!user || !user.role || !roles.includes(user.role as any)) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }
    next();
  };
}
