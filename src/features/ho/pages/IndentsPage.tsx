import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Factory } from 'lucide-react'
import { EmptyState, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addDaysISO, todayISO } from '@/lib/dates'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDb } from '@/store/db'
import { branchName, productName } from '@/store/selectors'
import type { Indent } from '@/types/domain'

function statusKey(i: Indent | undefined): string {
  if (!i) return 'missing'
  if (i.status === 'draft') return 'draft'
  if (i.status === 'submitted' && i.late) return 'late'
  return i.status
}

export default function IndentsPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const [date, setDate] = useState(addDaysISO(todayISO(), 1))
  const [openId, setOpenId] = useState<string | null>(null)

  const data = useMemo(() => {
    const branches = db.branches.filter((b) => b.active)
    const indents = db.indents.filter((i) => i.deliveryDate === date)
    const byBranch = new Map(indents.map((i) => [i.branchId, i]))
    const counted = indents.filter((i) => i.status !== 'draft')
    const pm = new Map(db.products.map((p) => [p.id, p]))
    const qty = new Map<string, Map<string, number>>() // product → branch → qty
    for (const i of counted) for (const l of i.lines) {
      if (l.qty <= 0) continue
      const row = qty.get(l.productId) ?? new Map<string, number>()
      row.set(i.branchId, (row.get(i.branchId) ?? 0) + l.qty)
      qty.set(l.productId, row)
    }
    const order = db.products.map((p) => p.id)
    const products = [...qty.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const colTotals = new Map(branches.map((b) => [b.id, products.reduce((s, p) => s + (qty.get(p)?.get(b.id) ?? 0), 0)]))
    const plan = db.productionPlans.find((p) => p.date === date)
    return { branches, byBranch, qty, products, colTotals, plan, pm }
  }, [db, date])

  const open = openId ? db.indents.find((i) => i.id === openId) : undefined
  const grand = [...data.colTotals.values()].reduce((s, n) => s + n, 0)

  return (
    <>
      <PageHeader
        title={t('Indents')}
        description={t('Branch requests by delivery date — submitted indents flow straight into production.')}
        actions={
          <>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
            <Button variant="outline" onClick={() => setDate(addDaysISO(todayISO(), 1))}>{t('Tomorrow')}</Button>
            <Button asChild>
              <Link to={data.plan ? `/ho/production/${data.plan.id}` : '/ho/production'}><Factory />{data.plan ? t('Open plan {number}', { number: data.plan.number }) : t('Go to production')}</Link>
            </Button>
          </>
        }
      />
      <p className="mb-3 text-sm text-muted-foreground">{t('Delivery date:')} {formatDate(date)}</p>

      <Card className="mb-4">
        <CardHeader><CardTitle>{t('Branch status')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{t('Branch')}</TableHead><TableHead>{t('Status')}</TableHead><TableHead>{t('Indent')}</TableHead><TableHead className="text-right">{t('Units')}</TableHead><TableHead>{t('Submitted')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.branches.map((b) => {
                const i = data.byBranch.get(b.id)
                const k = statusKey(i)
                const units = i ? i.lines.reduce((s, l) => s + l.qty, 0) : 0
                return (
                  <TableRow key={b.id} className={i ? 'cursor-pointer' : undefined} onClick={i ? () => setOpenId(i.id) : undefined}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell><StatusBadge status={k} /></TableCell>
                    <TableCell>{i?.number ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{i ? units : '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{i?.submittedAt ? formatDateTime(i.submittedAt) : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('Consolidated matrix (submitted indents)')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.products.length === 0 ? (
            <div className="p-4"><EmptyState title={t('No submitted indents')} description={t('Nothing has been submitted for this delivery date yet.')} /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">{t('Product')}</TableHead>
                    {data.branches.map((b) => <TableHead key={b.id} className="text-right">{b.name}</TableHead>)}
                    <TableHead className="text-right">{t('Total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.map((pid) => {
                    const row = data.qty.get(pid)
                    const total = [...(row?.values() ?? [])].reduce((s, n) => s + n, 0)
                    return (
                      <TableRow key={pid}>
                        <TableCell className="sticky left-0 z-10 bg-card font-medium">{productName(db, pid)}</TableCell>
                        {data.branches.map((b) => {
                          const q = row?.get(b.id)
                          return <TableCell key={b.id} className={cn('text-right tabular-nums', !q && 'text-muted-foreground/50')}>{q ?? '·'}</TableCell>
                        })}
                        <TableCell className="text-right font-semibold tabular-nums">{total}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="sticky left-0 z-10 bg-muted">{t('Total')}</TableCell>
                    {data.branches.map((b) => <TableCell key={b.id} className="text-right tabular-nums">{data.colTotals.get(b.id)}</TableCell>)}
                    <TableCell className="text-right tabular-nums">{grand}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.number} · {branchName(db, open.branchId)}</SheetTitle>
                <SheetDescription>{t('Delivery')} {formatDate(open.deliveryDate)} <StatusBadge status={statusKey(open)} className="ml-1" /></SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <Table>
                  <TableHeader><TableRow><TableHead>{t('Product')}</TableHead><TableHead className="text-right">{t('Suggested')}</TableHead><TableHead className="text-right">{t('Indent')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {open.lines.filter((l) => l.qty > 0 || l.suggestedQty > 0).map((l) => (
                      <TableRow key={l.productId}>
                        <TableCell>{productName(db, l.productId)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{l.suggestedQty}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{l.qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {open.note && <p className="mt-3 text-sm text-muted-foreground">{t('Note:')} {open.note}</p>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
