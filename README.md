# 🧾 pk-invoice

**Make professional invoices in seconds, in Node.js, the browser, or from the command line.**
Line discounts, sales tax by rate, shipping, advance payments, lakh/crore formatting, amount in words in English and Urdu, and a clean A4 template that prints straight to PDF.

[![Tests](https://github.com/mubasher1111/pk-invoice/actions/workflows/test.yml/badge.svg)](https://github.com/mubasher1111/pk-invoice/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/pk-invoice)](https://www.npmjs.com/package/pk-invoice)
![License](https://img.shields.io/badge/license-MIT-blue)

🧮 **[Free online invoice maker](https://zexcart.site/pk-invoice/#invoice-maker)**: no sign-up, nothing to install · 📖 **[Full guide](https://zexcart.site/pk-invoice/)**

---

## Features

- **Correct maths**: per-item discount, invoice discount spread across items *before* tax, sales tax at different rates (18%, 16%, 0%...), shipping, amount already paid and balance due. Every amount is rounded properly to 2 decimals.
- **Pakistani formatting**: `Rs 4,72,680.29`, and the total in words: *Four Lakh Seventy Two Thousand Six Hundred Eighty Rupees and Twenty Nine Paisa Only*, plus *چار لاکھ بہتر ہزار چھ سو اسی روپے اور انتیس پیسے صرف*
- **Sales tax invoice fields**: seller and buyer NTN and STRN, tax rate and tax amount per line, value before and after tax. It becomes a "Sales Tax Invoice" automatically when tax is charged and the seller has an NTN/STRN.
- **Print-ready template**: A4, your logo and colour, payment details (bank, IBAN), notes, terms and signature line. Open it in a browser and save as PDF.
- **Safe**: every field is escaped, so text from a form can't inject code into the invoice.
- Other currencies too (USD, EUR, GBP, AED, SAR...), with English words.

## Quick start (command line)

```bash
npx pk-invoice --example > invoice.json     # a sample invoice to edit
npx pk-invoice invoice.json -o invoice.html # make the invoice
```

Open `invoice.html` in your browser and choose **Print → Save as PDF**.

```
npx pk-invoice invoice.json --totals        # just the numbers, as JSON
npx pk-invoice --next INV-2026-0042         # → INV-2026-0043
```

## Library

```bash
npm install pk-invoice
```

```js
import { calculateInvoice, renderInvoiceHTML } from 'pk-invoice';

const invoice = {
  number: 'INV-2026-0042',
  date: '2026-11-24',
  dueDate: '2026-12-08',
  taxRate: 18,                                  // default sales tax for items
  seller: { name: 'Crescent Garments', address: 'Faisalabad', ntn: '1234567-8', strn: '32-77-8761-234-56' },
  buyer:  { name: 'Ahmed Textiles', address: 'Karachi' },
  items: [
    { description: 'Cotton T-shirt', quantity: 200, unit: 'pcs', unitPrice: 850 },
    { description: 'Denim jeans', quantity: 120, unit: 'pcs', unitPrice: 1950, discount: 5 },
    { description: 'Printing charges', unitPrice: 15000, taxRate: 0 },
  ],
  discount: { type: 'amount', value: 10000 },   // or { type: 'percent', value: 5 }
  shipping: 6500,
  amountPaid: 150000,
  payment: { bank: 'Meezan Bank', accountTitle: 'Crescent Garments', iban: 'PK36 SCBL 0000 0011 2345 6702' },
  notes: 'Thank you for your order.',
};

const totals = calculateInvoice(invoice);
// totals.total      → 472680.29
// totals.balanceDue → 322680.29
// totals.taxes      → [{ rate: 18, taxable: 382668.28, tax: 68880.29 }]
// totals.words      → { english: 'Four Lakh Seventy Two Thousand ...', urdu: 'چار لاکھ بہتر ہزار ...' }

const html = renderInvoiceHTML(invoice);        // a complete HTML page
```

In the browser, put the HTML in an iframe or a new window and call `print()` to save a PDF. On a server, any HTML-to-PDF tool (Puppeteer, Playwright, wkhtmltopdf) turns it into a PDF file.

### How the totals are calculated

1. **Line amount** = quantity × rate − line discount %
2. The **invoice discount** is shared between lines in proportion to their amounts, so tax is charged on the discounted value
3. **Tax** = line amount after discount × the line's tax rate, grouped by rate
4. **Total** = amount after discounts + tax + delivery charges
5. **Balance due** = total − amount paid

## Invoice fields

| Field | Description |
|---|---|
| `number`, `date`, `dueDate`, `reference` | Dates as `YYYY-MM-DD` |
| `currency` | `PKR` (default), `USD`, `EUR`, `GBP`, `AED`, `SAR`... |
| `taxRate`, `taxLabel` | Default tax % for items, and its name (default "Sales Tax") |
| `seller`, `buyer` | `name`, `address`, `phone`, `email`, `ntn`, `strn`; `seller.logo` (data URL or https) |
| `items[]` | `description`, `quantity`, `unit`, `unitPrice`, `discount` (%), `taxRate` (%) |
| `discount` | `{ type: 'percent' \| 'amount', value }` on the whole invoice |
| `shipping`, `amountPaid` | Delivery charges (not taxed), advance received |
| `payment` | `bank`, `accountTitle`, `accountNumber`, `iban`, `other` |
| `notes`, `terms`, `footer`, `title`, `accentColor` | Text and look |

## Note on tax

pk-invoice calculates and prints the fields a sales tax invoice usually needs, but it does **not** connect to FBR's digital invoicing system, and it is not tax advice. Check the current rules for your business with FBR or your tax adviser.

## License

[MIT](LICENSE). Made by [ZexCart](https://zexcart.site). More free tools: [zexcart.site/dev-tools](https://zexcart.site/dev-tools/). Built on [pakistan-toolkit](https://github.com/mubasher1111/pakistan-toolkit) and [urdu-toolkit](https://github.com/mubasher1111/urdu-toolkit).

If it helps your business, please ⭐ **star the repo**.
