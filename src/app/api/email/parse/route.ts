import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 503 })
  }

  try {
    const { raw_body, email_subject, email_from, email_date } = await req.json()

    if (!raw_body?.trim()) {
      return NextResponse.json({ error: 'raw_body is required' }, { status: 400 })
    }

    const userContent = `Email subject: ${email_subject ?? '(none)'}
From: ${email_from ?? '(unknown)'}
Date: ${email_date ?? '(unknown)'}

Body:
${(raw_body as string).slice(0, 8000)}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
      parsed = JSON.parse(rawText.trim()) as ParsedReceipt
    } catch {
      return NextResponse.json({ error: 'AI returned unparseable response', raw: rawText }, { status: 422 })
    }

    return NextResponse.json({ parsed, raw: rawText })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
