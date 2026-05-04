import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ParsedReceipt {
  vendor: string | null
  amount: number | null
  gst: number | null
  date: string | null
  description: string | null
  category: string | null
  business_use_pct: number
  confidence: number
  notes: string | null
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function extractJsonObject(text: string): string {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end   = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain a JSON object')
  }
  return trimmed.slice(start, end + 1)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function validDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function normaliseParsedReceipt(input: Partial<ParsedReceipt>): ParsedReceipt {
  const businessUse = Number(input.business_use_pct ?? 100)
  const confidence  = Number(input.confidence ?? 0)
  return {
    vendor:           typeof input.vendor === 'string' && input.vendor.trim() ? input.vendor.trim() : null,
    amount:           numberOrNull(input.amount),
    gst:              numberOrNull(input.gst),
    date:             validDateOrNull(input.date),
    description:      typeof input.description === 'string' && input.description.trim() ? input.description.trim() : null,
    category:         typeof input.category === 'string' && input.category.trim() ? input.category.trim() : null,
    business_use_pct: Number.isFinite(businessUse) ? clamp(businessUse, 0, 100) : 100,
    confidence:       Number.isFinite(confidence)  ? clamp(confidence, 0, 100)  : 0,
    notes:            typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null,
  }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an Australian tax receipt parser for a GST-registered sole trader (Jordan Lansbury, ABN 18 650 448 336, vehicle sourcing consultant).

Extract expense details from the email body/receipt text provided. Return ONLY valid JSON matching this schema:
{
  "vendor": string | null,
  "amount": number | null,
  "gst": number | null,
  "date": "YYYY-MM-DD" | null,
  "description": string | null,
  "category": string | null,
  "business_use_pct": number,
  "confidence": number,
  "notes": string | null
}

Category must be one of: Transport, Fuel, Vehicle Repairs, Subscriptions, Software, Phone/Internet, Insurance, Travel Meals, Office, Marketing, Accounting, Rego/Transfer, Other

Rules:
- amount = total paid in AUD including GST if applicable
- gst = GST component (amount / 11 for GST-registered AU vendors); 0 for overseas or non-registered
- For Uber/DiDi/taxi: category = Transport, business_use_pct = 100
- For fuel: category = Fuel, business_use_pct = 100
- For phone/internet: business_use_pct = 85
- For software/AI tools: business_use_pct = 100
- For subscriptions (AUTOGRAB etc.): business_use_pct = 100
- confidence = 0-100 based on clarity of the data
- Return ONLY the JSON object, no markdown, no explanation`

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model  = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 503 })
  }

  try {
    const body = await req.json()
    const rawBody: string = typeof body.raw_body === 'string' ? body.raw_body : ''

    if (!rawBody.trim()) {
      return NextResponse.json({ error: 'raw_body is required' }, { status: 400 })
    }

    const userContent = `Email subject: ${body.email_subject ?? '(none)'}
From: ${body.email_from ?? '(unknown)'}
Date: ${body.email_date ?? '(unknown)'}

Body:
${rawBody.slice(0, 8000)}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Anthropic error: ${txt}` }, { status: 502 })
    }

    const data = await res.json()
    const rawText: string = data.content?.[0]?.text ?? ''

    let parsed: ParsedReceipt
    try {
      parsed = normaliseParsedReceipt(JSON.parse(extractJsonObject(rawText)) as Partial<ParsedReceipt>)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI returned unparseable response'
      return NextResponse.json({ error: message, raw: rawText }, { status: 422 })
    }

    return NextResponse.json({ parsed, raw: rawText })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
