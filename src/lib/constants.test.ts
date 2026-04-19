import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getCurrentQuarter, getFYYear, getEOFYDate } from './constants'

describe('getCurrentQuarter — ATO quarter boundaries (Australia)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('July 1 → Q1 (Jul-Sep)', () => {
    vi.setSystemTime(new Date(2025, 6, 1)) // 1 Jul 2025
    const q = getCurrentQuarter()
    expect(q.label).toBe('Q1')
    expect(q.start.getMonth()).toBe(6)
    expect(q.end.getMonth()).toBe(8)
  })

  it('September 30 → Q1 (last day of Q1)', () => {
    vi.setSystemTime(new Date(2025, 8, 30))
    expect(getCurrentQuarter().label).toBe('Q1')
  })

  it('October 1 → Q2 (Oct-Dec)', () => {
    vi.setSystemTime(new Date(2025, 9, 1))
    expect(getCurrentQuarter().label).toBe('Q2')
  })

  it('December 31 → Q2', () => {
    vi.setSystemTime(new Date(2025, 11, 31))
    expect(getCurrentQuarter().label).toBe('Q2')
  })

  it('January 1 → Q3 (Jan-Mar)', () => {
    vi.setSystemTime(new Date(2026, 0, 1))
    expect(getCurrentQuarter().label).toBe('Q3')
  })

  it('March 31 → Q3', () => {
    vi.setSystemTime(new Date(2026, 2, 31))
    expect(getCurrentQuarter().label).toBe('Q3')
  })

  it('April 1 → Q4 (Apr-Jun)', () => {
    vi.setSystemTime(new Date(2026, 3, 1))
    expect(getCurrentQuarter().label).toBe('Q4')
  })

  it('June 30 → Q4 (last day of FY)', () => {
    vi.setSystemTime(new Date(2026, 5, 30))
    expect(getCurrentQuarter().label).toBe('Q4')
  })

  it('Q3 end date is March 31 (not Feb, not Apr 1)', () => {
    vi.setSystemTime(new Date(2026, 1, 15)) // Feb 15
    const q = getCurrentQuarter()
    expect(q.label).toBe('Q3')
    expect(q.end.getMonth()).toBe(2) // March
    expect(q.end.getDate()).toBe(31)
  })
})

describe('getFYYear — financial year flip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('June 30 → prior FY year', () => {
    vi.setSystemTime(new Date(2026, 5, 30))
    expect(getFYYear()).toBe(2025)
  })

  it('July 1 → new FY year', () => {
    vi.setSystemTime(new Date(2026, 6, 1))
    expect(getFYYear()).toBe(2026)
  })

  it('December 31 → still FY of the prior July', () => {
    vi.setSystemTime(new Date(2025, 11, 31))
    expect(getFYYear()).toBe(2025)
  })
})

describe('getEOFYDate', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns June 30 of the FY end year', () => {
    vi.setSystemTime(new Date(2026, 2, 1)) // Mar 1 2026 → FY25-26
    const eofy = getEOFYDate()
    expect(eofy.getFullYear()).toBe(2026)
    expect(eofy.getMonth()).toBe(5) // June
    expect(eofy.getDate()).toBe(30)
  })

  it('July 1 2026 → EOFY is June 30 2027', () => {
    vi.setSystemTime(new Date(2026, 6, 1))
    const eofy = getEOFYDate()
    expect(eofy.getFullYear()).toBe(2027)
    expect(eofy.getMonth()).toBe(5)
  })
})
