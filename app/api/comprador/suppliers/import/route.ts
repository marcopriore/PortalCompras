import { NextResponse } from "next/server"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { logAuditServer } from "@/lib/audit-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { normalizeImportedEmail } from "@/lib/utils/excel-cell"

type ImportSupplierRow = {
  code: string
  name: string
  cnpj?: string
  email?: string
  phone?: string
  category?: string
  city?: string
  state?: string
  status: "active" | "inactive"
}

async function assertMasterAdmin(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles, is_superadmin")
    .eq("id", userId)
    .maybeSingle()

  if (!profile) return false
  if (profile.is_superadmin) return true
  const roles = Array.isArray(profile.roles)
    ? profile.roles
    : profile.role
      ? [profile.role]
      : []
  return roles.includes("admin")
}

/** POST — importação Excel de fornecedores (service role; bypass RLS) */
export async function POST(request: Request) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const isAdmin = await assertMasterAdmin(ctx.userId)
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json()) as { rows?: ImportSupplierRow[] }
    const rows = body.rows ?? []
    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha para importar." }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    let success = 0
    const errorDetails: string[] = []

    for (const row of rows) {
      if (!row.code?.trim() || !row.name?.trim()) {
        errorDetails.push(`${row.code || "?"}: código e nome são obrigatórios.`)
        continue
      }

      const payload = {
        company_id: ctx.companyId,
        code: row.code.trim(),
        name: row.name.trim(),
        cnpj: row.cnpj?.trim() || null,
        email: normalizeImportedEmail(row.email),
        phone: row.phone?.trim() || null,
        category: row.category?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
        status: row.status === "inactive" ? "inactive" : "active",
      }

      const { data: existing } = await supabase
        .from("suppliers")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("code", payload.code)
        .maybeSingle()

      const { error } = existing
        ? await supabase.from("suppliers").update(payload).eq("id", existing.id)
        : await supabase.from("suppliers").insert(payload)

      if (error?.message) {
        errorDetails.push(`${payload.code}: ${error.message}`)
      } else {
        success++
      }
    }

    await logAuditServer({
      eventType: "supplier.import_excel",
      description: `Importação Excel: ${success} fornecedor(es), ${errorDetails.length} erro(s)`,
      userId: ctx.userId,
      companyId: ctx.companyId,
      entity: "suppliers",
      metadata: { success, errors: errorDetails.length, source: "excel" },
    })

    return NextResponse.json({
      success,
      errors: errorDetails.length,
      errorDetails,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
