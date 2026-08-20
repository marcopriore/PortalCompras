import { NextResponse } from "next/server"
import { getSupplierContext } from "@/lib/auth/supplier-context"
import { logAuditServer } from "@/lib/audit-server"
import {
  cancelSupplierPortalUser,
  getSupplierPortalUser,
  resetSupplierPortalUserPassword,
  updateSupplierPortalUserEmail,
  updateSupplierPortalUserProfile,
} from "@/lib/supplier-portal/users"

type RouteCtx = { params: Promise<{ id: string }> }

type PatchBody = {
  action?: "block" | "unblock" | "cancel" | "update"
  email?: string
  fullName?: string
  newPassword?: string
}

/** PATCH — bloquear, reativar, cancelar ou atualizar usuário */
export async function PATCH(request: Request, context: RouteCtx) {
  try {
    const ctx = await getSupplierContext()
    if ("error" in ctx) return ctx.error

    const { id } = await context.params
    const body = (await request.json()) as PatchBody

    const profile = await getSupplierPortalUser(ctx.companyId, ctx.supplierId, id)

    if (!profile) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    if (profile.is_supplier_admin) {
      if (body.action === "cancel" || body.action === "block") {
        return NextResponse.json(
          { error: "O administrador não pode ser bloqueado ou cancelado." },
          { status: 400 },
        )
      }
      if (body.action === "update" || body.email) {
        if (!body.email?.trim()) {
          return NextResponse.json({ error: "Informe o e-mail." }, { status: 400 })
        }
        const emailResult = await updateSupplierPortalUserEmail(id, body.email)
        if (emailResult.error) {
          return NextResponse.json({ error: emailResult.error }, { status: 400 })
        }
        if (body.fullName?.trim()) {
          await updateSupplierPortalUserProfile(id, { fullName: body.fullName })
        }
        await logAuditServer({
          eventType: "supplier.user_updated",
          description: "E-mail do administrador atualizado",
          userId: ctx.userId,
          companyId: ctx.companyId,
          entity: "profile",
          entityId: id,
          metadata: { supplierId: ctx.supplierId },
        })
        return NextResponse.json({ success: true })
      }
      return NextResponse.json(
        { error: "Administrador: apenas atualização de e-mail permitida." },
        { status: 400 },
      )
    }

    if (body.action === "block") {
      const result = await updateSupplierPortalUserProfile(id, { status: "inactive" })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      await logAuditServer({
        eventType: "supplier.user_deactivated",
        description: `Usuário ${profile.full_name ?? id} bloqueado`,
        userId: ctx.userId,
        companyId: ctx.companyId,
        entity: "profile",
        entityId: id,
        metadata: { supplierId: ctx.supplierId },
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === "unblock") {
      const result = await updateSupplierPortalUserProfile(id, { status: "active" })
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      await logAuditServer({
        eventType: "supplier.user_reactivated",
        description: `Usuário ${profile.full_name ?? id} reativado`,
        userId: ctx.userId,
        companyId: ctx.companyId,
        entity: "profile",
        entityId: id,
        metadata: { supplierId: ctx.supplierId },
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === "cancel") {
      if (id === ctx.userId) {
        return NextResponse.json(
          { error: "Você não pode cancelar o próprio acesso." },
          { status: 400 },
        )
      }
      const result = await cancelSupplierPortalUser(id)
      if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
      await logAuditServer({
        eventType: "supplier.user_cancelled",
        description: `Usuário ${profile.full_name ?? id} cancelado (removido)`,
        userId: ctx.userId,
        companyId: ctx.companyId,
        entity: "profile",
        entityId: id,
        metadata: { supplierId: ctx.supplierId },
      })
      return NextResponse.json({ success: true })
    }

    if (body.action === "update") {
      if (body.fullName?.trim()) {
        const r = await updateSupplierPortalUserProfile(id, { fullName: body.fullName })
        if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
      }
      if (body.email?.trim()) {
        const r = await updateSupplierPortalUserEmail(id, body.email)
        if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
      }
      if (body.newPassword) {
        const r = await resetSupplierPortalUserPassword(id, ctx.companyId, body.newPassword)
        if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
      }
      await logAuditServer({
        eventType: "supplier.user_updated",
        description: `Usuário ${profile.full_name ?? id} atualizado`,
        userId: ctx.userId,
        companyId: ctx.companyId,
        entity: "profile",
        entityId: id,
        metadata: { supplierId: ctx.supplierId },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
