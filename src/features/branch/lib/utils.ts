import { useEffect, useState } from 'react'
import type { Translate } from '@/i18n/translations'
import { toast } from 'sonner'

/** Re-renders every `ms` with the current time (for countdowns, "today" rollover). */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Runs an action; toasts the error message on failure (and `ok` on success). Returns success. */
export function run(t: Translate, fn: () => void, ok?: string): boolean {
  try {
    fn()
    if (ok) toast.success(t(ok))
    return true
  } catch (e) {
    toast.error(t(e instanceof Error ? e.message : String(e)))
    return false
  }
}

export function countdownLabel(ms: number, t: Translate): string {
  const m = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60
  if (d > 0) return t('{days}d {hours}h {minutes}m', { days: d, hours: h, minutes: mm })
  if (h > 0) return t('{hours}h {minutes}m', { hours: h, minutes: mm })
  return t('{minutes}m', { minutes: mm })
}

export const PAY_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card' } as const
