'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { use } from 'react'

interface Entry {
  id: string
  display_name: string | null
  status: string
}

interface PoolData {
  id: string
  pool_id: string
  draw_completed: boolean
  pools: {
    name: string
  }
}

export default function PublicEntryRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [pool, setPool] = useState<PoolData | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPool() {
      const supabase = createClient()

      const { data: poolData, error: poolError } = await supabase
        .from('mm_pools')
        .select('id, pool_id, draw_completed, pools(name)')
        .eq('public_slug', slug)
        .single()

      if (poolError || !poolData) {
        setLoading(false)
        return
      }

      setPool(poolData as PoolData)

      // Load approved entries
      const { data: entriesData } = await supabase
        .from('mm_entries')
        .select('id, display_name, status')
        .eq('mm_pool_id', poolData.id)
        .eq('status', 'approved')
        .order('display_name')

      setEntries(entriesData || [])
      setLoading(false)
    }

    loadPool()
  }, [slug])

  const filteredEntries = useMemo(() => {
    if (!inputValue.trim()) return entries
    const search = inputValue.toLowerCase()
    return entries.filter(e =>
      e.display_name?.toLowerCase().includes(search)
    )
  }, [entries, inputValue])

  // Check if the current input exactly matches an existing entry
  const exactMatch = useMemo(() => {
    if (!inputValue.trim()) return null
    return entries.find(e =>
      e.display_name?.toLowerCase() === inputValue.trim().toLowerCase()
    )
  }, [entries, inputValue])

  const handleSubmitRequest = async () => {
    if (!inputValue.trim() || !pool) return

    setIsSubmitting(true)
    setMessage(null)

    const supabase = createClient()

    // Check if name already exists (approved or pending)
    const { data: existing } = await supabase
      .from('mm_entries')
      .select('id, status')
      .eq('mm_pool_id', pool.id)
      .ilike('display_name', inputValue.trim())
      .maybeSingle()

    if (existing) {
      if (existing.status === 'approved') {
        setMessage({ type: 'error', text: 'This name is already in the pool!' })
      } else if (existing.status === 'pending') {
        setMessage({ type: 'error', text: 'This name already has a pending request.' })
      } else {
        setMessage({ type: 'error', text: 'This name was previously denied.' })
      }
      setIsSubmitting(false)
      return
    }

    // Submit entry request
    const { error } = await supabase
      .from('mm_entries')
      .insert({
        mm_pool_id: pool.id,
        display_name: inputValue.trim(),
        status: 'pending',
      })

    if (error) {
      setMessage({ type: 'error', text: 'Failed to submit request. Please try again.' })
    } else {
      setMessage({ type: 'success', text: 'Your entry request has been submitted! The commissioner will review it.' })
      setInputValue('')
    }
    setIsSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Pool Not Found</CardTitle>
            <CardDescription>
              This pool link is invalid or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const approvedCount = entries.length
  const spotsRemaining = 64 - approvedCount
  const isFull = spotsRemaining === 0

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{pool.pools.name}</CardTitle>
            <CardDescription>
              March Madness Blind Draw Pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {approvedCount}/64 entries
              </div>
              {pool.draw_completed ? (
                <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                  Draw Complete
                </div>
              ) : isFull ? (
                <div className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                  Pool Full
                </div>
              ) : (
                <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {spotsRemaining} spots remaining
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Combined Search and Entry Request */}
        <Card>
          <CardHeader>
            <CardTitle>
              {pool.draw_completed ? 'Current Entries' : 'Find or Request Entry'}
            </CardTitle>
            <CardDescription>
              {pool.draw_completed
                ? 'Teams have been assigned. Check back for results!'
                : isFull
                  ? 'The pool is full. Search to find your name.'
                  : 'Type your name to search. If not found, you can request entry.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Single input for both search and entry request */}
            <div className="flex gap-2">
              <Input
                placeholder={pool.draw_completed ? "Search entries..." : "Enter your name..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !pool.draw_completed && !isFull && !exactMatch && handleSubmitRequest()}
              />
              {!pool.draw_completed && !isFull && (
                <Button
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting || !inputValue.trim() || !!exactMatch}
                >
                  {isSubmitting ? 'Submitting...' : 'Request Entry'}
                </Button>
              )}
            </div>

            {/* Feedback messages */}
            {message && (
              <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                {message.text}
              </p>
            )}

            {/* Show hint when exact match found */}
            {exactMatch && !message && (
              <p className="text-sm text-green-600">
                ✓ &quot;{exactMatch.display_name}&quot; is already entered in this pool!
              </p>
            )}

            {/* Filtered entries list */}
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {inputValue ? 'No matching entries found.' : 'No entries yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`px-3 py-2 rounded-md text-sm truncate ${
                      exactMatch?.id === entry.id
                        ? 'bg-green-100 text-green-800 font-medium'
                        : 'bg-muted'
                    }`}
                  >
                    {entry.display_name || 'Unnamed'}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
