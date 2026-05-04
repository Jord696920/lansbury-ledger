'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getRecurringExpenses,
  upsertRecurringExpense,
  deleteRecurringExpense,
  getInvoices,
  getAccounts,
} from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import {
  addDays, addWeeks, addMonths, addQuarters, addYears,
  format, parseISO, differenceInDays, startOfWeek, endOfWeek,
  isWithinInterval, startOfDay,
} from 'date-fns'
import {
  Plus, Pencil, Trash2, AlertTriangle, X, Calendar,
  RefreshCw, CreditCard, Zap, ChevronDown, ChevronUp,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { RecurringExpense, Account } from '@/types/database'

type Frequency = RecurringExpense['frequency']
type PaymentMethod = RecurringExpense['payment_method']

interface RecurringFormState {
  id?: string
  name: string
  vendor_name: string
  amount: string
  gst_included: boolean
  account_id: string
  frequency: Frequency
  next_due_date: string
  business_use_pct: string
  is_active: boolean
  payment_method: PaymentMethod
  notes: string
}

function emptyForm(): RecurringFormState {
  return {
    name: '',
    vendor_name: '',
    amount: '',
    gst_included: true,
    account_id: '',
    frequency: 'monthly',
    next_due_date: new Date().toISOString().split('T')[0],
    business_use_pct: '100',
    is_active: true,
    payment_method: 'direct_debit',
    notes: '',
  }
}

function nextDueAfter(current: string, freq: Frequency): string {
  const d = parseISO(current)
  switch (freq) {
    case 'weekly':      return format(addWeeks(d, 1), 'yyyy-MM-dd')
    case 'fortnightly': return format(addWeeks(d, 2), 'yyyy-MM-dd')
    case 'monthly':     return format(addMonths(d, 1), 'yyyy-MM-dd')
    case 'quarterly':   return format(addQuarters(d, 1), 'yyyy-MM-dd')
    case 'annual':      return format(addYears(d, 1), 'yyyy-MM-dd')
  }
}

function freqLabel(f: Frequency): string {
  return { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' }[f]
}

function urgencyColor(days: number): string {
  if (days < 0)  return 'text-accent-red'
  if (days <= 7)  return 'text-accent-red'
  if (days <= 14) return 'text-accent-amber'
  return 'text-text-secondary'
}

function urgencyBg(days: number): string {
  if (days <= 7)  return 'bg-surface-red'
  if (days <= 14) return 'bg-surface-amber'
  return 'bg-bg-elevated'
}

/** Build 13-week cash-flow projection from invoices + recurring outgoings */
function buildCashFlow(
  invoices: { total: number; due_date: string; status: string }[],
  recurring: RecurringExpense[],
  openingBalance = 0
) {
  const today = startOfDay(new Date())
  const weeks: { week: string; income: number; expenses: number; net: number; balance: number }[] = []
  let balance = openingBalance

  for (let w = 0; w < 13; w++) {
    const weekStart = addWeeks(today, w)
    const weekEnd   = addDays(weekStart, 6)

    // Income: paid or sent invoices with due_date in this week
    const income = invoices
      .filter(inv => inv.status !== 'void' && inv.status !== 'draft')
      .filter(inv => {
        const d = parseISO(inv.due_date)
        return isWithinInterval(d, { start: weekStart, end: weekEnd })
      })
      .reduce((s, inv) => s + inv.total, 0)

    // Expenses: recurring expenses due in this week
    const expenses = recurring.reduce((s, rec) => {
      const due = parseISO(rec.next_due_date)
      if (!isWithinInterval(due, { start: weekStart, end: weekEnd })) return s
      const amtExGST = rec.gst_included ? rec.amount / 1.1 : rec.amount
      return s + amtExGST * (rec.business_use_pct / 100)
    }, 0)

    balance += income - expenses
    weeks.push({
      week: format(weekStart, 'd MMM'),
      income,
      expenses,
      net: income - expenses,
      balance,
    })
  }
  return weeks
}

export default function CashFlowPage() {
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [invoices, setInvoices] = useState<{ total: number; due_date: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<RecurringFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [openingBalance, setOpeningBalance] = useState('0')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rec, accts, inv] = await Promise.all([
        getRecurringExpenses(false),
        getAccounts(),
        fetch('/api/invoices-simple').then(() => null).catch(() => null),
      ])
      setRecurring(rec)
      setAccounts(accts.filter(a => a.type === 'expense'))
      // Inline invoice fetch via query
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load invoices separately
  useEffect(() => {
    getInvoices().then(inv => {
      setInvoices(inv.map(i => ({ total: i.total, due_date: i.due_date, status: i.status })))
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date()
  const active   = recurring.filter(r => r.is_active)
  const inactive = recurring.filter(r => !r.is_active)

  const upcoming30  = active.filter(r => differenceInDays(parseISO(r.next_due_date), today) <= 30)
  const monthlyTotal = active.reduce((s, r) => {
    const monthly = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annual: 1 }[r.frequency]
    return s + (r.amount / 1.1 * (r.business_use_pct / 100)) * (monthly / 12)
  }, 0)

  const chartData = buildCashFlow(invoices, active, parseFloat(openingBalance) || 0)

  function openAdd() {
    setForm(emptyForm())
    setShowForm(true)
    setError(null)
  }

  function openEdit(r: RecurringExpense) {
    setForm({
      id: r.id,
      name: r.name,
      vendor_name: r.vendor_name ?? '',
      amount: String(r.amount),
      gst_included: r.gst_included,
      account_id: r.account_id ?? '',
      frequency: r.frequency,
      next_due_date: r.next_due_date,
      business_use_pct: String(r.business_use_pct),
      is_active: r.is_active,
      payment_method: r.payment_method,
      notes: r.notes ?? '',
    })
    setShowForm(true)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.amount || !form.next_due_date) {
      setError('Name, amount, and next due date are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await upsertRecurringExpense({
        ...(form.id ? { id: form.id } : {}),
        name: form.name.trim(),
        vendor_name: form.vendor_name.trim() || null,
        amount: parseFloat(form.amount),
        gst_included: form.gst_included,
        account_id: form.account_id || null,
        frequency: form.frequency,
        next_due_date: form.next_due_date,
        last_paid_date: null,
        business_use_pct: parseFloat(form.business_use_pct) || 100,
        is_active: form.is_active,
        payment_method: form.payment_method,
        description: null,
        notes: form.notes.trim() || null,
      })
      setShowForm(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkPaid(rec: RecurringExpense) {
    try {
      await upsertRecurringExpense({
        ...rec,
        last_paid_date: today.toISOString().split('T')[0],
        next_due_date: nextDueAfter(rec.next_due_date, rec.frequency),
      })
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRecurringExpense(id)
      setDeleteConfirm(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Cash Flow</h1>
          <p className="text-sm text-text-secondary">13-week forecast · recurring expenses</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Recurring
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-surface-red px-4 py-3 text-sm text-accent-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Summary strip */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Monthly outgoings</p>
            <p className="mt-1 font-financial text-lg font-bold text-text-primary">{formatCurrency(monthlyTotal)}</p>
            <p className="text-[10px] text-text-tertiary">ex GST, biz use</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Due in 30 days</p>
            <p className="mt-1 font-financial text-lg font-bold text-accent-amber">{upcoming30.length}</p>
            <p className="text-[10px] text-text-tertiary">recurring bills</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Active subscriptions</p>
            <p className="mt-1 font-financial text-lg font-bold text-text-primary">{active.length}</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">13-week net</p>
            <p className={`mt-1 font-financial text-lg font-bold ${chartData.length ? (chartData[chartData.length - 1].balance >= 0 ? 'text-accent-green' : 'text-accent-red') : 'text-text-primary'}`}>
              {chartData.length ? formatCurrency(chartData[chartData.length - 1].balance) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* 13-week chart */}
      <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4 lg:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">13-Week Forecast</h2>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>Opening balance</span>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
              <input
                type="number"
                className="w-24 rounded-lg border border-border-subtle bg-bg-elevated pl-5 pr-2 py-1 text-right text-xs text-text-primary"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
              />
            </div>
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-48" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-accent-green)"   stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-accent-green)"   stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-accent-red)"    stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-accent-red)"    stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} axisLine={false} tickLine={false} tickFormatter={(v: unknown) => `$${(Number(v) / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [formatCurrency(Number(value ?? 0)), name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Balance']}
                contentStyle={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="income"   stroke="var(--color-accent-green)" fill="url(#incomeGrad)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="expenses" stroke="var(--color-accent-red)"   fill="url(#expGrad)"    strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Upcoming bills */}
      {upcoming30.length > 0 && (
        <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4 lg:p-5">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Due in Next 30 Days</h2>
          <div className="space-y-2">
            {upcoming30.map(rec => {
              const days = differenceInDays(parseISO(rec.next_due_date), today)
              return (
                <div
                  key={rec.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${urgencyBg(days)}`}
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{rec.name}</p>
                    <p className={`text-xs ${urgencyColor(days)}`}>
                      {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `Due in ${days} days — ${format(parseISO(rec.next_due_date), 'd MMM')}`}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="font-financial text-sm font-semibold text-text-primary">{formatCurrency(rec.amount)}</p>
                    <button
                      onClick={() => handleMarkPaid(rec)}
                      className="mt-0.5 text-[10px] font-medium text-accent-primary hover:underline"
                    >
                      Mark paid
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All recurring expenses */}
      <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4 lg:p-5">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">All Recurring Expenses</h2>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-14 rounded-xl" />
          ))
        ) : active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle py-8 text-center">
            <RefreshCw className="mx-auto mb-2 h-8 w-8 text-text-tertiary" />
            <p className="text-sm text-text-secondary">No recurring expenses yet</p>
            <button onClick={openAdd} className="mt-3 text-xs text-accent-primary hover:underline">
              Add your first subscription or bill
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(rec => {
              const days = differenceInDays(parseISO(rec.next_due_date), today)
              return (
                <div key={rec.id} className="flex items-center gap-3 rounded-xl border border-border-subtle px-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
                    {rec.payment_method === 'credit_card' ? (
                      <CreditCard className="h-4 w-4 text-text-tertiary" />
                    ) : rec.payment_method === 'direct_debit' ? (
                      <Zap className="h-4 w-4 text-text-tertiary" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-text-tertiary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{rec.name}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {freqLabel(rec.frequency)} · {rec.business_use_pct}% biz · due {format(parseISO(rec.next_due_date), 'd MMM yyyy')}
                    </p>
                  </div>
                  <div className="ml-2 text-right shrink-0">
                    <p className="font-financial text-sm font-semibold text-text-primary">{formatCurrency(rec.amount)}</p>
                    <p className={`text-[10px] ${urgencyColor(days)}`}>
                      {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => openEdit(rec)} className="rounded p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-elevated">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm(rec.id)} className="rounded p-1 text-text-tertiary hover:text-accent-red hover:bg-surface-red">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {deleteConfirm === rec.id && (
                    <div className="absolute right-4 z-10 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 shadow-lg">
                      <span className="text-xs text-accent-red">Delete?</span>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-text-tertiary hover:text-text-primary">Cancel</button>
                      <button onClick={() => handleDelete(rec.id)} className="rounded bg-accent-red px-2 py-0.5 text-xs font-semibold text-white">Delete</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Inactive section */}
        {inactive.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowInactive(v => !v)}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
            >
              {showInactive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {inactive.length} inactive
            </button>
            {showInactive && (
              <div className="mt-2 space-y-2 opacity-50">
                {inactive.map(rec => (
                  <div key={rec.id} className="flex items-center justify-between rounded-xl border border-dashed border-border-subtle px-3 py-2.5 text-sm">
                    <span className="text-text-secondary line-through">{rec.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-financial text-xs text-text-tertiary">{formatCurrency(rec.amount)}</span>
                      <button onClick={() => openEdit(rec)} className="text-[10px] text-accent-primary hover:underline">Reactivate</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl border border-border-subtle bg-bg-primary shadow-2xl lg:inset-x-auto lg:left-1/2 lg:w-[520px] lg:-translate-x-1/2 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-sm font-bold text-text-primary">
                {form.id ? 'Edit Recurring Expense' : 'New Recurring Expense'}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-text-tertiary" /></button>
            </div>
            <div className="space-y-4 p-5">
              {error && (
                <p className="rounded-lg bg-surface-red px-3 py-2 text-xs text-accent-red">{error}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Name <span className="text-accent-red">*</span></label>
                  <input className="input w-full" placeholder="e.g. AUTOGRAB subscription" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Vendor</label>
                  <input className="input w-full" placeholder="Company name" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Amount (inc GST) <span className="text-accent-red">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                    <input type="number" min="0" step="0.01" className="input w-full pl-7" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Frequency</label>
                  <select className="input w-full" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Frequency }))}>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Next due date <span className="text-accent-red">*</span></label>
                  <input type="date" className="input w-full" value={form.next_due_date} onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Category</label>
                  <select className="input w-full" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                    <option value="">— Uncategorised —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Business use %</label>
                  <input type="number" min="0" max="100" className="input w-full" value={form.business_use_pct} onChange={e => setForm(f => ({ ...f, business_use_pct: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Payment method</label>
                  <select className="input w-full" value={form.payment_method ?? ''} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as PaymentMethod || null }))}>
                    <option value="">— Unknown —</option>
                    <option value="direct_debit">Direct debit</option>
                    <option value="credit_card">Credit card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">GST included?</label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                      <input type="radio" checked={form.gst_included} onChange={() => setForm(f => ({ ...f, gst_included: true }))} />
                      Yes (inc GST)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                      <input type="radio" checked={!form.gst_included} onChange={() => setForm(f => ({ ...f, gst_included: false }))} />
                      No
                    </label>
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5">
                  <label className="text-xs font-medium text-text-secondary">Active</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-accent-primary' : 'bg-bg-elevated'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Notes</label>
                  <input className="input w-full" placeholder="Optional note" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-border-subtle px-5 py-4">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border-subtle py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-elevated">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-accent-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving…' : form.id ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
