// Renders an invoice as a standalone, print-ready HTML page (A4).
// Open it in any browser and choose Print -> Save as PDF.

import { formatLakh } from 'pakistan-toolkit';
import { calculateInvoice } from './calc.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function nl2br(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}

/** "2026-11-24" -> "24 Nov 2026". Other strings are shown as given. */
export function formatInvoiceDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!m) return String(value);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function money(n, currency) {
  const body = formatLakh(Math.abs(n), 2);
  const prefix = currency === 'PKR' ? 'Rs ' : `${currency} `;
  return `${n < 0 ? '-' : ''}${prefix}${body}`;
}

function qty(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

// Only allow images we can safely embed: data: images and https URLs.
function safeImage(src) {
  const s = String(src ?? '').trim();
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  return '';
}

function safeColor(c) {
  return /^#[0-9a-f]{3,8}$/i.test(String(c ?? '')) ? c : '#0e6e6a';
}

function party(p, heading) {
  if (!p || !Object.values(p).some(Boolean)) return '';
  const rows = [
    p.address && `<div>${nl2br(p.address)}</div>`,
    p.phone && `<div>${esc(p.phone)}</div>`,
    p.email && `<div>${esc(p.email)}</div>`,
    p.ntn && `<div><span class="k">NTN</span> ${esc(p.ntn)}</div>`,
    p.strn && `<div><span class="k">STRN</span> ${esc(p.strn)}</div>`,
  ].filter(Boolean).join('');
  return `<div class="party"><div class="label">${heading}</div><div class="name">${esc(p.name)}</div>${rows}</div>`;
}

/**
 * Returns a complete HTML document for the invoice.
 * @param {object} invoice  Same shape as calculateInvoice(), plus:
 *   number, date, dueDate, seller{name,address,phone,email,ntn,strn,logo},
 *   buyer{...}, notes, terms, payment{bank,accountTitle,accountNumber,iban}, title, accentColor
 * @param {object} [options]
 * @param {boolean} [options.urduWords=true]  Also show the total in Urdu words (PKR only)
 */
export function renderInvoiceHTML(invoice, { urduWords = true } = {}) {
  const c = calculateInvoice(invoice);
  const cur = c.currency;
  const accent = safeColor(invoice.accentColor);
  const seller = invoice.seller ?? {};
  const logo = safeImage(seller.logo);
  const hasTax = c.totalTax > 0;
  const taxLabel = esc(invoice.taxLabel || 'Sales Tax');
  const title = esc(invoice.title || (hasTax && (seller.strn || seller.ntn) ? 'Sales Tax Invoice' : 'Invoice'));
  const showDiscountCol = c.lines.some((l) => l.discountPct);
  const showTaxCol = c.lines.some((l) => l.taxRate);

  const rows = c.lines.map((l, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${nl2br(l.description)}</td>
        <td class="n">${qty(l.quantity)}${l.unit ? ` <span class="muted">${esc(l.unit)}</span>` : ''}</td>
        <td class="n">${money(l.unitPrice, cur)}</td>
        ${showDiscountCol ? `<td class="n">${l.discountPct ? `${l.discountPct}%` : '-'}</td>` : ''}
        ${showTaxCol ? `<td class="n">${l.taxRate ? `${l.taxRate}%` : '-'}</td>` : ''}
        <td class="n">${money(l.amount, cur)}</td>
      </tr>`).join('');

  const totals = [
    ['Subtotal', money(c.subtotal, cur)],
    c.lineDiscounts ? ['Item discounts', `-${money(c.lineDiscounts, cur)}`] : null,
    c.invoiceDiscount ? [invoice.discount?.type === 'percent' ? `Discount (${invoice.discount.value}%)` : 'Discount', `-${money(c.invoiceDiscount, cur)}`] : null,
    hasTax && c.totalDiscount ? ['Amount before tax', money(c.taxableAmount, cur)] : null,
    ...c.taxes.map((t) => [`${taxLabel} @ ${t.rate}%`, money(t.tax, cur)]),
    c.shipping ? ['Delivery charges', money(c.shipping, cur)] : null,
  ].filter(Boolean);

  const pay = invoice.payment ?? {};
  const payRows = [
    pay.bank && `<div><span class="k">Bank</span> ${esc(pay.bank)}</div>`,
    pay.accountTitle && `<div><span class="k">Account title</span> ${esc(pay.accountTitle)}</div>`,
    pay.accountNumber && `<div><span class="k">Account no.</span> ${esc(pay.accountNumber)}</div>`,
    pay.iban && `<div><span class="k">IBAN</span> ${esc(pay.iban)}</div>`,
    pay.other && `<div>${nl2br(pay.other)}</div>`,
  ].filter(Boolean).join('');

  const meta = [
    ['Invoice no.', invoice.number],
    ['Date', formatInvoiceDate(invoice.date)],
    invoice.dueDate ? ['Due date', formatInvoiceDate(invoice.dueDate)] : null,
    invoice.reference ? ['Reference', invoice.reference] : null,
  ].filter((r) => r && r[1]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} ${esc(invoice.number ?? '')}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap">
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1f5; color: #18212b; font: 13px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff; padding: 16mm 15mm; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 3px solid ${accent}; padding-bottom: 14px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .brand img { max-height: 64px; max-width: 160px; object-fit: contain; }
  .brand .name { font-size: 20px; font-weight: 700; }
  .doc { text-align: right; }
  .doc h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .02em; color: ${accent}; text-transform: uppercase; }
  .meta { display: grid; grid-template-columns: auto auto; gap: 2px 12px; justify-content: end; }
  .meta .k, .party .k { color: #6a7785; }
  .parties { display: flex; gap: 24px; margin: 18px 0; }
  .party { flex: 1; }
  .party .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: ${accent}; margin-bottom: 3px; }
  .party .name { font-size: 15px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: ${accent}; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 8px 8px; text-align: left; }
  tbody td { padding: 8px; border-bottom: 1px solid #e4e8ee; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  thead th.n { text-align: right; }
  .c { text-align: center; color: #6a7785; width: 28px; }
  .muted { color: #6a7785; font-size: 11px; }
  .bottom { display: flex; gap: 24px; margin-top: 16px; align-items: flex-start; }
  .left { flex: 1; }
  .totals { width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #18212b; margin-top: 4px; padding-top: 8px; font-size: 17px; font-weight: 800; }
  .totals .due { background: ${accent}; color: #fff; padding: 8px 10px; border-radius: 6px; margin-top: 6px; font-weight: 800; font-size: 15px; }
  .words { margin-top: 14px; padding: 10px 12px; background: #f4f7f9; border-left: 3px solid ${accent}; border-radius: 0 6px 6px 0; }
  .words .ur { direction: rtl; text-align: right; font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; font-size: 15px; line-height: 2.2; margin-top: 4px; }
  .box { margin-top: 14px; }
  .box h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: ${accent}; }
  .sign { margin-top: 48px; display: flex; justify-content: flex-end; }
  .sign div { border-top: 1px solid #18212b; padding-top: 4px; width: 200px; text-align: center; color: #6a7785; }
  .foot { margin-top: 26px; text-align: center; color: #9aa5b1; font-size: 11px; }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0; } }
  @media (max-width: 820px) { .sheet { width: auto; min-height: 0; margin: 0; padding: 18px; } .parties, .bottom, .top { flex-direction: column; } .doc { text-align: left; } .meta { justify-content: start; } .totals { width: 100%; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="top">
    <div class="brand">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<div><div class="name">${esc(seller.name)}</div></div></div>
    <div class="doc"><h1>${title}</h1><div class="meta">${meta.map(([k, v]) => `<span class="k">${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div></div>
  </div>
  <div class="parties">
    ${party(seller, 'From')}
    ${party(invoice.buyer, 'Bill to')}
  </div>
  <table>
    <thead><tr><th class="c">#</th><th>Description</th><th class="n">Qty</th><th class="n">Rate</th>${showDiscountCol ? '<th class="n">Disc.</th>' : ''}${showTaxCol ? `<th class="n">${taxLabel}</th>` : ''}<th class="n">Amount</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>
  <div class="bottom">
    <div class="left">
      <div class="words"><b>Amount in words:</b> ${esc(c.words.english)}${urduWords && c.words.urdu ? `<div class="ur">${esc(c.words.urdu)}</div>` : ''}</div>
      ${payRows ? `<div class="box"><h4>Payment details</h4>${payRows}</div>` : ''}
      ${invoice.notes ? `<div class="box"><h4>Notes</h4>${nl2br(invoice.notes)}</div>` : ''}
      ${invoice.terms ? `<div class="box"><h4>Terms</h4>${nl2br(invoice.terms)}</div>` : ''}
    </div>
    <div class="totals">
      ${totals.map(([k, v]) => `<div><span>${k}</span><span class="n">${v}</span></div>`).join('')}
      <div class="grand"><span>Total</span><span class="n">${money(c.total, cur)}</span></div>
      ${c.amountPaid ? `<div><span>Paid</span><span class="n">-${money(c.amountPaid, cur)}</span></div><div class="due"><span>Balance due</span><span class="n">${money(c.balanceDue, cur)}</span></div>` : ''}
    </div>
  </div>
  <div class="sign"><div>Authorised signature</div></div>
  ${invoice.footer === false ? '' : `<div class="foot">${esc(invoice.footer || 'Thank you for your business.')}</div>`}
</div>
</body>
</html>`;
}
