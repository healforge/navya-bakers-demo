import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/common/DataTable'
import { Sparkline } from '@/components/common/KpiCard'
import { formatDelta, formatINR, formatINRCompact, formatNumber, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BranchRow } from '@/store/analytics'

export function LeaderboardTable({ rows, wastageAlertPct }: { rows: BranchRow[]; wastageAlertPct: number }) {
  const nav = useNavigate()
  const columns = useMemo<ColumnDef<BranchRow>[]>(() => [
    { accessorKey: 'rank', header: '#', cell: (c) => <span className="text-muted-foreground">{c.getValue<number>()}</span> },
    { accessorKey: 'name', header: 'Branch', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { accessorKey: 'revenue', header: 'Revenue', cell: (c) => <span className="tabular-nums">{formatINRCompact(c.getValue<number>())}</span> },
    { accessorKey: 'growthPct', header: 'Growth', cell: (c) => { const v = c.getValue<number>(); return <span className={cn('tabular-nums font-medium', v >= 0 ? 'text-success' : 'text-danger')}>{formatDelta(v)}</span> } },
    { accessorKey: 'bills', header: 'Bills', cell: (c) => <span className="tabular-nums">{formatNumber(c.getValue<number>())}</span> },
    { accessorKey: 'abv', header: 'ABV', cell: (c) => <span className="tabular-nums">{formatINR(c.getValue<number>())}</span> },
    { accessorKey: 'wastagePct', header: 'Wastage', cell: (c) => { const v = c.getValue<number>(); return <span className={cn('tabular-nums', v > wastageAlertPct && 'font-medium text-danger')}>{formatPct(v)}</span> } },
    { accessorKey: 'marginPct', header: 'Margin', cell: (c) => <span className="tabular-nums">{formatPct(c.getValue<number>())}</span> },
    { accessorKey: 'cashVariance', header: 'Cash var.', cell: (c) => { const v = c.getValue<number>(); return <span className={cn('tabular-nums', v < 0 && 'font-medium text-danger')}>{formatINR(v)}</span> } },
    { id: 'trend', header: 'Trend', enableSorting: false, cell: (c) => <div className="w-20"><Sparkline data={c.row.original.sparkline} /></div> },
  ], [wastageAlertPct])
  return (
    <DataTable columns={columns} data={rows} searchable={false} getRowId={(r) => r.branchId} onRowClick={(r) => nav(`/cxo/branches/${r.branchId}`)} initialSorting={[{ id: 'rank', desc: false }]} />
  )
}
