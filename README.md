# Navya Bakers ERP — demo

Frontend-only demo ERP for a Kerala bakery chain (central kitchen + 5 branches). All data lives in the browser (localStorage); installable PWA that works offline. **Demo mode — not real security.**

## Run
```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # tsc -b && vite build  (output: dist/)
pnpm preview
pnpm test         # vitest (domain logic, seed, analytics, alerts)
pnpm typecheck
pnpm lint
```
Icons are generated from `public/logo.svg` with `pnpm generate-pwa-assets`.

## Deploy (GitHub Pages)
Push to `main`; `.github/workflows/deploy.yml` builds with `BASE_PATH=/<repo>/` and publishes `dist`. Enable Pages → "GitHub Actions" in repo settings. Routing uses the hash router, so no 404 fallback is needed. Locally: `BASE_PATH=/x/ pnpm build`.

## Demo users
Seeded accounts have no password: click a card on the login page, or type the username with any password. HO can set a real password (salted SHA-256 in localStorage) under Users.

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

Each browser tab keeps its own session, so open Branch, HO and CXO in different tabs — changes sync live across tabs.

## Demo walkthrough
1. Edappally: Home → POS, bill 3 items with cash, print receipt → Bills → CXO revenue rises (other tab).
2. Vyttila: Indent, suggestions pre-filled, adjust, Submit. Chalakudy: Indent, Submit (late flag after cutoff).
3. Chalakudy: Receive the in-transit dispatch (2 short, 1 damaged) → stock + wastage updated.
4. Kakkanad: Wastage → "Write off all expired".
5. HO: Indents matrix → Production: generate plan → butter/cream shortfall → create PO → confirm → record production → Dispatch: allocate, create DNs, print one.
6. HO: Purchase → receive GRN for the sent PO → butter no longer below reorder.
7. Branch: Day end → add expense, count denominations, close day → POS locked.
8. CXO: Overview, Branch leaderboard (KKD wastage, VYT decline), Alerts, drill into a branch.
9. Install as PWA, go offline, keep working. User menu → Reset demo data.

## Architecture
- `src/types/domain.ts` types · `src/data` catalog + deterministic seed · `src/store` db (zustand + immer), `ops.ts` (mutating domain logic shared with the seed), `selectors.ts`, `analytics.ts`, `alerts.ts`, `persistence.ts`
- `src/components/common` shared UI · `src/components/layout/navConfig.ts` nav for all roles
- `src/features/<module>/pages/*` one file per page · `src/routes/<module>Routes.tsx` route tables
