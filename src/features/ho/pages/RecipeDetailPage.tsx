import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Plus, Save, X } from 'lucide-react'
import { EmptyState, Money, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPct } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import { netPrice } from '@/store/selectors'
import { FormRow, marginTone, run } from '../components/shared'

interface Row { rawMaterialId: string; qty: string }

export default function RecipeDetailPage() {
  const { productId = '' } = useParams()
  const db = useDb((d) => d)
  const product = db.products.find((p) => p.id === productId)
  const recipe = db.recipes.find((r) => r.productId === productId)
  if (!product) return <EmptyState title="Product not found" action={<Button asChild variant="outline"><Link to="/ho/recipes">Back</Link></Button>} />
  return <Editor key={productId + (recipe ? 'r' : 'n')} productId={productId} initial={recipe ? { yieldQty: String(recipe.yieldQty), rows: recipe.ingredients.map((i) => ({ rawMaterialId: i.rawMaterialId, qty: String(i.qty) })) } : { yieldQty: '', rows: [] }} />
}

function Editor({ productId, initial }: { productId: string; initial: { yieldQty: string; rows: Row[] } }) {
  const db = useDb((d) => d)
  const nav = useNavigate()
  const product = db.products.find((p) => p.id === productId)!
  const [yieldQty, setYield] = useState(initial.yieldQty)
  const [rows, setRows] = useState<Row[]>(initial.rows)
  const [adding, setAdding] = useState('')
  const rm = useMemo(() => new Map(db.rawMaterials.map((m) => [m.id, m])), [db.rawMaterials])
  const options = db.rawMaterials.filter((m) => !rows.some((r) => r.rawMaterialId === m.id))

  const y = Number(yieldQty)
  const batchCost = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (rm.get(r.rawMaterialId)?.costPerUnit ?? 0), 0)
  const unit = y > 0 ? batchCost / y : 0
  const net = netPrice(product)
  const margin = net > 0 && unit > 0 ? ((net - unit) / net) * 100 : null
  const set = (i: number, qty: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty } : r)))

  const save = async () => {
    if (await run(() => dbActions.upsertRecipe({ productId, yieldQty: y, ingredients: rows.map((r) => ({ rawMaterialId: r.rawMaterialId, qty: Number(r.qty) })) }), 'Recipe saved')) nav('/ho/recipes')
  }

  return (
    <>
      <PageHeader title={`Recipe · ${product.name}`} description={`${product.category} · MRP ₹${product.price} · GST ${product.gstRate}%`} actions={<><Button variant="outline" asChild><Link to="/ho/recipes">Back</Link></Button><Button onClick={save}><Save />Save recipe</Button></>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader><CardTitle>Ingredients per batch</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="px-4"><FormRow label="Yield (units per batch)" className="w-48"><Input type="number" min={1} step={1} value={yieldQty} onChange={(e) => setYield(e.target.value)} /></FormRow></div>
            <Table>
              <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Cost</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const m = rm.get(r.rawMaterialId)
                  return (
                    <TableRow key={r.rawMaterialId}>
                      <TableCell className="font-medium">{m?.name}</TableCell>
                      <TableCell className="text-right"><Input type="number" min={0} step="any" aria-label={`${m?.name} quantity`} className="ml-auto h-8 w-24 text-right" value={r.qty} onChange={(e) => set(i, e.target.value)} /></TableCell>
                      <TableCell>{m?.unit}</TableCell>
                      <TableCell className="text-right"><Money value={(Number(r.qty) || 0) * (m?.costPerUnit ?? 0)} decimals /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" aria-label="Remove ingredient" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><X /></Button></TableCell>
                    </TableRow>
                  )
                })}
                {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No ingredients yet</TableCell></TableRow>}
              </TableBody>
              <TableFooter><TableRow><TableCell colSpan={3} className="text-right">Batch cost</TableCell><TableCell className="text-right"><Money value={batchCost} decimals /></TableCell><TableCell /></TableRow></TableFooter>
            </Table>
            <div className="flex items-center gap-2 px-4 pb-4">
              <Select value={adding} onValueChange={(v) => { setRows((rs) => [...rs, { rawMaterialId: v, qty: '' }]); setAdding('') }}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Add ingredient…" /></SelectTrigger>
                <SelectContent>{options.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
              </Select>
              <Plus className="size-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>Live costing</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Unit cost</span><Money value={unit} decimals className="font-semibold" /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">MRP</span><Money value={product.price} decimals /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Net price (ex-GST)</span><Money value={net} decimals /></div>
            <div className="flex justify-between border-t pt-3"><span className="text-muted-foreground">Gross margin</span>{margin === null ? '—' : <span className={`text-lg font-semibold ${marginTone(margin)}`}>{formatPct(margin)}</span>}</div>
            {margin !== null && <div className="flex justify-between"><span className="text-muted-foreground">Margin per unit</span><Money value={net - unit} decimals /></div>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
