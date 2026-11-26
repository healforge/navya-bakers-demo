import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_HOME, ROLE_LABEL, useCurrentUser } from '@/auth/session'
import { signInAsDemo, signInWithPassword } from '@/auth/signIn'
import { Logo } from '@/components/layout/Logo'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDb } from '@/store/db'
import type { Role, User } from '@/types/domain'

const GROUPS: { role: Role; title: string }[] = [
  { role: 'branch', title: 'Branch managers' },
  { role: 'ho', title: 'Head office' },
  { role: 'cxo', title: 'Management' },
]

export default function LoginPage() {
  const user = useCurrentUser()
  const users = useDb((db) => db.users)
  const branches = useDb((db) => db.branches)
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />

  const pick = (u: User) => {
    if (u.passwordHash !== null) {
      setUsername(u.username)
      toast.info(`${u.name} has a password — enter it below`)
      return
    }
    signInAsDemo(u.id)
    navigate(ROLE_HOME[u.role], { replace: true })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await signInWithPassword(username, password)
      navigate(ROLE_HOME[u.role], { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:py-14">
        <div className="flex items-center justify-between">
          <Logo size={40} />
          <ThemeToggle />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-muted-foreground">Pick a demo user to explore, or sign in with a username.</p>
        </div>

        {GROUPS.map((g) => {
          const list = users.filter((u) => u.role === g.role && u.active)
          if (!list.length) return null
          return (
            <section key={g.role} className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((u) => (
                  <button key={u.id} type="button" onClick={() => pick(u)} className="text-left">
                    <Card className="transition hover:border-primary hover:shadow-md">
                      <CardContent className="flex items-center gap-3">
                        <Avatar className="size-10"><AvatarFallback className="bg-primary text-primary-foreground">{u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.branchId ? branches.find((b) => b.id === u.branchId)?.name : ROLE_LABEL[u.role]} · @{u.username}
                          </div>
                        </div>
                        {u.passwordHash !== null && <Lock className="size-4 text-muted-foreground" />}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </section>
          )
        })}

        <Card className="max-w-md">
          <CardContent>
            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy || !username} className="w-full">Sign in</Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">Demo mode — not real security. Demo accounts accept any password.</p>
      </div>
    </div>
  )
}
