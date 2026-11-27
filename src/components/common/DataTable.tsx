import { useLanguage } from '@/i18n/useLanguage'
import { useState, type ReactNode } from 'react'
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { EmptyState } from './EmptyState'

export interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- column value types differ per column
  columns: ColumnDef<T, any>[]
  data: T[]
  /** global text filter box (default true) */
  searchable?: boolean
  searchPlaceholder?: string
  /** set to enable pagination */
  pageSize?: number
  initialSorting?: SortingState
  onRowClick?: (row: T) => void
  getRowId?: (row: T) => string
  emptyTitle?: string
  /** extra controls rendered next to the search box */
  toolbar?: ReactNode
  className?: string
}

export function DataTable<T>({
  columns, data, searchable = true, searchPlaceholder = 'Search…', pageSize, initialSorting = [], onRowClick, getRowId, emptyTitle = 'Nothing to show', toolbar, className,
}: DataTableProps<T>) {
  const { t } = useLanguage()
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const table = useReactTable({
    data, columns, getRowId,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } } } : {}),
  })
  const rows = table.getRowModel().rows

  return (
    <div className={cn('space-y-3', className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={t(searchPlaceholder)} className="max-w-xs" />}
          {toolbar}
        </div>
      )}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort()
                  const dir = h.column.getIsSorted()
                  const header = h.column.columnDef.header
                  const label = typeof header === 'string' ? t(header) : flexRender(header, h.getContext())
                  return (
                    <TableHead key={h.id}>
                      {h.isPlaceholder ? null : canSort ? (
                        <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={h.column.getToggleSortingHandler()}>
                          {label}
                          {dir === 'asc' ? <ArrowUp className="size-3" /> : dir === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : label}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={onRowClick ? 'cursor-pointer' : undefined} onClick={onRowClick ? () => onRowClick(row.original) : undefined}>
                {row.getVisibleCells().map((c) => <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && <EmptyState title={t(emptyTitle)} className="m-3 border-0" />}
      </div>
      {pageSize && table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{t('Page {page} of {total}', { page: table.getState().pagination.pageIndex + 1, total: table.getPageCount() })}</span>
          <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>{t('Previous')}</Button>
          <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>{t('Next')}</Button>
        </div>
      )}
    </div>
  )
}
