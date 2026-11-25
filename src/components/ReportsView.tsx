import { useMemo, useState } from 'react';
import type { DealWithTotals } from '../types';
import { carTitle, fmtDate, fmtMoney, netProfit, regOf, totalCost } from '../utils';

interface Props {
  deals: DealWithTotals[];
}

interface MonthRow {
  monthKey: string;
  label: string;
  soldCount: number;
  revenue: number;
  cost: number;
  transferCost: number;
  profit: number;
}

interface MakeRow {
  make: string;
  soldCount: number;
  activeCount: number;
  revenue: number;
  profit: number;
}

function formatMonthLabel(ym: string): string {
  if (ym === 'Unknown') return 'Date Not Recorded';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ReportsView({ deals }: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const activeDeals = useMemo(() => deals.filter((d) => d.status === 'ACTIVE'), [deals]);
  const allSoldDeals = useMemo(() => deals.filter((d) => d.status === 'SOLD'), [deals]);

  // All-time profit across every sold deal with known purchase + sale price
  const allTimeStats = useMemo(() => {
    let profit = 0;
    let totalTransferSpend = 0;
    let counted = 0;
    for (const d of deals) {
      totalTransferSpend += d.transfer_cost ?? 0;
    }
    for (const d of allSoldDeals) {
      const p = netProfit(d);
      if (p !== null) {
        profit += p;
        counted++;
      }
    }
    return { profit, totalTransferSpend, counted, totalSold: allSoldDeals.length };
  }, [deals, allSoldDeals]);

  // Money currently tied up in unsold cars
  const inventoryStats = useMemo(() => {
    let purchaseCapital = 0;
    let prepExpenses = 0;
    let transferExpenses = 0;
    let balanceOwedToSellers = 0;
    for (const d of activeDeals) {
      purchaseCapital += d.purchase_price ?? 0;
      prepExpenses += d.total_expenses;
      transferExpenses += d.transfer_cost ?? 0;
      if (d.purchase_price !== null) {
        balanceOwedToSellers += Math.max(0, d.purchase_price - d.paid_to_seller);
      }
    }
    const totalTiedUp = purchaseCapital + prepExpenses + transferExpenses;
    const netCashOutlaid = Math.max(0, totalTiedUp - balanceOwedToSellers);
    return { totalTiedUp, purchaseCapital, prepExpenses, transferExpenses, balanceOwedToSellers, netCashOutlaid };
  }, [activeDeals]);

  // Filtered sold deals (based on sale_date)
  const filteredSold = useMemo(() => {
    return allSoldDeals.filter((d) => {
      if (!fromDate && !toDate) return true;
      const dt = d.sale_date ?? '';
      if (!dt) return false;
      if (fromDate && dt < fromDate) return false;
      if (toDate && dt > toDate) return false;
      return true;
    });
  }, [allSoldDeals, fromDate, toDate]);

  const filteredSummary = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let profit = 0;
    let profitableCount = 0;
    for (const d of filteredSold) {
      revenue += d.sale_price ?? 0;
      cost += totalCost(d);
      const p = netProfit(d);
      if (p !== null) {
        profit += p;
        profitableCount++;
      }
    }
    const avgProfit = profitableCount > 0 ? profit / profitableCount : 0;
    return { revenue, cost, profit, profitableCount, avgProfit };
  }, [filteredSold]);

  // Profit grouped by month
  const monthlyRows = useMemo<MonthRow[]>(() => {
    const map = new Map<string, MonthRow>();
    for (const d of filteredSold) {
      const key = d.sale_date && d.sale_date.length >= 7 ? d.sale_date.slice(0, 7) : 'Unknown';
      const cur = map.get(key) ?? {
        monthKey: key,
        label: formatMonthLabel(key),
        soldCount: 0,
        revenue: 0,
        cost: 0,
        transferCost: 0,
        profit: 0,
      };
      cur.soldCount += 1;
      cur.revenue += d.sale_price ?? 0;
      cur.cost += totalCost(d);
      cur.transferCost += d.transfer_cost ?? 0;
      const p = netProfit(d);
      if (p !== null) cur.profit += p;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredSold]);

  // Best-selling makes
  const makeRows = useMemo<MakeRow[]>(() => {
    const map = new Map<string, MakeRow>();
    for (const d of filteredSold) {
      const make = (d.make ?? 'Unspecified').trim() || 'Unspecified';
      const cur = map.get(make) ?? { make, soldCount: 0, activeCount: 0, revenue: 0, profit: 0 };
      cur.soldCount += 1;
      cur.revenue += d.sale_price ?? 0;
      const p = netProfit(d);
      if (p !== null) cur.profit += p;
      map.set(make, cur);
    }
    for (const d of activeDeals) {
      const make = (d.make ?? 'Unspecified').trim() || 'Unspecified';
      const cur = map.get(make) ?? { make, soldCount: 0, activeCount: 0, revenue: 0, profit: 0 };
      cur.activeCount += 1;
      map.set(make, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.soldCount - a.soldCount || b.profit - a.profit);
  }, [filteredSold, activeDeals]);

  const maxMakeSold = Math.max(1, ...makeRows.map((m) => m.soldCount));

  function setQuickPreset(preset: 'thisMonth' | 'last30' | 'thisYear' | 'all') {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'thisMonth') {
      setFromDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
      setToDate(iso(now));
    } else if (preset === 'last30') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      setFromDate(iso(start));
      setToDate(iso(now));
    } else if (preset === 'thisYear') {
      setFromDate(`${now.getFullYear()}-01-01`);
      setToDate(iso(now));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-4">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">All-Time Net Profit</div>
          <div
            className={`mt-2 text-2xl font-bold tabular-nums ${
              allTimeStats.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {allTimeStats.profit < 0 ? '− ' : '+ '}
            {fmtMoney(Math.abs(allTimeStats.profit))}
          </div>
          <div className="mt-1 text-xs text-ink-500">
            Across {allTimeStats.counted} completed deal{allTimeStats.counted === 1 ? '' : 's'} ({allTimeStats.totalSold} total sold)
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Capital Tied Up (Unsold)</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-brand-700">{fmtMoney(inventoryStats.totalTiedUp)}</div>
          <div className="mt-1 text-xs text-ink-500">
            {activeDeals.length} active · Exp {fmtMoney(inventoryStats.prepExpenses)} · Transfer {fmtMoney(inventoryStats.transferExpenses)}
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Filtered Period Profit</div>
          <div
            className={`mt-2 text-2xl font-bold tabular-nums ${
              filteredSummary.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {filteredSummary.profit < 0 ? '− ' : '+ '}
            {fmtMoney(Math.abs(filteredSummary.profit))}
          </div>
          <div className="mt-1 text-xs text-ink-500">
            {filteredSold.length} car{filteredSold.length === 1 ? '' : 's'} sold · Avg {fmtMoney(filteredSummary.avgProfit)} / car
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Transfer Costing</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-indigo-700">{fmtMoney(allTimeStats.totalTransferSpend)}</div>
          <div className="mt-1 text-xs text-ink-500">
            Payable on unsold: <span className="font-semibold text-amber-700">{fmtMoney(inventoryStats.balanceOwedToSellers)}</span>
          </div>
        </div>
      </div>

      {/* Date-Range Filter Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-ink-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Sale Date From</label>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Sale Date To</label>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          {(fromDate || toDate) && (
            <button type="button" className="btn btn-secondary" onClick={() => setQuickPreset('all')}>
              Clear Dates
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-ink-500">Quick range:</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('thisMonth')}>
            This Month
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('last30')}>
            Last 30 Days
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('thisYear')}>
            This Year
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('all')}>
            All Time
          </button>
        </div>
      </div>

      {/* Main Analytics Grid: Profit by Month + Best-Selling Makes */}
      <div className="grid grid-cols-12 gap-4">
        {/* Profit by Month */}
        <div className="col-span-7 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-ink-900">Profit by Month</h2>
              <p className="text-xs text-ink-500">Grouped by vehicle sale month</p>
            </div>
            <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-700">
              {monthlyRows.length} month{monthlyRows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Month</th>
                  <th className="px-4 py-2.5 text-center">Sold</th>
                  <th className="px-4 py-2.5 text-right">Sales</th>
                  <th className="px-4 py-2.5 text-right">Transfer</th>
                  <th className="px-4 py-2.5 text-right">Total Cost</th>
                  <th className="px-4 py-2.5 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {monthlyRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-500">
                      No sold cars in the selected date range.
                    </td>
                  </tr>
                ) : (
                  monthlyRows.map((m) => (
                    <tr key={m.monthKey} className="hover:bg-ink-50/70">
                      <td className="px-4 py-2.5 font-semibold text-ink-900">{m.label}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-ink-700">{m.soldCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{fmtMoney(m.revenue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-indigo-700">{fmtMoney(m.transferCost)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{fmtMoney(m.cost)}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                          m.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {m.profit < 0 ? '− ' : '+ '}
                        {fmtMoney(Math.abs(m.profit))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best-Selling Makes */}
        <div className="col-span-5 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
          <div className="border-b border-ink-200 px-5 py-3.5">
            <h2 className="text-sm font-bold text-ink-900">Best-Selling Makes</h2>
            <p className="text-xs text-ink-500">Units sold, profit generated &amp; current active stock</p>
          </div>
          <div className="divide-y divide-ink-100 p-4">
            {makeRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-500">No vehicle records available yet.</div>
            ) : (
              makeRows.map((row) => {
                const pct = Math.round((row.soldCount / maxMakeSold) * 100);
                return (
                  <div key={row.make} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-900">{row.make}</span>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {row.soldCount} sold
                        </span>
                        {row.activeCount > 0 && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            {row.activeCount} in stock
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-bold tabular-nums ${
                          row.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {row.soldCount > 0 ? `${row.profit < 0 ? '−' : '+'} ${fmtMoney(Math.abs(row.profit))}` : '—'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{ width: `${row.soldCount > 0 ? Math.max(8, pct) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Unsold Inventory Breakdown */}
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-ink-900">Money Tied Up in Unsold Cars ({activeDeals.length})</h2>
            <p className="text-xs text-ink-500">Current active showroom stock and capital breakdown</p>
          </div>
          <div className="text-sm font-bold tabular-nums text-brand-700">Total: {fmtMoney(inventoryStats.totalTiedUp)}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Car</th>
                <th className="px-4 py-2.5">Reg #</th>
                <th className="px-4 py-2.5">Purchase Date</th>
                <th className="px-4 py-2.5 text-right">Purchase Price</th>
                <th className="px-4 py-2.5 text-right">Expenses</th>
                <th className="px-4 py-2.5 text-right">Transfer Cost</th>
                <th className="px-4 py-2.5 text-right">Total Tied Up</th>
                <th className="px-4 py-2.5 text-right">Due to Seller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {activeDeals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-ink-500">
                    No unsold cars currently in stock.
                  </td>
                </tr>
              ) : (
                activeDeals.map((d) => {
                  const due = d.purchase_price !== null ? Math.max(0, d.purchase_price - d.paid_to_seller) : null;
                  return (
                    <tr key={d.id} className="hover:bg-ink-50/70">
                      <td className="px-4 py-2.5 font-semibold text-ink-900">{carTitle(d)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-700">{regOf(d)}</td>
                      <td className="px-4 py-2.5 text-ink-600">{fmtDate(d.purchase_date)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(d.purchase_price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(d.total_expenses)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-indigo-700">{fmtMoney(d.transfer_cost ?? 0)}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-ink-900">{fmtMoney(totalCost(d))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">
                        {due === null ? '—' : due === 0 ? 'Paid' : fmtMoney(due)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}