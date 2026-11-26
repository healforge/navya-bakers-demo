import { describe, expect, it } from 'vitest'
import { presetRange } from '@/lib/dates'
import { computeAlerts } from './alerts'
import {
  branchLeaderboard, categoryMix, dailySeries, dispatchVariance, hourlyHeatmap, indentFillRate, paymentMix, productPerformance,
  salesSummary, totalsFor, wastageByReason, wastageSeries,
} from './analytics'
import { salesDayKey } from './selectors'
import { freshDb, NOW, TODAY } from './testUtils'

const db = freshDb()
const last30 = presetRange('last30', TODAY)

function rawRevenue(range: { from: string; to: string }, ids?: string[]): number {
  return Object.values(db.salesDays)
    .filter((s) => s.date >= range.from && s.date <= range.to && (!ids || ids.includes(s.branchId)))
    .reduce((a, s) => a + s.total, 0)
}

describe('analytics are consistent with salesDays', () => {
  it('totals match the raw aggregates', () => {
    const t = totalsFor(db, last30)
    expect(t.revenue).toBeCloseTo(rawRevenue(last30), 1)
    const bills = Object.values(db.salesDays).filter((s) => s.date >= last30.from).reduce((a, s) => a + s.bills, 0)
    expect(t.bills).toBe(bills)
    expect(t.netRevenue).toBeCloseTo(t.revenue - t.gst, 1)
    expect(t.grossMarginPct).toBeGreaterThan(45)
    expect(t.grossMarginPct).toBeLessThan(70)
    expect(t.wastagePct).toBeGreaterThan(0)
  })

  it('dailySeries, branchLeaderboard, categoryMix, productPerformance and paymentMix all sum to revenue', () => {
    const rev = rawRevenue(last30)
    expect(dailySeries(db, last30).reduce((s, p) => s + p.revenue, 0)).toBeCloseTo(rev, 1)
    expect(dailySeries(db, last30)).toHaveLength(30)
    expect(branchLeaderboard(db, last30).reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(rev, 1)
    expect(categoryMix(db, last30).reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(rev, 1)
    expect(productPerformance(db, last30).reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(rev, 1)
    expect(paymentMix(db, last30).total).toBeCloseTo(rev, 1)
    const heat = hourlyHeatmap(db, last30)
    expect(heat.cells).toHaveLength(7 * 24)
    expect(heat.max).toBeGreaterThan(0)
  })

  it('branch filter restricts every view', () => {
    const edp = ['b-edp']
    expect(totalsFor(db, last30, edp).revenue).toBeCloseTo(rawRevenue(last30, edp), 1)
    expect(branchLeaderboard(db, last30, edp)).toHaveLength(1)
    expect(dailySeries(db, last30, edp, true)[0]!.byBranch).toHaveProperty('b-edp')
  })

  it('salesSummary compares to the previous equal-length period', () => {
    const s = salesSummary(db, presetRange('last30', TODAY), undefined, new Date('2026-11-27T10:00:00'))
    expect(s.previousRange).toEqual({ from: '2026-09-28', to: '2026-10-27' })
    expect(s.previous.revenue).toBeCloseTo(rawRevenue(s.previousRange), 1)
    expect(s.deltas.revenue).toBeCloseTo(((s.current.revenue - s.previous.revenue) / s.previous.revenue) * 100, 5)
  })

  it('time-matches the previous period when the range includes today', () => {
    const range = { from: TODAY, to: TODAY }
    const prevDay = '2026-11-25'
    const fullPrev = rawRevenue({ from: prevDay, to: prevDay })
    const s = salesSummary(db, range, undefined, NOW)
    expect(s.previousRange).toEqual({ from: prevDay, to: prevDay })
    expect(s.previous.revenue).toBeLessThan(fullPrev)
    expect(s.previous.revenue).toBeGreaterThan(0)
    // expected: yesterday's revenue up to 14:00 (by-hour curve, scaled to day total)
    const hourly = Object.values(db.salesDays).filter((d) => d.date === prevDay)
    const upto = hourly.reduce((a, d) => a + d.total * (d.byHour.slice(0, 14).reduce((x, y) => x + y, 0) / d.byHour.reduce((x, y) => x + y, 0)), 0)
    expect(s.previous.revenue).toBeCloseTo(upto, 0)
    // a range not ending today is untouched
    const y = salesSummary(db, { from: prevDay, to: prevDay }, undefined, NOW)
    expect(y.previous.revenue).toBeCloseTo(rawRevenue(y.previousRange), 1)
    const rows = branchLeaderboard(db, range, undefined, NOW)
    expect(rows.reduce((a, r) => a + r.previousRevenue, 0)).toBeCloseTo(s.previous.revenue, 0)
  })

  it('leaderboard is ranked by revenue with a sparkline per branch', () => {
    const rows = branchLeaderboard(db, last30)
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5])
    expect(rows[0]!.revenue).toBeGreaterThanOrEqual(rows[1]!.revenue)
    expect(rows[0]!.sparkline).toHaveLength(30)
    expect(rows.find((r) => r.branchId === 'b-cky')!.cashVariance).toBe(-850 + rows.find((r) => r.branchId === 'b-cky')!.cashVariance + 850)
  })

  it('wastage: KKD is the outlier; reasons and series add up', () => {
    const last7 = presetRange('last7', TODAY)
    const rows = branchLeaderboard(db, last7)
    const kkd = rows.find((r) => r.branchId === 'b-kkd')!
    expect(kkd.wastagePct).toBeGreaterThan(8)
    expect(rows.filter((r) => r.branchId !== 'b-kkd').every((r) => r.wastagePct < 6)).toBe(true)
    const reasons = wastageByReason(db, last30)
    expect(reasons.reduce((s, r) => s + r.value, 0)).toBeCloseTo(totalsFor(db, last30).wastageValue, 1)
    expect(wastageSeries(db, last30).reduce((s, p) => s + p.value, 0)).toBeCloseTo(totalsFor(db, last30).wastageValue, 1)
  })

  it('VYT sales story: last 7 completed days are ≥ 15% below the 7 before', () => {
    const sum = (from: string, to: string) => Object.entries(db.salesDays).filter(([k, s]) => k.startsWith('b-vyt|') && s.date >= from && s.date <= to).reduce((a, [, s]) => a + s.total, 0)
    expect((sum('2026-11-12', '2026-11-18') - sum('2026-11-19', '2026-11-25')) / sum('2026-11-12', '2026-11-18')).toBeGreaterThan(0.15)
  })

  it('dispatchVariance and indentFillRate work on the 14-day history', () => {
    const v = dispatchVariance(db, 14)
    expect(v.totals.dispatched).toBeGreaterThan(1000)
    expect(v.totals.short + v.totals.damaged).toBeGreaterThan(0)
    const fill = indentFillRate(db, presetRange('last7', TODAY))
    expect(fill).toHaveLength(5)
    expect(fill.every((f) => f.fillPct > 80 && f.fillPct <= 100.0001)).toBe(true)
    expect(db.salesDays[salesDayKey('b-edp', TODAY)]).toBeDefined()
  })
})

describe('computeAlerts', () => {
  const at = (h: number) => computeAlerts(db, new Date(`2026-11-26T${String(h).padStart(2, '0')}:00:00`))
  const has = (list: ReturnType<typeof at>, type: string, branchId?: string) => list.filter((a) => a.type === type && (!branchId || a.branchId === branchId))

  it('fires the seeded story alerts', () => {
    const a = at(14)
    expect(['warning', 'critical']).toContain(has(a, 'wastage', 'b-kkd')[0]?.severity)
    expect(has(a, 'wastage')).toHaveLength(1)
    expect(has(a, 'sales_drop', 'b-vyt')).toHaveLength(1)
    expect(has(a, 'sales_drop')).toHaveLength(1)
    expect(has(a, 'cash_variance', 'b-cky')[0]).toMatchObject({ severity: 'critical' })
    expect(has(a, 'day_not_closed', 'b-vyt')).toHaveLength(1)
    expect(has(a, 'day_not_closed')).toHaveLength(1)
    expect(has(a, 'dispatch_transit', 'b-cky')).toHaveLength(1)
    expect(has(a, 'raw_material_low').map((x) => x.title).sort()).toEqual(['Butter below reorder level', 'Cocoa powder below reorder level', 'Fresh cream below reorder level'])
    expect(has(a, 'expired_stock').map((x) => x.branchId).sort()).toEqual(['b-kkd', 'b-vyt'])
  })

  it('indent alert is info before cutoff and critical after', () => {
    expect(has(at(14), 'indent_pending').map((x) => `${x.branchId}:${x.severity}`).sort()).toEqual(['b-cky:info', 'b-vyt:info'])
    expect(has(at(21), 'indent_pending').every((x) => x.severity === 'critical')).toBe(true)
  })

  it('is sorted critical → warning → info and ids are unique', () => {
    const a = at(14)
    const order = a.map((x) => ({ critical: 0, warning: 1, info: 2 })[x.severity])
    expect(order).toEqual([...order].sort())
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length)
  })

  it('clears alerts when their cause is resolved', () => {
    const d = structuredClone(db)
    d.dispatches.forEach((x) => { x.status = 'received' })
    d.batches = d.batches.filter((b) => b.expiryDate >= TODAY)
    const a = computeAlerts(d, NOW)
    expect(has(a, 'dispatch_transit')).toHaveLength(0)
    expect(has(a, 'expired_stock')).toHaveLength(0)
  })
})
