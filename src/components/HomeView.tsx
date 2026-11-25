import { useEffect, useMemo, useRef, useState } from 'react';
import type { DealWithTotals } from '../types';
import {
  buyerBalanceDue,
  carTitle,
  fmtDate,
  fmtMoney,
  matchesQuery,
  netProfit,
  regOf,
  sellerBalanceDue,
} from '../utils';

interface Props {
  deals: DealWithTotals[];
  onInspect: (d: DealWithTotals) => void;
  onWhatsApp: (d: DealWithTotals) => void;
  onPayments: (d: DealWithTotals) => void;
  onReceipt: (d: DealWithTotals) => void;
  onCreateNew: (startSold?: boolean) => void;
  onNavigateLedger: (initialTab?: 'ALL' | 'ACTIVE' | 'SOLD') => void;
}

type QuickFilter = 'NONE' | 'ACTIVE' | 'BUYER_DUE' | 'SELLER_DUE' | 'WITH_AGENT';

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return null;
  const diff = Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

export default function HomeView({
  deals,
  onInspect,
  onWhatsApp,
  onPayments,
  onReceipt,
  onCreateNew,
  onNavigateLedger,
}: Props) {
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('NONE');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (!inField && e.key === '/')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Action Queues for Follow-Ups
  const queues = useMemo(() => {
    const active: DealWithTotals[] = [];
    const pendingBalances: { deal: DealWithTotals; type: 'BUYER' | 'SELLER'; amount: number }[] = [];
    const pendingTransfers: DealWithTotals[] = [];

    for (const d of deals) {
      if (d.status === 'ACTIVE') active.push(d);

      const bDue = buyerBalanceDue(d) ?? 0;
      const sDue = sellerBalanceDue(d) ?? 0;
      if (bDue > 0) pendingBalances.push({ deal: d, type: 'BUYER', amount: bDue });
      if (sDue > 0) pendingBalances.push({ deal: d, type: 'SELLER', amount: sDue });

      if (d.transfer_status === 'WITH_AGENT' || (d.status === 'SOLD' && d.transfer_status !== 'COMPLETED')) {
        pendingTransfers.push(d);
      }
    }

    return {
      active,
      pendingBalances,
      pendingTransfers,
      buyerDueCount: pendingBalances.filter((x) => x.type === 'BUYER').length,
      sellerDueCount: pendingBalances.filter((x) => x.type === 'SELLER').length,
      withAgentCount: deals.filter((d) => d.transfer_status === 'WITH_AGENT').length,
    };
  }, [deals]);

  // Filtered Results (when typing OR when a quick-filter pill is active)
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && quickFilter === 'NONE') return [];

    return deals.filter((d) => {
      if (quickFilter === 'ACTIVE' && d.status !== 'ACTIVE') return false;
      if (quickFilter === 'BUYER_DUE' && (buyerBalanceDue(d) ?? 0) <= 0) return false;
      if (quickFilter === 'SELLER_DUE' && (sellerBalanceDue(d) ?? 0) <= 0) return false;
      if (quickFilter === 'WITH_AGENT' && d.transfer_status !== 'WITH_AGENT') return false;

      if (q) {
        const agentMatch = (d.transfer_agent_name ?? '').toLowerCase().includes(q);
        if (!matchesQuery(d, query) && !agentMatch) return false;
      }
      return true;
    });
  }, [deals, query, quickFilter]);

  const isFiltering = query.trim() !== '' || quickFilter !== 'NONE';
  const recentDeals = useMemo(() => deals.slice(0, 6), [deals]);

  function clearSearchAndFilter() {
    setQuery('');
    setQuickFilter('NONE');
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      {/* Zone 1: Instant Global Search & Quick-Action Hero */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Global Search Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
                Quick Lookup
              </span>
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
                Ctrl + K or /
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">
              Search any vehicle, party, or excise file
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Type a registration #, chassis #, buyer/seller name, phone, or use a quick filter below.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    clearSearchAndFilter();
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder="e.g. BXK-482, Corolla, Imran, 0321-5550148…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50/70 pl-10 pr-20 text-sm text-slate-900 placeholder-slate-400 transition focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/15"
              />
              {isFiltering && (
                <button
                  type="button"
                  onClick={clearSearchAndFilter}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                >
                  Clear
                </button>
              )}
            </div>

            {/* One-Click Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ACTIVE', label: 'Unsold Stock', count: queues.active.length },
                  { id: 'BUYER_DUE', label: 'Buyer Dues', count: queues.buyerDueCount },
                  { id: 'SELLER_DUE', label: 'Seller Dues', count: queues.sellerDueCount },
                  { id: 'WITH_AGENT', label: 'Files w/ Agent', count: queues.withAgentCount },
                ] as { id: QuickFilter; label: string; count: number }[]
              ).map((pill) => {
                const active = quickFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setQuickFilter(active ? 'NONE' : pill.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick-Action Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1">
          <button
            type="button"
            onClick={() => onCreateNew(false)}
            className="group flex items-center justify-between rounded-2xl border border-brand-600 bg-brand-600 px-5 py-3.5 text-left text-white shadow-xs transition hover:bg-brand-700"
          >
            <div>
              <div className="text-sm font-bold">+ Log New Car Purchase</div>
              <div className="mt-0.5 text-xs text-blue-100">Record a newly bought vehicle into stock</div>
            </div>
            <span className="rounded-lg bg-white/15 px-2.5 py-1 font-mono text-xs font-semibold">Ctrl+N</span>
          </button>

          <button
            type="button"
            onClick={() => onCreateNew(true)}
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-left shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <div>
              <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-800">+ Log Direct Sale</div>
              <div className="mt-0.5 text-xs text-slate-500">Enter a car that has already been sold</div>
            </div>
            <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700">→</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateLedger('ALL')}
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-left shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
          >
            <div>
              <div className="text-sm font-bold text-slate-900">Browse Full Inventory Ledger</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Open all {deals.length} deals with full table &amp; filters
              </div>
            </div>
            <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
          </button>
        </div>
      </section>

      {/* Instant Search / Quick-Filter Results */}
      {isFiltering && (
        <section className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Matching Vehicles ({filteredResults.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={clearSearchAndFilter}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Reset (Esc)
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
              No entries matched your current search or filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredResults.map((d) => {
                const sold = d.status === 'SOLD';
                const sDue = sellerBalanceDue(d) ?? 0;
                const bDue = buyerBalanceDue(d) ?? 0;

                return (
                  <div
                    key={d.id}
                    onClick={() => onInspect(d)}
                    className="group cursor-pointer rounded-xl border border-slate-200 bg-slate-50/40 p-4 transition hover:border-brand-400 hover:bg-white hover:shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-slate-800">
                            {regOf(d)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              sold ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sold ? 'Sold' : 'Active'}
                          </span>
                        </div>
                        <div className="mt-1.5 font-bold text-slate-900 group-hover:text-brand-700">
                          {carTitle(d) || 'Unnamed Vehicle'}
                          {d.variant && <span className="font-normal text-slate-500"> {d.variant}</span>}
                        </div>
                      </div>

                      <div className="text-right tabular-nums">
                        <div className="text-xs font-bold text-slate-900">
                          {sold && d.sale_price !== null
                            ? fmtMoney(d.sale_price)
                            : d.purchase_price !== null
                              ? fmtMoney(d.purchase_price)
                              : '—'}
                        </div>
                        <div className="text-[11px] text-slate-500">{sold ? 'Sale Price' : 'Purchase Price'}</div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 text-xs">
                      <div className="text-slate-600">
                        {sold ? (
                          <span>
                            Buyer: <strong>{d.purchaser_name || '—'}</strong>
                            {bDue > 0 && <span className="ml-1.5 font-semibold text-emerald-700">(Due: {fmtMoney(bDue)})</span>}
                          </span>
                        ) : (
                          <span>
                            Seller: <strong>{d.seller_name || '—'}</strong>
                            {sDue > 0 && <span className="ml-1.5 font-semibold text-amber-700">(Due: {fmtMoney(sDue)})</span>}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onWhatsApp(d)}
                          className="rounded-md bg-[#25D366] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#1ebe5d]"
                        >
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => onPayments(d)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Payments
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Zone 2: Actionable Follow-Up Queues (Replaces KPI Cards) */}
      {deals.length > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Open Payment Balances Queue */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Pending Payment Follow-Ups ({queues.pendingBalances.length})
                </h3>
                <p className="text-[11px] text-slate-500">Unsettled buyer installments &amp; seller balances</p>
              </div>
            </div>

            {queues.pendingBalances.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-5 py-8 text-xs text-slate-500">
                ✓ All buyer and seller accounts are settled.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queues.pendingBalances.slice(0, 4).map(({ deal, type, amount }) => (
                  <div
                    key={`${deal.id}-${type}`}
                    onClick={() => onInspect(deal)}
                    className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-px font-mono text-[11px] font-bold text-slate-800">
                          {regOf(deal)}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-900">{carTitle(deal)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">
                        {type === 'BUYER'
                          ? `Receivable from ${deal.purchaser_name || 'Buyer'}`
                          : `Payable to ${deal.seller_name || 'Seller'}`}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="text-right tabular-nums">
                        <div
                          className={`text-xs font-bold ${
                            type === 'BUYER' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {fmtMoney(amount)}
                        </div>
                        <div className="text-[10px] font-semibold uppercase text-slate-400">
                          {type === 'BUYER' ? 'Due In' : 'Due Out'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPayments(deal)}
                        className="btn btn-secondary btn-sm text-[11px]"
                      >
                        + Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Excise File & Transfer Tracking Queue */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Excise Files &amp; Transfers ({queues.pendingTransfers.length})
                </h3>
                <p className="text-[11px] text-slate-500">Files currently with transfer agents or sold awaiting transfer</p>
              </div>
            </div>

            {queues.pendingTransfers.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-5 py-8 text-xs text-slate-500">
                ✓ No pending excise transfers requiring attention.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {queues.pendingTransfers.slice(0, 4).map((deal) => {
                  const daysOut = daysSince(deal.file_handover_date);
                  return (
                    <div
                      key={deal.id}
                      onClick={() => onInspect(deal)}
                      className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-px font-mono text-[11px] font-bold text-slate-800">
                            {regOf(deal)}
                          </span>
                          <span className="truncate text-xs font-bold text-slate-900">{carTitle(deal)}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                          {deal.transfer_status === 'WITH_AGENT'
                            ? `With ${deal.transfer_agent_name || 'Agent'}${daysOut !== null ? ` · ${daysOut}d ago` : ''}`
                            : 'Sold · File still in showroom'}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            deal.transfer_status === 'WITH_AGENT'
                              ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {deal.transfer_status === 'WITH_AGENT' ? 'With Agent' : 'Pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onWhatsApp(deal)}
                          className="rounded-md bg-[#25D366] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#1ebe5d]"
                          title="Send vehicle/CNIC details to agent or party"
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Zone 3: Recent Purchases & Sales */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Vehicles</h3>
            <p className="text-xs text-slate-500">Latest entries sorted by purchase date — click any row to inspect</p>
          </div>
          {deals.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateLedger('ALL')}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
            >
              View all {deals.length} deals →
            </button>
          )}
        </div>

        {recentDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="text-base font-bold text-slate-900">Your showroom ledger is empty</div>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Start by logging your first car purchase or recording a completed sale.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button type="button" className="btn btn-secondary" onClick={() => onCreateNew(true)}>
                + Log Direct Sale
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onCreateNew(false)}>
                + Log New Car Purchase
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentDeals.map((d) => {
              const sold = d.status === 'SOLD';
              const profit = netProfit(d);
              const sDue = sellerBalanceDue(d) ?? 0;
              const bDue = buyerBalanceDue(d) ?? 0;

              return (
                <div
                  key={d.id}
                  onClick={() => onInspect(d)}
                  className="group flex cursor-pointer flex-wrap items-center justify-between gap-4 px-6 py-3.5 transition hover:bg-slate-50/90"
                >
                  <div className="flex min-w-[240px] items-center gap-3.5">
                    <span className="w-24 shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-center font-mono text-xs font-bold tabular-nums text-slate-800">
                      {regOf(d)}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-brand-700">
                        {carTitle(d) || 'Unnamed Vehicle'}
                        {d.variant && <span className="font-normal text-slate-500"> {d.variant}</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="tabular-nums">Bought {fmtDate(d.purchase_date)}</span>
                        {d.seller_name && <span>· From {d.seller_name}</span>}
                        {sold && d.purchaser_name && <span>· Sold to {d.purchaser_name}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="text-right tabular-nums">
                      <div className="text-xs font-bold text-slate-900">
                        {sold && d.sale_price !== null
                          ? fmtMoney(d.sale_price)
                          : d.purchase_price !== null
                            ? fmtMoney(d.purchase_price)
                            : '—'}
                      </div>
                      <div className="mt-0.5 text-[11px]">
                        {sold ? (
                          bDue > 0 ? (
                            <span className="font-semibold text-emerald-700">Buyer due: {fmtMoney(bDue)}</span>
                          ) : profit !== null ? (
                            <span className={profit >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                              Profit: {profit >= 0 ? '+' : '−'}
                              {fmtMoney(Math.abs(profit))}
                            </span>
                          ) : (
                            <span className="text-slate-500">Sold</span>
                          )
                        ) : sDue > 0 ? (
                          <span className="font-semibold text-amber-700">Seller due: {fmtMoney(sDue)}</span>
                        ) : (
                          <span className="font-medium text-slate-500">Active Stock</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onWhatsApp(d)}
                        className="rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#1ebe5d]"
                        title="Share receipt on WhatsApp"
                      >
                        WhatsApp
                      </button>
                      <button type="button" onClick={() => onPayments(d)} className="btn btn-secondary btn-sm text-xs">
                        Payments
                      </button>
                      <button type="button" onClick={() => onReceipt(d)} className="btn btn-secondary btn-sm text-xs">
                        Receipt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}