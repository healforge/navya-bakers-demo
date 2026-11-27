import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { BranchSelect } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dbActions, useDb } from '@/store/db'
import { FormRow, run } from './shared'

interface Line { productId: string; qty: string }

export function AdhocDispatchDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (id: string) => void }) {
  const { t } = useLanguage()
  const products = useDb((d) => d.products)
  const branches = useDb((d) => d.branches)
  const active = useMemo(() => products.filter((p) => p.active), [products])
  const [branchId, setBranchId] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [lines, setLines] = useState<Line[]>([{ productId: '', qty: '' }])
  const firstBranch = branches.find((b) => b.active)?.id ?? ''

  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const submit = async () => {
    let id = ''
    const ok = await run(t, () => {
      id = dbActions.createAdhocDispatch(branchId || firstBranch, lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: Number(l.qty) })), vehicle.trim() || undefined)
    }, 'Ad-hoc dispatch created')
    if (ok) { onOpenChange(false); setLines([{ productId: '', qty: '' }]); setVehicle(''); onCreated?.(id) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Ad-hoc dispatch')}</DialogTitle>
          <DialogDescription>{t('Top-up delivery without an indent.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label={t('Branch')}><BranchSelect value={branchId || firstBranch} onChange={setBranchId} className="w-full" /></FormRow>
            <FormRow label={t('Vehicle (optional)')}><Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} /></FormRow>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={l.productId} onValueChange={(v) => set(i, { productId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={t('Product')} /></SelectTrigger>
                  <SelectContent>{active.map((p) => <SelectItem key={p.id} value={p.id} disabled={lines.some((x, j) => j !== i && x.productId === p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min={1} step={1} placeholder={t('Qty')} className="w-24" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} />
                <Button variant="ghost" size="icon" aria-label={t('Remove line')} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><X /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { productId: '', qty: '' }])}><Plus />{t('Add item')}</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={submit}>{t('Create dispatch')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
