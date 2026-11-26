import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IndentStatus } from '@/types/domain'

const STEPS: { key: IndentStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' }, { key: 'submitted', label: 'Submitted' }, { key: 'in_production', label: 'In production' },
  { key: 'dispatched', label: 'Dispatched' }, { key: 'received', label: 'Received' },
]

export function IndentTimeline({ status }: { status: IndentStatus | null }) {
  const idx = status ? STEPS.findIndex((s) => s.key === status) : -1
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const done = i < idx, current = i === idx
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
            <div className="flex w-full items-center">
              <div className={cn('h-0.5 flex-1', i === 0 ? 'bg-transparent' : i <= idx ? 'bg-primary' : 'bg-border')} />
              <div className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                done && 'border-primary bg-primary text-primary-foreground', current && 'border-primary bg-background text-primary ring-4 ring-primary/20', !done && !current && 'border-border bg-background text-muted-foreground')}>
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              <div className={cn('h-0.5 flex-1', i === STEPS.length - 1 ? 'bg-transparent' : i < idx ? 'bg-primary' : 'bg-border')} />
            </div>
            <span className={cn('text-[11px] leading-tight sm:text-xs', current ? 'font-semibold' : 'text-muted-foreground')}>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
