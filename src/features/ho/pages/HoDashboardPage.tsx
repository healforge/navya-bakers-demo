import { useMemo } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ClipboardList, Factory, PackageX, ShoppingCart, Truck } from 'lucide-react'
import { EmptyState, KpiCard, PageHeader, StatusBadge } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { addDaysISO, todayISO } from '@/lib/dates'
import { formatDate, formatQty } from '@/lib/format'
import { cn } from '@/lib/utils'
import { computeAlerts } from '@/store/alerts'
import { dispatchVariance } from '@/store/analytics'
import { useDb } from '@/store/db'
import { branchName, productName, rawMaterialStatus, supplierMap } from '@/store/selectors'
import { hoursSince } from '../components/shared'

const CHIP: Record<string, string> = {
  submitted: 'bg-success/15 text-success',
  late: 'bg-warning/25 text-warning-foreground dark:text-warning',
  draft: 'bg-muted text-muted-foreground',
  missing: 'bg-danger/15 text-danger',
}

export default function HoDashboardPage() {
  const db = useDb((d) => d)
  const today = todayISO()
  const tomorrow = addDaysISO(today, 1)

  const d = useMemo(() => {
    const branches = db.branches.filter((b) => b.active)
    const chips = branches.map((b) => {
      const ind = db.indents.find((i) => i.branchId === b.id && i.deliveryDate === tomorrow)
      const key = !ind ? 'missing' : ind.status === 'draft' ? 'draft' : ind.late ? 'late' : 'submitted'
      return { branch: b, indent: ind, key }
    })
    const received = chips.filter((c) => c.key === 'submitted' || c.key === 'late').length
    const planTomorrow = db.productionPlans.find((p) => p.date === tomorrow)
    const planToday = db.productionPlans.find((p) => p.date === today)
    const transit = db.dispatches.filter((x) => x.status === 'in_transit')
    const lowRm = db.rawMaterials.filter((m) => rawMaterialStatus(m) !== 'ok')
    const openPOs = db.purchaseOrders.filter((p) => p.status === 'sent' || p.status === 'partially_received')
    const draftPOs = db.purchaseOrders.filter((p) => p.status === 'draft').length
    const variance = dispatchVariance(db, 7)
    const alerts = computeAlerts(db).filter((a) => a.type !== 'sales_drop' && a.type !== 'wastage')
    return { chips, received, total: branches.length, planTomorrow, planToday, transit, lowRm, openPOs, draftPOs, variance, alerts }
  }, [db, today, tomorrow])
  const sup = useMemo(() => supplierMap(db), [db])

  const planLabel = (p: typeof d.planToday, date: string) =>
    p ? (
      <div className="flex items-center justify-between gap-2">
        <Link to={`/ho/production/${p.id}`} className="font-medium hover:underline">{p.number}</Link>
        <StatusBadge status={p.status} />
      </div>
    ) : (
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>No plan for {formatDate(date)}</span>
        <Link to="/ho/production" className="text-primary hover:underline">Generate</Link>
      </div>
    )

  return (
    <>
      <PageHeader title="Head office" description="Central kitchen operations at a glance" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tomorrow's indents" value={`${d.received} / ${d.total}`} icon={ClipboardList} />
        <KpiCard label="In transit" value={String(d.transit.length)} icon={Truck} />
        <KpiCard label="Raw materials below reorder" value={String(d.lowRm.length)} icon={PackageX} />
        <KpiCard label="Open POs" value={String(d.openPOs.length)} icon={ShoppingCart} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">Indents for {formatDate(tomorrow)}<Link to="/ho/indents" className="text-sm font-normal text-primary hover:underline">View matrix</Link></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {d.chips.map((c) => (
                <span key={c.branch.id} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium', CHIP[c.key])}>
                  {c.branch.name}<span className="text-xs font-normal opacity-80">{c.key}</span>
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{d.received} of {d.total} branches have submitted. Missing or draft indents are not included in production.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Factory className="size-4" />Production</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><div className="mb-1 text-xs uppercase text-muted-foreground">Tomorrow</div>{planLabel(d.planTomorrow, tomorrow)}</div>
            <div><div className="mb-1 text-xs uppercase text-muted-foreground">Today</div>{planLabel(d.planToday, today)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">Dispatches in transit<Link to="/ho/dispatch" className="text-sm font-normal text-primary hover:underline">All dispatches</Link></CardTitle></CardHeader>
          <CardContent>
            {d.transit.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in transit.</p> : (
              <ul className="divide-y">
                {d.transit.map((t) => {
                  const h = hoursSince(t.dispatchedAt)
                  return (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <Link to={`/ho/dispatch/${t.id}`} className="font-medium hover:underline">{t.number} <span className="font-normal text-muted-foreground">to {branchName(db, t.branchId)}</span></Link>
                      <span className={cn('tabular-nums', h > db.settings.transitAlertHours && 'font-medium text-danger')}>{h.toFixed(1)} h</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">Raw materials below reorder<Link to="/ho/raw-materials" className="text-sm font-normal text-primary hover:underline">Manage</Link></CardTitle></CardHeader>
          <CardContent>
            {d.lowRm.length === 0 ? <p className="text-sm text-muted-foreground">All stocked above reorder levels.</p> : (
              <ul className="divide-y">
                {d.lowRm.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{m.name} <span className="text-muted-foreground">({sup.get(m.preferredSupplierId ?? '')?.name ?? 'no supplier'})</span></span>
                    <span className="flex items-center gap-2 tabular-nums">{formatQty(m.stockQty, m.unit)} / {formatQty(m.reorderLevel)}<StatusBadge status={rawMaterialStatus(m)} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between">Open purchase orders<Link to="/ho/purchase" className="text-sm font-normal text-primary hover:underline">All POs</Link></CardTitle></CardHeader>
          <CardContent>
            {d.openPOs.length === 0 ? <p className="text-sm text-muted-foreground">No open purchase orders.</p> : (
              <ul className="divide-y">
                {d.openPOs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <Link to={`/ho/purchase/${p.id}`} className="font-medium hover:underline">{p.number} <span className="font-normal text-muted-foreground">{sup.get(p.supplierId)?.name}</span></Link>
                    <span className="flex items-center gap-2">due {formatDate(p.expectedDate)}<StatusBadge status={p.status} /></span>
                  </li>
                ))}
              </ul>
            )}
            {d.draftPOs > 0 && <p className="mt-2 text-xs text-muted-foreground">{d.draftPOs} draft PO(s) not yet sent.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dispatch variance, last 7 days</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-6 text-sm">
              <div><div className="text-2xl font-semibold tabular-nums">{d.variance.totals.dispatched}</div><div className="text-muted-foreground">dispatched</div></div>
              <div><div className="text-2xl font-semibold tabular-nums text-danger">{d.variance.totals.short}</div><div className="text-muted-foreground">short</div></div>
              <div><div className="text-2xl font-semibold tabular-nums text-warning-foreground dark:text-warning">{d.variance.totals.damaged}</div><div className="text-muted-foreground">damaged</div></div>
            </div>
            {d.variance.rows.slice(0, 4).map((r) => (
              <div key={`${r.branchId}|${r.productId}`} className="flex justify-between text-sm">
                <span>{branchName(db, r.branchId)} · {productName(db, r.productId)}</span>
                <span className="tabular-nums text-muted-foreground">{r.short} short, {r.damaged} damaged</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4" />Operational alerts<Badge variant="secondary">{d.alerts.length}</Badge></CardTitle></CardHeader>
        <CardContent>
          {d.alerts.length === 0 ? <EmptyState title="No operational alerts" /> : (
            <ul className="divide-y">
              {d.alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <StatusBadge status={a.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-muted-foreground">{a.detail}</div>
                  </div>
                  {a.link?.startsWith('/ho') && <Link to={a.link} className="shrink-0 text-primary hover:underline">Open</Link>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
