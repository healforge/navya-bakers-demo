import type { RouteObject } from 'react-router'
import BranchHomePage from '@/features/branch/pages/BranchHomePage'
import PosPage from '@/features/branch/pages/PosPage'
import BillsPage from '@/features/branch/pages/BillsPage'
import StockPage from '@/features/branch/pages/StockPage'
import IndentPage from '@/features/branch/pages/IndentPage'
import ReceivePage from '@/features/branch/pages/ReceivePage'
import WastagePage from '@/features/branch/pages/WastagePage'
import DayEndPage from '@/features/branch/pages/DayEndPage'

/** Children of `/branch` (paths are relative). Add/replace pages here — App.tsx mounts this under the guarded AppShell. */
export const branchRoutes: RouteObject[] = [
  { index: true, element: <BranchHomePage /> },
  { path: 'pos', element: <PosPage /> },
  { path: 'bills', element: <BillsPage /> },
  { path: 'stock', element: <StockPage /> },
  { path: 'indent', element: <IndentPage /> },
  { path: 'receive', element: <ReceivePage /> },
  { path: 'wastage', element: <WastagePage /> },
  { path: 'day-end', element: <DayEndPage /> },
]
