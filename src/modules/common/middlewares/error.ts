import { ZodError } from 'zod';

import { fail } from '../http/response.js';

import type { NextFunction, Request, Response } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json(fail('Not Found'));
}

export function onError(err: any, _req: Request, res: Response, _next: NextFunction) {
  void _next;
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation error', issues: err.flatten() },
    });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json(fail('A record with this value already exists'));
  }
  const status = typeof err.status === 'number' ? err.status : 500;
  const message =
    status >= 500
      ? 'Internal server error'
      : typeof err.message === 'string'
        ? err.message
        : 'Internal Error';
  res.status(status).json(fail(message));
}
