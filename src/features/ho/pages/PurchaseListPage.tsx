import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { DataTable, Money, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import { useDb } from '@/store/db'
import { supplierMap } from '@/store/selectors'
import type { POStatus, PurchaseOrder } from '@/types/domain'

const TABS: { value: 'all' | POStatus; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' },
  { value: 'partially_received', label: 'Partial' }, { value: 'received', label: 'Received' }, { value: 'cancelled', label: 'Cancelled' },
]

export default function PurchaseListPage() {
  const db = useDb((d) => d)
  const nav = useNavigate()
  const [tab, setTab] = useState<'all' | POStatus>('all')
  const sup = useMemo(() => supplierMap(db), [db])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: db.purchaseOrders.length }
    for (const p of db.purchaseOrders) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [db.purchaseOrders])
  const rows = useMemo(() => db.purchaseOrders.filter((p) => tab === 'all' || p.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.purchaseOrders, tab])

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    { accessorKey: 'number', header: 'PO' },
    { id: 'supplier', header: 'Supplier', accessorFn: (p) => sup.get(p.supplierId)?.name ?? '' },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: 'expectedDate', header: 'Expected', cell: ({ row }) => formatDate(row.original.expectedDate) },
    { id: 'items', header: 'Items', accessorFn: (p) => p.lines.length },
    { id: 'total', header: 'Total', accessorFn: (p) => p.lines.reduce((s, l) => s + l.qty * l.rate, 0), cell: ({ getValue }) => <Money value={getValue<number>()} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ], [sup])

  return (
    <>
      <PageHeader title="Purchase orders" description="Order raw materials from suppliers and receive goods (GRN)." actions={<Button onClick={() => nav('/ho/purchase/new')}><Plus />New PO</Button>} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-3">
        <TabsList>{TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label} ({counts[t.value] ?? 0})</TabsTrigger>)}</TabsList>
      </Tabs>
      <DataTable columns={columns} data={rows} getRowId={(p) => p.id} onRowClick={(p) => nav(`/ho/purchase/${p.id}`)} searchPlaceholder="Search POs…" pageSize={15} emptyTitle="No purchase orders" initialSorting={[]} />
    </>
  )
}
