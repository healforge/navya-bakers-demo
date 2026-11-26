/**
 * Mutating domain operations. Each takes a (draft) DbState and mutates it in place.
 * Used by BOTH the live store actions (wrapped in immer `produce`) and the seed generator,
 * so seeded data and live behaviour are identical.
 */
import { addDaysISO, compactDate, todayISO } from '@/lib/dates'
import { round2 } from '@/lib/format'
import { docNumber } from '@/lib/ids'
import type {
  Batch,
  Bill,
  BillLine,
  Branch,
  CounterKey,
  DayClose,
  DbState,
  Dispatch,
  DispatchLine,
  Expense,
  ExpenseCategory,
  GRN,
  GstRate,
  ISODate,
  Indent,
  IndentLine,
  PaymentMode,
  PriceOverride,
  Product,
  PurchaseOrder,
  RawMaterial,
  Recipe,
  SalesDay,
  Settings,
  Supplier,
  User,
  WastageEntry,
  WastageReason,
} from '@/types/domain'
import { EXPENSE_CATEGORIES, WASTAGE_REASONS } from '@/types/domain'
import {
  availableQty,
  effectivePrice,
  fifoCompare,
  getDayCloseSummary,
  gstAmount,
  indentCutoff,
  isDayClosed,
  requirementFor,
  salesDayKey,
  unitCost,
  type AllocationRow,
} from './selectors'

export interface OpCtx {
  now: Date
  uid: () => string
}

export const fail = (msg: string): never => {
  throw new Error(msg)
}

const isPosInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0
const isNonNegInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function nextNumber(db: DbState, key: CounterKey, prefix: string): string {
  db.counters[key] += 1
  return docNumber(prefix, db.counters[key])
}

function branchOrFail(db: DbState, id: string): Branch {
  return db.branches.find((b) => b.id === id) ?? fail('Branch not found')
}
function productOrFail(db: DbState, id: string): Product {
  return db.products.find((p) => p.id === id) ?? fail('Product not found')
}

// ============================================================== stock / FIFO
/** Deduct qty from a branch's batches in FIFO order. 'sell' skips expired batches. */
export function fifoDeduct(
  db: DbState, branchId: string, productId: string, qty: number, today: ISODate, mode: 'sell' | 'waste',
): { batch: Batch; qty: number }[] {
  const pool = db.batches
    .filter((b) => b.branchId === branchId && b.productId === productId && b.qtyRemaining > 0 && (mode === 'waste' || b.expiryDate >= today))
    .sort(fifoCompare)
  const total = pool.reduce((s, b) => s + b.qtyRemaining, 0)
  if (total < qty) fail(`Only ${total} in stock`)
  const taken: { batch: Batch; qty: number }[] = []
  let need = qty
  for (const b of pool) {
    if (need <= 0) break
    const n = Math.min(b.qtyRemaining, need)
    b.qtyRemaining -= n
    need -= n
    taken.push({ batch: b, qty: n })
  }
  return taken
}

export function addBatch(
  db: DbState, ctx: OpCtx,
  p: { branchId: string; productId: string; mfgDate: ISODate; qty: number; dispatchId?: string },
): Batch {
  const prod = productOrFail(db, p.productId)
  const batch: Batch = {
    id: ctx.uid(),
    branchId: p.branchId,
    productId: p.productId,
    dispatchId: p.dispatchId,
    mfgDate: p.mfgDate,
    expiryDate: addDaysISO(p.mfgDate, prod.shelfLifeDays - 1),
    qtyReceived: p.qty,
    qtyRemaining: p.qty,
  }
  db.batches.push(batch)
  return batch
}

// ===================================================================== sales
export function emptySalesDay(branchId: string, date: ISODate): SalesDay {
  return { branchId, date, bills: 0, total: 0, gst: 0, byProduct: {}, byHour: new Array<number>(24).fill(0), byPayment: { cash: 0, upi: 0, card: 0 } }
}

/** Fold a bill into the salesDays aggregate. */
export function applyBillToSalesDay(db: DbState, bill: Bill): void {
  const key = salesDayKey(bill.branchId, bill.date)
  const sd = (db.salesDays[key] ??= emptySalesDay(bill.branchId, bill.date))
  sd.bills += 1
  sd.total = round2(sd.total + bill.total)
  sd.gst = round2(sd.gst + bill.gstAmount)
  for (const l of bill.lines) {
    const cur = sd.byProduct[l.productId] ?? [0, 0]
    sd.byProduct[l.productId] = [cur[0] + l.qty, round2(cur[1] + l.amount)]
  }
  const hour = new Date(bill.createdAt).getHours()
  sd.byHour[hour] = round2((sd.byHour[hour] ?? 0) + bill.total)
  sd.byPayment[bill.paymentMode] = round2(sd.byPayment[bill.paymentMode] + bill.total)
}

export interface CreateBillInput {
  branchId: string
  cashierId: string
  lines: { productId: string; qty: number }[]
  paymentMode: PaymentMode
  tendered?: number
}

export function createBillOp(db: DbState, input: CreateBillInput, ctx: OpCtx): Bill {
  const branch = branchOrFail(db, input.branchId)
  const date = todayISO(ctx.now)
  if (isDayClosed(db, branch.id, date)) fail(`Day is closed for ${branch.name}. Reopen the day to bill.`)
  if (!input.lines.length) fail('Cart is empty')
  if (!['cash', 'upi', 'card'].includes(input.paymentMode)) fail('Choose a payment mode')

  // merge duplicate lines
  const merged = new Map<string, number>()
  for (const l of input.lines) {
    if (!isPosInt(l.qty)) fail('Quantity must be a positive whole number')
    merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.qty)
  }
  const lines: BillLine[] = []
  for (const [productId, qty] of merged) {
    const p = productOrFail(db, productId)
    if (!p.active) fail(`${p.name} is not active`)
    const avail = availableQty(db, branch.id, productId, date)
    if (qty > avail) fail(`Only ${avail} ${p.name} available (requested ${qty})`)
    const price = effectivePrice(db, branch.id, productId)
    lines.push({ productId, name: p.name, qty, price, gstRate: p.gstRate, amount: round2(qty * price) })
  }
  const total = round2(lines.reduce((s, l) => s + l.amount, 0))
  let tendered: number | undefined
  let change: number | undefined
  if (input.paymentMode === 'cash' && input.tendered !== undefined) {
    if (!isNum(input.tendered) || input.tendered < total) fail('Tendered amount is less than the bill total')
    tendered = input.tendered
    change = round2(input.tendered - total)
  }
  for (const l of lines) fifoDeduct(db, branch.id, l.productId, l.qty, date, 'sell')

  const seq = (db.salesDays[salesDayKey(branch.id, date)]?.bills ?? 0) + 1
  const bill: Bill = {
    id: ctx.uid(),
    number: `${branch.code}-${compactDate(date)}-${String(seq).padStart(4, '0')}`,
    branchId: branch.id,
    date,
    createdAt: ctx.now.toISOString(),
    cashierId: input.cashierId,
    lines,
    total,
    gstAmount: gstAmount(lines),
    paymentMode: input.paymentMode,
    tendered,
    change,
  }
  db.bills.push(bill)
  applyBillToSalesDay(db, bill)
  return bill
}

// ================================================================== wastage
export function addWastageEntry(
  db: DbState, ctx: OpCtx,
  p: { branchId: string; productId: string; qty: number; reason: WastageReason; batchId?: string; note?: string; userId?: string },
): WastageEntry {
  const price = effectivePrice(db, p.branchId, p.productId)
  const e: WastageEntry = {
    id: ctx.uid(),
    branchId: p.branchId,
    date: todayISO(ctx.now),
    createdAt: ctx.now.toISOString(),
    productId: p.productId,
    batchId: p.batchId,
    qty: p.qty,
    valueAtMRP: round2(price * p.qty),
    valueAtCost: round2(unitCost(db, p.productId) * p.qty),
    reason: p.reason,
    note: p.note || undefined,
    userId: p.userId,
  }
  db.wastage.push(e)
  return e
}

export interface RecordWastageInput {
  branchId: string
  productId: string
  qty: number
  reason: WastageReason
  batchId?: string
  note?: string
  userId?: string
}

export function recordWastageOp(db: DbState, input: RecordWastageInput, ctx: OpCtx): WastageEntry[] {
  branchOrFail(db, input.branchId)
  productOrFail(db, input.productId)
  if (!isPosInt(input.qty)) fail('Quantity must be a positive whole number')
  if (!WASTAGE_REASONS.includes(input.reason)) fail('Choose a wastage reason')
  const today = todayISO(ctx.now)
  if (input.batchId) {
    const b = db.batches.find((x) => x.id === input.batchId)
    if (!b || b.branchId !== input.branchId || b.productId !== input.productId) fail('Batch not found for this product')
    else {
      if (input.qty > b.qtyRemaining) fail(`Batch has only ${b.qtyRemaining} left`)
      b.qtyRemaining -= input.qty
      return [addWastageEntry(db, ctx, { ...input, batchId: b.id })]
    }
  }
  const taken = fifoDeduct(db, input.branchId, input.productId, input.qty, today, 'waste')
  return taken.map((t) => addWastageEntry(db, ctx, { ...input, qty: t.qty, batchId: t.batch.id }))
}

export function writeOffExpiredOp(db: DbState, branchId: string, userId: string | undefined, ctx: OpCtx): WastageEntry[] {
  branchOrFail(db, branchId)
  const today = todayISO(ctx.now)
  const expired = db.batches.filter((b) => b.branchId === branchId && b.qtyRemaining > 0 && b.expiryDate < today)
  if (!expired.length) fail('No expired stock to write off')
  return expired.map((b) => {
    const qty = b.qtyRemaining
    b.qtyRemaining = 0
    return addWastageEntry(db, ctx, { branchId, productId: b.productId, qty, reason: 'Expired', batchId: b.id, userId })
  })
}

// =================================================================== indent
export interface SaveIndentInput {
  id?: string
  branchId: string
  deliveryDate: ISODate
  lines: { productId: string; qty: number; suggestedQty?: number }[]
  note?: string
}

export function saveIndentOp(db: DbState, input: SaveIndentInput, ctx: OpCtx): string {
  branchOrFail(db, input.branchId)
  const today = todayISO(ctx.now)
  if (input.deliveryDate <= today) fail('Indent delivery date must be after today')
  for (const l of input.lines) {
    if (!isNonNegInt(l.qty)) fail('Indent quantities must be whole numbers (0 or more)')
    productOrFail(db, l.productId)
  }
  const existing = input.id
    ? db.indents.find((i) => i.id === input.id)
    : db.indents.find((i) => i.branchId === input.branchId && i.deliveryDate === input.deliveryDate)
  if (input.id && !existing) fail('Indent not found')
  const lines: IndentLine[] = input.lines.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    suggestedQty: l.suggestedQty ?? existing?.lines.find((x) => x.productId === l.productId)?.suggestedQty ?? 0,
  }))
  if (existing) {
    if (existing.status !== 'draft' && existing.status !== 'submitted') fail('This indent is already in production and can no longer be edited')
    existing.lines = lines
    existing.note = input.note
    return existing.id
  }
  const indent: Indent = {
    id: ctx.uid(),
    number: nextNumber(db, 'indent', 'IND'),
    branchId: input.branchId,
    deliveryDate: input.deliveryDate,
    status: 'draft',
    lines,
    note: input.note,
    createdAt: ctx.now.toISOString(),
  }
  db.indents.push(indent)
  return indent.id
}

export function submitIndentOp(db: DbState, id: string, userId: string, ctx: OpCtx): void {
  const ind = db.indents.find((i) => i.id === id) ?? fail('Indent not found')
  if (ind.status !== 'draft' && ind.status !== 'submitted') fail('This indent is already in production and can no longer be changed')
  if (!ind.lines.some((l) => l.qty > 0)) fail('Add at least one item before submitting')
  ind.status = 'submitted'
  ind.submittedAt = ctx.now.toISOString()
  ind.submittedBy = userId
  ind.late = ctx.now.getTime() > indentCutoff(db.settings, ind.deliveryDate).getTime()
}

// ================================================================ production
function consolidate(db: DbState, date: ISODate, statuses: Indent['status'][]): { productId: string; indentQty: number }[] {
  const sums = new Map<string, number>()
  for (const i of db.indents) {
    if (i.deliveryDate !== date || !statuses.includes(i.status)) continue
    for (const l of i.lines) if (l.qty > 0) sums.set(l.productId, (sums.get(l.productId) ?? 0) + l.qty)
  }
  const order = new Map(db.products.map((p, idx) => [p.id, idx]))
  return [...sums.entries()]
    .map(([productId, indentQty]) => ({ productId, indentQty }))
    .sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0))
}

export function generateProductionPlanOp(db: DbState, date: ISODate, ctx: OpCtx): string {
  const lines = consolidate(db, date, ['submitted'])
  const existing = db.productionPlans.find((p) => p.date === date)
  if (existing && existing.status !== 'draft') fail(`A ${existing.status} production plan already exists for this date`)
  if (!lines.length) fail('No submitted indents for this delivery date')
  const planLines = lines.map((l) => ({ productId: l.productId, indentQty: l.indentQty, plannedQty: l.indentQty }))
  if (existing) {
    existing.lines = planLines
    return existing.id
  }
  const plan = {
    id: ctx.uid(), number: nextNumber(db, 'plan', 'PP'), date, status: 'draft' as const,
    lines: planLines, createdAt: ctx.now.toISOString(),
  }
  db.productionPlans.push(plan)
  return plan.id
}

export function updatePlanLineOp(db: DbState, planId: string, productId: string, plannedQty: number): void {
  const plan = db.productionPlans.find((p) => p.id === planId) ?? fail('Production plan not found')
  if (plan.status === 'completed') fail('Plan is completed and cannot be edited')
  if (!isNonNegInt(plannedQty)) fail('Planned quantity must be a whole number (0 or more)')
  productOrFail(db, productId)
  const line = plan.lines.find((l) => l.productId === productId)
  if (line) line.plannedQty = plannedQty
  else plan.lines.push({ productId, indentQty: 0, plannedQty })
}

export function confirmPlanOp(db: DbState, planId: string, ctx: OpCtx): void {
  const plan = db.productionPlans.find((p) => p.id === planId) ?? fail('Production plan not found')
  if (plan.status !== 'draft') fail('Only a draft plan can be confirmed')
  if (!plan.lines.some((l) => l.plannedQty > 0)) fail('Plan has nothing to produce')
  for (const i of db.indents) if (i.deliveryDate === plan.date && i.status === 'submitted') i.status = 'in_production'
  plan.status = 'confirmed'
  plan.confirmedAt = ctx.now.toISOString()
}

/** Merge indents submitted after confirmation into a confirmed plan (adds the extra qty to plannedQty). */
export function reconsolidatePlanOp(db: DbState, planId: string): number {
  const plan = db.productionPlans.find((p) => p.id === planId) ?? fail('Production plan not found')
  if (plan.status !== 'confirmed') fail('Only a confirmed plan can be re-consolidated')
  const late = db.indents.filter((i) => i.deliveryDate === plan.date && i.status === 'submitted')
  if (!late.length) fail('No late indents to merge')
  for (const l of consolidate(db, plan.date, ['submitted'])) {
    const line = plan.lines.find((x) => x.productId === l.productId)
    if (line) { line.indentQty += l.indentQty; line.plannedQty += l.indentQty }
    else plan.lines.push({ productId: l.productId, indentQty: l.indentQty, plannedQty: l.indentQty })
  }
  for (const i of late) i.status = 'in_production'
  return late.length
}

export function completeProductionOp(
  db: DbState, planId: string, producedQtys: Record<string, number>, opts: { force?: boolean } | undefined, ctx: OpCtx,
): void {
  const plan = db.productionPlans.find((p) => p.id === planId) ?? fail('Production plan not found')
  if (plan.status !== 'confirmed') fail('Confirm the plan before recording production')
  const produced = plan.lines.map((l) => {
    const q = producedQtys[l.productId] ?? l.plannedQty
    if (!isNonNegInt(q)) fail('Produced quantities must be whole numbers (0 or more)')
    return { productId: l.productId, qty: q }
  })
  const req = requirementFor(db, produced)
  const short = req.filter((r) => r.shortfall > 0)
  if (short.length && !opts?.force) {
    fail(`Not enough raw materials: ${short.map((s) => `${s.name} short by ${s.shortfall} ${s.unit}`).join(', ')}`)
  }
  const date = todayISO(ctx.now)
  for (const r of req) {
    const m = db.rawMaterials.find((x) => x.id === r.rawMaterialId)
    if (!m) continue
    m.stockQty = Math.round((m.stockQty - r.required) * 1000) / 1000
    db.rmMovements.push({
      id: ctx.uid(), rawMaterialId: m.id, date, createdAt: ctx.now.toISOString(),
      type: 'production', qty: -r.required, refId: plan.id, note: `Production ${plan.number}`,
    })
  }
  for (const l of plan.lines) l.producedQty = produced.find((p) => p.productId === l.productId)?.qty ?? 0
  plan.status = 'completed'
  plan.completedAt = ctx.now.toISOString()
}

// ================================================================== dispatch
export function createDispatchesOp(
  db: DbState, planId: string, allocations: Pick<AllocationRow, 'branchId' | 'productId' | 'allocatedQty'>[], vehicle: string | undefined, ctx: OpCtx,
): string[] {
  const plan = db.productionPlans.find((p) => p.id === planId) ?? fail('Production plan not found')
  if (plan.status !== 'completed') fail('Record production before creating dispatch notes')
  for (const a of allocations) if (!isNonNegInt(a.allocatedQty)) fail('Allocated quantities must be whole numbers (0 or more)')
  // per-product cap
  const perProduct = new Map<string, number>()
  for (const a of allocations) perProduct.set(a.productId, (perProduct.get(a.productId) ?? 0) + a.allocatedQty)
  for (const [productId, sum] of perProduct) {
    const line = plan.lines.find((l) => l.productId === productId)
    const produced = line ? (line.producedQty ?? line.plannedQty) : 0
    if (sum > produced) fail(`${productOrFail(db, productId).name}: allocated ${sum} exceeds produced ${produced}`)
  }
  const byBranch = new Map<string, DispatchLine[]>()
  for (const a of allocations) {
    if (a.allocatedQty <= 0) continue
    branchOrFail(db, a.branchId)
    const arr = byBranch.get(a.branchId) ?? []
    arr.push({ productId: a.productId, qtyDispatched: a.allocatedQty })
    byBranch.set(a.branchId, arr)
  }
  if (!byBranch.size) fail('Nothing to dispatch')
  const ids: string[] = []
  for (const [branchId, lines] of byBranch) {
    if (db.dispatches.some((d) => d.planId === planId && d.branchId === branchId)) {
      fail(`A dispatch note already exists for ${branchOrFail(db, branchId).name}`)
    }
    const indent = db.indents.find((i) => i.deliveryDate === plan.date && i.branchId === branchId && (i.status === 'in_production'))
    const d: Dispatch = {
      id: ctx.uid(), number: nextNumber(db, 'dispatch', 'DN'), branchId, date: plan.date, planId,
      indentId: indent?.id, status: 'in_transit', vehicle: vehicle || undefined, dispatchedAt: ctx.now.toISOString(), lines,
    }
    db.dispatches.push(d)
    if (indent) indent.status = 'dispatched'
    ids.push(d.id)
  }
  return ids
}

export function createAdhocDispatchOp(
  db: DbState, branchId: string, lines: { productId: string; qty: number }[], vehicle: string | undefined, ctx: OpCtx,
): string {
  branchOrFail(db, branchId)
  const clean = lines.filter((l) => l.qty > 0)
  if (!clean.length) fail('Add at least one item to dispatch')
  for (const l of clean) {
    if (!isPosInt(l.qty)) fail('Quantities must be whole numbers')
    productOrFail(db, l.productId)
  }
  const d: Dispatch = {
    id: ctx.uid(), number: nextNumber(db, 'dispatch', 'DN'), branchId, date: todayISO(ctx.now),
    status: 'in_transit', vehicle: vehicle || undefined, dispatchedAt: ctx.now.toISOString(),
    lines: clean.map((l) => ({ productId: l.productId, qtyDispatched: l.qty })),
  }
  db.dispatches.push(d)
  return d.id
}

export interface ReceiveLineInput {
  productId: string
  qtyReceived: number
  qtyDamaged: number
  note?: string
}

export function receiveDispatchOp(db: DbState, dispatchId: string, lines: ReceiveLineInput[], userId: string, ctx: OpCtx): void {
  const d = db.dispatches.find((x) => x.id === dispatchId) ?? fail('Dispatch not found')
  if (d.status !== 'in_transit') fail('This dispatch has already been received')
  const input = new Map(lines.map((l) => [l.productId, l]))
  for (const dl of d.lines) {
    const l = input.get(dl.productId) ?? fail(`Missing receipt line for ${productOrFail(db, dl.productId).name}`)
    if (!isNonNegInt(l.qtyReceived) || !isNonNegInt(l.qtyDamaged)) fail('Received and damaged quantities must be whole numbers (0 or more)')
    if (l.qtyReceived + l.qtyDamaged > dl.qtyDispatched) {
      fail(`${productOrFail(db, dl.productId).name}: received + damaged (${l.qtyReceived + l.qtyDamaged}) exceeds dispatched (${dl.qtyDispatched})`)
    }
  }
  for (const dl of d.lines) {
    const l = input.get(dl.productId)!
    dl.qtyReceived = l.qtyReceived
    dl.qtyDamaged = l.qtyDamaged
    dl.note = l.note || undefined
    if (l.qtyReceived > 0) addBatch(db, ctx, { branchId: d.branchId, productId: dl.productId, mfgDate: d.date, qty: l.qtyReceived, dispatchId: d.id })
    if (l.qtyDamaged > 0) {
      addWastageEntry(db, ctx, { branchId: d.branchId, productId: dl.productId, qty: l.qtyDamaged, reason: 'Transit damage', note: l.note, userId })
    }
  }
  d.status = 'received'
  d.receivedAt = ctx.now.toISOString()
  d.receivedBy = userId
  const indent = d.indentId ? db.indents.find((i) => i.id === d.indentId) : undefined
  if (indent) indent.status = 'received'
}

// ================================================================== purchase
export interface POInput {
  supplierId: string
  expectedDate: ISODate
  lines: { rawMaterialId: string; qty: number; rate: number }[]
  note?: string
}

function validatePO(db: DbState, input: POInput): void {
  if (!db.suppliers.some((s) => s.id === input.supplierId)) fail('Choose a supplier')
  if (!input.expectedDate) fail('Choose an expected delivery date')
  if (!input.lines.length) fail('Add at least one item')
  const seen = new Set<string>()
  for (const l of input.lines) {
    if (!db.rawMaterials.some((m) => m.id === l.rawMaterialId)) fail('Unknown raw material')
    if (seen.has(l.rawMaterialId)) fail('Each raw material can appear only once per PO')
    seen.add(l.rawMaterialId)
    if (!isNum(l.qty) || l.qty <= 0) fail('Quantities must be greater than 0')
    if (!isNum(l.rate) || l.rate < 0) fail('Rates cannot be negative')
  }
}

export function createPOOp(db: DbState, input: POInput, ctx: OpCtx): string {
  validatePO(db, input)
  const po: PurchaseOrder = {
    id: ctx.uid(), number: nextNumber(db, 'po', 'PO'), supplierId: input.supplierId,
    date: todayISO(ctx.now), expectedDate: input.expectedDate, status: 'draft', note: input.note,
    lines: input.lines.map((l) => ({ ...l, receivedQty: 0 })), createdAt: ctx.now.toISOString(),
  }
  db.purchaseOrders.push(po)
  return po.id
}

export function updatePOOp(db: DbState, id: string, input: POInput): void {
  const po = db.purchaseOrders.find((p) => p.id === id) ?? fail('Purchase order not found')
  if (po.status !== 'draft') fail('Only draft purchase orders can be edited')
  validatePO(db, input)
  po.supplierId = input.supplierId
  po.expectedDate = input.expectedDate
  po.note = input.note
  po.lines = input.lines.map((l) => ({ ...l, receivedQty: 0 }))
}

export function sendPOOp(db: DbState, id: string): void {
  const po = db.purchaseOrders.find((p) => p.id === id) ?? fail('Purchase order not found')
  if (po.status !== 'draft') fail('Only draft purchase orders can be sent')
  po.status = 'sent'
}

export function cancelPOOp(db: DbState, id: string): void {
  const po = db.purchaseOrders.find((p) => p.id === id) ?? fail('Purchase order not found')
  if (po.status !== 'draft' && po.status !== 'sent') fail('Only draft or sent purchase orders can be cancelled')
  po.status = 'cancelled'
}

export function receiveGRNOp(
  db: DbState, poId: string, lines: { rawMaterialId: string; qty: number; rate?: number }[], ctx: OpCtx,
): GRN {
  const po = db.purchaseOrders.find((p) => p.id === poId) ?? fail('Purchase order not found')
  if (po.status !== 'sent' && po.status !== 'partially_received') fail('Only sent purchase orders can be received')
  const clean = lines.filter((l) => l.qty > 0)
  if (!clean.length) fail('Enter a received quantity')
  for (const l of clean) {
    const pl = po.lines.find((x) => x.rawMaterialId === l.rawMaterialId) ?? fail('Item is not on this purchase order')
    if (!isNum(l.qty)) fail('Invalid quantity')
    const outstanding = pl.qty - pl.receivedQty
    if (l.qty > outstanding + 1e-9) fail(`Received qty exceeds outstanding (${Math.round(outstanding * 1000) / 1000}) for ${db.rawMaterials.find((m) => m.id === l.rawMaterialId)?.name ?? ''}`)
  }
  const grn: GRN = {
    id: ctx.uid(), number: nextNumber(db, 'grn', 'GRN'), poId, date: todayISO(ctx.now), createdAt: ctx.now.toISOString(),
    lines: clean.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: l.qty, rate: l.rate ?? po.lines.find((x) => x.rawMaterialId === l.rawMaterialId)!.rate })),
  }
  for (const l of grn.lines) {
    const pl = po.lines.find((x) => x.rawMaterialId === l.rawMaterialId)!
    pl.receivedQty = Math.round((pl.receivedQty + l.qty) * 1000) / 1000
    const m = db.rawMaterials.find((x) => x.id === l.rawMaterialId)!
    m.stockQty = Math.round((m.stockQty + l.qty) * 1000) / 1000
    m.costPerUnit = l.rate
    db.rmMovements.push({
      id: ctx.uid(), rawMaterialId: m.id, date: grn.date, createdAt: grn.createdAt, type: 'grn', qty: l.qty, refId: grn.id, note: `${grn.number} / ${po.number}`,
    })
  }
  po.status = po.lines.every((l) => l.receivedQty >= l.qty - 1e-9) ? 'received' : 'partially_received'
  db.grns.push(grn)
  return grn
}

// ================================================================== day end
export function addExpenseOp(
  db: DbState, input: { branchId: string; category: ExpenseCategory; amount: number; note?: string }, ctx: OpCtx,
): Expense {
  branchOrFail(db, input.branchId)
  const date = todayISO(ctx.now)
  if (isDayClosed(db, input.branchId, date)) fail('Day is closed — reopen it to add expenses')
  if (!EXPENSE_CATEGORIES.includes(input.category)) fail('Choose an expense category')
  if (!isNum(input.amount) || input.amount <= 0) fail('Amount must be greater than 0')
  const e: Expense = {
    id: ctx.uid(), branchId: input.branchId, date, createdAt: ctx.now.toISOString(),
    category: input.category, amount: round2(input.amount), note: input.note || undefined,
  }
  db.expenses.push(e)
  return e
}

export function deleteExpenseOp(db: DbState, id: string): void {
  const e = db.expenses.find((x) => x.id === id) ?? fail('Expense not found')
  if (isDayClosed(db, e.branchId, e.date)) fail('Day is closed — reopen it to delete expenses')
  db.expenses = db.expenses.filter((x) => x.id !== id)
}

export interface CloseDayInput {
  branchId: string
  date: ISODate
  countedCash: number
  denominations?: Record<string, number>
  notes?: string
  userId: string
}

export function closeDayOp(db: DbState, input: CloseDayInput, ctx: OpCtx): DayClose {
  branchOrFail(db, input.branchId)
  if (input.date > todayISO(ctx.now)) fail('Cannot close a future date')
  if (isDayClosed(db, input.branchId, input.date)) fail('This day is already closed')
  if (!isNum(input.countedCash) || input.countedCash < 0) fail('Counted cash cannot be negative')
  const s = getDayCloseSummary(db, input.branchId, input.date)
  const dc: DayClose = {
    id: ctx.uid(), branchId: input.branchId, date: input.date, openingFloat: s.openingFloat,
    cashSales: s.cashSales, upiSales: s.upiSales, cardSales: s.cardSales, cashExpenses: s.cashExpenses,
    expectedCash: s.expectedCash, countedCash: round2(input.countedCash), denominations: input.denominations,
    variance: round2(input.countedCash - s.expectedCash), notes: input.notes || undefined,
    closedBy: input.userId, closedAt: ctx.now.toISOString(),
  }
  db.dayCloses.push(dc)
  return dc
}

export function reopenDayOp(db: DbState, branchId: string, date: ISODate): void {
  if (!isDayClosed(db, branchId, date)) fail('This day is not closed')
  db.dayCloses = db.dayCloses.filter((d) => !(d.branchId === branchId && d.date === date))
}

// =================================================================== masters
export type ProductInput = Omit<Product, 'id'> & { id?: string }

export function upsertProductOp(db: DbState, input: ProductInput, ctx: OpCtx): string {
  if (!input.name?.trim()) fail('Product name is required')
  if (!input.sku?.trim()) fail('SKU is required')
  if (!isNum(input.price) || input.price <= 0) fail('MRP must be greater than 0')
  if (![0, 5, 12, 18].includes(input.gstRate)) fail('GST rate must be 0, 5, 12 or 18')
  if (!isPosInt(input.shelfLifeDays)) fail('Shelf life must be at least 1 day')
  if (db.products.some((p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase() && p.id !== input.id)) fail('SKU already exists')
  const data = { ...input, name: input.name.trim(), sku: input.sku.trim(), gstRate: input.gstRate as GstRate }
  const existing = input.id ? db.products.find((p) => p.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, data)
    return existing.id
  }
  const id = input.id ?? `p-${ctx.uid()}`
  db.products.push({ ...data, id })
  return id
}

export function setProductActiveOp(db: DbState, id: string, active: boolean): void {
  productOrFail(db, id).active = active
}

export type BranchInput = Omit<Branch, 'id'> & { id?: string }

export function upsertBranchOp(db: DbState, input: BranchInput, ctx: OpCtx): string {
  if (!input.name?.trim()) fail('Branch name is required')
  if (!/^[A-Z]{2,4}$/.test(input.code ?? '')) fail('Branch code must be 2–4 capital letters')
  if (db.branches.some((b) => b.code === input.code && b.id !== input.id)) fail('Branch code already exists')
  if (!isNum(input.openingFloat) || input.openingFloat < 0) fail('Opening float cannot be negative')
  const existing = input.id ? db.branches.find((b) => b.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, input)
    return existing.id
  }
  const id = input.id ?? `b-${ctx.uid()}`
  db.branches.push({ ...input, id })
  return id
}

export type UserInput = Omit<User, 'id' | 'passwordHash'> & { id?: string }

export function upsertUserOp(db: DbState, input: UserInput, ctx: OpCtx): string {
  if (!input.name?.trim()) fail('Name is required')
  const username = input.username?.trim().toLowerCase()
  if (!username || !/^[a-z0-9._-]{3,}$/.test(username)) fail('Username must be 3+ characters (letters, numbers, . _ -)')
  if (db.users.some((u) => u.username === username && u.id !== input.id)) fail('Username already taken')
  if (input.role === 'branch' && !input.branchId) fail('Choose a branch for branch users')
  const branchId = input.role === 'branch' ? input.branchId : undefined
  const existing = input.id ? db.users.find((u) => u.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, { ...input, username, branchId })
    return existing.id
  }
  const id = input.id ?? `u-${ctx.uid()}`
  db.users.push({ ...input, id, username, branchId, passwordHash: null })
  return id
}

export function setPriceOverrideOp(db: DbState, o: PriceOverride): void {
  branchOrFail(db, o.branchId)
  productOrFail(db, o.productId)
  if (!isNum(o.price) || o.price <= 0) fail('Price must be greater than 0')
  const cur = db.priceOverrides.find((x) => x.branchId === o.branchId && x.productId === o.productId)
  if (cur) cur.price = o.price
  else db.priceOverrides.push({ ...o })
}

export function removePriceOverrideOp(db: DbState, branchId: string, productId: string): void {
  db.priceOverrides = db.priceOverrides.filter((x) => !(x.branchId === branchId && x.productId === productId))
}

export type RawMaterialInput = Omit<RawMaterial, 'id'> & { id?: string }

export function upsertRawMaterialOp(db: DbState, input: RawMaterialInput, ctx: OpCtx): string {
  if (!input.name?.trim()) fail('Name is required')
  if (!input.code?.trim()) fail('Code is required')
  if (db.rawMaterials.some((m) => m.code === input.code && m.id !== input.id)) fail('Code already exists')
  for (const [k, v] of [['Cost', input.costPerUnit], ['Stock', input.stockQty], ['Reorder level', input.reorderLevel], ['Reorder qty', input.reorderQty]] as const) {
    if (!isNum(v) || v < 0) fail(`${k} cannot be negative`)
  }
  const existing = input.id ? db.rawMaterials.find((m) => m.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, input)
    return existing.id
  }
  const id = input.id ?? `rm-${ctx.uid()}`
  db.rawMaterials.push({ ...input, id })
  return id
}

export function adjustRawMaterialStockOp(db: DbState, id: string, newQty: number, note: string | undefined, ctx: OpCtx): void {
  const m = db.rawMaterials.find((x) => x.id === id) ?? fail('Raw material not found')
  if (!isNum(newQty) || newQty < 0) fail('Stock cannot be negative')
  const delta = Math.round((newQty - m.stockQty) * 1000) / 1000
  if (delta === 0) return
  m.stockQty = newQty
  db.rmMovements.push({
    id: ctx.uid(), rawMaterialId: id, date: todayISO(ctx.now), createdAt: ctx.now.toISOString(),
    type: 'adjustment', qty: delta, note: note || 'Stock adjustment',
  })
}

export type SupplierInput = Omit<Supplier, 'id'> & { id?: string }

export function upsertSupplierOp(db: DbState, input: SupplierInput, ctx: OpCtx): string {
  if (!input.name?.trim()) fail('Supplier name is required')
  const existing = input.id ? db.suppliers.find((s) => s.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, input)
    return existing.id
  }
  const id = input.id ?? `s-${ctx.uid()}`
  db.suppliers.push({ ...input, id })
  return id
}

export function upsertRecipeOp(db: DbState, recipe: Recipe): void {
  productOrFail(db, recipe.productId)
  if (!isNum(recipe.yieldQty) || recipe.yieldQty <= 0) fail('Yield must be greater than 0')
  if (!recipe.ingredients.length) fail('Add at least one ingredient')
  const seen = new Set<string>()
  for (const i of recipe.ingredients) {
    if (!db.rawMaterials.some((m) => m.id === i.rawMaterialId)) fail('Unknown ingredient')
    if (seen.has(i.rawMaterialId)) fail('Each ingredient can appear only once')
    seen.add(i.rawMaterialId)
    if (!isNum(i.qty) || i.qty <= 0) fail('Ingredient quantities must be greater than 0')
  }
  const cur = db.recipes.find((r) => r.productId === recipe.productId)
  if (cur) {
    cur.yieldQty = recipe.yieldQty
    cur.ingredients = recipe.ingredients.map((i) => ({ ...i }))
  } else db.recipes.push({ productId: recipe.productId, yieldQty: recipe.yieldQty, ingredients: recipe.ingredients.map((i) => ({ ...i })) })
}

export function updateSettingsOp(db: DbState, patch: Partial<Settings>): void {
  const next = { ...db.settings, ...patch }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.indentCutoffTime)) fail('Cutoff time must be HH:mm')
  for (const k of ['nearExpiryDays', 'wastageAlertPct', 'salesDropAlertPct', 'cashVarianceAlert', 'transitAlertHours'] as const) {
    if (!isNum(next[k]) || next[k] < 0) fail('Thresholds cannot be negative')
  }
  if (!next.companyName.trim()) fail('Company name is required')
  Object.assign(db.settings, next)
}
