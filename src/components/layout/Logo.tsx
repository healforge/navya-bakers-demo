import { useLanguage } from '@/i18n/useLanguage'
import { cn } from '@/lib/utils'

export function Logo({ className, wordmark = false, wordmarkClassName, size = 36 }: { className?: string; wordmark?: boolean; wordmarkClassName?: string; size?: number }) {
  const { t } = useLanguage()
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" height={size} style={{ height: size, width: "auto" }} className="shrink-0" />
      {wordmark && <span className={cn('font-heading text-lg font-semibold leading-none tracking-tight', wordmarkClassName)}>{t('Navya Bakers')}</span>}
    </span>
  )
}
