import { z } from 'zod';

const ROLES = ['SUPERADMIN', 'ADMIN', 'AUDITOR'];
export const MODULE_KEYS = ['villa', 'apartment', 'wv', 'velora'];
const enabledModules = z.array(z.enum(MODULE_KEYS)).max(MODULE_KEYS.length);

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
    // Only honored when the actor is a SUPERADMIN (see createUser); a
    // non-superadmin actor sending this is silently ignored, not rejected —
    // the field is optional so the same schema serves both actor roles.
    enabledModules: enabledModules.optional(),
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

export const updateModulesSchema = z.object({ enabledModules }).strict();

export const resetPasswordSchema = z.object({ password }).strict();

export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const moduleParam = z.object({ moduleName: z.string().trim().min(1).max(50) });
