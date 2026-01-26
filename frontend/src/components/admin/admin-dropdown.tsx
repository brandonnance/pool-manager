'use client'

import Link from 'next/link'
import { ChevronDown, Users, Settings, Trophy } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AdminDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 px-4 py-2 rounded-md text-sm font-medium transition-colors">
        Admin
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/admin/events" className="cursor-pointer flex items-center">
            <Trophy className="mr-2 h-4 w-4" />
            Events
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/users" className="cursor-pointer flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Users
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/settings" className="cursor-pointer flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Site Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
