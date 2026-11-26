import { useState } from 'react'
import { NavLink } from 'react-router'
import { MoreHorizontal } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { NAV } from './navConfig'

/** Branch role, < md: Home · POS · Stock · Indent · More. */
export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const tabs = NAV.branch.filter((i) => i.mobileTab)
  const more = NAV.branch.filter((i) => !i.mobileTab)
  const tabClass = (active: boolean) =>
    cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')

  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
        {tabs.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => tabClass(isActive)}>
            <item.icon className="size-5" />
            {item.title}
          </NavLink>
        ))}
        <button type="button" className={tabClass(moreOpen)} onClick={() => setMoreOpen(true)}>
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 p-4 pt-0">
            {more.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-14 items-center gap-3 rounded-xl border bg-background px-4 text-sm font-medium active:bg-muted"
              >
                <item.icon className="size-5 text-primary" />
                {item.title}
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
