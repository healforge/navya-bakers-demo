import { useLanguage } from '@/i18n/useLanguage'
import { useParams } from 'react-router'
import { PageHeader } from '@/components/common'
import { POForm } from '../components/POForm'

/** `/ho/purchase/new` and `/ho/purchase/:id/edit`. */
export default function PurchaseEditPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  return (
    <>
      <PageHeader title={id ? t('Edit purchase order') : t('New purchase order')} />
      <POForm key={id ?? 'new'} poId={id} />
    </>
  )
}
