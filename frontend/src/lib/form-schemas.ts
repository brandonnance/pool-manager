import { z } from 'zod'

// ============================================================================
// Settings
// ============================================================================

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

// ============================================================================
// Pool creation
// ============================================================================

const slugRegex = /^[a-z0-9-]+$/

export const createPoolSchema = z.object({
  name: z.string().min(1, 'Pool name is required').trim(),
  seasonLabel: z.string().trim().optional().or(z.literal('')),
  poolType: z.enum(['squares', 'golf', 'march_madness', 'nfl_desperation']),
  reverseScoring: z.boolean(),
  squaresEventType: z.enum(['nfl_playoffs', 'march_madness', 'single_game']),
  scoringMode: z.enum(['quarter', 'score_change', 'hybrid']),
  gameName: z.string().trim().optional().or(z.literal('')),
  homeTeam: z.string().trim().optional().or(z.literal('')),
  awayTeam: z.string().trim().optional().or(z.literal('')),
  publicSlug: z.string().trim().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  const usesSlug = data.poolType === 'squares' || data.poolType === 'march_madness' || data.poolType === 'nfl_desperation'
  if (usesSlug && data.publicSlug) {
    if (data.publicSlug.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicSlug'],
        message: 'Slug must be at least 3 characters',
      })
    } else if (!slugRegex.test(data.publicSlug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicSlug'],
        message: 'Slug can only contain lowercase letters, numbers, and hyphens',
      })
    }
  }
})

export type CreatePoolValues = z.infer<typeof createPoolSchema>

// ============================================================================
// Invite links
// ============================================================================

export const generateLinkSchema = z.object({
  maxUses: z
    .string()
    .optional()
    .refine((val) => !val || (parseInt(val, 10) > 0), {
      message: 'Must be a positive number',
    }),
  expiresIn: z.enum(['never', '1d', '7d', '30d']),
})

export type GenerateLinkValues = z.infer<typeof generateLinkSchema>

// ============================================================================
// March Madness: Spread
// ============================================================================

export const mmSpreadSchema = z.object({
  spread: z
    .string()
    .min(1, 'Please enter a spread')
    .refine((val) => !isNaN(parseFloat(val)), {
      message: 'Please enter a valid number',
    }),
})

export type MMSpreadValues = z.infer<typeof mmSpreadSchema>

// ============================================================================
// March Madness: Score
// ============================================================================

export const mmScoreSchema = z.object({
  higherScore: z
    .string()
    .min(1, 'Please enter a score')
    .refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0, {
      message: 'Score must be 0 or greater',
    }),
  lowerScore: z
    .string()
    .min(1, 'Please enter a score')
    .refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0, {
      message: 'Score must be 0 or greater',
    }),
  status: z.enum(['scheduled', 'in_progress', 'final']),
}).refine(
  (data) => {
    if (data.status !== 'final') return true
    return parseInt(data.higherScore, 10) !== parseInt(data.lowerScore, 10)
  },
  {
    message: 'Final score cannot be a tie',
    path: ['lowerScore'],
  }
)

export type MMScoreValues = z.infer<typeof mmScoreSchema>

// ============================================================================
// March Madness: Add Entry
// ============================================================================

export const mmAddEntrySchema = z.object({
  name: z.string().min(1, 'Please enter a name').trim(),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: 'Please enter a valid email address' }
    ),
  verified: z.boolean(),
})

export type MMAddEntryValues = z.infer<typeof mmAddEntrySchema>

// ============================================================================
// Squares: Score Entry
// ============================================================================

const optionalScore = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0),
    { message: 'Score must be 0 or greater' }
  )

export const squaresScoreSchema = z.object({
  homeScore: optionalScore,
  awayScore: optionalScore,
  halftimeHomeScore: optionalScore,
  halftimeAwayScore: optionalScore,
  status: z.enum(['scheduled', 'in_progress', 'final']),
  paysHalftime: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.status === 'final') {
    if (!data.homeScore || !data.awayScore) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['homeScore'],
        message: 'Please enter both final scores',
      })
    }
    if (data.paysHalftime && (!data.halftimeHomeScore || !data.halftimeAwayScore)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['halftimeHomeScore'],
        message: 'Please enter halftime scores for this game',
      })
    }
  }
})

export type SquaresScoreValues = z.infer<typeof squaresScoreSchema>
