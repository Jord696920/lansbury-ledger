/**
 * Zoho Invoice → Lansbury Ledger Migration
 * Reads Zoho CSV export and imports into Supabase invoices + invoice_lines tables.
 * Idempotent: skips invoices that already exist (dedup on invoice_number).
 */

import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to bypass RLS
)

const STATUS_MAP: Record<string, string> = {
  Paid: 'paid',
  Closed: 'paid',
  Sent: 'sent',
  Draft: 'draft',
  Overdue: 'overdue',
  Void: 'void',
}

interface ZohoRow {
  'Invoice Date': string
  'Invoice Number': string
  'Invoice Status': string
  'Customer Name': string
  'Company Name': string
  'Is Inclusive Tax': string
  'Due Date': string
  SubTotal: string
  Total: string
  'Last Payment Date': string
  Notes: string
  'Item Name': string
  'Item Desc': string
  Quantity: string
  'Item Price': string
  'Item Total': string
  'Item Tax1 Amount': string
  'Billing Address': string
  'Billing City': string
  'Billing State': string
  'Billing Country': string
  'Billing Code': string
  'Primary Contact EmailID': string
}

async function migrate() {
  const csvPath = 'data/zoho/Invoice.csv'
  console.log(`Reading ${csvPath}...`)
  const raw = readFileSync(csvPath, 'utf8')
  const records: ZohoRow[] = parse(raw, { columns: true, skip_empty_lines: true })
  console.log(`Parsed ${records.length} rows from CSV`)

  // Get existing invoice numbers to deduplicate
  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number')
  const existingNumbers = new Set((existing ?? []).map((e) => e.invoice_number))
  console.log(`${existingNumbers.size} invoices already in database`)

  // Group rows by invoice number (handles multi-line invoices)
  const invoiceMap = new Map<string, ZohoRow[]>()
  for (const row of records) {
    const num = row['Invoice Number']
    if (!invoiceMap.has(num)) invoiceMap.set(num, [])
    invoiceMap.get(num)!.push(row)
  }
  console.log(`${invoiceMap.size} unique invoices in CSV`)

  let importedInvoices = 0
  let importedLines = 0
  let skipped = 0

  // Process in batches of 50
  const invoiceEntries = Array.from(invoiceMap.entries())
  for (let i = 0; i < invoiceEntries.length; i += 50) {
    const batch = invoiceEntries.slice(i, i + 50)
    const invoiceRows = []
    const lineItemsMap: Record<string, ZohoRow[]> = {}

    for (const [invoiceNumber, rows] of batch) {
      if (existingNumbers.has(invoiceNumber)) {
        skipped++
        continue
      }

      const first = rows[0]
      const subtotal = parseFloat(first.SubTotal) || 0
      const total = parseFloat(first.Total) || 0
      const gstAmount = Math.round((total - subtotal) * 100) / 100

      // Build client address from parts
      const addressParts = [
        first['Billing Address'],
        first['Billing City'],
        first['Billing State'],
        first['Billing Country'],
        first['Billing Code'],
      ].filter(Boolean)
      const clientAddress = addressParts.length > 0 ? addressParts.join(', ') : null

      const status = STATUS_MAP[first['Invoice Status']] || 'paid'
      const paymentDate = first['Last Payment Date'] || null

      invoiceRows.push({
        invoice_number: invoiceNumber,
        client_name: first['Customer Name'] || first['Company Name'],
        client_email: first['Primary Contact EmailID'] || null,
        client_address: clientAddress,
        issue_date: first['Invoice Date'],
        due_date: first['Due Date'] || first['Invoice Date'],
        status,
        subtotal,
        gst_amount: gstAmount,
        total,
        payment_date: paymentDate && paymentDate !== '' ? paymentDate : null,
        notes: first.Notes || null,
      })

      lineItemsMap[invoiceNumber] = rows
    }

    if (invoiceRows.length === 0) continue

    // Insert invoices
    const { data: inserted, error: invError } = await supabase
      .from('invoices')
      .insert(invoiceRows)
      .select('id, invoice_number')

    if (invError) {
      console.error('Invoice insert error:', invError.message)
      continue
    }

    // Build line items for inserted invoices
    const lineItems = []
    for (const inv of inserted ?? []) {
      const rows = lineItemsMap[inv.invoice_number]
      if (!rows) continue

      for (const row of rows) {
        const itemName = row['Item Name'] || 'Consulting Services'
        const itemDesc = row['Item Desc']
        const description = itemDesc ? `${itemName} — ${itemDesc}` : itemName

        const quantity = parseFloat(row.Quantity) || 1
        const unitPrice = parseFloat(row['Item Price']) || 0
        const lineGst = parseFloat(row['Item Tax1 Amount']) || 0
        const lineTotal = parseFloat(row['Item Total']) || 0

        lineItems.push({
          invoice_id: inv.id,
          description,
          quantity,
          unit_price: unitPrice,
          gst_amount: lineGst,
          total: lineTotal,
        })
      }
    }

    if (lineItems.length > 0) {
      const { error: lineError } = await supabase
        .from('invoice_lines')
        .insert(lineItems)

      if (lineError) {
        console.error('Line item insert error:', lineError.message)
      }
    }

    importedInvoices += inserted?.length ?? 0
    importedLines += lineItems.length

    if ((i + 50) % 100 === 0 || i + 50 >= invoiceEntries.length) {
      console.log(`  Progress: ${Math.min(i + 50, invoiceEntries.length)}/${invoiceEntries.length} invoices processed`)
    }
  }

  // Update invoice_next_number on business_profile
  // Extract numeric part from highest invoice number
  const allNumbers = Array.from(invoiceMap.keys())
  const maxNum = allNumbers.reduce((max, num) => {
    const n = parseInt(num.replace(/\D/g, ''), 10)
    return n > max ? n : max
  }, 0)

  const { error: profileError } = await supabase
    .from('business_profile')
    .update({ invoice_next_number: maxNum + 1 })
    .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows

  if (profileError) {
    console.error('Profile update error:', profileError.message)
  } else {
    console.log(`Updated invoice_next_number to ${maxNum + 1}`)
  }

  console.log('\n--- Migration Summary ---')
  console.log(`Imported: ${importedInvoices} invoices, ${importedLines} line items`)
  console.log(`Skipped: ${skipped} (already existed)`)
  console.log(`Total invoiced amount: $${Array.from(invoiceMap.values()).reduce((s, rows) => s + parseFloat(rows[0].Total), 0).toFixed(2)}`)
}

migrate().catch(console.error)
