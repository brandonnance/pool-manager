'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CreatePoolButtonProps {
  orgId: string
}

export function CreatePoolButton({ orgId }: CreatePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // Create the pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name,
        org_id: orgId,
        type: 'bowl_buster',
        status: 'draft',
        season_label: seasonLabel || null,
        created_by: user.id
      })
      .select()
      .single()

    if (poolError) {
      setError(poolError.message)
      setIsLoading(false)
      return
    }

    // Add the creator as an approved member
    const { error: memberError } = await supabase
      .from('pool_memberships')
      .insert({
        pool_id: pool.id,
        user_id: user.id,
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })

    if (memberError) {
      setError(memberError.message)
      setIsLoading(false)
      return
    }

    setIsOpen(false)
    setName('')
    setSeasonLabel('')
    router.refresh()
    router.push(`/pools/${pool.id}`)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Create Pool
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Create Bowl Buster Pool
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Pool Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="My Bowl Pool"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="seasonLabel" className="block text-sm font-medium text-gray-700 mb-1">
                  Season Label (optional)
                </label>
                <input
                  type="text"
                  id="seasonLabel"
                  value={seasonLabel}
                  onChange={(e) => setSeasonLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2024-2025"
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    setName('')
                    setSeasonLabel('')
                    setError(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !name.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
