/**
 * Single source of truth for navigation. Every route in PLAN §9 appears here.
 * Sidebar, mobile bottom bar and the Topbar title all read from this file.
 */
import {
  AlertTriangle, BarChart3, Boxes, Building2, ClipboardList, FileBarChart, Factory, Home, LayoutDashboard, Package, PackageCheck,
  PiggyBank, Receipt, ReceiptText, ScanBarcode, Settings, ShoppingCart, Tag, Trash2, Truck, Users, Wallet, ChefHat, Store, Trophy, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types/domain'

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
  /** exact-match highlight (for index routes) */
  end?: boolean
  /** sidebar group label (HO) */
  group?: string
  /** shown as a tab in the mobile bottom bar (branch role); the rest go under "More" */
  mobileTab?: boolean
}

export const NAV: Record<Role, NavItem[]> = {
  branch: [
    { title: 'Home', to: '/branch', icon: Home, end: true, mobileTab: true },
    { title: 'POS', to: '/branch/pos', icon: ScanBarcode, mobileTab: true },
    { title: 'Bills', to: '/branch/bills', icon: Receipt },
    { title: 'Stock', to: '/branch/stock', icon: Boxes, mobileTab: true },
    { title: 'Indent', to: '/branch/indent', icon: ClipboardList, mobileTab: true },
    { title: 'Receive', to: '/branch/receive', icon: PackageCheck },
    { title: 'Wastage', to: '/branch/wastage', icon: Trash2 },
    { title: 'Day end', to: '/branch/day-end', icon: Wallet },
  ],
  ho: [
    { title: 'Dashboard', to: '/ho', icon: LayoutDashboard, end: true, group: 'Overview' },
    { title: 'Indents', to: '/ho/indents', icon: ClipboardList, group: 'Operations' },
    { title: 'Production', to: '/ho/production', icon: Factory, group: 'Operations' },
    { title: 'Dispatch', to: '/ho/dispatch', icon: Truck, group: 'Operations' },
    { title: 'Raw materials', to: '/ho/raw-materials', icon: Warehouse, group: 'Procurement' },
    { title: 'Purchase', to: '/ho/purchase', icon: ShoppingCart, group: 'Procurement' },
    { title: 'Suppliers', to: '/ho/suppliers', icon: Store, group: 'Procurement' },
    { title: 'Recipes & costing', to: '/ho/recipes', icon: ChefHat, group: 'Catalog' },
    { title: 'Products', to: '/ho/products', icon: Package, group: 'Catalog' },
    { title: 'Pricing', to: '/ho/pricing', icon: Tag, group: 'Catalog' },
    { title: 'Branches', to: '/ho/branches', icon: Building2, group: 'Admin' },
    { title: 'Users', to: '/ho/users', icon: Users, group: 'Admin' },
    { title: 'Reports', to: '/ho/reports', icon: FileBarChart, group: 'Admin' },
    { title: 'Settings', to: '/ho/settings', icon: Settings, group: 'Admin' },
  ],
  cxo: [
    { title: 'Overview', to: '/cxo', icon: BarChart3, end: true },
    { title: 'Branches', to: '/cxo/branches', icon: Trophy },
    { title: 'Products', to: '/cxo/products', icon: PiggyBank },
    { title: 'Wastage', to: '/cxo/wastage', icon: ReceiptText },
    { title: 'Alerts', to: '/cxo/alerts', icon: AlertTriangle },
  ],
}

/** Title for the Topbar: longest nav item whose path prefixes the current location. */
export function pageTitleFor(role: Role, pathname: string): string {
  let best: NavItem | undefined
  for (const item of NAV[role]) {
    const match = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
    if (match && (!best || item.to.length > best.to.length)) best = item
  }
  return best?.title ?? 'Navya Bakers'
}
