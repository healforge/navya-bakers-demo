import { useMemo, useState } from 'react'
import { Printer, ReceiptText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { PrintArea, printNow } from '@/components/common/PrintArea'
import { Card, CardContent } from '@/components/ui/card'
import { useCurrentBranch } from '@/auth/session'
import { useDb } from '@/store/db'
import { todayISO } from '@/lib/dates'
import { formatDate, formatINR, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Bill } from '@/types/domain'
import { Receipt } from '../components/Receipt'
import { PAY_LABEL } from '../lib/utils'

export default function BillsPage() {
  const branch = useCurrentBranch()
  const bills = useDb((d) => d.bills)
  const users = useDb((d) => d.users)
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Bill | null>(null)

  const dates = useMemo(() => {
    const s = new Set<string>([today])
    for (const b of bills) if (b.branchId === branch.id) s.add(b.date)
    return [...s].sort().reverse()
  }, [bills, branch.id, today])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return bills
      .filter((b) => b.branchId === branch.id && (needle ? b.number.toLowerCase().includes(needle) : b.date === date))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [bills, branch.id, date, q])

  const total = list.reduce((s, b) => s + b.total, 0)
  const cashier = (b: Bill) => users.find((u) => u.id === b.cashierId)?.name ?? 'Cashier'

  return (
    <>
      <PageHeader title="Bills" description="Reprint receipts and look up sales. Itemised bills are kept for recent dates only." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-12 pl-10 text-base" placeholder="Search bill number (e.g. EDP-…-0012)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!!q}
          className="h-12 rounded-lg border border-input bg-background px-3 text-base disabled:opacity-50">
          {dates.map((d) => <option key={d} value={d}>{d === today ? 'Today · ' : ''}{formatDate(d)}</option>)}
        </select>
      </div>
      <div className="mb-3 text-sm text-muted-foreground">{list.length} bill{list.length === 1 ? '' : 's'} · {formatINR(total)}{q && ' (search across all dates)'}</div>
      {list.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No bills found" description={q ? 'No bill matches that number.' : 'No itemised bills for this date.'} />
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <button key={b.id} type="button" onClick={() => setSelected(b)} className="block w-full text-left">
              <Card className={cn('transition hover:border-primary/50')}>
                <CardContent className="flex items-center justify-between gap-3 py-1">
                  <div className="min-w-0">
                    <div className="font-medium">{b.number}</div>
                    <div className="truncate text-xs text-muted-foreground">{formatTime(b.createdAt)} · {b.lines.length} item{b.lines.length === 1 ? '' : 's'} · {PAY_LABEL[b.paymentMode]}{q && ` · ${formatDate(b.date)}`}</div>
                  </div>
                  <div className="font-heading text-lg font-semibold tabular-nums">{formatINR(b.total, { decimals: true })}</div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.number}</SheetTitle>
            <SheetDescription>Bill detail</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-3 px-4 pb-4">
              <div className="overflow-hidden rounded-lg border">
                <PrintArea size="80mm"><Receipt bill={selected} branch={branch} cashierName={cashier(selected)} /></PrintArea>
              </div>
              <Button className="no-print h-12 w-full" onClick={printNow}><Printer /> Reprint receipt</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
