import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const PAGE_RULE = { '80mm': '@page { size: 80mm auto; margin: 0 }', A4: '@page { size: A4; margin: 12mm }' } as const

/**
 * Print wrapper. Shows `children` on screen (preview) and portals a copy to <body> as `.print-area`,
 * which is the ONLY thing visible when printing. Injects the right @page rule while mounted.
 * Trigger printing with `printNow()`.
 */
export function PrintArea({ size, children, className }: { size: '80mm' | 'A4'; children: ReactNode; className?: string }) {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-print-page', size)
    style.textContent = PAGE_RULE[size]
    document.head.appendChild(style)
    return () => style.remove()
  }, [size])

  return (
    <>
      <div className={cn('print-preview', className)} data-size={size}>{children}</div>
      {createPortal(<div className="print-area print-only" data-size={size}>{children}</div>, document.body)}
    </>
  )
}

export function printNow(): void {
  window.print()
}
