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

  return { supabase, companyId: profile.company_id as string }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params

    const { data, error } = await ctx.supabase
      .from("contracts")
      .select(CONTRACT_SELECT)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      contract: contractFromRow(data),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>

    const patch: Record<string, unknown> = {}

    if (body.supplier_id !== undefined) {
      if (typeof body.supplier_id !== "string") {
        return NextResponse.json({ error: "Invalid supplier_id" }, { status: 400 })
      }
      patch.supplier_id = body.supplier_id
    }
    if (body.code !== undefined) {
      if (typeof body.code !== "string") {
        return NextResponse.json({ error: "Invalid code" }, { status: 400 })
      }
      patch.code = body.code
    }
    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 })
      }
      patch.title = body.title
    }
    if (body.type !== undefined) {
      if (
        typeof body.type !== "string" ||
        !CONTRACT_TYPES.includes(body.type as ContractType)
      ) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 })
      }
      patch.type = body.type
    }
    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !CONTRACT_STATUSES.includes(body.status as ContractStatus)
      ) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      patch.status = body.status
    }
    if (body.start_date !== undefined) {
      if (typeof body.start_date !== "string") {
        return NextResponse.json({ error: "Invalid start_date" }, { status: 400 })
      }
      patch.start_date = body.start_date.slice(0, 10)
    }
    if (body.end_date !== undefined) {
      if (typeof body.end_date !== "string") {
        return NextResponse.json({ error: "Invalid end_date" }, { status: 400 })
      }
      patch.end_date = body.end_date.slice(0, 10)
    }
    if (body.value !== undefined) {
      if (body.value === null) {
        patch.value = null
      } else {
        const v =
          typeof body.value === "number" ? body.value : Number(body.value)
        if (Number.isNaN(v)) {
          return NextResponse.json({ error: "Invalid value" }, { status: 400 })
        }
        patch.value = v
      }
    }
    if (body.notes !== undefined) {
      patch.notes =
        body.notes === null ? null : String(body.notes)
    }
    if (body.file_url !== undefined) {
      patch.file_url =
        body.file_url === null ? null : String(body.file_url)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from("contracts")
      .update(patch)
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select(CONTRACT_SELECT)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      contract: contractFromRow(data),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params

    const { data: deleted, error } = await ctx.supabase
      .from("contracts")
      .delete()
      .eq("id", id)
      .eq("company_id", ctx.companyId)
      .select("id")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!deleted?.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
