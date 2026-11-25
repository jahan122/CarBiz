import { useCallback, useEffect, useState } from 'react';
import Modal, { Field } from './Modal';
import { EXPENSE_CATEGORIES } from '../types';
import type { DealWithTotals, Expense, ExpenseCategory } from '../types';
import MoneyInput from './MoneyInput';
import { carTitle, fmtDate, fmtMoney, moneyToInput, parseNum, regOf, todayISO } from '../utils';

interface Props {
  deal: DealWithTotals;
  onClose: () => void;
  /** Called after any add/edit/delete so the parent can refresh totals. */
  onChanged: () => void;
}

export default function ExpenseModal({ deal, onClose, onChanged }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>('Mechanic/Repair');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.api) return;
    setExpenses(await window.api.listExpenses(deal.id));
  }, [deal.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setDate(todayISO());
  }

  function startEdit(x: Expense) {
    setEditingId(x.id);
    setCategory(x.category);
    setDescription(x.description);
    setAmount(moneyToInput(x.amount));
    setDate(x.date);
    setConfirmDeleteId(null);
  }

  async function submit() {
    if (!window.api) return;
    const n = parseNum(amount);
    setError('');
    try {
      const input = { category, description, amount: n ?? 0, date };
      if (editingId !== null) await window.api.updateExpense(editingId, input);
      else await window.api.addExpense(deal.id, input);
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
      await window.api.deleteExpense(id);
      setConfirmDeleteId(null);
      if (editingId === id) resetForm();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const total = expenses.reduce((s, x) => s + x.amount, 0);

  return (
    <Modal
      title="Expenses"
      subtitle={`${carTitle(deal)} · ${regOf(deal)}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>}
    >
      {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
        className="rounded-md border border-ink-200 bg-ink-50 p-4"
      >
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-600">{editingId !== null ? 'Edit expense' : 'Log new expense'}</div>
        <div className="grid grid-cols-6 gap-x-3 gap-y-3">
          <Field label="Category" className="col-span-2">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} data-autofocus>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description" className="col-span-4">
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Front bumper repaint" />
          </Field>
          <Field label="Amount (Rs)" className="col-span-2">
            <MoneyInput value={amount} onChange={setAmount} placeholder="15,000" />
          </Field>
          <Field label="Date" className="col-span-2">
            <input type="date" className={`input `} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="col-span-2 flex items-end gap-2">
            <button type="submit" className="btn btn-primary flex-1">{editingId !== null ? 'Save' : '+ Add Expense'}</button>
            {editingId !== null && <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      </form>

      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">Itemized expenses ({expenses.length})</h3>
        <div className="text-sm text-ink-500">
          Total: <span className="font-semibold tabular-nums text-ink-900">{fmtMoney(total)}</span>
          <span className="mx-2 text-ink-300">|</span>
          Total cost: <span className="font-semibold tabular-nums text-ink-900">{fmtMoney((deal.purchase_price ?? 0) + total)}</span>
        </div>
      </div>

      <div className="mt-2 overflow-hidden rounded-md border border-ink-200">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
              <th className="w-36 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {expenses.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-500">No expenses logged for this car yet.</td></tr>
            )}
            {expenses.map((x) => (
              <tr key={x.id} className={editingId === x.id ? 'bg-brand-50' : ''}>
                <td className="whitespace-nowrap px-3 py-2 text-ink-700">{fmtDate(x.date)}</td>
                <td className="whitespace-nowrap px-3 py-2"><span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs font-medium text-ink-700">{x.category}</span></td>
                <td className="px-3 py-2 text-ink-700">{x.description || <span className="text-ink-300">—</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{fmtMoney(x.amount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {confirmDeleteId === x.id ? (
                    <span className="inline-flex gap-1">
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(x.id)}>Confirm</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-1">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(x)}>Edit</button>
                      <button type="button" className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50" onClick={() => setConfirmDeleteId(x.id)}>Delete</button>
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
