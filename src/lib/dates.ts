import { addDays, format, getDay, parse } from 'date-fns'
import type { ISODate } from '@/types/domain'

const FMT = 'yyyy-MM-dd'

/** Local date as YYYY-MM-DD. */
export function toISODate(d: Date): ISODate {
  return format(d, FMT)
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now)
}

export function parseISO(date: ISODate): Date {
  return parse(date, FMT, new Date(2000, 0, 1))
}

export function addDaysISO(date: ISODate, n: number): ISODate {
  return toISODate(addDays(parseISO(date), n))
}

/** Inclusive list of dates from..to. */
export function isoRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  let cur = from
  let guard = 0
  while (cur <= to && guard++ < 4000) {
    out.push(cur)
    cur = addDaysISO(cur, 1)
  }
  return out
}

/** Number of days between two ISO dates (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: ISODate): number {
  return getDay(parseISO(date))
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function isWeekend(date: ISODate): boolean {
  const w = weekdayOf(date)
  return w === 0 || w === 6
}

/** yyMMdd, used in bill numbers. */
export function compactDate(date: ISODate): string {
  return format(parseISO(date), 'yyMMdd')
}

/** Combine ISO date + 'HH:mm' into a Date. */
export function atTime(date: ISODate, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseISO(date)
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d
}

export interface DateRange {
  from: ISODate
  to: ISODate
}

export function rangeLength(r: DateRange): number {
  return diffDays(r.from, r.to) + 1
}

/** The equal-length period immediately before `r`. */
export function previousRange(r: DateRange): DateRange {
  const n = rangeLength(r)
  return { from: addDaysISO(r.from, -n), to: addDaysISO(r.from, -1) }
}

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'mtd' | 'last90'

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 d' },
  { value: 'last30', label: 'Last 30 d' },
  { value: 'mtd', label: 'MTD' },
  { value: 'last90', label: 'Last 90 d' },
]

/** Resolve a preset relative to `today`. */
export function presetRange(preset: RangePreset, today: ISODate = todayISO()): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = addDaysISO(today, -1)
      return { from: y, to: y }
    }
    case 'last7':
      return { from: addDaysISO(today, -6), to: today }
    case 'last30':
      return { from: addDaysISO(today, -29), to: today }
    case 'mtd':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'last90':
      return { from: addDaysISO(today, -89), to: today }
  }
}
