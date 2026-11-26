import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar'
import { ROLE_LABEL } from '@/auth/session'
import type { Role } from '@/types/domain'
import { Logo } from './Logo'
import { NAV, type NavItem } from './navConfig'

export function AppSidebar({ role, subtitle }: { role: Role; subtitle: string }) {
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile])

  const groups = new Map<string, NavItem[]>()
  for (const item of NAV[role]) {
    const key = item.group ?? ''
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 group-data-[collapsible=icon]:px-2">
        <Logo wordmarkClassName="group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent>
        {[...groups.entries()].map(([label, items]) => (
          <SidebarGroup key={label}>
            {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <NavLink to={item.to} end={item.end}>
                      {({ isActive }) => (
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className="h-10 md:h-8">
                          <span>
                            <item.icon />
                            <span>{item.title}</span>
                          </span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
        <div className="font-medium text-sidebar-foreground">{ROLE_LABEL[role]}</div>
        <div className="truncate">{subtitle}</div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
