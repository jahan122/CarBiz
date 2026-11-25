import { useEffect, useState } from 'react';
import Modal from './Modal';
import WebcamCaptureModal from './WebcamCaptureModal';
import {
  ATTACHMENT_CATEGORY_LABELS,
  type AttachmentCategory,
  type DealAttachment,
  type DealWithTotals,
  type NewDealInput,
  type SaleInput,
} from '../types';

interface Props {
  mode: 'create' | 'edit';
  startSold?: boolean;
  deal?: DealWithTotals;
  deals?: DealWithTotals[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DealFormModal({ mode, startSold = false, deal, onClose, onSaved }: Props) {
  const isEdit = mode === 'edit' && Boolean(deal);

  // Vehicle fields
  const [make, setMake] = useState(deal?.make || '');
  const [model, setModel] = useState(deal?.model || '');
  const [variant, setVariant] = useState(deal?.variant || '');
  const [year, setYear] = useState(deal?.year ? String(deal.year) : '');
  const [color, setColor] = useState(deal?.color || '');
  const [horsePower, setHorsePower] = useState(deal?.horse_power || '');
  const [regNumber, setRegNumber] = useState(deal?.registration_number || '');
  const [chassisNumber, setChassisNumber] = useState(deal?.chassis_number || '');
  const [engineNumber, setEngineNumber] = useState(deal?.engine_number || '');
  const [mileage, setMileage] = useState(deal?.mileage ? String(deal.mileage) : '');

  // Purchase & Seller fields
  const [boughtFrom, setBoughtFrom] = useState(deal?.bought_from_location || '');
  const [purchaseDate, setPurchaseDate] = useState(deal?.purchase_date || todayIso());
  const [purchasePrice, setPurchasePrice] = useState(
    deal?.purchase_price !== null && deal?.purchase_price !== undefined ? String(deal.purchase_price) : '',
  );
  const [sellerName, setSellerName] = useState(deal?.seller_name || '');
  const [sellerFatherName, setSellerFatherName] = useState(deal?.seller_father_name || '');
  const [sellerContact, setSellerContact] = useState(deal?.seller_contact || '');
  const [sellerCnic, setSellerCnic] = useState(deal?.seller_cnic || '');
  const [sellerAddress, setSellerAddress] = useState(deal?.seller_address || '');
  const [notes, setNotes] = useState(deal?.notes || '');

  // Optional Immediate Sale fields (only when creating a new already-sold deal)
  const [alreadySold, setAlreadySold] = useState(!isEdit && startSold);
  const [saleDate, setSaleDate] = useState(todayIso());
  const [salePrice, setSalePrice] = useState('');
  const [purchaserName, setPurchaserName] = useState('');
  const [purchaserFatherName, setPurchaserFatherName] = useState('');
  const [purchaserContact, setPurchaserContact] = useState('');
  const [purchaserCnic, setPurchaserCnic] = useState('');
  const [purchaserAddress, setPurchaserAddress] = useState('');

  // Attachments & Webcam (works on existing deal or auto-saves new deal draft first)
  const [activeDealId, setActiveDealId] = useState<number | null>(deal?.id ?? null);
  const [attachments, setAttachments] = useState<DealAttachment[]>([]);
  const [docCategory, setDocCategory] = useState<AttachmentCategory>('CNIC_FRONT');
  const [docLabel, setDocLabel] = useState('');
  const [webcamOpen, setWebcamOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeDealId || !window.api) return;
    void window.api.listAttachments(activeDealId).then(setAttachments);
  }, [activeDealId]);

  function buildPayload(): { input: NewDealInput; sale: SaleInput | null } {
    const input: NewDealInput = {
      make,
      model,
      variant,
      year: year || null,
      color,
      horse_power: horsePower,
      registration_number: regNumber,
      chassis_number: chassisNumber,
      engine_number: engineNumber,
      mileage: mileage || null,
      bought_from_location: boughtFrom,
      purchase_date: purchaseDate || null,
      purchase_price: purchasePrice || null,
      seller_name: sellerName,
      seller_father_name: sellerFatherName,
      seller_contact: sellerContact,
      seller_cnic: sellerCnic,
      seller_address: sellerAddress,
      notes,
    };

    const sale: SaleInput | null =
      !isEdit && alreadySold
        ? {
            sale_date: saleDate || null,
            sale_price: salePrice || null,
            purchaser_name: purchaserName,
            purchaser_father_name: purchaserFatherName,
            purchaser_contact: purchaserContact,
            purchaser_cnic: purchaserCnic,
            purchaser_address: purchaserAddress,
          }
        : null;

    return { input, sale };
  }

  async function ensureDealSaved(): Promise<number | null> {
    if (!window.api) return null;
    if (activeDealId) return activeDealId;
    const { input, sale } = buildPayload();
    const created = await window.api.createDeal(input, sale);
    setActiveDealId(created.id);
    return created.id;
  }

  async function handleAttachFile() {
    if (!window.api) return;
    setError('');
    try {
      const targetId = await ensureDealSaved();
      if (!targetId) return;
      const labelText = docLabel.trim() || ATTACHMENT_CATEGORY_LABELS[docCategory];
      const added = await window.api.pickAndSaveAttachment(targetId, docCategory, labelText);
      if (added) {
        setDocLabel('');
        const list = await window.api.listAttachments(targetId);
        setAttachments(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenWebcam() {
    setError('');
    try {
      const targetId = await ensureDealSaved();
      if (!targetId) return;
      setWebcamOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteAttachment(attId: number) {
    if (!window.api || !activeDealId) return;
    await window.api.deleteAttachment(attId);
    const list = await window.api.listAttachments(activeDealId);
    setAttachments(list);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!window.api || saving) return;
    setSaving(true);
    setError('');
    try {
      const { input, sale } = buildPayload();
      let saved: DealWithTotals;
      if (activeDealId) {
        saved = await window.api.updateDeal(activeDealId, input);
        if (!isEdit && alreadySold && sale) {
          saved = await window.api.markSold(activeDealId, sale);
        }
      } else {
        saved = await window.api.createDeal(input, sale);
      }
      const carLabel = [saved.year, saved.make, saved.model].filter(Boolean).join(' ') || `Car #${saved.id}`;
      onSaved(isEdit ? `Updated ${carLabel}` : `Added ${carLabel}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        title={isEdit ? 'Edit Car Deal' : 'Add New Car Deal'}
        subtitle="Enter vehicle specifications, seller details, and attach CNIC / registration documents"
        onClose={onClose}
        width="max-w-3xl"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="deal-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit || activeDealId ? 'Save Changes' : 'Save Car Deal'}
            </button>
          </>
        }
      >
        <form id="deal-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* 1. Vehicle Details */}
          <div>
            <h3 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Vehicle Details
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Make</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Toyota, Honda, Suzuki"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Model</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Corolla, Civic, Alto"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Variant / Grade</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. GLi 1.3, VXR, Oriel"
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Model Year</label>
                <input
                  type="number"
                  className="input text-xs"
                  placeholder="e.g. 2021"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Color</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. White, Silver, Black"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Engine Capacity (CC)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. 1300 CC"
                  value={horsePower}
                  onChange={(e) => setHorsePower(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Registration #</label>
                <input
                  type="text"
                  className="input font-mono text-xs uppercase"
                  placeholder="e.g. BXK-482"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Chassis #</label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder="Chassis number"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Engine #</label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder="Engine number"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Mileage (km)</label>
                <input
                  type="number"
                  className="input text-xs"
                  placeholder="e.g. 54000"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Bought From (City/Showroom)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="e.g. Karachi, Lahore"
                  value={boughtFrom}
                  onChange={(e) => setBoughtFrom(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. Purchase & Seller Information */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              2. Purchase & Seller Information
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Purchase Date</label>
                <input
                  type="date"
                  className="input text-xs"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Purchase Price (PKR)</label>
                <input
                  type="number"
                  className="input text-xs"
                  placeholder="e.g. 3450000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Seller Full Name</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Seller name"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Seller S/O (Father Name)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Father's name"
                  value={sellerFatherName}
                  onChange={(e) => setSellerFatherName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Seller Contact #</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="03XX-XXXXXXX"
                  value={sellerContact}
                  onChange={(e) => setSellerContact(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Seller CNIC #</label>
                <input
                  type="text"
                  className="input font-mono text-xs"
                  placeholder="42101-XXXXXXX-X"
                  value={sellerCnic}
                  onChange={(e) => setSellerCnic(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Seller Address</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="Complete residential address"
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-slate-700">Deal Notes</label>
                <textarea
                  rows={2}
                  className="input text-xs"
                  placeholder="Condition notes, token details, key count, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 3. Attach Documents & Webcam Capture */}
          <div className="border-t border-slate-200 pt-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                3. Attach Documents & Photos ({attachments.length})
              </h3>
              {!activeDealId && (
                <span className="text-[11px] text-slate-400">
                  Attaching or capturing will automatically create the deal draft first
                </span>
              )}
            </div>

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
                placeholder="Label (optional, e.g. Seller CNIC Front)"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs"
                onClick={() => void handleAttachFile()}
              >
                📁 Upload File / PDF
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm text-xs"
                onClick={() => void handleOpenWebcam()}
              >
                📸 Capture via Webcam
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <span className="truncate font-semibold text-slate-700">
                      {att.label} <span className="font-normal text-slate-400">({att.file_name})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAttachment(att.id)}
                      className="ml-2 text-slate-400 hover:text-red-600"
                      title="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Optional Immediate Sale Section (for new entries) */}
          {!isEdit && (
            <div className="border-t border-slate-200 pt-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={alreadySold}
                  onChange={(e) => setAlreadySold(e.target.checked)}
                />
                This car is already sold (enter purchaser details now)
              </label>

              {alreadySold && (
                <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Sale Date</label>
                    <input
                      type="date"
                      className="input text-xs"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Sale Price (PKR)</label>
                    <input
                      type="number"
                      className="input text-xs"
                      placeholder="e.g. 3650000"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Purchaser Name</label>
                    <input
                      type="text"
                      className="input text-xs"
                      value={purchaserName}
                      onChange={(e) => setPurchaserName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Purchaser S/O</label>
                    <input
                      type="text"
                      className="input text-xs"
                      value={purchaserFatherName}
                      onChange={(e) => setPurchaserFatherName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Purchaser Contact</label>
                    <input
                      type="text"
                      className="input text-xs"
                      value={purchaserContact}
                      onChange={(e) => setPurchaserContact(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Purchaser CNIC</label>
                    <input
                      type="text"
                      className="input font-mono text-xs"
                      value={purchaserCnic}
                      onChange={(e) => setPurchaserCnic(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Purchaser Address</label>
                    <input
                      type="text"
                      className="input text-xs"
                      value={purchaserAddress}
                      onChange={(e) => setPurchaserAddress(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Webcam Capture Modal rendered outside DealFormModal backdrop */}
      {webcamOpen && activeDealId && (
        <WebcamCaptureModal
          dealId={activeDealId}
          defaultCategory={docCategory}
          defaultLabel={docLabel}
          onClose={() => setWebcamOpen(false)}
          onSaved={async () => {
            setWebcamOpen(false);
            setDocLabel('');
            if (window.api && activeDealId) {
              const list = await window.api.listAttachments(activeDealId);
              setAttachments(list);
            }
          }}
        />
      )}
    </>
  );
}