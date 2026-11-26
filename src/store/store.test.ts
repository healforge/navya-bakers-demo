import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'
import { dbActions, getDb, useDbStore } from './db'
import { parseDb } from './persistence'
import { freshDb, NOW } from './testUtils'

describe('store actions (immer-backed, throw leaves state untouched)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    useDbStore.setState({ db: freshDb() })
  })
  afterEach(() => vi.useRealTimers())

  it('createBill updates state and returns the bill', () => {
    const before = getDb()
    const stock = before.batches.find((b) => b.branchId === 'b-edp' && b.productId === 'p-milk-bread' && b.expiryDate >= '2026-11-26' && b.qtyRemaining > 0)
    expect(stock).toBeDefined()
    const bill = dbActions.createBill({ branchId: 'b-edp', cashierId: 'u-edp', lines: [{ productId: 'p-milk-bread', qty: 1 }], paymentMode: 'upi' })
    expect(bill.total).toBe(45)
    const after = getDb()
    expect(after).not.toBe(before)
    expect(after.bills.at(-1)?.id).toBe(bill.id)
    expect(before.bills.length).toBe(after.bills.length - 1) // previous state not mutated
  })

  it('errors are readable and leave state unchanged', () => {
    const before = getDb()
    expect(() => dbActions.createBill({ branchId: 'b-edp', cashierId: 'u', lines: [{ productId: 'p-milk-bread', qty: 99999 }], paymentMode: 'upi' })).toThrow(/Only \d+ Milk Bread/)
    expect(getDb()).toBe(before)
  })

  it('setUserPassword stores a salted hash that verifies', async () => {
    await dbActions.setUserPassword('u-ho', 'correct horse')
    const u = getDb().users.find((x) => x.id === 'u-ho')!
    expect(u.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/)
    expect(await verifyPassword('correct horse', u.passwordHash!)).toBe(true)
    expect(await verifyPassword('wrong', u.passwordHash!)).toBe(false)
    expect(await hashPassword('correct horse')).not.toBe(u.passwordHash) // salted
    await expect(dbActions.setUserPassword('u-ho', 'ab')).rejects.toThrow(/at least 4/)
  })

  it('resetDemoData regenerates anchored at now', () => {
    dbActions.updateSettings({ indentCutoffTime: '19:00' })
    expect(getDb().settings.indentCutoffTime).toBe('19:00')
    dbActions.resetDemoData()
    expect(getDb().settings.indentCutoffTime).toBe('20:00')
    expect(getDb().anchorDate).toBe('2026-11-26')
  })
})

describe('persistence helpers', () => {
  it('parseDb rejects junk and wrong versions', () => {
    expect(parseDb(null)).toBeNull()
    expect(parseDb('{nope')).toBeNull()
    expect(parseDb(JSON.stringify({ version: 2 }))).toBeNull()
    expect(parseDb(JSON.stringify(freshDb()))?.version).toBe(1)
  })
})
