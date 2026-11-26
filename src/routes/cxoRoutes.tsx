import type { RouteObject } from 'react-router'
import CxoOverviewPage from '@/features/cxo/pages/CxoOverviewPage'
import CxoBranchesPage from '@/features/cxo/pages/CxoBranchesPage'
import CxoBranchDetailPage from '@/features/cxo/pages/CxoBranchDetailPage'
import CxoProductsPage from '@/features/cxo/pages/CxoProductsPage'
import CxoWastagePage from '@/features/cxo/pages/CxoWastagePage'
import CxoAlertsPage from '@/features/cxo/pages/CxoAlertsPage'

/** Children of `/cxo` (paths are relative). Add/replace pages here — App.tsx mounts this under the guarded AppShell. */
export const cxoRoutes: RouteObject[] = [
  { index: true, element: <CxoOverviewPage /> },
  { path: 'branches', element: <CxoBranchesPage /> },
  { path: 'branches/:branchId', element: <CxoBranchDetailPage /> },
  { path: 'products', element: <CxoProductsPage /> },
  { path: 'wastage', element: <CxoWastagePage /> },
  { path: 'alerts', element: <CxoAlertsPage /> },
]
