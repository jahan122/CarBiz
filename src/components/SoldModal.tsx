import { useState } from 'react';
import Modal, { Field } from './Modal';
import type { DealWithTotals } from '../types';
import MoneyInput from './MoneyInput';
import { carTitle, fmtMoney, formatCnic, formatPhone, moneyToInput, parseNum, regOf, textOrNull, todayISO, totalCost } from '../utils';

interface Props {
  deal: DealWithTotals;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function SoldModal({ deal, onClose, onSaved }: Props) {
  const editing = deal.status === 'SOLD';
  const [salePrice, setSalePrice] = useState(moneyToInput(deal.sale_price));
  const [saleDate, setSaleDate] = useState(editing ? deal.sale_date ?? '' : todayISO());
  const [name, setName] = useState(deal.purchaser_name ?? '');
  const [fatherName, setFatherName] = useState(deal.purchaser_father_name ?? '');
  const [contact, setContact] = useState(deal.purchaser_contact ?? '');
  const [cnic, setCnic] = useState(deal.purchaser_cnic ?? '');
  const [address, setAddress] = useState(deal.purchaser_address ?? '');
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const cost = totalCost(deal);
  const price = parseNum(salePrice);
  const costKnown = deal.purchase_price !== null;
  const profit = price !== null && costKnown ? price - cost : null;

  async function submit() {
    if (!window.api) return;
    setBusy(true);
    setServerError('');
    try {
      const updated = await window.api.markSold(deal.id, {
        sale_price: price,
        sale_date: textOrNull(saleDate),
        purchaser_name: textOrNull(name),
        purchaser_father_name: textOrNull(fatherName),
        purchaser_contact: textOrNull(contact),
        purchaser_cnic: textOrNull(cnic),
        purchaser_address: textOrNull(address),
      });
      const p = updated.sale_price !== null && updated.purchase_price !== null ? updated.sale_price - totalCost(updated) : null;
      onSaved(`${carTitle(updated)} sold${p === null ? '' : ` — net ${p >= 0 ? 'profit' : 'loss'} ${fmtMoney(Math.abs(p))}`}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function revert() {
    if (!window.api) return;
    setBusy(true);
    try {
      await window.api.revertSale(deal.id);
      onSaved(`${carTitle(deal)} moved back to Active`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit Sale' : 'Mark Car as Sold'}
      subtitle={`${carTitle(deal)} · ${regOf(deal)}`}
      onClose={onClose}
      onSubmit={() => void submit()}
      width="max-w-xl"
      footer={
        <>
          {editing && (
            <button type="button" className="btn btn-secondary mr-auto text-red-600 hover:bg-red-50" onClick={() => void revert()} disabled={busy}>
              Revert to Unsold
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? 'Save Sale' : 'Confirm Sale'}</button>
        </>
      }
    >
      {serverError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>}

      <div className="mb-5 grid grid-cols-4 gap-3 rounded-md border border-ink-200 bg-ink-50 p-3 text-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Purchase</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{fmtMoney(deal.purchase_price)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Expenses</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{fmtMoney(deal.total_expenses)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Transfer Cost</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{fmtMoney(deal.transfer_cost ?? 0)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Total Cost</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">{costKnown ? fmtMoney(cost) : '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Sale Price (Rs)">
          <MoneyInput value={salePrice} onChange={setSalePrice} placeholder="3,900,000" data-autofocus />
        </Field>
        <Field label="Sale Date">
          <input type="date" className="input" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        </Field>
        <Field label="Purchaser Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Purchaser S/O (Father's Name)">
          <input className="input" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Printed on receipt S/O line" />
        </Field>
        <Field label="Purchaser Contact">
          <input className="input" inputMode="tel" value={contact} onChange={(e) => setContact(formatPhone(e.target.value))} placeholder="03xx-xxxxxxx" />
        </Field>
        <Field label="Purchaser CNIC">
          <input className="input" inputMode="numeric" value={cnic} onChange={(e) => setCnic(formatCnic(e.target.value))} placeholder="xxxxx-xxxxxxx-x" />
        </Field>
        <Field label="Purchaser Address (R/O)" className="col-span-2">
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street / area / city (printed on Sale Receipt)" />
        </Field>
      </div>

      <div
        className={`mt-5 flex items-center justify-between rounded-md border px-4 py-3 ${
          profit === null ? 'border-ink-200 bg-ink-50' : profit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
        }`}
      >
        <span className="text-sm font-medium text-ink-700">
          {!costKnown ? 'No purchase price recorded, so profit cannot be calculated' : `Net ${profit !== null && profit < 0 ? 'loss' : 'profit'} on this deal`}
        </span>
        <span className={`text-lg font-bold tabular-nums ${profit === null ? 'text-ink-300' : profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {profit === null ? '—' : `${profit < 0 ? '−' : '+'} ${fmtMoney(Math.abs(profit))}`}
        </span>
      </div>
    </Modal>
  );
}