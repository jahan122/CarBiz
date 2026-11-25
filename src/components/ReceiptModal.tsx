import { useEffect, useMemo, useState } from 'react';
import Modal, { Field } from './Modal';
import type { BusinessProfile, DealWithTotals, Payment } from '../types';
import { DEFAULT_BUSINESS_PROFILE } from '../types';
import { buildReceiptHtml, type ReceiptKind } from '../receiptBuilder';
import { carTitle, formatCnic, formatPhone, normalizeReg, regOf } from '../utils';

interface Props {
  deal: DealWithTotals;
  initialKind?: ReceiptKind;
  onClose: () => void;
  onSavedPdf: (path: string) => void;
}

export default function ReceiptModal({ deal, initialKind, onClose, onSavedPdf }: Props) {
  const [kind, setKind] = useState<ReceiptKind>(initialKind ?? (deal.status === 'SOLD' ? 'sale' : 'buying'));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [editingOurDetails, setEditingOurDetails] = useState(false);
  const [vehicleType, setVehicleType] = useState<'Motor Cycle' | 'Scooter' | 'Car' | 'Bus'>('Car');
  const [paymentModeOverride, setPaymentModeOverride] = useState('');
  const [includeTikliNote, setIncludeTikliNote] = useState(true);
  const [extraTerms, setExtraTerms] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.api) return;
    void Promise.all([window.api.listPayments(deal.id), window.api.getBusinessProfile()]).then(([p, prof]) => {
      setPayments(p);
      setProfile({ ...DEFAULT_BUSINESS_PROFILE, ...prof });
    });
  }, [deal.id]);

  const html = useMemo(
    () =>
      buildReceiptHtml({
        kind,
        deal,
        payments,
        profile,
        paymentModeOverride,
        vehicleType,
        includeTikliNote,
        extraTerms,
      }),
    [kind, deal, payments, profile, paymentModeOverride, vehicleType, includeTikliNote, extraTerms],
  );

  async function saveOurDetails() {
    if (!window.api) return;
    const saved = await window.api.setBusinessProfile(profile);
    setProfile({ ...DEFAULT_BUSINESS_PROFILE, ...saved });
    setProfileSavedMsg('Saved! These details will auto-fill future receipts.');
    setTimeout(() => setProfileSavedMsg(''), 3000);
    setEditingOurDetails(false);
  }

  async function exportPdf() {
    if (!window.api) return;
    setSaving(true);
    setError('');
    try {
      const regSlug = normalizeReg(deal.registration_number) || `car-${deal.id}`;
      const filename =
        kind === 'buying' ? `Purchase-Receipt-Delivery-${regSlug}.pdf` : `Sale-Receipt-Delivery-${regSlug}.pdf`;
      const res = await window.api.saveReceiptPdf(html, filename);
      if (res.saved && res.path) {
        onSavedPdf(res.path);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const missingFields: string[] = [];
  if (!deal.horse_power) missingFields.push('Horse Power');
  if (kind === 'sale') {
    if (!deal.purchaser_father_name) missingFields.push('Purchaser S/O');
    if (!deal.purchaser_address) missingFields.push('Purchaser R/O Address');
    if (!deal.purchaser_cnic) missingFields.push('Purchaser CNIC');
  } else {
    if (!deal.seller_father_name) missingFields.push('Seller S/O');
    if (!deal.seller_address) missingFields.push('Seller R/O Address');
    if (!deal.seller_cnic) missingFields.push('Seller CNIC');
  }

  return (
    <Modal
      title="Sale Receipt & Delivery Letter"
      subtitle={`${carTitle(deal)} · ${regOf(deal)}`}
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary mr-auto"
            onClick={() => setEditingOurDetails((v) => !v)}
          >
            {editingOurDetails
              ? 'Hide Our Details'
              : `Edit Our Details (${profile.owner_name || 'Sultan Ansari'})`}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void exportPdf()}>
            {saving
              ? 'Generating PDF…'
              : `Save ${kind === 'buying' ? 'Purchase Receipt' : 'Sale Receipt'} as PDF`}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {profileSavedMsg && (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {profileSavedMsg}
        </div>
      )}

      {/* Role Toggle: We are Purchaser vs We are Seller */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-600">Our Role on Receipt:</span>
          <div className="inline-flex overflow-hidden rounded-md border border-ink-300 bg-white">
            <button
              type="button"
              onClick={() => setKind('buying')}
              className={`px-3.5 py-1.5 text-xs font-semibold transition ${
                kind === 'buying' ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-50'
              }`}
            >
              We are PURCHASER (Buying Car)
            </button>
            <button
              type="button"
              onClick={() => setKind('sale')}
              className={`border-l border-ink-300 px-3.5 py-1.5 text-xs font-semibold transition ${
                kind === 'sale' ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-50'
              }`}
            >
              We are SELLER (Selling Car)
            </button>
          </div>
        </div>

        <div className="text-xs text-ink-600">
          Active Identity: <strong>{profile.owner_name}</strong> (S/O {profile.father_name})
        </div>
      </div>

      {missingFields.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>Missing fields on this deal:</strong> {missingFields.join(', ')}. Edit the{' '}
          {kind === 'sale' ? 'Sale / Car' : 'Car'} details if you want them pre-filled on the printed lines.
        </div>
      )}

      {/* Editable Details for Sultan Ansari (Both as Purchaser & Seller) */}
      {editingOurDetails && (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Our Details (Used as Purchaser when Buying &amp; as Seller when Selling)
              </span>
              <p className="text-[11px] text-ink-500">
                Edit any field below and click Save to update your default details permanently.
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveOurDetails()}>
              Save Our Details
            </button>
          </div>

          <div className="grid grid-cols-6 gap-3">
            <Field label="Full Name" className="col-span-2">
              <input
                className="input"
                value={profile.owner_name}
                onChange={(e) => setProfile((p) => ({ ...p, owner_name: e.target.value }))}
                placeholder="Sultan Ansari"
              />
            </Field>
            <Field label="S/O (Father's Name)" className="col-span-2">
              <input
                className="input"
                value={profile.father_name}
                onChange={(e) => setProfile((p) => ({ ...p, father_name: e.target.value }))}
                placeholder="Masood Hussain Ansari"
              />
            </Field>
            <Field label="Mobile Number" className="col-span-2">
              <input
                className="input"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                placeholder="0333-3048451"
              />
            </Field>
            <Field label="CNIC Number" className="col-span-2">
              <input
                className="input"
                value={profile.cnic}
                onChange={(e) => setProfile((p) => ({ ...p, cnic: formatCnic(e.target.value) }))}
                placeholder="42101-6548938-7"
              />
            </Field>
            <Field label="Residential / Office Address (R/O)" className="col-span-4">
              <input
                className="input"
                value={profile.address}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                placeholder="H.No C-39, Block 16, Gulistan-e-Jauhar, Karachi"
              />
            </Field>
            <Field label="Optional Showroom Banner Title (leave blank for plain form)" className="col-span-3">
              <input
                className="input"
                value={profile.business_name}
                onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))}
                placeholder="Optional top header"
              />
            </Field>
            <Field label="Optional Banner Tagline" className="col-span-3">
              <input
                className="input"
                value={profile.tagline}
                onChange={(e) => setProfile((p) => ({ ...p, tagline: e.target.value }))}
                placeholder="Optional subtitle"
              />
            </Field>
          </div>
        </div>
      )}

      {/* Receipt Options */}
      <div className="mb-4 grid grid-cols-6 gap-3 rounded-lg border border-ink-200 bg-white p-3">
        <Field label="Vehicle Type" className="col-span-2">
          <select
            className="input"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as typeof vehicleType)}
          >
            <option value="Car">Car</option>
            <option value="Motor Cycle">Motor Cycle</option>
            <option value="Scooter">Scooter</option>
            <option value="Bus">Bus</option>
          </select>
        </Field>
        <Field label="Cash / Cheque No. (leave blank to auto-fill from Payments)" className="col-span-4">
          <input
            className="input"
            value={paymentModeOverride}
            onChange={(e) => setPaymentModeOverride(e.target.value)}
            placeholder="e.g. Cash / Cheque No. 458912 (Meezan Bank)"
          />
        </Field>
        <Field label="Optional Remarks at Bottom" className="col-span-4">
          <input
            className="input"
            value={extraTerms}
            onChange={(e) => setExtraTerms(e.target.value)}
            placeholder="Optional extra note"
          />
        </Field>
        <div className="col-span-2 flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-600"
              checked={includeTikliNote}
              onChange={(e) => setIncludeTikliNote(e.target.checked)}
            />
            Include &ldquo;Original file, tikli &amp; plates received&rdquo; note
          </label>
        </div>
      </div>

      {/* Live A4 Preview */}
      <div className="overflow-hidden rounded-lg border border-ink-300 bg-ink-100 p-3">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <span>A4 Print Preview — Sale Receipt &amp; Delivery Letter</span>
          <span>13-Digit CNIC Boxes · S/O &amp; R/O Fields · Liability Clause</span>
        </div>
        <iframe
          title="Receipt preview"
          srcDoc={html}
          className="h-[520px] w-full rounded border border-ink-200 bg-white shadow-sm"
        />
      </div>
    </Modal>
  );
}