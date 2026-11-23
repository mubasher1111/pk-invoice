#!/usr/bin/env node
// pk-invoice CLI: turn an invoice JSON file into a print-ready HTML invoice.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { renderInvoiceHTML, calculateInvoice, exampleInvoice, nextInvoiceNumber } from '../src/index.js';

const HELP = `
pk-invoice: make a professional invoice from a JSON file

Usage:
  npx pk-invoice --example > invoice.json     Create a sample invoice to edit
  npx pk-invoice invoice.json -o invoice.html Make the invoice (open it, then Print -> Save as PDF)
  npx pk-invoice invoice.json --totals        Only print the calculated totals
  npx pk-invoice --next INV-2026-0042         Suggest the next invoice number

Options:
  -o, --out <file>   Output HTML file (default: <invoice number>.html)
      --no-urdu      Don't show the amount in Urdu words
  -h, --help         Show this help
`;

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      example: { type: 'boolean' },
      totals: { type: 'boolean' },
      next: { type: 'string' },
      'no-urdu': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
} catch (err) {
  console.error(err.message + '\n' + HELP);
  process.exit(2);
}

const { values: v, positionals } = args;
if (v.version) {
  console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  process.exit(0);
}
if (v.example) {
  console.log(JSON.stringify(exampleInvoice, null, 2));
  process.exit(0);
}
if (v.next !== undefined) {
  console.log(nextInvoiceNumber(v.next));
  process.exit(0);
}
if (v.help || positionals.length !== 1) {
  console.log(HELP);
  process.exit(v.help ? 0 : 2);
}

let invoice;
try {
  invoice = JSON.parse(readFileSync(positionals[0], 'utf8').replace(/^﻿/, ''));
} catch (err) {
  console.error(`Could not read ${positionals[0]}: ${err.message}`);
  process.exit(1);
}

try {
  const c = calculateInvoice(invoice);
  const pk = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v.totals) {
    console.log(JSON.stringify({
      subtotal: c.subtotal, discount: c.totalDiscount, taxableAmount: c.taxableAmount, taxes: c.taxes,
      totalTax: c.totalTax, shipping: c.shipping, total: c.total, amountPaid: c.amountPaid, balanceDue: c.balanceDue, words: c.words,
    }, null, 2));
    process.exit(0);
  }
  const out = v.out || `${String(invoice.number || 'invoice').replace(/[^a-z0-9._-]+/gi, '-')}.html`;
  writeFileSync(out, renderInvoiceHTML(invoice, { urduWords: !v['no-urdu'] }));
  console.log(`Invoice ${invoice.number ?? ''} total ${c.currency} ${pk(c.total)}${c.amountPaid ? `, balance due ${pk(c.balanceDue)}` : ''}`);
  console.log(`Saved to ${out}. Open it in a browser and choose Print -> Save as PDF.`);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
