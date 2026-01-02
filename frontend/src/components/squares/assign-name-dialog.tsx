'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface AssignNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sqPoolId: string
  rowIndex: number
  colIndex: number
  currentName: string | null
  currentVerified: boolean
  squareId: string | null
  onSaved: () => void
}

export function AssignNameDialog({
  open,
  onOpenChange,
  sqPoolId,
  rowIndex,
  colIndex,
  currentName,
  currentVerified,
  squareId,
  onSaved,
}: AssignNameDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(currentName ?? '')
  const [verified, setVerified] = useState(currentVerified)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocomplete state
  const [existingNames, setExistingNames] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Fetch existing participant names for autocomplete
  useEffect(() => {
    if (open) {
      const fetchNames = async () => {
        const supabase = createClient()
        const { data } = await supabase
          .from('sq_squares')
          .select('participant_name')
          .eq('sq_pool_id', sqPoolId)
          .not('participant_name', 'is', null)

        if (data) {
          // Get unique names, sorted alphabetically
          const uniqueNames = [...new Set(data.map(s => s.participant_name).filter(Boolean) as string[])]
          uniqueNames.sort((a, b) => a.localeCompare(b))
          setExistingNames(uniqueNames)
        }
      }
      fetchNames()
    }
  }, [open, sqPoolId])

  // Filter suggestions based on input
  const filteredSuggestions = name.trim()
    ? existingNames.filter(n =>
        n.toLowerCase().includes(name.toLowerCase()) &&
        n.toLowerCase() !== name.toLowerCase()
      )
    : []

  // Handle keyboard navigation in suggestions
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setShowSuggestions(true)
        setSelectedIndex(0)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          e.preventDefault()
          setName(filteredSuggestions[selectedIndex])
          setShowSuggestions(false)
          setSelectedIndex(-1)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }, [showSuggestions, filteredSuggestions, selectedIndex])

  const handleSelectSuggestion = (suggestion: string) => {
    setName(suggestion)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setName(currentName ?? '')
      setVerified(currentVerified)
      setError(null)
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }, [open, currentName, currentVerified])

  const gridNumber = `${rowIndex}${colIndex}`
  const isAssigned = currentName !== null

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please enter a name')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()

    if (squareId) {
      // Update existing square
      const { error: updateError } = await supabase
        .from('sq_squares')
        .update({
          participant_name: trimmedName,
          verified,
        })
        .eq('id', squareId)

      if (updateError) {
        setError(updateError.message)
        setIsSubmitting(false)
        return
      }
    } else {
      // Insert new square
      const { error: insertError } = await supabase.from('sq_squares').insert({
        sq_pool_id: sqPoolId,
        row_index: rowIndex,
        col_index: colIndex,
        participant_name: trimmedName,
        verified,
      })

      if (insertError) {
        // Handle unique constraint violation
        if (insertError.code === '23505') {
          setError('This square was just claimed. Please refresh and try again.')
        } else {
          setError(insertError.message)
        }
        setIsSubmitting(false)
        return
      }
    }

    setIsSubmitting(false)
    onOpenChange(false)
    onSaved()
    router.refresh()
  }

  const handleClear = async () => {
    if (!squareId) return

    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('sq_squares')
      .delete()
      .eq('id', squareId)

    if (deleteError) {
      setError(deleteError.message)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    onOpenChange(false)
    onSaved()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAssigned ? 'Edit Square' : 'Assign Square'}
          </DialogTitle>
          <DialogDescription>
            Square {gridNumber} (Row {rowIndex}, Column {colIndex})
            {isAssigned && (
              <span className="block mt-1">
                Currently assigned to: <strong>{currentName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Participant Name</Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="name"
                placeholder="e.g., John Smith or Team Alpha"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setShowSuggestions(true)
                  setSelectedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => name.trim() && setShowSuggestions(true)}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 150)
                }}
                disabled={isSubmitting}
                autoFocus
                autoComplete="off"
              />
              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
                >
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                        index === selectedIndex && 'bg-gray-100'
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleSelectSuggestion(suggestion)
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the name of the person or group owning this square
              {existingNames.length > 0 && ' - suggestions will appear as you type'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="verified">Verified (Paid)</Label>
              <p className="text-xs text-muted-foreground">
                Mark as verified once payment is received
              </p>
            </div>
            <Switch
              id="verified"
              checked={verified}
              onCheckedChange={setVerified}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isAssigned && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleClear}
              disabled={isSubmitting}
              className="sm:mr-auto"
            >
              {isSubmitting ? 'Clearing...' : 'Clear Assignment'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? 'Saving...' : isAssigned ? 'Update' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
