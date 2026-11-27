import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { DataTable, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatDate, formatDateTime } from '@/lib/format'
import { useDb } from '@/store/db'
import { branchName } from '@/store/selectors'
import type { Dispatch } from '@/types/domain'
import { AdhocDispatchDialog } from '../components/AdhocDispatchDialog'
import { AllocationGrid } from '../components/AllocationGrid'
import { hoursSince } from '../components/shared'

export default function DispatchListPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const nav = useNavigate()
  const [filter, setFilter] = useState<'all' | 'in_transit' | 'received'>('all')
  const [adhoc, setAdhoc] = useState(false)
  const [planPick, setPlanPick] = useState('')

  const pending = useMemo(
    () => db.productionPlans.filter((p) => p.status === 'completed' && !db.dispatches.some((d) => d.planId === p.id)).sort((a, b) => b.date.localeCompare(a.date)),
    [db],
  )
  const planId = pending.find((p) => p.id === planPick)?.id ?? pending[0]?.id
  const rows = useMemo(
    () => db.dispatches.filter((d) => filter === 'all' || d.status === filter).sort((a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt)),
    [db.dispatches, filter],
  )

  const columns = useMemo<ColumnDef<Dispatch>[]>(() => [
    { accessorKey: 'number', header: 'DN' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date) },
    { id: 'branch', header: 'Branch', accessorFn: (d) => branchName(db, d.branchId) },
    { id: 'items', header: 'Items', accessorFn: (d) => d.lines.length },
    { id: 'units', header: 'Units', accessorFn: (d) => d.lines.reduce((s, l) => s + l.qtyDispatched, 0), cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { accessorKey: 'vehicle', header: 'Vehicle', cell: ({ row }) => row.original.vehicle ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: 'when', header: 'Dispatched', accessorFn: (d) => d.dispatchedAt,
      cell: ({ row }) => {
        const d = row.original
        return <span className="text-muted-foreground">{formatDateTime(d.dispatchedAt)}{d.status === 'in_transit' && t(' · {hours} h', { hours: hoursSince(d.dispatchedAt).toFixed(1) })}</span>
      },
    },
  ], [db, t])

  return (
    <>
      <PageHeader title={t('Dispatch')} description={t('Allocate produced stock to branches and track delivery notes.')} actions={<Button onClick={() => setAdhoc(true)}><Plus />{t('Ad-hoc dispatch')}</Button>} />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            {t('Ready to dispatch')}
            {pending.length > 1 && (
              <Select value={planId} onValueChange={setPlanPick}>
                <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
                <SelectContent>{pending.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} · {formatDate(p.date)}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {planId ? (
            <AllocationGrid key={planId} planId={planId} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('No completed production plans waiting for dispatch. Record production on a confirmed plan first.')}</p>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={columns} data={rows} getRowId={(d) => d.id} onRowClick={(d) => nav(`/ho/dispatch/${d.id}`)}
        searchPlaceholder={t('Search delivery notes…')} pageSize={15} emptyTitle={t('No dispatch notes')}
        toolbar={
          <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
            <ToggleGroupItem value="all" className="px-3">{t('All')}</ToggleGroupItem>
            <ToggleGroupItem value="in_transit" className="px-3">{t('In transit')}</ToggleGroupItem>
            <ToggleGroupItem value="received" className="px-3">{t('Received')}</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <AdhocDispatchDialog open={adhoc} onOpenChange={setAdhoc} onCreated={(id) => nav(`/ho/dispatch/${id}`)} />
    </>
  )
}
