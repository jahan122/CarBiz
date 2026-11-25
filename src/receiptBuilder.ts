import type { BusinessProfile, DealWithTotals, Payment } from './types';
import { DEFAULT_BUSINESS_PROFILE } from './types';
import { fmtDate, fmtMoney, numberToWords, regOf } from './utils';

/**
 * 'buying' => We are the PURCHASER (buying the car from deal.seller_*)
 * 'sale'   => We are the SELLER (selling the car to deal.purchaser_*)
 */
export type ReceiptKind = 'buying' | 'sale';

export interface ReceiptOptions {
  kind: ReceiptKind;
  deal: DealWithTotals;
  payments: Payment[];
  profile: BusinessProfile;
  paymentModeOverride?: string;
  vehicleType?: 'Motor Cycle' | 'Scooter' | 'Car' | 'Bus';
  includeTikliNote?: boolean;
  extraTerms?: string;
}

interface PartyBlock {
  name: string;
  fatherName: string;
  cnic: string;
  contact: string;
  address: string;
}

function escHtml(s: string | number | null | undefined): string {
  if (s === null || s === undefined || String(s).trim() === '') return '&nbsp;';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Renders the 13-box Pakistani CNIC grid (5 boxes - 7 boxes - 1 box) matching the physical form. */
function renderCnicBoxes(cnic: string): string {
  const digits = (cnic || '').replace(/\D/g, '').padEnd(13, ' ').slice(0, 13).split('');
  const box = (ch: string) =>
    `<span class="cnic-box">${ch === ' ' ? '&nbsp;' : escHtml(ch)}</span>`;

  const part1 = digits.slice(0, 5).map(box).join('');
  const part2 = digits.slice(5, 12).map(box).join('');
  const part3 = digits.slice(12, 13).map(box).join('');

  return `<div class="cnic-row">${part1}${box('-')}${part2}${box('-')}${part3}</div>`;
}

export function buildReceiptHtml(opts: ReceiptOptions): string {
  const { kind, deal, payments } = opts;
  const profile = { ...DEFAULT_BUSINESS_PROFILE, ...opts.profile };
  const isBuying = kind === 'buying';

  const ourDetails: PartyBlock = {
    name: profile.owner_name.trim() || DEFAULT_BUSINESS_PROFILE.owner_name,
    fatherName: profile.father_name.trim() || DEFAULT_BUSINESS_PROFILE.father_name,
    cnic: profile.cnic.trim() || DEFAULT_BUSINESS_PROFILE.cnic,
    contact: profile.phone.trim() || DEFAULT_BUSINESS_PROFILE.phone,
    address: profile.address.trim() || DEFAULT_BUSINESS_PROFILE.address,
  };

  const seller: PartyBlock = isBuying
    ? {
        name: deal.seller_name ?? '',
        fatherName: deal.seller_father_name ?? '',
        cnic: deal.seller_cnic ?? '',
        contact: deal.seller_contact ?? '',
        address: deal.seller_address ?? '',
      }
    : ourDetails;

  const buyer: PartyBlock = isBuying
    ? ourDetails
    : {
        name: deal.purchaser_name ?? '',
        fatherName: deal.purchaser_father_name ?? '',
        cnic: deal.purchaser_cnic ?? '',
        contact: deal.purchaser_contact ?? '',
        address: deal.purchaser_address ?? '',
      };

  const txDate = isBuying ? deal.purchase_date : deal.sale_date;
  const amount = isBuying ? deal.purchase_price : deal.sale_price;
  const amountStr =
    amount !== null && amount > 0
      ? `${fmtMoney(amount)} (${numberToWords(amount)} Rupees Only)`
      : '';

  const relevantPayments = payments.filter((p) =>
    isBuying ? p.direction === 'OUT_TO_SELLER' : p.direction === 'IN_FROM_BUYER',
  );

  let paymentModeText = opts.paymentModeOverride?.trim() ?? '';
  if (!paymentModeText && relevantPayments.length > 0) {
    const methods = Array.from(new Set(relevantPayments.map((p) => p.method)));
    const notesWithRef = relevantPayments.map((p) => p.notes.trim()).filter(Boolean);
    paymentModeText = methods.join(' / ') + (notesWithRef.length ? ` (${notesWithRef.join(', ')})` : '');
  }

  const makeModel = [deal.make, deal.model].filter(Boolean).join(' ');
  const modelYear = [deal.variant, deal.year].filter(Boolean).join(' ');
  const selectedType = opts.vehicleType ?? 'Car';

  const vehicleTypes = ['Motor Cycle', 'Scooter', 'Car', 'Bus']
    .map((t) =>
      t === selectedType
        ? `<strong style="text-decoration:underline;">${t}</strong>`
        : `<span style="text-decoration:line-through;color:#64748b;">${t}</span>`,
    )
    .join(' / ');

  const showTikli = opts.includeTikliNote !== false;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sale Receipt &amp; Delivery Letter - ${escHtml(regOf(deal))}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 10mm 13mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #111827;
    margin: 0;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
    background: #ffffff;
  }
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 4px 6px;
  }
  .optional-banner {
    text-align: center;
    border-bottom: 1.5px solid #111827;
    padding-bottom: 5px;
    margin-bottom: 8px;
  }
  .optional-banner .biz {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .optional-banner .sub {
    font-size: 10.5px;
    color: #374151;
  }
  .doc-heading {
    text-align: center;
    font-size: 15.5px;
    font-weight: 800;
    text-decoration: underline;
    letter-spacing: 0.5px;
    margin: 4px 0 9px 0;
  }
  .line-row {
    display: flex;
    align-items: flex-end;
    gap: 7px;
    margin-bottom: 6px;
    width: 100%;
  }
  .lbl {
    white-space: nowrap;
    font-weight: 500;
    color: #111827;
  }
  .fill {
    flex: 1;
    border-bottom: 1px solid #111827;
    padding: 0 5px 1px 5px;
    font-weight: 700;
    min-height: 17px;
    color: #000000;
  }
  .mono {
    font-family: Consolas, 'Courier New', monospace;
  }
  .split-2 {
    display: grid;
    grid-template-columns: 1fr 1.18fr;
    gap: 24px;
    margin-top: 8px;
  }
  .cnic-row {
    display: inline-flex;
    align-items: center;
    margin-top: 4px;
  }
  .cnic-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 20px;
    border: 1px solid #111827;
    font-weight: 700;
    font-size: 11.5px;
    margin-right: -1px;
  }
  .tear-line {
    border: none;
    border-top: 1.5px dashed #111827;
    margin: 14px 0 12px 0;
  }
  .liability-text {
    margin: 7px 0 9px 0;
    font-size: 11.8px;
    line-height: 1.42;
    text-align: justify;
  }
  .tikli-note {
    margin-top: 12px;
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.38;
    max-width: 240px;
  }
  .extra-remarks {
    margin-top: 8px;
    font-size: 10.8px;
    border: 1px solid #cbd5e1;
    padding: 4px 8px;
    background: #f8fafc;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
  <div class="page">
    ${
      profile.business_name.trim()
        ? `<div class="optional-banner">
             <div class="biz">${escHtml(profile.business_name)}</div>
             ${profile.tagline.trim() ? `<div class="sub">${escHtml(profile.tagline)}</div>` : ''}
           </div>`
        : ''
    }

    <!-- ==================== TOP SECTION: SALE RECEIPT ==================== -->
    <div class="doc-heading">SALE RECEIPT</div>

    <div class="line-row">
      <span class="lbl">RECEIVED with thanks the sum of</span>
      <span class="fill">${escHtml(amountStr)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Mr.</span>
      <span class="fill" style="flex:1.25;">${escHtml(buyer.name)}</span>
      <span class="lbl">S/O</span>
      <span class="fill" style="flex:1;">${escHtml(buyer.fatherName)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Resident of</span>
      <span class="fill">${escHtml(buyer.address)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Against the sale of my ${vehicleTypes}</span>
      <span class="fill">${escHtml(deal.color ? `Color: ${deal.color}` : '')}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Registration No:</span>
      <span class="fill mono">${escHtml(deal.registration_number)}</span>
      <span class="lbl">Make:</span>
      <span class="fill">${escHtml(makeModel)}</span>
      <span class="lbl">Model:</span>
      <span class="fill">${escHtml(modelYear)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Horse Power:</span>
      <span class="fill">${escHtml(deal.horse_power)}</span>
      <span class="lbl">Engine No:</span>
      <span class="fill mono">${escHtml(deal.engine_number)}</span>
      <span class="lbl">Chassis No:</span>
      <span class="fill mono">${escHtml(deal.chassis_number)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">The full and final payment has been received in Cash/ Cheque No.</span>
      <span class="fill">${escHtml(paymentModeText)}</span>
    </div>

    <div class="split-2">
      <div>
        <div class="line-row">
          <span class="lbl">Dated:</span>
          <span class="fill">${escHtml(txDate ? fmtDate(txDate) : '')}</span>
        </div>
        <div style="margin-top:8px;">
          <div class="lbl">CNIC Number:</div>
          ${renderCnicBoxes(seller.cnic)}
        </div>
      </div>

      <div>
        <div class="line-row">
          <span class="lbl">Signature:</span>
          <span class="fill"></span>
        </div>
        <div class="line-row">
          <span class="lbl">Seller Name:</span>
          <span class="fill">${escHtml(seller.name)}</span>
        </div>
        <div class="line-row">
          <span class="lbl">S/O:</span>
          <span class="fill">${escHtml(seller.fatherName)}</span>
        </div>
        <div class="line-row">
          <span class="lbl">R/O:</span>
          <span class="fill">${escHtml(seller.address)}</span>
        </div>
        <div class="line-row">
          <span class="lbl">Contact No:</span>
          <span class="fill mono">${escHtml(seller.contact)}</span>
        </div>
      </div>
    </div>

    <hr class="tear-line" />

    <!-- ==================== BOTTOM SECTION: DELIVERY LETTER ==================== -->
    <div class="doc-heading">DELIVERY LETTER</div>

    <div style="text-align:center; margin-bottom:8px;">
      I have taken the delivery of ${vehicleTypes}
    </div>

    <div class="line-row">
      <span class="lbl">Registration No:</span>
      <span class="fill mono">${escHtml(deal.registration_number)}</span>
      <span class="lbl">Make:</span>
      <span class="fill">${escHtml(makeModel)}</span>
      <span class="lbl">Model:</span>
      <span class="fill">${escHtml(modelYear)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Horse Power:</span>
      <span class="fill">${escHtml(deal.horse_power)}</span>
      <span class="lbl">Engine No:</span>
      <span class="fill mono">${escHtml(deal.engine_number)}</span>
      <span class="lbl">Chassis No:</span>
      <span class="fill mono">${escHtml(deal.chassis_number)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">from Mr.</span>
      <span class="fill" style="flex:1.25;">${escHtml(seller.name)}</span>
      <span class="lbl">S/O</span>
      <span class="fill" style="flex:1;">${escHtml(seller.fatherName)}</span>
    </div>

    <div class="line-row">
      <span class="lbl">Resident of</span>
      <span class="fill">${escHtml(seller.address)}</span>
    </div>

    <div class="liability-text">
      And now I am responsible for all liabilities of traffic including challans, court proceedings, theft,
      accident and any other illegal activity.
    </div>

    <div class="split-2">
      <div>
        <div class="line-row">
          <span class="lbl">Dated:</span>
          <span class="fill">${escHtml(txDate ? fmtDate(txDate) : '')}</span>
        </div>
        <div style="margin-top:8px;">
          <div class="lbl">CNIC Number:</div>
          ${renderCnicBoxes(buyer.cnic)}
        </div>
        ${
          showTikli
            ? `<div class="tikli-note">
                 Original file along with original tikli and number plates has been received.
               </div>`
            : ''
        }
      </div>

      <div>
        <div class="line-row">
          <span class="lbl">Signature:</span>
          <span class="fill"></span>
        </div>
        <div class="line-row">
          <span class="lbl">Buyer Name:</span>
          <span class="fill">${escHtml(buyer.name)}</span>
        </div>
        <div class="line-row">
          <span class="lbl">S/O:</span>
          <span class="fill">${escHtml(buyer.fatherName)}</span>
        </div>
        <div class="line-row">
          <span class="lbl">R/O:</span>
          <span class="fill">${escHtml(buyer.address)}</span>
        </div>
        <div class="line-row">
          <span class="lbl">Contact No:</span>
          <span class="fill mono">${escHtml(buyer.contact)}</span>
        </div>
      </div>
    </div>

    ${
      opts.extraTerms?.trim()
        ? `<div class="extra-remarks"><strong>Remarks:</strong> ${escHtml(opts.extraTerms.trim())}</div>`
        : ''
    }
  </div>
</body>
</html>`;
}