import { useLanguage } from '@/i18n/useLanguage'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDb } from '@/store/db'

export const ALL_BRANCHES = 'all'

type Props =
  | { mode?: 'single'; value: string; onChange: (branchId: string) => void; allowAll?: boolean; className?: string }
  | { mode: 'multi'; /** empty array = all branches */ value: string[]; onChange: (branchIds: string[]) => void; className?: string }

/** single: value is a branchId (or 'all' when allowAll). multi: value is branchIds[], [] means all. */
export function BranchSelect(props: Props) {
  const { t } = useLanguage()
  const branches = useDb((db) => db.branches)
  const active = branches.filter((b) => b.active)

  if (props.mode === 'multi') {
    const { value, onChange } = props
    const label = value.length === 0 || value.length === active.length ? 'All branches' : value.length === 1 ? active.find((b) => b.id === value[0])?.name ?? '1 branch' : `${value.length} branches`
    const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={props.className}>{label} <ChevronDown /></Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 space-y-1 p-2">
          <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => onChange([])}>{t('All branches')}</button>
          {active.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={value.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
              {b.name}
            </label>
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger className={props.className ?? 'w-48'}><SelectValue placeholder={t('Branch')} /></SelectTrigger>
      <SelectContent>
        {props.allowAll && <SelectItem value={ALL_BRANCHES}>{t('All branches')}</SelectItem>}
        {active.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
