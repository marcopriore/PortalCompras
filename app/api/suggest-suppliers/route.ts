import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

type Suggestion = {
  id: string
  name: string
  code: string
  origin: "cadastro" | "historico"
  score: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const quotationId = searchParams.get("quotation_id")
    const categoryParam = searchParams.get("category")
    const excludeIdsParam = searchParams.get("exclude_ids")
    const excludedFromParam =
      excludeIdsParam?.split(",").map((s) => s.trim()).filter(Boolean) ?? []

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()
    if (!profile?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const companyId = profile.company_id as string

    let quotationCategory: string
    let alreadyAdded: Set<string>

    if (quotationId) {
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .select("category")
        .eq("id", quotationId)
        .eq("company_id", companyId)
        .single()

      if (quotationError || !quotation) {
        return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
      }

      quotationCategory = (quotation.category as string | null)?.trim() ?? ""
      if (!quotationCategory) {
        return NextResponse.json({ category: "", suggestions: [] })
      }

      const { data: alreadyAddedRows } = await supabase
        .from("quotation_suppliers")
        .select("supplier_id")
        .eq("quotation_id", quotationId)

      alreadyAdded = new Set(
        (alreadyAddedRows ?? [])
          .map((row) => row.supplier_id as string | null)
          .filter((id): id is string => Boolean(id)),
      )
    } else if (categoryParam !== null) {
      quotationCategory = categoryParam.trim()
      if (!quotationCategory) {
        return NextResponse.json({ category: "", suggestions: [] })
      }
      alreadyAdded = new Set(excludedFromParam)
    } else {
      return NextResponse.json(
        { error: "Missing quotation_id or category" },
        { status: 400 },
      )
    }

    const { data: scoreRows } = await supabase
      .from("quotation_suppliers")
      .select("supplier_id, quotations!inner(category, company_id)")
      .eq("quotations.company_id", companyId)
      .eq("quotations.category", quotationCategory)

    const scoreMap = new Map<string, number>()
    for (const row of (scoreRows ?? []) as {
      supplier_id: string | null
    }[]) {
      if (!row.supplier_id) continue
      scoreMap.set(row.supplier_id, (scoreMap.get(row.supplier_id) ?? 0) + 1)
    }

    const { data: cadastroRows } = await supabase
      .from("supplier_categories")
      .select("supplier_id, suppliers!inner(id, name, code, status)")
      .eq("company_id", companyId)
      .eq("category", quotationCategory)

    const cadastroSuggestions: Suggestion[] = []
    const cadastroIds = new Set<string>()
    for (const row of (cadastroRows ?? []) as {
      supplier_id: string
      suppliers:
        | { id: string; name: string; code: string; status: string | null }
        | { id: string; name: string; code: string; status: string | null }[]
    }[]) {
      const supplierRaw = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers
      if (!supplierRaw || supplierRaw.status !== "active") continue
      if (alreadyAdded.has(supplierRaw.id)) continue
      if (cadastroIds.has(supplierRaw.id)) continue

      cadastroIds.add(supplierRaw.id)
      cadastroSuggestions.push({
        id: supplierRaw.id,
        name: supplierRaw.name,
        code: supplierRaw.code,
        origin: "cadastro",
        score: scoreMap.get(supplierRaw.id) ?? 0,
      })
    }

    cadastroSuggestions.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))

    const { data: historicoRows } = await supabase
      .from("quotation_suppliers")
      .select(
        "supplier_id, suppliers!inner(id, name, code, status), quotations!inner(category, company_id)",
      )
      .eq("quotations.company_id", companyId)
      .eq("quotations.category", quotationCategory)

    const historicoSuggestionsMap = new Map<string, Suggestion>()
    for (const row of (historicoRows ?? []) as {
      supplier_id: string | null
      suppliers:
        | { id: string; name: string; code: string; status: string | null }
        | { id: string; name: string; code: string; status: string | null }[]
    }[]) {
      const supplierRaw = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers
      if (!supplierRaw || supplierRaw.status !== "active") continue
      if (alreadyAdded.has(supplierRaw.id)) continue
      if (cadastroIds.has(supplierRaw.id)) continue
      if (historicoSuggestionsMap.has(supplierRaw.id)) continue

      historicoSuggestionsMap.set(supplierRaw.id, {
        id: supplierRaw.id,
        name: supplierRaw.name,
        code: supplierRaw.code,
        origin: "historico",
        score: scoreMap.get(supplierRaw.id) ?? 0,
      })
    }

    const historicoSuggestions = Array.from(historicoSuggestionsMap.values())
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 10)

    const suggestions = [...cadastroSuggestions, ...historicoSuggestions].map(
      ({ score: _score, ...suggestion }) => suggestion,
    )

    return NextResponse.json({
      category: quotationCategory,
      suggestions,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
