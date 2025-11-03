import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { prisma } from '../prisma/client.js';

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password', session: false },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return done(null, false);
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return done(null, false);
        return done(null, { id: user.id, role: user.role });
      } catch (e) {
        return done(e);
      }
    },
  ),
);

export { passport };
