'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { mmAddEntrySchema, type MMAddEntryValues } from '@/lib/form-schemas'
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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface AddEntryDialogProps {
  mmPoolId: string
  currentEntryCount: number
  drawCompleted: boolean
}

const DEFAULTS: MMAddEntryValues = { name: '', email: '', verified: false }

export function AddEntryDialog({
  mmPoolId,
  currentEntryCount,
  drawCompleted,
}: AddEntryDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<MMAddEntryValues>({
    resolver: zodResolver(mmAddEntrySchema),
    defaultValues: DEFAULTS,
  })

  const spotsRemaining = 64 - currentEntryCount

  const onSubmit = async (values: MMAddEntryValues) => {
    setError(null)

    const trimmedEmail = values.email?.trim() ?? ''
    const supabase = createClient()
    const insertData: { mm_pool_id: string; display_name: string; email?: string; verified: boolean } = {
      mm_pool_id: mmPoolId,
      display_name: values.name.trim(),
      verified: values.verified,
    }
    if (trimmedEmail) {
      insertData.email = trimmedEmail
    }

    const { error: insertError } = await supabase.from('mm_entries').insert(insertData)

    if (insertError) {
      if (insertError.code === '23505') {
        if (insertError.message?.includes('email')) {
          setError('This email is already entered in this pool')
        } else {
          setError('This name is already entered')
        }
      } else {
        setError(insertError.message)
      }
      return
    }

    form.reset(DEFAULTS)
    setOpen(false)
    router.refresh()
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setError(null)
      form.reset(DEFAULTS)
    }
  }

  if (drawCompleted) {
    return null
  }

  if (spotsRemaining === 0) {
    return <Button disabled>Pool Full (64/64)</Button>
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Entry</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Entry</DialogTitle>
          <DialogDescription>
            {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} remaining
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Participant Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="verified"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(val) => field.onChange(val === true)}
                    />
                  </FormControl>
                  <Label className="text-sm font-normal cursor-pointer">
                    Mark as verified
                  </Label>
                </FormItem>
              )}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Adding...' : 'Add Entry'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
