import { Link, useParams } from 'react-router'
import { Printer } from 'lucide-react'
import { EmptyState, PageHeader, PrintArea, StatusBadge, printNow } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDb } from '@/store/db'
import { branchMap, dispatchVarianceLines, productMap } from '@/store/selectors'
import { hoursSince } from '../components/shared'

export default function DispatchDetailPage() {
  const { id = '' } = useParams()
  const db = useDb((d) => d)
  const dn = db.dispatches.find((d) => d.id === id)
  if (!dn) return <EmptyState title="Dispatch note not found" action={<Button asChild variant="outline"><Link to="/ho/dispatch">Back to dispatch</Link></Button>} />

  const branch = branchMap(db).get(dn.branchId)
  const pm = productMap(db)
  const variance = dispatchVarianceLines(dn)
  const received = dn.status === 'received'
  const totals = variance.reduce((s, v) => ({ d: s.d + v.dispatched, r: s.r + v.received, x: s.x + v.damaged, s: s.s + v.short }), { d: 0, r: 0, x: 0, s: 0 })
  const plan = dn.planId ? db.productionPlans.find((p) => p.id === dn.planId) : undefined
  const receiver = dn.receivedBy ? db.users.find((u) => u.id === dn.receivedBy)?.name : undefined

  return (
    <>
      <PageHeader
        title={dn.number}
        description={<span className="inline-flex items-center gap-2">{branch?.name} · {formatDate(dn.date)} <StatusBadge status={dn.status} />{dn.status === 'in_transit' && <span>{hoursSince(dn.dispatchedAt).toFixed(1)} h in transit</span>}</span>}
        actions={<><Button variant="outline" asChild><Link to="/ho/dispatch">All dispatches</Link></Button><Button onClick={printNow}><Printer />Print delivery note</Button></>}
      />

      {received && (
        <Card className="mb-4 no-print">
          <CardHeader><CardTitle>Receipt variance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Dispatched</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Damaged</TableHead><TableHead className="text-right">Short</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
              <TableBody>
                {variance.map((v, i) => (
                  <TableRow key={v.productId} className={cn((v.short > 0 || v.damaged > 0) && 'bg-danger/10')}>
                    <TableCell className="font-medium">{pm.get(v.productId)?.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.dispatched}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.received}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.damaged || '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', v.short > 0 && 'font-semibold text-danger')}>{v.short || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{dn.lines[i]?.note ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right tabular-nums">{totals.d}</TableCell><TableCell className="text-right tabular-nums">{totals.r}</TableCell><TableCell className="text-right tabular-nums">{totals.x}</TableCell><TableCell className="text-right tabular-nums">{totals.s}</TableCell><TableCell /></TableRow></TableFooter>
            </Table>
            <p className="p-3 text-xs text-muted-foreground">Received {dn.receivedAt ? formatDateTime(dn.receivedAt) : ''}{receiver ? ` by ${receiver}` : ''}</p>
          </CardContent>
        </Card>
      )}

      <PrintArea size="A4" className="rounded-xl border bg-white p-8 text-black shadow-sm dark:bg-white">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-xl font-bold">{db.settings.companyName}</div>
            <div className="text-sm">Central Kitchen, Angamaly</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">DELIVERY NOTE</div>
            <div className="text-sm">{dn.number}</div>
            <div className="text-sm">Date: {formatDate(dn.date)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <div className="font-semibold">Deliver to</div>
            <div>{branch?.name} ({branch?.code})</div>
            <div>{branch?.address}</div>
            <div>{branch?.area}, {branch?.city}</div>
            <div>{branch?.phone}</div>
          </div>
          <div className="text-right">
            {plan && <div>Production plan: {plan.number}</div>}
            <div>Vehicle: {dn.vehicle || '—'}</div>
            <div>Dispatched: {formatDateTime(dn.dispatchedAt)}</div>
          </div>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y text-left"><th className="py-2">#</th><th>SKU</th><th>Item</th><th className="text-right">Qty</th><th className="text-right">Received</th><th className="text-right">Damaged</th></tr>
          </thead>
          <tbody>
            {dn.lines.map((l, i) => (
              <tr key={l.productId} className="border-b">
                <td className="py-2">{i + 1}</td><td>{pm.get(l.productId)?.sku}</td><td>{pm.get(l.productId)?.name}</td>
                <td className="text-right tabular-nums">{l.qtyDispatched}</td>
                <td className="text-right tabular-nums">{received ? l.qtyReceived ?? 0 : '______'}</td>
                <td className="text-right tabular-nums">{received ? l.qtyDamaged ?? 0 : '______'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={3} className="py-2 text-right">Total units</td><td className="text-right tabular-nums">{totals.d}</td><td /><td /></tr></tfoot>
        </table>
        <div className="mt-16 grid grid-cols-3 gap-8 text-sm">
          <div className="border-t pt-1">Dispatched by</div>
          <div className="border-t pt-1">Driver signature</div>
          <div className="border-t pt-1">Received by (branch)</div>
        </div>
      </PrintArea>
    </>
  )
}
