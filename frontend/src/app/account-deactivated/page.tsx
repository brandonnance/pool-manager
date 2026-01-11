/**
 * @fileoverview Account deactivated notice page
 * @route /account-deactivated
 * @auth None (shown to users who have been deactivated)
 * @layout Standalone (centered card)
 *
 * @description
 * Static page shown to users whose accounts have been deactivated
 * by a super admin. Users are redirected here by the middleware
 * when their profile.deactivated_at is set.
 *
 * @features
 * - Clear deactivation message
 * - Instructions to contact administrator
 * - Link back to login page
 *
 * @security
 * Deactivated users cannot access any protected routes.
 * The middleware checks profiles.deactivated_at on each request
 * and redirects to this page if the account is deactivated.
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Account deactivated page - static notice
 * Shown when user account has been deactivated by admin.
 */
export default function AccountDeactivatedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl text-red-600">Account Deactivated</CardTitle>
          <CardDescription className="text-base mt-2">
            Your account has been deactivated by an administrator.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              If you believe this was done in error or would like to restore your account,
              please contact the administrator who manages your organization.
            </AlertDescription>
          </Alert>

          <div className="text-center pt-4">
            <Button variant="outline" asChild>
              <Link href="/login">
                Return to Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
