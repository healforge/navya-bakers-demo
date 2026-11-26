import { useMemo, useState } from 'react'
import { Lock, LockOpen, Trash2, Plus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCurrentBranch, useRequireUser } from '@/auth/session'
import { useDb, dbActions } from '@/store/db'
import { getDayCloseSummary } from '@/store/selectors'
import { todayISO } from '@/lib/dates'
import { formatDate, formatINR, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types/domain'
import { DenominationCounter, denomRecord, denomTotal, emptyDenoms } from '../components/DenominationCounter'
import { run } from '../lib/utils'

function varianceTone(v: number, threshold: number) {
  const a = Math.abs(v)
  if (a < 0.5) return 'text-success bg-success/15'
  if (a <= threshold) return 'text-warning-foreground bg-warning/25 dark:text-warning'
  return 'text-danger bg-danger/15'
}

const Row = ({ label, value, strong, neg }: { label: string; value: number; strong?: boolean; neg?: boolean }) => (
  <div className={cn('flex items-center justify-between py-1.5 text-sm', strong && 'border-t pt-2.5 text-base font-semibold')}>
    <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
    <span className="tabular-nums">{neg && value > 0 ? '− ' : ''}{formatINR(value, { decimals: true })}</span>
  </div>
)

export default function DayEndPage() {
  const branch = useCurrentBranch()
  const user = useRequireUser()
  const db = useDb((d) => d)
  const today = todayISO()
  const summary = useMemo(() => getDayCloseSummary(db, branch.id, today), [db, branch.id, today])
  const closed = summary.closed
  const expenses = useMemo(() => db.expenses.filter((e) => e.branchId === branch.id && e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.expenses, branch.id, today])
  const pastCloses = useMemo(() => db.dayCloses.filter((d) => d.branchId === branch.id && d.date !== today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10), [db.dayCloses, branch.id, today])

  const [cat, setCat] = useState<ExpenseCategory>('Misc')
  const [amount, setAmount] = useState('')
  const [expNote, setExpNote] = useState('')
  const [denoms, setDenoms] = useState(emptyDenoms)
  const [notes, setNotes] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)

  const counted = closed ? closed.countedCash : denomTotal(denoms)
  const variance = counted - summary.expectedCash
  const threshold = db.settings.cashVarianceAlert

  const addExpense = () => {
    if (run(() => { dbActions.addExpense({ branchId: branch.id, category: cat, amount: Number(amount), note: expNote || undefined }) }, 'Expense added')) { setAmount(''); setExpNote('') }
  }
  const close = () => void run(() => { dbActions.closeDay({ branchId: branch.id, date: today, countedCash: counted, denominations: denomRecord(denoms), notes: notes || undefined, userId: user.id }) }, 'Day closed')
  const reopen = () => void run(() => { dbActions.reopenDay(branch.id, today) }, 'Day reopened')

  return (
    <>
      <PageHeader title="Day end" description={`${branch.name} · ${formatDate(today)}`} actions={closed ? <StatusBadge status="closed" /> : <StatusBadge status="open" />} />
      {closed && (
        <Alert className="mb-4">
          <Lock />
          <AlertTitle>Day closed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            Closed {formatDateTime(closed.closedAt)}. Billing and expenses are locked.
            <Button variant="outline" className="h-11" onClick={() => setConfirmReopen(true)}><LockOpen /> Reopen day</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle><CardDescription>{summary.billsCount} bills · total sales {formatINR(summary.totalSales)}</CardDescription></CardHeader>
          <CardContent>
            <Row label="Opening float" value={summary.openingFloat} />
            <Row label="Cash sales" value={summary.cashSales} />
            <Row label="Cash expenses" value={summary.cashExpenses} neg />
            <Row label="Expected cash in drawer" value={summary.expectedCash} strong />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">UPI</div><div className="text-sm font-semibold tabular-nums">{formatINR(summary.upiSales)}</div></div>
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">Card</div><div className="text-sm font-semibold tabular-nums">{formatINR(summary.cardSales)}</div></div>
              <div className="rounded-lg bg-muted p-2"><div className="text-muted-foreground">Wastage</div><div className="text-sm font-semibold tabular-nums">{formatINR(summary.wastageValue)}</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Petty expenses</CardTitle><CardDescription>Paid from the cash drawer today</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {!closed && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={cat} onValueChange={(v) => setCat(v as ExpenseCategory)}>
                    <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amt">Amount (₹)</Label>
                  <Input id="amt" inputMode="decimal" className="h-11" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
                </div>
                <Input className="col-span-2 h-11" placeholder="Note (optional)" value={expNote} onChange={(e) => setExpNote(e.target.value)} />
                <Button className="col-span-2 h-11" disabled={!Number(amount)} onClick={addExpense}><Plus /> Add expense</Button>
              </div>
            )}
            {expenses.length === 0 ? <p className="text-sm text-muted-foreground">No expenses today.</p> : (
              <div className="divide-y">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0"><div className="text-sm font-medium">{e.category}</div>{e.note && <div className="truncate text-xs text-muted-foreground">{e.note}</div>}</div>
                    <div className="flex items-center gap-1">
                      <span className="tabular-nums">{formatINR(e.amount, { decimals: true })}</span>
                      {!closed && <Button variant="ghost" className="size-11 text-muted-foreground" aria-label="Delete expense" onClick={() => run(() => { dbActions.deleteExpense(e.id) }, 'Expense deleted')}><Trash2 /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Cash count</CardTitle><CardDescription>{closed ? 'Recorded at close' : 'Count the drawer by denomination'}</CardDescription></CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              {closed ? (
                <div className="space-y-1 text-sm">
                  {Object.entries(closed.denominations ?? {}).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k === 'coins' ? 'Coins' : `₹${k} ×`}</span><span className="tabular-nums">{k === 'coins' ? formatINR(v) : v}</span></div>
                  ))}
                  {!closed.denominations && <p className="text-muted-foreground">No denomination breakdown recorded.</p>}
                </div>
              ) : <DenominationCounter value={denoms} onChange={setDenoms} />}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Counted cash</span><span className="font-heading text-2xl font-bold tabular-nums">{formatINR(counted, { decimals: true })}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Expected</span><span className="tabular-nums">{formatINR(summary.expectedCash, { decimals: true })}</span></div>
              <div className={cn('flex items-center justify-between rounded-lg p-3 font-semibold', varianceTone(variance, threshold))}>
                <span>{Math.abs(variance) < 0.5 ? 'Balanced' : variance > 0 ? 'Excess' : 'Short'}</span>
                <span className="tabular-nums">{variance > 0 ? '+' : ''}{formatINR(variance, { decimals: true })}</span>
              </div>
              {closed ? (closed.notes && <p className="rounded-lg bg-muted p-3 text-sm">{closed.notes}</p>) : (
                <>
                  <Textarea placeholder="Notes (e.g. reason for variance)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  {counted <= 0 && <p className="text-sm text-muted-foreground">Enter the cash count to close the day.</p>}
                  <Button className="h-12 w-full text-base" disabled={counted <= 0} onClick={() => setConfirmClose(true)}><Lock /> Close day</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Past closes</CardTitle></CardHeader>
          <CardContent>
            {pastCloses.length === 0 ? <p className="text-sm text-muted-foreground">No earlier closes.</p> : (
              <div className="divide-y">
                {pastCloses.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div><div className="font-medium">{formatDate(d.date)}</div><div className="text-xs text-muted-foreground">Cash sales {formatINR(d.cashSales)} · counted {formatINR(d.countedCash)}</div></div>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', varianceTone(d.variance, threshold))}>{d.variance > 0 ? '+' : ''}{formatINR(d.variance)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={confirmClose} onOpenChange={setConfirmClose} title="Close the day?"
        description={`Expected ${formatINR(summary.expectedCash, { decimals: true })} · Counted ${formatINR(counted, { decimals: true })} · Variance ${variance > 0 ? '+' : ''}${formatINR(variance, { decimals: true })} (${Math.abs(variance) < 0.5 ? 'balanced' : variance > 0 ? 'excess' : 'short'}). POS and expenses will be locked.`}
        confirmLabel="Close day" onConfirm={close} />
      <ConfirmDialog open={confirmReopen} onOpenChange={setConfirmReopen} title="Reopen today?" description="The close record is removed and billing is enabled again. You will need to close the day again." confirmLabel="Reopen" onConfirm={reopen} />
    </>
  )
}
