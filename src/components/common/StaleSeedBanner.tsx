import { useLanguage } from '@/i18n/useLanguage'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { todayISO } from '@/lib/dates'
import { dbActions, useDb } from '@/store/db'

export function StaleSeedBanner() {
  const { t } = useLanguage()
  const anchor = useDb((db) => db.anchorDate)
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000)
    return () => clearInterval(id)
  }, [])
  if (anchor >= today) return null
  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-b bg-warning/25 px-4 py-2 text-sm">
      <span>{t('Demo data was generated on {date}. Refresh to today?', { date: formatDate(anchor) })}</span>
      <Button size="sm" variant="outline" onClick={() => { dbActions.resetDemoData(); toast.success(t('Demo data refreshed')) }}>{t('Refresh')}</Button>
    </div>
  )
}
