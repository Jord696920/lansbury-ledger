import { describe, it, expect } from 'vitest'
import { calculateIncomeTax, calculateSBITO } from './queries'
import { TAX_BRACKETS_FY2526, SBITO_CAP } from './constants'

describe('calculateIncomeTax — FY2025-26 ATO individual rates', () => {
  it('returns 0 for 0 income', () => {
    expect(calculateIncomeTax(0)).toBe(0)
  })

  it('returns 0 for negative income', () => {
    expect(calculateIncomeTax(-100)).toBe(0)
  })

  it('returns 0 at tax-free threshold $18,200', () => {
    expect(calculateIncomeTax(18200)).toBe(0)
  })

  it('first bracket: $18,201 → $0.16', () => {
    // base 0, min 18201, rate 0.16 → (18201 - 18201 + 1) * 0.16 = 0.16
    expect(calculateIncomeTax(18201)).toBeCloseTo(0.16, 2)
  })

  it('$30,000 → ~$1,888.16', () => {
    // (30000 - 18201 + 1) * 0.16 = 11800 * 0.16 = 1888
    expect(calculateIncomeTax(30000)).toBeCloseTo(1888, 2)
  })

  it('$45,000 (top of 16% bracket) → $4,288', () => {
    // (45000 - 18201 + 1) * 0.16 = 26800 * 0.16 = 4288
    expect(calculateIncomeTax(45000)).toBeCloseTo(4288, 2)
  })

  it('$45,001 (first dollar of 30% bracket) → $4,288.30', () => {
    // base 4288 + (45001 - 45001 + 1) * 0.30 = 4288.30
    expect(calculateIncomeTax(45001)).toBeCloseTo(4288.3, 2)
  })

  it('$63,833 (Jordan actual FY24-25 taxable income) approximates $9,937.90', () => {
    // Note: this test uses FY25-26 brackets; FY24-25 had different brackets.
    // Under FY25-26: 4288 + (63833 - 45001 + 1) * 0.30 = 4288 + 18833*0.30 = 4288 + 5649.9 = 9937.9
    expect(calculateIncomeTax(63833)).toBeCloseTo(9937.9, 2)
  })

  it('$135,000 (top of 30% bracket) → $31,288', () => {
    // 4288 + (135000 - 45001 + 1) * 0.30 = 4288 + 90000 * 0.30 = 4288 + 27000 = 31288
    expect(calculateIncomeTax(135000)).toBeCloseTo(31288, 2)
  })

  it('$135,001 (first dollar of 37% bracket) → $31,288.37', () => {
    expect(calculateIncomeTax(135001)).toBeCloseTo(31288.37, 2)
  })

  it('$190,000 (top of 37% bracket) → $51,638', () => {
    // 31288 + (190000 - 135001 + 1) * 0.37 = 31288 + 55000 * 0.37 = 31288 + 20350 = 51638
    expect(calculateIncomeTax(190000)).toBeCloseTo(51638, 2)
  })

  it('$190,001 (first dollar of top bracket) → $51,638.45', () => {
    expect(calculateIncomeTax(190001)).toBeCloseTo(51638.45, 2)
  })

  it('$500,000 → $191,138.45', () => {
    // 51638 + (500000 - 190001 + 1) * 0.45 = 51638 + 310000 * 0.45 = 51638 + 139500 = 191138
    expect(calculateIncomeTax(500000)).toBeCloseTo(191138, 2)
  })

  it('is monotonic: higher income → higher tax', () => {
    const incomes = [0, 10000, 20000, 45000, 100000, 135000, 190000, 500000]
    for (let i = 1; i < incomes.length; i++) {
      expect(calculateIncomeTax(incomes[i])).toBeGreaterThanOrEqual(
        calculateIncomeTax(incomes[i - 1])
      )
    }
  })
})

describe('calculateSBITO — Small Business Income Tax Offset', () => {
  it('returns 0 for 0 tax', () => {
    expect(calculateSBITO(0)).toBe(0)
  })

  it('returns 8% of tax below the cap', () => {
    expect(calculateSBITO(1000)).toBe(80)
  })

  it('caps at $1,000', () => {
    expect(calculateSBITO(100000)).toBe(SBITO_CAP)
  })

  it('exactly at cap threshold (tax of $12,500 → 8% = $1,000)', () => {
    expect(calculateSBITO(12500)).toBe(1000)
  })

  it('$12,501 tax → still capped at $1,000', () => {
    expect(calculateSBITO(12501)).toBe(1000)
  })

  it('$12,499 tax → $999.92 (just under cap)', () => {
    expect(calculateSBITO(12499)).toBeCloseTo(999.92, 2)
  })
})

describe('TAX_BRACKETS_FY2526 — bracket table integrity', () => {
  it('has 5 brackets', () => {
    expect(TAX_BRACKETS_FY2526.length).toBe(5)
  })

  it('brackets are contiguous (each min = prior max + 1)', () => {
    for (let i = 1; i < TAX_BRACKETS_FY2526.length; i++) {
      const prev = TAX_BRACKETS_FY2526[i - 1]
      const curr = TAX_BRACKETS_FY2526[i]
      expect(curr.min).toBe(prev.max + 1)
    }
  })

  it('first bracket starts at $0 (not $1)', () => {
    expect(TAX_BRACKETS_FY2526[0].min).toBe(0)
  })

  it('tax-free threshold is $18,200', () => {
    expect(TAX_BRACKETS_FY2526[0].max).toBe(18200)
    expect(TAX_BRACKETS_FY2526[0].rate).toBe(0)
  })

  it('top bracket rate is 45%', () => {
    const top = TAX_BRACKETS_FY2526[TAX_BRACKETS_FY2526.length - 1]
    expect(top.rate).toBe(0.45)
    expect(top.max).toBe(Infinity)
  })

  it('bracket bases match cumulative calculation', () => {
    // Verify each `base` equals the tax at min-1 using the lower brackets.
    // base of bracket N = sum over all lower brackets of ((lowMax - lowMin + 1) * lowRate)
    for (let i = 0; i < TAX_BRACKETS_FY2526.length; i++) {
      let expected = 0
      for (let j = 0; j < i; j++) {
        const b = TAX_BRACKETS_FY2526[j]
        expected += (b.max - b.min + 1) * b.rate
      }
      expect(TAX_BRACKETS_FY2526[i].base).toBeCloseTo(expected, 2)
    }
  })
})
