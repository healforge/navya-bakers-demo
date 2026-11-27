import { useLanguage } from '@/i18n/useLanguage'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { t } = useLanguage()
  const { resolved, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('Toggle dark mode')}>
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
