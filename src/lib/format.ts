import { format, parseISO as fnsParseISO } from 'date-fns'
import type { ISODate } from '@/types/domain'
import { parseISO } from './dates'

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

/** ₹1,23,456 (or ₹1,234.50 with decimals). */
export function formatINR(value: number, opts: { decimals?: boolean } = {}): string {
  const v = Number.isFinite(value) ? value : 0
  return (opts.decimals ? inr2 : inr0).format(v)
}

/** ₹1.2L / ₹3.4Cr / ₹12.5K / ₹950 */
export function formatINRCompact(value: number): string {
  const v = Number.isFinite(value) ? value : 0
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, '')
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`
  return `${sign}₹${Math.round(abs)}`
}

export function formatNumber(value: number): string {
  return num.format(Number.isFinite(value) ? value : 0)
}

/** Quantity with optional unit: 12.5 kg */
export function formatQty(value: number, unit?: string): string {
  const s = num.format(Math.round(value * 100) / 100)
  return unit ? `${s} ${unit}` : s
}

export function formatPct(value: number, digits = 1): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`
}

/** +4.2% / -3.1% */
export function formatDelta(value: number, digits = 1): string {
  const v = Number.isFinite(value) ? value : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/** 26 Nov 2026 */
export function formatDate(date: ISODate | string): string {
  const d = date.length === 10 ? parseISO(date) : fnsParseISO(date)
  return format(d, 'd MMM yyyy')
}

/** Thu, 26 Nov */
export function formatDateShort(date: ISODate): string {
  return format(parseISO(date), 'EEE, d MMM')
}

/** 26 Nov, 5:42 PM */
export function formatDateTime(iso: string): string {
  return format(fnsParseISO(iso), 'd MMM, h:mm a')
}

export function formatTime(iso: string): string {
  return format(fnsParseISO(iso), 'h:mm a')
}

/** Round to 2 dp (money). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
