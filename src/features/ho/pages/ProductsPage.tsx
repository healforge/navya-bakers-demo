import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { DataTable, Money, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatPct, round2 } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import { netPrice, productMarginPct, unitCostMap } from '@/store/selectors'
import { PRODUCT_CATEGORIES, type GstRate, type Product } from '@/types/domain'
import { FormRow, marginTone, run } from '../components/shared'

const schema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  name: z.string().trim().min(1, 'Name is required'),
  category: z.enum(PRODUCT_CATEGORIES),
  price: z.number({ error: 'Enter MRP' }).positive('MRP must be greater than 0'),
  gstRate: z.number(),
  shelfLifeDays: z.number({ error: 'Enter shelf life' }).int('Whole days only').min(1, 'At least 1 day'),
  active: z.boolean(),
})
type FormT = z.infer<typeof schema>

const BLANK: FormT = { sku: '', name: '', category: 'Breads', price: 0, gstRate: 5, shelfLifeDays: 2, active: true }

export default function ProductsPage() {
  const db = useDb((d) => d)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const costs = useMemo(() => unitCostMap(db), [db])

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'price', header: 'MRP', cell: ({ row }) => <Money value={row.original.price} decimals /> },
    { accessorKey: 'gstRate', header: 'GST', cell: ({ row }) => `${row.original.gstRate}%` },
    { accessorKey: 'shelfLifeDays', header: 'Shelf life', cell: ({ row }) => `${row.original.shelfLifeDays} d` },
    { id: 'cost', header: 'Unit cost', accessorFn: (p) => costs[p.id] ?? 0, cell: ({ getValue }) => <Money value={getValue<number>()} decimals /> },
    { id: 'margin', header: 'Margin', accessorFn: (p) => productMarginPct(db, p), cell: ({ getValue }) => <span className={marginTone(getValue<number>())}>{formatPct(getValue<number>())}</span> },
    {
      id: 'active', header: 'Active', enableSorting: false,
      cell: ({ row }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch checked={row.original.active} aria-label="Active" onCheckedChange={(v) => run(() => dbActions.setProductActive(row.original.id, v))} />
        </span>
      ),
    },
  ], [db, costs])

  return (
    <>
      <PageHeader title="Products" description="Product master. MRP is tax-inclusive." actions={<Button onClick={() => setEditing('new')}><Plus />New product</Button>} />
      <DataTable columns={columns} data={db.products} getRowId={(p) => p.id} onRowClick={setEditing} searchPlaceholder="Search products…" pageSize={20} />
      <ProductDialog target={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function ProductDialog({ target, onClose }: { target: Product | 'new' | null; onClose: () => void }) {
  const db = useDb((d) => d)
  const product = target && target !== 'new' ? target : undefined
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormT>({ resolver: zodResolver(schema), defaultValues: BLANK })
  useEffect(() => {
    if (target) reset(product ? { sku: product.sku, name: product.name, category: product.category, price: product.price, gstRate: product.gstRate, shelfLifeDays: product.shelfLifeDays, active: product.active } : BLANK)
  }, [target, product, reset])

  const price = watch('price'), gst = watch('gstRate')
  const net = Number.isFinite(price) ? netPrice({ price, gstRate: gst as GstRate }) : 0
  const cost = product ? unitCostMap(db)[product.id] ?? 0 : 0
  const margin = net > 0 && cost > 0 ? ((net - cost) / net) * 100 : null

  const onSubmit = handleSubmit(async (v) => {
    if (await run(() => dbActions.upsertProduct({ ...v, gstRate: v.gstRate as GstRate, id: product?.id, color: product?.color }), product ? 'Product updated' : 'Product created')) onClose()
  })

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{product ? `Edit ${product.name}` : 'New product'}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <FormRow label="SKU" error={errors.sku?.message}><Input {...register('sku')} /></FormRow>
          <FormRow label="Name" error={errors.name?.message}><Input {...register('name')} /></FormRow>
          <FormRow label="Category">
            <Controller control={control} name="category" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            )} />
          </FormRow>
          <FormRow label="MRP (₹, incl. GST)" error={errors.price?.message}><Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} /></FormRow>
          <FormRow label="GST %">
            <Controller control={control} name="gstRate" render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[0, 5, 12, 18].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>
            )} />
          </FormRow>
          <FormRow label="Shelf life (days)" error={errors.shelfLifeDays?.message}><Input type="number" step="1" {...register('shelfLifeDays', { valueAsNumber: true })} /></FormRow>
          <div className="col-span-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span>Net price <Money value={round2(net)} decimals /></span>
            <span>Unit cost <Money value={cost} decimals /></span>
            <span>Margin {margin === null ? '—' : <span className={marginTone(margin)}>{formatPct(margin)}</span>}</span>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Controller control={control} name="active" render={({ field }) => <Switch id="p-active" checked={field.value} onCheckedChange={field.onChange} />} />
            <Label htmlFor="p-active">Active (sellable)</Label>
          </div>
          <DialogFooter className="col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
