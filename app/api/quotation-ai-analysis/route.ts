import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

type QuotationRow = {
  id: string
  code: string
  category: string | null
  payment_condition: string | null
}

type QuotationItemRow = {
  id: string
  material_code: string | null
  material_description: string | null
  unit_of_measure: string | null
  quantity: number | null
  target_price: number | null
  average_price: number | null
  last_purchase_price: number | null
}

type ProposalRow = {
  supplier_id: string
  supplier_name: string | null
  supplier_code: string | null
  quotation_item_id: string | null
  unit_price: number | null
  delivery_days: number | null
  tax_percent: number | null
}

type ProposalAnalysis = {
  supplier_id: string
  supplier_name: string
  supplier_code: string
  unit_price: number
  delivery_days: number | null
  tax_percent: number | null
  desvio_vs_alvo: number | null
  desvio_vs_media: number | null
}

type ItemAnalysis = {
  quotation_item_id: string
  material_code: string
  material_description: string
  unit_of_measure: string
  quantity: number
  target_price: number | null
  average_price: number | null
  last_purchase_price: number | null
  proposals: ProposalAnalysis[]
}

type AnthropicUsage = {
  input_tokens?: number
  output_tokens?: number
}

type AnthropicContentBlock = {
  type: string
  text?: string
}

type AnthropicResponse = {
  content?: AnthropicContentBlock[]
  usage?: AnthropicUsage
}

async function getAuthedContext() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  let companyId = profile.company_id as string
  if (profile.is_superadmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return {
    supabase,
    companyId,
    userId: user.id,
  }
}

function parseRoundId(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY não configurada" },
        { status: 500 },
      )
    }

    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const quotationId = searchParams.get("quotation_id")
    const roundId = parseRoundId(searchParams.get("round_id"))

    if (!quotationId) {
      return NextResponse.json({ error: "quotation_id é obrigatório" }, { status: 400 })
    }

    const { data: quotation, error: quotationError } = await ctx.supabase
      .from("quotations")
      .select("id, code, category, payment_condition")
      .eq("id", quotationId)
      .eq("company_id", ctx.companyId)
      .maybeSingle<QuotationRow>()

    if (quotationError) {
      return NextResponse.json({ error: quotationError.message }, { status: 500 })
    }
    if (!quotation) {
      return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 })
    }

    const { data: quotationItemsData, error: quotationItemsError } = await ctx.supabase
      .from("quotation_items")
      .select(
        "id, material_code, material_description, unit_of_measure, quantity, target_price, average_price, last_purchase_price",
      )
      .eq("quotation_id", quotationId)

    if (quotationItemsError) {
      return NextResponse.json({ error: quotationItemsError.message }, { status: 500 })
    }

    const quotationItems = (quotationItemsData ?? []) as QuotationItemRow[]

    let proposalsQuery = ctx.supabase
      .from("quotation_proposals")
      .select(
        `
          supplier_id,
          suppliers(name, code),
          proposal_items(quotation_item_id, unit_price, delivery_days, tax_percent),
          quotation_rounds!inner(id, quotation_id)
        `,
      )
      .eq("company_id", ctx.companyId)
      .eq("status", "submitted")
      .eq("quotation_rounds.quotation_id", quotationId)

    if (roundId) {
      proposalsQuery = proposalsQuery.eq("round_id", roundId)
    }

    const { data: proposalsData, error: proposalsError } = await proposalsQuery

    if (proposalsError) {
      return NextResponse.json({ error: proposalsError.message }, { status: 500 })
    }

    const proposalRows: ProposalRow[] = []
    for (const proposal of proposalsData ?? []) {
      const supplier = Array.isArray(proposal.suppliers)
        ? proposal.suppliers[0]
        : proposal.suppliers
      const items = Array.isArray(proposal.proposal_items) ? proposal.proposal_items : []
      for (const item of items) {
        proposalRows.push({
          supplier_id: proposal.supplier_id as string,
          supplier_name: supplier?.name ?? null,
          supplier_code: supplier?.code ?? null,
          quotation_item_id: item?.quotation_item_id ?? null,
          unit_price: item?.unit_price ?? null,
          delivery_days: item?.delivery_days ?? null,
          tax_percent: item?.tax_percent ?? null,
        })
      }
    }

    const proposalsByItem = new Map<string, ProposalRow[]>()
    for (const proposal of proposalRows) {
      if (!proposal.quotation_item_id || proposal.unit_price === null) continue
      const list = proposalsByItem.get(proposal.quotation_item_id) ?? []
      list.push(proposal)
      proposalsByItem.set(proposal.quotation_item_id, list)
    }

    const itemsAnalysis: ItemAnalysis[] = quotationItems.map((item) => {
      const proposals = proposalsByItem.get(item.id) ?? []
      return {
        quotation_item_id: item.id,
        material_code: item.material_code ?? "",
        material_description: item.material_description ?? "",
        unit_of_measure: item.unit_of_measure ?? "",
        quantity: Number(item.quantity ?? 0),
        target_price: item.target_price,
        average_price: item.average_price,
        last_purchase_price: item.last_purchase_price,
        proposals: proposals.map((proposal) => {
          const unitPrice = Number(proposal.unit_price ?? 0)
          const desvioVsAlvo =
            item.target_price && item.target_price !== 0
              ? ((unitPrice - item.target_price) / item.target_price) * 100
              : null
          const desvioVsMedia =
            item.average_price && item.average_price !== 0
              ? ((unitPrice - item.average_price) / item.average_price) * 100
              : null

          return {
            supplier_id: proposal.supplier_id,
            supplier_name: proposal.supplier_name ?? "Fornecedor sem nome",
            supplier_code: proposal.supplier_code ?? "",
            unit_price: unitPrice,
            delivery_days: proposal.delivery_days,
            tax_percent: proposal.tax_percent,
            desvio_vs_alvo: desvioVsAlvo,
            desvio_vs_media: desvioVsMedia,
          }
        }),
      }
    })

    const itemsForPrompt = itemsAnalysis.map((item) => ({
      quotation_item_id: item.quotation_item_id,
      material_code: item.material_code,
      material_description: item.material_description.slice(0, 60),
      quantity: item.quantity,
      target_price: item.target_price,
      average_price: item.average_price,
      proposals: item.proposals.map((p) => ({
        supplier_name: p.supplier_name,
        supplier_id: p.supplier_id,
        unit_price: p.unit_price,
        delivery_days: p.delivery_days,
        desvio_vs_alvo:
          p.desvio_vs_alvo !== null ? Math.round(p.desvio_vs_alvo * 10) / 10 : null,
        desvio_vs_media:
          p.desvio_vs_media !== null ? Math.round(p.desvio_vs_media * 10) / 10 : null,
      })),
    }))

    const totalItems = itemsForPrompt.length
    const itemsComProposta = itemsForPrompt.filter((i) => i.proposals.length > 0).length
    const fornecedoresUnicos = new Set(
      itemsForPrompt.flatMap((i) => i.proposals.map((p) => p.supplier_id)),
    ).size
    const cobertura =
      totalItems > 0 ? Math.round((itemsComProposta / totalItems) * 100) : 0

    const systemPrompt = `Você é um especialista em procurement e negociação B2B.
Analise os dados de propostas de fornecedores e retorne uma análise estruturada
em JSON válido. Seja direto, objetivo e baseie-se apenas nos dados fornecidos.
Responda APENAS com JSON válido, sem texto adicional, sem markdown.
Seja extremamente conciso nas justificativas (máximo 80 caracteres).
Priorize JSON compacto sem espaços desnecessários.`

    const userPrompt = `Analise as propostas da cotação ${quotation.code} 
(categoria: ${quotation.category ?? "não informada"}) e retorne JSON com esta estrutura exata:

{
  "recomendacoes": [
    {
      "quotation_item_id": "uuid",
      "material_code": "código",
      "fornecedor_recomendado_id": "uuid ou null",
      "fornecedor_recomendado_nome": "nome ou null",
      "preco_recomendado": 0.00,
      "justificativa": "texto curto em português",
      "confianca": "alta|media|baixa"
    }
  ],
  "contrapropostas": [
    {
      "quotation_item_id": "uuid",
      "material_code": "código",
      "preco_atual_melhor": 0.00,
      "preco_sugerido": 0.00,
      "reducao_percentual": 0.0,
      "justificativa": "texto curto"
    }
  ],
  "alertas": [
    {
      "quotation_item_id": "uuid",
      "material_code": "código",
      "tipo": "acima_alvo|acima_media|sem_proposta|unico_fornecedor",
      "mensagem": "texto curto em português",
      "severidade": "alta|media|baixa"
    }
  ],
  "resumo_executivo": "parágrafo curto com visão geral da negociação"
}

IMPORTANTE: Responda com JSON compacto (sem identação).
Justificativas máximo 80 caracteres cada.

Contexto da cotação ${quotation.code}:
- Total de itens: ${totalItems}
- Itens com proposta: ${itemsComProposta} (${cobertura}% de cobertura)
- Fornecedores que responderam: ${fornecedoresUnicos}

INSTRUÇÕES IMPORTANTES:
- Se cobertura < 50%: no resumo_executivo, explique que a análise
  está incompleta pois poucos fornecedores responderam. Foque o
  resumo nisso, não em alertas individuais de "sem_proposta".
- Se fornecedoresUnicos === 1: mencione que há apenas 1 fornecedor
  e a comparação é limitada. Evite alertas "unico_fornecedor" para
  todos os itens — mencione apenas 1 vez no resumo.
- Alertas "sem_proposta": gerar APENAS se cobertura >= 50%.
  Caso contrário, omitir esses alertas e comentar no resumo.
- Alertas "unico_fornecedor": gerar APENAS 1 alerta geral,
  não um por item.
- Priorize alertas de desvio de preço (acima_alvo, acima_media)
  sobre alertas de ausência de proposta.
- Se não houver dados suficientes para análise significativa,
  diga isso claramente no resumo_executivo e retorne
  arrays vazios para recomendacoes, contrapropostas e alertas.

Dados das propostas:
${JSON.stringify(itemsForPrompt)}

Regras:
- Contrapropostas: sugerir apenas para itens onde TODOS os fornecedores 
  estão acima do target_price (quando target_price existe)
- Preço sugerido de contraproposta: target_price ou 95% do menor preço recebido
- Alertas "sem_proposta": itens sem nenhuma proposta submetida
- Alertas "unico_fornecedor": itens com apenas 1 fornecedor
- Se não houver contrapropostas ou alertas, retornar arrays vazios
- Justificativas: máximo 120 caracteres`

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.text()
      return NextResponse.json({ error: `Anthropic error: ${errBody}` }, { status: 502 })
    }

    const data = (await anthropicResponse.json()) as AnthropicResponse
    const rawText = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text ?? "")
      .join("")

    const cleanText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    let analysis: unknown
    try {
      analysis = JSON.parse(cleanText)
    } catch {
      console.error("[quotation-ai-analysis] parse error, raw:", cleanText.slice(0, 500))
      return NextResponse.json(
        { error: "Resposta inválida da IA", raw: cleanText.slice(0, 200) },
        { status: 502 },
      )
    }

    let logId: string | null = null
    try {
      const service = createServiceRoleClient()
      const { data: insertedLog, error: logError } = await service
        .from("ai_analysis_logs")
        .insert({
          company_id: ctx.companyId,
          entity: "quotation",
          entity_id: quotationId,
          analysis_type: "quotation_negotiation",
          prompt: userPrompt,
          response: cleanText,
          model: "claude-sonnet-4-20250514",
          input_tokens: data.usage?.input_tokens ?? null,
          output_tokens: data.usage?.output_tokens ?? null,
          created_by: ctx.userId,
        })
        .select("id")
        .single()

      if (!logError && insertedLog?.id) {
        logId = insertedLog.id as string
      }
    } catch (logError) {
      console.error("[quotation-ai-analysis] erro ao salvar log:", logError)
    }

    return NextResponse.json({
      analysis,
      generatedAt: new Date().toISOString(),
      quotationCode: quotation.code,
      roundId,
      logId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
