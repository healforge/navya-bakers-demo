import { useLocation } from 'react-router'
import { ROLE_LABEL, useCurrentUser } from '@/auth/session'
import { Badge } from '@/components/ui/badge'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useOnline } from '@/hooks/use-online'
import { useDb } from '@/store/db'
import { cn } from '@/lib/utils'
import { pageTitleFor } from './navConfig'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function Topbar({ showSidebarTrigger = true }: { showSidebarTrigger?: boolean }) {
  const user = useCurrentUser()
  const { pathname } = useLocation()
  const branches = useDb((db) => db.branches)
  const online = useOnline()
  if (!user) return null
  const branch = branches.find((b) => b.id === user.branchId)

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-5">
      {showSidebarTrigger && <SidebarTrigger className="-ml-1" />}
      <h1 className="truncate font-heading text-lg font-semibold">{pageTitleFor(user.role, pathname)}</h1>
      <div className="ml-auto flex items-center gap-1.5">
        <Badge variant="secondary" className="hidden max-w-48 truncate sm:inline-flex">
          {branch ? branch.name : ROLE_LABEL[user.role]}
        </Badge>
        <span
          title={online ? 'Online' : 'Offline — data is saved locally'}
          className={cn('mx-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground')}
        >
          <span className={cn('size-2 rounded-full', online ? 'bg-success' : 'bg-warning')} />
          <span className="hidden lg:inline">{online ? 'Online' : 'Offline'}</span>
        </span>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
