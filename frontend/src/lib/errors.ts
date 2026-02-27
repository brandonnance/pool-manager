import { toast } from 'sonner'

/**
 * Standardized error constants with codes and user-friendly messages.
 * Server errors go to toast, field errors go inline.
 */
export const ERRORS = {
  // Auth
  UNAUTHENTICATED: {
    code: 'UNAUTHENTICATED',
    message: 'You must be logged in to do that.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'You don\'t have permission to do that.',
  },
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    message: 'Your session has expired. Please log in again.',
  },

  // Data
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
  POOL_NOT_FOUND: {
    code: 'POOL_NOT_FOUND',
    message: 'This pool doesn\'t exist or you don\'t have access.',
  },
  ORG_NOT_FOUND: {
    code: 'ORG_NOT_FOUND',
    message: 'This organization doesn\'t exist or you don\'t have access.',
  },

  // Operations
  SAVE_FAILED: {
    code: 'SAVE_FAILED',
    message: 'Failed to save changes. Please try again.',
  },
  DELETE_FAILED: {
    code: 'DELETE_FAILED',
    message: 'Failed to delete. Please try again.',
  },
  LOAD_FAILED: {
    code: 'LOAD_FAILED',
    message: 'Failed to load data. Please refresh the page.',
  },

  // Network
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network error. Check your connection and try again.',
  },
  UNEXPECTED: {
    code: 'UNEXPECTED',
    message: 'Something went wrong. Please try again.',
  },
} as const

export type ErrorCode = keyof typeof ERRORS

/**
 * Show a toast for a server/API error.
 * Use inline Alert components for field-level validation errors.
 */
export function showErrorToast(
  error: unknown,
  fallbackMessage = ERRORS.UNEXPECTED.message
) {
  const message =
    error instanceof Error ? error.message : fallbackMessage
  toast.error(message)
}

/**
 * Show a success toast.
 */
export function showSuccessToast(message: string) {
  toast.success(message)
}
