import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mt-8 text-center text-gray-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
