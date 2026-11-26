import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, RotateCcw } from 'lucide-react'
import { DataTable, Money, PageHeader, StatusBadge } from '@/components/common'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { todayISO } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import type { Branch } from '@/types/domain'
import { FormRow, run } from '../components/shared'

const schema = z.object({
  code: z.string().regex(/^[A-Z]{2,4}$/, '2–4 capital letters'),
  name: z.string().trim().min(1, 'Name is required'),
  area: z.string().trim(),
  city: z.string().trim(),
  address: z.string().trim(),
  phone: z.string().trim(),
  managerName: z.string().trim(),
  openingFloat: z.number({ error: 'Enter opening float' }).min(0, 'Cannot be negative'),
  active: z.boolean(),
})
type FormT = z.infer<typeof schema>
const BLANK: FormT = { code: '', name: '', area: '', city: 'Kochi', address: '', phone: '', managerName: '', openingFloat: 2000, active: true }

export default function BranchesPage() {
  const db = useDb((d) => d)
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [reopenBranch, setReopenBranch] = useState('')
  const [reopenDate, setReopenDate] = useState(todayISO())
  const [confirm, setConfirm] = useState(false)
  const closes = useMemo(() => db.dayCloses.filter((c) => c.branchId === reopenBranch).map((c) => c.date).sort().reverse().slice(0, 5), [db.dayCloses, reopenBranch])
  const branchId = reopenBranch || db.branches[0]?.id || ''

  const columns = useMemo<ColumnDef<Branch>[]>(() => [
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'name', header: 'Branch', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'city', header: 'City' },
    { accessorKey: 'managerName', header: 'Manager' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'openingFloat', header: 'Opening float', cell: ({ row }) => <Money value={row.original.openingFloat} /> },
    { id: 'status', header: 'Status', accessorFn: (b) => (b.active ? 'active' : 'inactive'), cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
  ], [])

  const closeExists = db.dayCloses.some((c) => c.branchId === branchId && c.date === reopenDate)

  return (
    <>
      <PageHeader title="Branches" actions={<Button onClick={() => setEditing('new')}><Plus />New branch</Button>} />
      <DataTable columns={columns} data={db.branches} getRowId={(b) => b.id} onRowClick={setEditing} searchPlaceholder="Search branches…" />

      <Card className="mt-4">
        <CardHeader><CardTitle>Reopen day close</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Unlocks POS and expenses for a branch/date so the branch can correct and re-close the day.</p>
          <div className="flex flex-wrap items-end gap-3">
            <FormRow label="Branch" className="w-52">
              <select className="h-8 w-full rounded-lg border bg-background px-2 text-sm" value={branchId} onChange={(e) => setReopenBranch(e.target.value)}>
                {db.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormRow>
            <FormRow label="Date" className="w-44"><Input type="date" value={reopenDate} onChange={(e) => setReopenDate(e.target.value)} /></FormRow>
            <Button variant="outline" disabled={!closeExists} onClick={() => setConfirm(true)}><RotateCcw />Reopen</Button>
          </div>
          {closes.length > 0 && <p className="text-xs text-muted-foreground">Recent closes: {closes.map(formatDate).join(', ')}</p>}
          {!closeExists && <p className="text-xs text-muted-foreground">No day close recorded for this branch and date.</p>}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm} onOpenChange={setConfirm} destructive title="Reopen day close?"
        description={`The recorded close for ${db.branches.find((b) => b.id === branchId)?.name} on ${formatDate(reopenDate)} will be removed.`}
        confirmLabel="Reopen" onConfirm={async () => { await run(() => dbActions.reopenDay(branchId, reopenDate), 'Day reopened') }}
      />
      <BranchDialog target={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function BranchDialog({ target, onClose }: { target: Branch | 'new' | null; onClose: () => void }) {
  const b = target && target !== 'new' ? target : undefined
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormT>({ resolver: zodResolver(schema), defaultValues: BLANK })
  useEffect(() => {
    if (target) reset(b ? { code: b.code, name: b.name, area: b.area, city: b.city, address: b.address, phone: b.phone, managerName: b.managerName, openingFloat: b.openingFloat, active: b.active } : BLANK)
  }, [target, b, reset])
  const onSubmit = handleSubmit(async (v) => { if (await run(() => dbActions.upsertBranch({ ...v, id: b?.id }), b ? 'Branch updated' : 'Branch created')) onClose() })

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{b ? `Edit ${b.name}` : 'New branch'}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <FormRow label="Code" error={errors.code?.message}><Input {...register('code')} className="uppercase" /></FormRow>
          <FormRow label="Name" error={errors.name?.message}><Input {...register('name')} /></FormRow>
          <FormRow label="Area"><Input {...register('area')} /></FormRow>
          <FormRow label="City"><Input {...register('city')} /></FormRow>
          <FormRow label="Address" className="col-span-2"><Input {...register('address')} /></FormRow>
          <FormRow label="Phone"><Input {...register('phone')} /></FormRow>
          <FormRow label="Manager"><Input {...register('managerName')} /></FormRow>
          <FormRow label="Opening float (₹)" error={errors.openingFloat?.message}><Input type="number" step="1" {...register('openingFloat', { valueAsNumber: true })} /></FormRow>
          <div className="flex items-end gap-2 pb-1.5">
            <Controller control={control} name="active" render={({ field }) => <Switch id="b-active" checked={field.value} onCheckedChange={field.onChange} />} />
            <Label htmlFor="b-active">Active</Label>
          </div>
          <DialogFooter className="col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
