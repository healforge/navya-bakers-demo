/**
 * The app database store.
 *
 *  - Read:   `useDb(selector)` (stable slices) / `useDbShallow(selector)` (derived arrays/objects) / `getDb()`
 *  - Write:  `dbActions.<action>(…)` or `useDbActions()` — every action validates and THROWS readable Errors
 *            (catch + toast in the UI). Never mutate state objects directly.
 *  - Derived data: call the pure selectors in ./selectors, ./analytics, ./alerts inside useMemo.
 */
import { produce, setAutoFreeze } from 'immer'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { generateSeed } from '@/data/generateSeed'
import { hashPassword } from '@/lib/password'
import { uid } from '@/lib/ids'
import type { ISODate, DbState, Recipe, PriceOverride, Settings, GRN, DayClose, Bill, WastageEntry, Expense, ExpenseCategory } from '@/types/domain'
import * as ops from './ops'
import { loadOrSeed } from './persistence'
import type { AllocationRow } from './selectors'

setAutoFreeze(false) // state objects stay plain & sortable; still: do NOT mutate them in UI code

interface DbStore {
  db: DbState
}

export const useDbStore = create<DbStore>(() => ({ db: loadOrSeed() }))

/** Select from the db. Selector must return a stable reference (a slice of state, a primitive). */
export function useDb<T>(selector: (db: DbState) => T): T {
  return useDbStore((s) => selector(s.db))
}

/** Like useDb but shallow-compares the result — use for selectors that build a new array/object. */
export function useDbShallow<T>(selector: (db: DbState) => T): T {
  return useDbStore(useShallow((s: DbStore) => selector(s.db)))
}

export const getDb = (): DbState => useDbStore.getState().db

const makeCtx = (): ops.OpCtx => ({ now: new Date(), uid })

/** Run a mutating op against an immer draft of the db; throws leave state untouched. */
function mutate<T>(fn: (db: DbState, ctx: ops.OpCtx) => T): T {
  const ctx = makeCtx()
  let result!: T
  const next = produce(useDbStore.getState().db, (draft) => {
    result = fn(draft as DbState, ctx)
  })
  useDbStore.setState({ db: next })
  return result
}

export const dbActions = {
  // ---- masters
  upsertProduct: (input: ops.ProductInput) => mutate((db, c) => ops.upsertProductOp(db, input, c)),
  setProductActive: (id: string, active: boolean) => mutate((db) => ops.setProductActiveOp(db, id, active)),
  upsertBranch: (input: ops.BranchInput) => mutate((db, c) => ops.upsertBranchOp(db, input, c)),
  upsertUser: (input: ops.UserInput) => mutate((db, c) => ops.upsertUserOp(db, input, c)),
  /** Stores a salted SHA-256 hash (Web Crypto). Pass `null` to clear back to demo (no password). */
  async setUserPassword(userId: string, plain: string | null): Promise<void> {
    if (plain !== null && plain.length < 4) throw new Error('Password must be at least 4 characters')
    const hash = plain === null ? null : await hashPassword(plain)
    mutate((db) => {
      const u = db.users.find((x) => x.id === userId)
      if (!u) throw new Error('User not found')
      u.passwordHash = hash
    })
  },
  setPriceOverride: (o: PriceOverride) => mutate((db) => ops.setPriceOverrideOp(db, o)),
  removePriceOverride: (branchId: string, productId: string) => mutate((db) => ops.removePriceOverrideOp(db, branchId, productId)),
  upsertRawMaterial: (input: ops.RawMaterialInput) => mutate((db, c) => ops.upsertRawMaterialOp(db, input, c)),
  adjustRawMaterialStock: (id: string, newQty: number, note?: string) => mutate((db, c) => ops.adjustRawMaterialStockOp(db, id, newQty, note, c)),
  upsertSupplier: (input: ops.SupplierInput) => mutate((db, c) => ops.upsertSupplierOp(db, input, c)),
  upsertRecipe: (recipe: Recipe) => mutate((db) => ops.upsertRecipeOp(db, recipe)),
  updateSettings: (patch: Partial<Settings>) => mutate((db) => ops.updateSettingsOp(db, patch)),

  // ---- POS
  createBill: (input: ops.CreateBillInput): Bill => mutate((db, c) => ops.createBillOp(db, input, c)),

  // ---- stock & wastage
  recordWastage: (input: ops.RecordWastageInput): WastageEntry[] => mutate((db, c) => ops.recordWastageOp(db, input, c)),
  writeOffExpired: (branchId: string, userId?: string): WastageEntry[] => mutate((db, c) => ops.writeOffExpiredOp(db, branchId, userId, c)),

  // ---- indent
  saveIndent: (draft: ops.SaveIndentInput): string => mutate((db, c) => ops.saveIndentOp(db, draft, c)),
  submitIndent: (id: string, userId: string) => mutate((db, c) => ops.submitIndentOp(db, id, userId, c)),

  // ---- production
  generateProductionPlan: (date: ISODate): string => mutate((db, c) => ops.generateProductionPlanOp(db, date, c)),
  updatePlanLine: (planId: string, productId: string, plannedQty: number) => mutate((db) => ops.updatePlanLineOp(db, planId, productId, plannedQty)),
  confirmPlan: (planId: string) => mutate((db, c) => ops.confirmPlanOp(db, planId, c)),
  /** Merge indents submitted after confirmation; returns number of indents merged. */
  reconsolidatePlan: (planId: string): number => mutate((db) => ops.reconsolidatePlanOp(db, planId)),
  completeProduction: (planId: string, producedQtys: Record<string, number>, opts?: { force?: boolean }) =>
    mutate((db, c) => ops.completeProductionOp(db, planId, producedQtys, opts, c)),

  // ---- dispatch
  /** Returns the created dispatch ids (one per branch). */
  createDispatches: (planId: string, allocations: Pick<AllocationRow, 'branchId' | 'productId' | 'allocatedQty'>[], vehicle?: string): string[] =>
    mutate((db, c) => ops.createDispatchesOp(db, planId, allocations, vehicle, c)),
  createAdhocDispatch: (branchId: string, lines: { productId: string; qty: number }[], vehicle?: string): string =>
    mutate((db, c) => ops.createAdhocDispatchOp(db, branchId, lines, vehicle, c)),
  receiveDispatch: (dispatchId: string, lines: ops.ReceiveLineInput[], userId: string) =>
    mutate((db, c) => ops.receiveDispatchOp(db, dispatchId, lines, userId, c)),

  // ---- purchase
  createPO: (input: ops.POInput): string => mutate((db, c) => ops.createPOOp(db, input, c)),
  updatePO: (id: string, input: ops.POInput) => mutate((db) => ops.updatePOOp(db, id, input)),
  sendPO: (id: string) => mutate((db) => ops.sendPOOp(db, id)),
  cancelPO: (id: string) => mutate((db) => ops.cancelPOOp(db, id)),
  receiveGRN: (poId: string, lines: { rawMaterialId: string; qty: number; rate?: number }[]): GRN => mutate((db, c) => ops.receiveGRNOp(db, poId, lines, c)),

  // ---- day end
  addExpense: (input: { branchId: string; category: ExpenseCategory; amount: number; note?: string }): Expense => mutate((db, c) => ops.addExpenseOp(db, input, c)),
  deleteExpense: (id: string) => mutate((db) => ops.deleteExpenseOp(db, id)),
  closeDay: (input: ops.CloseDayInput): DayClose => mutate((db, c) => ops.closeDayOp(db, input, c)),
  reopenDay: (branchId: string, date: ISODate) => mutate((db) => ops.reopenDayOp(db, branchId, date)),

  // ---- demo
  resetDemoData: () => useDbStore.setState({ db: generateSeed(new Date()) }),
}

export type DbActions = typeof dbActions

/** Stable actions object (not reactive). */
export function useDbActions(): DbActions {
  return dbActions
}
