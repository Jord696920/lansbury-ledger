'use client'

import { useState, useEffect } from 'react'
import { getDashboardSummary, calculateIncomeTax, calculateSBITO } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { MetricCard } from '@/components/ui/metric-card'
import { Calculator, DollarSign, TrendingUp, Percent, Car, Zap } from 'lucide-react'
import { CENTS_PER_KM_RATE, CENTS_PER_KM_MAX, MEDICARE_LEVY_RATE, TAX_BRACKETS_FY2526, getEOFYDate } from '@/lib/constants'
import { AuditRiskScore } from '@/components/tax/audit-risk-score'
import { GhostDeductions } from '@/components/tax/ghost-deductions'
import type { BusinessProfile } from '@/types/database'

export default function TaxPage() {
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)
  const [deductions, setDeductions] = useState(0)
  const [taxableIncome, setTaxableIncome] = useState(0)
  const [estimatedTax, setEstimatedTax] = useState(0)
  const [sbito, setSbito] = useState(0)
  const [effectiveRate, setEffectiveRate] = useState(0)
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [noDeductionData, setNoDeductionData] = useState(false)

  // What If simulator
  const [assetPurchase, setAssetPurchase] = useState(0)
  const [superContribution, setSuperContribution] = useState(0)
  const [prepaidExpense, setPrepaidExpense] = useState(0)
  const [additionalIncome, setAdditionalIncome] = useState(0)

  // Vehicle method comparison
  const [estimatedKms, setEstimatedKms] = useState(25000)
  const [fuelCost, setFuelCost] = useState(0)
  const [regoCost, setRegoCost] = useState(0)
  const [insuranceCost, setInsuranceCost] = useState(0)
  const [repairsCost, setRepairsCost] = useState(0)
  const [depreciationCost, setDepreciationCost] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const summary = await getDashboardSummary()
      const { data: profileData } = await supabase.from('business_profile').select('*').limit(1).single()
      const bp = profileData as BusinessProfile | null

      setRevenue(summary.revenue)
      setDeductions(summary.expenses)
      setNoDeductionData(summary.expensesSource === 'none')
      setProfile(bp)

      const taxable = summary.revenue - summary.expenses
      setTaxableIncome(taxable)

      const tax = calculateIncomeTax(taxable)
      setEstimatedTax(tax)

      const sbitoAmount = calculateSBITO(tax)
      setSbito(sbitoAmount)

      setEffectiveRate(taxable > 0 ? ((tax - sbitoAmount) / taxable) * 100 : 0)

      // Load vehicle costs for comparison
      const { data: vehicleTxns } = await supabase
        .from('transactions')
        .select('amount, account:accounts(code)')
        .in('account_id', (await supabase.from('accounts').select('id').like('code', '6-10%')).data?.map((a) => a.id) || [])
        .eq('is_personal', false)

      if (vehicleTxns) {
        let fuel = 0, rego = 0, insurance = 0, repairs = 0, depreciation = 0
        for (const t of vehicleTxns) {
          const amt = Math.abs(t.amount)
          const acct = t.account as unknown as { code: string } | null
          const code = acct?.code
          switch (code) {
            case '6-1010': fuel += amt; break
            case '6-1020': rego += amt; insurance += amt * 0.5; break // Split estimate
            case '6-1030': repairs += amt; break
            case '6-1060': depreciation += amt; break
          }
        }
        setFuelCost(fuel)
        setRegoCost(rego)
        setInsuranceCost(insurance)
        setRepairsCost(repairs)
        setDepreciationCost(depreciation)
      }
    } catch (err) {
      console.error('Error loading tax data:', err)
    } finally {
      setLoading(false)
    }
  }

  // What If calculations
  const whatIfDeductions = deductions + assetPurchase + superContribution + prepaidExpense
  const whatIfTaxable = revenue + additionalIncome - whatIfDeductions
  const whatIfTax = calculateIncomeTax(whatIfTaxable)
  const whatIfSbito = calculateSBITO(whatIfTax)
  const taxSaving = (estimatedTax - sbito) - (whatIfTax - whatIfSbito)

  // Vehicle method comparison
  const businessPct = (profile?.vehicle_business_pct ?? 85) / 100
  const centsPerKmDeduction = Math.min(estimatedKms, CENTS_PER_KM_MAX) * CENTS_PER_KM_RATE * businessPct
  const logbookDeduction = (fuelCost + regoCost + insuranceCost + repairsCost + depreciationCost) * businessPct
  const vehicleMethodWinner = logbookDeduction > centsPerKmDeduction ? 'logbook' : 'cents_per_km'
  const vehicleSaving = Math.abs(logbookDeduction - centsPerKmDeduction)

  // Home office calculation
  const homeOfficePct = (profile?.home_office_pct ?? 5.05) / 100

  // EOFY countdown — dynamic
  const now = new Date()
  const eofy = getEOFYDate()
  const eofyDays = Math.max(0, Math.ceil((eofy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="hidden items-center justify-between lg:flex">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tax Position</h1>
          <p className="text-sm text-text-secondary">FY2025-26 estimated tax liability</p>
        </div>
        {eofyDays <= 90 && (
          <div className="rounded-lg border border-accent-red/20 bg-surface-red px-4 py-2 text-sm font-semibold text-accent-red">
            {eofyDays} days to EOFY
          </div>
        )}
      </div>

      {/* EOFY badge on mobile */}
      {eofyDays <= 90 && (
        <div className="rounded-lg border border-accent-red/20 bg-surface-red px-3 py-2 text-center text-xs font-semibold text-accent-red lg:hidden">
          {eofyDays} days to EOFY
        </div>
      )}

      {noDeductionData && (
        <div className="rounded-lg border border-accent-amber/30 bg-surface-amber px-3 py-2 text-xs text-text-primary">
          <span className="font-semibold">Worst-case estimate.</span> No transactions categorised yet — deductions read as $0, so tax shown is the maximum. Import bank CSVs in Settings → Bank Import for an accurate figure.
        </div>
      )}

      {/* Key Metrics: 2×2 mobile, 4 across desktop */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <MetricCard title="Income" value={revenue} icon={DollarSign} accent="green" loading={loading} />
        <MetricCard title="Deductions" value={deductions} icon={TrendingUp} accent="blue" loading={loading} />
        <MetricCard title="Taxable" value={taxableIncome} icon={Calculator} accent="amber" loading={loading} />
        <MetricCard title="Tax Payable" value={estimatedTax - sbito} icon={Percent} accent="red" loading={loading} />
      </div>

      {/* Tax Breakdown — stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-2">
        {/* Detailed Breakdown */}
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
          <h3 className="mb-4 text-sm font-semibold text-text-primary">Tax Calculation Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Gross Business Income</span>
              <span className="font-financial font-medium text-accent-green">{formatCurrency(revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Less: Allowable Deductions</span>
              <span className="font-financial font-medium text-accent-red">{formatCurrency(-deductions)}</span>
            </div>
            <div className="flex justify-between border-t border-border-subtle pt-2">
              <span className="font-medium text-text-primary">Net Taxable Income</span>
              <span className="font-financial font-bold text-text-primary">{formatCurrency(taxableIncome)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-text-secondary">Tax on Taxable Income</span>
              <span className="font-financial text-text-primary">{formatCurrency(estimatedTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Plus: Medicare Levy (2%)</span>
              <span className="font-financial text-accent-red">+{formatCurrency(taxableIncome * MEDICARE_LEVY_RATE)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-accent-green">Less: SB Income Tax Offset (s61-500)</span>
              <span className="font-financial text-accent-green">-{formatCurrency(sbito)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-border-subtle pt-2">
              <span className="font-semibold text-text-primary">NET TAX PAYABLE</span>
              <span className="font-financial text-lg font-bold text-accent-red">
                {formatCurrency(estimatedTax - sbito + taxableIncome * MEDICARE_LEVY_RATE)}
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-text-tertiary">Effective Tax Rate</span>
              <span className="font-financial text-text-secondary">{effectiveRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* What If Simulator */}
        <div className="rounded-2xl border border-border-subtle bg-surface-purple p-4 lg:p-5">
          <h3 className="mb-1 text-sm font-semibold text-text-primary">
            <Zap className="mb-0.5 mr-1.5 inline h-4 w-4 text-accent-purple" />
            What If Simulator
          </h3>
          <p className="mb-4 text-[11px] text-text-tertiary">See how changes affect your tax</p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Asset write-off</label>
              <input
                type="number"
                inputMode="decimal"
                value={assetPurchase || ''}
                onChange={(e) => setAssetPurchase(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-3 font-financial text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Super contribution</label>
              <input
                type="number"
                inputMode="decimal"
                value={superContribution || ''}
                onChange={(e) => setSuperContribution(Math.min(Number(e.target.value), 30000))}
                placeholder="0"
                max={30000}
                className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-3 font-financial text-sm text-text-primary outline-none focus:border-accent-purple"
              />
              <p className="mt-0.5 text-[10px] text-text-tertiary">Cap: $30,000</p>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Prepay expense</label>
              <input
                type="number"
                inputMode="decimal"
                value={prepaidExpense || ''}
                onChange={(e) => setPrepaidExpense(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-3 font-financial text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Additional income</label>
              <input
                type="number"
                inputMode="decimal"
                value={additionalIncome || ''}
                onChange={(e) => setAdditionalIncome(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-3 font-financial text-sm text-text-primary outline-none focus:border-accent-purple"
              />
            </div>
          </div>

          {/* Result */}
          {(assetPurchase > 0 || superContribution > 0 || prepaidExpense > 0 || additionalIncome > 0) && (
            <div className="mt-4 rounded-lg bg-bg-elevated p-3">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-text-secondary">New taxable income</span>
                <span className="font-financial font-medium text-text-primary">{formatCurrency(whatIfTaxable)}</span>
              </div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-text-secondary">New estimated tax</span>
                <span className="font-financial font-medium text-text-primary">{formatCurrency(whatIfTax - whatIfSbito)}</span>
              </div>
              <div className="flex justify-between border-t border-border-subtle pt-2 text-sm">
                <span className="font-semibold text-text-primary">
                  {taxSaving >= 0 ? 'Tax Saving' : 'Additional Tax'}
                </span>
                <span className={cn('font-financial font-bold', taxSaving >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                  {formatCurrency(Math.abs(taxSaving))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Method Comparison */}
      <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
        <h3 className="mb-1 text-sm font-semibold text-text-primary">
          <Car className="mb-0.5 mr-1.5 inline h-4 w-4 text-accent-blue" />
          Vehicle Expense Method Comparison
        </h3>
        <p className="mb-4 text-[11px] text-text-tertiary">Cents-per-km vs Logbook/Actual Cost (s28-25 ITAA 1997)</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Cents per KM */}
          <div className={cn(
            'rounded-lg border p-4',
            vehicleMethodWinner === 'cents_per_km' ? 'border-accent-green bg-surface-green' : 'border-border-subtle'
          )}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-primary">Cents per Km</h4>
              {vehicleMethodWinner === 'cents_per_km' && (
                <span className="rounded-full bg-accent-primary px-2 py-0.5 text-[10px] font-bold text-white">BETTER</span>
              )}
            </div>
            <div className="mb-3">
              <label className="text-xs text-text-tertiary">Estimated business KMs</label>
              <input
                type="number"
                value={estimatedKms}
                onChange={(e) => setEstimatedKms(Number(e.target.value))}
                className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 font-financial text-sm text-text-primary outline-none"
              />
              <p className="text-[10px] text-text-tertiary">Max 5,000 km claimable · Rate: 88c/km</p>
            </div>
            <p className="font-financial text-lg font-bold text-text-primary">{formatCurrency(centsPerKmDeduction)}</p>
          </div>

          {/* Logbook */}
          <div className={cn(
            'rounded-lg border p-4',
            vehicleMethodWinner === 'logbook' ? 'border-accent-green bg-surface-green' : 'border-border-subtle'
          )}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-primary">Logbook / Actual Cost</h4>
              {vehicleMethodWinner === 'logbook' && (
                <span className="rounded-full bg-accent-primary px-2 py-0.5 text-[10px] font-bold text-white">BETTER</span>
              )}
            </div>
            <div className="space-y-1 text-xs text-text-secondary">
              <div className="flex justify-between"><span>Fuel & Oil</span><span className="font-financial">{formatCurrency(fuelCost)}</span></div>
              <div className="flex justify-between"><span>Rego & Insurance</span><span className="font-financial">{formatCurrency(regoCost + insuranceCost)}</span></div>
              <div className="flex justify-between"><span>Repairs</span><span className="font-financial">{formatCurrency(repairsCost)}</span></div>
              <div className="flex justify-between"><span>Depreciation</span><span className="font-financial">{formatCurrency(depreciationCost)}</span></div>
              <div className="flex justify-between text-text-tertiary"><span>× Business Use ({(businessPct * 100).toFixed(0)}%)</span><span></span></div>
            </div>
            <p className="mt-2 font-financial text-lg font-bold text-text-primary">{formatCurrency(logbookDeduction)}</p>
          </div>
        </div>

        <p className="mt-3 text-xs text-accent-green">
          {vehicleMethodWinner === 'logbook' ? 'Logbook' : 'Cents per km'} method saves you <span className="font-financial">{formatCurrency(vehicleSaving)}</span> this year
        </p>
      </div>

      {/* Tax Bracket Visualisation */}
      <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm p-5">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Tax Bracket Position</h3>
        <div className="space-y-2">
          {TAX_BRACKETS_FY2526.map((bracket, i) => {
            const bracketMax = bracket.max === Infinity ? 250000 : bracket.max
            const bracketWidth = bracketMax - bracket.min
            const displayMax = bracket.max === Infinity ? '190,001+' : `$${bracket.max.toLocaleString()}`
            const isCurrentBracket = taxableIncome >= bracket.min && (taxableIncome <= bracket.max || bracket.max === Infinity)
            const fillPct = isCurrentBracket
              ? ((taxableIncome - bracket.min) / bracketWidth) * 100
              : taxableIncome > bracket.max ? 100 : 0

            // Distance to next bracket
            const toNext = isCurrentBracket && bracket.max !== Infinity
              ? bracket.max - taxableIncome
              : null

            const rateLabel = bracket.rate === 0 ? 'Nil' : `${(bracket.rate * 100).toFixed(0)}c`

            return (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className={cn('font-medium', isCurrentBracket ? 'text-text-primary' : 'text-text-tertiary')}>
                    ${bracket.min.toLocaleString()} — {displayMax}
                  </span>
                  <span className={cn('font-financial', isCurrentBracket ? 'text-accent-primary font-semibold' : 'text-text-tertiary')}>
                    {rateLabel}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      isCurrentBracket ? 'bg-accent-primary' : fillPct === 100 ? 'bg-accent-primary/30' : 'bg-transparent'
                    )}
                    style={{ width: `${Math.min(fillPct, 100)}%` }}
                  />
                  {isCurrentBracket && fillPct > 5 && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-text-primary"
                      style={{ left: `${Math.min(fillPct, 99)}%` }}
                    />
                  )}
                </div>
                {toNext != null && toNext > 0 && (
                  <p className="mt-0.5 text-[10px] text-accent-amber">
                    ${toNext.toLocaleString()} until {((TAX_BRACKETS_FY2526[i + 1]?.rate ?? 0) * 100).toFixed(0)}c bracket
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {taxableIncome > 0 && (
          <p className="mt-3 text-xs text-text-secondary">
            Your marginal rate: <span className="font-financial font-semibold text-text-primary">
              {(() => {
                for (const b of TAX_BRACKETS_FY2526) {
                  if (taxableIncome <= b.max) return `${(b.rate * 100).toFixed(0)}c per $1`
                }
                return '45c per $1'
              })()}
            </span>
            {' '}+ 2% Medicare
          </p>
        )}
      </div>

      {/* ATO Audit Risk Score + Ghost Deductions */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AuditRiskScore revenue={revenue} deductions={deductions} />
          <GhostDeductions />
        </div>
      )}

      {/* EOFY Checklist */}
      {eofyDays <= 120 && (
        <div className="rounded-2xl border border-border-subtle bg-surface-amber p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-accent-amber">
            EOFY 2025-26 Checklist — {eofyDays} Days Remaining
          </h3>
          <div className="space-y-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Urgent</p>
            {[
              'BAS Q3 due April 28 — prepare now',
              'Review super contribution — carry-forward unused cap available',
            ].map((item, i) => (
              <label key={`u${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated">
                <input type="checkbox" className="h-4 w-4 rounded border-border-subtle accent-accent-green" />
                {item}
              </label>
            ))}
            <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Before June 30</p>
            {[
              'Review instant asset write-off opportunities (<$20K per item)',
              'Prepay eligible expenses (insurance, subscriptions, internet)',
              'Ensure all invoices issued and accounted for',
              'Confirm vehicle expense method (currently logbook at 85%)',
              'Review home office calculation (currently 5.05% actual cost)',
            ].map((item, i) => (
              <label key={`b${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated">
                <input type="checkbox" className="h-4 w-4 rounded border-border-subtle accent-accent-green" />
                {item}
              </label>
            ))}
            <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Verify</p>
            {[
              'All receipts attached for expenses over $82.50',
              'No personal expenses miscategorised as business',
              'GST credits reconcile to BAS lodgements',
              'Asset register up to date',
            ].map((item, i) => (
              <label key={`v${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated">
                <input type="checkbox" className="h-4 w-4 rounded border-border-subtle accent-accent-green" />
                {item}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
