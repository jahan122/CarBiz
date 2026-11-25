import type { DealWithTotals } from '../types';
import { buyerBalanceDue, carTitle, fmtMoney, regOf, sellerBalanceDue, totalCost } from '../utils';

export default function KpiCards({ deals }: { deals: DealWithTotals[] }) {
  const activeDeals = deals.filter((d) => d.status === 'ACTIVE');
  const current = activeDeals[0];
  const soldCount = deals.filter((d) => d.status === 'SOLD').length;
  const filesWithAgentCount = deals.filter((d) => d.transfer_status === 'WITH_AGENT').length;

  const capitalTiedUp = activeDeals.reduce((sum, d) => sum + totalCost(d), 0);
  const totalPayableSellers = deals.reduce((sum, d) => sum + (sellerBalanceDue(d) ?? 0), 0);
  const totalReceivableBuyers = deals.reduce((sum, d) => sum + (buyerBalanceDue(d) ?? 0), 0);

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="rounded-xl border border-ink-200 bg-white p-4.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Current Active Car</span>
          {activeDeals.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              {activeDeals.length} in stock
            </span>
          )}
        </div>
        {current ? (
          <>
            <div className="mt-2 truncate text-base font-bold text-ink-900">
              {[current.make, current.model].filter(Boolean).join(' ') || 'Unnamed car'}{' '}
              <span className="font-mono text-sm text-brand-600">· {regOf(current)}</span>
            </div>
            <div className="mt-1 text-xs text-ink-500">
              Cost invested: <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(totalCost(current))}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-ink-400">{carTitle(current)}</div>
          </>
        ) : (
          <>
            <div className="mt-2 text-base font-semibold text-ink-500">No Active Car</div>
            <div className="mt-1 text-xs text-ink-500">All cars sold. Log a purchase to begin.</div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-4.5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Capital in Unsold Stock</div>
        <div className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{fmtMoney(capitalTiedUp)}</div>
        <div className="mt-1 text-xs text-ink-500">
          Across {activeDeals.length} unsold vehicle{activeDeals.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-4.5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Pending Balances</div>
        <div className="mt-2 flex items-baseline justify-between text-xs">
          <span className="text-ink-500">Due from buyers:</span>
          <span className={`font-bold tabular-nums ${totalReceivableBuyers > 0 ? 'text-emerald-700' : 'text-ink-700'}`}>
            {fmtMoney(totalReceivableBuyers)}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between text-xs">
          <span className="text-ink-500">Due to sellers:</span>
          <span className={`font-bold tabular-nums ${totalPayableSellers > 0 ? 'text-amber-700' : 'text-ink-700'}`}>
            {fmtMoney(totalPayableSellers)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-4.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Total Cars Sold</span>
          {filesWithAgentCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {filesWithAgentCount} file{filesWithAgentCount === 1 ? '' : 's'} w/ agent
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{soldCount}</div>
        <div className="mt-1 text-xs text-ink-500">{deals.length} car{deals.length === 1 ? '' : 's'} recorded in total</div>
      </div>
    </div>
  );
}