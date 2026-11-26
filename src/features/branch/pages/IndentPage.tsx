import { useMemo, useState } from 'react'
import { Clock, Info, Lock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { useCurrentBranch, useRequireUser } from '@/auth/session'
import { useDb, dbActions } from '@/store/db'
import { effectivePrice, getIndent, indentCutoff, suggestIndent } from '@/store/selectors'
import { addDaysISO, todayISO } from '@/lib/dates'
import { formatDate, formatDateShort, formatINR, formatNumber } from '@/lib/format'
import { PRODUCT_CATEGORIES, type Indent, type Product } from '@/types/domain'
import { Stepper } from '../components/Stepper'
import { IndentTimeline } from '../components/IndentTimeline'
import { countdownLabel, run, useNow } from '../lib/utils'

export default function IndentPage() {
  const branch = useCurrentBranch()
  const indents = useDb((d) => d.indents)
  const today = todayISO()
  const tomorrow = addDaysISO(today, 1)
  const [date, setDate] = useState(tomorrow)
  const valid = date > today
  const past = useMemo(() => indents.filter((i) => i.branchId === branch.id && i.deliveryDate !== date).sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)).slice(0, 10), [indents, branch.id, date])

  return (
    <>
      <PageHeader title="Indent" description="Order from the central kitchen for a delivery date" actions={
        <div className="flex items-center gap-2">
          <label htmlFor="deliv" className="text-sm text-muted-foreground">Delivery</label>
          <Input id="deliv" type="date" className="h-11 w-44" min={tomorrow} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      } />
      {valid ? <IndentEditor key={`${branch.id}-${date}`} date={date} /> : <EmptyState title="Pick a future date" description="Indents are for delivery after today." />}

      <Card className="mt-6">
        <CardHeader><CardTitle>Past indents</CardTitle><CardDescription>Latest 10 other indents</CardDescription></CardHeader>
        <CardContent>
          {past.length === 0 ? <p className="text-sm text-muted-foreground">No other indents yet.</p> : (
            <div className="divide-y">
              {past.map((i) => (
                <button key={i.id} type="button" disabled={i.deliveryDate <= today} onClick={() => setDate(i.deliveryDate)} className="flex min-h-12 w-full items-center justify-between gap-2 py-2 text-left">
                  <div>
                    <div className="text-sm font-medium">{formatDateShort(i.deliveryDate)} <span className="text-xs text-muted-foreground">· {i.number}</span></div>
                    <div className="text-xs text-muted-foreground">{formatNumber(i.lines.reduce((s, l) => s + l.qty, 0))} units</div>
                  </div>
                  <div className="flex gap-1">{i.late && <StatusBadge status="late" />}<StatusBadge status={i.status} /></div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function IndentEditor({ date }: { date: string }) {
  const branch = useCurrentBranch()
  const user = useRequireUser()
  const db = useDb((d) => d)
  const now = useNow(20_000)

  const existing: Indent | undefined = useMemo(() => getIndent(db, branch.id, date), [db, branch.id, date])
  const suggestions = useMemo(() => new Map(suggestIndent(db, branch.id, date).map((s) => [s.productId, s])), [db, branch.id, date])
  const products = useMemo(() => db.products.filter((p) => p.active), [db.products])

  const [qty, setQty] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const p of products) init[p.id] = existing ? (existing.lines.find((l) => l.productId === p.id)?.qty ?? 0) : (suggestions.get(p.id)?.suggested ?? 0)
    return init
  })
  const [note, setNote] = useState(existing?.note ?? '')

  const status = existing?.status ?? null
  const readOnly = !!existing && existing.status !== 'draft' && existing.status !== 'submitted'
  const cutoff = indentCutoff(db.settings, date)
  const ms = cutoff.getTime() - now.getTime()
  const lateNow = ms <= 0

  const grouped = useMemo(() => PRODUCT_CATEGORIES.map((c) => ({ category: c, items: products.filter((p) => p.category === c) })).filter((g) => g.items.length), [products])
  const totalUnits = products.reduce((s, p) => s + (qty[p.id] ?? 0), 0)
  const totalValue = products.reduce((s, p) => s + (qty[p.id] ?? 0) * effectivePrice(db, branch.id, p.id), 0)

  const linesInput = () => products.map((p) => ({ productId: p.id, qty: qty[p.id] ?? 0, suggestedQty: suggestions.get(p.id)?.suggested ?? 0 }))
  const save = () => run(() => { dbActions.saveIndent({ id: existing?.id, branchId: branch.id, deliveryDate: date, lines: linesInput(), note: note || undefined }) }, existing?.status === 'submitted' ? 'Indent updated' : 'Draft saved')
  const submit = () => run(() => {
    const id = dbActions.saveIndent({ id: existing?.id, branchId: branch.id, deliveryDate: date, lines: linesInput(), note: note || undefined })
    dbActions.submitIndent(id, user.id)
  }, lateNow ? 'Indent submitted (flagged late)' : 'Indent submitted')

  const resetToSuggested = () => setQty(Object.fromEntries(products.map((p) => [p.id, suggestions.get(p.id)?.suggested ?? 0])))

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-heading text-lg font-semibold">{formatDate(date)}</div>
              <div className="text-sm text-muted-foreground">{existing ? existing.number : 'New indent'}</div>
            </div>
            <div className="flex items-center gap-2">
              {existing?.late && <StatusBadge status="late" />}
              {status && <StatusBadge status={status} />}
            </div>
          </div>
          <IndentTimeline status={status} />
          {!readOnly && (
            <div className={lateNow ? 'flex items-center gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger' : 'flex items-center gap-2 rounded-lg bg-muted p-3 text-sm'}>
              <Clock className="size-4 shrink-0" />
              {lateNow
                ? `Cutoff (${db.settings.indentCutoffTime}, ${formatDateShort(addDaysISO(date, -1))}) has passed — you can still submit, but it will be flagged late.`
                : <>Cutoff <b>{db.settings.indentCutoffTime}</b> on {formatDateShort(addDaysISO(date, -1))} · <b>{countdownLabel(ms)}</b> left</>}
            </div>
          )}
        </CardContent>
      </Card>

      {readOnly && (
        <Alert><Lock /><AlertTitle>Locked</AlertTitle><AlertDescription>This indent is {status?.replace('_', ' ')} and can no longer be edited.</AlertDescription></Alert>
      )}

      {grouped.map((g) => (
        <Card key={g.category}>
          <CardHeader className="pb-0"><CardTitle className="text-base">{g.category}</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {g.items.map((p) => <IndentRow key={p.id} product={p} price={effectivePrice(db, branch.id, p.id)} value={qty[p.id] ?? 0} readOnly={readOnly} sug={suggestions.get(p.id)} onChange={(v) => setQty((q) => ({ ...q, [p.id]: v }))} />)}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="space-y-3">
          <Textarea placeholder="Note for the kitchen (optional)" value={note} disabled={readOnly} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-heading text-xl font-semibold tabular-nums">{formatNumber(totalUnits)} units · {formatINR(totalValue)} <span className="text-xs font-normal text-muted-foreground">at MRP</span></span>
          </div>
          {!readOnly && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="h-12" onClick={resetToSuggested}>Reset to suggested</Button>
              <div className="flex-1" />
              {(!existing || existing.status === 'draft') ? (
                <>
                  <Button variant="outline" className="h-12" onClick={save}>Save draft</Button>
                  <Button className="h-12" onClick={submit}>Submit indent</Button>
                </>
              ) : (
                <Button className="h-12" onClick={save}>Save changes</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function IndentRow({ product, price, value, readOnly, sug, onChange }: {
  product: Product; price: number; value: number; readOnly: boolean
  sug?: { avg: number; stock: number; suggested: number }
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium">{product.name}</span>
          {sug && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label={`Suggestion details for ${product.name}`}><Info className="size-4" /></button>
              </PopoverTrigger>
              <PopoverContent className="w-60 text-sm">
                <div className="mb-1 font-medium">{product.name}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg same-weekday sales</span><span>{sug.avg}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stock sellable then</span><span>{sug.stock}</span></div>
                <div className="flex justify-between font-medium"><span>Suggested</span><span>{sug.suggested}</span></div>
                <div className="mt-1 text-xs text-muted-foreground">= avg × 1.05 − stock, rounded up</div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{formatINR(price)}{sug ? ` · suggested ${sug.suggested}` : ''}</div>
      </div>
      <Stepper value={value} onChange={onChange} disabled={readOnly} ariaLabel={product.name} />
    </div>
  )
}
