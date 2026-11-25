import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import type { BackupFileInfo } from '../types';

interface Props {
  onClose: () => void;
  onRestored: (message: string) => void;
  onManualBackup: (kind: 'db' | 'csv') => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function BackupRestoreModal({ onClose, onRestored, onManualBackup }: Props) {
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [folderPath, setFolderPath] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<{ path?: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!window.api) return;
    const [list, dir] = await Promise.all([window.api.listAutoBackups(), window.api.autoBackupFolder()]);
    setBackups(list);
    setFolderPath(dir);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function doRestore(chosenPath?: string) {
    if (!window.api) return;
    setBusy(true);
    setError('');
    try {
      const res = await window.api.restoreFromBackup(chosenPath);
      setConfirmTarget(null);
      if (res.restored) {
        onRestored(`Restored ${res.count ?? 0} car records from ${res.sourceName ?? 'backup'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirmTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title="Backups & Restore"
        subtitle="Automatic dated backups are saved in your Documents folder every time you close the app (last 10 kept)."
        onClose={onClose}
        width="max-w-3xl"
        footer={
          <>
            {folderPath && (
              <button
                type="button"
                className="btn btn-secondary mr-auto"
                onClick={() => void window.api?.showInFolder(folderPath)}
              >
                Open Backup Folder
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mb-5 grid grid-cols-3 gap-3">
          <button
            type="button"
            className="rounded-lg border border-ink-200 bg-ink-50 p-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50/40"
            onClick={() => onManualBackup('db')}
          >
            <div className="text-sm font-semibold text-ink-900">Save Backup Now (.db)</div>
            <div className="mt-0.5 text-xs text-ink-500">Save a full database copy anywhere</div>
          </button>

          <button
            type="button"
            className="rounded-lg border border-ink-200 bg-ink-50 p-3.5 text-left transition hover:border-brand-400 hover:bg-brand-50/40"
            onClick={() => onManualBackup('csv')}
          >
            <div className="text-sm font-semibold text-ink-900">Export to Excel (.csv)</div>
            <div className="mt-0.5 text-xs text-ink-500">Spreadsheet with costs, payments &amp; profit</div>
          </button>

          <button
            type="button"
            className="rounded-lg border border-brand-200 bg-brand-50 p-3.5 text-left transition hover:bg-brand-100/70"
            onClick={() => setConfirmTarget({ label: 'a chosen backup file' })}
          >
            <div className="text-sm font-semibold text-brand-700">Restore from Backup…</div>
            <div className="mt-0.5 text-xs text-brand-600">Pick any .db backup file to restore</div>
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Recent Automatic Backups ({backups.length}/10)
          </h3>
          {folderPath && <span className="truncate font-mono text-[11px] text-ink-400">{folderPath}</span>}
        </div>

        <div className="overflow-hidden rounded-lg border border-ink-200">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3.5 py-2 font-semibold">Backup File</th>
                <th className="px-3.5 py-2 font-semibold">Created</th>
                <th className="px-3.5 py-2 text-right font-semibold">Size</th>
                <th className="px-3.5 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3.5 py-8 text-center text-ink-500">
                    No automatic backups yet — one will be created automatically when you close the app.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.path} className="hover:bg-ink-50/70">
                    <td className="px-3.5 py-2.5 font-mono text-xs font-medium text-ink-900">{b.name}</td>
                    <td className="px-3.5 py-2.5 text-xs text-ink-600">{new Date(b.mtime).toLocaleString()}</td>
                    <td className="px-3.5 py-2.5 text-right text-xs tabular-nums text-ink-500">{fmtSize(b.size)}</td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm text-brand-700 hover:bg-brand-50"
                        onClick={() => setConfirmTarget({ path: b.path, label: b.name })}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {confirmTarget && (
        <ConfirmDialog
          title="Restore database from backup?"
          tone="primary"
          confirmLabel="Restore Now"
          busy={busy}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => void doRestore(confirmTarget.path)}
          message={
            <>
              <p>
                Your current records will be replaced with <strong>{confirmTarget.label}</strong>.
              </p>
              <p className="mt-2 text-ink-500">
                A safety snapshot of your current database will be saved automatically first just in case.
              </p>
            </>
          }
        />
      )}
    </>
  );
}
