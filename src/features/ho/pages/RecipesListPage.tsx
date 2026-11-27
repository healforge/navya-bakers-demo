import { useLanguage } from '@/i18n/useLanguage'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, Money, PageHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { formatPct } from '@/lib/format'
import { useDb } from '@/store/db'
import { netPrice, productMarginPct, unitCostMap } from '@/store/selectors'
import type { Product } from '@/types/domain'
import { marginTone } from '../components/shared'

export default function RecipesListPage() {
  const { t } = useLanguage()
  const db = useDb((d) => d)
  const nav = useNavigate()
  const costs = useMemo(() => unitCostMap(db), [db])
  const withRecipe = useMemo(() => new Set(db.recipes.map((r) => r.productId)), [db.recipes])

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    { accessorKey: 'name', header: 'Product', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'category', header: 'Category' },
    { id: 'recipe', header: 'Recipe', accessorFn: (p) => (withRecipe.has(p.id) ? 'yes' : 'no'), cell: ({ getValue }) => getValue<string>() === 'yes' ? <Badge variant="secondary">{t('Defined')}</Badge> : <Badge variant="outline" className="text-danger">{t('Missing')}</Badge> },
    { id: 'cost', header: 'Unit cost', accessorFn: (p) => costs[p.id] ?? 0, cell: ({ getValue }) => <Money value={getValue<number>()} decimals /> },
    { accessorKey: 'price', header: 'MRP', cell: ({ row }) => <Money value={row.original.price} decimals /> },
    { id: 'net', header: 'Net price', accessorFn: (p) => netPrice(p), cell: ({ getValue }) => <Money value={getValue<number>()} decimals /> },
    { id: 'margin', header: 'Margin', accessorFn: (p) => (withRecipe.has(p.id) ? productMarginPct(db, p) : null), cell: ({ getValue }) => { const v = getValue<number | null>(); return v === null ? '—' : <span className={`font-medium ${marginTone(v)}`}>{formatPct(v)}</span> } },
  ], [db, costs, withRecipe, t])

  return (
    <>
      <PageHeader title={t('Recipes & costing')} description={t('Unit cost is computed from ingredient costs and recipe yield. Margin is on net (ex-GST) price.')} />
      <DataTable columns={columns} data={db.products} getRowId={(p) => p.id} onRowClick={(p) => nav(`/ho/recipes/${p.id}`)} searchPlaceholder={t('Search products…')} pageSize={20} />
    </>
  )
}
