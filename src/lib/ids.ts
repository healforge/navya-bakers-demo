export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Zero-padded document number, e.g. docNumber('DN', 123, 4) → 'DN-0123'. */
export function docNumber(prefix: string, n: number, width = 4): string {
  return `${prefix}-${String(n).padStart(width, '0')}`
}
