import { AttendanceStatus, Role } from '@prisma/client';
import { z } from 'zod';

export const SignUpSchema = z.object({
  name: z.string().min(2).trim(),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

export const SignInSchema = z.object({
  email: z.string().trim().email(),
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

export const AnnouncementUpdateSchema = z.object({
  title: z.string().min(2).trim().optional(),
  type: z.enum(['TRAINING', 'SPARRING', 'TOURNAMENT', 'BRIEFING', 'RECRUITMENT', 'EVENT', 'INFO']).optional(),
  datetime: z.string().datetime().optional(),
  location: z.string().min(2).trim().optional(),
  locationLink: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  content: z.string().min(1).optional(),
});

export const MongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const BlogSchema = z.object({
  title: z.string().min(2).trim(),
  slug: z.string().min(2).trim(),
  content: z.string().min(1),
  coverUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().min(1)).default([]),
  published: z.coerce.boolean().default(false),
});
export type BlogInput = z.infer<typeof BlogSchema>;

export const BlogUpdateSchema = z.object({
  title: z.string().min(2).trim().optional(),
  slug: z.string().min(2).trim().optional(),
  content: z.string().min(1).optional(),
  coverUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string().min(1)).optional(),
  published: z.boolean().optional(),
});

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
  search: z.string().optional(),
});

export const AttendanceStatsQuerySchema = z.object({
  announcementId: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const AttendanceListQuerySchema = z.object({
  announcementId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  sort: z.string().optional(),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(2).trim().optional(),
  email: z.string().trim().email().optional(),
  role: z.nativeEnum(Role).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const CreateSessionSchema = z.object({
  title: z.string().min(3),
  date: z.string().datetime(),
  status: z.enum(['OPEN', 'CLOSED']),
});

export type MemberCheckInDto = z.infer<typeof MemberCheckInSchema>;
export type AdminCheckInDto = z.infer<typeof AdminCheckInSchema>;
export type SessionQueryDto = z.infer<typeof SessionQuerySchema>;
export type AttendanceStatsQueryDto = z.infer<typeof AttendanceStatsQuerySchema>;
export type AttendanceListQueryDto = z.infer<typeof AttendanceListQuerySchema>;
