import type { Bill, Branch } from '@/types/domain'
import { formatDateTime, formatINR } from '@/lib/format'
import { PAY_LABEL } from '../lib/utils'

/** 80mm receipt body. Wrap in <PrintArea size="80mm"> to print. */
export function Receipt({ bill, branch, cashierName }: { bill: Bill; branch: Branch; cashierName: string }) {
  const money = (n: number) => formatINR(n, { decimals: true })
  return (
    <div className="mx-auto w-full max-w-[80mm] bg-white p-3 font-mono text-[12px] leading-snug text-black">
      <div className="text-center">
        <div className="font-heading text-lg font-bold tracking-wide">Navya Bakers</div>
        <div className="font-semibold">{branch.name}</div>
        <div>{branch.address}</div>
        <div>Ph: {branch.phone}</div>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between"><span>Bill: {bill.number}</span></div>
      <div className="flex justify-between"><span>{formatDateTime(bill.createdAt)}</span><span>By: {cashierName}</span></div>
      <hr className="my-2 border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-left"><th className="font-semibold">Item</th><th className="text-right font-semibold">Qty</th><th className="text-right font-semibold">Rate</th><th className="text-right font-semibold">Amt</th></tr>
        </thead>
        <tbody>
          {bill.lines.map((l) => (
            <tr key={l.productId} className="align-top">
              <td className="pr-1">{l.name}</td>
              <td className="text-right">{l.qty}</td>
              <td className="text-right">{l.price}</td>
              <td className="text-right">{l.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{money(bill.total)}</span></div>
      <div className="flex justify-between"><span>Incl. GST</span><span>{money(bill.gstAmount)}</span></div>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between"><span>Paid by</span><span>{PAY_LABEL[bill.paymentMode]}</span></div>
      {bill.paymentMode === 'cash' && bill.tendered !== undefined && (
        <>
          <div className="flex justify-between"><span>Tendered</span><span>{money(bill.tendered)}</span></div>
          <div className="flex justify-between"><span>Change</span><span>{money(bill.change ?? 0)}</span></div>
        </>
      )}
      <hr className="my-2 border-dashed border-black" />
      <div className="text-center font-semibold">Thank you! Visit again</div>
      <div className="mt-1 text-center text-[10px]">Navya Bakers · Fresh from our Angamaly kitchen</div>
    </div>
  )
}
