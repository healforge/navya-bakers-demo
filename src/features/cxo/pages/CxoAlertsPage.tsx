import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { BranchSelect, ALL_BRANCHES } from '@/components/common/BranchSelect'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { computeAlerts, type AlertSeverity, type AlertType } from '@/store/alerts'
import { AlertCard } from '../components/AlertList'
import { useCxoScope } from '../filters'

const TYPES: { value: AlertType; label: string }[] = [
  { value: 'wastage', label: 'Wastage' }, { value: 'sales_drop', label: 'Sales drop' }, { value: 'cash_variance', label: 'Cash variance' },
  { value: 'day_not_closed', label: 'Day not closed' }, { value: 'indent_pending', label: 'Indent pending' }, { value: 'dispatch_transit', label: 'Dispatch in transit' },
  { value: 'raw_material_low', label: 'Raw material low' }, { value: 'expired_stock', label: 'Expired stock' },
]
const SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info']
const ALL = 'all'

export default function CxoAlertsPage() {
  const { db } = useCxoScope()
  const [type, setType] = useState<string>(ALL)
  const [branch, setBranch] = useState<string>(ALL_BRANCHES)
  const alerts = useMemo(() => computeAlerts(db), [db])
  const filtered = useMemo(() => alerts.filter((a) => (type === ALL || a.type === type) && (branch === ALL_BRANCHES || a.branchId === branch)), [alerts, type, branch])
  const branchName = (id?: string) => db.branches.find((b) => b.id === id)?.name

  return (
    <>
      <PageHeader
        title="Alerts"
        description={`${alerts.length} open exception${alerts.length === 1 ? '' : 's'} across the business.`}
        actions={<>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All types</SelectItem>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <BranchSelect value={branch} onChange={setBranch} allowAll className="w-44" />
        </>}
      />
      {filtered.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No alerts" description="Nothing matches these filters. All clear." />
      ) : (
        <div className="space-y-6">
          {SEVERITIES.map((sev) => {
            const list = filtered.filter((a) => a.severity === sev)
            if (!list.length) return null
            return (
              <section key={sev} className="space-y-2">
                <div className="flex items-center gap-2"><StatusBadge status={sev} /><span className="text-sm text-muted-foreground">{list.length}</span></div>
                <div className="grid gap-2 lg:grid-cols-2">{list.map((a) => <AlertCard key={a.id} alert={a} branchName={branchName(a.branchId)} />)}</div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
