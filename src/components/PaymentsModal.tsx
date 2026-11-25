import { useCallback, useEffect, useState } from 'react';
import Modal, { Field } from './Modal';
import MoneyInput from './MoneyInput';
import { PAYMENT_METHODS, PAYMENT_TYPES } from '../types';
import type { DealWithTotals, Payment, PaymentDirection, PaymentMethod, PaymentType } from '../types';
import { carTitle, fmtDate, fmtMoney, moneyToInput, parseNum, regOf, todayISO } from '../utils';

interface Props {
  deal: DealWithTotals;
  initialTab?: PaymentDirection;
  onClose: () => void;
  onChanged: () => void;
}

export default function PaymentsModal({ deal, initialTab, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<PaymentDirection>(
    initialTab ?? (deal.status === 'SOLD' ? 'IN_FROM_BUYER' : 'OUT_TO_SELLER'),
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>('Advance');
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.api) return;
    setPayments(await window.api.listPayments(deal.id));
  }, [deal.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setPaymentType('Installment');
    setMethod('Cash');
    setAmount('');
    setDate(todayISO());
    setNotes('');
  }

  function startEdit(p: Payment) {
    setTab(p.direction);
    setEditingId(p.id);
    setPaymentType(p.payment_type);
    setMethod(p.method);
    setAmount(moneyToInput(p.amount));
    setDate(p.date);
    setNotes(p.notes);
    setConfirmDeleteId(null);
  }

  async function submit() {
    if (!window.api) return;
    const n = parseNum(amount);
    if (!n || n <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }
    setError('');
    try {
      const input = {
        direction: tab,
        payment_type: paymentType,
        method,
        amount: n,
        date,
        notes,
      };
      if (editingId !== null) await window.api.updatePayment(editingId, input);
      else await window.api.addPayment(deal.id, input);
      resetForm();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(id: number) {
    if (!window.api) return;
    try {
      await window.api.deletePayment(id);
      setConfirmDeleteId(null);
      if (editingId === id) resetForm();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const sellerPayments = payments.filter((p) => p.direction === 'OUT_TO_SELLER');
  const buyerPayments = payments.filter((p) => p.direction === 'IN_FROM_BUYER');
  const activeList = tab === 'OUT_TO_SELLER' ? sellerPayments : buyerPayments;

  const totalPaidSeller = sellerPayments.reduce((s, p) => s + p.amount, 0);
  const sellerDue = deal.purchase_price !== null ? Math.max(0, deal.purchase_price - totalPaidSeller) : null;

  const totalReceivedBuyer = buyerPayments.reduce((s, p) => s + p.amount, 0);
  const buyerDue = deal.sale_price !== null ? Math.max(0, deal.sale_price - totalReceivedBuyer) : null;

  const agreedPrice = tab === 'OUT_TO_SELLER' ? deal.purchase_price : deal.sale_price;
  const paidSoFar = tab === 'OUT_TO_SELLER' ? totalPaidSeller : totalReceivedBuyer;
  const dueNow = tab === 'OUT_TO_SELLER' ? sellerDue : buyerDue;

  return (
    <Modal
      title="Payments & Installments Ledger"
      subtitle={`${carTitle(deal)} · ${regOf(deal)}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Done
        </button>
      }
    >
      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Direction Switcher */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setTab('OUT_TO_SELLER');
            resetForm();
          }}
          className={`rounded-lg border p-3.5 text-left transition ${
            tab === 'OUT_TO_SELLER'
              ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20'
              : 'border-ink-200 bg-white hover:bg-ink-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Paid to Seller</span>
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">
              {sellerPayments.length} {sellerPayments.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-ink-900">{fmtMoney(totalPaidSeller)}</div>
          <div className="mt-0.5 text-xs text-ink-500">
            {sellerDue === null
              ? 'Purchase price not set'
              : sellerDue === 0
              ? '✓ Fully paid to seller'
              : `Balance due: ${fmtMoney(sellerDue)}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('IN_FROM_BUYER');
            resetForm();
          }}
          className={`rounded-lg border p-3.5 text-left transition ${
            tab === 'IN_FROM_BUYER'
              ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20'
              : 'border-ink-200 bg-white hover:bg-ink-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Received from Buyer</span>
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-700">
              {buyerPayments.length} {buyerPayments.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-ink-900">{fmtMoney(totalReceivedBuyer)}</div>
          <div className="mt-0.5 text-xs text-ink-500">
            {deal.sale_price === null
              ? deal.status === 'SOLD'
                ? 'Sale price not set'
                : 'Car not marked sold yet'
              : buyerDue === 0
              ? '✓ Fully received from buyer'
              : `Balance due: ${fmtMoney(buyerDue)}`}
          </div>
        </button>
      </div>

      {/* Balance Bar */}
      <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3 text-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {tab === 'OUT_TO_SELLER' ? 'Purchase Price' : 'Sale Price'}
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-ink-900">{fmtMoney(agreedPrice)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {tab === 'OUT_TO_SELLER' ? 'Total Paid' : 'Total Received'}
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700">{fmtMoney(paidSoFar)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Remaining Balance Due</div>
          <div
            className={`mt-0.5 text-sm font-bold tabular-nums ${
              dueNow === null ? 'text-ink-500' : dueNow > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {dueNow === null ? '—' : fmtMoney(dueNow)}
          </div>
        </div>
      </div>

      {/* Add / Edit Payment Form */}
      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
        className="rounded-lg border border-ink-200 bg-ink-50 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
            {editingId !== null
              ? 'Edit Payment Entry'
              : tab === 'OUT_TO_SELLER'
              ? 'Record Payment Paid to Seller'
              : 'Record Payment Received from Buyer'}
          </span>
          {dueNow !== null && dueNow > 0 && editingId === null && (
            <button
              type="button"
              className="text-xs font-semibold text-brand-600 hover:underline"
              onClick={() => {
                setAmount(moneyToInput(dueNow));
                setPaymentType('Final Balance');
              }}
            >
              Fill remaining balance ({fmtMoney(dueNow)})
            </button>
          )}
        </div>

        <div className="grid grid-cols-6 gap-x-3 gap-y-3">
          <Field label="Payment Type" className="col-span-2">
            <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)} data-autofocus>
              {PAYMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Method" className="col-span-2">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Date" className="col-span-2">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <Field label="Amount (Rs)" className="col-span-2">
            <MoneyInput value={amount} onChange={setAmount} placeholder="500,000" />
          </Field>
          <Field label="Notes / Cheque # / Bank Ref" className="col-span-3">
            <input
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bayana cash / HBL online ref #4912"
            />
          </Field>
          <div className="col-span-1 flex items-start pt-5">
            <button type="submit" className="btn btn-primary w-full">
              {editingId !== null ? 'Save' : '+ Add'}
            </button>
          </div>
        </div>
        {editingId !== null && (
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetForm}>
              Cancel Edit
            </button>
          </div>
        )}
      </form>

      {/* Ledger Table */}
      <div className="mt-5 overflow-hidden rounded-lg border border-ink-200">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Method</th>
              <th className="px-3 py-2 font-semibold">Notes</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="w-32 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {activeList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-500">
                  No payments recorded on this side yet.
                </td>
              </tr>
            )}
            {activeList.map((p) => (
              <tr key={p.id} className={editingId === p.id ? 'bg-brand-50' : ''}>
                <td className="whitespace-nowrap px-3 py-2 text-ink-700">{fmtDate(p.date)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.payment_type}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-700">{p.method}</td>
                <td className="px-3 py-2 text-ink-700">{p.notes || <span className="text-ink-300">—</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink-900">{fmtMoney(p.amount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {confirmDeleteId === p.id ? (
                    <span className="inline-flex gap-1">
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(p.id)}>
                        Yes
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-1">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(p.id)}
                      >
                        Del
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
