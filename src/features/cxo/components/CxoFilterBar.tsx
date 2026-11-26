import { SlidersHorizontal } from 'lucide-react'
import { BranchSelect } from '@/components/common/BranchSelect'
import { DateRangeSelect } from '@/components/common/DateRangeSelect'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { RANGE_PRESETS } from '@/lib/dates'
import { useCxoFilters } from '../filters'

/** Desktop: inline controls. Phone: one button opening a Sheet. */
export function CxoFilterBar() {
  const { preset, branchIds, setPreset, setBranchIds } = useCxoFilters()
  const presetLabel = RANGE_PRESETS.find((p) => p.value === preset)?.label ?? ''
  const branchLabel = branchIds.length === 0 ? 'All branches' : `${branchIds.length} branch${branchIds.length > 1 ? 'es' : ''}`
  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <DateRangeSelect value={preset} onChange={setPreset} />
        <BranchSelect mode="multi" value={branchIds} onChange={setBranchIds} />
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 sm:hidden"><SlidersHorizontal /> {presetLabel} · {branchLabel}</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="gap-3 p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Applies to all CXO pages.</SheetDescription>
          </SheetHeader>
          <div className="space-y-1 text-xs text-muted-foreground">Period</div>
          <DateRangeSelect value={preset} onChange={setPreset} />
          <div className="space-y-1 text-xs text-muted-foreground">Branches</div>
          <BranchSelect mode="multi" value={branchIds} onChange={setBranchIds} className="w-full justify-between" />
        </SheetContent>
      </Sheet>
    </>
  )
}
