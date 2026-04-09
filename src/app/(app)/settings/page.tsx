'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Save, Building2 } from 'lucide-react'
import type { BusinessProfile } from '@/types/database'

export default function SettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data } = await supabase.from('business_profile').select('*').limit(1).single()
    if (data) setProfile(data as BusinessProfile)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('business_profile')
      .update(profile)
      .eq('id', profile.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function updateField<K extends keyof BusinessProfile>(field: K, value: BusinessProfile[K]) {
    if (!profile) return
    setProfile({ ...profile, [field]: value })
  }

  if (!profile) return <div className="skeleton h-96 w-full rounded-xl" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary">Business profile & configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-bg-primary hover:brightness-110 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Business Details */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Building2 className="h-4 w-4 text-accent-blue" />
          Business Details
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {([
            ['business_name', 'Business Name'],
            ['abn', 'ABN'],
            ['email', 'Email'],
            ['phone', 'Phone'],
            ['address_line1', 'Address Line 1'],
            ['address_line2', 'Address Line 2'],
            ['city', 'City'],
            ['state', 'State'],
            ['postcode', 'Postcode'],
          ] as const).map(([field, label]) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-medium text-text-tertiary">{label}</label>
              <input
                type="text"
                value={String(profile[field] ?? '')}
                onChange={(e) => updateField(field, e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Business Use Percentages */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Default Business Use Percentages</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {([
            ['vehicle_business_pct', 'Vehicle'],
            ['phone_business_pct', 'Phone'],
            ['internet_business_pct', 'Internet'],
            ['streaming_business_pct', 'Streaming'],
            ['utilities_business_pct', 'Utilities'],
            ['meal_business_pct', 'Meals'],
            ['home_office_pct', 'Home Office'],
          ] as const).map(([field, label]) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-medium text-text-tertiary">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={profile[field] ?? 0}
                  onChange={(e) => updateField(field, Number(e.target.value))}
                  min="0"
                  max="100"
                  className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 font-financial text-sm text-text-primary outline-none focus:border-accent-primary"
                />
                <span className="text-sm text-text-tertiary">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Invoice Settings</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">Invoice Prefix</label>
            <input
              type="text"
              value={profile.invoice_prefix}
              onChange={(e) => updateField('invoice_prefix', e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">Next Invoice Number</label>
            <input
              type="number"
              value={profile.invoice_next_number}
              onChange={(e) => updateField('invoice_next_number', Number(e.target.value))}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 font-financial text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">Payment Terms (days)</label>
            <input
              type="number"
              value={profile.payment_terms_days}
              onChange={(e) => updateField('payment_terms_days', Number(e.target.value))}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 font-financial text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
        </div>
      </div>

      {/* Banking */}
      <div className="rounded-xl border border-border-subtle bg-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Banking Details (for invoices)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">Bank Name</label>
            <input
              type="text"
              value={profile.bank_name ?? ''}
              onChange={(e) => updateField('bank_name', e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">BSB</label>
            <input
              type="text"
              value={profile.bank_bsb ?? ''}
              onChange={(e) => updateField('bank_bsb', e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 font-financial text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-tertiary">Account Number</label>
            <input
              type="text"
              value={profile.bank_account ?? ''}
              onChange={(e) => updateField('bank_account', e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2.5 font-financial text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
