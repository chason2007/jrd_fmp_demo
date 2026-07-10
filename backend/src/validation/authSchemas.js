import { z } from 'zod';

// `.strict()` rejects any unknown keys → blocks mass-assignment / payload smuggling.
export const loginSchema = z
  .object({
    username: z.string().trim().min(1, 'Username is required').max(100),
    password: z.string().min(1, 'Password is required').max(200),
  })
  .strict();
