import { useLanguage } from '@/i18n/useLanguage'
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
  const { t } = useLanguage()
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
    if (!productId) return void run(t, () => { throw new Error('Choose a product') })
    const ok = run(t, () => { dbActions.recordWastage({ branchId: branch.id, productId, qty, reason, batchId: batchId === AUTO ? undefined : batchId, note: note || undefined, userId: user.id }) }, 'Wastage recorded')
    if (ok) { setQty(1); setNote(''); setBatchId(AUTO) }
  }

  return (
    <>
      <PageHeader title={t('Wastage')} description={t('Record spoiled or damaged stock. Value shown at MRP.')} actions={
        <Button variant="destructive" className="h-11" disabled={expired.length === 0} onClick={() => setConfirmOpen(true)}>
          <Trash2 /> {t('Write off all expired')}{expired.length > 0 && ` (${expiredQty})`}
        </Button>
      } />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card>
          <CardHeader><CardTitle>{t('Record wastage')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('Product')}</Label>
              <Select value={productId} onValueChange={(v) => { setProductId(v); setBatchId(AUTO); setQty(1) }}>
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder={t('Select product')} /></SelectTrigger>
                <SelectContent>{stocked.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {productId && (
              <div className="space-y-1.5">
                <Label>{t('Batch (optional)')}</Label>
                <Select value={batchId} onValueChange={(v) => { setBatchId(v); setQty(1) }}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>{t('Auto (expired first, then FIFO)')}</SelectItem>
                    {batches.map((b) => <SelectItem key={b.id} value={b.id}>{t('Exp')} {formatDate(b.expiryDate)} · {b.qtyRemaining} {t('left')}{b.expiryDate < today ? t(' · expired') : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t('Quantity')} {productId && <span className="text-muted-foreground">{t('(max')} {max})</span>}</Label>
              <Stepper value={qty} min={1} max={Math.max(1, max)} onChange={setQty} ariaLabel="quantity" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Reason')}</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as WastageReason)}>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{WASTAGE_REASONS.map((r) => <SelectItem key={r} value={r}>{t(r)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wnote">{t('Note')}</Label>
              <Textarea id="wnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
              <span className="text-muted-foreground">{t('Value at MRP')}</span>
              <span className="font-heading text-lg font-semibold tabular-nums">{formatINR(qty * unit, { decimals: true })}</span>
            </div>
            <Button className="h-12 w-full" disabled={!productId || max === 0} onClick={record}>{t('Record wastage')}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Recent entries')}</CardTitle>
            <CardDescription>{t('Today:')} {formatINR(todayValue)} {t('wasted')}{expired.length > 0 && t(' · {count} expired units pending ({amount})', { count: expiredQty, amount: formatINR(expiredValue) })}</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? <EmptyState icon={Trash2} title={t('No wastage recorded')} /> : (
              <div className="divide-y">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{productName(db, e.productId)} × {e.qty}</div>
                      <div className="truncate text-xs text-muted-foreground">{e.date === today ? t('Today') : formatDate(e.date)} {formatTime(e.createdAt)} · {t(e.reason)}{e.note ? ` · ${e.note}` : ''}</div>
                    </div>
                    <div className="font-semibold tabular-nums text-danger">{formatINR(e.valueAtMRP, { decimals: true })}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} destructive title={t('Write off all expired stock?')}
        description={t('{count} units across {batches} batch{plural} ({amount} at MRP) will be removed from stock and logged as wastage.', { count: expiredQty, batches: expired.length, plural: expired.length === 1 ? '' : 'es', amount: formatINR(expiredValue) })}
        confirmLabel={t('Write off')} onConfirm={() => { run(t, () => { const r = dbActions.writeOffExpired(branch.id, user.id); toast.success(t('Wrote off {count} expired batch{plural}', { count: r.length, plural: r.length === 1 ? '' : 'es' })) }) }} />
    </>
  )
}
