/**
 * Pure analytics. Inputs: DbState, a DateRange and optional branch filter.
 * They read ONLY salesDays (plus wastage / dayCloses / dispatches / indents / recipes).
 * Results are plain data — wrap calls in useMemo in components.
 */
import { addDaysISO, isoRange, previousRange, todayISO, weekdayOf, type DateRange } from '@/lib/dates'
import { round2 } from '@/lib/format'
import type { DbState, ISODate, PaymentSplit, ProductCategory, WastageReason } from '@/types/domain'
import { PRODUCT_CATEGORIES } from '@/types/domain'
import { productMap, salesDayKey, unitCostMap } from './selectors'

export type { DateRange }

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)
const growth = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : 0)

function activeBranchIds(db: DbState, branchIds?: string[]): string[] {
  return branchIds && branchIds.length ? branchIds : db.branches.filter((b) => b.active).map((b) => b.id)
}

/** Each (branch, date) SalesDay inside the range. */
function eachSalesDay(db: DbState, range: DateRange, branchIds?: string[]) {
  const out = []
  const dates = isoRange(range.from, range.to)
  for (const b of activeBranchIds(db, branchIds)) {
    for (const d of dates) {
      const sd = db.salesDays[salesDayKey(b, d)]
      if (sd) out.push(sd)
    }
  }
  return out
}

// ----------------------------------------------------------- core totals
export interface Totals {
  revenue: number
  netRevenue: number
  gst: number
  bills: number
  abv: number
  qty: number
  cogs: number
  grossMargin: number
  grossMarginPct: number
  wastageValue: number
  wastageCost: number
  wastageQty: number
  wastagePct: number
}

export function totalsFor(db: DbState, range: DateRange, branchIds?: string[]): Totals {
  return computeTotals(db, range, branchIds)
}

/** Scale a single date's contribution by `f` (0..1) — used for time-matched comparisons. */
interface PartialDay { date: ISODate; f: (sd: { byHour: number[] }) => number }

/**
 * Like-for-like comparison helper. When `range.to` is today (a partial day), returns the
 * previous period's last day cut at the current time of day, using that day's own hourly curve.
 */
function partialFor(range: DateRange, now: Date): { prevRange: DateRange; partial?: PartialDay } {
  const prevRange = previousRange(range)
  if (range.to !== todayISO(now)) return { prevRange }
  const hourFloat = now.getHours() + now.getMinutes() / 60
  const f = (sd: { byHour: number[] }) => {
    const total = sd.byHour.reduce((s, v) => s + v, 0)
    if (total <= 0) return 1
    let upto = 0
    for (let h = 0; h < 24; h++) upto += (sd.byHour[h] ?? 0) * Math.max(0, Math.min(1, hourFloat - h))
    return upto / total
  }
  return { prevRange, partial: { date: prevRange.to, f } }
}

function computeTotals(db: DbState, range: DateRange, branchIds?: string[], partial?: PartialDay): Totals {
  const costs = unitCostMap(db)
  let revenue = 0, gst = 0, bills = 0, qty = 0, cogs = 0
  const fracs = new Map<string, number>()
  for (const sd of eachSalesDay(db, range, branchIds)) {
    const f = partial && sd.date === partial.date ? partial.f(sd) : 1
    if (f !== 1) fracs.set(sd.branchId, f)
    revenue += sd.total * f
    gst += sd.gst * f
    bills += sd.bills * f
    for (const [pid, [q]] of Object.entries(sd.byProduct)) {
      qty += q * f
      cogs += q * f * (costs[pid] ?? 0)
    }
  }
  const ids = new Set(activeBranchIds(db, branchIds))
  let wastageValue = 0, wastageCost = 0, wastageQty = 0
  for (const w of db.wastage) {
    if (w.date < range.from || w.date > range.to || !ids.has(w.branchId)) continue
    const f = partial && w.date === partial.date ? (fracs.get(w.branchId) ?? 1) : 1
    wastageValue += w.valueAtMRP * f
    wastageCost += w.valueAtCost * f
    wastageQty += w.qty * f
  }
  const netRevenue = revenue - gst
  return {
    revenue: round2(revenue),
    netRevenue: round2(netRevenue),
    gst: round2(gst),
    bills: Math.round(bills),
    abv: bills ? revenue / bills : 0,
    qty: Math.round(qty),
    cogs: round2(cogs),
    grossMargin: round2(netRevenue - cogs),
    grossMarginPct: pct(netRevenue - cogs, netRevenue),
    wastageValue: round2(wastageValue),
    wastageCost: round2(wastageCost),
    wastageQty,
    wastagePct: pct(wastageValue, revenue + wastageValue),
  }
}

export interface SalesSummary {
  current: Totals
  previous: Totals
  /** % change vs previous equal-length period (pp change for margin / wastage %) */
  deltas: { revenue: number; netRevenue: number; bills: number; abv: number; grossMarginPct: number; wastagePct: number; gst: number }
  previousRange: DateRange
}

/** `now` (default: real clock) lets the previous period be time-matched when `range.to` is today. */
export function salesSummary(db: DbState, range: DateRange, branchIds?: string[], now: Date = new Date()): SalesSummary {
  const { prevRange, partial } = partialFor(range, now)
  const current = totalsFor(db, range, branchIds)
  const previous = computeTotals(db, prevRange, branchIds, partial)
  return {
    current,
    previous,
    previousRange: prevRange,
    deltas: {
      revenue: growth(current.revenue, previous.revenue),
      netRevenue: growth(current.netRevenue, previous.netRevenue),
      gst: growth(current.gst, previous.gst),
      bills: growth(current.bills, previous.bills),
      abv: growth(current.abv, previous.abv),
      grossMarginPct: current.grossMarginPct - previous.grossMarginPct,
      wastagePct: current.wastagePct - previous.wastagePct,
    },
  }
}

// ------------------------------------------------------------ time series
export interface DailyPoint {
  date: ISODate
  revenue: number
  bills: number
  /** 7-day moving average of revenue (trailing, uses available days) */
  ma7: number
  /** per-branch revenue when `perBranch` requested */
  byBranch?: Record<string, number>
}

export function dailySeries(db: DbState, range: DateRange, branchIds?: string[], perBranch = false): DailyPoint[] {
  const ids = activeBranchIds(db, branchIds)
  // include 6 lead-in days so the moving average is meaningful from day 1
  const lead = isoRange(addDaysISO(range.from, -6), addDaysISO(range.from, -1))
  const dates = isoRange(range.from, range.to)
  const revOf = (d: ISODate) => ids.reduce((s, b) => s + (db.salesDays[salesDayKey(b, d)]?.total ?? 0), 0)
  const hist = lead.map(revOf)
  const points: DailyPoint[] = []
  for (const d of dates) {
    const revenue = revOf(d)
    hist.push(revenue)
    const win = hist.slice(-7)
    const p: DailyPoint = {
      date: d,
      revenue,
      bills: ids.reduce((s, b) => s + (db.salesDays[salesDayKey(b, d)]?.bills ?? 0), 0),
      ma7: win.reduce((s, v) => s + v, 0) / win.length,
    }
    if (perBranch) p.byBranch = Object.fromEntries(ids.map((b) => [b, db.salesDays[salesDayKey(b, d)]?.total ?? 0]))
    points.push(p)
  }
  return points
}

export interface WastageDayPoint { date: ISODate; value: number; pct: number; byBranch: Record<string, number> }

/** Wastage value + wastage % (of sales+wastage) per day; byBranch = wastage % per branch. */
export function wastageSeries(db: DbState, range: DateRange, branchIds?: string[]): WastageDayPoint[] {
  const ids = activeBranchIds(db, branchIds)
  const idSet = new Set(ids)
  const dates = isoRange(range.from, range.to)
  const wByKey = new Map<string, number>()
  for (const w of db.wastage) {
    if (w.date < range.from || w.date > range.to || !idSet.has(w.branchId)) continue
    const k = salesDayKey(w.branchId, w.date)
    wByKey.set(k, (wByKey.get(k) ?? 0) + w.valueAtMRP)
  }
  return dates.map((date) => {
    let value = 0, sales = 0
    const byBranch: Record<string, number> = {}
    for (const b of ids) {
      const k = salesDayKey(b, date)
      const w = wByKey.get(k) ?? 0
      const s = db.salesDays[k]?.total ?? 0
      value += w
      sales += s
      byBranch[b] = pct(w, s + w)
    }
    return { date, value: round2(value), pct: pct(value, sales + value), byBranch }
  })
}

// ---------------------------------------------------------- branch boards
export interface BranchRow {
  branchId: string
  name: string
  code: string
  rank: number
  revenue: number
  previousRevenue: number
  growthPct: number
  bills: number
  abv: number
  wastagePct: number
  marginPct: number
  cashVariance: number
  sparkline: number[]
}

export function branchLeaderboard(db: DbState, range: DateRange, branchIds?: string[], now: Date = new Date()): BranchRow[] {
  const { prevRange: prev, partial } = partialFor(range, now)
  const spark = isoRange(range.from, range.to)
  const rows = activeBranchIds(db, branchIds).map((id) => {
    const b = db.branches.find((x) => x.id === id)!
    const cur = totalsFor(db, range, [id])
    const pr = computeTotals(db, prev, [id], partial)
    const cashVariance = db.dayCloses.filter((d) => d.branchId === id && d.date >= range.from && d.date <= range.to).reduce((s, d) => s + d.variance, 0)
    return {
      branchId: id, name: b.name, code: b.code, rank: 0,
      revenue: cur.revenue, previousRevenue: pr.revenue, growthPct: growth(cur.revenue, pr.revenue), bills: cur.bills, abv: cur.abv,
      wastagePct: cur.wastagePct, marginPct: cur.grossMarginPct, cashVariance,
      sparkline: spark.map((d) => db.salesDays[salesDayKey(id, d)]?.total ?? 0),
    } satisfies BranchRow
  })
  rows.sort((a, b) => b.revenue - a.revenue)
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

// ------------------------------------------------------- product analytics
export interface CategoryMixRow { category: ProductCategory; revenue: number; qty: number; sharePct: number }

export function categoryMix(db: DbState, range: DateRange, branchIds?: string[]): CategoryMixRow[] {
  const pm = productMap(db)
  const acc = new Map<ProductCategory, { revenue: number; qty: number }>()
  for (const sd of eachSalesDay(db, range, branchIds)) {
    for (const [pid, [q, amt]] of Object.entries(sd.byProduct)) {
      const cat = pm.get(pid)?.category
      if (!cat) continue
      const cur = acc.get(cat) ?? { revenue: 0, qty: 0 }
      cur.revenue += amt
      cur.qty += q
      acc.set(cat, cur)
    }
  }
  const total = [...acc.values()].reduce((s, v) => s + v.revenue, 0)
  return PRODUCT_CATEGORIES.filter((c) => acc.has(c)).map((category) => {
    const v = acc.get(category)!
    return { category, revenue: round2(v.revenue), qty: v.qty, sharePct: pct(v.revenue, total) }
  }).sort((a, b) => b.revenue - a.revenue)
}

export interface ProductRow {
  productId: string
  name: string
  category: ProductCategory
  rank: number
  qty: number
  revenue: number
  marginPct: number
  margin: number
  wastageQty: number
  wastageValue: number
  wastagePct: number
}

export function productPerformance(db: DbState, range: DateRange, branchIds?: string[]): ProductRow[] {
  const costs = unitCostMap(db)
  const ids = new Set(activeBranchIds(db, branchIds))
  const sold = new Map<string, { qty: number; amount: number; gst: number }>()
  const pm = productMap(db)
  for (const sd of eachSalesDay(db, range, branchIds)) {
    for (const [pid, [q, amt]] of Object.entries(sd.byProduct)) {
      const cur = sold.get(pid) ?? { qty: 0, amount: 0, gst: 0 }
      cur.qty += q
      cur.amount += amt
      const rate = pm.get(pid)?.gstRate ?? 0
      cur.gst += (amt * rate) / (100 + rate)
      sold.set(pid, cur)
    }
  }
  const waste = new Map<string, { qty: number; value: number }>()
  for (const w of db.wastage) {
    if (w.date < range.from || w.date > range.to || !ids.has(w.branchId)) continue
    const cur = waste.get(w.productId) ?? { qty: 0, value: 0 }
    cur.qty += w.qty
    cur.value += w.valueAtMRP
    waste.set(w.productId, cur)
  }
  const rows: ProductRow[] = db.products.map((p) => {
    const s = sold.get(p.id) ?? { qty: 0, amount: 0, gst: 0 }
    const w = waste.get(p.id) ?? { qty: 0, value: 0 }
    const net = s.amount - s.gst
    const margin = net - s.qty * (costs[p.id] ?? 0)
    return {
      productId: p.id, name: p.name, category: p.category, rank: 0, qty: s.qty, revenue: round2(s.amount),
      margin: round2(margin), marginPct: pct(margin, net), wastageQty: w.qty, wastageValue: round2(w.value), wastagePct: pct(w.value, s.amount + w.value),
    }
  }).filter((r) => r.qty > 0 || r.wastageQty > 0)
  rows.sort((a, b) => b.revenue - a.revenue)
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

/** weekday (0=Sun) × hour (0-23) → average ₹ per day for that slot. */
export interface HeatmapCell { weekday: number; hour: number; value: number }

export function hourlyHeatmap(db: DbState, range: DateRange, branchIds?: string[]): { cells: HeatmapCell[]; max: number } {
  const sums: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const dayCount = new Array<number>(7).fill(0)
  const dates = isoRange(range.from, range.to)
  const ids = activeBranchIds(db, branchIds)
  for (const d of dates) {
    const wd = weekdayOf(d)
    let any = false
    for (const b of ids) {
      const sd = db.salesDays[salesDayKey(b, d)]
      if (!sd) continue
      any = true
      sd.byHour.forEach((v, h) => { sums[wd]![h]! += v })
    }
    if (any) dayCount[wd]! += 1
  }
  const cells: HeatmapCell[] = []
  let max = 0
  for (let wd = 0; wd < 7; wd++) {
    for (let h = 0; h < 24; h++) {
      const value = dayCount[wd]! ? sums[wd]![h]! / dayCount[wd]! : 0
      if (value > max) max = value
      cells.push({ weekday: wd, hour: h, value })
    }
  }
  return { cells, max }
}

export function paymentMix(db: DbState, range: DateRange, branchIds?: string[]): PaymentSplit & { total: number } {
  const out = { cash: 0, upi: 0, card: 0 }
  for (const sd of eachSalesDay(db, range, branchIds)) {
    out.cash += sd.byPayment.cash
    out.upi += sd.byPayment.upi
    out.card += sd.byPayment.card
  }
  return { ...out, total: out.cash + out.upi + out.card }
}

export interface WastageReasonRow { reason: WastageReason; value: number; cost: number; qty: number; sharePct: number }

export function wastageByReason(db: DbState, range: DateRange, branchIds?: string[]): WastageReasonRow[] {
  const ids = new Set(activeBranchIds(db, branchIds))
  const acc = new Map<WastageReason, { value: number; cost: number; qty: number }>()
  for (const w of db.wastage) {
    if (w.date < range.from || w.date > range.to || !ids.has(w.branchId)) continue
    const c = acc.get(w.reason) ?? { value: 0, cost: 0, qty: 0 }
    c.value += w.valueAtMRP; c.cost += w.valueAtCost; c.qty += w.qty
    acc.set(w.reason, c)
  }
  const total = [...acc.values()].reduce((s, v) => s + v.value, 0)
  return [...acc.entries()].map(([reason, v]) => ({ reason, value: round2(v.value), cost: round2(v.cost), qty: v.qty, sharePct: pct(v.value, total) })).sort((a, b) => b.value - a.value)
}

// ---------------------------------------------------- ops-quality analytics
export interface DispatchVarianceRow {
  branchId: string
  productId: string
  dispatched: number
  received: number
  damaged: number
  short: number
}

/** Short / damaged on received dispatches in the last `days` days (ending today unless `to` given). */
export function dispatchVariance(db: DbState, days: number, to: ISODate = db.anchorDate): { rows: DispatchVarianceRow[]; byBranch: { branchId: string; dispatched: number; short: number; damaged: number }[]; totals: { dispatched: number; short: number; damaged: number } } {
  const from = addDaysISO(to, -(days - 1))
  const acc = new Map<string, DispatchVarianceRow>()
  for (const d of db.dispatches) {
    if (d.status !== 'received' || d.date < from || d.date > to) continue
    for (const l of d.lines) {
      const key = `${d.branchId}|${l.productId}`
      const r = acc.get(key) ?? { branchId: d.branchId, productId: l.productId, dispatched: 0, received: 0, damaged: 0, short: 0 }
      const rec = l.qtyReceived ?? 0
      const dmg = l.qtyDamaged ?? 0
      r.dispatched += l.qtyDispatched
      r.received += rec
      r.damaged += dmg
      r.short += Math.max(0, l.qtyDispatched - rec - dmg)
      acc.set(key, r)
    }
  }
  const rows = [...acc.values()].filter((r) => r.short > 0 || r.damaged > 0).sort((a, b) => b.short + b.damaged - (a.short + a.damaged))
  const bb = new Map<string, { branchId: string; dispatched: number; short: number; damaged: number }>()
  for (const r of acc.values()) {
    const c = bb.get(r.branchId) ?? { branchId: r.branchId, dispatched: 0, short: 0, damaged: 0 }
    c.dispatched += r.dispatched; c.short += r.short; c.damaged += r.damaged
    bb.set(r.branchId, c)
  }
  const byBranch = [...bb.values()]
  return {
    rows,
    byBranch,
    totals: byBranch.reduce((s, b) => ({ dispatched: s.dispatched + b.dispatched, short: s.short + b.short, damaged: s.damaged + b.damaged }), { dispatched: 0, short: 0, damaged: 0 }),
  }
}

export interface FillRateRow { branchId: string; indented: number; dispatched: number; fillPct: number }

/** Dispatched qty ÷ indented qty for indents with delivery dates in range. */
export function indentFillRate(db: DbState, range: DateRange, branchIds?: string[]): FillRateRow[] {
  return activeBranchIds(db, branchIds).map((branchId) => {
    let indented = 0, dispatched = 0
    for (const i of db.indents) {
      if (i.branchId !== branchId || i.deliveryDate < range.from || i.deliveryDate > range.to) continue
      if (i.status !== 'dispatched' && i.status !== 'received') continue
      indented += i.lines.reduce((s, l) => s + l.qty, 0)
      const d = db.dispatches.find((x) => x.indentId === i.id)
      if (d) dispatched += d.lines.reduce((s, l) => s + l.qtyDispatched, 0)
    }
    return { branchId, indented, dispatched, fillPct: indented ? (dispatched / indented) * 100 : 0 }
  })
}
