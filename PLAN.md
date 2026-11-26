# Navya Bakers ERP — Demo App Plan

Frontend-only demo ERP for **Navya Bakers**, a bakery chain with a central kitchen supplying 5 branches across Kochi & Thrissur. No backend, no APIs — all data lives in the browser (localStorage). Installable PWA, works fully offline. Hosted on GitHub Pages.

---

## 1. Decisions (from user interview)

| Topic | Decision |
|---|---|
| Ops model | Central kitchen (Angamaly) → 5 branches. Branches send daily **indents**; HO consolidates → production → dispatch. |
| Branch modules | POS billing, Indent & stock receipt, Wastage & day-end closing. **No** custom cake orders. |
| HO modules | Masters (products, prices, branches, users), Indents → production → dispatch, Raw materials + purchase + suppliers, Recipes/BOM & costing. **No** indent approval/edit step by HO (indents flow straight into production). |
| CXO modules | Sales & revenue trends, Branch leaderboard & comparison, Wastage/margin/product analytics, Exceptions & alerts. |
| POS extras | 80mm thermal receipt print + reprint. **No** discounts/voids, **no** hold/resume, **no** customer phone. |
| Tax | MRP is tax-inclusive. Each product has a GST % field. Receipt shows a single back-calculated "Incl. GST ₹X" line. |
| Stock | Batch + expiry tracking, FIFO (oldest expiry first) on sale & wastage. |
| Extras | Auto-suggested indent from sales history; receipt variance on dispatch (short / damaged). **No** audit log. |
| Login | Login page with clickable demo-user cards + a username/password form. (See §6 — no hardcoded passwords.) |
| Seed | 5 branches, 90 days of history, "Reset demo data" button. |
| Locale | Kochi / Thrissur area. English only. INR (en-IN grouping, lakhs/crores). |
| Devices | Branch screens touch-first (tablet/mobile). HO & CXO desktop-first (CXO also good on phone). |
| Theme | Warm bakery theme (cream / chocolate-brown / saffron) + dark mode toggle. |
| Hosting | GitHub Pages under a subpath → `HashRouter`, configurable Vite `base`, GH Actions deploy workflow. |
| Package manager | pnpm |

---

## 2. Tech stack

- **Vite + React 19 + TypeScript** (strict) — `pnpm create vite` `react-ts` template
- **Tailwind CSS v4** (`@tailwindcss/vite`) + **shadcn/ui** (latest CLI), `lucide-react` icons
- **react-router** v7 — `createHashRouter` (GitHub Pages friendly)
- **zustand** — app state; custom localStorage persistence (see §5.1)
- **date-fns** — dates
- **recharts** via shadcn `chart` component
- **@tanstack/react-table** — dense HO tables (shadcn data-table pattern)
- **react-hook-form + zod + @hookform/resolvers** — master-data forms
- **sonner** — toasts
- **vite-plugin-pwa** (+ `@vite-pwa/assets-generator` for icons) — installable, offline precache
- **@fontsource-variable/inter** (body) + **@fontsource-variable/fraunces** (headings / wordmark) — bundled so they work offline
- **vitest** — unit tests for domain logic & seed generator

pnpm v10 blocks dependency build scripts by default — allow `esbuild` (and anything else needed) via `pnpm.onlyBuiltDependencies` / `pnpm approve-builds`.

### shadcn components to add up front
`button card input label select dialog sheet drawer tabs table badge dropdown-menu avatar separator tooltip popover calendar command form textarea switch checkbox radio-group toggle-group scroll-area skeleton sonner alert alert-dialog progress chart sidebar breadcrumb pagination accordion collapsible hover-card`

---

## 3. Project structure

```
src/
  main.tsx                  # mounts app, theme provider, PWA register
  App.tsx                   # router (createHashRouter), composes role route files
  index.css                 # tailwind + theme tokens (light/dark) + print styles
  lib/
    utils.ts                # shadcn cn()
    format.ts               # formatINR, formatINRCompact (₹1.2L / ₹3.4Cr), formatQty, formatDate…
    dates.ts                # todayISO(), addDaysISO(), isoRange(), weekday helpers (all 'YYYY-MM-DD' local)
    prng.ts                 # mulberry32 seeded PRNG + helpers (randInt, pick, normal-ish)
    csv.ts                  # toCSV + downloadCSV
    ids.ts                  # uid() (crypto.randomUUID), doc-number formatter
  types/domain.ts           # all domain types (§4)
  data/
    catalog.ts              # branches, products, categories, raw materials, recipes, suppliers, users
    generateSeed.ts         # deterministic 90-day history generator (§7)
  store/
    db.ts                   # zustand store: state + ALL domain actions (§5)
    persistence.ts          # load/save/quota handling/cross-tab sync
    selectors.ts            # stock, effective price, unit cost, indent suggestion, allocation…
    analytics.ts            # pure functions for KPIs / series / leaderboards (§8)
    alerts.ts               # computeAlerts(state, now) (§8.2)
    *.test.ts               # vitest
  auth/
    session.ts              # session store (sessionStorage per tab + localStorage last-user)
    RequireRole.tsx         # route guard
  components/
    ui/                     # shadcn (generated)
    layout/                 # AppShell, AppSidebar, MobileBottomNav (branch), Topbar, UserMenu, Logo
    common/                 # PageHeader, KpiCard, StatusBadge, EmptyState, DataTable, Money,
                            # DateRangeSelect, BranchSelect, ConfirmDialog, PrintArea, StaleSeedBanner
    pwa/                    # InstallButton, UpdatePrompt
  features/
    auth/LoginPage.tsx
    branch/…                # Branch module (owned by Branch agent)
    ho/…                    # Head-office module (owned by HO agent)
    cxo/…                   # CXO module (owned by CXO agent)
  routes/
    branchRoutes.tsx        # each module agent owns exactly one of these
    hoRoutes.tsx
    cxoRoutes.tsx
public/
  logo.svg, favicon, pwa icons (generated)
.github/workflows/deploy.yml
```

---

## 4. Domain model (`src/types/domain.ts`)

All dates are local `YYYY-MM-DD` strings (`ISODate`); timestamps are ISO strings. Money is in rupees (number, 2-dp where needed). Quantities are integers (all products sold per piece/pack; cakes as fixed-weight units e.g. "Black Forest Cake 500g").

```ts
type Role = 'branch' | 'ho' | 'cxo';

interface Branch { id; code /*e.g. EDP*/; name; area; city; address; phone; managerName;
  openingFloat /*cash float, ₹*/; active: boolean; }

interface User { id; name; username; role: Role; branchId?: string;
  passwordHash: string | null /* null = demo account, no password required */; active: boolean; }

type ProductCategory = 'Breads' | 'Puffs & Snacks' | 'Cakes' | 'Pastries' | 'Cookies & Rusk' | 'Sweets' | 'Chips & Savouries';

interface Product { id; sku; name; category: ProductCategory; price /*MRP incl. GST*/;
  gstRate: 0 | 5 | 12 | 18; shelfLifeDays: number; active: boolean; color?: string /*tile accent*/; }

interface PriceOverride { branchId; productId; price; }

interface RawMaterial { id; code; name; unit: 'kg' | 'l' | 'pcs' | 'dozen' | 'pack';
  costPerUnit; stockQty; reorderLevel; reorderQty; preferredSupplierId?: string; }

interface Supplier { id; name; contactPerson; phone; city; gstin?: string; materialIds: string[]; active: boolean; }

interface Recipe { productId; yieldQty /*units per batch*/; ingredients: { rawMaterialId; qty }[]; }

interface Batch { id; branchId; productId; dispatchId?: string; mfgDate: ISODate;
  expiryDate: ISODate /* last sellable day = mfgDate + shelfLifeDays - 1 */; qtyReceived; qtyRemaining; }

interface BillLine { productId; name; qty; price; gstRate; amount; }
type PaymentMode = 'cash' | 'upi' | 'card';
interface Bill { id; number /*EDP-261126-0042*/; branchId; date: ISODate; createdAt; cashierId;
  lines: BillLine[]; total; gstAmount; paymentMode: PaymentMode; tendered?: number; change?: number; }

// Aggregates — analytics read ONLY these (history has no bill detail)
interface SalesDay { branchId; date: ISODate; bills: number; total: number; gst: number;
  byProduct: Record<string /*productId*/, [qty: number, amount: number]>;
  byHour: number[] /*24 entries, ₹ amount*/; byPayment: { cash: number; upi: number; card: number }; }

type WastageReason = 'Expired' | 'Damaged' | 'Quality issue' | 'Transit damage' | 'Other';
interface WastageEntry { id; branchId; date; createdAt; productId; batchId?: string; qty;
  valueAtMRP; valueAtCost; reason: WastageReason; note?: string; userId?: string; }

type IndentStatus = 'draft' | 'submitted' | 'in_production' | 'dispatched' | 'received';
interface Indent { id; number; branchId; deliveryDate: ISODate; status: IndentStatus;
  lines: { productId; suggestedQty; qty }[]; note?: string; createdAt; submittedAt?; submittedBy?; }

type PlanStatus = 'draft' | 'confirmed' | 'completed';
interface ProductionPlan { id; number; date: ISODate /*= delivery date*/; status: PlanStatus;
  lines: { productId; indentQty; plannedQty; producedQty?: number }[];
  createdAt; confirmedAt?; completedAt?; }

type DispatchStatus = 'in_transit' | 'received';
interface Dispatch { id; number /*DN-0123*/; branchId; date: ISODate; planId?: string; indentId?: string;
  status: DispatchStatus; vehicle?: string; dispatchedAt;
  lines: { productId; qtyDispatched; qtyReceived?: number; qtyDamaged?: number; note?: string }[];
  receivedAt?; receivedBy?; }

type POStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
interface PurchaseOrder { id; number /*PO-0021*/; supplierId; date; expectedDate; status: POStatus;
  lines: { rawMaterialId; qty; rate; receivedQty: number }[]; note?: string; createdAt; }

interface GRN { id; number; poId; date; createdAt; lines: { rawMaterialId; qty; rate }[]; }

type RMMovementType = 'grn' | 'production' | 'adjustment';
interface RMMovement { id; rawMaterialId; date; createdAt; type: RMMovementType; qty /*+in / -out*/; refId?; note?; }

type ExpenseCategory = 'Cleaning' | 'Transport' | 'Repairs' | 'Staff welfare' | 'Stationery' | 'Misc';
interface Expense { id; branchId; date; createdAt; category: ExpenseCategory; amount; note?; }

interface DayClose { id; branchId; date; openingFloat; cashSales; upiSales; cardSales; cashExpenses;
  expectedCash /*= openingFloat + cashSales - cashExpenses*/; countedCash;
  denominations?: Record<string, number>; variance /*counted - expected*/; notes?; closedBy; closedAt; }

interface Settings { companyName; indentCutoffTime /*'20:00'*/; nearExpiryDays /*1*/;
  wastageAlertPct /*6*/; salesDropAlertPct /*15*/; cashVarianceAlert /*500*/; transitAlertHours /*4*/; }

interface DbState {
  version: 1; seededAt: string; anchorDate: ISODate;
  settings: Settings;
  branches: Branch[]; users: User[]; products: Product[]; priceOverrides: PriceOverride[];
  rawMaterials: RawMaterial[]; suppliers: Supplier[]; recipes: Recipe[];
  batches: Batch[]; bills: Bill[]; salesDays: Record<string /*`${branchId}|${date}`*/, SalesDay>;
  wastage: WastageEntry[]; indents: Indent[]; productionPlans: ProductionPlan[]; dispatches: Dispatch[];
  purchaseOrders: PurchaseOrder[]; grns: GRN[]; rmMovements: RMMovement[];
  expenses: Expense[]; dayCloses: DayClose[];
  counters: Record<'indent' | 'plan' | 'dispatch' | 'po' | 'grn', number>;
}
```

---

## 5. Store & business rules (`src/store/db.ts`)

### 5.1 Persistence
- One zustand store holds `DbState`. **Not** the zustand `persist` middleware (to avoid regenerating the seed on every load). Instead:
  - On startup: read `localStorage['navya-erp:db:v1']`. If missing / unparsable / wrong version → `generateSeed(new Date())`, save, use it.
  - `store.subscribe` → debounced save (300 ms) + flush on `visibilitychange`/`pagehide`.
  - Catch `QuotaExceededError` → sonner toast "Storage full — reset demo data".
  - Cross-tab sync: `window.addEventListener('storage')` on the db key → replace state. (Demo trick: Branch in one tab, HO in another, CXO in a third — changes flow live.)
- Target persisted size **< 2.5 MB** (asserted in a test).
- `resetDemoData()` regenerates the seed anchored at now.
- `StaleSeedBanner`: if `anchorDate < todayISO()` show "Demo data was generated on {date}. Refresh to today?" → reset.
- Transient UI state (POS cart etc.) is **never** in the db store.

### 5.2 Actions (all in the store; UI calls these, never mutates directly)
Every action validates input and throws `Error` with a user-readable message; UI catches and toasts.

**Masters:** `upsertProduct`, `setProductActive`, `upsertBranch`, `upsertUser`, `setUserPassword(userId, plain)` (stores salted SHA-256 hash via Web Crypto; async), `setPriceOverride`, `removePriceOverride`, `upsertRawMaterial`, `adjustRawMaterialStock(id, newQty, note)` (writes RMMovement), `upsertSupplier`, `upsertRecipe`, `updateSettings`.

**POS:** `createBill({ branchId, cashierId, lines: {productId, qty}[], paymentMode, tendered? })`
- Reject if the branch's day is closed for today, if cart empty, or if qty > available (non-expired) stock.
- Price = effective price (override ?? MRP). `gstAmount = Σ amount × r/(100+r)` (2 dp).
- Deduct stock FIFO by `expiryDate` asc then `mfgDate` asc, skipping expired batches.
- Number = `${branch.code}-${yyMMdd}-${seq4}` (seq per branch per day).
- Update `salesDays[branch|date]` (bills, total, gst, byProduct, byHour[hour], byPayment). Returns the Bill.

**Stock & wastage:**
- Selector `getBranchStock(state, branchId, today)` → per product: `onHand` (non-expired), `expiredQty`, `expiringQty` (expiry ≤ today + nearExpiryDays), batches list.
- `recordWastage({ branchId, productId, qty, reason, batchId?, note, userId })` — deduct from given batch or FIFO (expired batches first). Writes WastageEntry with value at MRP and at recipe cost.
- `writeOffExpired(branchId, userId)` — one wastage entry per expired batch, reason 'Expired'.

**Indent:**
- Selector `suggestIndent(state, branchId, deliveryDate)` → per active product: `round_up(avg qty sold on the same weekday over the last 4 weeks × 1.05 − stock still sellable on deliveryDate)`, min 0. Return the components too (avg, stock) for a tooltip.
- `saveIndent(draft)` (create/update while `draft`/`submitted`), `submitIndent(id, userId)`.
- An indent is editable by the branch until status becomes `in_production`. Cutoff = `settings.indentCutoffTime` on the day before delivery; after cutoff the branch can still submit but it's flagged "late".

**Production (HO):**
- `generateProductionPlan(date)` — consolidates all `submitted` indents for that delivery date; `indentQty` = sum, `plannedQty` = indentQty (editable). Error if a non-draft plan already exists for the date; regenerating a draft re-consolidates.
- Selector `getMaterialRequirement(state, planId)` → per raw material: required (Σ plannedQty/yield × ingredient qty), in stock, shortfall.
- `updatePlanLine`, `confirmPlan(planId)` → indents of that date → `in_production` (late indents submitted after confirm can be merged with a "re-consolidate" action while still `confirmed`).
- `completeProduction(planId, producedQtys)` → deduct raw materials per recipe (RMMovement type 'production'); stock may go negative only with a warning (demo-friendly) — **prefer blocking with clear shortfall message, with a "force" flag**.

**Dispatch (HO):**
- Selector `proposeAllocation(state, planId)` → per branch × product: indent qty; if produced < total indented, allocate pro-rata (floor), remainder to the largest indents.
- `createDispatches(planId, allocations, vehicle?)` → one Dispatch per branch (`in_transit`), indent → `dispatched`.
- Also `createAdhocDispatch(branchId, lines)` (top-up without indent).

**Receiving (Branch):**
- `receiveDispatch(dispatchId, lines: {productId, qtyReceived, qtyDamaged, note}[], userId)` — `qtyReceived` = good qty accepted; for each line create a Batch (mfgDate = dispatch date, expiry from shelf life) with `qtyReceived`; `qtyDamaged` > 0 → WastageEntry reason 'Transit damage'. Variance = `qtyDispatched − qtyReceived − qtyDamaged` (short). Dispatch → `received`, indent → `received`.

**Purchase (HO):**
- `createPO`, `updatePO` (draft only), `sendPO`, `cancelPO`.
- `receiveGRN(poId, lines)` → RM stock += qty, `costPerUnit` = last GRN rate, RMMovement 'grn', update PO receivedQty & status (partially_received / received).
- Selector `getReorderSuggestions` → materials with stockQty < reorderLevel, grouped by preferred supplier → "Create PO" prefill.

**Day end (Branch):**
- `addExpense`, `deleteExpense` (only while day open).
- Selector `getDayCloseSummary(state, branchId, date)` → opening float, cash/upi/card sales, cash expenses, expected cash, wastage today, bills count.
- `closeDay({ branchId, date, countedCash, denominations, notes, userId })` → DayClose; POS & expenses locked for that date.
- `reopenDay(branchId, date)` (demo convenience, confirm dialog).

**Demo:** `resetDemoData()`.

### 5.3 Costing
- `unitCost(productId)` = Σ(ingredient qty × RM costPerUnit) / yieldQty (memoised selector map).
- Net revenue = total − GST. Gross margin % = (net revenue − Σ qty × unitCost) / net revenue.
- Wastage % = wastage value at MRP ÷ (sales value + wastage value at MRP).

---

## 6. Auth & roles (mock)

- **No hardcoded passwords anywhere** (org security policy). Seeded demo users have `passwordHash: null` → they sign in with any password (or by clicking a demo card). HO can set a real password for any user in User management; it's stored as a salted SHA-256 hash in localStorage. The login page shows a small "Demo mode — not real security" note.
- Login page: Navya Bakers wordmark; grid of demo user cards grouped by role (5 branch managers, HO Admin, Production Manager, CEO) — click → instant sign-in; plus a username/password form.
- Session per tab in `sessionStorage` (so different tabs can be different roles), with `localStorage` "last user" fallback so an installed PWA reopens signed-in.
- Guards: `/branch/*` → role branch (scoped to own `branchId`); `/ho/*` → ho; `/cxo/*` → cxo. Root `/` redirects to role home or `/login`.

### Seeded users
| Name | Username | Role | Branch |
|---|---|---|---|
| Anjali Menon | `edappally` | branch | Edappally |
| Rahul Varghese | `kakkanad` | branch | Kakkanad |
| Fathima Nazar | `vyttila` | branch | Vyttila |
| Joseph Thomas | `thrissur` | branch | Thrissur Round |
| Sneha Pillai | `chalakudy` | branch | Chalakudy |
| Arun Krishnan | `hoadmin` | ho | — |
| Deepa Raghavan | `production` | ho | — |
| Navya Mathew | `ceo` | cxo | — |

---

## 7. Seed data (`src/data/catalog.ts` + `generateSeed.ts`)

Deterministic: `mulberry32(20261126)`; everything relative to `now` (anchorDate D0 = today). Must run < 500 ms.

### Branches (≈ daily revenue)
| Code | Branch | City | Avg/day | Story |
|---|---|---|---|---|
| EDP | Edappally | Kochi | ₹62k | flagship, steady growth |
| KKD | Kakkanad (Infopark Rd) | Kochi | ₹48k | **wastage rising** last 14 days (~9%) |
| VYT | Vyttila Hub | Kochi | ₹41k | **sales down ~18%** last 7 vs prior 7 days; **missed yesterday's day-close** |
| TSR | Swaraj Round | Thrissur | ₹55k | strong weekends |
| CKY | Chalakudy | Thrissur | ₹28k | smallest; **₹850 cash shortage** 2 days ago; today's dispatch **in transit > 4 h** |

Central kitchen & HO: **Navya Central Kitchen, Angamaly**.

### Products (~42, Kerala bakery staples)
- **Breads** (0% GST, 3 days): Milk Bread 400g, Sandwich Bread, Brown Bread, Bun (4 pc), Fruit Bun, Pav (6 pc), Cream Bun (5%)
- **Puffs & Snacks** (5%, 1 day): Egg Puff, Chicken Puff, Veg Puff, Mushroom Puff, Chicken Roll, Meat Roll, Samosa, Cutlet, Pazhampori, Parippu Vada, Uzhunnu Vada, Unniyappam (pack)
- **Cakes** (5%, 3 days): Black Forest 500g, White Forest 500g, Red Velvet 500g, Chocolate Truffle 500g, Butterscotch 500g, Kerala Plum Cake 400g (30 days), Tea Cake slice
- **Pastries** (5%, 2 days): Pineapple, Black Forest, Chocolate, Butterscotch, Red Velvet pastry
- **Cookies & Rusk** (5%, 30–60 days): Rusk, Butter Biscuit, Coconut Cookies, Nankhatai, Cashew Cookies
- **Sweets** (5%, 7–15 days): Kozhikodan Halwa (black / red), Laddu, Jalebi, Mysore Pak, Achappam
- **Chips & Savouries** (5%, 30 days): Banana Chips 200g, Jackfruit Chips, Sharkara Upperi, Mixture

Prices realistic (₹15 puffs … ₹450–650 for 500 g cakes). Demand weights per product; puffs/bread are volume drivers.

### Raw materials (~25)
Maida, Wheat flour, Sugar, Icing sugar, Butter, Margarine, Eggs (dozen), Milk, Fresh cream, Yeast, Cocoa powder, Dark compound chocolate, Vegetable oil, Coconut oil, Ghee, Chicken, Onion, Mushroom, Nendran banana, Grated coconut, Cashew, Raisins, Jaggery, Baking powder, Packaging boxes. Realistic costs; **Butter, Fresh cream, Cocoa powder seeded below reorder level.**

### Recipes
Every product has a recipe. Generate from category templates (relative ingredient proportions) and **scale quantities so unit cost lands at 35–50 % of net price** → margins 50–65 %.

### Suppliers (6)
e.g. Malabar Flour Mills (Kalamassery), Milma Dairy Distributor (Ernakulam), Periyar Poultry (Aluva), Kerala Agro Fresh (Thrissur), Cochin Packaging Co., Spice Coast Traders.

### History generation
- **Days D0-90 … D0-1** — `salesDays` only (aggregates, no bill detail): base revenue × weekday factor (Sat/Sun +20 %, Mon −8 %) × gentle growth trend × noise × festival spikes (Onam ~2026-08-26, Diwali 2026-11-08, if within range) × branch story modifiers. Product mix from demand weights per category; hourly curve (7–9 am bread peak, 4–7 pm snacks peak, open 7 am–10 pm); payments ≈ UPI 55 %, cash 35 %, card 10 %; ABV ₹170–280.
- `wastage` entries for every branch-day (perishables, 2–5 % baseline, KKD story).
- `expenses` (0–2 per branch-day) and `dayCloses` for every branch-day (small random variances; CKY ₹-850 on D0-2; **VYT has no close for D0-1**).
- **Last 14 days**: full `indents` (received), `productionPlans` (completed), `dispatches` (received; ~15 % have small short/damaged variances), plus `rmMovements` for production & GRNs.
- **Today D0**: production plan completed; dispatches DN for 4 branches **received** (batches created), **CKY in transit**. Detailed **`bills` for today up to the current hour** generated through the same FIFO/aggregate logic as `createBill`. Stock leftovers from earlier days (bread/cookies), and a few **expired batches** at KKD and VYT for the wastage demo.
- **Tomorrow D0+1**: indents **submitted** by EDP, KKD, TSR; **draft** at VYT; **none** at CKY. No production plan yet.
- Purchase: ~20 historical POs (received), **PO sent** (butter + cream, expected tomorrow), **PO partially received** (flour), and GRNs for the received ones.
- Batches, bills, etc. use the real store helpers where possible so seed and live behaviour match.

---

## 8. Analytics & alerts

### 8.1 `analytics.ts` (pure, memo-friendly; inputs: state, `{from, to}`, branchIds?)
- `salesSummary` → revenue, net revenue, bills, ABV, GST, COGS, gross margin %, wastage value/% , vs previous equal-length period (deltas).
- `dailySeries` (per day, optional per branch) + 7-day moving average.
- `branchLeaderboard` → per branch: revenue, growth %, bills, ABV, wastage %, margin %, cash variance sum, sparkline series.
- `categoryMix`, `productPerformance` (qty, revenue, margin %, wastage qty/%, rank), `hourlyHeatmap` (weekday × hour), `paymentMix`, `wastageByReason`, `wastageSeries`.
- `dispatchVariance` (last N days, by branch/product), `indentFillRate`.

### 8.2 `alerts.ts` → `Alert { id; severity: 'critical'|'warning'|'info'; type; title; detail; branchId?; link? }`
- Wastage % (last 7 d) > `wastageAlertPct` → warning (critical if > 1.5×).
- Sales last 7 d vs prior 7 d drop > `salesDropAlertPct` → warning.
- Any day-close variance |₹| > `cashVarianceAlert` in last 7 d → warning (shortage critical).
- Day not closed for yesterday → warning.
- Indent for tomorrow not submitted and now past cutoff → critical; before cutoff → info.
- Dispatch `in_transit` longer than `transitAlertHours` → warning.
- Raw material below reorder level → warning (info for HO-only list).
- Expired stock still on hand at a branch → info.

Seed must trigger a sensible mix (see §7 stories).

---

## 9. Screens

### Shared
- **Login** (§6). **AppShell**: shadcn `sidebar` (collapsible) on md+; for **branch** role, a **bottom tab bar** on mobile (Home, POS, Stock, Indent, More). Topbar: page title, branch name / role badge, online/offline dot, theme toggle, user menu (Install app, Reset demo data, Sign out).
- `StaleSeedBanner`, PWA `UpdatePrompt` toast.

### Branch (`/branch/*`) — touch-first, min 44 px targets
| Route | Screen |
|---|---|
| `/branch` | **Home**: today's sales/bills/ABV, vs same weekday last week; tasks card (receive dispatch, submit indent before cutoff with countdown, expired stock to write off, day close pending); 7-day sales mini chart; low/out-of-stock list. |
| `/branch/pos` | **POS**: category tabs + search, product tile grid (name, price, on-hand badge; amber if expiring today; disabled at 0). Cart panel right (tablet/desktop) / bottom drawer (mobile). +/- qty, clear. **Pay** dialog: Cash (tendered + quick ₹ buttons + change), UPI, Card → complete → **Receipt** dialog (Print / New bill). Blocked with banner when day closed. |
| `/branch/bills` | Today's bills (and any date with detail): search by number, list, detail sheet, **reprint**. |
| `/branch/stock` | Stock by product: on-hand, expiring, expired; expandable batches (mfg/expiry/qty). Filters. |
| `/branch/indent` | Indent for **tomorrow** (date selectable): auto-suggested qty pre-filled (tooltip shows avg sales & stock), editable steppers grouped by category, totals, Save draft / Submit; status timeline (draft → submitted → in production → dispatched → received); cutoff countdown; past indents list. |
| `/branch/receive` | Incoming dispatches (in transit) → receive form: per line dispatched / received / damaged / note, "Accept all" shortcut, variance highlight → Confirm. History of received dispatches with variances. |
| `/branch/wastage` | Record wastage (product, batch, qty, reason, note); "Write off all expired" one-tap; today's & recent entries with value. |
| `/branch/day-end` | Summary (float, cash/UPI/card, expenses, expected cash), petty **expenses** (add/delete), **denomination counter** (₹500…₹1, coins) → counted cash, variance (colour-coded), notes, **Close day** (confirm). Closed state + Reopen. Past closes list. |

**Receipt (80 mm)** — print via `PrintArea` + `@media print` (`@page { size: 80mm auto; margin: 0 }`): logo/wordmark, branch name/address/phone, bill no, date/time, cashier, lines (item, qty, rate, amount), total, "Incl. GST ₹X", payment mode / tendered / change, "Thank you! Visit again", footer.

### Head office (`/ho/*`) — desktop-first, dense tables
| Route | Screen |
|---|---|
| `/ho` | **Dashboard**: tomorrow's indents received (x/5 with branch chips), production status, dispatches in transit, raw materials below reorder, open POs, last 7 d dispatch variance, ops alerts. |
| `/ho/indents` | Indents by delivery date: branch status list (submitted/late/draft/missing), **matrix** products × branches with totals; open indent detail. |
| `/ho/production` & `/:id` | Plans list; **Generate plan** for a date; edit planned qty; **material requirement** table with shortfalls (link → create PO); Confirm; **Record production** (produced qty, default planned) → Complete. |
| `/ho/dispatch` & `/:id` | For a completed plan: proposed allocation grid (branch × product, editable) → **Create dispatch notes**; ad-hoc dispatch; list of DNs with status; DN detail + **printable A4 delivery note**; variance view after receipt. |
| `/ho/raw-materials` | Stock table (qty, reorder level, value, status), adjust stock, movement history drawer, reorder suggestions → create PO. |
| `/ho/purchase` & `/:id` | PO list with status filters; create/edit PO (supplier, lines, rate, expected date); Send; **Receive (GRN)** partial/full; printable PO. |
| `/ho/suppliers` | CRUD. |
| `/ho/recipes` & `/:productId` | Products with unit cost, MRP, net price, margin % (colour-coded); recipe editor (yield, ingredients) with live cost/margin. |
| `/ho/products` | Product master CRUD (sku, name, category, MRP, GST %, shelf life, active). |
| `/ho/pricing` | Branch price overrides matrix (product × branch; blank = MRP). |
| `/ho/branches` | Branch master CRUD (incl. opening float); Reopen a branch's day close. |
| `/ho/users` | User CRUD, role/branch, active, set password. |
| `/ho/reports` | Tabs: Sales (branch × day), Product sales, Wastage, Dispatch variance, Day-close/cash — date range + branch filters, **CSV export**. |
| `/ho/settings` | Settings (cutoff time, thresholds), demo data reset. |

### CXO (`/cxo/*`) — executive dashboards, desktop + phone
Global filters: date range (Today, Yesterday, Last 7 d, Last 30 d, MTD, Last 90 d) + branch multi-select.
| Route | Screen |
|---|---|
| `/cxo` | **Overview**: KPI cards (Revenue, Bills, ABV, Gross margin %, Wastage %, with Δ vs previous period); revenue trend area chart + 7-d MA; revenue by branch bar; category mix donut; peak-hours heatmap (weekday × hour); payment mix; top alerts preview. |
| `/cxo/branches` & `/:branchId` | Leaderboard table (rank, revenue, growth, bills, ABV, wastage %, margin %, cash variance, sparkline); comparison chart; branch drill-down with its own trends, top products, wastage, day-close history. |
| `/cxo/products` | Top/bottom sellers, revenue vs margin (bar/scatter), category performance, product table (qty, revenue, margin, wastage %). |
| `/cxo/wastage` | Wastage % trend by branch, by reason, top wasted products, value lost at MRP & cost. |
| `/cxo/alerts` | All alerts grouped by severity with links/drill-downs. |

---

## 10. Theme & UX
- Tokens (OKLCH) in `index.css`: **light** — cream background (~#FBF6EE), dark-chocolate text (~#2B1D14), primary chocolate brown (~#6B3E26), accent saffron (~#E8A33D), soft beige muted/borders. **dark** — deep cocoa background (~#1A120D), card (~#241A13), primary saffron, accent caramel. Chart palette: 5 distinct warm-friendly hues that also read in dark mode. Status colours: success green, warning amber, danger red.
- Headings & wordmark in Fraunces; body Inter. Logo: simple SVG mark (wheat/croissant) + "Navya Bakers".
- `ThemeProvider` (light / dark / system) persisted in localStorage.
- INR formatting everywhere via `format.ts`; compact lakhs/crores on KPI cards.
- Loading is instant (local data) — use empty states, not spinners.

## 11. PWA & deployment
- `vite-plugin-pwa`: `registerType: 'prompt'`, Workbox precache of all build assets (fonts included), manifest: name "Navya Bakers ERP", short_name "Navya ERP", theme/background colours from tokens, `display: standalone`, `start_url: '.'`, `scope: '.'`, icons 64/192/512 + maskable 512 generated from `public/logo.svg` via `@vite-pwa/assets-generator` (`minimal-2023` preset).
- `InstallButton` (captures `beforeinstallprompt`), `UpdatePrompt` (sonner toast "New version available → Reload").
- Vite `base: process.env.BASE_PATH ?? '/'`; HashRouter so no 404 fallback is needed.
- `.github/workflows/deploy.yml`: on push to `main` → pnpm install → `BASE_PATH=/${{ github.event.repository.name }}/ pnpm build` → `actions/upload-pages-artifact` + `actions/deploy-pages`.
- `.gitignore` includes `node_modules`, `dist`, `.env*` (except `.env.example`), `dev-dist`.
- `README.md`: run, build, deploy, demo users, demo walkthrough.

## 12. Demo walkthrough (acceptance script)
1. Log in as **Edappally** → Home shows today's sales & tasks → POS: bill 3 items with cash, print receipt → Bills shows it → CXO revenue for today increased (other tab).
2. **Vyttila** → Indent: suggestions pre-filled → adjust → Submit. **Chalakudy** → Indent → Submit (late flag if past cutoff).
3. **Chalakudy** → Receive in-transit dispatch with 2 short + 1 damaged → stock updated, wastage logged.
4. **Kakkanad** → Wastage → "Write off all expired".
5. **HO** → Indents matrix for tomorrow → Production: generate plan → see material shortfall (butter/cream) → create PO → confirm plan → record production → Dispatch: allocate → create DNs → print a DN.
6. **HO** → Purchase: receive GRN for the sent PO → butter no longer below reorder.
7. **Branch** → Day end: add an expense, count denominations, close day → POS locked.
8. **CXO** → Overview KPIs/charts; Branches leaderboard shows KKD wastage & VYT decline; Alerts lists them; drill into a branch.
9. Install as PWA, go offline, everything still works. Reset demo data from user menu.

## 13. Implementation phases (Sonnet agents)
1. **Foundation** (single agent, sequential): scaffold, deps, shadcn, theme, PWA, deploy workflow, types, catalog, seed generator, store + all actions, selectors, analytics, alerts, vitest tests, auth, layout shell, common components, placeholder pages for every route, README. Gate: `pnpm typecheck && pnpm test && pnpm build` green.
2. **Modules in parallel** (3 agents, disjoint ownership): Branch (`src/features/branch/**`, `src/routes/branchRoutes.tsx`), HO (`src/features/ho/**`, `src/routes/hoRoutes.tsx`), CXO (`src/features/cxo/**`, `src/routes/cxoRoutes.tsx`). No new deps; shared-file edits only if unavoidable, minimal and additive, and reported.
3. **Integration & QA**: typecheck, lint, tests, build, preview smoke test, walkthrough fixes.
