'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { mmScoreSchema, type MMScoreValues } from '@/lib/form-schemas'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface EnterScoreDialogProps {
  gameId: string
  higherSeedTeamName: string
  lowerSeedTeamName: string
  higherSeedSeed: number
  lowerSeedSeed: number
  currentHigherScore: number | null
  currentLowerScore: number | null
  currentStatus: string
  spread: number | null
  trigger?: React.ReactNode
}

type GameStatus = 'scheduled' | 'in_progress' | 'final'

export function EnterScoreDialog({
  gameId,
  higherSeedTeamName,
  lowerSeedTeamName,
  higherSeedSeed,
  lowerSeedSeed,
  currentHigherScore,
  currentLowerScore,
  currentStatus,
  spread,
  trigger,
}: EnterScoreDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const initialValues: MMScoreValues = {
    higherScore: currentHigherScore?.toString() ?? '',
    lowerScore: currentLowerScore?.toString() ?? '',
    status: (currentStatus as GameStatus) ?? 'scheduled',
  }

  const form = useForm<MMScoreValues>({
    resolver: zodResolver(mmScoreSchema),
    defaultValues: initialValues,
  })

  const higherScoreValue = form.watch('higherScore')
  const lowerScoreValue = form.watch('lowerScore')
  const statusValue = form.watch('status')

  const onSubmit = async (values: MMScoreValues) => {
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('mm_games')
      .update({
        higher_seed_score: parseInt(values.higherScore, 10),
        lower_seed_score: parseInt(values.lowerScore, 10),
        status: values.status,
      })
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setOpen(false)
    router.refresh()
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setError(null)
      form.reset(initialValues)
    }
  }

  // Calculate who covers if we have spread and scores
  let spreadCoverPreview = ''
  if (spread !== null && higherScoreValue && lowerScoreValue) {
    const hScore = parseInt(higherScoreValue, 10)
    const lScore = parseInt(lowerScoreValue, 10)
    if (!isNaN(hScore) && !isNaN(lScore)) {
      const adjustedHigher = hScore + spread
      if (adjustedHigher > lScore) {
        spreadCoverPreview = `${higherSeedTeamName} covers`
      } else if (adjustedHigher < lScore) {
        spreadCoverPreview = `${lowerSeedTeamName} covers`
      } else {
        spreadCoverPreview = 'Push (tie against spread)'
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {currentHigherScore !== null ? 'Edit Score' : 'Enter Score'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Enter Game Score</DialogTitle>
              <DialogDescription>
                Enter the final or current score for this game.
                {spread !== null && (
                  <span className="block mt-1">
                    Spread: {spread > 0 ? '+' : ''}{spread} ({spread < 0 ? higherSeedTeamName : lowerSeedTeamName} favored)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="higherScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      #{higherSeedSeed} {higherSeedTeamName}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center text-2xl font-bold"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lowerScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      #{lowerSeedSeed} {lowerSeedTeamName}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="text-center text-2xl font-bold"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {spreadCoverPreview && (
                <div className="p-2 bg-muted rounded-md text-center text-sm">
                  {spreadCoverPreview}
                </div>
              )}

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                      </SelectContent>
                    </Select>
                    {statusValue === 'final' && (
                      <p className="text-xs text-amber-600">
                        Setting to final will process advancement and elimination.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Score'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
