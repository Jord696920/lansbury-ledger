'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, Search, Download } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: string
  searchable?: boolean
  searchPlaceholder?: string
  exportable?: boolean
  onRowClick?: (row: T) => void
  emptyMessage?: string
  loading?: boolean
  rowClassName?: (row: T) => string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  searchable = true,
  searchPlaceholder = 'Search...',
  exportable = true,
  onRowClick,
  emptyMessage = 'No data found',
  loading,
  rowClassName,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    let result = data
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val ?? '').toLowerCase().includes(lower)
        )
      )
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey] ?? ''
        const bVal = b[sortKey] ?? ''
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [data, search, sortKey, sortDir])

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function exportCSV() {
    const headers = columns.map((c) => c.label).join(',')
    const rows = filtered.map((row) =>
      columns.map((c) => {
        const val = row[c.key]
        const str = String(val ?? '')
        return str.includes(',') ? `"${str}"` : str
      }).join(',')
    )
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm">
        <div className="p-4">
          <div className="skeleton mb-4 h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm">
      {/* Toolbar */}
      {(searchable || exportable) && (
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="rounded-lg border border-border-subtle bg-bg-primary py-2 pl-9 pr-4 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-border-active"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">{filtered.length} rows</span>
            {exportable && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-elevated">
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.sortable && 'cursor-pointer select-none hover:text-text-secondary',
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-text-tertiary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border-subtle/50 transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-bg-elevated',
                    rowClassName?.(row)
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-sm',
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
