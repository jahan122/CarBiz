import { useEffect, useState, type FormEvent } from 'react';
import Modal, { Field } from './Modal';
import type { AppUser, UserRole } from '../types';

interface LockProps {
  onUnlocked: (user: AppUser) => void;
}

export function PinLockScreen({ onUnlocked }: LockProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | 'AUTO'>('AUTO');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!window.api) return;
      const list = await window.api.listUsers();
      setUsers(list);
      if (list.length === 1) setSelectedUserId(list[0].id);
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!window.api || checking) return;
    setChecking(true);
    setError('');
    try {
      const targetId = selectedUserId === 'AUTO' ? undefined : selectedUserId;
      const user = await window.api.authenticatePin(pin, targetId);
      if (user) {
        onUnlocked(user);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-900 px-4">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-white p-7 shadow-2xl"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="mt-4 text-center text-lg font-bold text-slate-900">Car Deals Manager Locked</h1>
        <p className="mt-1 text-center text-xs text-slate-500">Select your account or enter your personal PIN</p>

        {/* User Profile Chips */}
        {users.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {users.map((u) => {
              const active = selectedUserId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(active ? 'AUTO' : u.id);
                    setError('');
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{u.name}</span>
                  <span
                    className={`rounded px-1 text-[9px] uppercase ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {u.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError('');
            }}
            placeholder="••••"
            className="input text-center font-mono text-2xl tracking-[0.5em]"
          />
          {error && <div className="mt-2 text-center text-xs font-medium text-red-600">{error}</div>}
        </div>

        <button type="submit" disabled={pin.length < 4 || checking} className="btn btn-primary mt-5 w-full justify-center py-2.5">
          {checking ? 'Verifying…' : 'Unlock Showroom'}
        </button>
      </form>
    </div>
  );
}

interface SettingsProps {
  currentUser: AppUser | null;
  onClose: () => void;
  onUsersChanged: (users: AppUser[], msg: string) => void;
}

export function PinSettingsModal({ currentUser, onClose, onUsersChanged }: SettingsProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Add / Edit User Form
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('OWNER');
  const [canViewProfit, setCanViewProfit] = useState(false);
  const [canManagePayments, setCanManagePayments] = useState(true);
  const [canMarkSold, setCanMarkSold] = useState(true);
  const [canDelete, setCanDelete] = useState(false);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    if (!window.api) return;
    const list = await window.api.listUsers();
    setUsers(list);
    // Default new user role to OWNER if no users exist yet, else STAFF
    if (list.length === 0) {
      setRole('OWNER');
    } else if (!editingUser) {
      setRole('STAFF');
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function startEdit(u: AppUser) {
    setEditingUser(u);
    setName(u.name);
    setPin('');
    setRole(u.role);
    setCanViewProfit(u.can_view_profit);
    setCanManagePayments(u.can_manage_payments);
    setCanMarkSold(u.can_mark_sold);
    setCanDelete(u.can_delete);
    setError('');
  }

  function resetForm(existingCount = users.length) {
    setEditingUser(null);
    setName('');
    setPin('');
    setRole(existingCount === 0 ? 'OWNER' : 'STAFF');
    setCanViewProfit(false);
    setCanManagePayments(true);
    setCanMarkSold(true);
    setCanDelete(false);
    setError('');
  }

  async function handleSaveUser(e: FormEvent) {
    e.preventDefault();
    if (!window.api) return;
    setError('');
    setSaving(true);
    try {
      if (editingUser) {
        await window.api.updateUser(editingUser.id, {
          name,
          pin: pin.trim() ? pin : undefined,
          role,
          can_view_profit: canViewProfit,
          can_manage_payments: canManagePayments,
          can_mark_sold: canMarkSold,
          can_delete: canDelete,
        });
        const updatedList = await window.api.listUsers();
        setUsers(updatedList);
        resetForm(updatedList.length);
        onUsersChanged(updatedList, `Updated user "${name}"`);
      } else {
        await window.api.createUser({
          name,
          pin,
          role,
          can_view_profit: canViewProfit,
          can_manage_payments: canManagePayments,
          can_mark_sold: canMarkSold,
          can_delete: canDelete,
        });
        const updatedList = await window.api.listUsers();
        setUsers(updatedList);
        resetForm(updatedList.length);
        onUsersChanged(updatedList, `Added ${role === 'OWNER' ? 'Owner' : 'Staff'} user "${name}"`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(u: AppUser) {
    if (!window.api) return;
    setError('');
    try {
      await window.api.deleteUser(u.id);
      const updatedList = await window.api.listUsers();
      setUsers(updatedList);
      if (editingUser?.id === u.id) resetForm(updatedList.length);
      onUsersChanged(updatedList, `Removed user "${u.name}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const isOwnerSession = !currentUser || currentUser.role === 'OWNER';

  return (
    <Modal
      title="Users & Role-Based PIN Access"
      subtitle="Manage Owner & Staff PIN accounts and showroom permissions"
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Existing Users List */}
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Accounts ({users.length})
          </div>
          {users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-xs text-slate-600">
              No PIN accounts configured yet. Add an <strong>Owner</strong> account below to enable PIN lock and staff permissions.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{u.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          u.role === 'OWNER'
                            ? 'bg-brand-100 text-brand-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                      {currentUser?.id === u.id && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {u.role === 'OWNER' ? (
                        <span>Full access to profit, ledger, users &amp; delete</span>
                      ) : (
                        <>
                          <span>{u.can_view_profit ? '✓ View Profit' : '✕ Profit Hidden'}</span>
                          <span>· {u.can_manage_payments ? '✓ Payments' : '✕ No Payments'}</span>
                          <span>· {u.can_mark_sold ? '✓ Mark Sold' : '✕ No Sales'}</span>
                          <span>· {u.can_delete ? '✓ Delete' : '✕ No Delete'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isOwnerSession && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" className="btn btn-secondary btn-sm text-xs" onClick={() => startEdit(u)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm text-xs text-red-600 hover:bg-red-50"
                        onClick={() => void handleDeleteUser(u)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / Edit User Form (Owners only) */}
        {isOwnerSession && (
          <form onSubmit={(e) => void handleSaveUser(e)} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {editingUser ? `Edit User: ${editingUser.name}` : 'Add New User'}
              </h3>
              {editingUser && (
                <button type="button" onClick={() => resetForm()} className="text-xs font-semibold text-brand-600 hover:underline">
                  + Switch to Add New
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="User Name *">
                <input
                  required
                  className="input bg-white"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kamran"
                />
              </Field>

              <Field label={editingUser ? 'New PIN (blank = keep)' : 'PIN (4–8 digits) *'}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required={!editingUser}
                  className="input bg-white font-mono tracking-widest"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                />
              </Field>

              <Field label="Role">
                <select
                  className="input bg-white"
                  value={role}
                  disabled={users.length === 0}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="OWNER">Owner (Full Access)</option>
                  <option value="STAFF">Staff (Custom Permissions)</option>
                </select>
              </Field>
            </div>

            {role === 'STAFF' && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Staff Permissions
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={canViewProfit}
                      onChange={(e) => setCanViewProfit(e.target.checked)}
                    />
                    <span>View Purchase Prices &amp; Net Profit</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={canManagePayments}
                      onChange={(e) => setCanManagePayments(e.target.checked)}
                    />
                    <span>Log Installments &amp; Expenses</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={canMarkSold}
                      onChange={(e) => setCanMarkSold(e.target.checked)}
                    />
                    <span>Mark Cars Sold &amp; Edit Sales</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={canDelete}
                      onChange={(e) => setCanDelete(e.target.checked)}
                    />
                    <span>Delete Deals &amp; Access Recycle Bin</span>
                  </label>
                </div>
              </div>
            )}

            {error && <div className="text-xs font-medium text-red-600">{error}</div>}

            <div className="flex justify-end">
              <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary btn-sm">
                {saving ? 'Saving…' : editingUser ? 'Save User Changes' : '+ Add User Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}