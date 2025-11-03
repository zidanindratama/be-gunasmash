import bcrypt from 'bcryptjs';

import { signAccessToken, signRefreshToken } from '../common/auth/jwt';
import { prisma } from '../prisma/client';

export async function signUp(input: { name: string; email: string; password: string }) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw Object.assign(new Error('Email already used'), { status: 409 });
  const hash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, password: hash },
  });
  const payload = { sub: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
}

export async function issueTokens(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  const payload = { sub: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
}
