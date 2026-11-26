import { useMemo } from 'react'
import { create } from 'zustand'
import { useDb } from '@/store/db'
import type { Branch, Role, User } from '@/types/domain'

const SESSION_KEY = 'navya-erp:session' // sessionStorage — per tab, so tabs can be different roles
const LAST_USER_KEY = 'navya-erp:last-user' // localStorage — lets an installed PWA reopen signed in

function read(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

export const useSession = create<{ userId: string | null }>(() => ({ userId: read() }))

export const session = {
  login(userId: string) {
    try {
      sessionStorage.setItem(SESSION_KEY, userId)
      localStorage.setItem(LAST_USER_KEY, userId)
    } catch { /* storage blocked — session lives in memory only */ }
    useSession.setState({ userId })
  },
  logout() {
    try {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(LAST_USER_KEY)
    } catch { /* ignore */ }
    useSession.setState({ userId: null })
  },
}

export const ROLE_HOME: Record<Role, string> = { branch: '/branch', ho: '/ho', cxo: '/cxo' }
export const ROLE_LABEL: Record<Role, string> = { branch: 'Branch', ho: 'Head Office', cxo: 'CXO' }

/** The signed-in user (active, still in the db) or null. */
export function useCurrentUser(): User | null {
  const userId = useSession((s) => s.userId)
  const users = useDb((db) => db.users)
  return useMemo(() => users.find((u) => u.id === userId && u.active) ?? null, [users, userId])
}

/** For pages under a guarded route: throws if nobody is signed in (RequireRole prevents that). */
export function useRequireUser(): User {
  const u = useCurrentUser()
  if (!u) throw new Error('Not signed in')
  return u
}

/** Branch of the signed-in branch user (Branch module pages). */
export function useCurrentBranch(): Branch {
  const user = useRequireUser()
  const branches = useDb((db) => db.branches)
  const branch = branches.find((b) => b.id === user.branchId)
  if (!branch) throw new Error('This user is not assigned to a branch')
  return branch
}
