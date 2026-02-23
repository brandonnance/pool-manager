/**
 * @fileoverview Public March Madness Entry List Page
 * @route /madness/[slug]
 * @auth Public (no authentication required)
 *
 * @description
 * Read-only public page showing the current entries for a March Madness blind draw pool.
 * Entries are managed exclusively by the commissioner via the dashboard.
 *
 * @features
 * - View pool name and entry count (X/64)
 * - Search existing approved entries by name
 * - Shows pool status (spots remaining, pool full, draw complete)
 *
 * @url_params
 * - slug: The public_slug from mm_pools
 */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
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

export default function PublicEntryListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [pool, setPool] = useState<PoolData | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [searchValue, setSearchValue] = useState('')
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
    if (!searchValue.trim()) return entries
    const search = searchValue.toLowerCase()
    return entries.filter(e =>
      e.display_name?.toLowerCase().includes(search)
    )
  }, [entries, searchValue])

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

        <Card>
          <CardHeader>
            <CardTitle>Current Entries</CardTitle>
            <CardDescription>
              {pool.draw_completed
                ? 'Teams have been assigned. Check back for results!'
                : isFull
                  ? 'The pool is full.'
                  : `${approvedCount} of 64 spots filled.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search entries..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />

            {filteredEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchValue ? 'No matching entries found.' : 'No entries yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-3 py-2 rounded-md text-sm truncate bg-muted"
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
