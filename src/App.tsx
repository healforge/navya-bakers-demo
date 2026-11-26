import { createHashRouter, RouterProvider, type RouteObject } from 'react-router'
import { RequireRole, RootRedirect } from '@/auth/RequireRole'
import { AppShell } from '@/components/layout/AppShell'
import LoginPage from '@/features/auth/LoginPage'
import { branchRoutes } from '@/routes/branchRoutes'
import { cxoRoutes } from '@/routes/cxoRoutes'
import { hoRoutes } from '@/routes/hoRoutes'

const guarded = (path: string, role: 'branch' | 'ho' | 'cxo', children: RouteObject[]): RouteObject => ({
  path,
  element: (
    <RequireRole role={role}>
      <AppShell />
    </RequireRole>
  ),
  children,
})

export const router = createHashRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  guarded('/branch', 'branch', branchRoutes),
  guarded('/ho', 'ho', hoRoutes),
  guarded('/cxo', 'cxo', cxoRoutes),
  { path: '*', element: <RootRedirect /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
