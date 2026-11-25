import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import type { DealWithTotals } from '../types';
import { carTitle, fmtDate, fmtMoney, regOf, totalCost } from '../utils';

interface Props {
  onClose: () => void;
  onChanged: (message: string) => void;
}

export default function RecycleBinModal({ onClose, onChanged }: Props) {
  const [deleted, setDeleted] = useState<DealWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [permDeleteTarget, setPermDeleteTarget] = useState<DealWithTotals | null>(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      setDeleted(await window.api.listDeletedDeals());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(d: DealWithTotals) {
    if (!window.api) return;
    setBusy(true);
    try {
      await window.api.restoreDeal(d.id);
      await load();
      onChanged(`Restored ${carTitle(d)} (${regOf(d)})`);
    } finally {
      setBusy(false);
    }
  }

  async function permanentDelete(d: DealWithTotals) {
    if (!window.api) return;
    setBusy(true);
    try {
      await window.api.deleteDeal(d.id);
      setPermDeleteTarget(null);
      await load();
      onChanged(`Permanently deleted ${carTitle(d)} (${regOf(d)})`);
    } finally {
      setBusy(false);
    }
  }

  async function emptyAll() {
    if (!window.api) return;
    setBusy(true);
    try {
      await window.api.emptyRecycleBin();
      setConfirmEmptyAll(false);
      await load();
      onChanged('Recycle Bin emptied');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title="Recycle Bin"
        subtitle="Deleted cars stay here until you restore them or delete them permanently."
        onClose={onClose}
        width="max-w-4xl"
        footer={
          <>
            {deleted.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary mr-auto text-red-600 hover:bg-red-50"
                onClick={() => setConfirmEmptyAll(true)}
                disabled={busy}
              >
                Empty Recycle Bin
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-ink-500">Loading deleted records…</div>
        ) : deleted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50 py-14 text-center">
            <div className="text-base font-semibold text-ink-800">Recycle Bin is empty</div>
            <p className="mt-1 text-sm text-ink-500">Any car you delete from the main list will appear here first so you can undo it.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-ink-200">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Car</th>
                  <th className="px-3.5 py-2.5 font-semibold">Status</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Total Cost</th>
                  <th className="px-3.5 py-2.5 font-semibold">Deleted On</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {deleted.map((d) => (
                  <tr key={d.id} className="hover:bg-ink-50/70">
                    <td className="px-3.5 py-3">
                      <div className="font-semibold text-ink-900">{carTitle(d)}</div>
                      <div className="mt-0.5 font-mono text-xs text-ink-500">{regOf(d)}</div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          d.status === 'SOLD' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {d.status === 'SOLD' ? 'Sold' : 'Active'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-semibold tabular-nums text-ink-800">{fmtMoney(totalCost(d))}</td>
                    <td className="px-3.5 py-3 text-xs text-ink-500">
                      {d.deleted_at ? fmtDate(d.deleted_at.slice(0, 10)) : '—'}
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => void restore(d)}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                          disabled={busy}
                          onClick={() => setPermDeleteTarget(d)}
                        >
                          Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {permDeleteTarget && (
        <ConfirmDialog
          title="Delete permanently?"
          confirmLabel="Delete Forever"
          busy={busy}
          onCancel={() => setPermDeleteTarget(null)}
          onConfirm={() => void permanentDelete(permDeleteTarget)}
          message={
            <p>
              <strong>{carTitle(permDeleteTarget)}</strong> ({regOf(permDeleteTarget)}) and all of its expenses and payment records will be permanently erased. This cannot be undone.
            </p>
          }
        />
      )}

      {confirmEmptyAll && (
        <ConfirmDialog
          title="Empty Recycle Bin?"
          confirmLabel="Empty All Permanently"
          busy={busy}
          onCancel={() => setConfirmEmptyAll(false)}
          onConfirm={() => void emptyAll()}
          message={
            <p>
              All <strong>{deleted.length}</strong> car{deleted.length === 1 ? '' : 's'} in the Recycle Bin will be permanently erased. This cannot be undone.
            </p>
          }
        />
      )}
    </>
  );
}
