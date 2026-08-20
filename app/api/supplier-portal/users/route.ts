import { NextResponse } from "next/server"
import { getSupplierContext } from "@/lib/auth/supplier-context"
import { logAuditServer } from "@/lib/audit-server"
import {
  MAX_SUPPLIER_PORTAL_USERS,
  countSupplierPortalUsers,
  createSupplierPortalUser,
  listSupplierPortalUsers,
} from "@/lib/supplier-portal/users"

/** GET — lista usuários do fornecedor logado */
export async function GET() {
  try {
    const ctx = await getSupplierContext()
    if ("error" in ctx) return ctx.error

    const users = await listSupplierPortalUsers(ctx.companyId, ctx.supplierId)
    const total = users.length

    return NextResponse.json({
      users,
      total,
      limit: MAX_SUPPLIER_PORTAL_USERS,
      canAdd: total < MAX_SUPPLIER_PORTAL_USERS,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** POST — adiciona usuário (não-admin) */
export async function POST(request: Request) {
  try {
    const ctx = await getSupplierContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as {
      email?: string
      fullName?: string
      password?: string
    }

    if (!body.email?.trim() || !body.fullName?.trim() || !body.password) {
      return NextResponse.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 })
    }

    const result = await createSupplierPortalUser({
      companyId: ctx.companyId,
      supplierId: ctx.supplierId,
      email: body.email,
      fullName: body.fullName,
      password: body.password,
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    await logAuditServer({
      eventType: "supplier.user_created",
      description: `Usuário ${body.fullName.trim()} criado pelo portal do fornecedor`,
      userId: ctx.userId,
      companyId: ctx.companyId,
      entity: "profile",
      entityId: result.userId,
      metadata: { supplierId: ctx.supplierId, createdBy: "supplier_portal" },
    })

    return NextResponse.json({ success: true, userId: result.userId })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
