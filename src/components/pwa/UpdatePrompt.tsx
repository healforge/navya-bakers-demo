import { useLanguage } from '@/i18n/useLanguage'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

/** Service-worker lifecycle toasts: "New version available → Reload" and "Ready to work offline". */
export function UpdatePrompt() {
  const { t } = useLanguage()
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    const id = toast(t('New version available'), {
      duration: Infinity,
      action: { label: t('Reload'), onClick: () => void updateServiceWorker(true) },
    })
    return () => { toast.dismiss(id) }
  }, [needRefresh, updateServiceWorker, t])

  useEffect(() => {
    if (!offlineReady) return
    toast.success(t('Ready to work offline'))
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, t])

  return null
}
