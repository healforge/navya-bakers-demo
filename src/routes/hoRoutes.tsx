import type { RouteObject } from 'react-router'
import HoDashboardPage from '@/features/ho/pages/HoDashboardPage'
import IndentsPage from '@/features/ho/pages/IndentsPage'
import ProductionListPage from '@/features/ho/pages/ProductionListPage'
import ProductionDetailPage from '@/features/ho/pages/ProductionDetailPage'
import DispatchListPage from '@/features/ho/pages/DispatchListPage'
import DispatchDetailPage from '@/features/ho/pages/DispatchDetailPage'
import RawMaterialsPage from '@/features/ho/pages/RawMaterialsPage'
import PurchaseListPage from '@/features/ho/pages/PurchaseListPage'
import PurchaseDetailPage from '@/features/ho/pages/PurchaseDetailPage'
import PurchaseEditPage from '@/features/ho/pages/PurchaseEditPage'
import SuppliersPage from '@/features/ho/pages/SuppliersPage'
import RecipesListPage from '@/features/ho/pages/RecipesListPage'
import RecipeDetailPage from '@/features/ho/pages/RecipeDetailPage'
import ProductsPage from '@/features/ho/pages/ProductsPage'
import PricingPage from '@/features/ho/pages/PricingPage'
import BranchesPage from '@/features/ho/pages/BranchesPage'
import UsersPage from '@/features/ho/pages/UsersPage'
import ReportsPage from '@/features/ho/pages/ReportsPage'
import SettingsPage from '@/features/ho/pages/SettingsPage'

/** Children of `/ho` (paths are relative). Add/replace pages here — App.tsx mounts this under the guarded AppShell. */
export const hoRoutes: RouteObject[] = [
  { index: true, element: <HoDashboardPage /> },
  { path: 'indents', element: <IndentsPage /> },
  { path: 'production', element: <ProductionListPage /> },
  { path: 'production/:id', element: <ProductionDetailPage /> },
  { path: 'dispatch', element: <DispatchListPage /> },
  { path: 'dispatch/:id', element: <DispatchDetailPage /> },
  { path: 'raw-materials', element: <RawMaterialsPage /> },
  { path: 'purchase', element: <PurchaseListPage /> },
  { path: 'purchase/new', element: <PurchaseEditPage /> },
  { path: 'purchase/:id/edit', element: <PurchaseEditPage /> },
  { path: 'purchase/:id', element: <PurchaseDetailPage /> },
  { path: 'suppliers', element: <SuppliersPage /> },
  { path: 'recipes', element: <RecipesListPage /> },
  { path: 'recipes/:productId', element: <RecipeDetailPage /> },
  { path: 'products', element: <ProductsPage /> },
  { path: 'pricing', element: <PricingPage /> },
  { path: 'branches', element: <BranchesPage /> },
  { path: 'users', element: <UsersPage /> },
  { path: 'reports', element: <ReportsPage /> },
  { path: 'settings', element: <SettingsPage /> },
]
