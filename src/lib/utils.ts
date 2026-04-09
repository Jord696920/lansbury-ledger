import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format as AUD currency: $1,234.56 or ($1,234.56) for negatives */
export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  return amount < 0 ? `(${formatted})` : formatted
}

/** Format date as DD MMM YYYY */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy')
}

/** Calculate GST using 1/11th method */
export function calculateGST(gstInclusiveAmount: number): number {
  return Math.round((gstInclusiveAmount / 11) * 100) / 100
}

/** Get current Australian financial year label */
export function getCurrentFY(): string {
  const now = new Date()
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `FY${year}-${(year + 1).toString().slice(2)}`
}

/** Get FY start/end dates */
export function getFYDates(fyStartYear?: number) {
  const now = new Date()
  const year = fyStartYear ?? (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1)
  return {
    start: new Date(year, 6, 1), // July 1
    end: new Date(year + 1, 5, 30), // June 30
  }
}

/** Generate invoice number: INV-000462 (6-digit zero-padded, matches Zoho sequence) */
export function generateInvoiceNumber(prefix: string, nextNumber: number): string {
  return `${prefix}-${nextNumber.toString().padStart(6, '0')}`
}
