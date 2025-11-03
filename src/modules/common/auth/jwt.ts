import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';

import type { Secret, SignOptions, JwtPayload as StdJwtPayload } from 'jsonwebtoken';

export type JwtPayload = { sub: string; role: 'ADMIN' | 'MEMBER' };

const ACCESS_EXPIRES: SignOptions['expiresIn'] = /^\d+$/.test(env.JWT_ACCESS_EXPIRES)
  ? Number(env.JWT_ACCESS_EXPIRES)
  : (env.JWT_ACCESS_EXPIRES as any);
const REFRESH_EXPIRES: SignOptions['expiresIn'] = /^\d+$/.test(env.JWT_REFRESH_EXPIRES)
  ? Number(env.JWT_REFRESH_EXPIRES)
  : (env.JWT_REFRESH_EXPIRES as any);

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, {
    expiresIn: ACCESS_EXPIRES,
    algorithm: 'HS256',
  });
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, {
    expiresIn: REFRESH_EXPIRES,
    algorithm: 'HS256',
  });
}

export function verifyAccess(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as JwtPayload | StdJwtPayload | string;
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as Secret) as JwtPayload | StdJwtPayload | string;
}
