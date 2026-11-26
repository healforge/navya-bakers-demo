/** Navya Bakers ERP — domain model. Dates are local 'YYYY-MM-DD'; timestamps are ISO strings; money is ₹. */

export type ISODate = string
export type ISODateTime = string

export type Role = 'branch' | 'ho' | 'cxo'

export interface Branch {
  id: string
  code: string
  name: string
  area: string
  city: string
  address: string
  phone: string
  managerName: string
  openingFloat: number
  active: boolean
}

export interface User {
  id: string
  name: string
  username: string
  role: Role
  branchId?: string
  /** null = demo account, no password required */
  passwordHash: string | null
  active: boolean
}

export const PRODUCT_CATEGORIES = [
  'Breads',
  'Puffs & Snacks',
  'Cakes',
  'Pastries',
  'Cookies & Rusk',
  'Sweets',
  'Chips & Savouries',
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export type GstRate = 0 | 5 | 12 | 18

export interface Product {
  id: string
  sku: string
  name: string
  category: ProductCategory
  /** MRP incl. GST */
  price: number
  gstRate: GstRate
  shelfLifeDays: number
  active: boolean
  /** tile accent colour */
  color?: string
}

export interface PriceOverride {
  branchId: string
  productId: string
  price: number
}

export type RawMaterialUnit = 'kg' | 'l' | 'pcs' | 'dozen' | 'pack'

export interface RawMaterial {
  id: string
  code: string
  name: string
  unit: RawMaterialUnit
  costPerUnit: number
  stockQty: number
  reorderLevel: number
  reorderQty: number
  preferredSupplierId?: string
}

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  city: string
  gstin?: string
  materialIds: string[]
  active: boolean
}

export interface RecipeIngredient {
  rawMaterialId: string
  qty: number
}

export interface Recipe {
  productId: string
  /** units per batch */
  yieldQty: number
  ingredients: RecipeIngredient[]
}

export interface Batch {
  id: string
  branchId: string
  productId: string
  dispatchId?: string
  mfgDate: ISODate
  /** last sellable day = mfgDate + shelfLifeDays - 1 */
  expiryDate: ISODate
  qtyReceived: number
  qtyRemaining: number
}

export interface BillLine {
  productId: string
  name: string
  qty: number
  price: number
  gstRate: GstRate
  amount: number
}

export type PaymentMode = 'cash' | 'upi' | 'card'

export interface Bill {
  id: string
  /** e.g. EDP-261126-0042 */
  number: string
  branchId: string
  date: ISODate
  createdAt: ISODateTime
  cashierId: string
  lines: BillLine[]
  total: number
  gstAmount: number
  paymentMode: PaymentMode
  tendered?: number
  change?: number
}

export interface PaymentSplit {
  cash: number
  upi: number
  card: number
}

/** Aggregates — analytics read ONLY these (history has no bill detail). */
export interface SalesDay {
  branchId: string
  date: ISODate
  bills: number
  total: number
  gst: number
  /** productId → [qty, amount] */
  byProduct: Record<string, [qty: number, amount: number]>
  /** 24 entries, ₹ amount */
  byHour: number[]
  byPayment: PaymentSplit
}

export const WASTAGE_REASONS = ['Expired', 'Damaged', 'Quality issue', 'Transit damage', 'Other'] as const
export type WastageReason = (typeof WASTAGE_REASONS)[number]

export interface WastageEntry {
  id: string
  branchId: string
  date: ISODate
  createdAt: ISODateTime
  productId: string
  batchId?: string
  qty: number
  valueAtMRP: number
  valueAtCost: number
  reason: WastageReason
  note?: string
  userId?: string
}

export type IndentStatus = 'draft' | 'submitted' | 'in_production' | 'dispatched' | 'received'

export interface IndentLine {
  productId: string
  suggestedQty: number
  qty: number
}

export interface Indent {
  id: string
  number: string
  branchId: string
  deliveryDate: ISODate
  status: IndentStatus
  lines: IndentLine[]
  note?: string
  createdAt: ISODateTime
  submittedAt?: ISODateTime
  submittedBy?: string
  /** true when submitted after the cutoff (day before delivery, settings.indentCutoffTime) */
  late?: boolean
}

export type PlanStatus = 'draft' | 'confirmed' | 'completed'

export interface PlanLine {
  productId: string
  indentQty: number
  plannedQty: number
  producedQty?: number
}

export interface ProductionPlan {
  id: string
  number: string
  /** = delivery date */
  date: ISODate
  status: PlanStatus
  lines: PlanLine[]
  createdAt: ISODateTime
  confirmedAt?: ISODateTime
  completedAt?: ISODateTime
}

export type DispatchStatus = 'in_transit' | 'received'

export interface DispatchLine {
  productId: string
  qtyDispatched: number
  qtyReceived?: number
  qtyDamaged?: number
  note?: string
}

export interface Dispatch {
  id: string
  /** DN-0123 */
  number: string
  branchId: string
  date: ISODate
  planId?: string
  indentId?: string
  status: DispatchStatus
  vehicle?: string
  dispatchedAt: ISODateTime
  lines: DispatchLine[]
  receivedAt?: ISODateTime
  receivedBy?: string
}

export type POStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled'

export interface POLine {
  rawMaterialId: string
  qty: number
  rate: number
  receivedQty: number
}

export interface PurchaseOrder {
  id: string
  /** PO-0021 */
  number: string
  supplierId: string
  date: ISODate
  expectedDate: ISODate
  status: POStatus
  lines: POLine[]
  note?: string
  createdAt: ISODateTime
}

export interface GRNLine {
  rawMaterialId: string
  qty: number
  rate: number
}

export interface GRN {
  id: string
  number: string
  poId: string
  date: ISODate
  createdAt: ISODateTime
  lines: GRNLine[]
}

export type RMMovementType = 'grn' | 'production' | 'adjustment'

export interface RMMovement {
  id: string
  rawMaterialId: string
  date: ISODate
  createdAt: ISODateTime
  type: RMMovementType
  /** +in / -out */
  qty: number
  refId?: string
  note?: string
}

export const EXPENSE_CATEGORIES = ['Cleaning', 'Transport', 'Repairs', 'Staff welfare', 'Stationery', 'Misc'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: string
  branchId: string
  date: ISODate
  createdAt: ISODateTime
  category: ExpenseCategory
  amount: number
  note?: string
}

export interface DayClose {
  id: string
  branchId: string
  date: ISODate
  openingFloat: number
  cashSales: number
  upiSales: number
  cardSales: number
  cashExpenses: number
  /** = openingFloat + cashSales - cashExpenses */
  expectedCash: number
  countedCash: number
  denominations?: Record<string, number>
  /** counted - expected */
  variance: number
  notes?: string
  closedBy: string
  closedAt: ISODateTime
}

export interface Settings {
  companyName: string
  /** 'HH:mm', e.g. '20:00' */
  indentCutoffTime: string
  nearExpiryDays: number
  wastageAlertPct: number
  salesDropAlertPct: number
  cashVarianceAlert: number
  transitAlertHours: number
}

export type CounterKey = 'indent' | 'plan' | 'dispatch' | 'po' | 'grn'

export interface DbState {
  version: 1
  seededAt: ISODateTime
  anchorDate: ISODate
  settings: Settings
  branches: Branch[]
  users: User[]
  products: Product[]
  priceOverrides: PriceOverride[]
  rawMaterials: RawMaterial[]
  suppliers: Supplier[]
  recipes: Recipe[]
  batches: Batch[]
  bills: Bill[]
  /** key = `${branchId}|${date}` */
  salesDays: Record<string, SalesDay>
  wastage: WastageEntry[]
  indents: Indent[]
  productionPlans: ProductionPlan[]
  dispatches: Dispatch[]
  purchaseOrders: PurchaseOrder[]
  grns: GRN[]
  rmMovements: RMMovement[]
  expenses: Expense[]
  dayCloses: DayClose[]
  counters: Record<CounterKey, number>
}
