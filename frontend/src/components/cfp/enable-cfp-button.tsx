'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Template {
  id: string
  name: string
  description: string | null
}

interface EnableCfpButtonProps {
  poolId: string
  templates: Template[]
}

export function EnableCfpButton({ poolId, templates }: EnableCfpButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? '')
  const [lockDate, setLockDate] = useState('')
  const [lockHour, setLockHour] = useState('12')
  const [lockMinute, setLockMinute] = useState('00')
  const [lockAmPm, setLockAmPm] = useState<'AM' | 'PM'>('PM')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!selectedTemplate) {
      setError('Please select a bracket template')
      setIsLoading(false)
      return
    }

    if (!lockDate) {
      setError('Please set a lock date/time for CFP picks')
      setIsLoading(false)
      return
    }

    // Build lock datetime
    let hour24 = parseInt(lockHour, 10)
    if (lockAmPm === 'PM' && hour24 !== 12) hour24 += 12
    if (lockAmPm === 'AM' && hour24 === 12) hour24 = 0
    const lockDateTime = new Date(`${lockDate}T${hour24.toString().padStart(2, '0')}:${lockMinute}:00`)
    const lockIso = lockDateTime.toISOString()

    const supabase = createClient()

    // Create CFP config
    const { error: configError } = await supabase
      .from('bb_cfp_pool_config')
      .insert({
        pool_id: poolId,
        template_id: selectedTemplate,
        cfp_lock_at: lockIso
      })

    if (configError) {
      setError(configError.message)
      setIsLoading(false)
      return
    }

    // Create empty Round 1 matchup records
    const round1Slots = ['R1A', 'R1B', 'R1C', 'R1D']
    const { error: r1Error } = await supabase
      .from('bb_cfp_pool_round1')
      .insert(
        round1Slots.map(slot => ({
          pool_id: poolId,
          slot_key: slot,
          team_a_id: null,
          team_b_id: null,
          game_id: null
        }))
      )

    if (r1Error) {
      setError(r1Error.message)
      setIsLoading(false)
      return
    }

    // Create empty bye team records for seeds 1-4
    const { error: byeError } = await supabase
      .from('bb_cfp_pool_byes')
      .insert(
        [1, 2, 3, 4].map(seed => ({
          pool_id: poolId,
          seed,
          team_id: null
        }))
      )

    if (byeError) {
      setError(byeError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Enable CFP Bracket
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Enable CFP Bracket
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Template Selection */}
                <div>
                  <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
                    Bracket Format
                  </label>
                  <select
                    id="template"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {templates.find(t => t.id === selectedTemplate)?.description && (
                    <p className="mt-1 text-xs text-gray-500">
                      {templates.find(t => t.id === selectedTemplate)?.description}
                    </p>
                  )}
                </div>

                {/* Lock Date */}
                <div>
                  <label htmlFor="lockDate" className="block text-sm font-medium text-gray-700 mb-1">
                    CFP Picks Lock Date
                  </label>
                  <input
                    type="date"
                    id="lockDate"
                    value={lockDate}
                    onChange={(e) => setLockDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Picks will lock at this date/time (before first CFP game)
                  </p>
                </div>

                {/* Lock Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lock Time
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={lockHour}
                      onChange={(e) => setLockHour(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="flex items-center text-gray-500">:</span>
                    <select
                      value={lockMinute}
                      onChange={(e) => setLockMinute(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {['00', '15', '30', '45'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={lockAmPm}
                      onChange={(e) => setLockAmPm(e.target.value as 'AM' | 'PM')}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Enabling...' : 'Enable CFP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
