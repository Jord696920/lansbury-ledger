import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { guardApiRoute } from '@/lib/api-guard'

// Mitigation for an open-relay risk:
// 1. same-origin + rate-limit via guardApiRoute
// 2. every `to` / `cc` recipient must match an email in the `clients` table
//    (plus the SMTP_USER itself, for Jordan's own copy)
// 3. PDF attachment size capped at 10MB

const MAX_PDF_BASE64 = 14 * 1024 * 1024 // ~10.5 MB binary → ~14 MB base64

export async function POST(request: Request) {
  const blocked = guardApiRoute(request, { limit: 6, windowMs: 60_000 })
  if (blocked) return blocked

  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { error: 'SMTP not configured' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { to, cc, subject, body: emailBody, pdfBase64, filename } = body ?? {}

    if (typeof to !== 'string' || !/^\S+@\S+\.\S+$/.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 })
    }
    if (typeof subject !== 'string' || typeof emailBody !== 'string' || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
      return NextResponse.json({ error: 'Missing PDF' }, { status: 400 })
    }
    if (pdfBase64.length > MAX_PDF_BASE64) {
      return NextResponse.json({ error: 'PDF too large' }, { status: 413 })
    }
    if (cc !== undefined && cc !== null && typeof cc !== 'string') {
      return NextResponse.json({ error: 'Invalid cc' }, { status: 400 })
    }

    // Build an allowlist of emails: every client email + the owner SMTP user.
    const supabase = createServiceClient()
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('email')
    if (clientsError) {
      return NextResponse.json({ error: 'Could not verify recipient' }, { status: 500 })
    }
    const allowed = new Set<string>()
    allowed.add(smtpUser.toLowerCase())
    for (const c of clients ?? []) {
      if (c.email) allowed.add(String(c.email).toLowerCase())
    }

    if (!allowed.has(to.toLowerCase())) {
      return NextResponse.json(
        { error: 'Recipient not in client allowlist' },
        { status: 403 }
      )
    }
    if (cc && !allowed.has(String(cc).toLowerCase())) {
      return NextResponse.json(
        { error: 'CC not in client allowlist' },
        { status: 403 }
      )
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: `Jordan Lansbury <${smtpUser}>`,
      to,
      cc: cc || smtpUser,
      subject,
      text: emailBody,
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email send error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
