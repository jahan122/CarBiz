import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppUser, DealWithTotals, TransferStatus } from './types';
import { buyerBalanceDue, carTitle, matchesQuery, regOf, sellerBalanceDue } from './utils';
import HomeView from './components/HomeView';
import KpiCards from './components/KpiCards';
import DealsTable from './components/DealsTable';
import DealDrawer from './components/DealDrawer';
import WhatsAppShareModal from './components/WhatsAppShareModal';
import DealFormModal from './components/DealFormModal';
import ExpenseModal from './components/ExpenseModal';
import PaymentsModal from './components/PaymentsModal';
import ReceiptModal from './components/ReceiptModal';
import SoldModal from './components/SoldModal';
import ConfirmDialog from './components/ConfirmDialog';
import ReportsView from './components/ReportsView';
import RecycleBinModal from './components/RecycleBinModal';
import BackupRestoreModal from './components/BackupRestoreModal';
import { PinLockScreen, PinSettingsModal } from './components/PinLock';

type Tab = 'ALL' | 'ACTIVE' | 'SOLD';
type Section = 'HOME' | 'DEALS' | 'REPORTS';
type TransferFilter = 'ALL' | TransferStatus;
type BalanceFilter = 'ALL' | 'DUE_TO_SELLER' | 'DUE_FROM_BUYER' | 'SETTLED';

type ModalState =
  | { type: 'create'; startSold?: boolean }
  | { type: 'edit'; deal: DealWithTotals }
  | { type: 'expenses'; deal: DealWithTotals }
  | { type: 'payments'; deal: DealWithTotals }
  | { type: 'receipt'; deal: DealWithTotals }
  | { type: 'whatsapp'; deal: DealWithTotals; mode?: 'RECEIPT' | 'SPECS' }
  | { type: 'sold'; deal: DealWithTotals }
  | { type: 'delete'; deal: DealWithTotals }
  | { type: 'recycleBin' }
  | { type: 'backupRestore' }
  | { type: 'pinSettings' }
  | null;

interface Toast {
  text: string;
  action?: { label: string; onClick: () => void };
}

export default function App() {
  const [deals, setDeals] = useState<DealWithTotals[]>([]);
  const [deletedCount, setDeletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('HOME');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Ledger Filters
  const [tab, setTab] = useState<Tab>('ALL');
  const [query, setQuery] = useState('');
  const [transferFilter, setTransferFilter] = useState<TransferFilter>('ALL');
  const [makeFilter, setMakeFilter] = useState<string>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('ALL');
  const [addedFrom, setAddedFrom] = useState('');
  const [addedTo, setAddedTo] = useState('');

  const [inspectedDeal, setInspectedDeal] = useState<DealWithTotals | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Multi-User & PIN Lock State
  const [hasUsers, setHasUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [locked, setLocked] = useState(false);
  const [securityReady, setSecurityReady] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isOwner = !currentUser || currentUser.role === 'OWNER';
  const canViewProfit = isOwner || currentUser.can_view_profit;
  const canDelete = isOwner || currentUser.can_delete;

  const notify = useCallback((text: string, action?: Toast['action']) => {
    setToast({ text, action });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = useCallback(async () => {
    if (!window.api) return;
    const [activeList, deletedList] = await Promise.all([window.api.listDeals(), window.api.listDeletedDeals()]);
    setDeals(activeList);
    setDeletedCount(deletedList.length);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.api) {
        if (alive) {
          setSecurityReady(true);
          setLoading(false);
        }
        return;
      }
      try {
        const usersExist = await window.api.hasUsers();
        if (!alive) return;
        setHasUsers(usersExist);
        setLocked(usersExist);
        setSecurityReady(true);
        await reload();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    if (modal || locked) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setModal({ type: 'create' });
      } else if (hasUsers && e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLocked(true);
      } else if (section === 'DEALS' && ((e.ctrlKey && e.key.toLowerCase() === 'f') || (!inField && e.key === '/'))) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, locked, section, hasUsers]);

  const counts = useMemo(
    () => ({
      ALL: deals.length,
      ACTIVE: deals.filter((d) => d.status === 'ACTIVE').length,
      SOLD: deals.filter((d) => d.status === 'SOLD').length,
    }),
    [deals],
  );

  const uniqueMakes = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      if (d.make && d.make.trim()) set.add(d.make.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const hasExtraFilters =
    query !== '' ||
    tab !== 'ALL' ||
    transferFilter !== 'ALL' ||
    makeFilter !== 'ALL' ||
    balanceFilter !== 'ALL' ||
    addedFrom !== '' ||
    addedTo !== '';

  function resetAllFilters() {
    setQuery('');
    setTab('ALL');
    setTransferFilter('ALL');
    setMakeFilter('ALL');
    setBalanceFilter('ALL');
    setAddedFrom('');
    setAddedTo('');
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (tab !== 'ALL' && d.status !== tab) return false;
      if (transferFilter !== 'ALL' && (d.transfer_status ?? 'PENDING') !== transferFilter) return false;
      if (makeFilter !== 'ALL' && (d.make ?? '').trim() !== makeFilter) return false;

      if (balanceFilter !== 'ALL') {
        const sDue = sellerBalanceDue(d) ?? 0;
        const bDue = buyerBalanceDue(d) ?? 0;
        if (balanceFilter === 'DUE_TO_SELLER' && sDue <= 0) return false;
        if (balanceFilter === 'DUE_FROM_BUYER' && bDue <= 0) return false;
        if (balanceFilter === 'SETTLED' && (sDue > 0 || bDue > 0)) return false;
      }

      const entryDate = (d.created_at ?? '').slice(0, 10);
      if (addedFrom && entryDate && entryDate < addedFrom) return false;
      if (addedTo && entryDate && entryDate > addedTo) return false;

      if (q) {
        const agentMatch = (d.transfer_agent_name ?? '').toLowerCase().includes(q);
        if (!matchesQuery(d, query) && !agentMatch) return false;
      }

      return true;
    });
  }, [deals, tab, query, transferFilter, makeFilter, balanceFilter, addedFrom, addedTo]);

  const liveDeal = (d: DealWithTotals): DealWithTotals => deals.find((x) => x.id === d.id) ?? d;

  async function runExport(kind: 'db' | 'csv') {
    if (!window.api) return;
    try {
      const res = await window.api.backupOrExport(kind);
      if (res.saved && res.path) {
        const p = res.path;
        notify(`Saved ${kind === 'db' ? 'database backup' : 'CSV spreadsheet'}`, {
          label: 'Open folder',
          onClick: () => void window.api?.showInFolder(p),
        });
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    }
  }

  async function softDeleteDeal(d: DealWithTotals) {
    if (!window.api) return;
    await window.api.softDeleteDeal(d.id);
    setModal(null);
    if (inspectedDeal?.id === d.id) setInspectedDeal(null);
    await reload();
    notify(`Moved ${carTitle(d)} (${regOf(d)}) to Recycle Bin`, {
      label: 'Undo',
      onClick: () => {
        void window.api?.restoreDeal(d.id).then(() => {
          void reload();
          notify(`Restored ${carTitle(d)} (${regOf(d)})`);
        });
      },
    });
  }

  if (!securityReady) {
    return <div className="flex h-full items-center justify-center bg-[#F8FAFC] text-sm text-slate-500">Loading…</div>;
  }

  if (locked) {
    return (
      <PinLockScreen
        onUnlocked={(user) => {
          setCurrentUser(user);
          setLocked(false);
          if (!user.can_view_profit && user.role !== 'OWNER' && section === 'REPORTS') {
            setSection('HOME');
          }
          notify(`Signed in as ${user.name} (${user.role})`);
        }}
      />
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'SOLD', label: 'Sold' },
  ];

  const sectionMeta: Record<Section, { title: string; subtitle: string }> = {
    HOME: {
      title: 'Command Center',
      subtitle: 'Quick vehicle lookup, follow-up queues & recent transactions',
    },
    DEALS: {
      title: 'Inventory & Deals Ledger',
      subtitle: 'Complete vehicle stock, installment balances, file transfers & profit',
    },
    REPORTS: {
      title: 'Reports & Profit Analytics',
      subtitle: 'Monthly P&L breakdown, expense categories & dealership margins',
    },
  };

  return (
    <div className="flex h-full bg-[#F8FAFC] text-slate-900">
      {/* Collapsible Left Navigation Sidebar */}
      <aside
        className={`flex shrink-0 flex-col justify-between border-r border-slate-200 bg-white transition-all duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h10l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
                  <circle cx="7" cy="17" r="2.5" />
                  <circle cx="17" cy="17" r="2.5" />
                </svg>
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="truncate text-sm font-bold text-slate-900">Car Deals</div>
                  <div className="truncate text-[11px] text-slate-500">Showroom Manager</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
              </svg>
            </button>
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1 p-3">
            <button
              type="button"
              onClick={() => setSection('HOME')}
              title="Home (Command Center)"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                section === 'HOME'
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              {!sidebarCollapsed && <span className="truncate">Home</span>}
            </button>

            <button
              type="button"
              onClick={() => setSection('DEALS')}
              title="Inventory & Deals Ledger"
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                section === 'DEALS'
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Inventory &amp; Deals</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-slate-700">
                  {counts.ACTIVE}/{counts.ALL}
                </span>
              )}
            </button>

            {canViewProfit && (
              <button
                type="button"
                onClick={() => setSection('REPORTS')}
                title="Reports & Profit"
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  section === 'REPORTS'
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <line x1="18" x2="18" y1="20" y2="10" />
                  <line x1="12" x2="12" y1="20" y2="4" />
                  <line x1="6" x2="6" y1="20" y2="14" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Reports &amp; Profit</span>}
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Utility Dock & Active User Card */}
        <div className="space-y-1 border-t border-slate-200 p-3">
          {currentUser && !sidebarCollapsed && (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-900">{currentUser.name}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {currentUser.role}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocked(true)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                title="Switch User / Lock (Ctrl+L)"
              >
                Switch
              </button>
            </div>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => setModal({ type: 'recycleBin' })}
              title="Recycle Bin"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                {!sidebarCollapsed && <span className="truncate">Recycle Bin</span>}
              </div>
              {deletedCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-red-700">
                  {deletedCount}
                </span>
              )}
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => setModal({ type: 'backupRestore' })}
              title="Backup & Restore"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5V19A9 3 0 0 0 21 19V5" />
                <path d="M3 12A9 3 0 0 0 21 12" />
              </svg>
              {!sidebarCollapsed && <span className="truncate">Backup &amp; Restore</span>}
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => setModal({ type: 'pinSettings' })}
              title="Users & PIN Access"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {!sidebarCollapsed && <span className="truncate">Users &amp; PINs</span>}
            </button>
          )}

          {hasUsers && (
            <button
              type="button"
              onClick={() => setLocked(true)}
              title="Lock App Immediately (Ctrl+L)"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {!sidebarCollapsed && <span className="truncate">Lock App</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">{sectionMeta[section].title}</h1>
            <p className="text-xs text-slate-500">{sectionMeta[section].subtitle}</p>
          </div>

          <div className="flex items-center gap-2.5">
            <button type="button" className="btn btn-secondary" onClick={() => setModal({ type: 'create', startSold: true })}>
              + Log Sold Car
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
              + Log New Car
            </button>
          </div>
        </header>

        <main
          className={`flex min-h-0 flex-1 flex-col gap-4 px-6 py-5 ${
            section === 'DEALS' ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">Loading showroom data…</div>
          ) : section === 'HOME' ? (
            <HomeView
              deals={deals}
              onInspect={(deal) => setInspectedDeal(deal)}
              onWhatsApp={(deal) => setModal({ type: 'whatsapp', deal, mode: 'RECEIPT' })}
              onPayments={(deal) => setModal({ type: 'payments', deal })}
              onReceipt={(deal) => setModal({ type: 'receipt', deal })}
              onCreateNew={(startSold) => setModal({ type: 'create', startSold })}
              onNavigateLedger={(initialTab) => {
                if (initialTab) setTab(initialTab);
                setSection('DEALS');
              }}
            />
          ) : section === 'REPORTS' && canViewProfit ? (
            <ReportsView deals={deals} />
          ) : (
            <>
              {canViewProfit && <KpiCards deals={deals} />}

              {/* Filter & Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {tabs.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          tab === t.key ? 'bg-brand-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-white'
                        }`}
                      >
                        {t.label}
                        <span
                          className={`rounded-full px-1.5 py-px font-mono text-[11px] tabular-nums ${
                            tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {counts[t.key]}
                        </span>
                      </button>
                    ))}
                  </div>

                  <select
                    aria-label="Filter by file transfer status"
                    className="input h-8 w-40 py-1 text-xs"
                    value={transferFilter}
                    onChange={(e) => setTransferFilter(e.target.value as TransferFilter)}
                  >
                    <option value="ALL">File: All Statuses</option>
                    <option value="PENDING">File: Pending (w/ Us)</option>
                    <option value="WITH_AGENT">File: With Agent</option>
                    <option value="COMPLETED">File: Transfer Done</option>
                  </select>

                  <select
                    aria-label="Filter by car make"
                    className="input h-8 w-36 py-1 text-xs"
                    value={makeFilter}
                    onChange={(e) => setMakeFilter(e.target.value)}
                  >
                    <option value="ALL">Make: All</option>
                    {uniqueMakes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by payment balance"
                    className="input h-8 w-40 py-1 text-xs"
                    value={balanceFilter}
                    onChange={(e) => setBalanceFilter(e.target.value as BalanceFilter)}
                  >
                    <option value="ALL">Balance: All</option>
                    <option value="DUE_TO_SELLER">Due to Seller</option>
                    <option value="DUE_FROM_BUYER">Due from Buyer</option>
                    <option value="SETTLED">Fully Settled</option>
                  </select>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-medium">Added:</span>
                    <input
                      type="date"
                      aria-label="Entry added from date"
                      className="input h-8 w-32 py-1 text-xs"
                      value={addedFrom}
                      onChange={(e) => setAddedFrom(e.target.value)}
                    />
                    <span>–</span>
                    <input
                      type="date"
                      aria-label="Entry added to date"
                      className="input h-8 w-32 py-1 text-xs"
                      value={addedTo}
                      onChange={(e) => setAddedTo(e.target.value)}
                    />
                  </div>

                  {hasExtraFilters && (
                    <button type="button" onClick={resetAllFilters} className="btn btn-secondary btn-sm text-xs">
                      Reset ({visible.length}/{deals.length})
                    </button>
                  )}
                </div>

                <div className="relative w-72">
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                    placeholder="Search reg #, car, seller, buyer, agent… (/)"
                    className="input h-8 bg-white pr-7 text-xs"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                {visible.length === 0 ? (
                  <div className="flex h-72 flex-col items-center justify-center px-6 text-center">
                    <div className="text-base font-semibold text-slate-900">
                      {deals.length === 0 ? 'No car deals recorded yet' : 'No cars match this filter'}
                    </div>
                    <p className="mt-1 max-w-md text-sm text-slate-500">
                      {deals.length === 0
                        ? 'Click "+ Log New Car" to record a purchase, or "+ Log Sold Car" if you already sold one.'
                        : 'Try clearing the search box or resetting your active filters.'}
                    </p>
                    <div className="mt-4 flex gap-2">
                      {deals.length === 0 ? (
                        <>
                          <button type="button" className="btn btn-secondary" onClick={() => setModal({ type: 'create', startSold: true })}>
                            + Log Sold Car
                          </button>
                          <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
                            + Log New Car
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-secondary" onClick={resetAllFilters}>
                          Reset filters
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <DealsTable
                    deals={visible}
                    onInspect={(deal) => setInspectedDeal(deal)}
                    onWhatsApp={(deal) => setModal({ type: 'whatsapp', deal, mode: 'RECEIPT' })}
                    onExpense={(deal) => setModal({ type: 'expenses', deal })}
                    onPayments={(deal) => setModal({ type: 'payments', deal })}
                    onReceipt={(deal) => setModal({ type: 'receipt', deal })}
                    onSold={(deal) => setModal({ type: 'sold', deal })}
                    onEdit={(deal) => setModal({ type: 'edit', deal })}
                    onDelete={(deal) => {
                      if (!canDelete) {
                        notify('Only Owner or authorized users can delete deals');
                        return;
                      }
                      setModal({ type: 'delete', deal });
                    }}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Slide-Over Inspection Drawer */}
      {inspectedDeal && (
        <DealDrawer
          deal={liveDeal(inspectedDeal)}
          currentUser={currentUser}
          onClose={() => setInspectedDeal(null)}
          onWhatsApp={(deal, mode) => setModal({ type: 'whatsapp', deal, mode })}
          onExpense={(deal) => setModal({ type: 'expenses', deal })}
          onPayments={(deal) => setModal({ type: 'payments', deal })}
          onReceipt={(deal) => setModal({ type: 'receipt', deal })}
          onSold={(deal) => setModal({ type: 'sold', deal })}
          onEdit={(deal) => setModal({ type: 'edit', deal })}
          onDealChanged={() => void reload()}
          onNotify={(msg) => notify(msg)}
        />
      )}

      {/* WhatsApp Recipient & Receipt Picker Modal */}
      {modal?.type === 'whatsapp' && (
        <WhatsAppShareModal
          deal={liveDeal(modal.deal)}
          initialMode={modal.mode}
          onClose={() => setModal(null)}
          onSent={(msg) => {
            setModal(null);
            notify(msg);
          }}
        />
      )}

      {modal?.type === 'create' && (
        <DealFormModal
          mode="create"
          startSold={modal.startSold}
          deals={deals}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            void reload();
            notify(msg);
          }}
        />
      )}
      {modal?.type === 'edit' && (
        <DealFormModal
          mode="edit"
          deal={liveDeal(modal.deal)}
          deals={deals}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            void reload();
            notify(msg);
          }}
        />
      )}
      {modal?.type === 'expenses' && (
        <ExpenseModal deal={liveDeal(modal.deal)} onClose={() => setModal(null)} onChanged={() => void reload()} />
      )}
      {modal?.type === 'payments' && (
        <PaymentsModal deal={liveDeal(modal.deal)} onClose={() => setModal(null)} onChanged={() => void reload()} />
      )}
      {modal?.type === 'receipt' && (
        <ReceiptModal
          deal={liveDeal(modal.deal)}
          onClose={() => setModal(null)}
          onSavedPdf={(filePath) => {
            setModal(null);
            notify('Receipt saved as PDF', {
              label: 'Open folder',
              onClick: () => void window.api?.showInFolder(filePath),
            });
          }}
        />
      )}
      {modal?.type === 'sold' && (
        <SoldModal
          deal={liveDeal(modal.deal)}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            void reload();
            notify(msg);
          }}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="Move car to Recycle Bin?"
          confirmLabel="Move to Recycle Bin"
          onCancel={() => setModal(null)}
          onConfirm={() => void softDeleteDeal(modal.deal)}
          message={
            <>
              <p>
                <strong>{carTitle(modal.deal)}</strong> ({regOf(modal.deal)}) will be moved to the Recycle Bin.
              </p>
              <p className="mt-2 text-slate-500">You can restore it anytime from the Recycle Bin.</p>
            </>
          }
        />
      )}
      {modal?.type === 'recycleBin' && (
        <RecycleBinModal
          onClose={() => setModal(null)}
          onChanged={(msg) => {
            void reload();
            notify(msg);
          }}
        />
      )}
      {modal?.type === 'backupRestore' && (
        <BackupRestoreModal
          onClose={() => setModal(null)}
          onManualBackup={(kind) => void runExport(kind)}
          onRestored={(msg) => {
            setModal(null);
            void reload();
            notify(msg);
          }}
        />
      )}
      {modal?.type === 'pinSettings' && (
        <PinSettingsModal
          currentUser={currentUser}
          onClose={() => setModal(null)}
          onUsersChanged={(updatedList, msg) => {
            setHasUsers(updatedList.length > 0);
            if (updatedList.length === 0) {
              setCurrentUser(null);
            } else if (currentUser) {
              const refreshed = updatedList.find((u) => u.id === currentUser.id) ?? null;
              setCurrentUser(refreshed);
            }
            notify(msg);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
        >
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" onClick={toast.action.onClick} className="font-semibold text-blue-300 underline hover:text-blue-200">
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}