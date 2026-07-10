import { z } from 'zod';

const ROLES = ['SUPERADMIN', 'ADMIN', 'AUDITOR'];

// Password policy: >= 12 chars (argon2 protects storage, but weak passwords are
// still guessable). Applied on user creation and admin-driven resets.
const password = z.string().min(12, 'Password must be at least 12 characters.').max(200);

export const createUserSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required').max(100),
    password,
    role: z.enum(ROLES).optional(),
    name: z.string().trim().min(1, 'Name is required').max(100),
    idNumber: z.string().trim().min(1, 'ID number is required').max(50),
  })
  .strict();

export const updateStatusSchema = z.object({ isActive: z.boolean() }).strict();

export const updateUserSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required').max(100),
    name: z.string().trim().min(1, 'Name is required').max(100),
    idNumber: z.string().trim().min(1, 'ID number is required').max(50),
  })
  .strict();

export const updateRoleSchema = z.object({ role: z.enum(ROLES) }).strict();

export const resetPasswordSchema = z.object({ password }).strict();

export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const moduleParam = z.object({ moduleName: z.string().trim().min(1).max(50) });
