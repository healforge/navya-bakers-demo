import { verifyPassword } from '@/lib/password'
import { getDb } from '@/store/db'
import type { User } from '@/types/domain'
import { session } from './session'

/** Demo accounts (passwordHash === null) accept any password. */
export async function signInWithPassword(username: string, password: string): Promise<User> {
  const user = getDb().users.find((u) => u.username === username.trim().toLowerCase() && u.active)
  const bad = new Error('Invalid username or password')
  if (!user) throw bad
  if (user.passwordHash !== null && !(await verifyPassword(password, user.passwordHash))) throw bad
  session.login(user.id)
  return user
}

/** One-click demo sign-in (only for accounts without a password set). */
export function signInAsDemo(userId: string): User {
  const user = getDb().users.find((u) => u.id === userId && u.active)
  if (!user) throw new Error('User not found')
  if (user.passwordHash !== null) throw new Error('This account has a password — use the sign-in form')
  session.login(user.id)
  return user
}
