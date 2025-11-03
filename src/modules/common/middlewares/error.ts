import { fail } from '../http/response';

import type { NextFunction, Request, Response } from 'express';


export function notFound(_req: Request, res: Response) {
  res.status(404).json(fail('Not Found'));
}

export function onError(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = typeof err.status === 'number' ? err.status : 500;
  const message = typeof err.message === 'string' ? err.message : 'Internal Error';
  res.status(status).json(fail(message));
}
