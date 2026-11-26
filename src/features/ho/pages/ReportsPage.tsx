import { useMemo, useState } from 'react'
import { BranchSelect, DateRangeSelect, PageHeader, useDateRange } from '@/components/common'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isoRange, rangeLength } from '@/lib/dates'
import { formatDate, round2 } from '@/lib/format'
import { dispatchVariance, productPerformance } from '@/store/analytics'
import { useDb } from '@/store/db'
import { branchMap, getSalesDay, productMap } from '@/store/selectors'
import { ReportTable, type Cell } from '../components/ReportTable'

export default function ReportsPage() {
  const db = useDb((d) => d)
  const { preset, setPreset, range } = useDateRange('last7')
  const [selected, setSelected] = useState<string[]>([])
  const bm = useMemo(() => branchMap(db), [db])
  const pm = useMemo(() => productMap(db), [db])
  const branchIds = useMemo(() => (selected.length ? selected : db.branches.filter((b) => b.active).map((b) => b.id)), [selected, db.branches])
  const inRange = (d: string) => d >= range.from && d <= range.to
  const bName = (id: string) => bm.get(id)?.name ?? id
  const tag = `${range.from}_${range.to}`

  const sales = useMemo(() => {
    const dates = isoRange(range.from, range.to)
    const rows: Cell[][] = dates.map((d) => {
      const vals = branchIds.map((b) => getSalesDay(db, b, d)?.total ?? 0)
      return [formatDate(d), ...vals, round2(vals.reduce((s, n) => s + n, 0))]
    })
    const totals: Cell[] = ['Total', ...branchIds.map((_, i) => round2(rows.reduce((s, r) => s + (r[i + 1] as number), 0))), round2(rows.reduce((s, r) => s + (r[r.length - 1] as number), 0))]
    return { rows, totals }
  }, [db, range, branchIds])

  const products = useMemo(() => productPerformance(db, range, branchIds).map((p): Cell[] => [p.name, p.category, p.qty, round2(p.revenue), round2(p.margin), round2(p.marginPct), p.wastageQty, round2(p.wastagePct)]), [db, range, branchIds])

  const wastage = useMemo(() => db.wastage.filter((w) => inRange(w.date) && branchIds.includes(w.branchId)).sort((a, b) => b.date.localeCompare(a.date))
    .map((w): Cell[] => [formatDate(w.date), bName(w.branchId), pm.get(w.productId)?.name ?? w.productId, w.qty, w.reason, round2(w.valueAtMRP), round2(w.valueAtCost)]), [db.wastage, range, branchIds, pm, bm])
  const wastageTotals: Cell[] = ['Total', '', '', wastage.reduce((s, r) => s + (r[3] as number), 0), '', round2(wastage.reduce((s, r) => s + (r[5] as number), 0)), round2(wastage.reduce((s, r) => s + (r[6] as number), 0))]

  const variance = useMemo(() => {
    const v = dispatchVariance(db, rangeLength(range), range.to)
    const rows = v.rows.filter((r) => branchIds.includes(r.branchId)).map((r): Cell[] => [bName(r.branchId), pm.get(r.productId)?.name ?? r.productId, r.dispatched, r.received, r.damaged, r.short])
    return rows
  }, [db, range, branchIds, pm, bm])

  const closes = useMemo(() => db.dayCloses.filter((c) => inRange(c.date) && branchIds.includes(c.branchId)).sort((a, b) => b.date.localeCompare(a.date))
    .map((c): Cell[] => [formatDate(c.date), bName(c.branchId), c.openingFloat, c.cashSales, c.upiSales, c.cardSales, c.cashExpenses, c.expectedCash, c.countedCash, c.variance]), [db.dayCloses, range, branchIds, bm])

  return (
    <>
      <PageHeader title="Reports" description="Operational reports with CSV export." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DateRangeSelect value={preset} onChange={setPreset} />
        <BranchSelect mode="multi" value={selected} onChange={setSelected} />
        <span className="text-sm text-muted-foreground">{formatDate(range.from)} – {formatDate(range.to)}</span>
      </div>
      <Tabs defaultValue="sales">
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger><TabsTrigger value="products">Product sales</TabsTrigger><TabsTrigger value="wastage">Wastage</TabsTrigger>
          <TabsTrigger value="variance">Dispatch variance</TabsTrigger><TabsTrigger value="close">Day close / cash</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <ReportTable filename={`sales_${tag}`} headers={['Date', ...branchIds.map(bName), 'Total']} kinds={['text', ...branchIds.map(() => 'inr' as const), 'inr']} rows={sales.rows} totals={sales.totals} />
        </TabsContent>
        <TabsContent value="products">
          <ReportTable filename={`product_sales_${tag}`} headers={['Product', 'Category', 'Qty', 'Revenue', 'Margin ₹', 'Margin %', 'Wasted qty', 'Wastage %']} kinds={['text', 'text', 'num', 'inr', 'inr', 'pct', 'num', 'pct']} rows={products} />
        </TabsContent>
        <TabsContent value="wastage">
          <ReportTable filename={`wastage_${tag}`} headers={['Date', 'Branch', 'Product', 'Qty', 'Reason', 'Value at MRP', 'Value at cost']} kinds={['text', 'text', 'text', 'num', 'text', 'inr', 'inr']} rows={wastage} totals={wastageTotals} />
        </TabsContent>
        <TabsContent value="variance">
          <ReportTable filename={`dispatch_variance_${tag}`} headers={['Branch', 'Product', 'Dispatched', 'Received', 'Damaged', 'Short']} kinds={['text', 'text', 'num', 'num', 'num', 'num']} rows={variance} />
        </TabsContent>
        <TabsContent value="close">
          <ReportTable filename={`day_close_${tag}`} headers={['Date', 'Branch', 'Opening float', 'Cash sales', 'UPI', 'Card', 'Cash expenses', 'Expected cash', 'Counted cash', 'Variance']} kinds={['text', 'text', 'inr', 'inr', 'inr', 'inr', 'inr', 'inr', 'inr', 'signedInr']} rows={closes} />
        </TabsContent>
      </Tabs>
    </>
  )
}
