'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { mmSpreadSchema, type MMSpreadValues } from '@/lib/form-schemas'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface EnterSpreadDialogProps {
  gameId: string
  higherSeedTeamName: string
  lowerSeedTeamName: string
  currentSpread: number | null
  trigger?: React.ReactNode
}

export function EnterSpreadDialog({
  gameId,
  higherSeedTeamName,
  lowerSeedTeamName,
  currentSpread,
  trigger,
}: EnterSpreadDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<MMSpreadValues>({
    resolver: zodResolver(mmSpreadSchema),
    defaultValues: { spread: currentSpread?.toString() ?? '' },
  })

  const onSubmit = async (values: MMSpreadValues) => {
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('mm_games')
      .update({ spread: parseFloat(values.spread) })
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
      form.reset({ spread: currentSpread?.toString() ?? '' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {currentSpread !== null ? 'Edit Spread' : 'Enter Spread'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Enter Spread</DialogTitle>
              <DialogDescription>
                Enter the point spread for this game. Negative means the higher seed is favored.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="text-sm text-muted-foreground text-center">
                <span className="font-medium text-foreground">{higherSeedTeamName}</span>
                {' vs '}
                <span className="font-medium text-foreground">{lowerSeedTeamName}</span>
              </div>

              <FormField
                control={form.control}
                name="spread"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Spread (negative = {higherSeedTeamName} favored)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="-5.5"
                        className="text-center text-lg font-mono"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Example: -5.5 means {higherSeedTeamName} is favored by 5.5 points
                    </p>
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
                {form.formState.isSubmitting ? 'Saving...' : 'Save Spread'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
