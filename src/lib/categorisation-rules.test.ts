import { describe, it, expect } from 'vitest'
import { categoriseByRule, categoriseBulk } from './categorisation-rules'

describe('categoriseByRule — fuel', () => {
  it('matches BP with 85% business use', () => {
    const m = categoriseByRule('EFTPOS BP CONNECT PULLENVALE')
    expect(m?.account_code).toBe('6-1010')
    expect(m?.business_use_pct).toBe(85)
    expect(m?.tax_code).toBe('GST')
  })

  it('matches AMPOL (uppercase)', () => {
    expect(categoriseByRule('AMPOL FOREST LAKE')?.account_code).toBe('6-1010')
  })

  it('matches Caltex (title case)', () => {
    expect(categoriseByRule('Caltex Woolworths')?.account_code).toBe('6-1010')
  })

  it('matches Shell', () => {
    expect(categoriseByRule('SHELL COLES EXPRESS')?.account_code).toBe('6-1010')
  })
})

describe('categoriseByRule — ride-share', () => {
  it('matches Uber at 100%', () => {
    const m = categoriseByRule('UBER *TRIP HELP.UBER.COM')
    expect(m?.account_code).toBe('6-1020')
    expect(m?.business_use_pct).toBe(100)
  })

  it('matches DiDi', () => {
    expect(categoriseByRule('DIDI AU')?.account_code).toBe('6-1020')
  })
})

describe('categoriseByRule — phone/internet (85%)', () => {
  it('matches Telstra', () => {
    const m = categoriseByRule('TELSTRA PRE-PAID RECHARGE')
    expect(m?.business_use_pct).toBe(85)
    expect(m?.account_code).toBe('6-2010')
  })

  it('matches Optus', () => {
    expect(categoriseByRule('OPTUS MOBILE')?.business_use_pct).toBe(85)
  })
})

describe('categoriseByRule — subscriptions', () => {
  it('matches AUTOGRAB at 100%', () => {
    const m = categoriseByRule('AUTOGRAB PTY LTD SUBSCRIPTION')
    expect(m?.business_use_pct).toBe(100)
    expect(m?.account_code).toBe('6-3010')
  })

  it('matches OpenAI', () => {
    expect(categoriseByRule('OPENAI *API USAGE')?.account_code).toBe('6-3010')
  })
})

describe('categoriseByRule — streaming (30%)', () => {
  it('Netflix → 30% business use', () => {
    const m = categoriseByRule('NETFLIX.COM AUS')
    expect(m?.business_use_pct).toBe(30)
    expect(m?.confidence).toBeLessThan(0.9)
  })

  it('Spotify → 30%', () => {
    expect(categoriseByRule('SPOTIFY P*SUBSCRIPTION')?.business_use_pct).toBe(30)
  })

  it('YouTube Premium → 30%', () => {
    expect(categoriseByRule('GOOGLE *YOUTUBE PREMIUM')?.business_use_pct).toBe(30)
  })
})

describe('categoriseByRule — income (SEQ)', () => {
  it('matches SEQ Automotive deposit', () => {
    const m = categoriseByRule('DEPOSIT SEQ AUTOMOTIVE')
    expect(m?.account_code).toBe('4-1010')
    expect(m?.tax_code).toBe('GST')
    expect(m?.confidence).toBeGreaterThanOrEqual(0.95)
  })
})

describe('categoriseByRule — tolls (100%)', () => {
  it('matches Linkt', () => {
    expect(categoriseByRule('LINKT MELBOURNE')?.business_use_pct).toBe(100)
  })
})

describe('categoriseByRule — no match', () => {
  it('returns null for unknown merchant', () => {
    expect(categoriseByRule('RANDOM UNKNOWN MERCHANT XYZ')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(categoriseByRule('')).toBeNull()
  })
})

describe('categoriseByRule — rule specificity', () => {
  it('matched_keyword is populated', () => {
    const m = categoriseByRule('BP CONNECT PULLENVALE')
    expect(m?.matched_keyword).toBeTruthy()
  })

  it('confidence values are between 0 and 1', () => {
    const tests = ['BP ', 'UBER', 'NETFLIX', 'TELSTRA', 'SEQ AUTOMOTIVE']
    for (const t of tests) {
      const m = categoriseByRule(t)
      expect(m?.confidence).toBeGreaterThan(0)
      expect(m?.confidence).toBeLessThanOrEqual(1)
    }
  })
})

describe('categoriseBulk', () => {
  it('deduplicates identical descriptions', () => {
    const result = categoriseBulk([
      'BP CONNECT',
      'BP CONNECT',
      'NETFLIX.COM',
    ])
    expect(result.size).toBe(2)
  })

  it('handles mix of matches and non-matches', () => {
    const result = categoriseBulk(['UBER *TRIP', 'UNKNOWN_MERCHANT'])
    expect(result.get('UBER *TRIP')?.account_code).toBe('6-1020')
    expect(result.get('UNKNOWN_MERCHANT')).toBeNull()
  })
})
