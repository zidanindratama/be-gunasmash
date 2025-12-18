import { verifyAccess } from './jwt.js';
import type { NextFunction, Request, Response } from 'express';

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'Unauthorized: No token provided' },
    });
  }

  const parts = authHeader.split(' ');
  const token = parts.length === 2 ? parts[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Unauthorized: Format is "Bearer <token>"' },
    });
  }

  try {
    const payload = verifyAccess(token);
    (req as any).user = payload;

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { message: 'Unauthorized: Token invalid or expired' },
    });
  }
}

export function rolesGuard(roles: Array<'ADMIN' | 'MEMBER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: string } | undefined;

    if (!user || !user.role || !roles.includes(user.role as any)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Forbidden: You do not have permission' },
      });
    }
    next();
  };
}
