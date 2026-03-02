import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').trim(),
})

export const updateEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim(),
})

export const updatePasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
export type UpdateEmailValues = z.infer<typeof updateEmailSchema>
export type UpdatePasswordValues = z.infer<typeof updatePasswordSchema>
