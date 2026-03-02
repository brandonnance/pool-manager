'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { updateEmailSchema, type UpdateEmailValues } from '@/lib/form-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface UpdateEmailFormProps {
  currentEmail: string
}

export function UpdateEmailForm({ currentEmail }: UpdateEmailFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<UpdateEmailValues>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: UpdateEmailValues) => {
    setError(null)
    setSuccess(false)

    if (values.email === currentEmail) {
      form.setError('email', { message: 'New email must be different from your current email' })
      return
    }

    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser(
      { email: values.email.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` }
    )

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    form.reset()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>
              A confirmation email has been sent to your new email address. Please check your inbox and click the link to confirm the change.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="currentEmail">Current email</Label>
          <Input
            id="currentEmail"
            type="email"
            value={currentEmail}
            disabled
            className="max-w-md bg-muted"
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New email address</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="newemail@example.com"
                  className="max-w-md"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.watch('email').trim()}
        >
          {form.formState.isSubmitting ? 'Sending...' : 'Update email'}
        </Button>
      </form>
    </Form>
  )
}
