import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatINRCompact } from '@/lib/format'
import { branchLeaderboard } from '@/store/analytics'
import { BranchBarChart } from '../components/BranchBarChart'
import { ChartCard } from '../components/ChartCard'
import { CxoFilterBar } from '../components/CxoFilterBar'
import { LeaderboardTable } from '../components/LeaderboardTable'
import { useCxoScope } from '../filters'

export default function CxoBranchesPage() {
  const { t } = useLanguage()
  const { db, range, branchIds } = useCxoScope()
  const rows = useMemo(() => branchLeaderboard(db, range, branchIds), [db, range, branchIds])
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return (
    <>
      <PageHeader title={t('Branches')} description={t('{count} branches · {revenue} revenue. Tap a row for the branch drill-down.', { count: rows.length, revenue: formatINRCompact(total) })} actions={<CxoFilterBar />} />
      <div className="space-y-4">
        <ChartCard title={t('Leaderboard')} className="[&>div:last-child]:p-0 sm:[&>div:last-child]:px-4">
          <LeaderboardTable rows={rows} wastageAlertPct={db.settings.wastageAlertPct} />
        </ChartCard>
        <ChartCard title={t('Branch comparison')} description={t('Revenue this period vs the previous period')}><BranchBarChart rows={rows} compare className="h-72 w-full" /></ChartCard>
      </div>
    </>
  )
}
