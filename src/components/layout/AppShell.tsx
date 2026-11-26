import { Outlet } from 'react-router'
import { useCurrentUser } from '@/auth/session'
import { StaleSeedBanner } from '@/components/common/StaleSeedBanner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useDb } from '@/store/db'
import { cn } from '@/lib/utils'
import { AppSidebar } from './AppSidebar'
import { MobileBottomNav } from './MobileBottomNav'
import { Topbar } from './Topbar'

/** Guarded layout: sidebar (+ bottom tab bar for branch on mobile), topbar, banner, routed page. */
export function AppShell() {
  const user = useCurrentUser()
  const isMobile = useIsMobile()
  const branches = useDb((db) => db.branches)
  if (!user) return null
  const branch = branches.find((b) => b.id === user.branchId)
  const bottomNav = user.role === 'branch' && isMobile

  return (
    <SidebarProvider>
      <AppSidebar role={user.role} subtitle={branch ? branch.name : user.name} />
      <SidebarInset className="min-w-0">
        <Topbar showSidebarTrigger={!bottomNav} />
        <StaleSeedBanner />
        <div className={cn('flex-1 p-4 md:p-6', bottomNav && 'pb-24')}>
          <Outlet />
        </div>
        {bottomNav && <MobileBottomNav />}
      </SidebarInset>
    </SidebarProvider>
  )
}
