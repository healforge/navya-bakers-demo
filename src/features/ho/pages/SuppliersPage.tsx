import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { DataTable, PageHeader, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { dbActions, useDb } from '@/store/db'
import type { Supplier } from '@/types/domain'
import { FormRow, run } from '../components/shared'

const schema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required'),
  contactPerson: z.string().trim(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{0,15}$/, 'Digits only'),
  city: z.string().trim(),
  gstin: z.string().trim().refine((v) => v === '' || /^[0-9A-Z]{15}$/.test(v.toUpperCase()), 'GSTIN must be 15 characters'),
  materialIds: z.array(z.string()),
  active: z.boolean(),
})
type FormT = z.infer<typeof schema>
const BLANK: FormT = { name: '', contactPerson: '', phone: '', city: '', gstin: '', materialIds: [], active: true }

export default function SuppliersPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const rm = useMemo(() => new Map(db.rawMaterials.map((m) => [m.id, m.name])), [db.rawMaterials])

  const columns = useMemo<ColumnDef<Supplier>[]>(() => [
    { accessorKey: 'name', header: 'Supplier', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'contactPerson', header: 'Contact' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'city', header: 'City' },
    { id: 'materials', header: 'Materials', enableSorting: false, accessorFn: (s) => s.materialIds.map((i) => rm.get(i)).join(' '), cell: ({ row }) => <span className="text-muted-foreground">{row.original.materialIds.map((i) => rm.get(i)).filter(Boolean).join(', ') || '—'}</span> },
    { id: 'status', header: 'Status', accessorFn: (s) => (s.active ? 'active' : 'inactive'), cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ], [rm])

  return (
    <>
      <PageHeader title={t('Suppliers')} actions={<Button onClick={() => setEditing('new')}><Plus />{t('New supplier')}</Button>} />
      <DataTable columns={columns} data={db.suppliers} getRowId={(s) => s.id} onRowClick={setEditing} searchPlaceholder={t('Search suppliers…')} />
      <SupplierDialog target={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function SupplierDialog({ target, onClose }: { target: Supplier | 'new' | null; onClose: () => void }) {
  const { t } = useLanguage()
  const materials = useDb((d) => d.rawMaterials)
  const sup = target && target !== 'new' ? target : undefined
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormT>({ resolver: zodResolver(schema), defaultValues: BLANK })
  useEffect(() => {
    if (target) reset(sup ? { name: sup.name, contactPerson: sup.contactPerson, phone: sup.phone, city: sup.city, gstin: sup.gstin ?? '', materialIds: sup.materialIds, active: sup.active } : BLANK)
  }, [target, sup, reset])

  const onSubmit = handleSubmit(async (v) => {
    if (await run(t, () => dbActions.upsertSupplier({ ...v, gstin: v.gstin ? v.gstin.toUpperCase() : undefined, id: sup?.id }), sup ? 'Supplier updated' : 'Supplier created')) onClose()
  })

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{sup ? t('Edit {name}', { name: sup.name }) : t('New supplier')}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <FormRow label={t('Name')} error={errors.name?.message} className="col-span-2"><Input {...register('name')} /></FormRow>
          <FormRow label={t('Contact person')}><Input {...register('contactPerson')} /></FormRow>
          <FormRow label={t('Phone')} error={errors.phone?.message}><Input {...register('phone')} /></FormRow>
          <FormRow label={t('City')}><Input {...register('city')} /></FormRow>
          <FormRow label={t('GSTIN (optional)')} error={errors.gstin?.message}><Input {...register('gstin')} /></FormRow>
          <div className="col-span-2 space-y-1.5">
            <Label>{t('Supplies')}</Label>
            <Controller control={control} name="materialIds" render={({ field }) => (
              <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2">
                {materials.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox checked={field.value.includes(m.id)} onCheckedChange={(c) => field.onChange(c ? [...field.value, m.id] : field.value.filter((x) => x !== m.id))} />
                    {m.name}
                  </label>
                ))}
              </div>
            )} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Controller control={control} name="active" render={({ field }) => <Switch id="s-active" checked={field.value} onCheckedChange={field.onChange} />} />
            <Label htmlFor="s-active">{t('Active')}</Label>
          </div>
          <DialogFooter className="col-span-2"><Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button><Button type="submit">{t('Save')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
