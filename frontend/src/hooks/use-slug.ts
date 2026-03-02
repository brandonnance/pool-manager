import { useState, useEffect, useCallback } from 'react'
import { formatSlugInput, validateSlugFormat, checkSlugAvailability } from '@/lib/slug'

type SlugTable = 'sq_pools' | 'mm_pools' | 'gp_pools'

interface UseSlugOptions {
  table: SlugTable
  initialSlug?: string | null
  debounceMs?: number
}

interface UseSlugReturn {
  slugInput: string
  setSlugInput: (value: string) => void
  handleSlugChange: (value: string) => void
  slugError: string | null
  slugAvailable: boolean | null
  checkingSlug: boolean
}

export function useSlug({ table, initialSlug, debounceMs = 500 }: UseSlugOptions): UseSlugReturn {
  const [slugInput, setSlugInput] = useState(initialSlug ?? '')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  const handleSlugChange = useCallback((value: string) => {
    const formatted = formatSlugInput(value)
    setSlugInput(formatted)
    setSlugError(validateSlugFormat(formatted) && formatted.length > 0 ? validateSlugFormat(formatted) : null)
  }, [])

  useEffect(() => {
    if (!slugInput || slugInput.length < 3) {
      setSlugAvailable(null)
      return
    }

    const timeoutId = setTimeout(async () => {
      setCheckingSlug(true)
      const available = await checkSlugAvailability(slugInput, table, initialSlug ?? undefined)
      setSlugAvailable(available)
      setCheckingSlug(false)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [slugInput, table, initialSlug, debounceMs])

  return {
    slugInput,
    setSlugInput,
    handleSlugChange,
    slugError,
    slugAvailable,
    checkingSlug,
  }
}
