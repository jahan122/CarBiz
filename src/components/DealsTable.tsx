import type { DealWithTotals } from '../types';
import { buyerBalanceDue, fmtDate, fmtMoney, netProfit, sellerBalanceDue, totalCost } from '../utils';

interface Props {
  deals: DealWithTotals[];
  onInspect: (d: DealWithTotals) => void;
  onWhatsApp: (d: DealWithTotals) => void;
  onExpense: (d: DealWithTotals) => void;
  onPayments: (d: DealWithTotals) => void;
  onReceipt: (d: DealWithTotals) => void;
  onSold: (d: DealWithTotals) => void;
  onEdit: (d: DealWithTotals) => void;
  onDelete: (d: DealWithTotals) => void;
}

const th = 'whitespace-nowrap border-b border-ink-200 bg-ink-50/95 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-ink-500 backdrop-blur-sm';
const td = 'border-b border-ink-100 px-3 py-3 align-top';
const dash = <span className="text-ink-300">—</span>;

function TransferBadge({ deal }: { deal: DealWithTotals }) {
  if (deal.transfer_status === 'COMPLETED') {
    return (
      <span
        className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
        title={deal.transfer_completed_date ? `Completed on ${fmtDate(deal.transfer_completed_date)}` : 'Transfer completed'}
      >
        ✓ Transfer Done{deal.transfer_completed_date ? ` (${fmtDate(deal.transfer_completed_date)})` : ''}
      </span>
    );
  }
  if (deal.transfer_status === 'WITH_AGENT') {
    return (
      <span
        className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
        title={`Handed over on ${fmtDate(deal.file_handover_date)}`}
      >
        File w/ Agent{deal.transfer_agent_name ? `: ${deal.transfer_agent_name}` : ''}
        {deal.file_handover_date ? ` (${fmtDate(deal.file_handover_date)})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
      File w/ Us
    </span>
  );
}

function ProfitBadge({ deal }: { deal: DealWithTotals }) {
  if (deal.status === 'ACTIVE') {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        Active / Unsold
      </span>
    );
  }
  const p = netProfit(deal);
  if (p === null) {
    return (
      <span
        className="inline-flex whitespace-nowrap rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-ink-200"
        title="Purchase price or sale price not recorded"
      >
        Sold · profit n/a
      </span>
    );
  }
  const good = p >= 0;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ${
        good ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
      }`}
    >
      {good ? '+' : '−'} {fmtMoney(Math.abs(p))}
    </span>
  );
}

export default function DealsTable({
  deals,
  onInspect,
  onWhatsApp,
  onExpense,
  onPayments,
  onReceipt,
  onSold,
  onEdit,
  onDelete,
}: Props) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10">
        <tr>
          <th className={th}>Car &amp; File Status</th>
          <th className={th}>Bought From</th>
          <th className={th}>Seller</th>
          <th className={`${th} text-right`}>Purchase &amp; Paid</th>
          <th className={`${th} text-right`}>Expenses</th>
          <th className={`${th} text-right`}>Transfer Cost</th>
          <th className={`${th} text-right`}>Total Cost</th>
          <th className={th}>Sold To &amp; Received</th>
          <th className={`${th} min-w-[140px]`}>Net Profit</th>
          <th className={`${th} sticky right-0 z-20 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((d) => {
          const sold = d.status === 'SOLD';
          const title = [d.year, d.make, d.model].filter(Boolean).join(' ');
          const sDue = sellerBalanceDue(d);
          const bDue = buyerBalanceDue(d);
          const transferCost = d.transfer_cost ?? 0;

          return (
            <tr
              key={d.id}
              onClick={() => onInspect(d)}
              title="Click row to open quick inspection drawer"
              className="group cursor-pointer transition-colors hover:bg-brand-50/40"
            >
              <td className={td}>
                <div className="font-semibold text-ink-900 group-hover:text-brand-700">
                  {title || <span className="text-ink-500">Unnamed car</span>}
                  {d.variant && <span className="font-normal text-ink-500"> {d.variant}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                  {d.color && <span>{d.color}</span>}
                  {d.registration_number ? (
                    <span className="rounded border border-ink-300 bg-ink-50 px-1.5 py-px font-mono font-bold tracking-wide text-ink-800">
                      {d.registration_number}
                    </span>
                  ) : (
                    <span className="text-ink-300">No reg #</span>
                  )}
                  {d.attachment_count > 0 && (
                    <span className="rounded bg-blue-50 px-1.5 py-px text-[11px] font-semibold text-blue-700">
                      📎 {d.attachment_count}
                    </span>
                  )}
                </div>
                <div className="mt-1.5">
                  <TransferBadge deal={d} />
                </div>
                {(d.chassis_number || d.engine_number) && (
                  <div className="mt-1 font-mono text-[11px] text-ink-500">
                    {d.chassis_number && <span>Ch: {d.chassis_number}</span>}
                    {d.chassis_number && d.engine_number && <span> · </span>}
                    {d.engine_number && <span>En: {d.engine_number}</span>}
                  </div>
                )}
              </td>

              <td className={td}>
                <div className="font-medium text-ink-900">{d.bought_from_location || dash}</div>
                <div className="mt-0.5 text-xs text-ink-500">{fmtDate(d.purchase_date)}</div>
              </td>

              <td className={td}>
                <div className="font-medium text-ink-900">
                  {d.seller_name || dash}
                  {d.seller_father_name && <span className="font-normal text-ink-500"> S/O {d.seller_father_name}</span>}
                </div>
                {d.seller_contact && <div className="mt-0.5 text-xs text-ink-500">{d.seller_contact}</div>}
                {d.seller_address && <div className="mt-0.5 max-w-[190px] text-xs leading-snug text-ink-500">{d.seller_address}</div>}
              </td>

              <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                <div className="font-medium text-ink-900">{d.purchase_price === null ? dash : fmtMoney(d.purchase_price)}</div>
                {d.purchase_price !== null && (
                  <div className="mt-0.5 text-[11px]">
                    {sDue === 0 ? (
                      <span className="font-medium text-emerald-700">Paid in full</span>
                    ) : (
                      <span className="font-medium text-amber-700">Due: {fmtMoney(sDue)}</span>
                    )}
                  </div>
                )}
              </td>

              <td className={`${td} whitespace-nowrap text-right tabular-nums text-ink-700`}>
                {d.total_expenses > 0 ? fmtMoney(d.total_expenses) : dash}
              </td>

              <td className={`${td} whitespace-nowrap text-right tabular-nums text-indigo-700`}>
                {transferCost > 0 ? fmtMoney(transferCost) : dash}
              </td>

              <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-ink-900`}>
                {fmtMoney(totalCost(d))}
              </td>

              <td className={td}>
                {sold ? (
                  <>
                    <div className="font-semibold tabular-nums text-ink-900">
                      {d.sale_price === null ? <span className="font-normal text-ink-500">Price not entered</span> : fmtMoney(d.sale_price)}
                    </div>
                    {d.sale_price !== null && (
                      <div className="mt-0.5 text-[11px]">
                        {bDue === 0 ? (
                          <span className="font-medium text-emerald-700">Received in full</span>
                        ) : (
                          <span className="font-medium text-amber-700">Due: {fmtMoney(bDue)}</span>
                        )}
                      </div>
                    )}
                    {d.purchaser_name && (
                      <div className="mt-0.5 text-xs font-medium text-ink-700">
                        {d.purchaser_name}
                        {d.purchaser_father_name && <span className="font-normal text-ink-500"> S/O {d.purchaser_father_name}</span>}
                      </div>
                    )}
                    <div className="text-xs text-ink-500">
                      {[d.purchaser_contact, d.sale_date ? fmtDate(d.sale_date) : null].filter(Boolean).join(' · ')}
                    </div>
                    {d.purchaser_address && (
                      <div className="mt-0.5 max-w-[190px] text-xs leading-snug text-ink-500">{d.purchaser_address}</div>
                    )}
                  </>
                ) : (
                  dash
                )}
              </td>

              <td className={`${td} min-w-[140px]`}>
                <ProfitBadge deal={d} />
              </td>

              <td
                onClick={(e) => e.stopPropagation()}
                className={`${td} sticky right-0 cursor-default bg-white shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)] group-hover:bg-brand-50/40`}
              >
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn btn-sm bg-[#25D366] text-white hover:bg-[#1ebe5d]"
                    onClick={() => onWhatsApp(d)}
                    title="Choose recipient & share receipt via WhatsApp"
                  >
                    WhatsApp
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPayments(d)} title="Track advance & installments">
                    Payments
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onExpense(d)}>
                    + Expense
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onReceipt(d)} title="Print PDF Receipt">
                    Receipt
                  </button>
                  <button type="button" className={`btn btn-sm ${sold ? 'btn-secondary' : 'btn-primary'}`} onClick={() => onSold(d)}>
                    {sold ? 'Edit Sale' : 'Sold'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(d)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50" onClick={() => onDelete(d)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}