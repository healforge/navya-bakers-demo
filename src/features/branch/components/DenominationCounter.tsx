import { useLanguage } from '@/i18n/useLanguage'
import { Input } from '@/components/ui/input'
import { formatINR } from '@/lib/format'
import { Stepper } from './Stepper'

export const NOTES = [500, 200, 100, 50, 20, 10] as const

/** counts keyed by denomination ('500'…'10'); `coins` is a ₹ amount. */
export interface Denoms { counts: Record<string, number>; coins: number }
export const emptyDenoms = (): Denoms => ({ counts: {}, coins: 0 })
export const denomTotal = (d: Denoms) => NOTES.reduce((s, n) => s + n * (d.counts[String(n)] ?? 0), 0) + d.coins
export const denomRecord = (d: Denoms): Record<string, number> => ({ ...d.counts, coins: d.coins })

export function DenominationCounter({ value, onChange, disabled }: { value: Denoms; onChange: (d: Denoms) => void; disabled?: boolean }) {
  const { t } = useLanguage()
  return (
    <div className="space-y-2">
      {NOTES.map((n) => {
        const c = value.counts[String(n)] ?? 0
        return (
          <div key={n} className="flex items-center justify-between gap-2">
            <div className="w-24 text-sm font-medium">{formatINR(n)} <span className="text-muted-foreground">×</span></div>
            <Stepper value={c} disabled={disabled} onChange={(v) => onChange({ ...value, counts: { ...value.counts, [String(n)]: v } })} ariaLabel={`₹${n} notes`} />
            <div className="w-20 text-right text-sm tabular-nums text-muted-foreground">{formatINR(n * c)}</div>
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-2">
        <div className="w-24 text-sm font-medium">{t('Coins (₹)')}</div>
        <Input inputMode="numeric" className="h-11 w-[8.25rem] text-center text-base font-semibold" disabled={disabled} value={value.coins || ''} placeholder="0"
          onChange={(e) => onChange({ ...value, coins: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
        <div className="w-20 text-right text-sm tabular-nums text-muted-foreground">{formatINR(value.coins)}</div>
      </div>
    </div>
  )
}
