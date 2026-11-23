import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateInvoice, nextInvoiceNumber, totalInWords, round2, renderInvoiceHTML, formatInvoiceDate, exampleInvoice,
} from '../src/index.js';

test('round2 avoids float artefacts', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(-2.345), -2.35);
});

test('simple invoice without tax', () => {
  const c = calculateInvoice({ items: [{ description: 'A', quantity: 2, unitPrice: 500 }, { description: 'B', unitPrice: 250 }] });
  assert.equal(c.subtotal, 1250);
  assert.equal(c.totalTax, 0);
  assert.equal(c.total, 1250);
  assert.deepEqual(c.taxes, []);
  assert.equal(c.words.english, 'One Thousand Two Hundred Fifty Rupees Only');
  assert.equal(c.words.urdu, 'ایک ہزار دو سو پچاس روپے صرف');
});

test('example invoice: discounts spread before tax, multiple rates, shipping, advance', () => {
  const c = calculateInvoice(exampleInvoice);
  // Hand-checked: 170,000 + (234,000 - 5%) + 15,000 = 407,300 net; minus 10,000 discount = 397,300
  assert.equal(c.subtotal, 419000);
  assert.equal(c.lineDiscounts, 11700);
  assert.equal(c.invoiceDiscount, 10000);
  assert.equal(c.taxableAmount, 397300);
  // The invoice discount is shared across lines and adds back up exactly.
  assert.equal(round2(c.lines.reduce((s, l) => s + l.invoiceDiscountShare, 0)), 10000);
  assert.deepEqual(c.taxes, [{ rate: 18, taxable: 382668.28, tax: 68880.29 }]);
  assert.equal(c.lines[2].tax, 0); // printing charges at 0%
  assert.equal(c.total, 472680.29);
  assert.equal(c.balanceDue, 322680.29);
  assert.equal(c.words.english, 'Four Lakh Seventy Two Thousand Six Hundred Eighty Rupees and Twenty Nine Paisa Only');
});

test('percent invoice discount and per-line tax rates', () => {
  const c = calculateInvoice({
    taxRate: 18,
    discount: { type: 'percent', value: 10 },
    items: [{ description: 'Goods', unitPrice: 1000 }, { description: 'Service', unitPrice: 1000, taxRate: 16 }],
  });
  assert.equal(c.invoiceDiscount, 200);
  assert.deepEqual(c.taxes, [{ rate: 16, taxable: 900, tax: 144 }, { rate: 18, taxable: 900, tax: 162 }]);
  assert.equal(c.total, 2106);
});

test('validation', () => {
  assert.throws(() => calculateInvoice({ items: [] }), /at least one item/);
  assert.throws(() => calculateInvoice({ items: [{ unitPrice: 'abc' }] }), /items\[0\]\.unitPrice must be a number/);
  assert.throws(() => calculateInvoice({ items: [{ unitPrice: 10, discount: 120 }] }), RangeError);
  assert.throws(() => calculateInvoice({ items: [{ unitPrice: 10 }], discount: { type: 'amount', value: 50 } }), RangeError);
  assert.throws(() => calculateInvoice({ items: [{ unitPrice: 10 }], discount: { type: 'weird', value: 5 } }), /discount.type/);
  assert.equal(calculateInvoice({ items: [{ unitPrice: '1,500' }] }).total, 1500); // "1,500" from a form
});

test('other currencies', () => {
  assert.deepEqual(totalInWords(1250.5, 'USD'), { english: 'One Thousand Two Hundred Fifty US Dollars and Fifty Cents Only', urdu: null });
  const c = calculateInvoice({ currency: 'USD', items: [{ unitPrice: 99 }] });
  assert.equal(c.words.urdu, null);
});

test('next invoice number', () => {
  assert.equal(nextInvoiceNumber('INV-2026-0042'), 'INV-2026-0043');
  assert.equal(nextInvoiceNumber('INV-099'), 'INV-100');
  assert.equal(nextInvoiceNumber('2026/17/A'), '2026/18/A');
  assert.equal(nextInvoiceNumber('ABC'), 'ABC-1');
  assert.equal(nextInvoiceNumber(''), 'INV-0001');
});

test('html template', () => {
  const html = renderInvoiceHTML(exampleInvoice);
  assert.match(html, /<title>Sales Tax Invoice INV-2026-0042<\/title>/);
  assert.match(html, /Rs 4,72,680\.29/);
  assert.match(html, /Balance due/);
  assert.match(html, /STRN<\/span> 32-77-8761-234-56/);
  assert.match(html, /چار لاکھ بہتر ہزار/);
  assert.equal(formatInvoiceDate('2026-11-24'), '24 Nov 2026');
  assert.doesNotMatch(renderInvoiceHTML(exampleInvoice, { urduWords: false }), /چار لاکھ/);
  // Plain invoice title when there is no tax.
  assert.match(renderInvoiceHTML({ items: [{ unitPrice: 5 }] }), /<h1>Invoice<\/h1>/);
});

test('html template escapes user text and blocks unsafe images', () => {
  const html = renderInvoiceHTML({
    number: '<script>x</script>',
    seller: { name: 'A & B "Co"', logo: 'javascript:alert(1)' },
    buyer: { name: '<img src=x onerror=alert(1)>' },
    items: [{ description: '</td><script>bad()</script>', unitPrice: 1 }],
    accentColor: 'red;}</style><script>',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /A &amp; B &quot;Co&quot;/);
  assert.match(html, /#0e6e6a/); // unsafe colour replaced by the default
  const withLogo = renderInvoiceHTML({ seller: { logo: 'data:image/png;base64,iVBORw0KGgo=' }, items: [{ unitPrice: 1 }] });
  assert.match(withLogo, /<img src="data:image\/png;base64,iVBORw0KGgo="/);
});

test('cli', () => {
  const bin = fileURLToPath(new URL('../bin/invoice-kit.js', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'invoice-kit-'));
  const example = execFileSync(process.execPath, [bin, '--example'], { encoding: 'utf8' });
  const file = join(dir, 'invoice.json');
  writeFileSync(file, example);
  const out = join(dir, 'out.html');
  const msg = execFileSync(process.execPath, [bin, file, '-o', out], { encoding: 'utf8' });
  assert.match(msg, /total PKR 4,72,680\.29, balance due 3,22,680\.29/);
  assert.match(readFileSync(out, 'utf8'), /Sales Tax Invoice/);
  const totals = JSON.parse(execFileSync(process.execPath, [bin, file, '--totals'], { encoding: 'utf8' }));
  assert.equal(totals.total, 472680.29);
  assert.equal(execFileSync(process.execPath, [bin, '--next', 'INV-0009'], { encoding: 'utf8' }).trim(), 'INV-0010');
});
