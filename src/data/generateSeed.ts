/**
 * Deterministic demo-data generator (§7). Everything is relative to `now` (anchorDate = today).
 * History is aggregates only; today's bills / batches / wastage / dispatches go through the same ops
 * as the live actions (FIFO, salesDays aggregation).
 */
import { addDaysISO, atTime, diffDays, isoRange, todayISO, weekdayOf } from '@/lib/dates'
import { round2 } from '@/lib/format'
import { mulberry32, noise, pick, randInt, type Rng } from '@/lib/prng'
import {
  addBatch, addWastageEntry, completeProductionOp, createBillOp, createDispatchesOp, createPOOp, nextNumber,
  receiveDispatchOp, receiveGRNOp, recordWastageOp, saveIndentOp, sendPOOp, submitIndentOp, type OpCtx,
} from '@/store/ops'
import { effectivePrice, gstOf, proposeAllocation, salesDayKey, suggestIndent, unitCost } from '@/store/selectors'
import type {
  DbState, Dispatch, DispatchLine, Expense, ExpenseCategory, ISODate, Indent, Product, SalesDay, WastageReason,
} from '@/types/domain'
import { EXPENSE_CATEGORIES } from '@/types/domain'
import {
  BRANCH_SEEDS, BRANCHES, DEFAULT_SETTINGS, DEMAND_WEIGHT, PRODUCTS, RAW_MATERIALS, RECIPES, SUPPLIERS, USERS, type BranchSeed,
} from './catalog'

export const SEED = 20261126
export const HISTORY_DAYS = 90
export const OPS_HISTORY_DAYS = 14

/** relative revenue by hour of day (open 7 am – 10 pm). Bread peak 7–9, snack peak 4–7 pm. */
export const HOUR_WEIGHTS: number[] = [0, 0, 0, 0, 0, 0, 0, 6, 9, 8, 5, 4, 5, 5, 4, 5, 8, 11, 12, 10, 6, 3, 0, 0]

const ABV: Record<string, number> = { EDP: 240, KKD: 230, VYT: 190, TSR: 250, CKY: 175 }

const FESTIVALS: { date: ISODate; mult: number; cats: string[] }[] = [
  { date: '2026-08-25', mult: 1.2, cats: ['Sweets', 'Cakes'] },
  { date: '2026-08-26', mult: 1.45, cats: ['Sweets', 'Cakes'] },
  { date: '2026-08-27', mult: 1.25, cats: ['Sweets'] },
  { date: '2026-11-07', mult: 1.2, cats: ['Sweets'] },
  { date: '2026-11-08', mult: 1.4, cats: ['Sweets', 'Cakes'] },
]

function dayFactor(b: BranchSeed, date: ISODate, daysAgo: number, rng: Rng): number {
  const wd = weekdayOf(date)
  const weekend = wd === 0 || wd === 6
  let f = 1
  if (weekend) f *= b.code === 'TSR' ? 1.38 : 1.2
  else if (wd === 1) f *= 0.92
  else if (wd === 5 && b.code === 'TSR') f *= 1.05
  const t = 1 - Math.min(daysAgo, HISTORY_DAYS) / HISTORY_DAYS // 0 (old) → 1 (today)
  f *= b.code === 'EDP' ? 0.92 + 0.13 * t : b.code === 'VYT' ? 1 : 0.97 + 0.05 * t
  const fest = FESTIVALS.find((x) => x.date === date)
  if (fest) f *= fest.mult
  if (b.code === 'VYT' && daysAgo <= 7) f *= 0.81 // story: sales down ~18%
  return f * noise(rng, 0.05)
}

function catFactor(b: BranchSeed, category: string, weekend: boolean, date: ISODate): number {
  let f = 1
  if (weekend && (category === 'Cakes' || category === 'Pastries' || category === 'Sweets')) f *= 1.3
  if (!weekend && category === 'Puffs & Snacks') f *= 1.05
  if (b.code === 'KKD' && (category === 'Puffs & Snacks' || category === 'Pastries')) f *= 1.2
  if ((b.code === 'TSR' || b.code === 'CKY') && (category === 'Sweets' || category === 'Chips & Savouries')) f *= 1.25
  if (b.code === 'EDP' && category === 'Cakes') f *= 1.15
  const fest = FESTIVALS.find((x) => x.date === date)
  if (fest?.cats.includes(category)) f *= 1.4
  return f
}

/** Synthesise one branch-day's aggregates for a given revenue target. */
function synthSalesDay(db: DbState, rng: Rng, b: BranchSeed, date: ISODate, revenue: number): SalesDay {
  const wd = weekdayOf(date)
  const weekend = wd === 0 || wd === 6
  const weights = db.products.map(
    (p) => (DEMAND_WEIGHT[p.id] ?? 1) * effectivePrice(db, b.id, p.id) * catFactor(b, p.category, weekend, date) * noise(rng, 0.12),
  )
  const sum = weights.reduce((s, w) => s + w, 0)
  const byProduct: SalesDay['byProduct'] = {}
  let total = 0
  let gst = 0
  db.products.forEach((p, i) => {
    const price = effectivePrice(db, b.id, p.id)
    const qty = Math.round(((weights[i] ?? 0) / sum) * revenue / price)
    if (qty <= 0) return
    const amount = qty * price
    byProduct[p.id] = [qty, amount]
    total += amount
    gst += gstOf(amount, p.gstRate)
  })
  const abv = (ABV[b.code] ?? 200) * noise(rng, 0.06)
  const hw = HOUR_WEIGHTS.map((w) => (w > 0 ? w * noise(rng, 0.1) * (weekend ? (w > 8 ? 0.9 : 1.1) : 1) : 0))
  const hsum = hw.reduce((s, w) => s + w, 0)
  const byHour = hw.map((w) => Math.floor((w / hsum) * total))
  byHour[18] = (byHour[18] ?? 0) + (total - byHour.reduce((s, v) => s + v, 0))
  const upi = Math.round(total * (0.55 + (rng() - 0.5) * 0.06))
  const card = Math.round(total * (0.1 + (rng() - 0.5) * 0.03))
  return {
    branchId: b.id, date, bills: Math.max(1, Math.round(total / abv)), total, gst: round2(gst), byProduct, byHour,
    byPayment: { cash: total - upi - card, upi, card },
  }
}

function weighted<T>(rng: Rng, items: T[], weights: number[]): T {
  const sum = weights.reduce((s, w) => s + w, 0)
  let r = rng() * sum
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] ?? 0
    if (r <= 0) return items[i] as T
  }
  return items[items.length - 1] as T
}

const WASTE_REASONS: [WastageReason, number][] = [['Expired', 0.55], ['Damaged', 0.2], ['Quality issue', 0.15], ['Other', 0.1]]

export function generateSeed(now: Date = new Date()): DbState {
  const rng = mulberry32(SEED)
  const today = todayISO(now)
  let n = 0
  const uid = () => `s${(++n).toString(36)}`
  const ctxAt = (d: Date): OpCtx => ({ now: d > now ? now : d, uid })
  const at = (date: ISODate, hhmm: string): Date => atTime(date, hhmm)
  const ctxNow = ctxAt(now)

  const db: DbState = {
    version: 1,
    seededAt: now.toISOString(),
    anchorDate: today,
    settings: { ...DEFAULT_SETTINGS },
    branches: structuredClone(BRANCHES),
    users: structuredClone(USERS),
    products: structuredClone(PRODUCTS),
    priceOverrides: [
      { branchId: 'b-edp', productId: 'p-black-forest', price: 540 },
      { branchId: 'b-edp', productId: 'p-red-velvet', price: 640 },
      { branchId: 'b-tsr', productId: 'p-plum-cake', price: 290 },
      { branchId: 'b-cky', productId: 'p-egg-puff', price: 17 },
      { branchId: 'b-cky', productId: 'p-veg-puff', price: 14 },
      { branchId: 'b-kkd', productId: 'p-chicken-puff', price: 26 },
    ],
    rawMaterials: structuredClone(RAW_MATERIALS),
    suppliers: structuredClone(SUPPLIERS),
    recipes: structuredClone(RECIPES),
    batches: [], bills: [], salesDays: {}, wastage: [], indents: [], productionPlans: [], dispatches: [],
    purchaseOrders: [], grns: [], rmMovements: [], expenses: [], dayCloses: [],
    counters: { indent: 0, plan: 0, dispatch: 0, po: 0, grn: 0 },
  }
  const perishable = db.products.filter((p) => p.shelfLifeDays <= 3)
  const userOfBranch = (branchId: string) => db.users.find((u) => u.branchId === branchId)!.id

  // ------------------------------------------------ 1. 90 days of aggregates
  const histDays = isoRange(addDaysISO(today, -HISTORY_DAYS), addDaysISO(today, -1))
  for (const b of BRANCH_SEEDS) {
    for (const date of histDays) {
      const daysAgo = diffDays(date, today)
      const revenue = b.avgDaily * dayFactor(b, date, daysAgo, rng)
      const sd = synthSalesDay(db, rng, b, date, revenue)
      db.salesDays[salesDayKey(b.id, date)] = sd

      // wastage: baseline 2–4.5 %, KKD ramps up over the last 14 days
      let ratio = 0.025 + rng() * 0.02
      if (b.code === 'KKD') ratio = daysAgo <= 14 ? 0.04 + 0.07 * ((14 - daysAgo) / 13) * (0.95 + rng() * 0.1) : 0.035 + rng() * 0.015
      const wasteValue = (ratio * sd.total) / (1 - ratio)
      const picks = [pick(rng, perishable), pick(rng, perishable)]
      for (const p of picks) {
        const price = effectivePrice(db, b.id, p.id)
        const qty = Math.max(1, Math.round(wasteValue / picks.length / price))
        db.wastage.push({
          id: uid(), branchId: b.id, date, createdAt: at(date, '21:30').toISOString(), productId: p.id, qty,
          valueAtMRP: qty * price, valueAtCost: round2(qty * unitCost(db, p.id)),
          reason: weighted(rng, WASTE_REASONS.map((r) => r[0]), WASTE_REASONS.map((r) => r[1])),
          userId: userOfBranch(b.id),
        })
      }

      // petty expenses 0–2
      let cashExpenses = 0
      for (let k = randInt(rng, 0, 2); k > 0; k--) {
        const e: Expense = {
          id: uid(), branchId: b.id, date, createdAt: at(date, '15:00').toISOString(),
          category: pick(rng, EXPENSE_CATEGORIES) as ExpenseCategory, amount: randInt(rng, 5, 80) * 10,
        }
        db.expenses.push(e)
        cashExpenses += e.amount
      }

      // day close (VYT missed yesterday's)
      if (b.code === 'VYT' && daysAgo === 1) continue
      const expected = b.openingFloat + sd.byPayment.cash - cashExpenses
      let variance = rng() < 0.7 ? 0 : pick(rng, [-20, -10, 10, 20, 50, -50])
      if (b.code === 'CKY' && daysAgo === 2) variance = -850
      db.dayCloses.push({
        id: uid(), branchId: b.id, date, openingFloat: b.openingFloat, cashSales: sd.byPayment.cash, upiSales: sd.byPayment.upi,
        cardSales: sd.byPayment.card, cashExpenses, expectedCash: expected, countedCash: expected + variance, variance,
        notes: variance === -850 ? 'Cash short — to be reviewed with cashier' : undefined,
        closedBy: userOfBranch(b.id), closedAt: at(date, '22:30').toISOString(),
      })
    }
  }

  // ------------------------------- 2. today's expected full-day mix per branch
  const todayRevenue: Record<string, number> = {}
  const dayMix: Record<string, Record<string, number>> = {}
  for (const b of BRANCH_SEEDS) {
    const rev = b.avgDaily * dayFactor(b, today, 0, rng)
    todayRevenue[b.id] = rev
    const sd = synthSalesDay(db, rng, b, today, rev)
    dayMix[b.id] = Object.fromEntries(Object.entries(sd.byProduct).map(([id, v]) => [id, v[0]]))
  }

  // ------------------------------- 3. last 14 days: indents → plans → dispatches
  const opsDays = isoRange(addDaysISO(today, -OPS_HISTORY_DAYS), today)
  const productIndex = new Map(db.products.map((p, i) => [p.id, i]))
  const indentQtyFor = (branchId: string, date: ISODate, dayIdx: number): { productId: string; qty: number }[] => {
    const sold = date === today ? dayMix[branchId]! : Object.fromEntries(Object.entries(db.salesDays[salesDayKey(branchId, date)]!.byProduct).map(([id, v]) => [id, v[0]]))
    const out: { productId: string; qty: number }[] = []
    for (const p of db.products) {
      const q = sold[p.id] ?? 0
      if (q <= 0) continue
      if (p.shelfLifeDays >= 7) {
        if (date === today) { out.push({ productId: p.id, qty: Math.ceil(q * 2) }); continue }
        if ((dayIdx + (productIndex.get(p.id) ?? 0)) % 4 !== 0) continue
        out.push({ productId: p.id, qty: Math.ceil(q * 4 * 1.05) })
      } else out.push({ productId: p.id, qty: Math.ceil(q * 1.05) })
    }
    return out
  }

  // reorder levels need consumption: first pass builds indents + plans (no stock effects yet)
  const planByDate = new Map<ISODate, string>()
  for (const [dayIdx, date] of opsDays.entries()) {
    const isToday = date === today
    const prev = addDaysISO(date, -1)
    const inds: Indent[] = []
    for (const b of BRANCH_SEEDS) {
      const late = !isToday && rng() < 0.05
      const submittedAt = at(prev, late ? '20:40' : `${randInt(rng, 17, 19)}:${String(randInt(rng, 0, 59)).padStart(2, '0')}`)
      const lines = indentQtyFor(b.id, date, dayIdx).map(({ productId, qty }) => ({
        productId, qty, suggestedQty: Math.max(0, qty + randInt(rng, -3, 3)),
      }))
      const ind: Indent = {
        id: uid(), number: nextNumber(db, 'indent', 'IND'), branchId: b.id, deliveryDate: date, status: 'in_production', lines,
        createdAt: at(prev, '16:30').toISOString(), submittedAt: submittedAt.toISOString(), submittedBy: userOfBranch(b.id), late: late || undefined,
      }
      db.indents.push(ind)
      inds.push(ind)
    }
    const sums = new Map<string, number>()
    for (const i of inds) for (const l of i.lines) sums.set(l.productId, (sums.get(l.productId) ?? 0) + l.qty)
    const planId = uid()
    db.productionPlans.push({
      id: planId, number: nextNumber(db, 'plan', 'PP'), date, status: 'confirmed',
      lines: [...sums.entries()].sort((a, b) => (productIndex.get(a[0]) ?? 0) - (productIndex.get(b[0]) ?? 0)).map(([productId, q]) => ({ productId, indentQty: q, plannedQty: q })),
      createdAt: at(prev, '20:30').toISOString(), confirmedAt: at(prev, '21:00').toISOString(),
    })
    planByDate.set(date, planId)
  }

  // raw-material consumption → reorder levels
  const consumption = new Map<string, number>()
  for (const plan of db.productionPlans) {
    for (const r of db.recipes) {
      const line = plan.lines.find((l) => l.productId === r.productId)
      if (!line) continue
      for (const ing of r.ingredients) {
        consumption.set(ing.rawMaterialId, (consumption.get(ing.rawMaterialId) ?? 0) + (line.plannedQty / r.yieldQty) * ing.qty)
      }
    }
  }
  const nice = (x: number) => (x >= 100 ? Math.ceil(x / 10) * 10 : x >= 10 ? Math.ceil(x / 5) * 5 : Math.ceil(x))
  for (const m of db.rawMaterials) {
    const daily = (consumption.get(m.id) ?? 1) / opsDays.length
    m.reorderLevel = nice(daily * 2.5)
    m.reorderQty = nice(daily * 7)
  }

  // second pass: complete plans (RM deduction via real op), dispatch, receive
  for (const date of opsDays) {
    const isToday = date === today
    const plan = db.productionPlans.find((p) => p.id === planByDate.get(date))!
    const produced: Record<string, number> = {}
    for (const l of plan.lines) produced[l.productId] = rng() < 0.04 ? Math.ceil(l.plannedQty * 0.85) : l.plannedQty
    completeProductionOp(db, plan.id, produced, { force: true }, ctxAt(at(date, '03:00')))
    const alloc = proposeAllocation(db, plan.id)
    const vehicleOf = (i: number) => `KL-07-CD-${4100 + i * 11}`

    if (!isToday) {
      for (const [bi, b] of BRANCH_SEEDS.entries()) {
        const lines: DispatchLine[] = alloc.filter((a) => a.branchId === b.id && a.allocatedQty > 0).map((a) => ({ productId: a.productId, qtyDispatched: a.allocatedQty }))
        const withVariance = rng() < 0.15
        const bad = new Set<number>()
        if (withVariance) for (let k = randInt(rng, 1, 2); k > 0; k--) bad.add(randInt(rng, 0, lines.length - 1))
        lines.forEach((l, li) => {
          let short = 0, dmg = 0
          if (bad.has(li)) { short = randInt(rng, 0, 3); dmg = randInt(rng, 0, 2); if (short + dmg === 0) short = 1 }
          short = Math.min(short, l.qtyDispatched); dmg = Math.min(dmg, l.qtyDispatched - short)
          l.qtyReceived = l.qtyDispatched - short - dmg
          l.qtyDamaged = dmg
          if (dmg > 0) {
            addWastageEntry(db, ctxAt(at(date, '07:10')), { branchId: b.id, productId: l.productId, qty: dmg, reason: 'Transit damage', userId: userOfBranch(b.id) })
          }
        })
        const ind = db.indents.find((i) => i.deliveryDate === date && i.branchId === b.id)!
        ind.status = 'received'
        const d: Dispatch = {
          id: uid(), number: nextNumber(db, 'dispatch', 'DN'), branchId: b.id, date, planId: plan.id, indentId: ind.id,
          status: 'received', vehicle: vehicleOf(bi), dispatchedAt: at(date, '05:30').toISOString(), lines,
          receivedAt: at(date, '07:00').toISOString(), receivedBy: userOfBranch(b.id),
        }
        db.dispatches.push(d)
      }
      plan.completedAt = at(date, '03:00').toISOString()
    }
  }

  // ------------------------------------------- 4. today: leftovers, dispatch
  const leftoverBranches = BRANCH_SEEDS
  for (const b of leftoverBranches) {
    for (const p of db.products) {
      if (p.shelfLifeDays >= 7) {
        // long-life items: carry several days of demand, from two batches of different ages
        const daily = dayMix[b.id]?.[p.id] ?? 0
        const total = Math.max(8, Math.ceil(daily * (3 + rng() * 3)))
        const older = Math.round(total * (0.3 + rng() * 0.3))
        addBatch(db, ctxNow, { branchId: b.id, productId: p.id, mfgDate: addDaysISO(today, -randInt(rng, 3, 4)), qty: older })
        addBatch(db, ctxNow, { branchId: b.id, productId: p.id, mfgDate: addDaysISO(today, -randInt(rng, 1, 2)), qty: total - older })
      } else if (p.shelfLifeDays === 3 && rng() < 0.45) {
        addBatch(db, ctxNow, { branchId: b.id, productId: p.id, mfgDate: addDaysISO(today, -1), qty: randInt(rng, 2, 8) })
      }
    }
  }
  // expired stock at KKD and VYT (for the "write off expired" demo)
  for (const code of ['KKD', 'VYT']) {
    const b = BRANCH_SEEDS.find((x) => x.code === code)!
    const candidates = db.products.filter((p) => p.shelfLifeDays <= 3)
    const chosen = new Set<string>()
    while (chosen.size < 4) chosen.add(pick(rng, candidates).id)
    for (const id of chosen) {
      const p = db.products.find((x) => x.id === id) as Product
      addBatch(db, ctxNow, { branchId: b.id, productId: id, mfgDate: addDaysISO(today, -(p.shelfLifeDays + randInt(rng, 1, 2))), qty: randInt(rng, 3, 9) })
    }
  }

  const todayPlan = db.productionPlans.find((p) => p.id === planByDate.get(today))!
  todayPlan.completedAt = ctxAt(at(today, '03:00')).now.toISOString()
  const todayAlloc = proposeAllocation(db, todayPlan.id)
  const dispatchTime = new Date(Math.min(at(today, '05:30').getTime(), now.getTime() - 3_600_000))
  const normal = todayAlloc.filter((a) => a.branchId !== 'b-cky')
  const ckyOnly = todayAlloc.filter((a) => a.branchId === 'b-cky')
  const ids = createDispatchesOp(db, todayPlan.id, normal, 'KL-07-CD-4100', ctxAt(dispatchTime))
  createDispatchesOp(db, todayPlan.id, ckyOnly, 'KL-08-AB-7788', { now: new Date(now.getTime() - 5.5 * 3_600_000), uid })
  const recvTime = new Date(Math.min(dispatchTime.getTime() + 90 * 60_000, now.getTime()))
  for (const id of ids) {
    const d = db.dispatches.find((x) => x.id === id)!
    const lines = d.lines.map((l, i) => {
      const bad = d.branchId === 'b-tsr' && i === 3
      return { productId: l.productId, qtyDispatched: l.qtyDispatched, qtyReceived: bad ? Math.max(0, l.qtyDispatched - 2) : l.qtyDispatched, qtyDamaged: 0 }
    })
    receiveDispatchOp(db, id, lines, userOfBranch(d.branchId), ctxAt(recvTime))
  }

  // ------------------------------------------------- 5. today's bills (real ops)
  if (now.getHours() >= 7) {
    const wsum = HOUR_WEIGHTS.reduce((s, w) => s + w, 0)
    for (const b of BRANCH_SEEDS) {
      const remaining = { ...dayMix[b.id]! }
      const cashier = userOfBranch(b.id)
      for (let h = 7; h <= now.getHours(); h++) {
        const elapsed = h === now.getHours() ? Math.max(0.05, now.getMinutes() / 60) : 1
        const target = (todayRevenue[b.id]! * (HOUR_WEIGHTS[h] ?? 0)) / wsum * elapsed
        const maxMinute = h === now.getHours() ? now.getMinutes() : 59
        let acc = 0
        let guard = 0
        while (acc < target && guard++ < 400) {
          const minute = Math.min(maxMinute, Math.floor((acc / target) * (maxMinute + 1)))
          const ts = new Date(now); ts.setHours(h, minute, randInt(rng, 0, 59), 0)
          if (ts > now) ts.setTime(now.getTime())
          const stockIds = db.products.filter((p) => (remaining[p.id] ?? 0) > 0)
          if (!stockIds.length) break
          const k = 1 + (rng() < 0.3 ? 0 : rng() < 0.5 ? 1 : rng() < 0.7 ? 2 : rng() < 0.85 ? 3 : 4)
          const cart = new Map<string, number>()
          for (let i = 0; i < k; i++) {
            const p = weighted(rng, stockIds, stockIds.map((x) => remaining[x.id] ?? 0))
            const price = effectivePrice(db, b.id, p.id)
            const maxQ = price <= 30 ? 4 : price <= 120 ? 2 : 1
            cart.set(p.id, Math.min(maxQ, 1 + (rng() < 0.55 ? 0 : randInt(rng, 0, maxQ - 1))))
          }
          const lines = [...cart.entries()].map(([productId, qty]) => ({ productId, qty }))
          const mode = weighted(rng, ['upi', 'cash', 'card'] as const, [0.55, 0.35, 0.1])
          const total = lines.reduce((s, l) => s + l.qty * effectivePrice(db, b.id, l.productId), 0)
          const step = pick(rng, [50, 100, 500])
          try {
            const bill = createBillOp(db, {
              branchId: b.id, cashierId: cashier, lines, paymentMode: mode,
              tendered: mode === 'cash' ? Math.ceil(total / step) * step : undefined,
            }, { now: ts, uid })
            acc += bill.total
            for (const l of bill.lines) remaining[l.productId] = Math.max(0, (remaining[l.productId] ?? 0) - l.qty)
          } catch {
            for (const l of lines) remaining[l.productId] = 0 // out of stock → stop picking it
          }
        }
      }
    }
    // a couple of live wastage records for today
    for (const [branchId, slug, reason] of [['b-edp', 'p-cutlet', 'Damaged'], ['b-tsr', 'p-pastry-pineapple', 'Quality issue']] as const) {
      try {
        recordWastageOp(db, { branchId, productId: slug, qty: 2, reason, userId: userOfBranch(branchId), note: 'Dropped during display setup' }, ctxNow)
      } catch { /* not enough stock early in the day — fine */ }
    }
  }

  // ----------------------------------------------------- 6. purchase orders
  const sups = db.suppliers
  const rmOf = (id: string) => db.rawMaterials.find((m) => m.id === id)!
  for (let k = 0; k < 20; k++) {
    const s = sups[k % sups.length]!
    const poDate = addDaysISO(today, -(4 + k * 4))
    const mats = s.materialIds.slice().sort(() => rng() - 0.5).slice(0, randInt(rng, 2, 4))
    const poCtx = ctxAt(at(poDate, '10:00'))
    const poId = createPOOp(db, {
      supplierId: s.id, expectedDate: addDaysISO(poDate, 2),
      lines: mats.map((id) => ({ rawMaterialId: id, qty: Math.max(1, Math.round(rmOf(id).reorderQty * (0.7 + rng() * 0.6))), rate: round2(rmOf(id).costPerUnit * (0.97 + rng() * 0.06)) })),
    }, poCtx)
    sendPOOp(db, poId)
    const po = db.purchaseOrders.find((p) => p.id === poId)!
    receiveGRNOp(db, poId, po.lines.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: l.qty })), ctxAt(at(addDaysISO(poDate, 2), '12:00')))
  }
  // partially received flour PO
  {
    const poCtx = ctxAt(at(addDaysISO(today, -3), '10:00'))
    const poId = createPOOp(db, {
      supplierId: 's-malabar', expectedDate: addDaysISO(today, -1),
      lines: [{ rawMaterialId: 'rm-maida', qty: 600, rate: 42 }, { rawMaterialId: 'rm-wheat', qty: 300, rate: 46 }],
    }, poCtx)
    sendPOOp(db, poId)
    receiveGRNOp(db, poId, [{ rawMaterialId: 'rm-maida', qty: 350 }], ctxAt(at(addDaysISO(today, -1), '11:00')))
  }
  // sent PO: butter + cream, expected tomorrow
  {
    const poId = createPOOp(db, {
      supplierId: 's-milma', expectedDate: addDaysISO(today, 1),
      lines: [{ rawMaterialId: 'rm-butter', qty: rmOf('rm-butter').reorderQty, rate: 520 }, { rawMaterialId: 'rm-cream', qty: rmOf('rm-cream').reorderQty, rate: 280 }],
      note: 'Urgent — below reorder level',
    }, ctxAt(at(today, '09:00')))
    sendPOOp(db, poId)
  }

  // final raw-material stock: healthy except butter, cream, cocoa (below reorder)
  const low: Record<string, number> = { 'rm-butter': 0.03, 'rm-cream': 0.04, 'rm-cocoa': 0.05 }
  for (const m of db.rawMaterials) {
    const target = low[m.id] !== undefined ? Math.round(m.reorderLevel * low[m.id]! * 10) / 10 : Math.round(m.reorderLevel * (1.4 + rng() * 1.2) * 10) / 10
    const delta = Math.round((target - m.stockQty) * 1000) / 1000
    db.rmMovements.push({
      id: uid(), rawMaterialId: m.id, date: addDaysISO(today, -OPS_HISTORY_DAYS - 1), createdAt: at(addDaysISO(today, -OPS_HISTORY_DAYS - 1), '09:00').toISOString(),
      type: 'adjustment', qty: delta, note: 'Opening balance / stock count',
    })
    m.stockQty = target
  }

  // ------------------------------------------- 7. tomorrow's indents
  const tomorrow = addDaysISO(today, 1)
  const submitCtx = ctxAt(new Date(Math.min(now.getTime(), at(today, '17:30').getTime())))
  for (const code of ['EDP', 'KKD', 'TSR', 'VYT']) {
    const b = BRANCH_SEEDS.find((x) => x.code === code)!
    const sug = suggestIndent(db, b.id, tomorrow)
    const lines = sug.filter((s) => s.suggested > 0).map((s) => ({
      productId: s.productId, suggestedQty: s.suggested, qty: code === 'VYT' ? Math.max(0, Math.round(s.suggested * 0.9)) : s.suggested,
    }))
    const id = saveIndentOp(db, { branchId: b.id, deliveryDate: tomorrow, lines }, submitCtx)
    if (code !== 'VYT') {
      submitIndentOp(db, id, userOfBranch(b.id), submitCtx)
      const ind = db.indents.find((i) => i.id === id)!
      ind.late = false
    }
  }

  return db
}
