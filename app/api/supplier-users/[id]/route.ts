import { NextResponse } from "next/server"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { logAuditServer } from "@/lib/audit-server"
import { getSupplierPortalUser, updateSupplierPortalUserProfile } from "@/lib/supplier-portal/users"

type RouteCtx = { params: Promise<{ id: string }> }

/** PATCH — desativa ou reativa usuário do portal fornecedor (comprador) */
export async function PATCH(request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params
    const body = (await request.json()) as { status?: string; supplierId?: string }

    if (body.status !== "inactive" && body.status !== "active") {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 })
    }

    if (!body.supplierId) {
      return NextResponse.json({ error: "supplierId obrigatório." }, { status: 400 })
    }

    const profile = await getSupplierPortalUser(ctx.companyId, body.supplierId, id)

    if (!profile) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    if (profile.is_supplier_admin) {
      return NextResponse.json(
        { error: "O administrador não pode ser bloqueado pelo comprador." },
        { status: 400 },
      )
    }

    const result = await updateSupplierPortalUserProfile(id, {
      status: body.status as "active" | "inactive",
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await logAuditServer({
      eventType:
        body.status === "inactive" ? "supplier.user_deactivated" : "supplier.user_reactivated",
      description: `Usuário do portal fornecedor ${profile.full_name ?? id} — status ${body.status}`,
      userId: ctx.userId,
      companyId: ctx.companyId,
      entity: "profile",
      entityId: id,
      metadata: { supplierId: profile.supplier_id },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
