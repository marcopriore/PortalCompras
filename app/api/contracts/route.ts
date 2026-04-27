import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import {
  contractFromRow,
  type ContractKind,
  isContractKind,
  isContractStatus,
  isContractType,
} from "@/types/contracts"

const CONTRACT_SELECT = `
  *,
  suppliers(name, code),
  payment_conditions(code, description)
`

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

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return {
    supabase,
    companyId,
    userId: user.id,
    isSuperAdmin,
  }
}

function addUtcDaysIso(base: Date, days: number): string {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  )
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")
    const supplierId = searchParams.get("supplier_id")
    const expiringDaysRaw = searchParams.get("expiring_days")

    let query = ctx.supabase
      .from("contracts")
      .select(CONTRACT_SELECT)
      .eq("company_id", ctx.companyId)
      .order("end_date", { ascending: true })

    if (statusFilter && isContractStatus(statusFilter)) {
      query = query.eq("status", statusFilter)
    }

    if (supplierId) {
      query = query.eq("supplier_id", supplierId)
    }

    if (expiringDaysRaw !== null && expiringDaysRaw !== "") {
      const n = parseInt(expiringDaysRaw, 10)
      if (!Number.isNaN(n) && n >= 0) {
        const today = new Date()
        const cutoff = addUtcDaysIso(today, n)
        query = query.lte("end_date", cutoff)
      }
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const contracts = (data ?? []).map((row) => contractFromRow(row))

    return NextResponse.json({ contracts })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as Record<string, unknown>
    const supplier_id = body.supplier_id
    const title = body.title
    const type = body.type
    const status = body.status
    const start_date = body.start_date
    const end_date = body.end_date

    if (typeof title !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    let supplierId: string | null = null
    if (supplier_id !== undefined && supplier_id !== null) {
      if (typeof supplier_id !== "string") {
        return NextResponse.json({ error: "Invalid supplier_id" }, { status: 400 })
      }
      supplierId = supplier_id
    }

    let typeValue: string = "fornecimento"
    if (type !== undefined && type !== null) {
      if (typeof type !== "string") {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 })
      }
      typeValue = type
    }
    if (!isContractType(typeValue)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }

    let statusValue: string = "draft"
    if (status !== undefined && status !== null) {
      if (typeof status !== "string") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      statusValue = status
    }
    if (!isContractStatus(statusValue)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    let contract_kind: ContractKind = "por_valor"
    if (body.contract_kind !== undefined && body.contract_kind !== null) {
      if (typeof body.contract_kind !== "string" || !isContractKind(body.contract_kind)) {
        return NextResponse.json({ error: "Invalid contract_kind" }, { status: 400 })
      }
      contract_kind = body.contract_kind
    }

    const { data: codeData, error: codeRpcError } = await ctx.supabase.rpc(
      "generate_contract_code",
      { p_company_id: ctx.companyId },
    )
    if (codeRpcError || typeof codeData !== "string" || !codeData) {
      return NextResponse.json(
        { error: codeRpcError?.message ?? "Falha ao gerar código do contrato." },
        { status: 500 },
      )
    }
    const generatedCode = codeData

    let startNorm: string | null = null
    if (start_date !== undefined && start_date !== null) {
      if (typeof start_date !== "string") {
        return NextResponse.json({ error: "Invalid start_date" }, { status: 400 })
      }
      startNorm = start_date.slice(0, 10)
    }

    let endNorm: string | null = null
    if (end_date !== undefined && end_date !== null) {
      if (typeof end_date !== "string") {
        return NextResponse.json({ error: "Invalid end_date" }, { status: 400 })
      }
      endNorm = end_date.slice(0, 10)
    }

    let value: number | null = null
    if (body.value !== undefined && body.value !== null) {
      const v =
        typeof body.value === "number" ? body.value : Number(body.value)
      if (Number.isNaN(v)) {
        return NextResponse.json({ error: "Invalid value" }, { status: 400 })
      }
      value = v
    }

    const notes =
      body.notes === undefined || body.notes === null
        ? null
        : String(body.notes)

    let payment_condition_id: string | null = null
    if (body.payment_condition_id !== undefined && body.payment_condition_id !== null) {
      if (typeof body.payment_condition_id !== "string") {
        return NextResponse.json(
          { error: "Invalid payment_condition_id" },
          { status: 400 },
        )
      }
      payment_condition_id = body.payment_condition_id
    }

    const contract_terms =
      body.contract_terms === undefined || body.contract_terms === null
        ? null
        : String(body.contract_terms)

    const erp_code =
      body.erp_code === undefined || body.erp_code === null
        ? null
        : String(body.erp_code)

    let quotation_id: string | null = null
    if (body.quotation_id !== undefined && body.quotation_id !== null) {
      if (typeof body.quotation_id !== "string") {
        return NextResponse.json({ error: "Invalid quotation_id" }, { status: 400 })
      }
      quotation_id = body.quotation_id
    }

    const { data: inserted, error } = await ctx.supabase
      .from("contracts")
      .insert({
        company_id: ctx.companyId,
        supplier_id: supplierId,
        code: generatedCode,
        title,
        type: typeValue,
        contract_kind,
        status: statusValue,
        start_date: startNorm,
        end_date: endNorm,
        value,
        notes,
        created_by: ctx.userId,
        payment_condition_id,
        contract_terms,
        erp_code,
        quotation_id,
      })
      .select(CONTRACT_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      contract: contractFromRow(inserted),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
