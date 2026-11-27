import { translate, type Translate } from '@/i18n/translations'
import { addDaysISO, todayISO } from '@/lib/dates'
import { formatDateShort, formatINR, formatPct } from '@/lib/format'
import type { DbState } from '@/types/domain'
import { totalsFor } from './analytics'
import { indentCutoff, onOrderQty } from './selectors'

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertType =
  | 'wastage' | 'sales_drop' | 'cash_variance' | 'day_not_closed' | 'indent_pending'
  | 'dispatch_transit' | 'raw_material_low' | 'expired_stock'

export interface Alert {
  /** stable id (type + branch + key) */
  id: string
  severity: AlertSeverity
  type: AlertType
  title: string
  detail: string
  branchId?: string
  /** in-app route (hash-router path) */
  link?: string
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

/** Compute all exception alerts as of `now`. Pure. "Last 7 d" = the 7 completed days before today. */
const english: Translate = (message, values) => translate('en', message, values)

export function computeAlerts(db: DbState, now: Date = new Date(), t: Translate = english): Alert[] {
  const s = db.settings
  const today = todayISO(now)
  const yesterday = addDaysISO(today, -1)
  const last7 = { from: addDaysISO(today, -7), to: yesterday }
  const prior7 = { from: addDaysISO(today, -14), to: addDaysISO(today, -8) }
  const out: Alert[] = []

  for (const b of db.branches.filter((x) => x.active)) {
    // wastage
    const w = totalsFor(db, last7, [b.id])
    if (w.wastagePct > s.wastageAlertPct) {
      out.push({
        id: `wastage:${b.id}`, type: 'wastage', branchId: b.id,
        severity: w.wastagePct > s.wastageAlertPct * 1.5 ? 'critical' : 'warning',
        title: t('{branch}: wastage {percent}', { branch: b.name, percent: formatPct(w.wastagePct) }),
        detail: t('Last 7 days wastage is {percent} of sales (threshold {threshold}%) — {amount} lost at MRP.', { percent: formatPct(w.wastagePct), threshold: s.wastageAlertPct, amount: formatINR(w.wastageValue) }),
        link: `/cxo/branches/${b.id}`,
      })
    }
    // sales drop
    const cur = w.revenue
    const prev = totalsFor(db, prior7, [b.id]).revenue
    if (prev > 0) {
      const drop = ((prev - cur) / prev) * 100
      if (drop > s.salesDropAlertPct) {
        out.push({
          id: `sales_drop:${b.id}`, type: 'sales_drop', branchId: b.id, severity: 'warning',
          title: t('{branch}: sales down {percent}', { branch: b.name, percent: formatPct(drop, 0) }),
          detail: t('Last 7 days {recent} vs {previous} in the 7 days before.', { recent: formatINR(cur), previous: formatINR(prev) }),
          link: `/cxo/branches/${b.id}`,
        })
      }
    }
    // cash variance
    for (const dc of db.dayCloses) {
      if (dc.branchId !== b.id || dc.date < last7.from || dc.date > today) continue
      if (Math.abs(dc.variance) > s.cashVarianceAlert) {
        out.push({
          id: `cash_variance:${b.id}:${dc.date}`, type: 'cash_variance', branchId: b.id,
          severity: dc.variance < 0 ? 'critical' : 'warning',
          title: t(dc.variance < 0 ? '{branch}: cash shortage {amount}' : '{branch}: cash excess {amount}', { branch: b.name, amount: formatINR(Math.abs(dc.variance)) }),
          detail: t('Day close on {date}: expected {expected}, counted {counted}.', { date: formatDateShort(dc.date), expected: formatINR(dc.expectedCash), counted: formatINR(dc.countedCash) }),
          link: `/cxo/branches/${b.id}`,
        })
      }
    }
    // yesterday not closed
    if (db.salesDays[`${b.id}|${yesterday}`] && !db.dayCloses.some((d) => d.branchId === b.id && d.date === yesterday)) {
      out.push({
        id: `day_not_closed:${b.id}:${yesterday}`, type: 'day_not_closed', branchId: b.id, severity: 'warning',
        title: t("{branch}: yesterday's day-close missing", { branch: b.name }),
        detail: t('No day-end close was recorded for {date}.', { date: formatDateShort(yesterday) }), link: '/ho/branches',
      })
    }
    // tomorrow's indent
    const tomorrow = addDaysISO(today, 1)
    const ind = db.indents.find((i) => i.branchId === b.id && i.deliveryDate === tomorrow)
    if (!ind || ind.status === 'draft') {
      const past = now.getTime() > indentCutoff(s, tomorrow).getTime()
      out.push({
        id: `indent_pending:${b.id}:${tomorrow}`, type: 'indent_pending', branchId: b.id, severity: past ? 'critical' : 'info',
        title: t('{branch}: indent for tomorrow not submitted', { branch: b.name }),
        detail: t('{status}; cutoff is {time} today{passed}.', { status: t(ind ? 'Draft saved but not submitted' : 'No indent started'), time: s.indentCutoffTime, passed: past ? t(' (passed)') : '' }),
        link: '/ho/indents',
      })
    }
    // transit
    for (const d of db.dispatches) {
      if (d.branchId !== b.id || d.status !== 'in_transit') continue
      const hrs = (now.getTime() - new Date(d.dispatchedAt).getTime()) / 3_600_000
      if (hrs > s.transitAlertHours) {
        out.push({
          id: `dispatch_transit:${d.id}`, type: 'dispatch_transit', branchId: b.id, severity: 'warning',
          title: t('{number} to {branch} in transit for {hours} h', { number: d.number, branch: b.name, hours: Math.floor(hrs) }),
          detail: t('Dispatched at {time}; not yet received (limit {limit} h).', { time: new Date(d.dispatchedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }), limit: s.transitAlertHours }),
          link: '/ho/dispatch',
        })
      }
    }
    // expired stock on hand
    const exp = db.batches.filter((x) => x.branchId === b.id && x.qtyRemaining > 0 && x.expiryDate < today)
    if (exp.length) {
      const qty = exp.reduce((sum, x) => sum + x.qtyRemaining, 0)
      out.push({
        id: `expired_stock:${b.id}`, type: 'expired_stock', branchId: b.id, severity: 'info',
        title: t('{branch}: {count} expired units still on hand', { branch: b.name, count: qty }),
        detail: t('{count} expired batch{plural} not yet written off.', { count: exp.length, plural: exp.length > 1 ? 'es' : '' }), link: `/cxo/branches/${b.id}`,
      })
    }
  }

  for (const m of db.rawMaterials) {
    if (m.stockQty >= m.reorderLevel) continue
    const onOrder = onOrderQty(db, m.id)
    out.push({
      id: `raw_material_low:${m.id}`, type: 'raw_material_low', severity: 'warning',
      title: t('{material} below reorder level', { material: m.name }),
      detail: t('{stock} {unit} in stock (reorder at {level}){onOrder}.', { stock: m.stockQty, unit: m.unit, level: m.reorderLevel, onOrder: onOrder > 0 ? t('; {qty} {unit} on order', { qty: onOrder, unit: m.unit }) : '' }),
      link: '/ho/raw-materials',
    })
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title))
}
