import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Invoice, InvoiceLine, BusinessProfile, Client } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface PDFData {
  invoice: Invoice
  lines: InvoiceLine[]
  profile: BusinessProfile
  client: Client | null
}

// Premium accent colour
const ACCENT: [number, number, number] = [107, 138, 255] // #6B8AFF
const MUTED: [number, number, number] = [140, 140, 155]
const DARK: [number, number, number] = [30, 30, 40]
const DIVIDER: [number, number, number] = [225, 225, 230]

export function generateInvoicePDF({ invoice, lines, profile, client }: PDFData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const M = 25 // generous margin
  const R = pageWidth - M
  let y = M

  // ────────────────────────────────────────────────
  // FROM: JORDAN LANSBURY (top-left, uppercase, tracked)
  // ────────────────────────────────────────────────
  const fromName = profile.business_name || 'Jordan Lansbury'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...DARK)
  doc.text(fromName.toUpperCase(), M, y, { charSpace: 1.2 })
  y += 2

  // Accent underline beneath name
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(M, y, M + 45, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  if (profile.address_line1) { doc.text(profile.address_line1, M, y); y += 3.8 }
  const cityLine = [profile.city, profile.state, profile.postcode].filter(Boolean).join(' ')
  if (cityLine) { doc.text(cityLine, M, y); y += 3.8 }
  if (profile.abn) { doc.text(`ABN ${profile.abn}`, M, y); y += 3.8 }
  if (profile.email) { doc.text(profile.email, M, y); y += 3.8 }
  if (profile.phone) { doc.text(profile.phone, M, y); y += 3.8 }

  // ────────────────────────────────────────────────
  // RIGHT: Tax Invoice + number + Balance Due
  // ────────────────────────────────────────────────
  let ry = M
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(24)
  doc.setTextColor(...ACCENT)
  doc.text('Tax Invoice', R, ry, { align: 'right' })
  ry += 4

  // Thin accent underline
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.4)
  doc.line(R - 42, ry, R, ry)
  ry += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(invoice.invoice_number, R, ry, { align: 'right' })
  ry += 8

  doc.setFontSize(9)
  doc.text('Balance Due', R, ry, { align: 'right' })
  ry += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...ACCENT)
  doc.text(formatCurrency(invoice.total), R, ry, { align: 'right' })

  y = Math.max(y, ry) + 12

  // ── Full-width divider ──
  drawDivider(doc, M, R, y)
  y += 10

  // ────────────────────────────────────────────────
  // BILL TO (left) + INVOICE DETAILS (right)
  // ────────────────────────────────────────────────
  sectionLabel(doc, 'BILL TO', M, y)
  sectionLabel(doc, 'INVOICE DETAILS', R - 55, y)
  y += 6

  // Client name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text(client?.name || invoice.client_name, M, y)

  // Dates column (right)
  const dateRows = [
    ['Invoice Date', formatDatePDF(invoice.issue_date)],
    ['Terms', invoice.notes?.replace('Terms: ', '') || 'Due on Receipt'],
    ['Due Date', formatDatePDF(invoice.due_date)],
  ]
  let dy = y
  for (const [label, val] of dateRows) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(label, R - 55, dy)
    doc.setTextColor(...DARK)
    doc.text(val, R, dy, { align: 'right' })
    dy += 5
  }

  // Client details
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  if (client?.address_line1) { doc.text(client.address_line1, M, y); y += 3.8 }
  const clientCity = [client?.city, client?.state, client?.postcode].filter(Boolean).join(' ')
  if (clientCity) { doc.text(clientCity, M, y); y += 3.8 }
  const clientAbn = client?.abn || invoice.client_abn
  if (clientAbn) { doc.text(`ABN: ${clientAbn}`, M, y); y += 3.8 }
  if (client?.licence_number) { doc.text(`Lic No: ${client.licence_number}`, M, y); y += 3.8 }

  y = Math.max(y, dy) + 10

  // ── Divider ──
  drawDivider(doc, M, R, y)
  y += 4

  // ────────────────────────────────────────────────
  // LINE ITEMS TABLE
  // ────────────────────────────────────────────────
  // Split description into two lines: "Consulting Fee" + vehicle
  const tableBody = lines.map((line, i) => {
    const desc = line.description
    // Try to split "Consulting Fee <vehicle>" into two lines
    const prefix = 'Consulting Fee'
    let line1 = desc
    let line2 = ''
    if (desc.startsWith(prefix) && desc.length > prefix.length) {
      line1 = prefix
      line2 = desc.slice(prefix.length).trim()
    }
    const displayDesc = line2 ? `${line1}\n${line2}` : line1

    return [
      String(i + 1),
      displayDesc,
      '1.00',
      formatCurrency(line.unit_price),
      formatCurrency(line.gst_amount),
      formatCurrency(line.unit_price),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['#', 'ITEM & DESCRIPTION', 'QTY', 'UNIT PRICE', 'GST', 'AMOUNT']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [250, 250, 252],
      textColor: [...MUTED],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineColor: [...DIVIDER],
      lineWidth: { bottom: 0.3 },
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 3, right: 3 },
      textColor: [...DARK],
      lineColor: [...DIVIDER],
      lineWidth: { bottom: 0.15 },
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: [...MUTED] },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 26, halign: 'right', fontStyle: 'normal' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
    didParseCell: (data) => {
      // Make the vehicle line (second line) lighter
      if (data.section === 'body' && data.column.index === 1) {
        const text = String(data.cell.raw)
        if (text.includes('\n')) {
          data.cell.styles.textColor = [...DARK]
        }
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // ────────────────────────────────────────────────
  // TOTALS
  // ────────────────────────────────────────────────
  const tLabelX = R - 55
  const tValX = R

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('Subtotal', tLabelX, y)
  doc.setTextColor(...DARK)
  doc.text(formatCurrency(invoice.subtotal), tValX, y, { align: 'right' })
  y += 5.5

  doc.setTextColor(...MUTED)
  doc.text('GST (10%)', tLabelX, y)
  doc.setTextColor(...DARK)
  doc.text(formatCurrency(invoice.gst_amount), tValX, y, { align: 'right' })
  y += 4

  // Thin divider above total
  doc.setDrawColor(...DIVIDER)
  doc.setLineWidth(0.3)
  doc.line(tLabelX - 3, y, tValX + 3, y)
  y += 5

  // TOTAL row — accent background highlight
  const totalRowH = 10
  doc.setFillColor(107, 138, 255, 0.08) // very subtle tint
  // jsPDF doesn't support alpha in setFillColor, use a light tint instead
  doc.setFillColor(240, 243, 255) // #F0F3FF — very light accent tint
  doc.roundedRect(tLabelX - 5, y - 5, tValX - tLabelX + 10, totalRowH, 1.5, 1.5, 'F')

  // Left accent bar on total row
  doc.setFillColor(...ACCENT)
  doc.rect(tLabelX - 5, y - 5, 2, totalRowH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('TOTAL', tLabelX + 2, y + 1)
  doc.setTextColor(...ACCENT)
  doc.text(formatCurrency(invoice.total), tValX, y + 1, { align: 'right' })

  y += totalRowH + 16

  // ── Divider ──
  drawDivider(doc, M, R, y)
  y += 8

  // ────────────────────────────────────────────────
  // PAYMENT DETAILS
  // ────────────────────────────────────────────────
  sectionLabel(doc, 'PAYMENT DETAILS', M, y)
  y += 6

  doc.setFontSize(8.5)
  const paymentDetails = [
    ['Bank', profile.bank_name || 'National Australia Bank'],
    ['Account Name', profile.business_name || 'Jordan Lansbury'],
    ['BSB', profile.bank_bsb || '084-402'],
    ['Account', profile.bank_account || '18-675-1952'],
  ]
  for (const [label, val] of paymentDetails) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    doc.text(val, M + 32, y)
    y += 4.5
  }

  // ────────────────────────────────────────────────
  // FOOTER
  // ────────────────────────────────────────────────
  y += 14
  drawDivider(doc, M, R, y)
  y += 7
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('Thanks for your business.', pageWidth / 2, y, { align: 'center' })

  return doc
}

// ── Helpers ──

function drawDivider(doc: jsPDF, x1: number, x2: number, y: number) {
  doc.setDrawColor(...DIVIDER)
  doc.setLineWidth(0.3)
  doc.line(x1, y, x2, y)
}

function sectionLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(text, x, y, { charSpace: 1 })
}

function formatDatePDF(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Download PDF to user's device */
export function downloadInvoicePDF(data: PDFData): void {
  const doc = generateInvoicePDF(data)
  doc.save(`${data.invoice.invoice_number}.pdf`)
}

/** Get PDF as base64 string (for email attachment) */
export function getInvoicePDFBase64(data: PDFData): string {
  const doc = generateInvoicePDF(data)
  return doc.output('datauristring').split(',')[1]
}
