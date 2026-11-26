# Foundation API (for module developers)

Gate: `pnpm typecheck && pnpm test && pnpm build`. Source of truth is the code — this is a map.

## Stack quirks
- TypeScript 7, Vite 8, react-router 8 (`import … from 'react-router'`), vitest 5, zod 4, @tanstack/react-table v8.
- shadcn style **radix-nova** (Radix primitives, `asChild` works). Default `Button` is compact (h-8) — use `className="h-11"` for touch targets. **No shadcn `form` component** — use `field` or `Label`+`Input` with react-hook-form.
- Never import `next-themes` or `from "cn"` — use `@/components/theme/ThemeProvider` (`useTheme`) and `@/lib/utils`.
- State objects must never be mutated in UI code; copy before sorting (`[...arr].sort`).

## Store — `@/store/db`
- `useDb(selector)` — selector must return a stable reference (slice or primitive). For derived data: `const db = useDb(d => d)` then `useMemo`, or `useDbShallow(selector)`.
- `useDbShallow(selector)`, `getDb()`, `useDbStore` (state is `{ db }`), `useDbActions()` / `dbActions` (stable).
- All actions throw `Error` with a readable message and leave state untouched → wrap in try/catch + `toast.error(e.message)` (sonner).
- Input types exported from `@/store/ops`: `ProductInput, BranchInput, UserInput, RawMaterialInput, SupplierInput, POInput, CreateBillInput, RecordWastageInput, SaveIndentInput, ReceiveLineInput, CloseDayInput`.

### Actions (`dbActions`)
| Area | Signature |
|---|---|
| Masters | `upsertProduct(ProductInput): id` · `setProductActive(id, active)` · `upsertBranch(BranchInput): id` · `upsertUser(UserInput): id` · `setUserPassword(userId, plain \| null): Promise<void>` (min 4 chars; null = demo account) · `setPriceOverride({branchId, productId, price})` · `removePriceOverride(branchId, productId)` · `upsertRawMaterial(RawMaterialInput): id` · `adjustRawMaterialStock(id, newQty, note?)` · `upsertSupplier(SupplierInput): id` · `upsertRecipe(Recipe)` · `updateSettings(Partial<Settings>)` |
| POS | `createBill({branchId, cashierId, lines: {productId, qty}[], paymentMode, tendered?}): Bill` |
| Stock | `recordWastage({branchId, productId, qty, reason, batchId?, note?, userId?}): WastageEntry[]` · `writeOffExpired(branchId, userId?): WastageEntry[]` (throws if none) |
| Indent | `saveIndent({id?, branchId, deliveryDate, lines: {productId, qty, suggestedQty?}[], note?}): id` (upserts by branch+date; deliveryDate > today; draft/submitted only) · `submitIndent(id, userId)` (sets `late`) |
| Production | `generateProductionPlan(date): id` · `updatePlanLine(planId, productId, plannedQty)` · `confirmPlan(planId)` · `reconsolidatePlan(planId): number` · `completeProduction(planId, producedQtys: Record<productId, number>, opts?: {force?})` (blocks on RM shortfall unless force) |
| Dispatch | `createDispatches(planId, allocations: {branchId, productId, allocatedQty}[], vehicle?): id[]` · `createAdhocDispatch(branchId, lines: {productId, qty}[], vehicle?): id` · `receiveDispatch(dispatchId, lines: {productId, qtyReceived, qtyDamaged, note?}[], userId)` (every dispatch line needs an input line) |
| Purchase | `createPO({supplierId, expectedDate, lines: {rawMaterialId, qty, rate}[], note?}): id` · `updatePO(id, POInput)` · `sendPO(id)` · `cancelPO(id)` · `receiveGRN(poId, lines: {rawMaterialId, qty, rate?}[]): GRN` |
| Day end | `addExpense({branchId, category, amount, note?}): Expense` · `deleteExpense(id)` · `closeDay({branchId, date, countedCash, denominations?, notes?, userId}): DayClose` · `reopenDay(branchId, date)` |
| Demo | `resetDemoData()` |

## Selectors — `@/store/selectors` (pure `(db, …)`, use inside `useMemo`)
- Price/tax: `gstAmount(lines)`, `gstOf(amount, rate)`, `netPrice(product)`, `effectivePrice(db, branchId, productId)`
- Lookups: `productMap / branchMap / rawMaterialMap / supplierMap / userMap (db): Map`, `productName(db, id)`, `branchName(db, id)`, `getSalesDay(db, branchId, date)`, `salesDayKey(branchId, date)`
- Cost: `unitCost(db, productId)`, `unitCostMap(db)` (memoised), `productMarginPct(db, product)`
- Stock: `getBranchStock(db, branchId, today?): ProductStock[]` (`{productId, product, onHand, expiredQty, expiringQty, batches}` FIFO) · `availableQty(db, branchId, productId, today?)` · `branchBatches(db, branchId, productId?)` · `expiredBatches(db, branchId, today?)`
- Day close: `getDayClose`, `isDayClosed(db, branchId, date)`, `getDayCloseSummary(db, branchId, date)` → `{openingFloat, cashSales, upiSales, cardSales, totalSales, cashExpenses, expectedCash, wastageValue, wastageQty, billsCount, closed?}`
- Indent: `indentCutoff(settings, deliveryDate): Date`, `isPastCutoff(settings, deliveryDate, now?)`, `getIndent(db, branchId, deliveryDate)`, `suggestIndent(db, branchId, deliveryDate): {productId, avg, stock, suggested}[]`
- Production/dispatch: `getMaterialRequirement(db, planId)` / `requirementFor(db, lines)` → `{rawMaterialId, name, unit, required, inStock, shortfall}[]` · `proposeAllocation(db, planId): {branchId, productId, indentQty, allocatedQty}[]` · `dispatchVarianceLines(dispatch)`
- Purchase: `getReorderSuggestions(db)` (grouped by supplier, with prefill lines) · `rawMaterialStatus(m): 'ok'|'low'|'out'` · `onOrderQty(db, rawMaterialId)`

## Analytics — `@/store/analytics` (`DateRange = {from, to}` inclusive; `branchIds` empty = all active)
`totalsFor`, `salesSummary` (current, previous, deltas — margin/wastage deltas in pp), `dailySeries` (+ma7, perBranch), `wastageSeries`, `branchLeaderboard`, `categoryMix`, `productPerformance`, `hourlyHeatmap` (`{cells: {weekday 0=Sun, hour, value}[], max}`), `paymentMix`, `wastageByReason`, `dispatchVariance(db, days, to?)`, `indentFillRate`.
Date helpers in `@/lib/dates`: `presetRange`, `previousRange`, `RANGE_PRESETS`, `todayISO`, `addDaysISO`, `isoRange`.

## Alerts — `@/store/alerts`
`computeAlerts(db, now = new Date()): Alert[]` sorted critical → warning → info. `Alert = {id, severity, type, title, detail, branchId?, link?}`; links are hash paths like `/cxo/branches/b-kkd`, `/ho/raw-materials`, `/ho/dispatch`. Use `useMemo(() => computeAlerts(db), [db])`.

## Auth — `@/auth/session`
`useCurrentUser()`, `useRequireUser()`, `useCurrentBranch()` (branch role scoping), `session.login/logout`, `ROLE_HOME`, `ROLE_LABEL`.

## Common components — `@/components/common`
`PageHeader {title, description?, actions?}` · `KpiCard {label, value: string, delta?, deltaLabel?, goodWhen?: 'up'|'down', sparkline?, icon?}` + `Sparkline {data}` · `StatusBadge {status, label?}` · `EmptyState {icon?, title, description?, action?}` · `DataTable<T> {columns, data, searchable?, searchPlaceholder?, pageSize?, initialSorting?, onRowClick?, getRowId?, emptyTitle?, toolbar?}` · `Money {value, compact?, decimals?}` · `DateRangeSelect {value, onChange}` + `useDateRange(initial='last7') → {preset, setPreset, range}` · `BranchSelect` (single `{value, onChange, allowAll?}` with `ALL_BRANCHES`; multi `{mode:'multi', value: string[], onChange}`) · `ConfirmDialog {open, onOpenChange, title, description?, confirmLabel?, destructive?, onConfirm}` · `PrintArea {size: '80mm'|'A4', children}` + `printNow()` (`.no-print` hides chrome).
Formatting `@/lib/format`: `formatINR, formatINRCompact, formatNumber, formatQty, formatPct, formatDelta, formatDate, formatDateShort, formatDateTime, formatTime, round2`. CSV: `downloadCSV(filename, headers, rows)`. Charts: `@/components/ui/chart`, colours `var(--chart-1..5)`.

## Routes & nav
- `src/routes/{branch,ho,cxo}Routes.tsx` export `RouteObject[]` with RELATIVE paths, mounted under `/branch`, `/ho`, `/cxo` inside `RequireRole` + `AppShell`.
- Pages: one default-export file per page in `src/features/<module>/pages/`. Replace placeholders by overwriting; add sub-routes in the module's route file.
- Nav: `src/components/layout/navConfig.ts` (`NAV[role]`, `pageTitleFor`).

## Seed ids
Branches `b-edp, b-kkd, b-vyt, b-tsr, b-cky` · users `u-edp … u-cky, u-ho, u-prod, u-ceo` · products `p-<slug>` · suppliers `s-*` · raw materials `rm-*`. Only today has bill detail; history is `salesDays` aggregates.
