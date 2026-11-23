// Invoice arithmetic: line discounts, invoice discount, per-rate sales tax,
// shipping, payments and amount in words. All money is rounded to 2 decimals.

import { amountToWords, numberToWords } from 'pakistan-toolkit';
import { amountToUrduWords } from 'urdu-toolkit';

/** Rounds half away from zero to 2 decimals, avoiding float artefacts (1.005 -> 1.01). */
export function round2(n) {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + 1e-7)) / 100;
}

function num(value, field, { min = 0, max = Infinity, fallback } = {}) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  if (!Number.isFinite(n)) throw new TypeError(`${field} must be a number`);
  if (n < min || n > max) throw new RangeError(`${field} must be between ${min} and ${max === Infinity ? 'any amount' : max}`);
  return n;
}

const CURRENCY_WORDS = { USD: 'US Dollars', EUR: 'Euros', GBP: 'Pounds', AED: 'Dirhams', SAR: 'Riyals' };

/** Amount in words for the invoice currency. Urdu words are given for PKR only. */
export function totalInWords(total, currency = 'PKR') {
  if (currency === 'PKR') return { english: amountToWords(total), urdu: amountToUrduWords(total, { only: true }) };
  const whole = Math.floor(total);
  const cents = Math.round((total - whole) * 100);
  const name = CURRENCY_WORDS[currency] ?? currency;
  return { english: `${numberToWords(whole)} ${name}${cents ? ` and ${numberToWords(cents)} Cents` : ''} Only`, urdu: null };
}

/**
 * Calculates every amount on an invoice.
 *
 * @param {object} invoice
 * @param {Array<{description:string, quantity?:number, unitPrice:number, discount?:number, taxRate?:number, unit?:string}>} invoice.items
 *   discount and taxRate are percentages. taxRate defaults to invoice.taxRate.
 * @param {number} [invoice.taxRate=0]         Default tax % for items (e.g. 18 for sales tax)
 * @param {{type:'percent'|'amount', value:number}} [invoice.discount]  Discount on the whole invoice (before tax)
 * @param {number} [invoice.shipping=0]        Delivery/shipping charges (not taxed)
 * @param {number} [invoice.amountPaid=0]      Advance or amount already received
 * @param {string} [invoice.currency='PKR']
 */
export function calculateInvoice(invoice) {
  if (!invoice || !Array.isArray(invoice.items) || invoice.items.length === 0) {
    throw new TypeError('An invoice needs at least one item');
  }
  const currency = invoice.currency || 'PKR';
  const defaultRate = num(invoice.taxRate, 'taxRate', { max: 100, fallback: 0 });

  const lines = invoice.items.map((item, i) => {
    const label = `items[${i}]`;
    const quantity = num(item.quantity, `${label}.quantity`, { fallback: 1 });
    const unitPrice = num(item.unitPrice, `${label}.unitPrice`);
    const discountPct = num(item.discount, `${label}.discount`, { max: 100, fallback: 0 });
    const taxRate = num(item.taxRate, `${label}.taxRate`, { max: 100, fallback: defaultRate });
    const gross = round2(quantity * unitPrice);
    const lineDiscount = round2(gross * discountPct / 100);
    return {
      description: String(item.description ?? '').trim(),
      unit: item.unit ? String(item.unit) : '',
      quantity, unitPrice, discountPct, taxRate,
      gross, lineDiscount, net: round2(gross - lineDiscount),
    };
  });

  const netBeforeInvoiceDiscount = round2(lines.reduce((s, l) => s + l.net, 0));

  // Invoice-level discount, spread over lines in proportion to their value so
  // each line's tax is charged on the discounted amount.
  let invoiceDiscount = 0;
  if (invoice.discount && invoice.discount.value) {
    const { type = 'percent', value } = invoice.discount;
    if (type === 'percent') invoiceDiscount = round2(netBeforeInvoiceDiscount * num(value, 'discount.value', { max: 100 }) / 100);
    else if (type === 'amount') invoiceDiscount = round2(num(value, 'discount.value', { max: netBeforeInvoiceDiscount }));
    else throw new TypeError('discount.type must be "percent" or "amount"');
  }
  let remaining = invoiceDiscount;
  lines.forEach((l, i) => {
    const share = i === lines.length - 1
      ? remaining
      : netBeforeInvoiceDiscount ? round2(invoiceDiscount * l.net / netBeforeInvoiceDiscount) : 0;
    remaining = round2(remaining - share);
    l.invoiceDiscountShare = share;
    l.taxable = round2(l.net - share);
    l.tax = round2(l.taxable * l.taxRate / 100);
    l.total = round2(l.taxable + l.tax);
    l.amount = l.net; // the amount shown on the invoice line (after line discount, before tax)
  });

  const byRate = new Map();
  for (const l of lines) {
    if (!l.taxRate) continue;
    const t = byRate.get(l.taxRate) ?? { rate: l.taxRate, taxable: 0, tax: 0 };
    t.taxable = round2(t.taxable + l.taxable);
    t.tax = round2(t.tax + l.tax);
    byRate.set(l.taxRate, t);
  }
  const taxes = [...byRate.values()].sort((a, b) => a.rate - b.rate);

  const subtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const lineDiscounts = round2(lines.reduce((s, l) => s + l.lineDiscount, 0));
  const taxableAmount = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const totalTax = round2(taxes.reduce((s, t) => s + t.tax, 0));
  const shipping = round2(num(invoice.shipping, 'shipping', { fallback: 0 }));
  const total = round2(taxableAmount + totalTax + shipping);
  const amountPaid = round2(num(invoice.amountPaid, 'amountPaid', { fallback: 0 }));
  const balanceDue = round2(total - amountPaid);

  return {
    currency,
    lines,
    subtotal,
    lineDiscounts,
    invoiceDiscount,
    totalDiscount: round2(lineDiscounts + invoiceDiscount),
    taxableAmount,
    taxes,
    totalTax,
    shipping,
    total,
    amountPaid,
    balanceDue,
    words: totalInWords(total, currency),
  };
}

/**
 * Suggests the next invoice number by adding one to the last group of digits,
 * keeping zero padding: "INV-2026-0041" -> "INV-2026-0042".
 */
export function nextInvoiceNumber(previous) {
  const s = String(previous ?? '').trim();
  if (!s) return 'INV-0001';
  const m = /^(.*?)(\d+)(\D*)$/.exec(s);
  if (!m) return `${s}-1`;
  const next = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  return `${m[1]}${next}${m[3]}`;
}
