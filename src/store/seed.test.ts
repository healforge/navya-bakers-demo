import { describe, expect, it } from 'vitest'
import { generateSeed } from '@/data/generateSeed'
import { getBranchStock, salesDayKey, unitCost, netPrice } from './selectors'
import { freshDb, NOW, TODAY } from './testUtils'

describe('generateSeed', () => {
  it('is deterministic for a fixed now', () => {
    expect(JSON.stringify(generateSeed(NOW))).toBe(JSON.stringify(generateSeed(NOW)))
  })

  it('is fast (< 500 ms) and small (< 2.5 MB) even late in the day', () => {
    const late = new Date('2026-11-26T22:00:00')
    generateSeed(late) // warm up JIT
    const t0 = performance.now()
    const db = generateSeed(late)
    const ms = performance.now() - t0
    const bytes = JSON.stringify(db).length
    expect(ms).toBeLessThan(500)
    expect(bytes).toBeLessThan(2.5 * 1024 * 1024)
  })

  it('has the catalog sizes from the plan', () => {
    const db = freshDb()
    expect(db.branches).toHaveLength(5)
    expect(db.products.length).toBeGreaterThanOrEqual(40)
    expect(db.rawMaterials.length).toBeGreaterThanOrEqual(25)
    expect(db.suppliers).toHaveLength(6)
    expect(db.users).toHaveLength(8)
    expect(db.users.every((u) => u.passwordHash === null)).toBe(true)
    expect(db.recipes).toHaveLength(db.products.length)
    expect(db.anchorDate).toBe(TODAY)
  })

  it('scales recipes so unit cost is 35–50% of net price', () => {
    const db = freshDb()
    for (const p of db.products) {
      const ratio = unitCost(db, p.id) / netPrice(p)
      expect(ratio, p.name).toBeGreaterThan(0.33)
      expect(ratio, p.name).toBeLessThan(0.52)
    }
  })

  it('has 90 days of consistent aggregates per branch', () => {
    const db = freshDb()
    for (const b of db.branches) {
      let days = 0
      for (const [key, sd] of Object.entries(db.salesDays)) {
        if (!key.startsWith(`${b.id}|`) || sd.date === TODAY) continue
        days++
        const byProd = Object.values(sd.byProduct).reduce((s, v) => s + v[1], 0)
        expect(byProd).toBe(sd.total)
        expect(sd.byHour.reduce((s, v) => s + v, 0)).toBe(sd.total)
        expect(sd.byPayment.cash + sd.byPayment.upi + sd.byPayment.card).toBe(sd.total)
        expect(sd.byHour).toHaveLength(24)
      }
      expect(days).toBe(90)
    }
  })

  it("today's salesDays equal the aggregate of today's bills (same code path as createBill)", () => {
    const db = freshDb()
    expect(db.bills.length).toBeGreaterThan(100)
    for (const b of db.branches) {
      const bills = db.bills.filter((x) => x.branchId === b.id && x.date === TODAY)
      const sd = db.salesDays[salesDayKey(b.id, TODAY)]!
      expect(sd.bills).toBe(bills.length)
      expect(sd.total).toBeCloseTo(bills.reduce((s, x) => s + x.total, 0), 2)
      expect(sd.gst).toBeCloseTo(bills.reduce((s, x) => s + x.gstAmount, 0), 1)
      const qty = bills.flatMap((x) => x.lines).reduce((s, l) => s + l.qty, 0)
      expect(Object.values(sd.byProduct).reduce((s, v) => s + v[0], 0)).toBe(qty)
      expect(bills[0]!.number).toMatch(new RegExp(`^${b.code}-261126-0001$`))
    }
  })

  it('seeds the story states', () => {
    const db = freshDb()
    expect(db.dispatches.filter((d) => d.status === 'in_transit').map((d) => d.branchId)).toEqual(['b-cky'])
    const tomorrow = db.indents.filter((i) => i.deliveryDate === '2026-11-27')
    expect(tomorrow.filter((i) => i.status === 'submitted').map((i) => i.branchId).sort()).toEqual(['b-edp', 'b-kkd', 'b-tsr'])
    expect(tomorrow.find((i) => i.branchId === 'b-vyt')?.status).toBe('draft')
    expect(tomorrow.find((i) => i.branchId === 'b-cky')).toBeUndefined()
    expect(db.dayCloses.some((d) => d.branchId === 'b-vyt' && d.date === '2026-11-25')).toBe(false)
    expect(db.dayCloses.find((d) => d.branchId === 'b-cky' && d.date === '2026-11-24')?.variance).toBe(-850)
    expect(db.purchaseOrders.some((p) => p.status === 'sent')).toBe(true)
    expect(db.purchaseOrders.some((p) => p.status === 'partially_received')).toBe(true)
    expect(db.purchaseOrders.filter((p) => p.status === 'received').length).toBeGreaterThanOrEqual(20)
    expect(db.productionPlans.find((p) => p.date === TODAY)?.status).toBe('completed')
    const low = db.rawMaterials.filter((m) => m.stockQty < m.reorderLevel).map((m) => m.id).sort()
    expect(low).toEqual(['rm-butter', 'rm-cocoa', 'rm-cream'])
  })
})

describe('long-life stock on the anchor day', () => {
  for (const hhmm of ['14:00', '21:00']) {
    it(`no active product with shelfLifeDays >= 7 is out at ${hhmm}`, () => {
      const db = generateSeed(new Date(`2026-11-26T${hhmm}:00`))
      for (const b of db.branches) {
        for (const s of getBranchStock(db, b.id, '2026-11-26')) {
          if (s.product.active && s.product.shelfLifeDays >= 7) expect(s.onHand, `${b.name} ${s.product.name}`).toBeGreaterThan(0)
        }
      }
    })
  }
})
