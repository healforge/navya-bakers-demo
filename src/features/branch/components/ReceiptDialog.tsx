import { Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PrintArea, printNow } from '@/components/common/PrintArea'
import { useDb } from '@/store/db'
import type { Bill, Branch } from '@/types/domain'
import { Receipt } from './Receipt'

export function ReceiptDialog({ bill, branch, open, onOpenChange, onNewBill, newBillLabel = 'New bill' }: {
  bill: Bill | null
  branch: Branch
  open: boolean
  onOpenChange: (o: boolean) => void
  onNewBill?: () => void
  newBillLabel?: string
}) {
  const users = useDb((d) => d.users)
  if (!bill) return null
  const cashier = users.find((u) => u.id === bill.cashierId)?.name ?? 'Cashier'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-3 overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bill {bill.number}</DialogTitle>
          <DialogDescription>Receipt preview (80 mm thermal)</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border">
          <PrintArea size="80mm"><Receipt bill={bill} branch={branch} cashierName={cashier} /></PrintArea>
        </div>
        <DialogFooter className="no-print gap-2 sm:flex-row">
          <Button variant="outline" className="h-12 flex-1" onClick={printNow}><Printer /> Print</Button>
          {onNewBill && <Button className="h-12 flex-1" onClick={onNewBill}>{newBillLabel}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
