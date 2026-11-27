import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowRight, Calculator, CheckCircle2, ClipboardList, IndianRupee, PackageOpen, ReceiptText, Trash2, Truck } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { PageHeader } from '@/components/common/PageHeader'
import { KpiCard } from '@/components/common/KpiCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCurrentBranch, useRequireUser } from '@/auth/session'
import { useDb } from '@/store/db'
import { expiredBatches, getBranchStock, getDayClose, getIndent, getSalesDay, indentCutoff } from '@/store/selectors'
import { addDaysISO, isoRange, todayISO } from '@/lib/dates'
import { formatDateShort, formatINR, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { countdownLabel, useNow } from '../lib/utils'

const chartConfig = { total: { label: 'Sales', color: 'var(--chart-1)' } } satisfies ChartConfig

const pctDelta = (cur: number, prev: number): number | undefined => (prev > 0 ? ((cur - prev) / prev) * 100 : undefined)

interface Task { key: string; icon: typeof Truck; title: string; detail: string; to: string; tone: 'todo' | 'warn' | 'done'; badge?: React.ReactNode }

export default function BranchHomePage() {
  const { t } = useLanguage()
  const branch = useCurrentBranch()
  const user = useRequireUser()
  const db = useDb((d) => d)
  const now = useNow(30_000)
  const today = todayISO(now)
  const tomorrow = addDaysISO(today, 1)
  const hour = now.getHours()

  const kpi = useMemo(() => {
    const sd = getSalesDay(db, branch.id, today)
    const total = sd?.total ?? 0
    const bills = sd?.bills ?? 0
    const lw = getSalesDay(db, branch.id, addDaysISO(today, -7))
    // same weekday last week, only up to the current hour (never partial vs full day)
    const lwUpTo = lw ? lw.byHour.slice(0, hour + 1).reduce((s, v) => s + v, 0) : 0
    const lwBills = lw && lw.total > 0 ? lw.bills * (lwUpTo / lw.total) : 0
    const lwAbv = lw && lw.bills > 0 ? lw.total / lw.bills : 0
    const abv = bills > 0 ? total / bills : 0
    return {
      total, bills, abv,
      salesDelta: pctDelta(total, lwUpTo),
      billsDelta: pctDelta(bills, lwBills),
      abvDelta: pctDelta(abv, lwAbv),
    }
  }, [db, branch.id, today, hour])

  const series = useMemo(() => isoRange(addDaysISO(today, -6), today).map((d) => ({ date: d, label: t(formatDateShort(d).split(',')[0]), total: getSalesDay(db, branch.id, d)?.total ?? 0 })), [db, branch.id, today, t])

  const stock = useMemo(() => getBranchStock(db, branch.id, today), [db, branch.id, today])
  const lowStock = useMemo(() => stock.filter((s) => s.product.active && s.onHand <= 5).sort((a, b) => a.onHand - b.onHand), [stock])

  const tasks = useMemo(() => {
    const out: Task[] = []
    const transit = db.dispatches.filter((d) => d.branchId === branch.id && d.status === 'in_transit')
    out.push(transit.length
      ? { key: 'recv', icon: Truck, title: t('Receive {count} dispatch{plural}', { count: transit.length, plural: transit.length > 1 ? 'es' : '' }), detail: t('{numbers} in transit', { numbers: transit.map((d) => d.number).join(', ') }), to: '/branch/receive', tone: 'todo' }
      : { key: 'recv', icon: Truck, title: t('No dispatch in transit'), detail: t('Nothing to receive right now'), to: '/branch/receive', tone: 'done' })

    const ind = getIndent(db, branch.id, tomorrow)
    const cutoff = indentCutoff(db.settings, tomorrow)
    const ms = cutoff.getTime() - now.getTime()
    if (ind && ind.status !== 'draft') {
      out.push({ key: 'indent', icon: ClipboardList, title: t('Tomorrow\'s indent submitted'), detail: t(ind.late ? 'Submitted after cutoff' : 'On time'), to: '/branch/indent', tone: 'done', badge: <StatusBadge status={ind.status} /> })
    } else if (ms > 0) {
      out.push({ key: 'indent', icon: ClipboardList, title: t(ind ? "Submit tomorrow's indent (draft saved)" : "Indent for tomorrow"), detail: t('Cutoff {time} · {remaining} left', { time: db.settings.indentCutoffTime, remaining: countdownLabel(ms, t) }), to: '/branch/indent', tone: 'todo' })
    } else {
      out.push({ key: 'indent', icon: ClipboardList, title: t('Tomorrow\'s indent is late'), detail: t('Cutoff {time} has passed — submit now to be flagged late', { time: db.settings.indentCutoffTime }), to: '/branch/indent', tone: 'warn', badge: <StatusBadge status="late" /> })
    }

    const expired = expiredBatches(db, branch.id, today)
    const expiredQty = expired.reduce((s, b) => s + b.qtyRemaining, 0)
    out.push(expired.length
      ? { key: 'exp', icon: Trash2, title: t('Expired stock to write off'), detail: t('{count} units in {batches} batch{plural}', { count: expiredQty, batches: expired.length, plural: expired.length > 1 ? 'es' : '' }), to: '/branch/wastage', tone: 'warn' }
      : { key: 'exp', icon: Trash2, title: t('No expired stock'), detail: t('All batches are within date'), to: '/branch/wastage', tone: 'done' })

    const closed = getDayClose(db, branch.id, today)
    out.push(closed
      ? { key: 'close', icon: Calculator, title: t('Day closed'), detail: t('Cash reconciled for today'), to: '/branch/day-end', tone: 'done' }
      : { key: 'close', icon: Calculator, title: t('Day close pending'), detail: t('Count cash and close the day after the last bill'), to: '/branch/day-end', tone: 'todo' })
    return out
  }, [db, branch.id, today, tomorrow, now, t])

  return (
    <>
      <PageHeader title={t('Hello, {name}', { name: user.name.split(' ')[0] })} description={`${branch.name} · ${formatDateShort(today)}`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label={t('Today\'s sales')} icon={IndianRupee} value={formatINR(kpi.total)} delta={kpi.salesDelta} deltaLabel={t('vs last week, same hour')} />
        <KpiCard label={t('Bills')} icon={ReceiptText} value={formatNumber(kpi.bills)} delta={kpi.billsDelta} deltaLabel={t('vs last week, same hour (est.)')} />
        <KpiCard label={t('Avg bill value')} icon={Calculator} value={formatINR(kpi.abv)} delta={kpi.abvDelta} deltaLabel={t('vs last week')} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('Tasks')}</CardTitle><CardDescription>{t('What needs attention today')}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t) => (
              <Link key={t.key} to={t.to} className={cn('flex min-h-14 items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/60',
                t.tone === 'warn' && 'border-warning/60 bg-warning/10', t.tone === 'done' && 'text-muted-foreground')}>
                {t.tone === 'done' ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <t.icon className={cn('size-5 shrink-0', t.tone === 'warn' ? 'text-warning-foreground dark:text-warning' : 'text-primary')} />}
                <div className="min-w-0 flex-1">
                  <div className={cn('text-sm font-medium', t.tone !== 'done' && 'text-foreground')}>{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.detail}</div>
                </div>
                {t.badge}
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('Last 7 days')}</CardTitle><CardDescription>{t('Daily sales')}</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart data={series} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PackageOpen className="size-5" /> {t('Low & out of stock')}</CardTitle>
          <CardDescription>{t('5 or fewer sellable units left')}</CardDescription>
        </CardHeader>
        <CardContent>
          {lowStock.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> {t('Everything is well stocked.')}</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStock.map((s) => (
                <div key={s.productId} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <span className="truncate text-sm">{s.product.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{s.onHand}</span>
                    <StatusBadge status={s.onHand === 0 ? 'out' : 'low'} />
                  </span>
                </div>
              ))}
            </div>
          )}
          {lowStock.length > 0 && <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="size-3.5" /> {t('Consider a top-up in tomorrow\'s indent.')}</div>}
        </CardContent>
      </Card>
    </>
  )
}
