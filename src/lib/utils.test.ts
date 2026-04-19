import { describe, it, expect } from 'vitest'
import {
  calculateGST,
  generateInvoiceNumber,
  getCurrentFY,
  getFYDates,
  formatCurrency,
} from './utils'

describe('calculateGST (1/11th method)', () => {
  it('returns 0 for 0', () => {
    expect(calculateGST(0)).toBe(0)
  })

  it('returns 0.00 for 0.01 (rounds down cleanly)', () => {
    expect(calculateGST(0.01)).toBe(0)
  })

  it('returns 0.01 for 0.11 (the smallest unit that yields 1c)', () => {
    expect(calculateGST(0.11)).toBe(0.01)
  })

  it('returns 10 for 110', () => {
    expect(calculateGST(110)).toBe(10)
  })

  it('returns 100 for 1100', () => {
    expect(calculateGST(1100)).toBe(100)
  })

  it('rounds to 2 decimal places', () => {
    // 100 / 11 = 9.0909... → rounds to 9.09
    expect(calculateGST(100)).toBe(9.09)
  })

  it('handles 99.99', () => {
    // 99.99 / 11 = 9.0900 → 9.09
    expect(calculateGST(99.99)).toBe(9.09)
  })

  it('handles $1,000,000 invoice', () => {
    // 1000000/11 = 90909.0909... → 90909.09
    expect(calculateGST(1000000)).toBe(90909.09)
  })

  it('handles negative amounts (refunds/credit notes)', () => {
    expect(calculateGST(-110)).toBe(-10)
  })

  it('round-trips via ×1.1 (GST-exclusive to GST-inclusive to GST back)', () => {
    const exGst = 100
    const incGst = exGst * 1.1 // 110 (but with float fuzz)
    const gst = calculateGST(incGst)
    expect(gst).toBe(10)
    // NOTE: incGst - gst has float fuzz (100.00000000000001).
    // This is a known P0-3 issue — float arithmetic on money.
    // Real code must round after subtraction.
    expect(incGst - gst).toBeCloseTo(100, 2)
  })

  it('round-trips via ×1.1 at larger dollar amount', () => {
    const exGst = 4545.45
    const incGst = Math.round(exGst * 1.1 * 100) / 100 // 4999.995 → 5000.00
    const gst = calculateGST(incGst)
    // GST of 5000 = 5000/11 = 454.5454... → 454.55
    expect(gst).toBe(454.55)
  })
})

describe('generateInvoiceNumber', () => {
  it('pads to 6 digits', () => {
    expect(generateInvoiceNumber('INV', 1)).toBe('INV-000001')
  })

  it('does not truncate at 7+ digits', () => {
    expect(generateInvoiceNumber('INV', 1234567)).toBe('INV-1234567')
  })

  it('continues from Zoho sequence (462)', () => {
    expect(generateInvoiceNumber('INV', 462)).toBe('INV-000462')
  })

  it('handles custom prefix', () => {
    expect(generateInvoiceNumber('SEQ', 100)).toBe('SEQ-000100')
  })

  it('handles 0', () => {
    expect(generateInvoiceNumber('INV', 0)).toBe('INV-000000')
  })
})

describe('getCurrentFY', () => {
  it('returns a string in FY25-26 style', () => {
    const fy = getCurrentFY()
    expect(fy).toMatch(/^FY\d{4}-\d{2}$/)
  })
})

describe('getFYDates', () => {
  it('July 1 → June 30 for a given year', () => {
    const { start, end } = getFYDates(2025)
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(6) // July (0-indexed)
    expect(start.getDate()).toBe(1)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(5) // June
    expect(end.getDate()).toBe(30)
  })

  it('handles FY2024-25', () => {
    const { start, end } = getFYDates(2024)
    expect(start.getFullYear()).toBe(2024)
    expect(end.getFullYear()).toBe(2025)
  })
})

describe('formatCurrency', () => {
  it('formats positive AUD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('wraps negatives in parentheses (accounting style)', () => {
    expect(formatCurrency(-1234.56)).toBe('($1,234.56)')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
})
