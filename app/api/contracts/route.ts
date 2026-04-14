import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  type ContractStatus,
  type ContractType,
  contractFromRow,
} from "@/types/contracts"

const CONTRACT_SELECT = `
  id,
  company_id,
  supplier_id,
  code,
  title,
  type,
  status,
  start_date,
  end_date,
  value,
  file_url,
  notes,
  created_by,
  created_at,
  updated_at,
  suppliers!inner ( name, code )
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
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  return {
    supabase,
    companyId: profile.company_id as string,
    userId: user.id,
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

    if (statusFilter && CONTRACT_STATUSES.includes(statusFilter as ContractStatus)) {
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
    const code = body.code
    const title = body.title
    const type = body.type
    const status = body.status
    const start_date = body.start_date
    const end_date = body.end_date

    if (
      typeof supplier_id !== "string" ||
      typeof code !== "string" ||
      typeof title !== "string" ||
      typeof type !== "string" ||
      typeof status !== "string" ||
      typeof start_date !== "string" ||
      typeof end_date !== "string"
    ) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    if (!CONTRACT_TYPES.includes(type as ContractType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }
    if (!CONTRACT_STATUSES.includes(status as ContractStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const startNorm = start_date.slice(0, 10)
    const endNorm = end_date.slice(0, 10)

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

    const { data: inserted, error } = await ctx.supabase
      .from("contracts")
      .insert({
        company_id: ctx.companyId,
        supplier_id,
        code,
        title,
        type,
        status,
        start_date: startNorm,
        end_date: endNorm,
        value,
        notes,
        created_by: ctx.userId,
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
