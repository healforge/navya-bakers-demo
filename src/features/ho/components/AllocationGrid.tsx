import { useMemo, useState } from 'react'
import { Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { dbActions, useDb } from '@/store/db'
import { branchName, productName, proposeAllocation } from '@/store/selectors'
import { run } from './shared'

const key = (b: string, p: string) => `${b}|${p}`

/** Editable branch × product allocation grid for a completed production plan. */
export function AllocationGrid({ planId, onCreated }: { planId: string; onCreated?: (ids: string[]) => void }) {
  const db = useDb((d) => d)
  const plan = db.productionPlans.find((p) => p.id === planId)
  const proposal = useMemo(() => (plan ? proposeAllocation(db, planId) : []), [db, plan, planId])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [vehicle, setVehicle] = useState('')

  const { branchIds, productIds } = useMemo(() => {
    const bs = new Set(proposal.map((r) => r.branchId))
    const ps = new Set(proposal.map((r) => r.productId))
    return {
      branchIds: db.branches.filter((b) => bs.has(b.id)).map((b) => b.id),
      productIds: db.products.filter((p) => ps.has(p.id)).map((p) => p.id),
    }
  }, [db, proposal])

  if (!plan) return null
  const cell = (b: string, p: string): number => {
    const v = vals[key(b, p)]
    if (v !== undefined) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
    return proposal.find((r) => r.branchId === b && r.productId === p)?.allocatedQty ?? 0
  }
  const indent = (b: string, p: string) => proposal.find((r) => r.branchId === b && r.productId === p)?.indentQty
  const produced = (p: string) => { const l = plan.lines.find((x) => x.productId === p); return l ? l.producedQty ?? l.plannedQty : 0 }
  const rowTotal = (p: string) => branchIds.reduce((s, b) => s + cell(b, p), 0)
  const colTotal = (b: string) => productIds.reduce((s, p) => s + cell(b, p), 0)
  const over = productIds.some((p) => rowTotal(p) > produced(p))

  const submit = async () => {
    const allocations = branchIds.flatMap((b) => productIds.map((p) => ({ branchId: b, productId: p, allocatedQty: cell(b, p) })))
    let ids: string[] = []
    if (await run(() => { ids = dbActions.createDispatches(planId, allocations, vehicle.trim() || undefined) }, 'Dispatch notes created')) onCreated?.(ids)
  }

  if (!productIds.length) return <p className="text-sm text-muted-foreground">No indents were in production for this plan; use an ad-hoc dispatch instead.</p>

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card">Product</TableHead>
              {branchIds.map((b) => <TableHead key={b} className="text-right">{branchName(db, b)}</TableHead>)}
              <TableHead className="text-right">Allocated / Produced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productIds.map((p) => {
              const tot = rowTotal(p), prod = produced(p)
              return (
                <TableRow key={p}>
                  <TableCell className="sticky left-0 bg-card font-medium">{productName(db, p)}</TableCell>
                  {branchIds.map((b) => {
                    const ind = indent(b, p)
                    return (
                      <TableCell key={b} className="text-right">
                        <Input
                          type="number" min={0} step={1} aria-label={`${productName(db, p)} to ${branchName(db, b)}`}
                          className="ml-auto h-8 w-20 text-right tabular-nums" value={vals[key(b, p)] ?? String(cell(b, p))}
                          onChange={(e) => setVals((s) => ({ ...s, [key(b, p)]: e.target.value }))}
                        />
                        {ind !== undefined && <div className="mt-0.5 text-[11px] text-muted-foreground">asked {ind}</div>}
                      </TableCell>
                    )
                  })}
                  <TableCell className={cn('text-right tabular-nums', tot > prod ? 'font-semibold text-danger' : tot < prod ? 'text-warning-foreground dark:text-warning' : 'text-success')}>{tot} / {prod}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="sticky left-0 bg-muted">Branch total</TableCell>
              {branchIds.map((b) => <TableCell key={b} className="text-right tabular-nums">{colTotal(b)}</TableCell>)}
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Vehicle (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="w-52" />
        <Button onClick={submit} disabled={over}><Truck />Create dispatch notes</Button>
        {over && <span className="text-sm text-danger">Allocated quantity exceeds produced for a product.</span>}
      </div>
    </div>
  )
}
