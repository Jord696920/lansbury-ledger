'use client'

import { useState, useCallback } from 'react'
import { parseCSV, findDuplicates, type ParsedTransaction } from '@/lib/csv-parser'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Upload, FileText, AlertTriangle, Check, X } from 'lucide-react'

interface CSVImportProps {
  onImportComplete: () => void
}

export function CSVImport({ onImportComplete }: CSVImportProps) {
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<ParsedTransaction[] | null>(null)
  const [bankName, setBankName] = useState('')
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set())
  const [errors, setErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')

  const handleFile = useCallback(async (file: File) => {
    // File size check (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setErrors(['File too large. Maximum size is 10MB.'])
      return
    }
    setFileName(file.name)
    const text = await file.text()
    const result = parseCSV(text)
    setParsed(result.transactions)
    setBankName(result.bankName)
    setErrors(result.errors)

    // Check duplicates against existing
    const { data: existing } = await supabase
      .from('transactions')
      .select('date, amount, description')
    if (existing) {
      setDuplicates(findDuplicates(result.transactions, existing))
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function importTransactions() {
    if (!parsed) return
    setImporting(true)

    const batchId = crypto.randomUUID()
    const toImport = parsed.filter((_, i) => !duplicates.has(i))

    const rows = toImport.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      balance: t.balance,
      source_file: fileName,
      import_batch_id: batchId,
    }))

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const { error } = await supabase.from('transactions').insert(batch)
      if (error) {
        console.error('Import error:', error)
        setErrors((prev) => [...prev, error.message])
        setImporting(false)
        return
      }
    }

    setImporting(false)
    setParsed(null)
    onImportComplete()
  }

  const newCount = parsed ? parsed.length - duplicates.size : 0

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!parsed && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all ${
            dragOver
              ? 'border-accent-green bg-surface-green'
              : 'border-border-subtle bg-bg-secondary hover:border-border-active'
          }`}
        >
          <Upload className={`mb-3 h-10 w-10 ${dragOver ? 'text-accent-green' : 'text-text-tertiary'}`} />
          <p className="text-sm font-medium text-text-primary">Drop CSV file here or click to browse</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Supports CBA, NAB, ANZ, Westpac, Suncorp formats
          </p>
          <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
        </label>
      )}

      {/* Preview */}
      {parsed && (
        <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-accent-blue" />
              <div>
                <p className="text-sm font-medium text-text-primary">{fileName}</p>
                <p className="text-xs text-text-tertiary">
                  {bankName} format · {parsed.length} transactions · {duplicates.size} duplicates
                </p>
              </div>
            </div>
            <button onClick={() => setParsed(null)} className="text-text-tertiary hover:text-text-secondary">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="border-b border-border-subtle bg-surface-amber px-4 py-2">
              {errors.map((err, i) => (
                <p key={i} className="flex items-center gap-2 text-xs text-accent-amber">
                  <AlertTriangle className="h-3 w-3" />
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Preview Table */}
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wider text-text-tertiary">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 50).map((t, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border-subtle/50 text-sm ${
                      duplicates.has(i) ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-financial text-text-secondary">{formatDate(t.date)}</td>
                    <td className="px-4 py-2 text-text-primary">{t.description}</td>
                    <td className={`px-4 py-2 text-right font-financial ${t.amount > 0 ? 'text-accent-green' : 'text-text-primary'}`}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {duplicates.has(i) ? (
                        <span className="text-[10px] text-accent-amber">DUPLICATE</span>
                      ) : (
                        <span className="text-[10px] text-accent-green">NEW</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 50 && (
              <p className="px-4 py-2 text-xs text-text-tertiary">
                Showing 50 of {parsed.length} transactions
              </p>
            )}
          </div>

          {/* Import Button */}
          <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-accent-green">{newCount}</span> new transactions to import
            </p>
            <button
              onClick={importTransactions}
              disabled={importing || newCount === 0}
              className="flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {importing ? (
                <>Importing...</>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Import {newCount} Transactions
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
