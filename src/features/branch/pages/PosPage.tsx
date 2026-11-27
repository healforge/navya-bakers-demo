import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useMemo, useState } from 'react'
import { Lock, Search, ShoppingCart } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { useSidebar } from '@/components/ui/sidebar'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useCurrentBranch, useRequireUser } from '@/auth/session'
import { useDb, dbActions } from '@/store/db'
import { effectivePrice, getBranchStock, isDayClosed } from '@/store/selectors'
import { todayISO } from '@/lib/dates'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PRODUCT_CATEGORIES, type Bill, type PaymentMode } from '@/types/domain'
import { ProductTile } from '../components/ProductTile'
import { CartPanel, type CartLine } from '../components/CartPanel'
import { PaymentDialog } from '../components/PaymentDialog'
import { ReceiptDialog } from '../components/ReceiptDialog'
import { run } from '../lib/utils'

export default function PosPage() {
  const { t } = useLanguage()
  const branch = useCurrentBranch()
  const user = useRequireUser()
  const db = useDb((d) => d)
  const today = todayISO()
  const closed = isDayClosed(db, branch.id, today)

  const [category, setCategory] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({}) // local only — never in the db store
  const [payOpen, setPayOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [bill, setBill] = useState<Bill | null>(null)

  // give tablet POS the room: collapse the app sidebar on mount below 1280px
  const { setOpen: setSidebarOpen } = useSidebar()
  useEffect(() => {
    if (window.innerWidth < 1280) setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stock = useMemo(() => getBranchStock(db, branch.id, today).filter((s) => s.product.active), [db, branch.id, today])
  const prices = useMemo(() => new Map(stock.map((s) => [s.productId, effectivePrice(db, branch.id, s.productId)])), [db, branch.id, stock])

  const categories = useMemo(() => ['All', ...PRODUCT_CATEGORIES.filter((c) => stock.some((s) => s.product.category === c))], [stock])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stock.filter((s) => (category === 'All' || s.product.category === category) && (!q || s.product.name.toLowerCase().includes(q) || s.product.sku.toLowerCase().includes(q)))
  }, [stock, category, search])

  const lines: CartLine[] = useMemo(() => {
    const out: CartLine[] = []
    for (const s of stock) {
      const qty = cart[s.productId]
      if (qty) out.push({ productId: s.productId, name: s.product.name, price: prices.get(s.productId) ?? s.product.price, qty, max: s.onHand })
    }
    return out
  }, [cart, stock, prices])
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const units = lines.reduce((s, l) => s + l.qty, 0)

  const add = (id: string, max: number) => setCart((c) => ({ ...c, [id]: Math.min(max, (c[id] ?? 0) + 1) }))
  const setQty = (id: string, q: number) => setCart((c) => ({ ...c, [id]: q }))
  const remove = (id: string) => setCart((c) => { const n = { ...c }; delete n[id]; return n })
  const clear = () => setCart({})

  const pay = (mode: PaymentMode, tendered?: number): boolean => {
    let created: Bill | null = null
    const ok = run(t, () => {
      created = dbActions.createBill({ branchId: branch.id, cashierId: user.id, lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })), paymentMode: mode, tendered })
    })
    if (ok && created) { setBill(created); setCart({}); setCartOpen(false) }
    return ok
  }

  const cartPanel = (
    <CartPanel lines={lines} total={total} disabled={closed} onQty={setQty} onRemove={remove} onClear={clear} onPay={() => { setCartOpen(false); setPayOpen(true) }} />
  )

  return (
    <>
      <PageHeader title={t('POS')} description={t('{name} · billing', { name: branch.name })} />
      {closed && (
        <Alert variant="destructive" className="mb-4">
          <Lock />
          <AlertTitle>{t('Day is closed')}</AlertTitle>
          <AlertDescription>{t('Billing is disabled for today. Reopen the day from Day end to continue.')}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 pb-24 lg:pb-0">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-12 pl-10 text-base" placeholder={t('Search products…')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={cn('h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition', category === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>
                {t(c)}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <EmptyState title={t('No products found')} description={t('Try a different category or search.')} />
          ) : (
            <div className={cn('grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3', closed && 'pointer-events-none opacity-60')}>
              {visible.map((s) => (
                <ProductTile
                  key={s.productId}
                  name={s.product.name}
                  price={prices.get(s.productId) ?? s.product.price}
                  onHand={s.onHand}
                  expiringToday={s.batches.some((b) => b.expiryDate === today)}
                  inCart={cart[s.productId] ?? 0}
                  onAdd={() => add(s.productId, s.onHand)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4 h-[calc(100dvh-8rem)] rounded-xl border bg-card p-3">{cartPanel}</div>
        </aside>
      </div>

      {/* mobile sticky cart bar */}
      {/* phone: fixed above the bottom tab bar; tablet: sticky within the content column so it never sits under the sidebar */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 p-3 md:sticky md:inset-x-auto md:bottom-0 md:-mx-3 lg:hidden">
        <Button className="h-14 w-full justify-between text-base shadow-lg disabled:border disabled:bg-card disabled:text-muted-foreground disabled:opacity-100" disabled={lines.length === 0} onClick={() => setCartOpen(true)}>
          <span className="flex items-center gap-2"><ShoppingCart /> {t(units === 1 ? '{count} item' : '{count} items', { count: units })}</span>
          <span className="tabular-nums">{formatINR(total)} {t('· View cart')}</span>
        </Button>
      </div>
      <Drawer open={cartOpen} onOpenChange={setCartOpen}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="sr-only"><DrawerTitle>{t('Cart')}</DrawerTitle><DrawerDescription>{t('Current bill')}</DrawerDescription></DrawerHeader>
          <div className="h-[75dvh] p-4">{cartPanel}</div>
        </DrawerContent>
      </Drawer>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} total={total} onConfirm={pay} />
      <ReceiptDialog bill={bill} branch={branch} open={!!bill} onOpenChange={(o) => { if (!o) setBill(null) }} onNewBill={() => setBill(null)} />
    </>
  )
}
