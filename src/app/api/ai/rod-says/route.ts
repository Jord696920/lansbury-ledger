import { createServiceClient } from '@/lib/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'ADD_IN_MORNING') {
    return Response.json({ error: 'Anthropic API key not configured' }, { status: 503 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  // Gather context: last 3 months of invoices, BAS data, basic stats
  const threeMonthsAgo = format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd')
  const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [
    { data: recentInvoices },
    { data: allInvoices },
    { data: basPeriods },
    { data: profile },
    { count: missingReceipts },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('total, subtotal, gst_amount, issue_date, status, customer_name')
      .gte('issue_date', threeMonthsAgo)
      .lte('issue_date', thisMonthEnd)
      .neq('status', 'void')
      .order('issue_date', { ascending: false }),
    supabase
      .from('invoices')
      .select('total, issue_date, status')
      .gte('issue_date', '2025-07-01')
      .neq('status', 'void'),
    supabase
      .from('bas_periods')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(4),
    supabase
      .from('business_profile')
      .select('*')
      .limit(1)
      .single(),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .lt('amount', -82.50)
      .is('receipt_url', null)
      .eq('is_personal', false),
  ])

  // Build context summary for the AI
  const recentRevenue = (recentInvoices ?? []).reduce((s, inv) => s + inv.total, 0)
  const ytdRevenue = (allInvoices ?? []).reduce((s, inv) => s + inv.total, 0)
  const invoiceCount3mo = (recentInvoices ?? []).length
  const topCustomers = [...new Set((recentInvoices ?? []).map((inv) => inv.customer_name))].slice(0, 5)

  // Monthly breakdown
  const monthlyRevenues: { month: string; total: number }[] = []
  for (let i = 2; i >= 0; i--) {
    const d = subMonths(now, i)
    const ms = format(startOfMonth(d), 'yyyy-MM-dd')
    const me = format(endOfMonth(d), 'yyyy-MM-dd')
    const rev = (recentInvoices ?? [])
      .filter((inv) => inv.issue_date >= ms && inv.issue_date <= me)
      .reduce((s, inv) => s + inv.total, 0)
    monthlyRevenues.push({ month: format(d, 'MMM yyyy'), total: Math.round(rev) })
  }

  const basContext = (basPeriods ?? []).map((p) => ({
    period: p.period_label,
    status: p.status,
    gstCollected: p.gst_collected,
    gstCredits: p.gst_credits,
    netGST: p.net_gst,
  }))

  const context = {
    businessName: profile?.business_name ?? 'Jordan Lansbury',
    today: format(now, 'EEEE d MMMM yyyy'),
    ytdRevenue: Math.round(ytdRevenue),
    last3moRevenue: Math.round(recentRevenue),
    last3moInvoiceCount: invoiceCount3mo,
    monthlyBreakdown: monthlyRevenues,
    topCustomers,
    basStatus: basContext,
    missingReceiptCount: missingReceipts ?? 0,
    monthlyTarget: 10000,
    eofyDays: Math.max(0, Math.ceil((new Date(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear(), 5, 30).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: `You are Rod, a sharp, no-nonsense Australian accountant who gives weekly business briefs to Jordan Lansbury, a sole trader vehicle sourcer in QLD. You speak in short, direct Aussie English. You're blunt but supportive — like a mate who happens to be a gun accountant.

Rules:
- Keep it under 150 words total
- Lead with the most important thing (revenue trend, BAS deadline, or a concern)
- Use AUD dollar values, no cents
- Reference actual data provided — never make up numbers
- If EOFY is within 90 days, make that a priority
- If BAS is due soon, mention it
- End with ONE specific action item
- Don't use corporate jargon. Talk like a real person.
- Never use the word "robust" or "leverage"`,
        messages: [{
          role: 'user',
          content: `Here's the latest data for Rod's weekly brief:\n${JSON.stringify(context, null, 2)}`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return Response.json({ error: `Claude API error: ${err}` }, { status: 502 })
    }

    const result = await response.json()
    const brief = result.content?.[0]?.text || ''

    return Response.json({
      brief,
      generatedAt: now.toISOString(),
      context: {
        ytdRevenue: context.ytdRevenue,
        last3moRevenue: context.last3moRevenue,
        eofyDays: context.eofyDays,
      },
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
