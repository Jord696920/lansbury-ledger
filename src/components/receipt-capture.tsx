'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ReceiptCaptureProps {
  /** Called with the public URL once the receipt has uploaded. */
  onUploaded?: (url: string, path: string) => void
  /** Called with the raw File as soon as the user picks one. Useful for previews. */
  onFileSelected?: (file: File) => void
  /** Folder inside the `receipts` bucket. Defaults to "uncategorised". */
  folder?: string
  label?: string
  className?: string
}

export function ReceiptCapture({
  onUploaded,
  onFileSelected,
  folder = 'uncategorised',
  label = 'Snap receipt',
  className = '',
}: ReceiptCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    onFileSelected?.(file)
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, {
          cacheControl: '31536000',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      onUploaded?.(data.publicUrl, path)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center justify-center gap-2 w-full p-4 rounded-xl border border-dashed border-[var(--border-active)]
                   text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-60"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span className="text-sm font-medium">
          {uploading ? 'Uploading…' : label}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      {error && (
        <p className="mt-2 text-xs text-[var(--accent-rose,#B91C1C)]">
          {error}
        </p>
      )}
    </div>
  )
}
