import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'

/** Service-worker lifecycle toasts: "New version available → Reload" and "Ready to work offline". */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    const id = toast('New version available', {
      duration: Infinity,
      action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
    })
    return () => { toast.dismiss(id) }
  }, [needRefresh, updateServiceWorker])

  useEffect(() => {
    if (!offlineReady) return
    toast.success('Ready to work offline')
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  return null
}
