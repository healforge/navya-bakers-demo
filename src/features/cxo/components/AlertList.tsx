import { Link } from 'react-router'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'
import type { Alert } from '@/store/alerts'

/** CXO may only follow /cxo links; branch-scoped alerts map to the branch drill-down. */
export function cxoAlertLink(a: Alert): string | null {
  if (a.link?.startsWith('/cxo')) return a.link
  if (a.branchId) return `/cxo/branches/${a.branchId}`
  return null
}

const ICON = { critical: OctagonAlert, warning: AlertTriangle, info: Info }
const TONE = { critical: 'text-danger', warning: 'text-warning-foreground dark:text-warning', info: 'text-chart-4' }

export function AlertCard({ alert, branchName, compact = false }: { alert: Alert; branchName?: string; compact?: boolean }) {
  const Icon = ICON[alert.severity]
  const link = cxoAlertLink(alert)
  const hoOnly = !!alert.link && !alert.link.startsWith('/cxo')
  const body = (
    <div className={cn('flex gap-3 rounded-xl border bg-card p-3', link && 'transition-colors hover:bg-muted/50')}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', TONE[alert.severity])} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{alert.title}</span>
          {!compact && <StatusBadge status={alert.severity} />}
        </div>
        {!compact && <p className="text-sm text-muted-foreground">{alert.detail}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {branchName && <span>{branchName}</span>}
          {(hoOnly || !link) && <span className="rounded bg-muted px-1.5 py-0.5">Handled by HO</span>}
        </div>
      </div>
    </div>
  )
  return link ? <Link to={link} className="block">{body}</Link> : body
}
