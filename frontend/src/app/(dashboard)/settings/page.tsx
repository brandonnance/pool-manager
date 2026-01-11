/**
 * @fileoverview Account settings page
 * @route /settings
 * @auth Required (authenticated users only)
 * @layout Dashboard layout
 *
 * @description
 * User self-service account management page. Allows users to update
 * their profile information, email address, and password.
 *
 * @features
 * - Display name update (stored in profiles table)
 * - Email address change (requires verification)
 * - Password update (current password not required via Supabase)
 *
 * @components
 * - UpdateProfileForm: Change display name
 * - UpdateEmailForm: Change email (triggers verification email)
 * - UpdatePasswordForm: Change password
 *
 * @data_fetching
 * - auth.getUser(): Current user's auth data (email)
 * - profiles: User's display_name
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UpdateProfileForm } from '@/components/settings/update-profile-form'
import { UpdateEmailForm } from '@/components/settings/update-email-form'
import { UpdatePasswordForm } from '@/components/settings/update-password-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

/**
 * Account settings page - Server Component
 * Displays forms for updating profile, email, and password.
 */
export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account information and security settings.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your display name that appears throughout the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdateProfileForm currentDisplayName={profile?.display_name || ''} />
          </CardContent>
        </Card>

        <Separator />

        {/* Email Section */}
        <Card>
          <CardHeader>
            <CardTitle>Email Address</CardTitle>
            <CardDescription>
              Change the email address associated with your account. You&apos;ll need to verify the new email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdateEmailForm currentEmail={user.email || ''} />
          </CardContent>
        </Card>

        <Separator />

        {/* Password Section */}
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
