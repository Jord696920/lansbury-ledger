// Rule-based transaction categorisation for Jordan's spend patterns.
// Pure function — no DB calls, no network. Chart-of-accounts codes match
// src/data/chart-of-accounts seed (and are the codes returned by the AI route).

export type CategorisationSource = 'rule' | 'manual' | 'ai'

export interface CategoryMatch {
  account_code: string
  account_name: string
  business_use_pct: number
  tax_code: 'GST' | 'GST-Free' | 'Input Taxed' | 'N/A'
  confidence: number
  matched_keyword: string
}

interface Rule {
  keywords: string[]
  match: Omit<CategoryMatch, 'matched_keyword'>
}

// Order matters — more specific rules first (e.g. AMPOL before generic "FUEL").
const RULES: Rule[] = [
  // Fuel (85% business use per Jordan's established rate)
  {
    keywords: ['bp ', 'bp connect', 'ampol', 'caltex', 'shell', '7-eleven', 'united petroleum', 'mobil'],
    match: { account_code: '6-1010', account_name: 'Fuel & Oil', business_use_pct: 85, tax_code: 'GST', confidence: 0.9 },
  },
  // Ride-share inspections (100% business)
  {
    keywords: ['uber', 'didi', 'ola', 'shebah'],
    match: { account_code: '6-1020', account_name: 'Transport (Uber/DiDi)', business_use_pct: 100, tax_code: 'GST', confidence: 0.95 },
  },
  // Phone/Internet (85%)
  {
    keywords: ['telstra', 'optus', 'vodafone', 'tpg', 'aussie broadband', 'belong'],
    match: { account_code: '6-2010', account_name: 'Phone & Internet', business_use_pct: 85, tax_code: 'GST', confidence: 0.9 },
  },
  // Subscriptions (100% — AUTOGRAB, software)
  {
    keywords: ['autograb', 'lovable', 'openai', 'anthropic', 'github', 'siteground', 'godaddy'],
    match: { account_code: '6-3010', account_name: 'Software & Subscriptions', business_use_pct: 100, tax_code: 'GST', confidence: 0.95 },
  },
  // Streaming (30% market research)
  {
    keywords: ['netflix', 'stan', 'disney plus', 'disney+', 'spotify', 'youtube premium', 'binge', 'kayo', 'paramount'],
    match: { account_code: '6-3020', account_name: 'Streaming (Market Research)', business_use_pct: 30, tax_code: 'GST', confidence: 0.85 },
  },
  // Google Workspace
  {
    keywords: ['google workspace', 'google gsuite', 'google cloud'],
    match: { account_code: '6-3010', account_name: 'Software & Subscriptions', business_use_pct: 100, tax_code: 'GST', confidence: 0.9 },
  },
  // Rego / transfers (COGS — customer vehicles)
  {
    keywords: ['dept transport', 'qld transport', 'tmr qld', 'vicroads', 'service nsw rego', 'transport nsw'],
    match: { account_code: '6-1030', account_name: 'Rego & Transfers', business_use_pct: 100, tax_code: 'GST-Free', confidence: 0.85 },
  },
  // Insurance (85% vehicle)
  {
    keywords: ['aami', 'budget direct', 'nrma', 'racq', 'allianz', 'suncorp insurance'],
    match: { account_code: '6-4010', account_name: 'Insurance', business_use_pct: 85, tax_code: 'GST', confidence: 0.85 },
  },
  // Bank fees (100%)
  {
    keywords: ['monthly fee', 'account keeping', 'international transaction fee', 'overdrawn fee'],
    match: { account_code: '6-5010', account_name: 'Bank Fees', business_use_pct: 100, tax_code: 'Input Taxed', confidence: 0.9 },
  },
  // Tolls (100%)
  {
    keywords: ['linkt', 'e-toll', 'etoll', 'transurban', 'qld toll'],
    match: { account_code: '6-1040', account_name: 'Tolls & Parking', business_use_pct: 100, tax_code: 'GST', confidence: 0.9 },
  },
  // Parking
  {
    keywords: ['parking', 'wilson parking', 'secure parking', 'care park'],
    match: { account_code: '6-1040', account_name: 'Tolls & Parking', business_use_pct: 100, tax_code: 'GST', confidence: 0.8 },
  },
  // Meals (50% business-related)
  {
    keywords: ['mcdonald', 'hungry jack', 'kfc', 'subway', 'cafe', 'coffee'],
    match: { account_code: '6-6010', account_name: 'Meals', business_use_pct: 50, tax_code: 'GST', confidence: 0.6 },
  },
  // Primary client income
  {
    keywords: ['seq automotive', 'seq auto'],
    match: { account_code: '4-1010', account_name: 'Consulting Income', business_use_pct: 100, tax_code: 'GST', confidence: 0.98 },
  },
]

/**
 * Categorise a transaction using keyword rules.
 * Returns null if no rule matches — caller should fall back to AI or manual.
 */
export function categoriseByRule(description: string): CategoryMatch | null {
  if (!description) return null
  const hay = description.toLowerCase()
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (hay.includes(kw)) {
        return { ...rule.match, matched_keyword: kw }
      }
    }
  }
  return null
}

/** Bulk categorise — returns map from description to match (or null). */
export function categoriseBulk(descriptions: string[]): Map<string, CategoryMatch | null> {
  const out = new Map<string, CategoryMatch | null>()
  for (const d of descriptions) {
    if (!out.has(d)) out.set(d, categoriseByRule(d))
  }
  return out
}
