import { Languages } from 'lucide-react'
import { useLanguage } from '@/i18n/useLanguage'

export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <label className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 text-sm focus-within:ring-2 focus-within:ring-ring">
      <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label={t('Language')}
        className="h-8 bg-background text-foreground outline-none"
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'ml' ? 'ml' : 'en')}
      >
        <option value="en" lang="en">English</option>
        <option value="ml" lang="ml">മലയാളം</option>
      </select>
    </label>
  )
}
