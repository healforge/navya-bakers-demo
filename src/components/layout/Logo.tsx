import { cn } from '@/lib/utils'

export function Logo({ className, wordmark = true, wordmarkClassName, size = 32 }: { className?: string; wordmark?: boolean; wordmarkClassName?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={size} height={size} className="shrink-0 rounded-lg" />
      {wordmark && <span className={cn('font-heading text-lg font-semibold leading-none tracking-tight', wordmarkClassName)}>Navya Bakers</span>}
    </span>
  )
}
