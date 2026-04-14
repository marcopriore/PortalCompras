import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

type PurchaseOrder = {
  id: string
  supplier_id: string | null
}

type PurchaseOrderItem = {
  purchase_order_id: string
  quotation_item_id: string | null
  unit_price: number
  quantity: number
}

type QuotationItem = {
  id: string
  category: string | null
  target_price: number | null
}

type Supplier = {
  id: string
  name: string
}

const VALID_PERIODS = new Set([30, 90, 180])
const ORDER_STATUSES = ["sent", "processing", "completed"]

function getPeriod(rawPeriod: string | null): number {
  const parsed = Number(rawPeriod ?? "30")
  if (!Number.isInteger(parsed) || !VALID_PERIODS.has(parsed)) {
    return 30
  }
  return parsed
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "N/A"
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const content = (payload as { content?: unknown }).content
  if (!Array.isArray(content)) return ""
  return content
    .map((chunk) => {
      if (
        chunk &&
        typeof chunk === "object" &&
        (chunk as { type?: string }).type === "text"
      ) {
        return (chunk as { text?: string }).text ?? ""
      }
      return ""
    })
    .join("\n")
    .trim()
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

    const { searchParams } = new URL(request.url)
    const period = getPeriod(searchParams.get("period"))

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const service = createServiceRoleClient()
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()

    const { data: purchaseOrdersData, error: purchaseOrdersError } = await service
      .from("purchase_orders")
      .select("id, supplier_id")
      .eq("company_id", profile.company_id)
      .in("status", ORDER_STATUSES)
      .gte("created_at", startDate)

    if (purchaseOrdersError) throw purchaseOrdersError

    const purchaseOrders = (purchaseOrdersData ?? []) as PurchaseOrder[]
    const purchaseOrderIds = purchaseOrders.map((po) => po.id)

    let purchaseOrderItems: PurchaseOrderItem[] = []
    if (purchaseOrderIds.length > 0) {
      const { data, error } = await service
        .from("purchase_order_items")
        .select("purchase_order_id, quotation_item_id, unit_price, quantity")
        .in("purchase_order_id", purchaseOrderIds)

      if (error) throw error
      purchaseOrderItems = (data ?? []) as PurchaseOrderItem[]
    }

    const quotationItemIds = Array.from(
      new Set(
        purchaseOrderItems
          .map((item) => item.quotation_item_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    let quotationItems: QuotationItem[] = []
    if (quotationItemIds.length > 0) {
      const { data, error } = await service
        .from("quotation_items")
        .select("id, category, target_price")
        .in("id", quotationItemIds)

      if (error) throw error
      quotationItems = (data ?? []) as QuotationItem[]
    }

    const quotationItemMap = new Map(quotationItems.map((item) => [item.id, item]))

    const spendByCategoryMap = new Map<string, number>()
    for (const item of purchaseOrderItems) {
      const qItem = item.quotation_item_id
        ? quotationItemMap.get(item.quotation_item_id)
        : undefined
      const category = qItem?.category?.trim() || "Sem categoria"
      const lineTotal = Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)
      spendByCategoryMap.set(category, (spendByCategoryMap.get(category) ?? 0) + lineTotal)
    }

    const spendPorCategoria = Array.from(spendByCategoryMap.entries())
      .map(([category, total_spend]) => ({ category, total_spend }))
      .sort((a, b) => b.total_spend - a.total_spend)
      .slice(0, 10)

    let totalPago = 0
    let totalAlvo = 0
    let totalOrdersWithTarget = 0
    for (const item of purchaseOrderItems) {
      const linePaid = Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)
      totalPago += linePaid
      const qItem = item.quotation_item_id
        ? quotationItemMap.get(item.quotation_item_id)
        : undefined
      if (qItem?.target_price !== null && qItem?.target_price !== undefined) {
        totalAlvo += Number(qItem.target_price) * Number(item.quantity ?? 0)
        totalOrdersWithTarget += 1
      }
    }

    const supplierIds = Array.from(
      new Set(
        purchaseOrders
          .map((po) => po.supplier_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    let suppliers: Supplier[] = []
    if (supplierIds.length > 0) {
      const { data, error } = await service
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds)

      if (error) throw error
      suppliers = (data ?? []) as Supplier[]
    }

    const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
    const supplierSpendMap = new Map<
      string,
      { name: string; total_spend: number; orderIds: Set<string> }
    >()

    for (const po of purchaseOrders) {
      if (!po.supplier_id) continue
      const supplierName = supplierMap.get(po.supplier_id) ?? "Fornecedor sem nome"
      if (!supplierSpendMap.has(po.supplier_id)) {
        supplierSpendMap.set(po.supplier_id, {
          name: supplierName,
          total_spend: 0,
          orderIds: new Set<string>(),
        })
      }
      const bucket = supplierSpendMap.get(po.supplier_id)!
      bucket.orderIds.add(po.id)
    }

    for (const item of purchaseOrderItems) {
      const order = purchaseOrders.find((po) => po.id === item.purchase_order_id)
      if (!order?.supplier_id) continue
      const bucket = supplierSpendMap.get(order.supplier_id)
      if (!bucket) continue
      bucket.total_spend += Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)
    }

    const topFornecedores = Array.from(supplierSpendMap.values())
      .map((supplier) => ({
        name: supplier.name,
        total_spend: supplier.total_spend,
        total_orders: supplier.orderIds.size,
      }))
      .sort((a, b) => b.total_spend - a.total_spend)
      .slice(0, 5)

    const { data: waitingQuotationsData, error: waitingQuotationsError } = await service
      .from("quotations")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("status", "waiting")

    if (waitingQuotationsError) throw waitingQuotationsError

    const waitingQuotationIds = (waitingQuotationsData ?? []).map((q) => q.id as string)

    let semProposta = waitingQuotationIds.length
    if (waitingQuotationIds.length > 0) {
      const { data: roundsData, error: roundsError } = await service
        .from("quotation_rounds")
        .select("id, quotation_id")
        .in("quotation_id", waitingQuotationIds)

      if (roundsError) throw roundsError

      const rounds = (roundsData ?? []) as { id: string; quotation_id: string }[]
      const roundIds = rounds.map((round) => round.id)
      const roundToQuotation = new Map(rounds.map((round) => [round.id, round.quotation_id]))

      let quotationsWithSubmitted = new Set<string>()
      if (roundIds.length > 0) {
        const { data: submittedData, error: submittedError } = await service
          .from("quotation_proposals")
          .select("round_id")
          .in("round_id", roundIds)
          .eq("status", "submitted")

        if (submittedError) throw submittedError

        quotationsWithSubmitted = new Set(
          (submittedData ?? [])
            .map((proposal) => roundToQuotation.get(proposal.round_id as string))
            .filter((quotationId): quotationId is string => Boolean(quotationId)),
        )
      }

      semProposta = waitingQuotationIds.filter(
        (quotationId) => !quotationsWithSubmitted.has(quotationId),
      ).length
    }

    const desvioPercent =
      totalAlvo > 0 ? ((totalPago - totalAlvo) / totalAlvo) * 100 : null

    const anthropicPayload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "Você é um analista de procurement especializado. Analise os dados fornecidos e gere um resumo executivo em português brasileiro com 4 a 6 insights acionáveis. Seja direto, objetivo e use linguagem de negócio. Formate a resposta como tópicos com emoji no início de cada insight. Não invente dados que não estejam no contexto.",
      messages: [
        {
          role: "user",
          content: `Analise os dados de procurement dos últimos ${period} dias e gere insights executivos:

SPEND POR CATEGORIA:
${JSON.stringify(
            spendPorCategoria.map((row) => ({
              category: row.category,
              total_spend: formatCurrency(row.total_spend),
            })),
            null,
            2,
          )}

SAVING VS ALVO:
- Total pago: ${formatCurrency(totalPago)}
- Total alvo: ${totalAlvo > 0 ? formatCurrency(totalAlvo) : "N/A"}
- Desvio: ${formatPercent(desvioPercent)}

TOP FORNECEDORES:
${JSON.stringify(
            topFornecedores.map((row) => ({
              name: row.name,
              total_spend: formatCurrency(row.total_spend),
              total_orders: row.total_orders,
            })),
            null,
            2,
          )}

COTAÇÕES AGUARDANDO PROPOSTA: ${semProposta}
`,
        },
      ],
    }

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(anthropicPayload),
    })

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text()
      return NextResponse.json(
        {
          error: `Falha ao gerar insights na Anthropic (status ${anthropicResponse.status})`,
          details: errorBody,
        },
        { status: 502 },
      )
    }

    const anthropicJson = (await anthropicResponse.json()) as unknown
    const insights = extractAnthropicText(anthropicJson)

    return NextResponse.json({
      insights,
      generatedAt: new Date().toISOString(),
      period,
      dataSnapshot: {
        totalPago,
        totalAlvo: totalAlvo > 0 ? totalAlvo : null,
        desvioPercent,
        topCategoria: spendPorCategoria[0]?.category ?? null,
        totalOrders: purchaseOrders.length || totalOrdersWithTarget,
      },
    })
  } catch (error) {
    console.error("ai-spend-analysis GET:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
