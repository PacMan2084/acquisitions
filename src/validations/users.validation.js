import { z } from 'zod';

export const userIdSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(value => Number(value))
    .refine(value => value > 0, {
      message: 'ID must be a positive integer',
    }),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(2).max(255).trim().optional(),
    email: z.string().email().max(255).toLowerCase().trim().optional(),
    role: z.enum(['user', 'admin']).optional(),
  })
  .refine(
    data =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.role !== undefined,
    {
      message: 'At least one field must be provided to update',
      path: ['name', 'email', 'role'],
    }
  );