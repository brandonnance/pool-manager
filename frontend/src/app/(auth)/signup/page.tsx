import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mt-8 text-center text-gray-500">Loading...</div>}>
      <SignupForm />
    </Suspense>
  )
}
