import { useMemo, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { presetRange, RANGE_PRESETS, todayISO, type DateRange, type RangePreset } from '@/lib/dates'

export function DateRangeSelect({ value, onChange, className }: { value: RangePreset; onChange: (preset: RangePreset) => void; className?: string }) {
  return (
    <div className={`max-w-full overflow-x-auto ${className ?? ''}`}>
      <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={(v) => v && onChange(v as RangePreset)} spacing={0}>
        {RANGE_PRESETS.map((p) => (
          <ToggleGroupItem key={p.value} value={p.value} className="px-3">{p.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** State helper: `const { preset, setPreset, range } = useDateRange('last7')` */
export function useDateRange(initial: RangePreset = 'last7'): { preset: RangePreset; setPreset: (p: RangePreset) => void; range: DateRange } {
  const [preset, setPreset] = useState<RangePreset>(initial)
  const range = useMemo(() => presetRange(preset, todayISO()), [preset])
  return { preset, setPreset, range }
}
