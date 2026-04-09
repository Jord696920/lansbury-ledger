import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpUser || !smtpPass) {
    return NextResponse.json(
      { error: 'SMTP not configured' },
      { status: 503 }
    )
  }

  try {
    const { to, cc, subject, body, pdfBase64, filename } = await request.json()

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
      text: body,
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
