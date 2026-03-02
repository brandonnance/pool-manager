'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { updateProfileSchema, type UpdateProfileValues } from '@/lib/form-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface UpdateProfileFormProps {
  currentDisplayName: string
}

export function UpdateProfileForm({ currentDisplayName }: UpdateProfileFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: currentDisplayName },
  })

  const onSubmit = async (values: UpdateProfileValues) => {
    setError(null)
    setSuccess(false)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in to update your profile')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: values.displayName.trim() })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    router.refresh()
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
            <AlertDescription>Your display name has been updated.</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Your name" className="max-w-md" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
        </Button>
      </form>
    </Form>
  )
}
