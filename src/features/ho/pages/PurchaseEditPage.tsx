import { useParams } from 'react-router'
import { PageHeader } from '@/components/common'
import { POForm } from '../components/POForm'

/** `/ho/purchase/new` and `/ho/purchase/:id/edit`. */
export default function PurchaseEditPage() {
  const { id } = useParams()
  return (
    <>
      <PageHeader title={id ? 'Edit purchase order' : 'New purchase order'} />
      <POForm key={id ?? 'new'} poId={id} />
    </>
  )
}
