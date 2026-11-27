import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { KeyRound, Plus } from 'lucide-react'
import { ROLE_LABEL } from '@/auth/session'
import { DataTable, PageHeader, StatusBadge } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { dbActions, useDb } from '@/store/db'
import { branchMap } from '@/store/selectors'
import type { Role, User } from '@/types/domain'
import { FormRow, run } from '../components/shared'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,}$/, '3+ characters: letters, numbers, . _ -'),
  role: z.enum(['branch', 'ho', 'cxo']),
  branchId: z.string().optional(),
  active: z.boolean(),
}).refine((v) => v.role !== 'branch' || !!v.branchId, { path: ['branchId'], message: 'Choose a branch for branch users' })
type FormT = z.infer<typeof schema>
const BLANK: FormT = { name: '', username: '', role: 'branch', branchId: undefined, active: true }
const ROLES: Role[] = ['branch', 'ho', 'cxo']

export default function UsersPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [pwUser, setPwUser] = useState<User | null>(null)
  const bm = useMemo(() => branchMap(db), [db])

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'username', header: 'Username' },
    { id: 'role', header: 'Role', accessorFn: (u) => ROLE_LABEL[u.role], cell: ({ row }) => <Badge variant="secondary">{t(ROLE_LABEL[row.original.role])}</Badge> },
    { id: 'branch', header: 'Branch', accessorFn: (u) => (u.branchId ? bm.get(u.branchId)?.name ?? '' : '—') },
    { id: 'pw', header: 'Password', accessorFn: (u) => (u.passwordHash ? 'Set' : 'Demo (none)'), cell: ({ getValue }) => <span className="text-muted-foreground">{t(getValue<string>())}</span> },
    { id: 'status', header: 'Status', accessorFn: (u) => (u.active ? 'active' : 'inactive'), cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
    { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="outline" onClick={() => setPwUser(row.original)}><KeyRound />{t('Password')}</Button></div> },
  ], [bm, t])

  return (
    <>
      <PageHeader title={t('Users')} description={t('Demo accounts have no password; set one to require it at login.')} actions={<Button onClick={() => setEditing('new')}><Plus />{t('New user')}</Button>} />
      <DataTable columns={columns} data={db.users} getRowId={(u) => u.id} onRowClick={setEditing} searchPlaceholder={t('Search users…')} />
      <UserDialog target={editing} onClose={() => setEditing(null)} />
      <PasswordDialog user={pwUser} onClose={() => setPwUser(null)} />
    </>
  )
}

function UserDialog({ target, onClose }: { target: User | 'new' | null; onClose: () => void }) {
  const { t } = useLanguage()
  const branches = useDb((d) => d.branches)
  const u = target && target !== 'new' ? target : undefined
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormT>({ resolver: zodResolver(schema), defaultValues: BLANK })
  useEffect(() => {
    if (target) reset(u ? { name: u.name, username: u.username, role: u.role, branchId: u.branchId, active: u.active } : BLANK)
  }, [target, u, reset])
  const role = watch('role')
  const onSubmit = handleSubmit(async (v) => {
    if (await run(t, () => dbActions.upsertUser({ ...v, branchId: v.role === 'branch' ? v.branchId : undefined, id: u?.id }), u ? 'User updated' : 'User created')) onClose()
  })

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{u ? t('Edit {name}', { name: u.name }) : t('New user')}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <FormRow label={t('Name')} error={errors.name?.message}><Input {...register('name')} /></FormRow>
          <FormRow label={t('Username')} error={errors.username?.message}><Input {...register('username')} autoCapitalize="none" /></FormRow>
          <FormRow label={t('Role')}>
            <Controller control={control} name="role" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(ROLE_LABEL[r])}</SelectItem>)}</SelectContent></Select>
            )} />
          </FormRow>
          {role === 'branch' && (
            <FormRow label={t('Branch')} error={errors.branchId?.message}>
              <Controller control={control} name="branchId" render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}><SelectTrigger className="w-full"><SelectValue placeholder={t('Choose branch')} /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
              )} />
            </FormRow>
          )}
          <div className="col-span-2 flex items-center gap-2">
            <Controller control={control} name="active" render={({ field }) => <Switch id="u-active" checked={field.value} onCheckedChange={field.onChange} />} />
            <Label htmlFor="u-active">{t('Active')}</Label>
          </div>
          <DialogFooter className="col-span-2"><Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button><Button type="submit">{t('Save')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useLanguage()
  const [pw, setPw] = useState('')
  useEffect(() => { setPw('') }, [user])
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Password ·')} {user?.name}</DialogTitle>
          <DialogDescription>{user?.passwordHash ? t('A password is set. Enter a new one to replace it, or clear it to make this a demo account.') : t('No password set (demo account).')}</DialogDescription>
        </DialogHeader>
        <FormRow label={t('New password')} hint={t('At least 4 characters')}><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></FormRow>
        <DialogFooter>
          {user?.passwordHash && <Button variant="outline" onClick={async () => { if (user && await run(t, () => dbActions.setUserPassword(user.id, null), 'Password cleared')) onClose() }}>{t('Clear password')}</Button>}
          <Button onClick={async () => { if (user && await run(t, () => dbActions.setUserPassword(user.id, pw), 'Password set')) onClose() }}>{t('Set password')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
