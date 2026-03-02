'use client'

import * as React from 'react'
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** When provided, shows a search input that filters on this column (or globally if omitted) */
  searchPlaceholder?: string
  /** Column ID to filter on. If omitted with searchPlaceholder, uses global filter. */
  searchColumn?: string
  /** Show pagination controls below the table */
  showPagination?: boolean
  /** Default page size (default: 10) */
  defaultPageSize?: number
  /** Message shown when no data or all filtered out */
  emptyMessage?: string
  /** Render function for mobile card view. When provided, cards show on small screens. */
  mobileCard?: (row: TData) => React.ReactNode
  /** Callback when a table row is clicked */
  onRowClick?: (row: TData) => void
  /** Custom class name for a row based on data */
  getRowClassName?: (row: TData) => string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  searchColumn,
  showPagination = false,
  defaultPageSize = 10,
  emptyMessage = 'No results found.',
  mobileCard,
  onRowClick,
  getRowClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnFilter, setColumnFilter] = React.useState('')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(showPagination && { getPaginationRowModel: getPaginationRowModel() }),
    onSortingChange: setSorting,
    ...(searchColumn
      ? {} // Column filter handled via column.setFilterValue
      : { onGlobalFilterChange: setGlobalFilter }),
    state: {
      sorting,
      ...(searchColumn ? {} : { globalFilter }),
    },
    initialState: {
      ...(showPagination && { pagination: { pageSize: defaultPageSize } }),
    },
  })

  // Set column filter when searchColumn is specified
  React.useEffect(() => {
    if (searchColumn) {
      table.getColumn(searchColumn)?.setFilterValue(columnFilter || undefined)
    }
  }, [columnFilter, searchColumn, table])

  const handleSearch = (value: string) => {
    if (searchColumn) {
      setColumnFilter(value)
    } else {
      setGlobalFilter(value)
    }
  }

  const searchValue = searchColumn ? columnFilter : globalFilter

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchPlaceholder && (
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-sm"
        />
      )}

      {/* Mobile Card View */}
      {mobileCard && (
        <div className="md:hidden space-y-3">
          {table.getRowModel().rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  getRowClassName?.(row.original)
                )}
              >
                {mobileCard(row.original)}
              </div>
            ))
          )}
        </div>
      )}

      {/* Desktop Table View */}
      <div className={cn(mobileCard && 'hidden md:block')}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    getRowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            -{Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )} of {table.getFilteredRowModel().rows.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
