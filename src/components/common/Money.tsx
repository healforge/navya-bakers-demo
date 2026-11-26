import { formatINR, formatINRCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Money({ value, compact, decimals, className }: { value: number; compact?: boolean; decimals?: boolean; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{compact ? formatINRCompact(value) : formatINR(value, { decimals })}</span>
}
