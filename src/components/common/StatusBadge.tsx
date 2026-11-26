import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-chart-4/15 text-chart-4',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/25 text-warning-foreground dark:text-warning',
  danger: 'bg-danger/15 text-danger',
}

/** Every status in domain types (+ alert severities, stock/day states). */
const STATUS: Record<string, [string, Tone]> = {
  // IndentStatus
  draft: ['Draft', 'neutral'], submitted: ['Submitted', 'info'], in_production: ['In production', 'warning'],
  dispatched: ['Dispatched', 'info'], received: ['Received', 'success'],
  // PlanStatus
  confirmed: ['Confirmed', 'info'], completed: ['Completed', 'success'],
  // DispatchStatus
  in_transit: ['In transit', 'warning'],
  // POStatus
  sent: ['Sent', 'info'], partially_received: ['Partially received', 'warning'], cancelled: ['Cancelled', 'danger'],
  // alert severities
  critical: ['Critical', 'danger'], warning: ['Warning', 'warning'], info: ['Info', 'info'],
  // misc
  late: ['Late', 'danger'], missing: ['Missing', 'danger'], open: ['Open', 'success'], closed: ['Closed', 'neutral'],
  ok: ['OK', 'success'], low: ['Low', 'warning'], out: ['Out', 'danger'], expired: ['Expired', 'danger'], expiring: ['Expiring', 'warning'],
  active: ['Active', 'success'], inactive: ['Inactive', 'neutral'],
}

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const [text, tone] = STATUS[status] ?? [status, 'neutral' as Tone]
  return <Badge variant="outline" className={cn('border-transparent font-medium', TONE[tone], className)}>{label ?? text}</Badge>
}
