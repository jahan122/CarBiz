import { useEffect, useState } from 'react';
import {
  ATTACHMENT_CATEGORY_LABELS,
  type AppUser,
  type AttachmentCategory,
  type DealAttachment,
  type DealWithTotals,
  type Expense,
  type Payment,
  type TransferStatus,
} from '../types';
import WebcamCaptureModal from './WebcamCaptureModal';

interface Props {
  deal: DealWithTotals;
  currentUser?: AppUser | null;
  onClose: () => void;
  onWhatsApp: (deal: DealWithTotals, mode: 'SPECS' | 'RECEIPT') => void;
  onExpense: (deal: DealWithTotals) => void;
  onPayments: (deal: DealWithTotals) => void;
  onReceipt: (deal: DealWithTotals) => void;
  onSold: (deal: DealWithTotals) => void;
  onEdit: (deal: DealWithTotals) => void;
  onDealChanged: () => void;
  onNotify: (msg: string) => void;
}

const formatPkr = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
};

export default function DealDrawer({
  deal,
  currentUser,
  onClose,
  onWhatsApp,
  onExpense,
  onPayments,
  onReceipt,
  onSold,
  onEdit,
  onDealChanged,
  onNotify,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'expenses' | 'transfer' | 'documents'>('overview');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attachments, setAttachments] = useState<DealAttachment[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});

  // Transfer state
  const [transferStatus, setTransferStatus] = useState<TransferStatus>(deal.transfer_status || 'PENDING');
  const [agentName, setAgentName] = useState(deal.transfer_agent_name || '');
  const [agentContact, setAgentContact] = useState(deal.transfer_agent_contact || '');
  const [handoverDate, setHandoverDate] = useState(deal.file_handover_date || '');
  const [completedDate, setCompletedDate] = useState(deal.transfer_completed_date || '');
  const [transferCost, setTransferCost] = useState(deal.transfer_cost ? String(deal.transfer_cost) : '');
  const [transferNotes, setTransferNotes] = useState(deal.transfer_notes || '');
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Attachments & Webcam
  const [docCategory, setDocCategory] = useState<AttachmentCategory>('CNIC_FRONT');
  const [docLabel, setDocLabel] = useState('');
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [lightboxAtt, setLightboxAtt] = useState<DealAttachment | null>(null);

  const canViewProfit = !currentUser || currentUser.role === 'OWNER' || currentUser.can_view_profit;
  const canManagePayments = !currentUser || currentUser.role === 'OWNER' || currentUser.can_manage_payments;
  const canMarkSold = !currentUser || currentUser.role === 'OWNER' || currentUser.can_mark_sold;

  useEffect(() => {
    setTransferStatus(deal.transfer_status || 'PENDING');
    setAgentName(deal.transfer_agent_name || '');
    setAgentContact(deal.transfer_agent_contact || '');
    setHandoverDate(deal.file_handover_date || '');
    setCompletedDate(deal.transfer_completed_date || '');
    setTransferCost(deal.transfer_cost ? String(deal.transfer_cost) : '');
    setTransferNotes(deal.transfer_notes || '');
  }, [deal]);

  async function loadAllDetails() {
    if (!window.api) return;
    const [expList, payList, attList] = await Promise.all([
      window.api.listExpenses(deal.id),
      window.api.listPayments(deal.id),
      window.api.listAttachments(deal.id),
    ]);
    setExpenses(expList);
    setPayments(payList);
    setAttachments(attList);

    const map: Record<number, string> = {};
    for (const att of attList) {
      if (/\.(png|jpe?g|webp)$/i.test(att.file_name)) {
        const url = await window.api.readAttachmentDataUrl(att.file_path);
        if (url) map[att.id] = url;
      }
    }
    setPreviews(map);
  }

  useEffect(() => {
    void loadAllDetails();
  }, [deal.id, deal.total_expenses, deal.paid_to_seller, deal.received_from_buyer, deal.attachment_count]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (lightboxAtt) {
          setLightboxAtt(null);
        } else if (!webcamOpen) {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxAtt, webcamOpen, onClose]);

  const purchasePrice = deal.purchase_price ?? 0;
  const transferExpense = deal.transfer_cost ?? 0;
  const totalCost = purchasePrice + deal.total_expenses + transferExpense;
  const netProfit =
    deal.status === 'SOLD' && deal.sale_price !== null && deal.purchase_price !== null
      ? deal.sale_price - totalCost
      : null;

  const sellerBalance = deal.purchase_price !== null ? Math.max(0, deal.purchase_price - deal.paid_to_seller) : 0;
  const buyerBalance =
    deal.status === 'SOLD' && deal.sale_price !== null ? Math.max(0, deal.sale_price - deal.received_from_buyer) : 0;

  async function handleSaveTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!window.api) return;
    setSavingTransfer(true);
    try {
      await window.api.updateTransfer(deal.id, {
        transfer_status: transferStatus,
        transfer_agent_name: agentName,
        transfer_agent_contact: agentContact,
        file_handover_date: handoverDate,
        transfer_completed_date: completedDate,
        transfer_cost: transferCost || 0,
        transfer_notes: transferNotes,
      });
      onDealChanged();
      onNotify('Transfer & file handover details saved');
    } finally {
      setSavingTransfer(false);
    }
  }

  async function handlePickAttachment() {
    if (!window.api) return;
    const labelText = docLabel.trim() || ATTACHMENT_CATEGORY_LABELS[docCategory];
    const added = await window.api.pickAndAddAttachment(deal.id, docCategory, labelText);
    if (added) {
      setDocLabel('');
      onDealChanged();
      await loadAllDetails();
      onNotify(`Attached ${added.label}`);
    }
  }

  async function handleDeleteAttachment(id: number) {
    if (!window.api) return;
    await window.api.deleteAttachment(id);
    onDealChanged();
    await loadAllDetails();
    onNotify('Attachment deleted');
  }

  const carTitle = [deal.year, deal.make, deal.model, deal.variant].filter(Boolean).join(' ') || `Car #${deal.id}`;

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-[1px]" onClick={onClose}>
        <aside
          className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">{carTitle}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    deal.status === 'SOLD' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {deal.status === 'SOLD' ? 'Sold' : 'In Stock'}
                </span>
                {deal.registration_number && (
                  <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                    {deal.registration_number}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Purchased: {deal.purchase_date || 'N/A'}
                {deal.bought_from_location ? ` · From ${deal.bought_from_location}` : ''}
                {deal.created_by ? ` · Logged by ${deal.created_by}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              ✕ Close
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-6 py-2.5">
            <button type="button" className="btn btn-secondary btn-sm text-xs" onClick={() => onEdit(deal)}>
              ✎ Edit
            </button>
            <button type="button" className="btn btn-secondary btn-sm text-xs" onClick={() => onReceipt(deal)}>
              🧾 Receipt
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm text-xs text-emerald-700"
              onClick={() => onWhatsApp(deal, deal.status === 'SOLD' ? 'RECEIPT' : 'SPECS')}
            >
              💬 WhatsApp
            </button>
            {deal.status === 'ACTIVE' && canMarkSold && (
              <button type="button" className="btn btn-primary btn-sm ml-auto text-xs" onClick={() => onSold(deal)}>
                ✓ Mark as Sold
              </button>
            )}
          </div>

          {/* Financial Summary Strip */}
          <div className="grid grid-cols-2 gap-2.5 border-b border-slate-200 bg-slate-50 px-6 py-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Purchase Price</div>
              <div className="mt-0.5 text-sm font-extrabold text-slate-900">{formatPkr(deal.purchase_price)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Expenses + Transfer</div>
              <div className="mt-0.5 text-sm font-extrabold text-slate-900">
                {formatPkr(deal.total_expenses + transferExpense)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">
                {deal.status === 'SOLD' ? 'Sale Price' : 'Total Investment'}
              </div>
              <div className="mt-0.5 text-sm font-extrabold text-slate-900">
                {deal.status === 'SOLD' ? formatPkr(deal.sale_price) : formatPkr(totalCost)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Net Profit</div>
              <div
                className={`mt-0.5 text-sm font-extrabold ${
                  !canViewProfit
                    ? 'text-slate-400'
                    : netProfit === null
                      ? 'text-slate-400'
                      : netProfit >= 0
                        ? 'text-emerald-700'
                        : 'text-red-600'
                }`}
              >
                {!canViewProfit ? 'Hidden' : netProfit === null ? 'Pending Sale' : formatPkr(netProfit)}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-6 text-xs font-bold">
            {(
              [
                ['overview', 'Overview'],
                ['payments', `Payments (${payments.length})`],
                ['expenses', `Expenses (${expenses.length})`],
                ['transfer', 'File & Transfer'],
                ['documents', `Docs & Camera (${attachments.length})`],
              ] as const
            ).map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`border-b-2 px-3.5 py-2.5 transition-colors ${
                  activeTab === tabKey
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          {/* Body Content */}
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Vehicle Specifications
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-slate-400">Make / Model:</span>
                      <div className="font-bold text-slate-800">
                        {[deal.make, deal.model, deal.variant].filter(Boolean).join(' ') || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Year / Color:</span>
                      <div className="font-bold text-slate-800">
                        {[deal.year, deal.color].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Engine Capacity:</span>
                      <div className="font-bold text-slate-800">{deal.horse_power || '—'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Registration #:</span>
                      <div className="font-mono font-bold text-slate-800">{deal.registration_number || '—'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Chassis #:</span>
                      <div className="font-mono font-bold text-slate-800">{deal.chassis_number || '—'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Engine #:</span>
                      <div className="font-mono font-bold text-slate-800">{deal.engine_number || '—'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Mileage:</span>
                      <div className="font-bold text-slate-800">
                        {deal.mileage ? `${deal.mileage.toLocaleString()} km` : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Bought From:</span>
                      <div className="font-bold text-slate-800">{deal.bought_from_location || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Seller Party */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Seller Details (Purchased From)
                    </h3>
                    {deal.purchase_price !== null && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          sellerBalance === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sellerBalance === 0 ? 'Seller Paid in Full' : `Due to Seller: ${formatPkr(sellerBalance)}`}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-slate-400">Name:</span>{' '}
                      <span className="font-bold text-slate-800">{deal.seller_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">S/O (Father):</span>{' '}
                      <span className="font-bold text-slate-800">{deal.seller_father_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">CNIC:</span>{' '}
                      <span className="font-mono font-bold text-slate-800">{deal.seller_cnic || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Contact:</span>{' '}
                      <span className="font-bold text-slate-800">{deal.seller_contact || '—'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-400">Address:</span>{' '}
                      <span className="font-semibold text-slate-700">{deal.seller_address || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Purchaser Party (if Sold) */}
                {deal.status === 'SOLD' && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                        Purchaser Details (Sold To on {deal.sale_date || 'N/A'})
                      </h3>
                      {deal.sale_price !== null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            buyerBalance === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {buyerBalance === 0 ? 'Buyer Paid in Full' : `Due from Buyer: ${formatPkr(buyerBalance)}`}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Name:</span>{' '}
                        <span className="font-bold text-slate-900">{deal.purchaser_name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">S/O (Father):</span>{' '}
                        <span className="font-bold text-slate-900">{deal.purchaser_father_name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">CNIC:</span>{' '}
                        <span className="font-mono font-bold text-slate-900">{deal.purchaser_cnic || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Contact:</span>{' '}
                        <span className="font-bold text-slate-900">{deal.purchaser_contact || '—'}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500">Address:</span>{' '}
                        <span className="font-semibold text-slate-800">{deal.purchaser_address || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {deal.notes && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                    <div className="mb-1 font-bold text-slate-700">Deal Notes</div>
                    <p className="whitespace-pre-wrap text-slate-600">{deal.notes}</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="text-slate-500">Paid to Seller</div>
                      <div className="mt-0.5 text-base font-extrabold text-slate-900">{formatPkr(deal.paid_to_seller)}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-amber-700">
                        Remaining Due: {formatPkr(sellerBalance)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="text-slate-500">Received from Buyer</div>
                      <div className="mt-0.5 text-base font-extrabold text-emerald-700">
                        {formatPkr(deal.received_from_buyer)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold text-amber-700">
                        Remaining Due: {deal.status === 'SOLD' ? formatPkr(buyerBalance) : 'Not Sold Yet'}
                      </div>
                    </div>
                  </div>
                </div>

                {canManagePayments && (
                  <div className="flex justify-end">
                    <button type="button" className="btn btn-primary btn-sm text-xs" onClick={() => onPayments(deal)}>
                      + Manage / Record Payments
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {payments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400">
                      No payments recorded for this vehicle yet.
                    </div>
                  ) : (
                    payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                p.direction === 'IN_FROM_BUYER'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {p.direction === 'IN_FROM_BUYER' ? 'IN ← Buyer' : 'OUT → Seller'}
                            </span>
                            <span className="font-bold text-slate-800">{p.payment_type}</span>
                            <span className="text-slate-400">via {p.method}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {p.date} {p.notes ? `· ${p.notes}` : ''}
                            {p.created_by ? ` · By ${p.created_by}` : ''}
                          </div>
                        </div>
                        <span className="font-extrabold text-slate-900">{formatPkr(p.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-600">
                    Total General Expenses: <span className="text-slate-900">{formatPkr(deal.total_expenses)}</span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm text-xs" onClick={() => onExpense(deal)}>
                    + Add / Manage Expenses
                  </button>
                </div>

                <div className="space-y-2">
                  {expenses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400">
                      No expenses logged for this car yet.
                    </div>
                  ) : (
                    expenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {exp.category}
                            {exp.description && exp.description !== exp.category ? ` — ${exp.description}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {exp.date}
                            {exp.created_by ? ` · Logged by ${exp.created_by}` : ''}
                          </div>
                        </div>
                        <span className="font-extrabold text-slate-900">{formatPkr(exp.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'transfer' && (
              <form onSubmit={(e) => void handleSaveTransfer(e)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Excise File Handover & Transfer Tracking
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Transfer Status</label>
                    <select
                      className="input text-xs"
                      value={transferStatus}
                      onChange={(e) => setTransferStatus(e.target.value as TransferStatus)}
                    >
                      <option value="PENDING">Pending Handover</option>
                      <option value="WITH_AGENT">File With Agent / Excise</option>
                      <option value="COMPLETED">Transfer Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Transfer Fee / Cost (PKR)</label>
                    <input
                      type="number"
                      className="input text-xs"
                      value={transferCost}
                      onChange={(e) => setTransferCost(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Agent Name</label>
                    <input
                      type="text"
                      className="input text-xs"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Excise agent or representative"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Agent Contact</label>
                    <input
                      type="text"
                      className="input text-xs"
                      value={agentContact}
                      onChange={(e) => setAgentContact(e.target.value)}
                      placeholder="03XX-XXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">File Handover Date</label>
                    <input
                      type="date"
                      className="input text-xs"
                      value={handoverDate}
                      onChange={(e) => setHandoverDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Transfer Completed Date</label>
                    <input
                      type="date"
                      className="input text-xs"
                      value={completedDate}
                      onChange={(e) => setCompletedDate(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Transfer / Biometric Notes</label>
                    <textarea
                      rows={2}
                      className="input text-xs"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="e.g. Original book, smart card & NADRA biometric slip handed over"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary btn-sm text-xs" disabled={savingTransfer}>
                    {savingTransfer ? 'Saving…' : 'Save Transfer Details'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Attach CNIC, Smart Card, Registration Book or Snap Photo
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <select
                      className="input text-xs"
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as AttachmentCategory)}
                    >
                      {(Object.keys(ATTACHMENT_CATEGORY_LABELS) as AttachmentCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {ATTACHMENT_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="input text-xs"
                      placeholder="Custom label (e.g. Seller CNIC Front)"
                      value={docLabel}
                      onChange={(e) => setDocLabel(e.target.value)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary btn-sm text-xs" onClick={() => void handlePickAttachment()}>
                      📁 Upload File / PDF
                    </button>
                    <button type="button" className="btn btn-primary btn-sm text-xs" onClick={() => setWebcamOpen(true)}>
                      📸 Capture via Webcam
                    </button>
                  </div>
                </div>

                {attachments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400">
                    No documents or photos attached to this vehicle yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {attachments.map((att) => {
                      const imgUrl = previews[att.id];
                      return (
                        <div key={att.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {imgUrl ? (
                            <button
                              type="button"
                              onClick={() => setLightboxAtt(att)}
                              className="block h-36 w-full overflow-hidden bg-slate-900"
                            >
                              <img src={imgUrl} alt={att.label} className="h-full w-full object-cover hover:opacity-90" />
                            </button>
                          ) : (
                            <div className="flex h-36 items-center justify-center bg-slate-100 text-xs font-bold text-slate-500">
                              📄 {att.file_name}
                            </div>
                          )}
                          <div className="flex items-center justify-between px-3 py-2 text-xs">
                            <div className="min-w-0">
                              <div className="truncate font-bold text-slate-800">{att.label}</div>
                              <div className="truncate text-[10px] text-slate-400">{att.file_name}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void window.api?.showInFolder(att.file_path)}
                                className="text-[11px] font-semibold text-brand-700 hover:underline"
                              >
                                Folder
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteAttachment(att.id)}
                                className="text-slate-400 hover:text-red-600"
                                title="Delete attachment"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Webcam Capture Modal rendered outside drawer backdrop */}
      {webcamOpen && (
        <WebcamCaptureModal
          dealId={deal.id}
          defaultCategory={docCategory}
          defaultLabel={docLabel}
          onClose={() => setWebcamOpen(false)}
          onSaved={(saved) => {
            setWebcamOpen(false);
            onDealChanged();
            void loadAllDetails();
            onNotify(`Captured & saved ${saved.label}`);
          }}
        />
      )}

      {/* In-App Image Preview Lightbox */}
      {lightboxAtt && previews[lightboxAtt.id] && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 p-6 backdrop-blur-xs"
          onClick={() => setLightboxAtt(null)}
        >
          <div
            className="flex max-h-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3 text-white">
              <div>
                <div className="text-sm font-bold">{lightboxAtt.label || lightboxAtt.category}</div>
                <div className="text-xs text-slate-400">{lightboxAtt.file_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void window.api?.showInFolder(lightboxAtt.file_path)}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Open File Location
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxAtt(null)}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-white hover:bg-slate-700"
                >
                  Close (Esc)
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-black p-4">
              <img
                src={previews[lightboxAtt.id]}
                alt={lightboxAtt.label}
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}