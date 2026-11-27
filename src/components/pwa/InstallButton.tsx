import { useLanguage } from '@/i18n/useLanguage'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from './useInstallPrompt'

/** Renders nothing unless the browser offered an install prompt. */
export function InstallButton({ className }: { className?: string }) {
  const { t } = useLanguage()
  const { canInstall, install } = useInstallPrompt()
  if (!canInstall) return null
  return (
    <Button variant="outline" size="sm" onClick={() => void install()} className={className}>
      <Download /> {t('Install app')}
    </Button>
  )
}
