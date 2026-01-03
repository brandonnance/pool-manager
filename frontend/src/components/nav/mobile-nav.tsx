'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface MobileNavProps {
  isSuperAdmin: boolean
}

export function MobileNav({ isSuperAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  const handleLinkClick = () => {
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-primary-foreground hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] bg-primary text-primary-foreground border-primary-foreground/20">
        <SheetHeader>
          <SheetTitle className="text-primary-foreground flex items-center gap-2">
            <span className="bg-white text-primary px-2 py-0.5 rounded font-black">BN</span>
            <span>Pools</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 mt-6">
          <Link
            href="/dashboard"
            onClick={handleLinkClick}
            className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10 px-4 py-3 rounded-md text-base font-medium transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/orgs"
            onClick={handleLinkClick}
            className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10 px-4 py-3 rounded-md text-base font-medium transition-colors"
          >
            Organizations
          </Link>
          {isSuperAdmin && (
            <Link
              href="/admin/users"
              onClick={handleLinkClick}
              className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-white/10 px-4 py-3 rounded-md text-base font-medium transition-colors"
            >
              Users
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
