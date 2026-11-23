// Type definitions for invoice-kit

export interface Party {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  ntn?: string;
  strn?: string;
  /** data:image/...;base64 or an https:// URL (seller only) */
  logo?: string;
}

export interface InvoiceItem {
  description: string;
  quantity?: number | string;
  unit?: string;
  unitPrice: number | string;
  /** Percent, 0-100 */
  discount?: number | string;
  /** Percent; defaults to Invoice.taxRate */
  taxRate?: number | string;
}

export interface Invoice {
  number?: string;
  /** YYYY-MM-DD */
  date?: string;
  dueDate?: string;
  reference?: string;
  /** Default 'PKR' */
  currency?: string;
  /** Default tax % for items, e.g. 18 */
  taxRate?: number;
  /** Default 'Sales Tax' */
  taxLabel?: string;
  seller?: Party;
  buyer?: Party;
  items: InvoiceItem[];
  discount?: { type: 'percent' | 'amount'; value: number };
  shipping?: number;
  amountPaid?: number;
  payment?: { bank?: string; accountTitle?: string; accountNumber?: string; iban?: string; other?: string };
  notes?: string;
  terms?: string;
  /** Overrides "Invoice" / "Sales Tax Invoice" */
  title?: string;
  /** Hex colour, e.g. #0e6e6a */
  accentColor?: string;
  /** Footer text, or false to hide */
  footer?: string | false;
}

export interface CalculatedLine {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  gross: number;
  lineDiscount: number;
  net: number;
  invoiceDiscountShare: number;
  taxable: number;
  tax: number;
  total: number;
  amount: number;
}

export interface CalculatedInvoice {
  currency: string;
  lines: CalculatedLine[];
  subtotal: number;
  lineDiscounts: number;
  invoiceDiscount: number;
  totalDiscount: number;
  taxableAmount: number;
  taxes: Array<{ rate: number; taxable: number; tax: number }>;
  totalTax: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  words: { english: string; urdu: string | null };
}

export function calculateInvoice(invoice: Invoice): CalculatedInvoice;
export function renderInvoiceHTML(invoice: Invoice, options?: { urduWords?: boolean }): string;
export function nextInvoiceNumber(previous: string): string;
export function totalInWords(total: number, currency?: string): { english: string; urdu: string | null };
export function formatInvoiceDate(value: string): string;
export function round2(n: number): number;
export const exampleInvoice: Invoice;
