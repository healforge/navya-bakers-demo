/**
 * Pure selectors: (DbState, ...args) → data. Safe to call inside useMemo / useDb.
 * NEVER mutate what these return (arrays/objects may be shared with state).
 */
import { addDaysISO, atTime, todayISO } from '@/lib/dates'
import { round2 } from '@/lib/format'
import type {
  Batch,
  DayClose,
  DbState,
  Dispatch,
  ISODate,
  Indent,
  Product,
  RawMaterial,
  SalesDay,
  Settings,
  Supplier,
} from '@/types/domain'

// ----------------------------------------------------------------- helpers
export const salesDayKey = (branchId: string, date: ISODate) => `${branchId}|${date}`

export function getSalesDay(db: DbState, branchId: string, date: ISODate): SalesDay | undefined {
  return db.salesDays[salesDayKey(branchId, date)]
}

/** GST contained in a tax-inclusive amount. */
export function gstOf(amount: number, rate: number): number {
  return (amount * rate) / (100 + rate)
}

/** Σ amount × r/(100+r), rounded to 2 dp. */
export function gstAmount(lines: { amount: number; gstRate: number }[]): number {
  return round2(lines.reduce((s, l) => s + gstOf(l.amount, l.gstRate), 0))
}

/** Ex-GST price of a product. */
export function netPrice(p: Pick<Product, 'price' | 'gstRate'>): number {
  return round2(p.price / (1 + p.gstRate / 100))
}

export function effectivePrice(db: DbState, branchId: string, productId: string): number {
  const o = db.priceOverrides.find((x) => x.branchId === branchId && x.productId === productId)
  if (o) return o.price
  const p = db.products.find((x) => x.id === productId)
  if (!p) throw new Error('Unknown product')
  return p.price
}

// ------------------------------------------------------------- lookup maps
const mapCache = new WeakMap<object, Map<string, unknown>>()
function indexBy<T extends { id: string }>(arr: T[]): Map<string, T> {
  let m = mapCache.get(arr) as Map<string, T> | undefined
  if (!m) {
    m = new Map(arr.map((x) => [x.id, x]))
    mapCache.set(arr, m)
  }
  return m
}
export const productMap = (db: DbState) => indexBy(db.products)
export const branchMap = (db: DbState) => indexBy(db.branches)
export const rawMaterialMap = (db: DbState) => indexBy(db.rawMaterials)
export const supplierMap = (db: DbState) => indexBy(db.suppliers)
export const userMap = (db: DbState) => indexBy(db.users)

export function productName(db: DbState, id: string): string {
  return productMap(db).get(id)?.name ?? id
}
export function branchName(db: DbState, id: string): string {
  return branchMap(db).get(id)?.name ?? id
}

// ------------------------------------------------------------------ costing
let costCache: { recipes: unknown; rms: unknown; map: Record<string, number> } | null = null

/** productId → cost per unit (Σ ingredient qty × RM cost ÷ yield). Memoised on recipes/rawMaterials identity. */
export function unitCostMap(db: DbState): Record<string, number> {
  if (costCache && costCache.recipes === db.recipes && costCache.rms === db.rawMaterials) return costCache.map
  const rm = rawMaterialMap(db)
  const map: Record<string, number> = {}
  for (const r of db.recipes) {
    const total = r.ingredients.reduce((s, i) => s + i.qty * (rm.get(i.rawMaterialId)?.costPerUnit ?? 0), 0)
    map[r.productId] = r.yieldQty > 0 ? total / r.yieldQty : 0
  }
  costCache = { recipes: db.recipes, rms: db.rawMaterials, map }
  return map
}

/** Uncached single-product cost (safe inside mutating ops). */
export function unitCost(db: DbState, productId: string): number {
  const r = db.recipes.find((x) => x.productId === productId)
  if (!r || r.yieldQty <= 0) return 0
  let total = 0
  for (const i of r.ingredients) total += i.qty * (db.rawMaterials.find((m) => m.id === i.rawMaterialId)?.costPerUnit ?? 0)
  return total / r.yieldQty
}

/** Gross margin % for a product at its MRP (ex-GST). */
export function productMarginPct(db: DbState, p: Product): number {
  const net = p.price / (1 + p.gstRate / 100)
  return net > 0 ? ((net - unitCost(db, p.id)) / net) * 100 : 0
}

// -------------------------------------------------------------------- stock
export interface ProductStock {
  productId: string
  product: Product
  /** non-expired qty */
  onHand: number
  expiredQty: number
  /** sellable qty expiring within settings.nearExpiryDays (incl. today) */
  expiringQty: number
  /** FIFO order (expiry asc, mfg asc), only batches with qty > 0 */
  batches: Batch[]
}

export const fifoCompare = (a: Batch, b: Batch) =>
  a.expiryDate.localeCompare(b.expiryDate) || a.mfgDate.localeCompare(b.mfgDate)

export function branchBatches(db: DbState, branchId: string, productId?: string): Batch[] {
  return db.batches
    .filter((b) => b.branchId === branchId && b.qtyRemaining > 0 && (!productId || b.productId === productId))
    .sort(fifoCompare)
}

/** Stock per product (active products always listed; inactive only if they hold stock). */
export function getBranchStock(db: DbState, branchId: string, today: ISODate = todayISO()): ProductStock[] {
  const limit = addDaysISO(today, db.settings.nearExpiryDays)
  const byProduct = new Map<string, Batch[]>()
  for (const b of db.batches) {
    if (b.branchId !== branchId || b.qtyRemaining <= 0) continue
    const list = byProduct.get(b.productId)
    if (list) list.push(b)
    else byProduct.set(b.productId, [b])
  }
  const out: ProductStock[] = []
  for (const product of db.products) {
    const batches = (byProduct.get(product.id) ?? []).sort(fifoCompare)
    if (!product.active && batches.length === 0) continue
    let onHand = 0, expiredQty = 0, expiringQty = 0
    for (const b of batches) {
      if (b.expiryDate < today) expiredQty += b.qtyRemaining
      else {
        onHand += b.qtyRemaining
        if (b.expiryDate <= limit) expiringQty += b.qtyRemaining
      }
    }
    out.push({ productId: product.id, product, onHand, expiredQty, expiringQty, batches })
  }
  return out
}

/** Sellable (non-expired) qty of one product at a branch. */
export function availableQty(db: DbState, branchId: string, productId: string, today: ISODate = todayISO()): number {
  let n = 0
  for (const b of db.batches) {
    if (b.branchId === branchId && b.productId === productId && b.expiryDate >= today) n += b.qtyRemaining
  }
  return n
}

export function expiredBatches(db: DbState, branchId: string, today: ISODate = todayISO()): Batch[] {
  return db.batches.filter((b) => b.branchId === branchId && b.qtyRemaining > 0 && b.expiryDate < today).sort(fifoCompare)
}

// ---------------------------------------------------------------- day close
export function getDayClose(db: DbState, branchId: string, date: ISODate): DayClose | undefined {
  return db.dayCloses.find((d) => d.branchId === branchId && d.date === date)
}

export function isDayClosed(db: DbState, branchId: string, date: ISODate): boolean {
  return !!getDayClose(db, branchId, date)
}

export interface DayCloseSummary {
  branchId: string
  date: ISODate
  openingFloat: number
  cashSales: number
  upiSales: number
  cardSales: number
  totalSales: number
  cashExpenses: number
  expectedCash: number
  wastageValue: number
  wastageQty: number
  billsCount: number
  closed?: DayClose
}

export function getDayCloseSummary(db: DbState, branchId: string, date: ISODate): DayCloseSummary {
  const branch = db.branches.find((b) => b.id === branchId)
  if (!branch) throw new Error('Unknown branch')
  const sd = getSalesDay(db, branchId, date)
  const cashSales = sd?.byPayment.cash ?? 0
  const upiSales = sd?.byPayment.upi ?? 0
  const cardSales = sd?.byPayment.card ?? 0
  const cashExpenses = round2(
    db.expenses.filter((e) => e.branchId === branchId && e.date === date).reduce((s, e) => s + e.amount, 0),
  )
  const w = db.wastage.filter((x) => x.branchId === branchId && x.date === date)
  const closed = getDayClose(db, branchId, date)
  return {
    branchId,
    date,
    openingFloat: closed?.openingFloat ?? branch.openingFloat,
    cashSales,
    upiSales,
    cardSales,
    totalSales: cashSales + upiSales + cardSales,
    cashExpenses,
    expectedCash: round2((closed?.openingFloat ?? branch.openingFloat) + cashSales - cashExpenses),
    wastageValue: round2(w.reduce((s, x) => s + x.valueAtMRP, 0)),
    wastageQty: w.reduce((s, x) => s + x.qty, 0),
    billsCount: sd?.bills ?? 0,
    closed,
  }
}

// ------------------------------------------------------------------- indent
/** Cutoff moment for an indent: settings.indentCutoffTime on the day BEFORE delivery. */
export function indentCutoff(settings: Settings, deliveryDate: ISODate): Date {
  return atTime(addDaysISO(deliveryDate, -1), settings.indentCutoffTime)
}

export function isPastCutoff(settings: Settings, deliveryDate: ISODate, now: Date = new Date()): boolean {
  return now.getTime() > indentCutoff(settings, deliveryDate).getTime()
}

export function getIndent(db: DbState, branchId: string, deliveryDate: ISODate): Indent | undefined {
  return db.indents.find((i) => i.branchId === branchId && i.deliveryDate === deliveryDate)
}

export interface IndentSuggestion {
  productId: string
  /** average qty sold on the same weekday over the last 4 weeks */
  avg: number
  /** stock still sellable on deliveryDate */
  stock: number
  suggested: number
}

/** round_up(avg same-weekday sales (4 wks) × 1.05 − stock sellable on deliveryDate), min 0. */
export function suggestIndent(db: DbState, branchId: string, deliveryDate: ISODate): IndentSuggestion[] {
  const days: SalesDay[] = []
  for (let w = 1; w <= 4; w++) {
    const sd = getSalesDay(db, branchId, addDaysISO(deliveryDate, -7 * w))
    if (sd) days.push(sd)
  }
  const stockByProduct = new Map<string, number>()
  for (const b of db.batches) {
    if (b.branchId === branchId && b.expiryDate >= deliveryDate && b.qtyRemaining > 0) {
      stockByProduct.set(b.productId, (stockByProduct.get(b.productId) ?? 0) + b.qtyRemaining)
    }
  }
  return db.products
    .filter((p) => p.active)
    .map((p) => {
      const total = days.reduce((s, d) => s + (d.byProduct[p.id]?.[0] ?? 0), 0)
      const avg = days.length ? total / days.length : 0
      const stock = stockByProduct.get(p.id) ?? 0
      return {
        productId: p.id,
        avg: Math.round(avg * 10) / 10,
        stock,
        suggested: Math.max(0, Math.ceil(avg * 1.05 - stock)),
      }
    })
}

// --------------------------------------------------------------- production
export interface MaterialRequirement {
  rawMaterialId: string
  name: string
  unit: RawMaterial['unit']
  required: number
  inStock: number
  shortfall: number
}

/** Raw-material need for a list of {productId, qty}. */
export function requirementFor(db: DbState, items: { productId: string; qty: number }[]): MaterialRequirement[] {
  const need = new Map<string, number>()
  const recipes = new Map(db.recipes.map((r) => [r.productId, r]))
  for (const it of items) {
    const r = recipes.get(it.productId)
    if (!r || it.qty <= 0) continue
    for (const ing of r.ingredients) {
      need.set(ing.rawMaterialId, (need.get(ing.rawMaterialId) ?? 0) + (it.qty / r.yieldQty) * ing.qty)
    }
  }
  const rm = rawMaterialMap(db)
  return [...need.entries()]
    .map(([id, required]) => {
      const m = rm.get(id)
      const inStock = m?.stockQty ?? 0
      return {
        rawMaterialId: id,
        name: m?.name ?? id,
        unit: m?.unit ?? 'kg',
        required: Math.round(required * 1000) / 1000,
        inStock,
        shortfall: Math.max(0, Math.round((required - inStock) * 1000) / 1000),
      } satisfies MaterialRequirement
    })
    .sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name))
}

export function getMaterialRequirement(db: DbState, planId: string): MaterialRequirement[] {
  const plan = db.productionPlans.find((p) => p.id === planId)
  if (!plan) throw new Error('Production plan not found')
  return requirementFor(db, plan.lines.map((l) => ({ productId: l.productId, qty: l.plannedQty })))
}

export interface AllocationRow {
  branchId: string
  productId: string
  indentQty: number
  allocatedQty: number
}

/** Branch × product allocation: indent qty, or pro-rata (floor + remainder to largest indents) when short. */
export function proposeAllocation(db: DbState, planId: string): AllocationRow[] {
  const plan = db.productionPlans.find((p) => p.id === planId)
  if (!plan) throw new Error('Production plan not found')
  const indents = db.indents.filter((i) => i.deliveryDate === plan.date && (i.status === 'in_production' || i.status === 'dispatched' || i.status === 'received'))
  const rows: AllocationRow[] = []
  for (const line of plan.lines) {
    const produced = line.producedQty ?? line.plannedQty
    const asks = indents
      .map((i) => ({ branchId: i.branchId, qty: i.lines.find((l) => l.productId === line.productId)?.qty ?? 0 }))
      .filter((a) => a.qty > 0)
    const total = asks.reduce((s, a) => s + a.qty, 0)
    if (total === 0) continue
    if (produced >= total) {
      for (const a of asks) rows.push({ branchId: a.branchId, productId: line.productId, indentQty: a.qty, allocatedQty: a.qty })
      continue
    }
    const alloc = asks.map((a) => ({ ...a, got: Math.floor((a.qty * produced) / total) }))
    let rest = produced - alloc.reduce((s, a) => s + a.got, 0)
    const order = [...alloc].sort((x, y) => y.qty - x.qty)
    for (let i = 0; rest > 0 && order.length; i = (i + 1) % order.length) {
      const target = order[i]
      if (!target) break
      target.got += 1
      rest -= 1
    }
    for (const a of alloc) rows.push({ branchId: a.branchId, productId: line.productId, indentQty: a.qty, allocatedQty: a.got })
  }
  return rows
}

// ----------------------------------------------------------------- dispatch
export interface DispatchVariance {
  productId: string
  dispatched: number
  received: number
  damaged: number
  short: number
}

export function dispatchVarianceLines(d: Dispatch): DispatchVariance[] {
  return d.lines.map((l) => {
    const received = l.qtyReceived ?? 0
    const damaged = l.qtyDamaged ?? 0
    return {
      productId: l.productId,
      dispatched: l.qtyDispatched,
      received,
      damaged,
      short: d.status === 'received' ? Math.max(0, l.qtyDispatched - received - damaged) : 0,
    }
  })
}

// ----------------------------------------------------------------- purchase
export interface ReorderGroup {
  supplierId: string | null
  supplierName: string
  supplier?: Supplier
  lines: { rawMaterialId: string; name: string; unit: RawMaterial['unit']; stockQty: number; reorderLevel: number; qty: number; rate: number }[]
}

/** Materials below reorder level, grouped by preferred supplier (prefill for "Create PO"). */
export function getReorderSuggestions(db: DbState): ReorderGroup[] {
  const groups = new Map<string, ReorderGroup>()
  const sup = supplierMap(db)
  for (const m of db.rawMaterials) {
    if (m.stockQty >= m.reorderLevel) continue
    const key = m.preferredSupplierId ?? '__none__'
    let g = groups.get(key)
    if (!g) {
      const s = m.preferredSupplierId ? sup.get(m.preferredSupplierId) : undefined
      g = { supplierId: s?.id ?? null, supplierName: s?.name ?? 'No preferred supplier', supplier: s, lines: [] }
      groups.set(key, g)
    }
    g.lines.push({
      rawMaterialId: m.id, name: m.name, unit: m.unit, stockQty: m.stockQty,
      reorderLevel: m.reorderLevel, qty: m.reorderQty || Math.max(1, m.reorderLevel * 2 - m.stockQty), rate: m.costPerUnit,
    })
  }
  return [...groups.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName))
}

export type RMStatus = 'ok' | 'low' | 'out'
export function rawMaterialStatus(m: RawMaterial): RMStatus {
  if (m.stockQty <= 0) return 'out'
  return m.stockQty < m.reorderLevel ? 'low' : 'ok'
}

/** Open (sent / partially received) PO quantity outstanding for a raw material. */
export function onOrderQty(db: DbState, rawMaterialId: string): number {
  let n = 0
  for (const po of db.purchaseOrders) {
    if (po.status !== 'sent' && po.status !== 'partially_received') continue
    for (const l of po.lines) if (l.rawMaterialId === rawMaterialId) n += Math.max(0, l.qty - l.receivedQty)
  }
  return n
}
