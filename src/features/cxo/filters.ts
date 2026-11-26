import { create } from 'zustand'
import { useMemo } from 'react'
import { addDaysISO, isoRange, presetRange, todayISO, type DateRange, type RangePreset } from '@/lib/dates'
import { useDb } from '@/store/db'

interface CxoFilterState {
  preset: RangePreset
  /** empty = all active branches */
  branchIds: string[]
  setPreset: (p: RangePreset) => void
  setBranchIds: (ids: string[]) => void
}

/** Shared (non-persisted) CXO filters. */
export const useCxoFilters = create<CxoFilterState>((set) => ({
  preset: 'last30',
  branchIds: [],
  setPreset: (preset) => set({ preset }),
  setBranchIds: (branchIds) => set({ branchIds }),
}))

/** Make sure a trend chart has at least `minDays` points (e.g. "Today" would otherwise be one dot). */
export function trendRange(range: DateRange, minDays = 7): DateRange {
  const n = isoRange(range.from, range.to).length
  return n >= minDays ? range : { from: addDaysISO(range.to, -(minDays - 1)), to: range.to }
}

/** Filters resolved against today. `branchIds` is undefined for "all". */
export function useCxoScope() {
  const preset = useCxoFilters((s) => s.preset)
  const selected = useCxoFilters((s) => s.branchIds)
  const db = useDb((d) => d)
  const range = useMemo(() => presetRange(preset, todayISO()), [preset])
  const branchIds = selected.length ? selected : undefined
  const branches = useMemo(() => db.branches.filter((b) => b.active), [db.branches])
  const scopeIds = useMemo(() => branchIds ?? branches.map((b) => b.id), [branchIds, branches])
  return { db, preset, range, branchIds, branches, scopeIds }
}

/** Fixed colour per branch (follows the entity, not its rank). */
export function useBranchColors() {
  const branches = useDb((d) => d.branches)
  return useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b, i) => { m[b.id] = `var(--chart-${(i % 5) + 1})` })
    return m
  }, [branches])
}
