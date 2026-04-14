'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { FolderArchive, Upload, Search, FileText, Loader2 } from 'lucide-react'

type Scope = 'business' | 'personal' | 'household' | 'investment'

const FILE_TYPES = [
  'bank_statement',
  'tax_return',
  'bas_worksheet',
  'receipt',
  'bill',
  'insurance',
  'other',
] as const

type FileType = (typeof FILE_TYPES)[number]

interface DocumentRow {
  id: string
  name: string
  description: string | null
  file_url: string
  storage_path: string | null
  file_type: FileType | null
  scope: Scope
  financial_year: string | null
  tags: string[] | null
  uploaded_at: string
}

const SCOPE_TABS: { key: Scope | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'business', label: 'Business' },
  { key: 'personal', label: 'Personal' },
  { key: 'household', label: 'Household' },
]

const prettyFileType = (t: FileType | null) =>
  (t ?? 'other').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope | 'all'>('all')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    name: string
    fileType: FileType
    scope: Scope
    financialYear: string
    description: string
  }>({
    name: '',
    fileType: 'bank_statement',
    scope: 'business',
    financialYear: '',
    description: '',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (error) console.error('[documents] load failed', error)
    setDocs((data ?? []) as DocumentRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter((d) => {
      if (scope !== 'all' && d.scope !== scope) return false
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false) ||
        (d.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
      )
    })
  }, [docs, scope, search])

  const handleFile = async (file: File) => {
    if (!form.name.trim()) {
      setUploadError('Give the document a name first.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const ext = file.name.split('.').pop() || 'bin'
      const path = `${form.scope}/${form.fileType}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        })
      if (uploadError) throw uploadError

      // Documents bucket is private — store the path. For viewing, mint a signed URL on demand.
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(path)

      const { error: dbError } = await supabase.from('documents').insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_type: form.fileType,
        scope: form.scope,
        financial_year: form.financialYear.trim() || null,
      })
      if (dbError) throw dbError

      setForm({
        name: '',
        fileType: 'bank_statement',
        scope: 'business',
        financialYear: '',
        description: '',
      })
      await loadDocs()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const openSigned = async (d: DocumentRow) => {
    if (!d.storage_path) {
      window.open(d.file_url, '_blank', 'noopener')
      return
    }
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(d.storage_path, 60 * 10)
    if (error || !data) {
      window.open(d.file_url, '_blank', 'noopener')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <FolderArchive className="h-5 w-5 text-accent-primary" strokeWidth={1.5} />
            Documents
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Bank statements, tax returns, insurance policies, and more.
          </p>
        </div>
      </header>

      {/* Upload card */}
      <section className="rounded-2xl border border-border-subtle bg-bg-primary p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-text-primary">Upload</h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          Max ~50 MB. Documents bucket is private — only signed URLs can open files.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-text-secondary">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Q3 Bank Statement (NAB)"
              className="mt-1 w-full rounded-xl border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </label>

          <label className="text-xs font-medium text-text-secondary">
            Financial year
            <input
              type="text"
              value={form.financialYear}
              onChange={(e) => setForm((f) => ({ ...f, financialYear: e.target.value }))}
              placeholder="FY2025-26"
              className="mt-1 w-full rounded-xl border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </label>

          <label className="text-xs font-medium text-text-secondary">
            Type
            <select
              value={form.fileType}
              onChange={(e) =>
                setForm((f) => ({ ...f, fileType: e.target.value as FileType }))
              }
              className="mt-1 w-full rounded-xl border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            >
              {FILE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {prettyFileType(t)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-text-secondary">
            Scope
            <select
              value={form.scope}
              onChange={(e) =>
                setForm((f) => ({ ...f, scope: e.target.value as Scope }))
              }
              className="mt-1 w-full rounded-xl border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="business">Business</option>
              <option value="personal">Personal</option>
              <option value="household">Household</option>
              <option value="investment">Investment</option>
            </select>
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-text-secondary">
            Description (optional)
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full resize-none rounded-xl border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Choose file
              </>
            )}
          </button>
          {uploadError && (
            <p className="text-xs text-[var(--accent-rose,#B91C1C)]">
              {uploadError}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*,.csv,.xlsx,.xls,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-border-subtle bg-bg-primary p-1">
          {SCOPE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setScope(t.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                scope === t.key
                  ? 'bg-accent-primary-bg text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-[200px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-xl border border-border-subtle bg-bg-primary py-2 pl-9 pr-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </label>
      </div>

      {/* List */}
      <section className="rounded-2xl border border-border-subtle bg-bg-primary">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-secondary">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-secondary">
            No documents match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => openSigned(d)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-secondary transition-colors"
                >
                  <FileText
                    className="h-5 w-5 shrink-0 text-text-tertiary"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {d.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {[
                        d.scope.charAt(0).toUpperCase() + d.scope.slice(1),
                        prettyFileType(d.file_type),
                        d.financial_year,
                        formatDate(d.uploaded_at),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
