import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Bar, BarChart, CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatINR, formatINRCompact, formatNumber, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { productPerformance, type ProductRow } from '@/store/analytics'
import { ChartCard } from '../components/ChartCard'
import { CxoFilterBar } from '../components/CxoFilterBar'
import { useCxoScope } from '../filters'

const topCfg = { revenue: { label: 'Revenue', color: 'var(--chart-3)' } } satisfies ChartConfig
const botCfg = { revenue: { label: 'Revenue', color: 'var(--chart-2)' } } satisfies ChartConfig
const scCfg = { marginPct: { label: 'Margin %', color: 'var(--chart-1)' } } satisfies ChartConfig

function RevBars({ data, config }: { data: ProductRow[]; config: ChartConfig }) {
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatINRCompact(v)} />
        <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => <span className="font-mono tabular-nums">{formatINR(Number(v))}</span>} />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  )
}

export default function CxoProductsPage() {
  const { t } = useLanguage()
  const { db, range, branchIds } = useCxoScope()
  const rows = useMemo(() => productPerformance(db, range, branchIds), [db, range, branchIds])
  const sold = useMemo(() => rows.filter((r) => r.qty > 0), [rows])
  const top = useMemo(() => sold.slice(0, 8), [sold])
  const bottom = useMemo(() => sold.slice(-8).reverse(), [sold])
  const cats = useMemo(() => {
    const m = new Map<string, { revenue: number; margin: number; net: number; wv: number }>()
    for (const r of rows) {
      const c = m.get(r.category) ?? { revenue: 0, margin: 0, net: 0, wv: 0 }
      c.revenue += r.revenue; c.margin += r.margin; c.wv += r.wastageValue
      if (r.marginPct > 0) c.net += r.margin / (r.marginPct / 100)
      m.set(r.category, c)
    }
    return [...m.entries()].map(([category, c]) => ({ category, revenue: c.revenue, marginPct: c.net ? (c.margin / c.net) * 100 : 0, wastagePct: c.revenue + c.wv ? (c.wv / (c.revenue + c.wv)) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue)
  }, [rows])
  const columns = useMemo<ColumnDef<ProductRow>[]>(() => [
    { accessorKey: 'name', header: 'Product', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { accessorKey: 'category', header: 'Category', cell: (c) => <span className="text-muted-foreground">{t(c.getValue<string>())}</span> },
    { accessorKey: 'qty', header: 'Qty', cell: (c) => <span className="tabular-nums">{formatNumber(c.getValue<number>())}</span> },
    { accessorKey: 'revenue', header: 'Revenue', cell: (c) => <span className="tabular-nums">{formatINR(c.getValue<number>())}</span> },
    { accessorKey: 'marginPct', header: 'Margin %', cell: (c) => <span className="tabular-nums">{formatPct(c.getValue<number>())}</span> },
    { accessorKey: 'wastageQty', header: 'Waste qty', cell: (c) => <span className="tabular-nums">{formatNumber(c.getValue<number>())}</span> },
    { accessorKey: 'wastagePct', header: 'Waste %', cell: (c) => { const v = c.getValue<number>(); return <span className={cn('tabular-nums', v > db.settings.wastageAlertPct && 'font-medium text-danger')}>{formatPct(v)}</span> } },
  ], [db.settings.wastageAlertPct, t])

  return (
    <>
      <PageHeader title={t('Products')} description={t('What sells, what earns, what gets thrown away.')} actions={<CxoFilterBar />} />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t('Top sellers')} description={t('By revenue')}><RevBars data={top} config={topCfg} /></ChartCard>
          <ChartCard title={t('Bottom sellers')} description={t('Lowest revenue among products that sold')}><RevBars data={bottom} config={botCfg} /></ChartCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title={t('Revenue vs margin')} description={t('Each dot is a product: right = sells more, up = earns more per rupee')}>
            <ChartContainer config={scCfg} className="h-72 w-full">
              <ScatterChart margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="revenue" name={t('Revenue')} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatINRCompact(v)} />
                <YAxis type="number" dataKey="marginPct" name={t('Margin %')} width={40} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as ProductRow | undefined
                  if (!active || !p) return null
                  return <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl"><div className="font-medium">{p.name}</div><div className="text-muted-foreground">{formatINR(p.revenue)} · {formatPct(p.marginPct)} {t('margin')}</div></div>
                }} />
                <Scatter data={sold} fill="var(--color-marginPct)" fillOpacity={0.8} stroke="var(--card)" strokeWidth={2} />
              </ScatterChart>
            </ChartContainer>
          </ChartCard>
          <ChartCard title={t('Category performance')}>
            <Table>
              <TableHeader><TableRow><TableHead>{t('Category')}</TableHead><TableHead className="text-right">{t('Revenue')}</TableHead><TableHead className="text-right">{t('Margin')}</TableHead><TableHead className="text-right">{t('Waste')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {cats.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell className="font-medium">{t(c.category)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINRCompact(c.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPct(c.marginPct)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', c.wastagePct > db.settings.wastageAlertPct && 'font-medium text-danger')}>{formatPct(c.wastagePct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ChartCard>
        </div>
        <ChartCard title={t('All products')}>
          <DataTable columns={columns} data={rows} searchPlaceholder={t('Search products or categories')} pageSize={15} getRowId={(r) => r.productId} initialSorting={[{ id: 'revenue', desc: true }]} />
        </ChartCard>
      </div>
    </>
  )
}
