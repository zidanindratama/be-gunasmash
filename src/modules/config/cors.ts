import cors from 'cors';

import { env } from './env.js';

const list = env.CORS_WHITELIST.split(',')
  .map((entry) => {
    const value = entry.trim();
    if (!value) return null;

    try {
      const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
      const url = new URL(hasProtocol ? value : `http://${value}`);
      return {
        hostname: url.hostname.toLowerCase(),
        port: url.port,
        protocol: hasProtocol ? url.protocol : undefined,
      };
    } catch {
      return null;
    }
  })
  .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

export const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();
      const ok = list.some((entry) => {
        const matchesHostname =
          hostname === entry.hostname || hostname.endsWith(`.${entry.hostname}`);
        const matchesPort = !entry.port || url.port === entry.port;
        const matchesProtocol = !entry.protocol || url.protocol === entry.protocol;
        return matchesHostname && matchesPort && matchesProtocol;
      });
      return cb(null, ok);
    } catch {
      return cb(null, false);
    }
  },
  credentials: true,
});
