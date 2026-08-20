import { NextResponse } from "next/server"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { logAuditServer } from "@/lib/audit-server"
import {
  getSupplierPortalUser,
  resetSupplierPortalUserPassword,
  updateSupplierPortalUserProfile,
} from "@/lib/supplier-portal/users"

type RouteCtx = { params: Promise<{ id: string }> }

type PatchBody = {
  supplierId?: string
  status?: string
  newPassword?: string
  action?: "reset_password"
}

/** PATCH — desativa/reativa ou redefine senha de usuário do portal fornecedor (comprador) */
export async function PATCH(request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params
    const body = (await request.json()) as PatchBody

    if (!body.supplierId) {
      return NextResponse.json({ error: "supplierId obrigatório." }, { status: 400 })
    }

    const profile = await getSupplierPortalUser(ctx.companyId, body.supplierId, id)

    if (!profile) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    if (body.action === "reset_password" || body.newPassword) {
      if (!body.newPassword?.trim()) {
        return NextResponse.json({ error: "Informe a nova senha." }, { status: 400 })
      }

      const result = await resetSupplierPortalUserPassword(
        id,
        ctx.companyId,
        body.newPassword,
      )
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      await logAuditServer({
        eventType: "supplier.user_updated",
        description: `Senha redefinida para usuário do portal fornecedor ${profile.full_name ?? id}${profile.is_supplier_admin ? " (admin)" : ""}`,
        userId: ctx.userId,
        companyId: ctx.companyId,
        entity: "profile",
        entityId: id,
        metadata: {
          supplierId: profile.supplier_id,
          action: "reset_password",
          isSupplierAdmin: profile.is_supplier_admin,
        },
      })

      return NextResponse.json({ success: true })
    }

    if (body.status !== "inactive" && body.status !== "active") {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 })
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
