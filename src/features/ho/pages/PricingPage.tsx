import { useMemo, useState } from 'react'
import { Money, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { dbActions, useDb } from '@/store/db'
import { run } from '../components/shared'

export default function PricingPage() {
  const db = useDb((d) => d)
  const branches = useMemo(() => db.branches.filter((b) => b.active), [db.branches])
  const products = useMemo(() => db.products.filter((p) => p.active), [db.products])
  const overrides = useMemo(() => new Map(db.priceOverrides.map((o) => [`${o.branchId}|${o.productId}`, o.price])), [db.priceOverrides])
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const commit = async (branchId: string, productId: string, mrp: number) => {
    const k = `${branchId}|${productId}`
    const raw = drafts[k]
    if (raw === undefined) return
    setDrafts(({ [k]: _drop, ...rest }) => rest)
    const cur = overrides.get(k)
    const trimmed = raw.trim()
    if (trimmed === '') { if (cur !== undefined) await run(() => dbActions.removePriceOverride(branchId, productId), 'Override cleared'); return }
    const n = Number(trimmed)
    if (n === cur || (cur === undefined && n === mrp)) return
    await run(() => dbActions.setPriceOverride({ branchId, productId, price: n }), 'Override saved')
  }

  return (
    <>
      <PageHeader title="Branch pricing" description="Leave a cell blank to use the MRP. Type a price to override it for that branch; clear it to remove the override." />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">Product</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  {branches.map((b) => <TableHead key={b.id} className="text-right">{b.name}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="sticky left-0 z-10 bg-card font-medium">{p.name}</TableCell>
                    <TableCell className="text-right"><Money value={p.price} decimals /></TableCell>
                    {branches.map((b) => {
                      const k = `${b.id}|${p.id}`
                      const ov = overrides.get(k)
                      return (
                        <TableCell key={b.id} className={cn('text-right', ov !== undefined && 'bg-warning/15')}>
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number" min={0} step="0.5" placeholder={String(p.price)} aria-label={`${p.name} price at ${b.name}`}
                              className={cn('h-8 w-24 text-right tabular-nums', ov !== undefined && 'font-semibold')}
                              value={drafts[k] ?? (ov !== undefined ? String(ov) : '')}
                              onChange={(e) => setDrafts((s) => ({ ...s, [k]: e.target.value }))}
                              onBlur={() => commit(b.id, p.id, p.price)}
                              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            />
                            {ov !== undefined && <Button variant="ghost" size="xs" className="h-6 px-1.5 text-xs" onClick={() => { setDrafts(({ [k]: _d, ...r }) => r); void run(() => dbActions.removePriceOverride(b.id, p.id), 'Override cleared') }}>Clear</Button>}
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">{db.priceOverrides.length} active override(s) are highlighted.</p>
    </>
  )
}
