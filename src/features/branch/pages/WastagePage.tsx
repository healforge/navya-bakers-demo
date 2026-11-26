import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCurrentBranch, useRequireUser } from '@/auth/session'
import { useDb, dbActions } from '@/store/db'
import { branchBatches, effectivePrice, expiredBatches, productName } from '@/store/selectors'
import { todayISO } from '@/lib/dates'
import { formatDate, formatINR, formatTime } from '@/lib/format'
import { WASTAGE_REASONS, type WastageReason } from '@/types/domain'
import { Textarea } from '@/components/ui/textarea'
import { Stepper } from '../components/Stepper'
import { run } from '../lib/utils'

const AUTO = '__auto'

export default function WastagePage() {
  const branch = useCurrentBranch()
  const user = useRequireUser()
  const db = useDb((d) => d)
  const today = todayISO()

  const [productId, setProductId] = useState('')
  const [batchId, setBatchId] = useState(AUTO)
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState<WastageReason>('Damaged')
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const stocked = useMemo(() => {
    const ids = new Set(branchBatches(db, branch.id).map((b) => b.productId))
    return db.products.filter((p) => ids.has(p.id))
  }, [db, branch.id])
  const batches = useMemo(() => (productId ? branchBatches(db, branch.id, productId) : []), [db, branch.id, productId])
  const max = batchId !== AUTO ? (batches.find((b) => b.id === batchId)?.qtyRemaining ?? 0) : batches.reduce((s, b) => s + b.qtyRemaining, 0)
  const unit = productId ? effectivePrice(db, branch.id, productId) : 0

  const expired = useMemo(() => expiredBatches(db, branch.id, today), [db, branch.id, today])
  const expiredQty = expired.reduce((s, b) => s + b.qtyRemaining, 0)
  const expiredValue = expired.reduce((s, b) => s + b.qtyRemaining * effectivePrice(db, branch.id, b.productId), 0)

  const entries = useMemo(() => db.wastage.filter((w) => w.branchId === branch.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30), [db.wastage, branch.id])
  const todayValue = entries.filter((e) => e.date === today).reduce((s, e) => s + e.valueAtMRP, 0)

  const record = () => {
    if (!productId) return void run(() => { throw new Error('Choose a product') })
    const ok = run(() => { dbActions.recordWastage({ branchId: branch.id, productId, qty, reason, batchId: batchId === AUTO ? undefined : batchId, note: note || undefined, userId: user.id }) }, 'Wastage recorded')
    if (ok) { setQty(1); setNote(''); setBatchId(AUTO) }
  }

  return (
    <>
      <PageHeader title="Wastage" description="Record spoiled or damaged stock. Value shown at MRP." actions={
        <Button variant="destructive" className="h-11" disabled={expired.length === 0} onClick={() => setConfirmOpen(true)}>
          <Trash2 /> Write off all expired{expired.length > 0 && ` (${expiredQty})`}
        </Button>
      } />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader><CardTitle>Record wastage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId} onValueChange={(v) => { setProductId(v); setBatchId(AUTO); setQty(1) }}>
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{stocked.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {productId && (
              <div className="space-y-1.5">
                <Label>Batch (optional)</Label>
                <Select value={batchId} onValueChange={(v) => { setBatchId(v); setQty(1) }}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>Auto (expired first, then FIFO)</SelectItem>
                    {batches.map((b) => <SelectItem key={b.id} value={b.id}>Exp {formatDate(b.expiryDate)} · {b.qtyRemaining} left{b.expiryDate < today ? ' · expired' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Quantity {productId && <span className="text-muted-foreground">(max {max})</span>}</Label>
              <Stepper value={qty} min={1} max={Math.max(1, max)} onChange={setQty} ariaLabel="quantity" />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as WastageReason)}>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{WASTAGE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wnote">Note</Label>
              <Textarea id="wnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Value at MRP</span>
              <span className="font-heading text-lg font-semibold tabular-nums">{formatINR(qty * unit, { decimals: true })}</span>
            </div>
            <Button className="h-12 w-full" disabled={!productId || max === 0} onClick={record}>Record wastage</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent entries</CardTitle>
            <CardDescription>Today: {formatINR(todayValue)} wasted{expired.length > 0 && ` · ${expiredQty} expired units pending (${formatINR(expiredValue)})`}</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? <EmptyState icon={Trash2} title="No wastage recorded" /> : (
              <div className="divide-y">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{productName(db, e.productId)} × {e.qty}</div>
                      <div className="truncate text-xs text-muted-foreground">{e.date === today ? 'Today' : formatDate(e.date)} {formatTime(e.createdAt)} · {e.reason}{e.note ? ` · ${e.note}` : ''}</div>
                    </div>
                    <div className="font-semibold tabular-nums text-danger">{formatINR(e.valueAtMRP, { decimals: true })}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} destructive title="Write off all expired stock?"
        description={`${expiredQty} units across ${expired.length} batch${expired.length === 1 ? '' : 'es'} (${formatINR(expiredValue)} at MRP) will be removed from stock and logged as wastage.`}
        confirmLabel="Write off" onConfirm={() => { run(() => { const r = dbActions.writeOffExpired(branch.id, user.id); toast.success(`Wrote off ${r.length} expired batch${r.length === 1 ? '' : 'es'}`) }) }} />
    </>
  )
}
