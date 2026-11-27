import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Percent, Receipt, ShoppingBag, Trash2, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { formatINRCompact, formatINR, formatNumber, formatPct } from '@/lib/format'
import { computeAlerts } from '@/store/alerts'
import { branchLeaderboard, categoryMix, dailySeries, hourlyHeatmap, paymentMix, salesSummary } from '@/store/analytics'
import { AlertCard } from '../components/AlertList'
import { BranchBarChart } from '../components/BranchBarChart'
import { CategoryBars } from '../components/CategoryBars'
import { ChartCard } from '../components/ChartCard'
import { CxoFilterBar } from '../components/CxoFilterBar'
import { PaymentMixBar } from '../components/PaymentMixBar'
import { PeakHoursHeatmap } from '../components/PeakHoursHeatmap'
import { RevenueTrendChart } from '../components/RevenueTrendChart'
import { trendRange, useCxoScope } from '../filters'

export default function CxoOverviewPage() {
  const { t } = useLanguage()
  const { db, range, branchIds, scopeIds } = useCxoScope()
  const sum = useMemo(() => salesSummary(db, range, branchIds), [db, range, branchIds])
  const series = useMemo(() => dailySeries(db, trendRange(range), branchIds), [db, range, branchIds])
  const rows = useMemo(() => branchLeaderboard(db, range, branchIds), [db, range, branchIds])
  const cats = useMemo(() => categoryMix(db, range, branchIds), [db, range, branchIds])
  const heat = useMemo(() => hourlyHeatmap(db, trendRange(range, 28), branchIds), [db, range, branchIds])
  const pay = useMemo(() => paymentMix(db, range, branchIds), [db, range, branchIds])
  const alerts = useMemo(() => computeAlerts(db, undefined, t), [db, t])
  const scoped = useMemo(() => alerts.filter((a) => !a.branchId || scopeIds.includes(a.branchId)), [alerts, scopeIds])
  const branchName = (id?: string) => db.branches.find((b) => b.id === id)?.name
  const c = sum.current, d = sum.deltas
  const spark = series.slice(-14).map((p) => p.revenue)
  const includesToday = range.to === db.anchorDate

  return (
    <>
      <PageHeader title={t('Overview')} description={includesToday ? t('Growth compares like-for-like with the same hours of the previous period.') : t('Growth compares with the previous equal-length period.')} actions={<CxoFilterBar />} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label={t('Revenue')} value={formatINRCompact(c.revenue)} delta={d.revenue} icon={TrendingUp} sparkline={spark} className="col-span-2 lg:col-span-1" />
          <KpiCard label={t('Bills')} value={formatNumber(c.bills)} delta={d.bills} icon={Receipt} />
          <KpiCard label={t('Avg bill value')} value={formatINR(c.abv)} delta={d.abv} icon={ShoppingBag} />
          <KpiCard label={t('Gross margin')} value={formatPct(c.grossMarginPct)} delta={d.grossMarginPct} deltaLabel="pp vs previous" icon={Percent} />
          <KpiCard label={t('Wastage')} value={formatPct(c.wastagePct)} delta={d.wastagePct} deltaLabel="pp vs previous" goodWhen="down" icon={Trash2} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title={t('Revenue trend')} description={t('Daily revenue with 7-day moving average')} className="lg:col-span-2"><RevenueTrendChart data={series} /></ChartCard>
          <ChartCard title={t('Revenue by branch')} description={t('This vs previous period')}><BranchBarChart rows={rows} compare /></ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title={t('Category mix')} description={t('Share of revenue')}><CategoryBars rows={cats} /></ChartCard>
          <ChartCard title={t('Peak hours')} description={t('Average sales by weekday and hour (last 28 days min.)')} className="lg:col-span-2"><PeakHoursHeatmap data={heat} /></ChartCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title={t('Payment mix')}><PaymentMixBar mix={pay} /></ChartCard>
          <ChartCard
            title={t('Needs attention')}
            description={t('{count} open alert{plural}', { count: scoped.length, plural: scoped.length === 1 ? '' : 's' })}
            className="lg:col-span-2"
            action={<Button asChild variant="ghost" size="sm"><Link to="/cxo/alerts">{t('All alerts')} <ArrowRight /></Link></Button>}
          >
            {scoped.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('All clear. No alerts for the selected branches.')}</p> : (
              <div className="space-y-2">{scoped.slice(0, 5).map((a) => <AlertCard key={a.id} alert={a} branchName={branchName(a.branchId)} compact />)}</div>
            )}
          </ChartCard>
        </div>
      </div>
    </>
  )
}
