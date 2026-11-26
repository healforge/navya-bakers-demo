import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '@/types/domain'
import { ROLE_HOME, useCurrentUser } from './session'

/** Route guard: wrap a role's route subtree. Sends strangers to /login and others to their own home. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />
  if (role === 'branch' && !user.branchId) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** `/` → role home, or /login. */
export function RootRedirect() {
  const user = useCurrentUser()
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />
}
