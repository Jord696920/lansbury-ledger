'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBudgets, getBudgetActuals, upsertBudget, deleteBudget, getAccounts } from '@/lib/queries'
import { formatCurrency } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns'
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
  Target, TrendingUp, AlertTriangle, CheckCircle2, X
} from 'lucide-react'
import type { Budget, Account } from '@/types/database'

function pct(actual: number, budget: number): number {
  if (budget <= 0) return 0
  return Math.min((actual / budget) * 100, 200)
}

function barColor(p: number): string {
  if (p >= 100) return 'bg-accent-red'
  if (p >= 80)  return 'bg-accent-amber'
  return 'bg-accent-green'
}

interface BudgetRow extends Budget {
  actual: number
  variance: number
  pct: number
}

interface FormState {
  id?: string
  category_name: string
  account_id: string
  amount: string
  period_type: 'monthly' | 'quarterly' | 'annual'
  notes: string
}

const emptyForm = (): FormState => ({
  category_name: '',
  account_id: '',
  amount: '',
  period_type: 'monthly',
  notes: '',
})

export default function BudgetsPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [actuals, setActuals] = useState<Record<string, number>>({})
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const periodStart = startOfMonth(currentMonth).toISOString().split('T')[0]
  const periodEnd   = endOfMonth(currentMonth).toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, a, accts] = await Promise.all([
        getBudgets(periodStart, periodEnd),
        getBudgetActuals(periodStart, periodEnd),
        getAccounts(),
      ])
      setBudgets(b)
      setActuals(a)
      setAccounts(accts.filter(ac => ac.type === 'expense'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [periodStart, periodEnd])

  useEffect(() => { load() }, [load])

  const rows: BudgetRow[] = budgets.map(b => {
    const actual = b.account_id ? (actuals[b.account_id] ?? 0) : 0
    const variance = b.amount - actual
    return { ...b, actual, variance, pct: pct(actual, b.amount) }
  })

  const totalBudget  = rows.reduce((s, r) => s + r.amount, 0)
  const totalActual  = rows.reduce((s, r) => s + r.actual, 0)
  const totalPct     = pct(totalActual, totalBudget)
  const overBudget   = rows.filter(r => r.pct >= 100).length
  const nearBudget   = rows.filter(r => r.pct >= 80 && r.pct < 100).length

  function openAdd() {
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(b: Budget) {
    setForm({
      id: b.id,
      category_name: b.category_name,
      account_id: b.account_id ?? '',
      amount: String(b.amount),
      period_type: b.period_type,
      notes: b.notes ?? '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.category_name.trim() || !form.amount) {
      setError('Category name and amount are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await upsertBudget({
        ...(form.id ? { id: form.id } : {}),
        category_name: form.category_name.trim(),
        account_id: form.account_id || null,
        amount: parseFloat(form.amount),
        period_type: form.period_type,
        period_start: periodStart,
        period_end: periodEnd,
        notes: form.notes.trim() || null,
      } as Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'account'>)
      setShowForm(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBudget(id)
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
          <h1 className="font-display text-2xl font-bold text-text-primary">Budgets</h1>
          <p className="text-sm text-text-secondary">Monthly spend targets vs actuals</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Budget
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="rounded-lg border border-border-subtle p-2 text-text-secondary hover:bg-bg-elevated transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[140px] text-center text-sm font-semibold text-text-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="rounded-lg border border-border-subtle p-2 text-text-secondary hover:bg-bg-elevated transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-surface-red px-4 py-3 text-sm text-accent-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Total Budget</p>
            <p className="mt-1 font-financial text-lg font-bold text-text-primary">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Total Spent</p>
            <p className={`mt-1 font-financial text-lg font-bold ${totalActual > totalBudget ? 'text-accent-red' : 'text-text-primary'}`}>
              {formatCurrency(totalActual)}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Remaining</p>
            <p className={`mt-1 font-financial text-lg font-bold ${totalBudget - totalActual < 0 ? 'text-accent-red' : 'text-accent-green'}`}>
              {formatCurrency(Math.abs(totalBudget - totalActual))}
              <span className="ml-1 text-xs font-normal text-text-tertiary">
                {totalBudget - totalActual < 0 ? 'over' : 'left'}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-primary p-4">
            <p className="text-xs text-text-tertiary">Status</p>
            <div className="mt-1 flex flex-col gap-0.5">
              {overBudget > 0 && (
                <span className="text-xs font-semibold text-accent-red">{overBudget} over budget</span>
              )}
              {nearBudget > 0 && (
                <span className="text-xs font-semibold text-accent-amber">{nearBudget} near limit</span>
              )}
              {overBudget === 0 && nearBudget === 0 && rows.length > 0 && (
                <span className="text-xs font-semibold text-accent-green">All on track</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Budget rows */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-bg-primary p-10 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
            <p className="text-sm font-medium text-text-secondary">No budgets for {format(currentMonth, 'MMMM yyyy')}</p>
            <p className="mt-1 text-xs text-text-tertiary">Set monthly targets to track spending vs budget</p>
            <button
              onClick={openAdd}
              className="mt-4 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Add first budget
            </button>
          </div>
        ) : (
          rows.map(row => (
            <div
              key={row.id}
              className="rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{row.category_name}</p>
                  {row.account && (
                    <p className="text-[10px] text-text-tertiary">{row.account.name}</p>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-1">
                  {row.pct >= 100 && <AlertTriangle className="h-4 w-4 text-accent-red" />}
                  {row.pct >= 80 && row.pct < 100 && <AlertTriangle className="h-4 w-4 text-accent-amber" />}
                  {row.pct < 80 && row.actual > 0 && <CheckCircle2 className="h-4 w-4 text-accent-green" />}
                  <button
                    onClick={() => openEdit(row)}
                    className="rounded p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(row.id)}
                    className="rounded p-1 text-text-tertiary hover:text-accent-red hover:bg-surface-red transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor(row.pct)}`}
                  style={{ width: `${Math.min(row.pct, 100)}%` }}
                />
              </div>

              {/* Figures */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">
                  {formatCurrency(row.actual)} spent
                </span>
                <span className="font-financial font-semibold text-text-primary">
                  {formatCurrency(row.amount)} budget
                </span>
                <span className={row.variance < 0 ? 'text-accent-red font-semibold' : 'text-text-tertiary'}>
                  {row.variance < 0
                    ? `${formatCurrency(Math.abs(row.variance))} over`
                    : `${formatCurrency(row.variance)} left`
                  }
                </span>
              </div>

              {/* Delete confirm */}
              {deleteConfirm === row.id && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-red px-3 py-2 text-xs">
                  <span className="text-accent-red font-medium">Delete this budget?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1 text-text-secondary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="rounded bg-accent-red px-2 py-1 font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowForm(false)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl border border-border-subtle bg-bg-primary shadow-2xl lg:inset-x-auto lg:left-1/2 lg:w-[480px] lg:-translate-x-1/2">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h2 className="text-sm font-bold text-text-primary">
                {form.id ? 'Edit Budget' : 'New Budget'}
              </h2>
              <button onClick={() => setShowForm(false)}>
                <X className="h-4 w-4 text-text-tertiary" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {error && (
                <p className="rounded-lg bg-surface-red px-3 py-2 text-xs text-accent-red">{error}</p>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Category name <span className="text-accent-red">*</span>
                </label>
                <input
                  className="input w-full"
                  placeholder="e.g. Transport, Subscriptions"
                  value={form.category_name}
                  onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Linked account (optional)
                </label>
                <select
                  className="input w-full"
                  value={form.account_id}
                  onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                >
                  <option value="">— No linked account —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    Budget amount <span className="text-accent-red">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input w-full pl-7"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Period</label>
                  <select
                    className="input w-full"
                    value={form.period_type}
                    onChange={e => setForm(f => ({ ...f, period_type: e.target.value as 'monthly' | 'quarterly' | 'annual' }))}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Notes</label>
                <input
                  className="input w-full"
                  placeholder="Optional note"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 border-t border-border-subtle px-5 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-border-subtle py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-elevated"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-accent-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : form.id ? 'Update' : 'Add Budget'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
