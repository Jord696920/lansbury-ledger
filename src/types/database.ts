// Lansbury Ledger — Database Types

export type AccountType = 'income' | 'expense' | 'asset' | 'liability' | 'equity'
export type TaxCode = 'GST' | 'GST-Free' | 'Input Taxed' | 'Capital' | 'N/A' | 'FTC'
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'
export type DepreciationMethod = 'instant_writeoff' | 'prime_cost' | 'diminishing_value'
export type BASStatus = 'open' | 'prepared' | 'lodged' | 'paid'
export type ComplianceStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed'
export type ComplianceEventType = 'bas' | 'tax_return' | 'super' | 'payg_variation' | 'other'
export type AnomalySeverity = 'info' | 'warning' | 'critical'
export type GSTMethod = 'cash' | 'accrual'
export type HomeOfficeMethod = 'actual_cost' | 'fixed_rate'
export type VehicleMethod = 'cents_per_km' | 'logbook'

export interface Client {
  id: string
  name: string
  abn: string | null
  licence_number: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postcode: string | null
  country: string
  email: string | null
  phone: string | null
  contact_person: string | null
  is_default: boolean
  created_at: string
}

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  tax_code: TaxCode
  parent_id: string | null
  business_use_pct: number | null
  ato_label: string | null
  is_active: boolean
  sort_order: number
}

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  balance: number | null
  account_id: string | null
  gst_amount: number | null
  business_use_pct: number | null
  is_personal: boolean
  is_reviewed: boolean
  is_reconciled: boolean
  receipt_url: string | null
  notes: string | null
  ai_category_suggestion: string | null
  ai_confidence: number | null
  source_file: string | null
  import_batch_id: string | null
  created_at: string
  // Joined
  account?: Account
}

export interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_abn: string | null
  client_email: string | null
  client_address: string | null
  issue_date: string
  due_date: string
  status: InvoiceStatus
  subtotal: number
  gst_amount: number
  total: number
  payment_date: string | null
  payment_reference: string | null
  notes: string | null
  created_at: string
  // Joined
  lines?: InvoiceLine[]
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  gst_amount: number
  total: number
  account_id: string | null
}

export interface Asset {
  id: string
  name: string
  description: string | null
  purchase_date: string
  purchase_price: number
  current_value: number
  depreciation_method: DepreciationMethod
  effective_life_years: number | null
  transaction_id: string | null
  is_disposed: boolean
  disposal_date: string | null
  disposal_amount: number | null
}

export interface BASPeriod {
  id: string
  period_label: string
  start_date: string
  end_date: string
  status: BASStatus
  gst_collected: number
  gst_credits: number
  fuel_tax_credits: number
  net_gst: number
  payg_instalment: number
  total_payable: number
  lodgement_date: string | null
  payment_date: string | null
}

export interface DeductionRule {
  id: string
  category: string
  description: string
  ato_ruling: string | null
  max_claim: string | null
  conditions: string | null
  business_use_required: boolean
  substantiation_required: string | null
  is_grey_area: boolean
}

export interface ComplianceEvent {
  id: string
  title: string
  description: string | null
  due_date: string
  status: ComplianceStatus
  event_type: ComplianceEventType
  reminder_days_before: number
}

export interface Anomaly {
  id: string
  transaction_id: string | null
  anomaly_type: string
  description: string
  severity: AnomalySeverity
  is_dismissed: boolean
  created_at: string
}

export interface HistoricalPeriod {
  id: string
  period_type: 'annual' | 'monthly'
  period_label: string
  start_date: string
  end_date: string
  financial_year: string
  income: number
  expenses: number
  net_profit: number
  source: string
  notes: string | null
  created_at: string
}

export interface HistoricalExpenseCategory {
  id: string
  financial_year: string
  category: string
  amount: number
  account_code: string | null
}

export type ClaimStatus = 'open' | 'pending_settlement' | 'settled' | 'closed'

export interface ClaimStageEntry {
  stage: string
  date: string
  note?: string
}

export interface Claim {
  id: string
  claim_name: string
  reference: string | null
  status: ClaimStatus
  total_claimed: number | null
  total_received: number
  components: Record<string, number> | null
  notes: string | null
  current_stage: string
  stage_history: ClaimStageEntry[]
  next_checkin_date: string | null
  received_date: string | null
  created_at: string
}

export interface BusinessProfile {
  id: string
  business_name: string
  abn: string
  gst_registered: boolean
  gst_method: GSTMethod
  fy_start_month: number
  home_office_pct: number
  home_office_method: HomeOfficeMethod
  vehicle_method: VehicleMethod
  vehicle_business_pct: number
  phone_business_pct: number
  internet_business_pct: number
  streaming_business_pct: number
  utilities_business_pct: number
  meal_business_pct: number
  bank_name: string | null
  bank_bsb: string | null
  bank_account: string | null
  payment_terms_days: number
  invoice_prefix: string
  invoice_next_number: number
  logo_url: string | null
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string
  state: string
  postcode: string
  monthly_costs: HouseholdMonthlyCosts | null
}

export interface HouseholdMonthlyCosts {
  mortgage: number
  groceries: number
  utilities: number
  insurance: number
  subscriptions: number
  kids: number
  [key: string]: number
}
