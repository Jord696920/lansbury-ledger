import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'ADD_IN_MORNING') {
    return Response.json({ error: 'Anthropic API key not configured' }, { status: 503 })
  }

  const { transaction } = await request.json()
  if (!transaction) {
    return Response.json({ error: 'No transaction provided' }, { status: 400 })
  }

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
        max_tokens: 1000,
        system: `You are an Australian tax deduction advisor for sole traders.
Always cite ATO rulings (TR, TD, PCG numbers) where applicable.
Be aggressive but compliant — push legal boundaries, flag audit risk level.
Business context: Vehicle sourcing consultant (ABN 18 650 448 336), heavy travel, home office (dedicated room, 5.05% floor area), 85% vehicle business use, QLD based.
Return ONLY valid JSON with no markdown, no code blocks:
{ "deductible": boolean, "confidence": "high"|"medium"|"low", "ato_reference": "string", "explanation": "string", "risk_level": "low"|"medium"|"high", "suggested_business_pct": number }`,
        messages: [{
          role: 'user',
          content: `Is this deductible? ${JSON.stringify(transaction)}`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return Response.json({ error: `Claude API error: ${err}` }, { status: 502 })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || '{}'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const advice = JSON.parse(cleaned)

    return Response.json(advice)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
