export type CsvCell = string | number | boolean | null | undefined

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Rows → CSV text (header row first). */
export function toCSV(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

export function downloadCSV(filename: string, headers: string[], rows: CsvCell[][]): void {
  const blob = new Blob([toCSV(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
