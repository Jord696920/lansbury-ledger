'use client'

import useSWR, { type SWRConfiguration } from 'swr'
import { supabase } from '@/lib/supabase'

type Fetcher<T> = () => Promise<T>

/**
 * Generic SWR wrapper for Supabase queries. Gives us:
 *  - instant render from cache on subsequent visits (pairs with the SW cache)
 *  - background revalidation + dedup
 *  - mutate() for optimistic updates / manual refresh
 */
export function useSupabaseQuery<T>(
  key: string | null,
  fetcher: Fetcher<T>,
  config?: SWRConfiguration<T>,
) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
    ...config,
  })
}

/** Example: list invoices. Returns newest-first. */
export function useInvoices() {
  return useSupabaseQuery('invoices:all', async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('issue_date', { ascending: false })
    if (error) throw error
    return data ?? []
  })
}

/** Example: list transactions (scoped). */
export function useTransactions(scope?: 'business' | 'personal' | 'household' | 'investment') {
  const key = scope ? `transactions:${scope}` : 'transactions:all'
  return useSupabaseQuery(key, async () => {
    let q = supabase.from('transactions').select('*').order('date', { ascending: false })
    if (scope) q = q.eq('scope', scope)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  })
}

/** Documents, filtered by scope. */
export function useDocuments(scope?: 'business' | 'personal' | 'household' | 'investment') {
  const key = scope ? `documents:${scope}` : 'documents:all'
  return useSupabaseQuery(key, async () => {
    let q = supabase.from('documents').select('*').order('uploaded_at', { ascending: false })
    if (scope) q = q.eq('scope', scope)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  })
}

/** Household members (self/spouse/dependents). */
export function useHouseholdMembers() {
  return useSupabaseQuery('household_members:all', async () => {
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .order('created_at')
    if (error) throw error
    return data ?? []
  })
}
