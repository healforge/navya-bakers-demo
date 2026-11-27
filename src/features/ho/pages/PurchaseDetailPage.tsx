import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PackageCheck, Pencil, Printer, Send, XCircle } from 'lucide-react'
import { EmptyState, Money, PageHeader, PrintArea, StatusBadge, printNow } from '@/components/common'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime, formatQty, round2 } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import { rawMaterialMap, supplierMap } from '@/store/selectors'
import { run } from '../components/shared'

export default function PurchaseDetailPage() {
  const { t } = useLanguage()
  const { id = '' } = useParams()
  const nav = useNavigate()
  const db = useDb((d) => d)
  const po = db.purchaseOrders.find((p) => p.id === id)
  const rm = useMemo(() => rawMaterialMap(db), [db])
  const [grnOpen, setGrnOpen] = useState(false)
  const [grn, setGrn] = useState<Record<string, string>>({})
  const [cancelOpen, setCancelOpen] = useState(false)
  const grns = useMemo(() => db.grns.filter((g) => g.poId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.grns, id])

  if (!po) return <EmptyState title={t('Purchase order not found')} action={<Button asChild variant="outline"><Link to="/ho/purchase">{t('Back to purchase')}</Link></Button>} />
  const supplier = supplierMap(db).get(po.supplierId)
  const total = round2(po.lines.reduce((s, l) => s + l.qty * l.rate, 0))
  const canReceive = po.status === 'sent' || po.status === 'partially_received'
  const remaining = (l: (typeof po.lines)[number]) => Math.max(0, Math.round((l.qty - l.receivedQty) * 1000) / 1000)

  const openGrn = () => { setGrn(Object.fromEntries(po.lines.map((l) => [l.rawMaterialId, String(remaining(l))]))); setGrnOpen(true) }
  const submitGrn = async () => {
    const lines = po.lines.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: Number(grn[l.rawMaterialId] || 0) })).filter((l) => l.qty > 0)
    if (await run(t, () => dbActions.receiveGRN(po.id, lines), 'Goods received')) setGrnOpen(false)
  }

  return (
    <>
      <PageHeader
        title={po.number}
        description={<span className="inline-flex items-center gap-2">{supplier?.name} {t('· ordered')} {formatDate(po.date)} {t('· expected')} {formatDate(po.expectedDate)} <StatusBadge status={po.status} /></span>}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/ho/purchase">{t('All POs')}</Link></Button>
            {po.status === 'draft' && <Button variant="outline" onClick={() => nav(`/ho/purchase/${po.id}/edit`)}><Pencil />{t('Edit')}</Button>}
            {po.status === 'draft' && <Button onClick={() => run(t, () => dbActions.sendPO(po.id), 'Purchase order sent')}><Send />{t('Send')}</Button>}
            {canReceive && <Button onClick={openGrn}><PackageCheck />{t('Receive goods')}</Button>}
            {(po.status === 'draft' || po.status === 'sent') && <Button variant="outline" onClick={() => setCancelOpen(true)}><XCircle />{t('Cancel PO')}</Button>}
            <Button variant="outline" onClick={printNow}><Printer />{t('Print')}</Button>
          </>
        }
      />

      <Card className="mb-4 no-print">
        <CardHeader><CardTitle>{t('Items')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{t('Material')}</TableHead><TableHead className="text-right">{t('Ordered')}</TableHead><TableHead className="text-right">{t('Received')}</TableHead><TableHead className="text-right">{t('Rate')}</TableHead><TableHead className="text-right">{t('Line total')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {po.lines.map((l) => (
                <TableRow key={l.rawMaterialId}>
                  <TableCell className="font-medium">{rm.get(l.rawMaterialId)?.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(l.qty, rm.get(l.rawMaterialId)?.unit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(l.receivedQty)}</TableCell>
                  <TableCell className="text-right"><Money value={l.rate} decimals /></TableCell>
                  <TableCell className="text-right"><Money value={l.qty * l.rate} decimals /></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={4} className="text-right">{t('Grand total')}</TableCell><TableCell className="text-right"><Money value={total} decimals /></TableCell></TableRow></TableFooter>
          </Table>
          {po.note && <p className="p-3 text-sm text-muted-foreground">{t('Note:')} {po.note}</p>}
        </CardContent>
      </Card>

      <Card className="mb-4 no-print">
        <CardHeader><CardTitle>{t('Goods received (GRN history)')}</CardTitle></CardHeader>
        <CardContent>
          {grns.length === 0 ? <p className="text-sm text-muted-foreground">{t('No goods received yet.')}</p> : (
            <div className="space-y-3">
              {grns.map((g) => (
                <div key={g.id} className="rounded-lg border p-3 text-sm">
                  <div className="mb-1 flex justify-between font-medium"><span>{g.number}</span><span className="text-muted-foreground">{formatDateTime(g.createdAt)}</span></div>
                  <ul className="text-muted-foreground">{g.lines.map((l) => <li key={l.rawMaterialId}>{rm.get(l.rawMaterialId)?.name}: {formatQty(l.qty, rm.get(l.rawMaterialId)?.unit)} @ <Money value={l.rate} decimals /></li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PrintArea size="A4" className="rounded-xl border bg-white p-8 text-black shadow-sm dark:bg-white">
        <div className="flex items-start justify-between border-b pb-4">
          <div><div className="text-xl font-bold">{db.settings.companyName}</div><div className="text-sm">{t('Central Kitchen, Angamaly')}</div></div>
          <div className="text-right"><div className="text-lg font-bold">{t('PURCHASE ORDER')}</div><div className="text-sm">{po.number}</div><div className="text-sm">{t('Date:')} {formatDate(po.date)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div><div className="font-semibold">{t('Supplier')}</div><div>{supplier?.name}</div><div>{supplier?.contactPerson} · {supplier?.phone}</div><div>{supplier?.city}</div>{supplier?.gstin && <div>GSTIN: {supplier.gstin}</div>}</div>
          <div className="text-right"><div>{t('Expected delivery:')} {formatDate(po.expectedDate)}</div></div>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-y text-left"><th className="py-2">#</th><th>{t('Item')}</th><th className="text-right">{t('Qty')}</th><th>{t('Unit')}</th><th className="text-right">{t('Rate')}</th><th className="text-right">{t('Amount')}</th></tr></thead>
          <tbody>
            {po.lines.map((l, i) => (
              <tr key={l.rawMaterialId} className="border-b"><td className="py-2">{i + 1}</td><td>{rm.get(l.rawMaterialId)?.name}</td><td className="text-right tabular-nums">{l.qty}</td><td>{rm.get(l.rawMaterialId)?.unit}</td><td className="text-right tabular-nums">{l.rate.toFixed(2)}</td><td className="text-right tabular-nums">{(l.qty * l.rate).toFixed(2)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={5} className="py-2 text-right">{t('Grand total')}</td><td className="text-right tabular-nums">₹{total.toFixed(2)}</td></tr></tfoot>
        </table>
        {po.note && <p className="mt-4 text-sm">{t('Note:')} {po.note}</p>}
        <div className="mt-16 w-56 border-t pt-1 text-sm">{t('Authorised signatory')}</div>
      </PrintArea>

      <Dialog open={grnOpen} onOpenChange={setGrnOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('Receive goods ·')} {po.number}</DialogTitle><DialogDescription>{t('Defaults to the remaining quantity. Reduce for a partial delivery.')}</DialogDescription></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>{t('Material')}</TableHead><TableHead className="text-right">{t('Remaining')}</TableHead><TableHead className="text-right">{t('Receiving now')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {po.lines.map((l) => (
                <TableRow key={l.rawMaterialId}>
                  <TableCell>{rm.get(l.rawMaterialId)?.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(remaining(l), rm.get(l.rawMaterialId)?.unit)}</TableCell>
                  <TableCell className="text-right"><Input type="number" min={0} step="any" disabled={remaining(l) === 0} className="ml-auto h-8 w-24 text-right" value={grn[l.rawMaterialId] ?? ''} onChange={(e) => setGrn((s) => ({ ...s, [l.rawMaterialId]: e.target.value }))} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter><Button variant="outline" onClick={() => setGrnOpen(false)}>{t('Cancel')}</Button><Button onClick={submitGrn}>{t('Confirm receipt')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} destructive title={t('Cancel {number}?', { number: po.number })} description={t('This cannot be undone.')} confirmLabel={t('Cancel PO')} onConfirm={async () => { await run(t, () => dbActions.cancelPO(po.id), 'Purchase order cancelled') }} />
    </>
  )
}
