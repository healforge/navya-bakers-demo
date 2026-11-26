import { describe, expect, it } from 'vitest'
import type { DbState } from '@/types/domain'
import * as ops from './ops'
import {
  getBranchStock, getDayCloseSummary, getMaterialRequirement, getReorderSuggestions, gstAmount, proposeAllocation,
  salesDayKey, suggestIndent,
} from './selectors'
import { freshDb, NOW, TODAY, testCtx } from './testUtils'

const EDP = 'b-edp'
const PUFF = 'p-egg-puff'

/** db with all EDP stock for `productId` replaced by the given batches. */
function withBatches(db: DbState, productId: string, batches: { exp: string; qty: number; mfg?: string }[]): void {
  db.batches = db.batches.filter((b) => !(b.branchId === EDP && b.productId === productId))
  batches.forEach((b, i) => db.batches.push({
    id: `bt${i}`, branchId: EDP, productId, mfgDate: b.mfg ?? '2026-11-20', expiryDate: b.exp, qtyReceived: b.qty, qtyRemaining: b.qty,
  }))
}

describe('gstAmount', () => {
  it('back-calculates GST from tax-inclusive amounts', () => {
    expect(gstAmount([{ amount: 105, gstRate: 5 }, { amount: 112, gstRate: 12 }, { amount: 50, gstRate: 0 }])).toBe(17)
    expect(gstAmount([{ amount: 18, gstRate: 5 }])).toBe(0.86)
  })
})

describe('createBill', () => {
  it('deducts FIFO by expiry, skips expired batches, and aggregates salesDays', () => {
    const db = freshDb()
    withBatches(db, PUFF, [
      { exp: '2026-11-25', qty: 7 }, // expired
      { exp: '2026-11-28', qty: 10 },
      { exp: '2026-11-26', qty: 3 }, // oldest sellable (expires today)
    ])
    const before = structuredClone(db.salesDays[salesDayKey(EDP, TODAY)]!)
    const bill = ops.createBillOp(db, { branchId: EDP, cashierId: 'u-edp', lines: [{ productId: PUFF, qty: 5 }], paymentMode: 'cash', tendered: 100 }, testCtx())
    const rem = Object.fromEntries(db.batches.filter((b) => b.productId === PUFF && b.branchId === EDP).map((b) => [b.expiryDate, b.qtyRemaining]))
    expect(rem).toEqual({ '2026-11-25': 7, '2026-11-26': 0, '2026-11-28': 8 })
    expect(bill.total).toBe(90)
    expect(bill.change).toBe(10)
    expect(bill.gstAmount).toBe(4.29)
    expect(bill.number).toMatch(/^EDP-261126-\d{4}$/)
    expect(bill.number.endsWith(String(before.bills + 1).padStart(4, '0'))).toBe(true)

    const after = db.salesDays[salesDayKey(EDP, TODAY)]!
    expect(after.bills).toBe(before.bills + 1)
    expect(after.total).toBeCloseTo(before.total + 90, 2)
    expect(after.gst).toBeCloseTo(before.gst + 4.29, 2)
    expect(after.byProduct[PUFF]![0]).toBe((before.byProduct[PUFF]?.[0] ?? 0) + 5)
    expect(after.byHour[14]).toBeCloseTo(before.byHour[14]! + 90, 2)
    expect(after.byPayment.cash).toBeCloseTo(before.byPayment.cash + 90, 2)
    expect(db.bills.at(-1)).toBe(bill)
  })

  it('rejects qty above non-expired stock, empty carts, short tender', () => {
    const db = freshDb()
    withBatches(db, PUFF, [{ exp: '2026-11-25', qty: 50 }, { exp: '2026-11-27', qty: 4 }])
    const bill = (qty: number) => ops.createBillOp(db, { branchId: EDP, cashierId: 'u', lines: [{ productId: PUFF, qty }], paymentMode: 'upi' }, testCtx())
    expect(() => bill(5)).toThrow(/Only 4/)
    expect(() => ops.createBillOp(db, { branchId: EDP, cashierId: 'u', lines: [], paymentMode: 'upi' }, testCtx())).toThrow(/empty/)
    expect(() => ops.createBillOp(db, { branchId: EDP, cashierId: 'u', lines: [{ productId: PUFF, qty: 1 }], paymentMode: 'cash', tendered: 5 }, testCtx())).toThrow(/Tendered/)
    expect(db.batches.find((b) => b.id === 'bt1')!.qtyRemaining).toBe(4) // untouched
  })

  it('uses branch price overrides', () => {
    const db = freshDb()
    withBatches(db, 'p-black-forest', [{ exp: '2026-11-28', qty: 5 }])
    const b = ops.createBillOp(db, { branchId: EDP, cashierId: 'u', lines: [{ productId: 'p-black-forest', qty: 1 }], paymentMode: 'upi' }, testCtx())
    expect(b.lines[0]!.price).toBe(540)
  })

  it('is locked after closeDay and unlocked by reopenDay', () => {
    const db = freshDb()
    withBatches(db, PUFF, [{ exp: '2026-11-28', qty: 20 }])
    const input = { branchId: EDP, cashierId: 'u', lines: [{ productId: PUFF, qty: 1 }], paymentMode: 'upi' as const }
    ops.closeDayOp(db, { branchId: EDP, date: TODAY, countedCash: 6000, userId: 'u-edp' }, testCtx())
    expect(() => ops.createBillOp(db, input, testCtx())).toThrow(/closed/)
    expect(() => ops.addExpenseOp(db, { branchId: EDP, category: 'Misc', amount: 50 }, testCtx())).toThrow(/closed/)
    expect(() => ops.closeDayOp(db, { branchId: EDP, date: TODAY, countedCash: 1, userId: 'u' }, testCtx())).toThrow(/already closed/)
    ops.reopenDayOp(db, EDP, TODAY)
    expect(() => ops.createBillOp(db, input, testCtx())).not.toThrow()
  })
})

describe('closeDay', () => {
  it('computes expected cash and variance from the day summary', () => {
    const db = freshDb()
    ops.addExpenseOp(db, { branchId: EDP, category: 'Cleaning', amount: 120 }, testCtx())
    const s = getDayCloseSummary(db, EDP, TODAY)
    expect(s.cashExpenses).toBeGreaterThanOrEqual(120)
    const dc = ops.closeDayOp(db, { branchId: EDP, date: TODAY, countedCash: s.expectedCash - 30, userId: 'u-edp' }, testCtx())
    expect(dc.expectedCash).toBe(s.openingFloat + s.cashSales - s.cashExpenses)
    expect(dc.variance).toBe(-30)
    expect(getDayCloseSummary(db, EDP, TODAY).closed?.id).toBe(dc.id)
  })
})

describe('stock & wastage', () => {
  it('getBranchStock separates on-hand, expiring and expired', () => {
    const db = freshDb()
    withBatches(db, PUFF, [{ exp: '2026-11-25', qty: 2 }, { exp: '2026-11-26', qty: 3 }, { exp: '2026-11-27', qty: 4 }, { exp: '2026-11-30', qty: 5 }])
    const s = getBranchStock(db, EDP, TODAY).find((x) => x.productId === PUFF)!
    expect(s.expiredQty).toBe(2)
    expect(s.onHand).toBe(12)
    expect(s.expiringQty).toBe(7) // today + tomorrow (nearExpiryDays = 1)
    expect(s.batches.map((b) => b.expiryDate)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30'])
  })

  it('recordWastage deducts expired-first FIFO and values at MRP and cost', () => {
    const db = freshDb()
    withBatches(db, PUFF, [{ exp: '2026-11-25', qty: 2 }, { exp: '2026-11-27', qty: 5 }])
    const entries = ops.recordWastageOp(db, { branchId: EDP, productId: PUFF, qty: 4, reason: 'Damaged', userId: 'u' }, testCtx())
    expect(entries.map((e) => e.qty)).toEqual([2, 2])
    expect(entries.reduce((s, e) => s + e.valueAtMRP, 0)).toBe(72)
    expect(entries[0]!.valueAtCost).toBeGreaterThan(0)
    expect(db.batches.filter((b) => b.productId === PUFF && b.branchId === EDP).map((b) => b.qtyRemaining)).toEqual([0, 3])
    expect(() => ops.recordWastageOp(db, { branchId: EDP, productId: PUFF, qty: 9, reason: 'Other' }, testCtx())).toThrow(/Only 3/)
  })

  it('writeOffExpired writes one Expired entry per expired batch', () => {
    const db = freshDb()
    const expired = db.batches.filter((b) => b.branchId === 'b-kkd' && b.qtyRemaining > 0 && b.expiryDate < TODAY)
    expect(expired.length).toBeGreaterThan(0)
    const entries = ops.writeOffExpiredOp(db, 'b-kkd', 'u-kkd', testCtx())
    expect(entries).toHaveLength(expired.length)
    expect(entries.every((e) => e.reason === 'Expired')).toBe(true)
    expect(() => ops.writeOffExpiredOp(db, 'b-kkd', 'u-kkd', testCtx())).toThrow(/No expired/)
  })
})

describe('suggestIndent', () => {
  it('= ceil(avg same-weekday qty over 4 weeks × 1.05 − stock sellable on delivery day), min 0', () => {
    const db = freshDb()
    const delivery = '2026-11-28' // Saturday; same weekdays: 21, 14, 7, 30 Nov… → 21 Nov, 14 Nov, 7 Nov, 31 Oct
    const dates = ['2026-11-21', '2026-11-14', '2026-11-07', '2026-10-31']
    for (const d of dates) db.salesDays[salesDayKey(EDP, d)]!.byProduct[PUFF] = [100, 1800]
    withBatches(db, PUFF, [{ exp: '2026-11-28', qty: 20 }, { exp: '2026-11-27', qty: 50 }])
    let s = suggestIndent(db, EDP, delivery).find((x) => x.productId === PUFF)!
    expect(s.avg).toBe(100)
    expect(s.stock).toBe(20) // the batch expiring 27th is not sellable on the 28th
    expect(s.suggested).toBe(Math.ceil(100 * 1.05 - 20))
    withBatches(db, PUFF, [{ exp: '2026-12-01', qty: 500 }])
    s = suggestIndent(db, EDP, delivery).find((x) => x.productId === PUFF)!
    expect(s.suggested).toBe(0)
  })
})

describe('production & dispatch', () => {
  /** db with a draft→confirmed plan for tomorrow built from the seeded submitted indents */
  function planned() {
    const db = freshDb()
    const planId = ops.generateProductionPlanOp(db, '2026-11-27', testCtx())
    return { db, planId }
  }

  it('generates a plan by consolidating submitted indents and confirms it', () => {
    const { db, planId } = planned()
    const plan = db.productionPlans.find((p) => p.id === planId)!
    const submitted = db.indents.filter((i) => i.deliveryDate === '2026-11-27' && i.status === 'submitted')
    expect(submitted).toHaveLength(3)
    const total = submitted.flatMap((i) => i.lines).reduce((s, l) => s + l.qty, 0)
    expect(plan.lines.reduce((s, l) => s + l.indentQty, 0)).toBe(total)
    expect(ops.generateProductionPlanOp(db, '2026-11-27', testCtx())).toBe(planId) // re-consolidates the draft
    ops.confirmPlanOp(db, planId, testCtx())
    expect(plan.status).toBe('confirmed')
    expect(submitted.every((i) => i.status === 'in_production')).toBe(true)
    expect(() => ops.generateProductionPlanOp(db, '2026-11-27', testCtx())).toThrow(/already exists/)
    expect(db.indents.find((i) => i.branchId === 'b-vyt' && i.deliveryDate === '2026-11-27')!.status).toBe('draft')
  })

  it('completeProduction deducts raw materials per recipe and blocks shortfalls unless forced', () => {
    const { db, planId } = planned()
    ops.confirmPlanOp(db, planId, testCtx())
    const req = getMaterialRequirement(db, planId)
    const butter = req.find((r) => r.rawMaterialId === 'rm-butter')!
    expect(butter.shortfall).toBeGreaterThan(0)
    const stockBefore = new Map(db.rawMaterials.map((m) => [m.id, m.stockQty]))
    expect(() => ops.completeProductionOp(db, planId, {}, undefined, testCtx())).toThrow(/Not enough raw materials.*Butter/)
    expect(db.productionPlans.find((p) => p.id === planId)!.status).toBe('confirmed')

    ops.completeProductionOp(db, planId, {}, { force: true }, testCtx())
    const plan = db.productionPlans.find((p) => p.id === planId)!
    expect(plan.status).toBe('completed')
    expect(plan.lines.every((l) => l.producedQty === l.plannedQty)).toBe(true)
    for (const r of req) {
      const m = db.rawMaterials.find((x) => x.id === r.rawMaterialId)!
      expect(m.stockQty).toBeCloseTo(stockBefore.get(m.id)! - r.required, 2)
    }
    expect(db.rmMovements.filter((m) => m.refId === planId && m.type === 'production' && m.qty < 0).length).toBe(req.length)
  })

  it('proposeAllocation is pro-rata (floor) with the remainder to the largest indents', () => {
    const db = freshDb()
    db.indents = db.indents.filter((i) => i.deliveryDate !== '2026-11-27')
    const mk = (branchId: string, qty: number) => db.indents.push({
      id: `i-${branchId}`, number: branchId, branchId, deliveryDate: '2026-11-27', status: 'in_production', createdAt: '', lines: [{ productId: PUFF, suggestedQty: qty, qty }],
    })
    mk('b-edp', 6); mk('b-kkd', 4); mk('b-tsr', 5)
    db.productionPlans.push({ id: 'pl', number: 'PP-X', date: '2026-11-27', status: 'completed', createdAt: '', lines: [{ productId: PUFF, indentQty: 15, plannedQty: 15, producedQty: 10 }] })
    const rows = proposeAllocation(db, 'pl')
    const by = Object.fromEntries(rows.map((r) => [r.branchId, r.allocatedQty]))
    expect(by).toEqual({ 'b-edp': 5, 'b-kkd': 2, 'b-tsr': 3 })
    expect(Object.values(by).reduce((a, b) => a + b, 0)).toBe(10)

    db.productionPlans[db.productionPlans.length - 1]!.lines[0]!.producedQty = 20
    expect(proposeAllocation(db, 'pl').map((r) => r.allocatedQty)).toEqual([6, 4, 5]) // fully covered
  })

  it('createDispatches → receiveDispatch creates batches, transit-damage wastage and statuses', () => {
    const { db, planId } = planned()
    ops.confirmPlanOp(db, planId, testCtx())
    ops.completeProductionOp(db, planId, {}, { force: true }, testCtx())
    const alloc = proposeAllocation(db, planId)
    const ids = ops.createDispatchesOp(db, planId, alloc, 'KL-01', testCtx())
    expect(ids).toHaveLength(3)
    const edpInd = db.indents.find((i) => i.branchId === EDP && i.deliveryDate === '2026-11-27')!
    expect(edpInd.status).toBe('dispatched')
    expect(() => ops.createDispatchesOp(db, planId, alloc, undefined, testCtx())).toThrow(/already exists/)

    const d = db.dispatches.find((x) => x.branchId === EDP && x.planId === planId)!
    expect(d.status).toBe('in_transit')
    const [l0, l1] = d.lines
    const batchesBefore = db.batches.length
    const wastageBefore = db.wastage.length
    const receipt: ops.ReceiveLineInput[] = d.lines.map((l) => ({ productId: l.productId, qtyReceived: l.qtyDispatched, qtyDamaged: 0 }))
    receipt[0] = { productId: l0!.productId, qtyReceived: l0!.qtyDispatched - 3, qtyDamaged: 2 } // 1 short, 2 damaged
    receipt[1] = { productId: l1!.productId, qtyReceived: 0, qtyDamaged: 0, note: 'not on truck' } // fully short
    expect(() => ops.receiveDispatchOp(db, d.id, [{ ...receipt[0]!, qtyReceived: 9999 }, ...receipt.slice(1)], 'u-edp', testCtx())).toThrow(/exceeds dispatched/)
    ops.receiveDispatchOp(db, d.id, receipt, 'u-edp', testCtx())

    expect(d.status).toBe('received')
    expect(d.receivedBy).toBe('u-edp')
    expect(edpInd.status).toBe('received')
    expect(db.batches.length - batchesBefore).toBe(d.lines.length - 1) // zero-received line gets no batch
    const newBatch = db.batches.find((b) => b.dispatchId === d.id && b.productId === l0!.productId)!
    expect(newBatch.qtyRemaining).toBe(l0!.qtyDispatched - 3)
    expect(newBatch.mfgDate).toBe('2026-11-27')
    const w = db.wastage.slice(wastageBefore)
    expect(w).toHaveLength(1)
    expect(w[0]).toMatchObject({ reason: 'Transit damage', qty: 2, productId: l0!.productId })
    expect(d.lines[0]!.qtyDispatched - d.lines[0]!.qtyReceived! - d.lines[0]!.qtyDamaged!).toBe(1)
    expect(() => ops.receiveDispatchOp(db, d.id, receipt, 'u-edp', testCtx())).toThrow(/already been received/)
  })
})

describe('purchase', () => {
  it('receiveGRN updates stock, last-rate cost, PO status and movements', () => {
    const db = freshDb()
    const poId = ops.createPOOp(db, {
      supplierId: 's-milma', expectedDate: '2026-11-28',
      lines: [{ rawMaterialId: 'rm-butter', qty: 100, rate: 530 }, { rawMaterialId: 'rm-cream', qty: 50, rate: 285 }],
    }, testCtx())
    expect(() => ops.receiveGRNOp(db, poId, [{ rawMaterialId: 'rm-butter', qty: 1 }], testCtx())).toThrow(/Only sent/)
    ops.sendPOOp(db, poId)
    const butter0 = db.rawMaterials.find((m) => m.id === 'rm-butter')!.stockQty
    const g = ops.receiveGRNOp(db, poId, [{ rawMaterialId: 'rm-butter', qty: 60 }], testCtx())
    const po = db.purchaseOrders.find((p) => p.id === poId)!
    expect(po.status).toBe('partially_received')
    expect(g.lines[0]).toMatchObject({ qty: 60, rate: 530 })
    const butter = db.rawMaterials.find((m) => m.id === 'rm-butter')!
    expect(butter.stockQty).toBeCloseTo(butter0 + 60, 3)
    expect(butter.costPerUnit).toBe(530)
    expect(() => ops.receiveGRNOp(db, poId, [{ rawMaterialId: 'rm-butter', qty: 41 }], testCtx())).toThrow(/exceeds outstanding/)
    ops.receiveGRNOp(db, poId, [{ rawMaterialId: 'rm-butter', qty: 40, rate: 540 }, { rawMaterialId: 'rm-cream', qty: 50 }], testCtx())
    expect(po.status).toBe('received')
    expect(butter.costPerUnit).toBe(540)
    expect(db.rmMovements.filter((m) => m.type === 'grn' && m.refId && db.grns.some((x) => x.id === m.refId && x.poId === poId))).toHaveLength(3)
    expect(() => ops.cancelPOOp(db, poId)).toThrow()
  })

  it('getReorderSuggestions groups low-stock materials by preferred supplier', () => {
    const db = freshDb()
    const groups = getReorderSuggestions(db)
    const milma = groups.find((g) => g.supplierId === 's-milma')!
    expect(milma.lines.map((l) => l.rawMaterialId).sort()).toEqual(['rm-butter', 'rm-cream'])
    expect(groups.find((g) => g.supplierId === 's-spice')!.lines.map((l) => l.rawMaterialId)).toEqual(['rm-cocoa'])
  })
})

describe('indent', () => {
  it('save/submit flow flags late submissions and locks once in production', () => {
    const db = freshDb()
    const id = ops.saveIndentOp(db, { branchId: 'b-cky', deliveryDate: '2026-11-27', lines: [{ productId: PUFF, qty: 40 }] }, testCtx())
    expect(db.indents.find((i) => i.id === id)!.status).toBe('draft')
    expect(() => ops.submitIndentOp(db, id, 'u-cky', testCtx(new Date('2026-11-26T20:30:00')))).not.toThrow()
    expect(db.indents.find((i) => i.id === id)!.late).toBe(true)
    // saving again for same branch/date updates the same indent
    expect(ops.saveIndentOp(db, { branchId: 'b-cky', deliveryDate: '2026-11-27', lines: [{ productId: PUFF, qty: 45 }] }, testCtx())).toBe(id)
    ops.generateProductionPlanOp(db, '2026-11-27', testCtx())
    const plan = db.productionPlans.find((p) => p.date === '2026-11-27')!
    ops.confirmPlanOp(db, plan.id, testCtx())
    expect(() => ops.saveIndentOp(db, { id, branchId: 'b-cky', deliveryDate: '2026-11-27', lines: [{ productId: PUFF, qty: 1 }] }, testCtx())).toThrow(/in production/)
  })

  it('reconsolidatePlan merges indents submitted after confirmation', () => {
    const db = freshDb()
    const planId = ops.generateProductionPlanOp(db, '2026-11-27', testCtx())
    ops.confirmPlanOp(db, planId, testCtx())
    const plan = db.productionPlans.find((p) => p.id === planId)!
    const before = plan.lines.find((l) => l.productId === PUFF)?.plannedQty ?? 0
    const vyt = db.indents.find((i) => i.branchId === 'b-vyt' && i.deliveryDate === '2026-11-27')!
    vyt.lines = [{ productId: PUFF, suggestedQty: 10, qty: 10 }]
    ops.submitIndentOp(db, vyt.id, 'u-vyt', testCtx())
    expect(ops.reconsolidatePlanOp(db, planId)).toBe(1)
    expect(plan.lines.find((l) => l.productId === PUFF)!.plannedQty).toBe(before + 10)
    expect(vyt.status).toBe('in_production')
  })
})

describe('masters', () => {
  it('validates and upserts', () => {
    const db = freshDb()
    expect(() => ops.upsertProductOp(db, { sku: 'X', name: '', category: 'Breads', price: 10, gstRate: 5, shelfLifeDays: 1, active: true }, testCtx())).toThrow(/name/)
    const id = ops.upsertProductOp(db, { sku: 'NB-900', name: 'Test Bun', category: 'Breads', price: 20, gstRate: 5, shelfLifeDays: 2, active: true }, testCtx())
    expect(db.products.find((p) => p.id === id)!.name).toBe('Test Bun')
    expect(() => ops.upsertProductOp(db, { sku: 'nb-900', name: 'Dup', category: 'Breads', price: 20, gstRate: 5, shelfLifeDays: 2, active: true }, testCtx())).toThrow(/SKU/)
    expect(() => ops.upsertUserOp(db, { name: 'X', username: 'edappally', role: 'ho', active: true }, testCtx())).toThrow(/taken/)
    expect(() => ops.upsertUserOp(db, { name: 'X', username: 'newbranch', role: 'branch', active: true }, testCtx())).toThrow(/branch/)
    ops.adjustRawMaterialStockOp(db, 'rm-butter', 99, 'count', testCtx())
    expect(db.rawMaterials.find((m) => m.id === 'rm-butter')!.stockQty).toBe(99)
    expect(db.rmMovements.at(-1)).toMatchObject({ type: 'adjustment', rawMaterialId: 'rm-butter' })
  })
})

it('NOW fixture is 14:00 local', () => {
  expect(NOW.getHours()).toBe(14)
})
