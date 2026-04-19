import { describe, it, expect } from 'vitest'
import { parseCSV, findDuplicates } from './csv-parser'

describe('parseCSV — CBA format', () => {
  const csv = [
    'Transaction Date,Narration,Amount,Balance',
    '15/07/2025,EFTPOS BP CONNECT,-85.50,1234.50',
    '16/07/2025,SALARY SEQ AUTOMOTIVE,2500.00,3734.50',
  ].join('\n')

  it('detects CBA from headers', () => {
    expect(parseCSV(csv).bankName).toBe('CBA')
  })

  it('parses two rows', () => {
    expect(parseCSV(csv).transactions).toHaveLength(2)
  })

  it('converts DD/MM/YYYY to ISO YYYY-MM-DD', () => {
    const { transactions } = parseCSV(csv)
    expect(transactions[0].date).toBe('2025-07-15')
  })

  it('parses negative amounts (debits)', () => {
    expect(parseCSV(csv).transactions[0].amount).toBe(-85.5)
  })

  it('parses positive amounts (credits)', () => {
    expect(parseCSV(csv).transactions[1].amount).toBe(2500)
  })
})

describe('parseCSV — NAB format', () => {
  const csv = [
    'Transaction Date,Transaction Details,Amount,Balance',
    '01/08/2025,AMPOL FUEL,-95.00,500.00',
  ].join('\n')

  it('detects NAB', () => {
    expect(parseCSV(csv).bankName).toBe('NAB')
  })

  it('extracts description from Transaction Details', () => {
    expect(parseCSV(csv).transactions[0].description).toBe('AMPOL FUEL')
  })
})

describe('parseCSV — Suncorp format', () => {
  const csv = [
    'Effective Date,Transaction Details,Amount,Balance',
    '20/07/2025,WITHDRAWAL CALTEX,-65.00,400.00',
    '21/07/2025,DEPOSIT SEQ AUTOMOTIVE,1500.00,1900.00',
  ].join('\n')

  it('detects Suncorp (effective date + transaction details)', () => {
    expect(parseCSV(csv).bankName).toBe('Suncorp')
  })

  it('parses both rows', () => {
    expect(parseCSV(csv).transactions).toHaveLength(2)
  })

  it('converts DD/MM/YYYY from Effective Date', () => {
    expect(parseCSV(csv).transactions[0].date).toBe('2025-07-20')
  })

  it('preserves negative amounts', () => {
    expect(parseCSV(csv).transactions[0].amount).toBe(-65)
  })
})

describe('parseCSV — Westpac format (split debit/credit columns)', () => {
  const csv = [
    'Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance',
    'Cheque,15/07/2025,SHELL,50.00,,1000',
    'Cheque,16/07/2025,REFUND,,25.00,1025',
  ].join('\n')

  it('detects Westpac', () => {
    expect(parseCSV(csv).bankName).toBe('Westpac')
  })

  it('converts debit to negative', () => {
    expect(parseCSV(csv).transactions[0].amount).toBe(-50)
  })

  it('treats credit column as positive', () => {
    expect(parseCSV(csv).transactions[1].amount).toBe(25)
  })
})

describe('parseCSV — Generic fallback', () => {
  const csv = [
    'Date,Description,Amount',
    '2025-07-15,COFFEE SHOP,-5.50',
  ].join('\n')

  it('falls back to Generic for unknown formats', () => {
    expect(parseCSV(csv).bankName).toBe('Generic')
  })

  it('strips $ and , from amounts', () => {
    const csv2 = [
      'Date,Description,Amount',
      '2025-07-15,PURCHASE,"-$1,234.56"',
    ].join('\n')
    expect(parseCSV(csv2).transactions[0].amount).toBe(-1234.56)
  })

  it('accepts ISO date format directly', () => {
    expect(parseCSV(csv).transactions[0].date).toBe('2025-07-15')
  })
})

describe('parseCSV — date parsing edge cases', () => {
  it('parses DD Mon YYYY format', () => {
    const csv = [
      'Date,Description,Amount',
      '15 Jul 2025,Test,100',
    ].join('\n')
    expect(parseCSV(csv).transactions[0].date).toBe('2025-07-15')
  })

  it('handles dash separator in DD-MM-YYYY', () => {
    const csv = [
      'Date,Description,Amount',
      '15-07-2025,Test,100',
    ].join('\n')
    expect(parseCSV(csv).transactions[0].date).toBe('2025-07-15')
  })

  it('rejects unparseable dates (drops the row)', () => {
    const csv = [
      'Date,Description,Amount',
      'garbage,Test,100',
      '2025-07-15,Valid,50',
    ].join('\n')
    expect(parseCSV(csv).transactions).toHaveLength(1)
  })
})

describe('findDuplicates', () => {
  const existing = [
    { date: '2025-07-15', amount: -50, description: 'BP' },
    { date: '2025-07-16', amount: 100, description: 'REFUND' },
  ]

  it('flags matching rows', () => {
    const newTxns = [
      { date: '2025-07-15', amount: -50, description: 'BP', balance: null },
      { date: '2025-07-17', amount: -20, description: 'NEW', balance: null },
    ]
    const dupes = findDuplicates(newTxns, existing)
    expect(dupes.has(0)).toBe(true)
    expect(dupes.has(1)).toBe(false)
  })

  it('requires exact match on all three fields', () => {
    const newTxns = [
      { date: '2025-07-15', amount: -51, description: 'BP', balance: null }, // amount differs
    ]
    expect(findDuplicates(newTxns, existing).size).toBe(0)
  })

  it('returns empty set when no existing rows', () => {
    const newTxns = [{ date: '2025-07-15', amount: -50, description: 'BP', balance: null }]
    expect(findDuplicates(newTxns, []).size).toBe(0)
  })
})
