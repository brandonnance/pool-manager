import { Card, CardContent } from '@/components/ui/card'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="max-w-md w-full mx-4 shadow-xl border-t-4 border-t-primary">
        <CardContent className="p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">
              <span className="text-primary">BN</span> Pools
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-medium">
              Bowl Buster
            </p>
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
