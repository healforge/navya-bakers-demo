import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useState } from 'react'
import { Banknote, CreditCard, Smartphone } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentMode } from '@/types/domain'

const MODES: { value: PaymentMode; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
]
const QUICK = [100, 200, 500, 2000]

export function PaymentDialog({ open, onOpenChange, total, onConfirm }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  total: number
  /** return true when the bill was created (dialog closes) */
  onConfirm: (mode: PaymentMode, tendered?: number) => boolean
}) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [tendered, setTendered] = useState('')
  useEffect(() => { if (open) { setMode('cash'); setTendered('') } }, [open])

  const received = Number(tendered) || 0
  const change = Math.max(0, received - total)
  const short = mode === 'cash' && received < total
  const confirm = () => { if (onConfirm(mode, mode === 'cash' ? received : undefined)) onOpenChange(false) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Collect payment')}</DialogTitle>
          <DialogDescription>{t('Amount due')}</DialogDescription>
        </DialogHeader>
        <div className="text-center font-heading text-4xl font-bold tabular-nums">{formatINR(total, { decimals: true })}</div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => setMode(m.value)}
              className={cn('flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition', mode === m.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>
              <m.icon className="size-5" />{t(m.label)}
            </button>
          ))}
        </div>
        {mode === 'cash' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="tendered" className="mb-1 block text-sm text-muted-foreground">{t('Cash received')}</label>
              <Input id="tendered" inputMode="decimal" autoFocus className="h-14 text-right text-2xl font-semibold" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-12" onClick={() => setTendered(String(Math.ceil(total)))}>{t('Exact')}</Button>
              {QUICK.map((q) => (
                <Button key={q} variant="outline" className="h-12" onClick={() => setTendered(String(q))}>{formatINR(q)}</Button>
              ))}
            </div>
            <div className={cn('flex items-center justify-between rounded-lg p-3 text-lg font-semibold', short ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success')}>
              <span>{short && received > 0 ? t('Short by') : t('Change')}</span>
              <span className="tabular-nums">{formatINR(short ? Math.max(0, total - received) : change, { decimals: true })}</span>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
            {mode === 'upi' ? t('Ask the customer to scan the shop QR and confirm the payment is received.') : t('Complete the payment on the card machine, then confirm.')}
          </p>
        )}
        <DialogFooter>
          <Button className="h-12 w-full text-base" disabled={short} onClick={confirm}>{t('Complete sale')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
