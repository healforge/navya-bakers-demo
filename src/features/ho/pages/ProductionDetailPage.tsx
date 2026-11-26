import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, CheckCircle2, Truck } from 'lucide-react'
import { EmptyState, PageHeader, StatusBadge } from '@/components/common'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatQty } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dbActions, useDb } from '@/store/db'
import { productName, requirementFor, supplierMap } from '@/store/selectors'
import { toast } from 'sonner'
import { run, type POPrefill } from '../components/shared'

export default function ProductionDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const db = useDb((d) => d)
  const plan = db.productionPlans.find((p) => p.id === id)
  const [produced, setProduced] = useState<Record<string, string>>({})
  const [planned, setPlanned] = useState<Record<string, string>>({})
  const [shortErr, setShortErr] = useState<string | null>(null)
  const [forceOpen, setForceOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // reset local edit buffers when plan lines change externally
  useEffect(() => { setPlanned({}) }, [plan?.lines])

  const sup = useMemo(() => supplierMap(db), [db])
  const lateCount = plan && plan.status === 'confirmed' ? db.indents.filter((i) => i.deliveryDate === plan.date && i.status === 'submitted').length : 0

  const producedNums = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of plan?.lines ?? []) {
      const raw = produced[l.productId]
      const n = raw === undefined || raw === '' ? l.plannedQty : Number(raw)
      m[l.productId] = Number.isFinite(n) ? n : 0
    }
    return m
  }, [plan, produced])

  const req = useMemo(() => {
    if (!plan) return []
    const basis = plan.status === 'confirmed' ? producedNums : null
    return requirementFor(db, plan.lines.map((l) => ({ productId: l.productId, qty: plan.status === 'completed' ? (l.producedQty ?? 0) : basis ? basis[l.productId] ?? 0 : l.plannedQty })))
  }, [db, plan, producedNums])

  if (!plan) return <EmptyState title="Production plan not found" action={<Button asChild variant="outline"><Link to="/ho/production">Back to plans</Link></Button>} />

  const editable = plan.status !== 'completed'
  const shortages = req.filter((r) => r.shortfall > 0)

  const commitPlanned = async (productId: string, current: number) => {
    const raw = planned[productId]
    if (raw === undefined) return
    const n = Number(raw)
    if (raw === '' || n === current) { setPlanned(({ [productId]: _, ...rest }) => rest); return }
    if (!(await run(() => dbActions.updatePlanLine(plan.id, productId, n)))) setPlanned(({ [productId]: _, ...rest }) => rest)
  }

  const createPOs = () => {
    const groups = new Map<string, POPrefill>()
    for (const s of shortages) {
      const m = db.rawMaterials.find((x) => x.id === s.rawMaterialId)
      const key = m?.preferredSupplierId ?? ''
      const g = groups.get(key) ?? { supplierId: m?.preferredSupplierId, lines: [] }
      g.lines.push({ rawMaterialId: s.rawMaterialId, qty: Math.ceil(s.shortfall * 100) / 100, rate: m?.costPerUnit ?? 0 })
      groups.set(key, g)
    }
    return [...groups.values()]
  }
  const poGroups = createPOs()

  const complete = () => {
    try {
      dbActions.completeProduction(plan.id, { ...producedNums })
      setShortErr(null)
      toast.success('Production recorded')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      if (msg.startsWith('Not enough')) setShortErr(msg)
      else toast.error(msg)
    }
  }

  return (
    <>
      <PageHeader
        title={`${plan.number} · ${formatDate(plan.date)}`}
        description={<span className="inline-flex items-center gap-2">Production plan <StatusBadge status={plan.status} /></span>}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/ho/production">All plans</Link></Button>
            {plan.status === 'draft' && <Button variant="outline" onClick={() => run(() => dbActions.generateProductionPlan(plan.date), 'Re-consolidated from submitted indents')}>Reset from indents</Button>}
            {plan.status === 'draft' && <Button onClick={() => setConfirmOpen(true)}><CheckCircle2 />Confirm plan</Button>}
            {plan.status === 'completed' && <Button onClick={() => nav('/ho/dispatch')}><Truck />Go to dispatch</Button>}
          </>
        }
      />

      {lateCount > 0 && (
        <Alert className="mb-4">
          <AlertTriangle />
          <AlertTitle>{lateCount} late indent{lateCount > 1 ? 's' : ''} submitted after confirmation</AlertTitle>
          <AlertDescription>
            <Button size="sm" className="mt-2" onClick={() => run(() => dbActions.reconsolidatePlan(plan.id), 'Late indents merged into plan')}>Re-consolidate</Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle>Products</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead><TableHead className="text-right">Indented</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                {plan.status !== 'draft' && <TableHead className="text-right">Produced</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.lines.map((l) => (
                <TableRow key={l.productId}>
                  <TableCell className="font-medium">{productName(db, l.productId)}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.indentQty}</TableCell>
                  <TableCell className="text-right">
                    {editable ? (
                      <Input
                        type="number" min={0} step={1} aria-label={`Planned ${productName(db, l.productId)}`}
                        className="ml-auto h-8 w-24 text-right tabular-nums"
                        value={planned[l.productId] ?? String(l.plannedQty)}
                        onChange={(e) => setPlanned((s) => ({ ...s, [l.productId]: e.target.value }))}
                        onBlur={() => commitPlanned(l.productId, l.plannedQty)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      />
                    ) : <span className="tabular-nums">{l.plannedQty}</span>}
                  </TableCell>
                  {plan.status === 'confirmed' && (
                    <TableCell className="text-right">
                      <Input
                        type="number" min={0} step={1} aria-label={`Produced ${productName(db, l.productId)}`}
                        className="ml-auto h-8 w-24 text-right tabular-nums"
                        value={produced[l.productId] ?? String(l.plannedQty)}
                        onChange={(e) => { setProduced((s) => ({ ...s, [l.productId]: e.target.value })); setShortErr(null) }}
                      />
                    </TableCell>
                  )}
                  {plan.status === 'completed' && (
                    <TableCell className={cn('text-right tabular-nums', (l.producedQty ?? 0) < l.plannedQty && 'text-danger')}>{l.producedQty ?? 0}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="flex items-center justify-between">
          Raw-material requirement{plan.status === 'completed' ? ' (consumed)' : ''}
          {plan.status !== 'completed' && shortages.length > 0 && (
            <span className="flex flex-wrap gap-2">
              {poGroups.map((g, i) => (
                <Button key={i} size="sm" variant="outline" onClick={() => nav('/ho/purchase/new', { state: g })}>
                  Create PO for shortfall{g.supplierId ? ` · ${sup.get(g.supplierId)?.name ?? ''}` : ' · no preferred supplier'}
                </Button>
              ))}
            </span>
          )}
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead><TableHead className="text-right">Required</TableHead>
                {plan.status !== 'completed' && <><TableHead className="text-right">In stock</TableHead><TableHead className="text-right">Shortfall</TableHead></>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {req.map((r) => (
                <TableRow key={r.rawMaterialId} className={cn(plan.status !== 'completed' && r.shortfall > 0 && 'bg-danger/10')}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(r.required, r.unit)}</TableCell>
                  {plan.status !== 'completed' && (
                    <>
                      <TableCell className="text-right tabular-nums">{formatQty(r.inStock, r.unit)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', r.shortfall > 0 && 'font-semibold text-danger')}>{r.shortfall > 0 ? formatQty(r.shortfall, r.unit) : '—'}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {plan.status === 'confirmed' && (
        <div className="space-y-3">
          {shortErr && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Cannot complete production</AlertTitle>
              <AlertDescription>
                <p>{shortErr}</p>
                <Button size="sm" variant="destructive" className="mt-2" onClick={() => setForceOpen(true)}>Complete anyway (force)</Button>
              </AlertDescription>
            </Alert>
          )}
          <Button onClick={complete}><CheckCircle2 />Record production</Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen} onOpenChange={setConfirmOpen} title="Confirm production plan?"
        description="Submitted indents for this date move to 'in production'. Later indents can be merged with Re-consolidate."
        confirmLabel="Confirm plan" onConfirm={async () => { await run(() => dbActions.confirmPlan(plan.id), 'Plan confirmed') }}
      />
      <ConfirmDialog
        open={forceOpen} onOpenChange={setForceOpen} destructive title="Complete despite raw-material shortfall?"
        description="Raw material stock will go negative. Only do this if the stock count in the system is wrong."
        confirmLabel="Complete anyway" onConfirm={async () => { if (await run(() => dbActions.completeProduction(plan.id, producedNums, { force: true }), 'Production recorded (forced)')) setShortErr(null) }}
      />
    </>
  )
}
