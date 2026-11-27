import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { History, SlidersHorizontal } from 'lucide-react'
import { DataTable, Money, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatINR, formatQty } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dbActions, useDb } from '@/store/db'
import { getReorderSuggestions, onOrderQty, rawMaterialStatus } from '@/store/selectors'
import type { RawMaterial } from '@/types/domain'
import { FormRow, run, type POPrefill } from '../components/shared'

export default function RawMaterialsPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const nav = useNavigate()
  const [adjust, setAdjust] = useState<RawMaterial | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [hist, setHist] = useState<RawMaterial | null>(null)

  const rows = useMemo(() => db.rawMaterials.map((m) => ({ m, onOrder: onOrderQty(db, m.id) })), [db])
  const groups = useMemo(() => getReorderSuggestions(db), [db])
  const movements = useMemo(() => (hist ? db.rmMovements.filter((x) => x.rawMaterialId === hist.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []), [db.rmMovements, hist])
  const totalValue = rows.reduce((s, r) => s + r.m.stockQty * r.m.costPerUnit, 0)

  type Row = (typeof rows)[number]
  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { id: 'code', header: 'Code', accessorFn: (r) => r.m.code },
    { id: 'name', header: 'Material', accessorFn: (r) => r.m.name, cell: ({ row }) => <span className="font-medium">{row.original.m.name}</span> },
    { id: 'stock', header: 'Stock', accessorFn: (r) => r.m.stockQty, cell: ({ row }) => <span className={cn('tabular-nums', row.original.m.stockQty < row.original.m.reorderLevel && 'font-semibold text-danger')}>{formatQty(row.original.m.stockQty)}</span> },
    { id: 'unit', header: 'Unit', accessorFn: (r) => r.m.unit },
    { id: 'reorder', header: 'Reorder level', accessorFn: (r) => r.m.reorderLevel, cell: ({ getValue }) => <span className="tabular-nums">{formatQty(getValue<number>())}</span> },
    { id: 'onOrder', header: 'On order', accessorFn: (r) => r.onOrder, cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>() ? formatQty(getValue<number>()) : '—'}</span> },
    { id: 'value', header: 'Value', accessorFn: (r) => r.m.stockQty * r.m.costPerUnit, cell: ({ getValue }) => <Money value={getValue<number>()} /> },
    { id: 'status', header: 'Status', accessorFn: (r) => rawMaterialStatus(r.m), cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => { setAdjust(row.original.m); setQty(String(row.original.m.stockQty)); setNote('') }}><SlidersHorizontal />{t('Adjust')}</Button>
          <Button size="sm" variant="ghost" onClick={() => setHist(row.original.m)}><History />{t('History')}</Button>
        </div>
      ),
    },
  ], [t])

  const prefill = (g: (typeof groups)[number]) => {
    const state: POPrefill = { supplierId: g.supplierId ?? undefined, lines: g.lines.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: l.qty, rate: l.rate })) }
    nav('/ho/purchase/new', { state })
  }

  const saveAdjust = async () => {
    if (!adjust) return
    if (await run(t, () => dbActions.adjustRawMaterialStock(adjust.id, Number(qty), note.trim() || undefined), 'Stock adjusted')) setAdjust(null)
  }

  return (
    <>
      <PageHeader title={t('Raw materials')} description={t('Stock value {amount} across {count} materials', { amount: formatINR(totalValue), count: rows.length })} />

      {groups.length > 0 && (
        <Card className="mb-4 border-warning/40">
          <CardHeader><CardTitle>{t('Reorder suggestions')}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.supplierId ?? 'none'} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium">{g.supplierName}</div>
                  <Button size="sm" onClick={() => prefill(g)}>{t('Create PO')}</Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {g.lines.map((l) => (
                    <li key={l.rawMaterialId} className="flex justify-between">
                      <span>{l.name} <span className="text-muted-foreground">({formatQty(l.stockQty, l.unit)} / {formatQty(l.reorderLevel)})</span></span>
                      <span className="tabular-nums">{t('order')} {formatQty(l.qty, l.unit)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DataTable columns={columns} data={rows} getRowId={(r) => r.m.id} searchPlaceholder={t('Search materials…')} emptyTitle={t('No raw materials')} />

      <Dialog open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Adjust stock ·')} {adjust?.name}</DialogTitle>
            <DialogDescription>{t('Current stock')} {adjust ? formatQty(adjust.stockQty, adjust.unit) : ''}{t('. Enter the new counted quantity.')}</DialogDescription>
          </DialogHeader>
          <FormRow label={t('New quantity ({unit})', { unit: adjust?.unit ?? '' })}><Input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></FormRow>
          <FormRow label={t('Reason / note')}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. Physical count')} /></FormRow>
          <DialogFooter><Button variant="outline" onClick={() => setAdjust(null)}>{t('Cancel')}</Button><Button onClick={saveAdjust}>{t('Save adjustment')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!hist} onOpenChange={(o) => !o && setHist(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{hist?.name} {t('· movements')}</SheetTitle><SheetDescription>{t('Most recent first')}</SheetDescription></SheetHeader>
          <div className="px-4 pb-4">
            {movements.length === 0 ? <p className="text-sm text-muted-foreground">{t('No movements recorded.')}</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>{t('Date')}</TableHead><TableHead>{t('Type')}</TableHead><TableHead className="text-right">{t('Qty')}</TableHead><TableHead>{t('Note')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {movements.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell>{formatDate(x.date)}</TableCell>
                      <TableCell className="capitalize">{x.type}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', x.qty < 0 ? 'text-danger' : 'text-success')}>{x.qty > 0 ? '+' : ''}{formatQty(x.qty, hist?.unit)}</TableCell>
                      <TableCell className="text-muted-foreground">{x.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
