import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import {
  contractFromRow,
  contractItemFromRow,
  type Contract,
} from "@/types/contracts"
import {
  buildContractMatchesCacheKey,
  getContractMatchesCached,
  hashContractMatchSelections,
  setContractMatchesCache,
} from "@/lib/contracts/contract-matches-cache"
import {
  findContractMatchesForQuotationItem,
  pickBestContractMatch,
  contractLinkFromMatch,
  type QuotationItemMatchInput,
} from "@/lib/contracts/match-contract-items"
import { tenantHasContractBalance } from "@/lib/contracts/contract-balance-settings"

async function getBuyerContext() {
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

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return { supabase, companyId }
}

type RouteCtx = { params: Promise<{ id: string }> }

type SelectionInput = {
  quotationItemId: string
  supplierId: string
  materialCode: string
  quantity: number
}

const MAX_SELECTIONS = 500

type ContractMatchResponseItem = {
  quotationItemId: string
  supplierId: string
  candidates: ReturnType<typeof findContractMatchesForQuotationItem>
  suggested: ReturnType<typeof contractLinkFromMatch> | null
}

export async function POST(request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const contractBalanceEnabled = await tenantHasContractBalance(
      ctx.supabase,
      ctx.companyId,
    )
    if (!contractBalanceEnabled) {
      return NextResponse.json(
        { error: "Funcionalidade Consumo de Contrato não habilitada" },
        { status: 403 },
      )
    }

    const { id: quotationId } = await context.params

    const { data: quotation, error: quotationErr } = await ctx.supabase
      .from("quotations")
      .select("id")
      .eq("id", quotationId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (quotationErr) {
      return NextResponse.json({ error: quotationErr.message }, { status: 500 })
    }
    if (!quotation) {
      return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 })
    }

    const body = (await request.json()) as { selections?: SelectionInput[] }

    const selections = body.selections
    if (!Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json({ error: "Seleções inválidas" }, { status: 400 })
    }
    if (selections.length > MAX_SELECTIONS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_SELECTIONS} seleções por requisição` },
        { status: 400 },
      )
    }

    const inputs: QuotationItemMatchInput[] = []
    for (const row of selections) {
      if (
        typeof row.quotationItemId !== "string" ||
        typeof row.supplierId !== "string" ||
        typeof row.materialCode !== "string" ||
        typeof row.quantity !== "number"
      ) {
        return NextResponse.json({ error: "Seleção inválida" }, { status: 400 })
      }
      inputs.push({
        quotationItemId: row.quotationItemId,
        supplierId: row.supplierId,
        materialCode: row.materialCode,
        quantity: row.quantity,
      })
    }

    const cacheKey = buildContractMatchesCacheKey(
      ctx.companyId,
      quotationId,
      hashContractMatchSelections(inputs),
    )
    const cached = getContractMatchesCached<{ items: ContractMatchResponseItem[] }>(
      cacheKey,
    )
    if (cached) {
      return NextResponse.json(cached)
    }

    const supplierIds = [...new Set(inputs.map((i) => i.supplierId))]

    const { data: contractRows, error: contractErr } = await ctx.supabase
      .from("contracts")
      .select(
        `
        *,
        contract_items(*)
      `,
      )
      .eq("company_id", ctx.companyId)
      .eq("status", "active")
      .in("supplier_id", supplierIds)

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }

    const contracts: Contract[] = (contractRows ?? []).map((row) => {
      const c = contractFromRow(row)
      const rawItems = (row as { contract_items?: unknown[] }).contract_items
      c.items = Array.isArray(rawItems)
        ? rawItems.map(contractItemFromRow)
        : []
      return c
    })

    const items: ContractMatchResponseItem[] = inputs.map((input) => {
      const candidates = findContractMatchesForQuotationItem(
        quotationId,
        input,
        contracts,
      )
      const suggested = pickBestContractMatch(candidates)
      return {
        quotationItemId: input.quotationItemId,
        supplierId: input.supplierId,
        candidates,
        suggested: suggested ? contractLinkFromMatch(suggested) : null,
      }
    })

    const responseBody = { items }
    setContractMatchesCache(cacheKey, responseBody)
    return NextResponse.json(responseBody)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
