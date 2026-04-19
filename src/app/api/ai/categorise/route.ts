import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { guardApiRoute } from '@/lib/api-guard'

export async function POST(request: NextRequest) {
  const blocked = guardApiRoute(request, { limit: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'ADD_IN_MORNING') {
    return Response.json({ error: 'Anthropic API key not configured' }, { status: 503 })
  }

  const { transactions } = await request.json()
  if (!transactions?.length) {
    return Response.json({ error: 'No transactions provided' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: accounts } = await supabase
    .from('accounts')
    .select('code, name, type, tax_code, business_use_pct')
    .eq('is_active', true)
    .order('sort_order')

  const chartOfAccounts = accounts?.map((a) => ({
    code: a.code,
    name: a.name,
    type: a.type,
    tax_code: a.tax_code,
    business_use_pct: a.business_use_pct,
  }))

  const txnBatch = transactions.slice(0, 50).map((t: { id: string; description: string; amount: number; date: string }) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    date: t.date,
  }))

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `You are an Australian sole trader accounting categorisation engine.
Business: Vehicle sourcing consultant, ABN 18 650 448 336, QLD.
Chart of accounts: ${JSON.stringify(chartOfAccounts)}
Rules: Fuel purchases (BP, AMPOL, CALTEX, SHELL, 7-ELEVEN fuel) = 85% business use. Phone/Internet = 85%. Meals = 50% if client-related. Streaming = 30%. Bank fees = 100%. Insurance (rego) = GST-Free.
Return ONLY a valid JSON array with no markdown formatting, no code blocks.`,
        messages: [{
          role: 'user',
          content: `Categorise these bank transactions. Return JSON array:
[{ "id": "txn_id", "category_code": "6-1010", "category_name": "Fuel & Oil", "confidence": 0.95, "gst_treatment": "GST", "business_use_pct": 85, "reasoning": "brief reason" }]

Transactions:
${JSON.stringify(txnBatch)}`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return Response.json({ error: `Claude API error: ${err}` }, { status: 502 })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || '[]'

    // Parse the JSON response (handle potential markdown wrapping)
    let suggestions
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      suggestions = JSON.parse(cleaned)
    } catch {
      return Response.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 })
    }

    // Update transactions with AI suggestions
    for (const s of suggestions) {
      if (!s.id || !s.category_code) continue
      await supabase
        .from('transactions')
        .update({
          ai_category_suggestion: s.category_code,
          ai_confidence: s.confidence,
        })
        .eq('id', s.id)

      // Auto-categorise high confidence (>90%)
      if (s.confidence >= 0.9) {
        const account = accounts?.find((a) => a.code === s.category_code)
        if (account) {
          await supabase
            .from('transactions')
            .update({
              account_id: (account as unknown as { id: string }).id || undefined,
              ai_category_suggestion: s.category_code,
              ai_confidence: s.confidence,
              business_use_pct: s.business_use_pct,
            })
            .eq('id', s.id)
            .is('account_id', null) // Only if not already categorised
        }
      }
    }

    return Response.json({ suggestions, count: suggestions.length })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
