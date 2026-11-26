import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Plus, X } from 'lucide-react'
import { Money } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addDaysISO, todayISO } from '@/lib/dates'
import { formatQty, round2 } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import { FormRow, run, type POPrefill } from './shared'

interface Line { rawMaterialId: string; qty: string; rate: string }

/** Create / edit (draft) purchase order. */
export function POForm({ poId }: { poId?: string }) {
  const db = useDb((d) => d)
  const nav = useNavigate()
  const loc = useLocation()
  const po = poId ? db.purchaseOrders.find((p) => p.id === poId) : undefined
  const prefill = (loc.state ?? undefined) as POPrefill | undefined

  const [supplierId, setSupplierId] = useState(po?.supplierId ?? prefill?.supplierId ?? '')
  const [expected, setExpected] = useState(po?.expectedDate ?? addDaysISO(todayISO(), 3))
  const [note, setNote] = useState(po?.note ?? '')
  const [lines, setLines] = useState<Line[]>(() => {
    const src = po ? po.lines : prefill?.lines ?? []
    return src.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: String(l.qty), rate: String(l.rate) }))
  })
  const [adding, setAdding] = useState('')

  const suppliers = useMemo(() => db.suppliers.filter((s) => s.active || s.id === supplierId), [db.suppliers, supplierId])
  const supplier = db.suppliers.find((s) => s.id === supplierId)
  const rm = useMemo(() => new Map(db.rawMaterials.map((m) => [m.id, m])), [db.rawMaterials])
  const options = useMemo(() => {
    const pref = new Set(supplier?.materialIds ?? [])
    return [...db.rawMaterials].filter((m) => !lines.some((l) => l.rawMaterialId === m.id)).sort((a, b) => Number(pref.has(b.id)) - Number(pref.has(a.id)) || a.name.localeCompare(b.name))
  }, [db.rawMaterials, lines, supplier])

  const num = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const total = round2(lines.reduce((s, l) => s + num(l.qty) * num(l.rate), 0))
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  if (poId && !po) return <p className="text-muted-foreground">Purchase order not found.</p>
  if (po && po.status !== 'draft') return <p className="text-muted-foreground">Only draft purchase orders can be edited.</p>

  const save = async (send: boolean) => {
    const input = { supplierId, expectedDate: expected, note: note.trim() || undefined, lines: lines.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: num(l.qty), rate: num(l.rate) })) }
    let id = poId ?? ''
    const ok = await run(() => {
      if (poId) dbActions.updatePO(poId, input)
      else id = dbActions.createPO(input)
      if (send) dbActions.sendPO(id)
    }, send ? 'Purchase order sent' : 'Draft saved')
    if (ok) nav(`/ho/purchase/${id}`, { replace: true })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormRow label="Supplier">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </FormRow>
          <FormRow label="Expected delivery"><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></FormRow>
          <FormRow label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></FormRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate (₹)</TableHead><TableHead className="text-right">Line total</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const m = rm.get(l.rawMaterialId)
                return (
                  <TableRow key={l.rawMaterialId}>
                    <TableCell className="font-medium">{m?.name} <span className="text-muted-foreground">({m?.unit}, stock {formatQty(m?.stockQty ?? 0)})</span></TableCell>
                    <TableCell className="text-right"><Input type="number" min={0} step="any" aria-label="Quantity" className="ml-auto h-8 w-24 text-right" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} /></TableCell>
                    <TableCell className="text-right"><Input type="number" min={0} step="any" aria-label="Rate" className="ml-auto h-8 w-24 text-right" value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} /></TableCell>
                    <TableCell className="text-right"><Money value={num(l.qty) * num(l.rate)} decimals /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><X /></Button></TableCell>
                  </TableRow>
                )
              })}
              {lines.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No items yet</TableCell></TableRow>}
            </TableBody>
            <TableFooter><TableRow><TableCell colSpan={3} className="text-right">Grand total</TableCell><TableCell className="text-right"><Money value={total} decimals /></TableCell><TableCell /></TableRow></TableFooter>
          </Table>
          <div className="flex items-center gap-2 p-3">
            <Select value={adding} onValueChange={(v) => {
              const m = rm.get(v)
              if (m) setLines((ls) => [...ls, { rawMaterialId: m.id, qty: String(m.reorderQty || 1), rate: String(m.costPerUnit) }])
              setAdding('')
            }}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Add material…" /></SelectTrigger>
              <SelectContent>{options.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
            <Plus className="size-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => nav(-1)}>Cancel</Button>
        <Button variant="outline" onClick={() => save(false)}>Save draft</Button>
        <Button onClick={() => save(true)}>Save &amp; send</Button>
      </div>
    </div>
  )
}
