import Papa from 'papaparse'

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  balance: number | null
}

interface BankFormat {
  name: string
  detect: (headers: string[]) => boolean
  parse: (row: Record<string, string>) => ParsedTransaction | null
}

const bankFormats: BankFormat[] = [
  {
    name: 'CBA',
    detect: (h) => h.some((c) => c.toLowerCase().includes('transaction date')) && h.some((c) => c.toLowerCase().includes('narration')),
    parse: (row) => {
      const date = parseDate(row['Transaction Date'] || row['Date'])
      const desc = row['Narration'] || row['Description'] || ''
      const amount = parseFloat(row['Amount'] || row['Debit/Credit'] || '0')
      const balance = parseFloat(row['Balance'] || '') || null
      if (!date || !desc) return null
      return { date, description: desc.trim(), amount, balance }
    },
  },
  {
    name: 'NAB',
    detect: (h) => h.some((c) => c.toLowerCase().includes('transaction date')) && h.some((c) => c.toLowerCase().includes('transaction details')),
    parse: (row) => {
      const date = parseDate(row['Transaction Date'] || row['Date'])
      const desc = row['Transaction Details'] || row['Description'] || ''
      const amount = parseFloat(row['Amount'] || '0')
      const balance = parseFloat(row['Balance'] || '') || null
      if (!date || !desc) return null
      return { date, description: desc.trim(), amount, balance }
    },
  },
  {
    name: 'Suncorp',
    detect: (h) => h.some((c) => c.toLowerCase().includes('effective date')) && h.some((c) => c.toLowerCase().includes('transaction details')),
    parse: (row) => {
      const date = parseDate(row['Effective Date'] || row['Date'])
      const desc = row['Transaction Details'] || row['Description'] || ''
      const amount = parseFloat(row['Amount'] || '0')
      const balance = parseFloat(row['Balance'] || '') || null
      if (!date || !desc) return null
      return { date, description: desc.trim(), amount, balance }
    },
  },
  {
    name: 'Westpac',
    detect: (h) => h.some((c) => c.toLowerCase().includes('bank account')) || h.some((c) => c.toLowerCase().includes('narrative')),
    parse: (row) => {
      const date = parseDate(row['Date'])
      const desc = row['Narrative'] || row['Description'] || ''
      const debit = parseFloat(row['Debit Amount'] || '0')
      const credit = parseFloat(row['Credit Amount'] || '0')
      const amount = credit > 0 ? credit : -debit
      const balance = parseFloat(row['Balance'] || '') || null
      if (!date || !desc) return null
      return { date, description: desc.trim(), amount, balance }
    },
  },
  {
    name: 'ANZ',
    detect: (h) => h.length >= 3 && !h[0], // ANZ often has no headers
    parse: (row) => {
      const values = Object.values(row)
      const date = parseDate(values[0])
      const desc = values[2] || values[1] || ''
      const amount = parseFloat(values[1]) || parseFloat(values[3]) || 0
      const balance = null
      if (!date) return null
      return { date, description: desc.trim(), amount, balance }
    },
  },
  {
    name: 'Generic',
    detect: () => true, // fallback
    parse: (row) => {
      const date = parseDate(row['Date'] || row['date'] || row['Transaction Date'] || Object.values(row)[0])
      const desc = row['Description'] || row['description'] || row['Narrative'] || row['Details'] || Object.values(row)[1] || ''
      const amountStr = row['Amount'] || row['amount'] || row['Debit/Credit'] || Object.values(row)[2] || '0'
      const amount = parseFloat(amountStr.replace(/[,$]/g, '')) || 0
      const balStr = row['Balance'] || row['balance'] || ''
      const balance = balStr ? parseFloat(balStr.replace(/[,$]/g, '')) || null : null
      if (!date) return null
      return { date, description: desc.trim(), amount, balance }
    },
  },
]

function parseDate(input: string | undefined): string | null {
  if (!input) return null
  const cleaned = input.trim()

  // DD/MM/YYYY
  const dmy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // YYYY-MM-DD
  const ymd = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) {
    const [, y, m, d] = ymd
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // DD Mon YYYY
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const dMonY = cleaned.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/)
  if (dMonY) {
    const [, d, mon, y] = dMonY
    const m = months[mon.toLowerCase()]
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`
  }

  return null
}

export function parseCSV(csvText: string): { transactions: ParsedTransaction[]; bankName: string; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields || []
  const errors: string[] = result.errors.map((e) => e.message)

  // Detect bank format
  const format = bankFormats.find((f) => f.detect(headers)) || bankFormats[bankFormats.length - 1]

  const transactions: ParsedTransaction[] = []
  for (const row of result.data) {
    const parsed = format.parse(row)
    if (parsed && parsed.date && parsed.description) {
      transactions.push(parsed)
    }
  }

  return { transactions, bankName: format.name, errors }
}

/** Check for duplicate transactions */
export function findDuplicates(
  newTxns: ParsedTransaction[],
  existing: { date: string; amount: number; description: string }[]
): Set<number> {
  const duplicateIndexes = new Set<number>()
  for (let i = 0; i < newTxns.length; i++) {
    const t = newTxns[i]
    const isDupe = existing.some(
      (e) => e.date === t.date && e.amount === t.amount && e.description === t.description
    )
    if (isDupe) duplicateIndexes.add(i)
  }
  return duplicateIndexes
}
