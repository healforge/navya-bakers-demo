import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, formatDateTime } from '@/lib/format'
import { dbActions, useDb } from '@/store/db'
import { FormRow, run } from '../components/shared'

const nn = (label: string) => z.number({ error: `Enter ${label}` }).min(0, 'Cannot be negative')
const schema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required'),
  indentCutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'),
  nearExpiryDays: nn('days').int('Whole days'),
  wastageAlertPct: nn('a percentage'),
  salesDropAlertPct: nn('a percentage'),
  cashVarianceAlert: nn('an amount'),
  transitAlertHours: nn('hours'),
})
type FormT = z.infer<typeof schema>

export default function SettingsPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const s = db.settings
  const [reset, setReset] = useState(false)
  const { register, handleSubmit, reset: resetForm, formState: { errors, isDirty } } = useForm<FormT>({ resolver: zodResolver(schema), defaultValues: s })
  useEffect(() => { resetForm(s) }, [s, resetForm])

  const onSubmit = handleSubmit(async (v) => { await run(t, () => dbActions.updateSettings(v), 'Settings saved') })
  const num = (n: keyof FormT) => register(n, { valueAsNumber: true })

  return (
    <>
      <PageHeader title={t('Settings')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('Operations & alerts')}</CardTitle><CardDescription>{t('Thresholds that drive indent lateness and exception alerts.')}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <FormRow label={t('Company name')} error={errors.companyName?.message} className="col-span-2"><Input {...register('companyName')} /></FormRow>
              <FormRow label={t('Indent cutoff time')} error={errors.indentCutoffTime?.message} hint={t('On the day before delivery')}><Input type="time" {...register('indentCutoffTime')} /></FormRow>
              <FormRow label={t('Near-expiry window (days)')} error={errors.nearExpiryDays?.message}><Input type="number" {...num('nearExpiryDays')} /></FormRow>
              <FormRow label={t('Wastage alert (%)')} error={errors.wastageAlertPct?.message}><Input type="number" step="0.1" {...num('wastageAlertPct')} /></FormRow>
              <FormRow label={t('Sales drop alert (%)')} error={errors.salesDropAlertPct?.message}><Input type="number" step="0.1" {...num('salesDropAlertPct')} /></FormRow>
              <FormRow label={t('Cash variance alert (₹)')} error={errors.cashVarianceAlert?.message}><Input type="number" {...num('cashVarianceAlert')} /></FormRow>
              <FormRow label={t('Dispatch transit alert (hours)')} error={errors.transitAlertHours?.message}><Input type="number" step="0.5" {...num('transitAlertHours')} /></FormRow>
              <div className="col-span-2 flex gap-2"><Button type="submit" disabled={!isDirty}>{t('Save settings')}</Button><Button type="button" variant="outline" disabled={!isDirty} onClick={() => resetForm(s)}>{t('Discard')}</Button></div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>{t('Demo data')}</CardTitle><CardDescription>{t('All data lives in this browser only.')}</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('Seeded at')}</span><span>{formatDateTime(db.seededAt)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('Anchor date')}</span><span>{formatDate(db.anchorDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('Bills today')}</span><span>{db.bills.length}</span></div>
            <Button variant="destructive" onClick={() => setReset(true)}><RotateCcw />{t('Reset demo data')}</Button>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={reset} onOpenChange={setReset} destructive title={t('Reset demo data?')}
        description={t('All changes are discarded and a fresh 90-day dataset is generated, anchored to today.')}
        confirmLabel={t('Reset')} onConfirm={async () => { await run(t, () => dbActions.resetDemoData(), 'Demo data reset') }}
      />
    </>
  )
}
