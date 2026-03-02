'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { UserActions } from '@/components/admin/user-actions'
import { DataTable } from '@/components/ui/data-table'

interface UserRow {
  id: string
  display_name: string | null
  email: string | null
  is_super_admin: boolean | null
  deactivated_at: string | null
  created_at: string | null
}

interface UsersTableProps {
  users: UserRow[]
  orgCountMap: Record<string, number>
  currentUserId: string
}

export function UsersTable({ users, orgCountMap, currentUserId }: UsersTableProps) {
  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'display_name',
      header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.display_name || 'No name'}</div>
          <div className="text-sm text-muted-foreground font-mono">{row.original.id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.email || '-'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (row) => row.deactivated_at ? 'Deactivated' : 'Active',
      cell: ({ row }) =>
        row.original.deactivated_at ? (
          <Badge variant="destructive">Deactivated</Badge>
        ) : (
          <Badge variant="default" className="bg-green-600">Active</Badge>
        ),
    },
    {
      id: 'role',
      header: 'Role',
      accessorFn: (row) => row.is_super_admin ? 'Super Admin' : 'User',
      cell: ({ row }) =>
        row.original.is_super_admin ? (
          <Badge variant="secondary">Super Admin</Badge>
        ) : (
          <span className="text-muted-foreground">User</span>
        ),
    },
    {
      id: 'orgs',
      header: 'Orgs',
      accessorFn: (row) => orgCountMap[row.id] || 0,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{orgCountMap[row.original.id] || 0}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <UserActions
            userId={row.original.id}
            userName={row.original.display_name || 'User'}
            isDeactivated={!!row.original.deactivated_at}
            isSuperAdmin={!!row.original.is_super_admin}
            isCurrentUser={row.original.id === currentUserId}
          />
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={users}
      searchPlaceholder="Search users..."
      searchColumn="display_name"
      emptyMessage="No users found"
      mobileCard={(user) => (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{user.display_name || 'No name'}</div>
              <div className="text-sm text-muted-foreground">{user.email || '-'}</div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              {user.deactivated_at ? (
                <Badge variant="destructive">Deactivated</Badge>
              ) : (
                <Badge variant="default" className="bg-green-600">Active</Badge>
              )}
              {user.is_super_admin && (
                <Badge variant="secondary">Super Admin</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{orgCountMap[user.id] || 0} orgs</span>
            <span>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</span>
          </div>
          <div className="pt-2 border-t">
            <UserActions
              userId={user.id}
              userName={user.display_name || 'User'}
              isDeactivated={!!user.deactivated_at}
              isSuperAdmin={!!user.is_super_admin}
              isCurrentUser={user.id === currentUserId}
            />
          </div>
        </div>
      )}
    />
  )
}
