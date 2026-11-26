import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, PackageSearch, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCurrentBranch } from '@/auth/session'
import { useDb } from '@/store/db'
import { getBranchStock } from '@/store/selectors'
import { diffDays, todayISO } from '@/lib/dates'
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'expiring' | 'expired' | 'out'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'expiring', label: 'Expiring' }, { value: 'expired', label: 'Expired' }, { value: 'out', label: 'Out of stock' },
]

export default function StockPage() {
  const branch = useCurrentBranch()
  const db = useDb((d) => d)
  const today = todayISO()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const stock = useMemo(() => getBranchStock(db, branch.id, today), [db, branch.id, today])
  const counts = useMemo(() => ({
    all: stock.length,
    expiring: stock.filter((s) => s.expiringQty > 0).length,
    expired: stock.filter((s) => s.expiredQty > 0).length,
    out: stock.filter((s) => s.onHand === 0).length,
  }), [stock])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return stock.filter((s) => {
      if (needle && !s.product.name.toLowerCase().includes(needle)) return false
      return filter === 'all' || (filter === 'expiring' && s.expiringQty > 0) || (filter === 'expired' && s.expiredQty > 0) || (filter === 'out' && s.onHand === 0)
    })
  }, [stock, filter, q])

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <>
      <PageHeader title="Stock" description={`${branch.name} · on-hand by product (FIFO batches)`} />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-12 pl-10 text-base" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)}
            className={cn('h-11 shrink-0 rounded-full border px-4 text-sm font-medium', filter === f.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>
            {f.label} <span className="opacity-70">({counts[f.value]})</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Nothing matches" description="Try another filter or search term." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {rows.map((s) => {
                const isOpen = open.has(s.productId)
                const canOpen = s.batches.length > 0
                return (
                  <Fragment key={s.productId}>
                    <button type="button" disabled={!canOpen} onClick={() => toggle(s.productId)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left disabled:cursor-default">
                      {canOpen ? (isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />) : <span className="size-4 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.product.name}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {s.onHand === 0 && <StatusBadge status="out" />}
                          {s.onHand > 0 && s.onHand <= 5 && <StatusBadge status="low" />}
                          {s.expiringQty > 0 && <StatusBadge status="expiring" label={`${s.expiringQty} expiring`} />}
                          {s.expiredQty > 0 && <StatusBadge status="expired" label={`${s.expiredQty} expired`} />}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-heading text-xl font-semibold tabular-nums">{formatNumber(s.onHand)}</div>
                        <div className="text-xs text-muted-foreground">on hand</div>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="bg-muted/40 px-4 py-2">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-medium">Mfg</th><th className="font-medium">Expiry</th><th className="text-right font-medium">Qty</th></tr></thead>
                          <tbody>
                            {s.batches.map((b) => {
                              const left = diffDays(today, b.expiryDate)
                              return (
                                <tr key={b.id} className="border-t border-border/60">
                                  <td className="py-1.5">{formatDate(b.mfgDate)}</td>
                                  <td>
                                    {formatDate(b.expiryDate)}{' '}
                                    {left < 0 ? <StatusBadge status="expired" /> : left === 0 ? <StatusBadge status="expiring" label="Today" /> : <span className="text-xs text-muted-foreground">({left}d)</span>}
                                  </td>
                                  <td className="text-right tabular-nums">{b.qtyRemaining}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
