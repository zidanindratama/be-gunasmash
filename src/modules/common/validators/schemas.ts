import { z } from 'zod';
import { AttendanceStatus, Role } from '@prisma/client';

export const SignUpSchema = z.object({
  name: z.string().min(2).trim(),
  email: z.string().email().trim(),
  password: z.string().min(6),
});

export const SignInSchema = z.object({
  email: z.string().email().trim(),
  password: z.string().min(6),
});

export const AnnouncementSchema = z.object({
  title: z.string().min(2).trim(),
  type: z
    .enum(['TRAINING', 'SPARRING', 'TOURNAMENT', 'BRIEFING', 'RECRUITMENT', 'EVENT', 'INFO'])
    .default('INFO'),
  datetime: z.string().datetime(),
  location: z.string().min(2).trim(),
  locationLink: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  content: z.string().min(1),
});
export type AnnouncementInput = z.infer<typeof AnnouncementSchema>;

export const BlogSchema = z.object({
  title: z.string().min(2).trim(),
  slug: z.string().min(2).trim(),
  content: z.string().min(1),
  coverUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().min(1)).default([]),
  published: z.coerce.boolean().default(false),
});
export type BlogInput = z.infer<typeof BlogSchema>;

export const PromoteSchema = z.object({
  role: z.nativeEnum(Role),
});

export const MemberCheckInSchema = z.object({
  announcementId: z.string().min(1),
  note: z.string().max(200).optional(),
});

export const AdminCheckInSchema = z.object({
  announcementId: z.string().min(1),
  userId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.nativeEnum(AttendanceStatus).optional().default(AttendanceStatus.PRESENT),
  note: z.string().max(200).optional(),
});

export const SessionQuerySchema = z.object({
  announcementId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const AttendanceStatsQuerySchema = z.object({
  announcementId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type MemberCheckInDto = z.infer<typeof MemberCheckInSchema>;
export type AdminCheckInDto = z.infer<typeof AdminCheckInSchema>;
export type SessionQueryDto = z.infer<typeof SessionQuerySchema>;
export type AttendanceStatsQueryDto = z.infer<typeof AttendanceStatsQuerySchema>;
