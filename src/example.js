// A complete example invoice, used by `invoice-kit --example` and the tests.
export const exampleInvoice = {
  number: 'INV-2026-0042',
  date: '2026-11-24',
  dueDate: '2026-12-08',
  currency: 'PKR',
  taxRate: 18,
  taxLabel: 'Sales Tax',
  seller: {
    name: 'Crescent Garments',
    address: 'Plot 12, Industrial Area\nFaisalabad',
    phone: '0300-1234567',
    email: 'sales@example.com',
    ntn: '1234567-8',
    strn: '32-77-8761-234-56',
  },
  buyer: {
    name: 'Ahmed Textiles',
    address: 'Shop 4, Saddar\nKarachi',
    phone: '0321-7654321',
  },
  items: [
    { description: 'Cotton T-shirt, white (M)', quantity: 200, unit: 'pcs', unitPrice: 850 },
    { description: 'Denim jeans, blue (32)', quantity: 120, unit: 'pcs', unitPrice: 1950, discount: 5 },
    { description: 'Printing charges', quantity: 1, unitPrice: 15000, taxRate: 0 },
  ],
  discount: { type: 'amount', value: 10000 },
  shipping: 6500,
  amountPaid: 150000,
  payment: {
    bank: 'Meezan Bank',
    accountTitle: 'Crescent Garments',
    iban: 'PK36 SCBL 0000 0011 2345 6702',
  },
  notes: 'Goods once sold will be exchanged within 7 days with the invoice.',
  terms: 'Balance payable within 14 days.',
};
