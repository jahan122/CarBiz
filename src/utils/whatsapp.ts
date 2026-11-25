import type { DealWithTotals, Payment } from '../types';
import { buyerBalanceDue, carTitle, fmtDate, fmtMoney, regOf, sellerBalanceDue } from '../utils';

export type WhatsAppTemplateType = 'BUYER_RECEIPT' | 'SELLER_RECEIPT' | 'AGENT_INFO' | 'SPECS';

/** Converts Pakistani mobile numbers (0300-1234567) to international format (923001234567) for wa.me links. */
export function toWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '92' + digits.slice(1);
  if (digits.startsWith('3') && digits.length === 10) return '92' + digits;
  return digits;
}

function vehicleHeaderLines(deal: DealWithTotals): string[] {
  const title = carTitle(deal) || 'Vehicle';
  const lines = [
    `*Vehicle:* ${title}${deal.variant ? ` ${deal.variant}` : ''}`,
    `*Reg #:* ${regOf(deal)}`,
  ];
  if (deal.color) lines.push(`*Color:* ${deal.color}`);
  if (deal.chassis_number) lines.push(`*Chassis #:* ${deal.chassis_number}`);
  if (deal.engine_number) lines.push(`*Engine #:* ${deal.engine_number}`);
  return lines;
}

function transferStatusLine(deal: DealWithTotals): string | null {
  if (deal.transfer_status === 'COMPLETED') {
    return `*File / Transfer:* Completed ✅${deal.transfer_completed_date ? ` (${fmtDate(deal.transfer_completed_date)})` : ''}`;
  }
  if (deal.transfer_status === 'WITH_AGENT') {
    return `*File / Transfer:* In Process with Agent${deal.transfer_agent_name ? ` (${deal.transfer_agent_name})` : ''}`;
  }
  return null;
}

/** STRICTLY BUYER-ONLY: Contains only sale price, buyer payments received, and buyer balance due. */
export function buildBuyerWhatsAppText(deal: DealWithTotals, payments: Payment[] = []): string {
  const lines: string[] = [
    `*CAR SALE RECEIPT & STATEMENT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ...vehicleHeaderLines(deal),
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (deal.purchaser_name) {
    lines.push(`*Buyer:* ${deal.purchaser_name}${deal.purchaser_father_name ? ` S/O ${deal.purchaser_father_name}` : ''}`);
  }
  if (deal.sale_date) lines.push(`*Sale Date:* ${fmtDate(deal.sale_date)}`);

  if (deal.sale_price !== null) {
    const due = buyerBalanceDue(deal) ?? 0;
    lines.push(`*Sale Price:* ${fmtMoney(deal.sale_price)}`);
    lines.push(`*Total Received:* ${fmtMoney(deal.received_from_buyer)}`);
    lines.push(`*Balance Due:* ${due === 0 ? 'NIL (Paid in Full) ✅' : fmtMoney(due)}`);
  }

  const buyerPayments = payments.filter((p) => p.direction === 'IN_FROM_BUYER');
  if (buyerPayments.length > 0) {
    lines.push(``, `*Payment History (Received):*`);
    for (const p of buyerPayments) {
      lines.push(`• ${fmtDate(p.date)} — ${fmtMoney(p.amount)} (${p.payment_type}, ${p.method})`);
    }
  }

  const tLine = transferStatusLine(deal);
  if (tLine) lines.push(``, tLine);

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

/** STRICTLY SELLER-ONLY: Contains only purchase price, seller payments paid, and seller balance payable. */
export function buildSellerWhatsAppText(deal: DealWithTotals, payments: Payment[] = []): string {
  const lines: string[] = [
    `*CAR PURCHASE RECEIPT & STATEMENT*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ...vehicleHeaderLines(deal),
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (deal.seller_name) {
    lines.push(`*Seller:* ${deal.seller_name}${deal.seller_father_name ? ` S/O ${deal.seller_father_name}` : ''}`);
  }
  if (deal.purchase_date) lines.push(`*Purchase Date:* ${fmtDate(deal.purchase_date)}`);

  if (deal.purchase_price !== null) {
    const due = sellerBalanceDue(deal) ?? 0;
    lines.push(`*Purchase Price:* ${fmtMoney(deal.purchase_price)}`);
    lines.push(`*Total Paid:* ${fmtMoney(deal.paid_to_seller)}`);
    lines.push(`*Balance Payable:* ${due === 0 ? 'NIL (Paid in Full) ✅' : fmtMoney(due)}`);
  }

  const sellerPayments = payments.filter((p) => p.direction === 'OUT_TO_SELLER');
  if (sellerPayments.length > 0) {
    lines.push(``, `*Payment History (Paid):*`);
    for (const p of sellerPayments) {
      lines.push(`• ${fmtDate(p.date)} — ${fmtMoney(p.amount)} (${p.payment_type}, ${p.method})`);
    }
  }

  const tLine = transferStatusLine(deal);
  if (tLine) lines.push(``, tLine);

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

/** STRICTLY EXCISE / TRANSFER AGENT: Vehicle IDs & party names/CNICs only — zero deal prices. */
export function buildAgentWhatsAppText(deal: DealWithTotals): string {
  const lines: string[] = [
    `*EXCISE TRANSFER & FILE DETAILS*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    ...vehicleHeaderLines(deal),
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (deal.seller_name || deal.seller_cnic) {
    lines.push(`*Seller:* ${deal.seller_name || '—'}${deal.seller_cnic ? ` (CNIC: ${deal.seller_cnic})` : ''}`);
  }
  if (deal.purchaser_name || deal.purchaser_cnic) {
    lines.push(`*Buyer:* ${deal.purchaser_name || '—'}${deal.purchaser_cnic ? ` (CNIC: ${deal.purchaser_cnic})` : ''}`);
  }
  if (deal.file_handover_date) {
    lines.push(`*File Handover Date:* ${fmtDate(deal.file_handover_date)}`);
  }
  if (deal.transfer_notes) {
    lines.push(`*Notes:* ${deal.transfer_notes}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  return lines.join('\n');
}

/** STRICTLY PUBLIC SPECS: Vehicle specifications only — zero party info or prices. */
export function buildWhatsAppStockOfferText(deal: DealWithTotals): string {
  const lines: string[] = [
    `*AVAILABLE FOR SALE* 🚗`,
    `*${carTitle(deal)}${deal.variant ? ` ${deal.variant}` : ''}*`,
    `• *Reg #:* ${regOf(deal)}`,
  ];
  if (deal.color) lines.push(`• *Color:* ${deal.color}`);
  if (deal.horse_power) lines.push(`• *Engine:* ${deal.horse_power}`);
  if (deal.mileage) lines.push(`• *Mileage:* ${deal.mileage.toLocaleString()} km`);
  if (deal.bought_from_location) lines.push(`• *City:* ${deal.bought_from_location}`);
  if (deal.notes) lines.push(`• *Details:* ${deal.notes}`);
  return lines.join('\n');
}

export function buildWhatsAppMessageByType(
  type: WhatsAppTemplateType,
  deal: DealWithTotals,
  payments: Payment[] = [],
): string {
  switch (type) {
    case 'BUYER_RECEIPT':
      return buildBuyerWhatsAppText(deal, payments);
    case 'SELLER_RECEIPT':
      return buildSellerWhatsAppText(deal, payments);
    case 'AGENT_INFO':
      return buildAgentWhatsAppText(deal);
    case 'SPECS':
      return buildWhatsAppStockOfferText(deal);
  }
}

/** Opens WhatsApp Web / Desktop with the pre-filled message and copies text to clipboard as fallback. */
export async function shareToWhatsApp(text: string, recipientPhone?: string | null): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore clipboard restrictions */
  }
  const waPhone = toWhatsAppNumber(recipientPhone);
  const encoded = encodeURIComponent(text);
  const url = waPhone ? `https://wa.me/${waPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}