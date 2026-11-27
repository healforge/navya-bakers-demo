import { useLanguage } from '@/i18n/useLanguage'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Touch-friendly +/- control with an editable number in the middle. */
export function Stepper({
  value, onChange, min = 0, max, disabled, className, ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  const { t } = useLanguage()
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, Math.floor(Number.isFinite(n) ? n : min)))
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Button type="button" variant="outline" className="size-11 shrink-0" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))} aria-label={t('Decrease {label}', { label: ariaLabel ?? '' })}>
        <Minus className="size-5" />
      </Button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, ''))))}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 w-14 rounded-lg border border-input bg-transparent text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      />
      <Button type="button" variant="outline" className="size-11 shrink-0" disabled={disabled || (max !== undefined && value >= max)} onClick={() => onChange(clamp(value + 1))} aria-label={t('Increase {label}', { label: ariaLabel ?? '' })}>
        <Plus className="size-5" />
      </Button>
    </div>
  )
}
