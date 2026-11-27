import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Factory } from 'lucide-react'
import { DataTable, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { addDaysISO, todayISO } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import type { ProductionPlan } from '@/types/domain'
import { run } from '../components/shared'

export default function ProductionListPage() {
  const { t } = useLanguage()
  const plans = useDb((d) => d.productionPlans)
  const nav = useNavigate()
  const [date, setDate] = useState(addDaysISO(todayISO(), 1))
  const rows = useMemo(() => [...plans].sort((a, b) => b.date.localeCompare(a.date)), [plans])
  const existing = plans.find((p) => p.date === date)

  const columns = useMemo<ColumnDef<ProductionPlan>[]>(() => [
    { accessorKey: 'number', header: 'Plan' },
    { accessorKey: 'date', header: 'For date', cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'products', header: 'Products', accessorFn: (p) => p.lines.filter((l) => l.plannedQty > 0).length },
    { id: 'indented', header: 'Indented', accessorFn: (p) => p.lines.reduce((s, l) => s + l.indentQty, 0), cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: 'planned', header: 'Planned', accessorFn: (p) => p.lines.reduce((s, l) => s + l.plannedQty, 0), cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { id: 'produced', header: 'Produced', accessorFn: (p) => (p.status === 'completed' ? p.lines.reduce((s, l) => s + (l.producedQty ?? 0), 0) : null), cell: ({ getValue }) => <span className="tabular-nums">{getValue<number | null>() ?? '—'}</span> },
  ], [])

  const generate = async () => {
    let id = ''
    if (await run(t, () => { id = dbActions.generateProductionPlan(date) }, existing ? 'Plan re-consolidated' : 'Production plan generated')) nav(`/ho/production/${id}`)
  }

  return (
    <>
      <PageHeader title={t('Production')} description={t('Consolidate submitted indents into a production plan.')} />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="plan-date">{t('Plan for delivery date')}</label>
            <Input id="plan-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
          </div>
          <Button onClick={generate}><Factory />{existing?.status === 'draft' ? t('Re-generate plan') : t('Generate plan')}</Button>
          {existing && <Button variant="outline" onClick={() => nav(`/ho/production/${existing.id}`)}>{t('Open')} {existing.number}</Button>}
        </CardContent>
      </Card>
      <DataTable columns={columns} data={rows} getRowId={(p) => p.id} onRowClick={(p) => nav(`/ho/production/${p.id}`)} searchPlaceholder={t('Search plans…')} pageSize={15} emptyTitle={t('No production plans yet')} />
    </>
  )
}
