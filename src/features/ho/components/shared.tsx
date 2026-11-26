import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Run an action; toast the error message on failure, optional success toast. Returns true on success. */
export async function run(fn: () => unknown | Promise<unknown>, success?: string): Promise<boolean> {
  try {
    await fn()
    if (success) toast.success(success)
    return true
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Something went wrong')
    return false
  }
}

/** Label + control + error text (there is no shadcn `form` component). */
export function FormRow({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}

export function marginTone(pct: number): string {
  if (pct >= 50) return 'text-success'
  if (pct >= 30) return 'text-warning-foreground dark:text-warning'
  return 'text-danger'
}

export const numOrNaN = (s: string): number => (s.trim() === '' ? NaN : Number(s))

export function hoursSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, (now - new Date(iso).getTime()) / 36e5)
}

/** Passed via router `state` to /ho/purchase/new to pre-fill the PO form. */
export interface POPrefill {
  supplierId?: string
  lines: { rawMaterialId: string; qty: number; rate: number }[]
}
