'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { squaresScoreSchema, type SquaresScoreValues } from '@/lib/form-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'

interface EnterSquaresScoreButtonProps {
  gameId: string
  sqPoolId: string
  gameName: string
  homeTeam: string
  awayTeam: string
  currentHomeScore: number | null
  currentAwayScore: number | null
  currentHalftimeHomeScore: number | null
  currentHalftimeAwayScore: number | null
  currentStatus: string | null
  paysHalftime: boolean
  reverseScoring: boolean
  rowNumbers: number[] | null
  colNumbers: number[] | null
}

export function EnterSquaresScoreButton({
  gameId,
  sqPoolId,
  gameName,
  homeTeam,
  awayTeam,
  currentHomeScore,
  currentAwayScore,
  currentHalftimeHomeScore,
  currentHalftimeAwayScore,
  currentStatus,
  paysHalftime,
  reverseScoring,
  rowNumbers,
  colNumbers,
}: EnterSquaresScoreButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const initialValues: SquaresScoreValues = {
    homeScore: currentHomeScore?.toString() ?? '',
    awayScore: currentAwayScore?.toString() ?? '',
    halftimeHomeScore: currentHalftimeHomeScore?.toString() ?? '',
    halftimeAwayScore: currentHalftimeAwayScore?.toString() ?? '',
    status: (currentStatus as 'scheduled' | 'in_progress' | 'final') ?? 'scheduled',
    paysHalftime,
  }

  const form = useForm<SquaresScoreValues>({
    resolver: zodResolver(squaresScoreSchema),
    defaultValues: initialValues,
  })

  const homeScore = form.watch('homeScore') ?? ''
  const awayScore = form.watch('awayScore') ?? ''
  const status = form.watch('status')

  const handleOpen = () => {
    form.reset(initialValues)
    setError(null)
    setIsOpen(true)
  }

  const onSubmit = async (values: SquaresScoreValues) => {
    setError(null)

    const supabase = createClient()

    const updates: Record<string, unknown> = {
      status: values.status,
      home_score: values.homeScore ? parseInt(values.homeScore, 10) : null,
      away_score: values.awayScore ? parseInt(values.awayScore, 10) : null,
      halftime_home_score: values.halftimeHomeScore ? parseInt(values.halftimeHomeScore, 10) : null,
      halftime_away_score: values.halftimeAwayScore ? parseInt(values.halftimeAwayScore, 10) : null,
    }

    const { error: updateError } = await supabase
      .from('sq_games')
      .update(updates)
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (rowNumbers && colNumbers) {
      const hasHalftimeScores = paysHalftime && !!values.halftimeHomeScore && !!values.halftimeAwayScore
      const hasFinalScores = values.status === 'final' && !!values.homeScore && !!values.awayScore

      if (hasHalftimeScores || hasFinalScores) {
        await calculateAndRecordWinners(
          supabase,
          gameId,
          sqPoolId,
          hasFinalScores ? parseInt(values.homeScore!, 10) : null,
          hasFinalScores ? parseInt(values.awayScore!, 10) : null,
          hasHalftimeScores ? parseInt(values.halftimeHomeScore!, 10) : null,
          hasHalftimeScores ? parseInt(values.halftimeAwayScore!, 10) : null,
          rowNumbers,
          colNumbers,
          reverseScoring
        )
      }
    }

    setIsOpen(false)
    router.refresh()
  }

  const isFinal = currentStatus === 'final'

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen}>
          {isFinal ? 'Edit Score' : 'Enter Score'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Score</DialogTitle>
          <DialogDescription>{gameName}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              {/* Final Score Entry */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Final Score</Label>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <FormField
                    control={form.control}
                    name="awayScore"
                    render={({ field }) => (
                      <FormItem className="text-center">
                        <Label className="block mb-2 text-xs text-muted-foreground">{awayTeam}</Label>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            className="text-2xl font-bold text-center h-14"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="text-center text-muted-foreground text-lg font-medium pt-6">@</div>

                  <FormField
                    control={form.control}
                    name="homeScore"
                    render={({ field }) => (
                      <FormItem className="text-center">
                        <Label className="block mb-2 text-xs text-muted-foreground">{homeTeam}</Label>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            className="text-2xl font-bold text-center h-14"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Halftime Score Entry (if pays halftime) */}
              {paysHalftime && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">Halftime Score</Label>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <FormField
                      control={form.control}
                      name="halftimeAwayScore"
                      render={({ field }) => (
                        <FormItem className="text-center">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              className="text-xl font-bold text-center h-12"
                              placeholder="0"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="text-center text-muted-foreground text-sm">Halftime</div>

                    <FormField
                      control={form.control}
                      name="halftimeHomeScore"
                      render={({ field }) => (
                        <FormItem className="text-center">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              className="text-xl font-bold text-center h-12"
                              placeholder="0"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="space-y-2">
                <Label>Game Status</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={status === 'scheduled' ? 'default' : 'outline'}
                    onClick={() => form.setValue('status', 'scheduled')}
                    size="sm"
                  >
                    Scheduled
                  </Button>
                  <Button
                    type="button"
                    variant={status === 'in_progress' ? 'default' : 'outline'}
                    onClick={() => form.setValue('status', 'in_progress')}
                    className={status === 'in_progress' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                    size="sm"
                  >
                    In Progress
                  </Button>
                  <Button
                    type="button"
                    variant={status === 'final' ? 'default' : 'outline'}
                    onClick={() => form.setValue('status', 'final')}
                    size="sm"
                  >
                    Final
                  </Button>
                </div>
              </div>

              {/* Winner Preview (if final and numbers locked) */}
              {status === 'final' && homeScore && awayScore && rowNumbers && colNumbers && (
                <div className="bg-muted rounded-md p-3 text-sm">
                  <div className="font-medium mb-1">Winners Preview:</div>
                  <div className="space-y-1 text-muted-foreground">
                    <div>
                      Normal: Square {parseInt(awayScore) % 10}-{parseInt(homeScore) % 10}
                    </div>
                    {reverseScoring && (
                      <div>
                        Reverse: Square {parseInt(homeScore) % 10}-{parseInt(awayScore) % 10}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={form.formState.isSubmitting}
              >
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

// Helper function to get winner name from square
async function getWinnerName(
  supabase: ReturnType<typeof createClient>,
  userId: string | null
): Promise<string> {
  if (!userId) return 'Abandoned'

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userId)
    .single()

  return profile?.display_name || profile?.email || 'Unknown'
}

// Helper function to find winning square and record winners
async function calculateAndRecordWinners(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  homeScore: number | null,
  awayScore: number | null,
  halftimeHomeScore: number | null,
  halftimeAwayScore: number | null,
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  // Delete existing winners for this game first
  await supabase.from('sq_winners').delete().eq('sq_game_id', gameId)

  // Final score winners (only if we have final scores)
  if (homeScore !== null && awayScore !== null) {
    // Find the row/col indices for the winning numbers
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10

    // Find row index where the number matches homeDigit
    const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
    // Find col index where the number matches awayDigit
    const colIndex = colNumbers.findIndex((n) => n === awayDigit)

    // Get the winning square with user_id
    const { data: normalSquare } = await supabase
      .from('sq_squares')
      .select('id, user_id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', rowIndex)
      .eq('col_index', colIndex)
      .single()

    if (normalSquare) {
      const winnerName = await getWinnerName(supabase, normalSquare.user_id)
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: normalSquare.id,
        win_type: 'normal',
        winner_name: winnerName,
      })
    }

    // Reverse winner (if different square)
    if (reverseScoring) {
      const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

      if (reverseRowIndex !== rowIndex || reverseColIndex !== colIndex) {
        const { data: reverseSquare } = await supabase
          .from('sq_squares')
          .select('id, user_id')
          .eq('sq_pool_id', sqPoolId)
          .eq('row_index', reverseRowIndex)
          .eq('col_index', reverseColIndex)
          .single()

        if (reverseSquare) {
          const winnerName = await getWinnerName(supabase, reverseSquare.user_id)
          await supabase.from('sq_winners').insert({
            sq_game_id: gameId,
            square_id: reverseSquare.id,
            win_type: 'reverse',
            winner_name: winnerName,
          })
        }
      }
    }
  }

  // Halftime winners (if applicable)
  if (halftimeHomeScore !== null && halftimeAwayScore !== null) {
    const htHomeDigit = halftimeHomeScore % 10
    const htAwayDigit = halftimeAwayScore % 10

    const htRowIndex = rowNumbers.findIndex((n) => n === htHomeDigit)
    const htColIndex = colNumbers.findIndex((n) => n === htAwayDigit)

    const { data: halftimeSquare } = await supabase
      .from('sq_squares')
      .select('id, user_id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', htRowIndex)
      .eq('col_index', htColIndex)
      .single()

    if (halftimeSquare) {
      const winnerName = await getWinnerName(supabase, halftimeSquare.user_id)
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: halftimeSquare.id,
        win_type: 'halftime',
        winner_name: winnerName,
      })
    }

    // Halftime reverse
    if (reverseScoring) {
      const htReverseRowIndex = rowNumbers.findIndex((n) => n === htAwayDigit)
      const htReverseColIndex = colNumbers.findIndex((n) => n === htHomeDigit)

      if (htReverseRowIndex !== htRowIndex || htReverseColIndex !== htColIndex) {
        const { data: htReverseSquare } = await supabase
          .from('sq_squares')
          .select('id, user_id')
          .eq('sq_pool_id', sqPoolId)
          .eq('row_index', htReverseRowIndex)
          .eq('col_index', htReverseColIndex)
          .single()

        if (htReverseSquare) {
          const winnerName = await getWinnerName(supabase, htReverseSquare.user_id)
          await supabase.from('sq_winners').insert({
            sq_game_id: gameId,
            square_id: htReverseSquare.id,
            win_type: 'halftime_reverse',
            winner_name: winnerName,
          })
        }
      }
    }
  }
}
