import { useEffect, useState } from 'react';
import Modal, { Field } from './Modal';
import type { DealWithTotals, Payment } from '../types';
import { carTitle, formatPhone, regOf } from '../utils';
import { buildWhatsAppMessageByType, shareToWhatsApp, type WhatsAppTemplateType } from '../utils/whatsapp';

interface Props {
  deal: DealWithTotals;
  initialMode?: 'RECEIPT' | 'SPECS';
  onClose: () => void;
  onSent: (msg: string) => void;
}

type RecipientRole = 'BUYER' | 'SELLER' | 'AGENT' | 'OTHER';

export default function WhatsAppShareModal({ deal, initialMode = 'RECEIPT', onClose, onSent }: Props) {
  const sold = deal.status === 'SOLD';

  const defaultRole: RecipientRole = initialMode === 'SPECS' ? 'OTHER' : sold ? 'BUYER' : 'SELLER';
  const defaultTemplate: WhatsAppTemplateType =
    initialMode === 'SPECS' ? 'SPECS' : sold ? 'BUYER_RECEIPT' : 'SELLER_RECEIPT';

  const [role, setRole] = useState<RecipientRole>(defaultRole);
  const [template, setTemplate] = useState<WhatsAppTemplateType>(defaultTemplate);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [phone, setPhone] = useState<string>(() => {
    if (defaultRole === 'BUYER') return formatPhone(deal.purchaser_contact ?? '');
    if (defaultRole === 'SELLER') return formatPhone(deal.seller_contact ?? '');
    return '';
  });
  const [message, setMessage] = useState('');
  const [customEdited, setCustomEdited] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.api) return;
      const list = await window.api.listPayments(deal.id);
      if (alive) setPayments(list);
    })();
    return () => {
      alive = false;
    };
  }, [deal.id]);

  useEffect(() => {
    if (customEdited) return;
    setMessage(buildWhatsAppMessageByType(template, deal, payments));
  }, [deal, payments, template, customEdited]);

  function selectRole(nextRole: RecipientRole) {
    setRole(nextRole);
    setCustomEdited(false);

    if (nextRole === 'BUYER') {
      setTemplate('BUYER_RECEIPT');
      setPhone(formatPhone(deal.purchaser_contact ?? ''));
    } else if (nextRole === 'SELLER') {
      setTemplate('SELLER_RECEIPT');
      setPhone(formatPhone(deal.seller_contact ?? ''));
    } else if (nextRole === 'AGENT') {
      setTemplate('AGENT_INFO');
      setPhone(formatPhone(deal.transfer_agent_contact ?? ''));
    } else {
      setTemplate('SPECS');
      setPhone('');
    }
  }

  function selectTemplate(nextTemplate: WhatsAppTemplateType) {
    setCustomEdited(false);
    setTemplate(nextTemplate);
  }

  async function handleSend() {
    await shareToWhatsApp(message, phone);
    const cleanPhone = phone.trim();
    onSent(cleanPhone ? `Opened WhatsApp for ${cleanPhone} & copied message` : 'Opened WhatsApp & copied message to clipboard');
  }

  async function handleCopyOnly() {
    try {
      await navigator.clipboard.writeText(message);
      onSent('Copied WhatsApp message to clipboard');
    } catch {
      onSent('Could not access clipboard');
    }
  }

  const roleCards: {
    id: RecipientRole;
    title: string;
    name: string;
    contact: string;
    badge: string;
    disabled?: boolean;
  }[] = [
    {
      id: 'BUYER',
      title: 'To Buyer',
      name: deal.purchaser_name || (sold ? 'Buyer (No name)' : 'Not sold yet'),
      contact: deal.purchaser_contact || 'No number saved',
      badge: 'Sale Receipt Only',
      disabled: !sold && !deal.purchaser_name && !deal.purchaser_contact,
    },
    {
      id: 'SELLER',
      title: 'To Seller',
      name: deal.seller_name || 'Seller (No name)',
      contact: deal.seller_contact || 'No number saved',
      badge: 'Purchase Receipt Only',
    },
    {
      id: 'AGENT',
      title: 'To Excise Agent',
      name: deal.transfer_agent_name || 'Transfer Agent',
      contact: deal.transfer_agent_contact || 'No number saved',
      badge: 'File & CNICs (No Prices)',
    },
    {
      id: 'OTHER',
      title: 'Other / Prospective Buyer',
      name: 'Pick contact in WhatsApp',
      contact: 'Type number below or leave blank',
      badge: 'Specs Only (No Prices)',
    },
  ];

  const templateOptions: { id: WhatsAppTemplateType; label: string }[] = [
    { id: 'BUYER_RECEIPT', label: 'Buyer Sale Receipt' },
    { id: 'SELLER_RECEIPT', label: 'Seller Purchase Receipt' },
    { id: 'AGENT_INFO', label: 'Agent Transfer Info' },
    { id: 'SPECS', label: 'Car Specs Only' },
  ];

  return (
    <Modal
      title="Share on WhatsApp"
      subtitle={`${carTitle(deal)} · ${regOf(deal)}`}
      onClose={onClose}
      onSubmit={() => void handleSend()}
      width="max-w-xl"
      footer={
        <>
          <button type="button" className="btn btn-secondary mr-auto" onClick={() => void handleCopyOnly()}>
            Copy Text Only
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn bg-[#25D366] font-bold text-white hover:bg-[#1ebe5d]">
            Open WhatsApp
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Step 1: Who are you sending to? */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            1. Who are you sending this to?
          </div>
          <div className="grid grid-cols-2 gap-2">
            {roleCards.map((c) => {
              const active = role === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={c.disabled}
                  onClick={() => selectRole(c.id)}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    c.disabled
                      ? 'cursor-not-allowed border-ink-100 bg-ink-50/50 opacity-50'
                      : active
                        ? 'border-[#25D366] bg-emerald-50/70 ring-1 ring-[#25D366]'
                        : 'border-ink-200 bg-white hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-ink-900">{c.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {c.badge}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs font-medium text-ink-700">{c.name}</div>
                  <div className="font-mono text-[11px] text-ink-500">{c.contact}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Which details should be included? */}
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            2. Details Included (Auto-isolated for safety)
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-ink-200 bg-ink-50 p-1 sm:grid-cols-4">
            {templateOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => selectTemplate(opt.id)}
                className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                  template === opt.id ? 'bg-white text-brand-700 shadow-xs' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {template === 'BUYER_RECEIPT' && (
            <p className="mt-1 text-[11px] text-emerald-700">
              ✓ Safe for Buyer: Includes sale price &amp; payments received. Purchase price &amp; seller details are hidden.
            </p>
          )}
          {template === 'SELLER_RECEIPT' && (
            <p className="mt-1 text-[11px] text-amber-800">
              ✓ Safe for Seller: Includes purchase price &amp; payments made. Sale price &amp; buyer details are hidden.
            </p>
          )}
          {template === 'AGENT_INFO' && (
            <p className="mt-1 text-[11px] text-indigo-700">
              ✓ Safe for Agent: Includes car numbers &amp; party CNICs only. All purchase/sale prices are hidden.
            </p>
          )}
          {template === 'SPECS' && (
            <p className="mt-1 text-[11px] text-ink-600">
              ✓ Public Specs: Vehicle details only. All party names, CNICs, and prices are hidden.
            </p>
          )}
        </div>

        {/* Step 3: Recipient Number */}
        <Field label="3. Recipient WhatsApp Number (edit or leave blank to pick inside WhatsApp)">
          <div className="relative">
            <input
              type="tel"
              inputMode="tel"
              className="input pr-14 font-mono"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="03xx-xxxxxxx (optional)"
              data-autofocus
            />
            {phone && (
              <button
                type="button"
                onClick={() => setPhone('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-500 hover:text-ink-900"
              >
                Clear
              </button>
            )}
          </div>
        </Field>

        {/* Step 4: Preview & Edit */}
        <Field label="4. Message Preview (verify before opening WhatsApp)">
          <textarea
            rows={8}
            className="input font-mono text-xs leading-relaxed"
            value={message}
            onChange={(e) => {
              setCustomEdited(true);
              setMessage(e.target.value);
            }}
          />
        </Field>
      </div>
    </Modal>
  );
}