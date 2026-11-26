import { Download } from 'lucide-react'
import { EmptyState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCSV } from '@/lib/csv'
import { formatINR, formatNumber, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

export type ColKind = 'text' | 'inr' | 'num' | 'pct' | 'signedInr'
export type Cell = string | number | null

function fmt(v: Cell, kind: ColKind): string {
  if (v === null || v === '') return '—'
  if (typeof v === 'string') return v
  switch (kind) {
    case 'inr': return formatINR(v)
    case 'signedInr': return `${v > 0 ? '+' : ''}${formatINR(v)}`
    case 'pct': return formatPct(v)
    case 'num': return formatNumber(v)
    default: return String(v)
  }
}

/** Generic report table with sticky-less simple layout, optional totals row and CSV export. */
export function ReportTable({ filename, headers, kinds, rows, totals }: { filename: string; headers: string[]; kinds: ColKind[]; rows: Cell[][]; totals?: Cell[] }) {
  if (rows.length === 0) return <EmptyState title="No data for the selected filters" />
  const exportCsv = () => downloadCSV(filename, headers, totals ? [...rows, totals] : rows)
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><Button variant="outline" size="sm" onClick={exportCsv}><Download />Export CSV</Button></div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>{headers.map((h, i) => <TableHead key={h + i} className={cn(kinds[i] !== 'text' && 'text-right')}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map((r, ri) => (
              <TableRow key={ri}>{r.map((c, i) => <TableCell key={i} className={cn(kinds[i] !== 'text' && 'text-right tabular-nums', kinds[i] === 'signedInr' && typeof c === 'number' && c !== 0 && (c < 0 ? 'text-danger' : 'text-success'))}>{fmt(c, kinds[i] ?? 'text')}</TableCell>)}</TableRow>
            ))}
          </TableBody>
          {totals && <TableFooter><TableRow>{totals.map((c, i) => <TableCell key={i} className={cn(kinds[i] !== 'text' && 'text-right tabular-nums')}>{fmt(c, kinds[i] ?? 'text')}</TableCell>)}</TableRow></TableFooter>}
        </Table>
      </div>
    </div>
  )
}
