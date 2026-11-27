import { useLanguage } from '@/i18n/useLanguage'
import { useMemo, useState } from 'react'
import { PackageCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useCurrentBranch, useRequireUser } from '@/auth/session'
import { useDb, dbActions } from '@/store/db'
import { dispatchVarianceLines, productName } from '@/store/selectors'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Dispatch } from '@/types/domain'
import { Stepper } from '../components/Stepper'
import { run } from '../lib/utils'

export default function ReceivePage() {
  const { t } = useLanguage()
  const branch = useCurrentBranch()
  const dispatches = useDb((d) => d.dispatches)
  const db = useDb((d) => d)
  const mine = useMemo(() => dispatches.filter((d) => d.branchId === branch.id), [dispatches, branch.id])
  const transit = useMemo(() => mine.filter((d) => d.status === 'in_transit').sort((a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt)), [mine])
  const history = useMemo(() => mine.filter((d) => d.status === 'received').sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? '')).slice(0, 15), [mine])

  return (
    <>
      <PageHeader title={t('Receive stock')} description={t('Check incoming dispatches against what actually arrived')} />
      {transit.length === 0 ? (
        <EmptyState icon={Truck} title={t('No dispatch in transit')} description={t('When the kitchen dispatches your indent it will appear here.')} />
      ) : (
        <div className="space-y-4">{transit.map((d) => <ReceiveForm key={d.id} dispatch={d} />)}</div>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>{t('Received history')}</CardTitle><CardDescription>{t('Latest 15 deliveries with variances')}</CardDescription></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">{t('Nothing received yet.')}</p> : (
            <div className="space-y-3">
              {history.map((d) => {
                const v = dispatchVarianceLines(d)
                const short = v.reduce((s, x) => s + x.short, 0)
                const dmg = v.reduce((s, x) => s + x.damaged, 0)
                return (
                  <details key={d.id} className="group rounded-lg border">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{d.number}</div>
                        <div className="text-xs text-muted-foreground">{d.receivedAt ? formatDateTime(d.receivedAt) : ''}</div>
                      </div>
                      <div className="flex gap-1">
                        {short > 0 && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">{short} short</span>}
                        {dmg > 0 && <span className="rounded-full bg-warning/25 px-2 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning">{dmg} damaged</span>}
                        {short === 0 && dmg === 0 && <StatusBadge status="ok" label={t('No variance')} />}
                      </div>
                    </summary>
                    <table className="w-full border-t text-sm">
                      <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-1 text-left font-medium">{t('Item')}</th><th className="font-medium">{t('Disp.')}</th><th className="font-medium">{t('Recd')}</th><th className="font-medium">{t('Dmg')}</th><th className="px-3 font-medium">{t('Short')}</th></tr></thead>
                      <tbody>
                        {v.map((x) => (
                          <tr key={x.productId} className="border-t text-center">
                            <td className="px-3 py-1.5 text-left">{productName(db, x.productId)}</td>
                            <td>{x.dispatched}</td><td>{x.received}</td><td>{x.damaged || '–'}</td>
                            <td className={cn('px-3', x.short > 0 && 'font-semibold text-danger')}>{x.short || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

interface LineState { received: number; damaged: number; note: string }

function ReceiveForm({ dispatch }: { dispatch: Dispatch }) {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const user = useRequireUser()
  const [lines, setLines] = useState<Record<string, LineState>>(() => Object.fromEntries(dispatch.lines.map((l) => [l.productId, { received: l.qtyDispatched, damaged: 0, note: '' }])))
  const acceptAll = () => setLines(Object.fromEntries(dispatch.lines.map((l) => [l.productId, { received: l.qtyDispatched, damaged: 0, note: '' }])))
  const patch = (id: string, p: Partial<LineState>) => setLines((s) => ({ ...s, [id]: { ...s[id], ...p } }))

  const variance = (pid: string, disp: number) => disp - lines[pid].received - lines[pid].damaged
  const totalShort = dispatch.lines.reduce((s, l) => s + Math.max(0, variance(l.productId, l.qtyDispatched)), 0)
  const totalDmg = dispatch.lines.reduce((s, l) => s + lines[l.productId].damaged, 0)
  const invalid = dispatch.lines.some((l) => variance(l.productId, l.qtyDispatched) < 0)

  const confirm = () => run(t, () => {
    dbActions.receiveDispatch(dispatch.id, dispatch.lines.map((l) => ({ productId: l.productId, qtyReceived: lines[l.productId].received, qtyDamaged: lines[l.productId].damaged, note: lines[l.productId].note || undefined })), user.id)
  }, `${dispatch.number} received`)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{dispatch.number}</CardTitle>
            <CardDescription>{t('Dispatched')} {formatDateTime(dispatch.dispatchedAt)}{dispatch.vehicle ? ` · ${dispatch.vehicle}` : ''}</CardDescription>
          </div>
          <StatusBadge status="in_transit" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" className="h-11" onClick={acceptAll}><PackageCheck /> {t('Accept all as dispatched')}</Button>
        {dispatch.lines.map((l) => {
          const s = lines[l.productId]
          const v = variance(l.productId, l.qtyDispatched)
          return (
            <div key={l.productId} className={cn('rounded-lg border p-3', v > 0 && 'border-danger/50 bg-danger/5', v < 0 && 'border-warning bg-warning/10')}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{productName(db, l.productId)}</div>
                <div className="text-sm text-muted-foreground">{t('Dispatched')} <b className="text-foreground">{l.qtyDispatched}</b></div>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div><div className="mb-1 text-xs text-muted-foreground">{t('Received (good)')}</div><Stepper value={s.received} max={l.qtyDispatched} onChange={(x) => patch(l.productId, { received: x })} ariaLabel="received" /></div>
                <div><div className="mb-1 text-xs text-muted-foreground">{t('Damaged')}</div><Stepper value={s.damaged} max={l.qtyDispatched} onChange={(x) => patch(l.productId, { damaged: x })} ariaLabel="damaged" /></div>
              </div>
              {(v !== 0 || s.damaged > 0) && (
                <div className="mt-2 space-y-2">
                  <div className={cn('text-xs font-medium', v > 0 ? 'text-danger' : v < 0 ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground')}>
                    {v > 0 ? t('{count} short', { count: v }) : v < 0 ? t('Over by {count} — received + damaged exceeds dispatched', { count: -v }) : t('Matches dispatched')}{s.damaged > 0 && t(' · {count} damaged (will be written off)', { count: s.damaged })}
                  </div>
                  <Input className="h-11" placeholder={t('Note (optional)')} value={s.note} onChange={(e) => patch(l.productId, { note: e.target.value })} />
                </div>
              )}
            </div>
          )
        })}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-sm text-muted-foreground">{formatNumber(totalShort)} {t('short ·')} {formatNumber(totalDmg)} damaged</div>
          <Button className="h-12 px-6" disabled={invalid} onClick={confirm}>{t('Confirm receipt')}</Button>
        </div>
      </CardContent>
    </Card>
  )
}
