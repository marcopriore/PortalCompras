import { NextResponse } from "next/server"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { logAuditServer } from "@/lib/audit-server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  MAX_SUPPLIER_PORTAL_USERS,
  createSupplierPortalUser,
  listSupplierPortalUsers,
} from "@/lib/supplier-portal/users"

/** GET ?supplierId= — lista usuários do portal do fornecedor */
export async function GET(request: Request) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplierId")
    if (!supplierId) {
      return NextResponse.json({ error: "supplierId obrigatório." }, { status: 400 })
    }

    const supabaseAdmin = createServiceRoleClient()

    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("id")
      .eq("id", supplierId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
    }

    const users = await listSupplierPortalUsers(ctx.companyId, supplierId)

    return NextResponse.json({
      users,
      limit: MAX_SUPPLIER_PORTAL_USERS,
      canAdd: users.length < MAX_SUPPLIER_PORTAL_USERS,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** POST — cria usuário adicional (login por e-mail) */
export async function POST(request: Request) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as {
      supplierId?: string
      email?: string
      fullName?: string
      password?: string
    }

    if (!body.supplierId || !body.email?.trim() || !body.fullName?.trim() || !body.password) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 })
    }

    const supabaseAdmin = createServiceRoleClient()

    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("id, name, status")
      .eq("id", body.supplierId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
    }

    if (supplier.status !== "active") {
      return NextResponse.json({ error: "Fornecedor inativo." }, { status: 400 })
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("supplier_id", supplier.id)
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("status", "active")
      .maybeSingle()

    if (!adminProfile) {
      return NextResponse.json(
        {
          error:
            "Envie primeiro o convite ao administrador do fornecedor antes de adicionar usuários.",
        },
        { status: 400 },
      )
    }

    const result = await createSupplierPortalUser({
      companyId: ctx.companyId,
      supplierId: supplier.id,
      email: body.email,
      fullName: body.fullName,
      password: body.password,
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    await logAuditServer({
      eventType: "supplier.user_created",
      description: `Usuário adicional criado para fornecedor ${supplier.name}`,
      userId: ctx.userId,
      companyId: ctx.companyId,
      entity: "supplier",
      entityId: supplier.id,
      metadata: { newUserId: result.userId, email: body.email },
    })

    return NextResponse.json({ success: true, userId: result.userId })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
