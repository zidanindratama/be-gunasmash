import cors from 'cors';

import { env } from './env.js';

const list = env.CORS_WHITELIST.split(',').map((d) => d.trim());

export const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    try {
      const url = new URL(origin);
      const ok = list.some((d) => url.hostname.endsWith(d));
      return cb(null, ok);
    } catch {
      return cb(null, false);
    }
  },
  credentials: true,
});
