import { NextResponse } from "next/server"
import { createCatalogPurchaseOrders } from "@/lib/catalog/create-catalog-purchase-orders"
import { notifyCatalogCheckout } from "@/lib/catalog/notify-catalog-checkout"
import {
  getCatalogAuthContext,
  resolveCatalogDbClient,
  tenantHasPurchaseCatalog,
} from "@/lib/catalog/catalog-auth"
import { tenantHasContractBalance } from "@/lib/contracts/contract-balance-settings"
import {
  canUserWrite,
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"
import { triggerRequisitionOutbound } from "@/lib/integrations/trigger-requisition-outbound"

export async function POST(request: Request) {
  try {
    const ctx = await getCatalogAuthContext()
    if ("error" in ctx) return ctx.error

    const enabled = await tenantHasPurchaseCatalog(ctx.supabase, ctx.companyId)
    if (!enabled && !ctx.isSuperAdmin) {
      return NextResponse.json({ error: "Módulo não habilitado" }, { status: 403 })
    }

    const contractBalanceEnabled = await tenantHasContractBalance(
      ctx.supabase,
      ctx.companyId,
    )
    if (!contractBalanceEnabled && !ctx.isSuperAdmin) {
      return NextResponse.json(
        { error: "Consumo de contrato não habilitado para este tenant" },
        { status: 403 },
      )
    }

    if (!ctx.isSuperAdmin) {
      const permissions = await loadUserPermissionKeys(
        ctx.supabase,
        ctx.userId,
        ctx.companyId,
      )
      if (!hasUserPermission(permissions, "nav.catalog")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (!canUserWrite(permissions, "catalog.order")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = (await request.json()) as {
      title?: string
      cost_center?: string
      needed_by?: string | null
      priority?: "normal" | "urgent" | "critical"
      description?: string | null
    }

    const db = resolveCatalogDbClient(ctx)

    const { data: cart } = await db
      .from("catalog_carts")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("user_id", ctx.userId)
      .maybeSingle()

    if (!cart?.id) {
      return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 })
    }

    const { data: cartItems } = await db
      .from("catalog_cart_items")
      .select("*")
      .eq("cart_id", cart.id)

    if (!cartItems?.length) {
      return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 })
    }

    const result = await createCatalogPurchaseOrders(
      db,
      ctx.companyId,
      ctx.userId,
      ctx.fullName,
      cartItems as Parameters<typeof createCatalogPurchaseOrders>[4],
      {
        title: body.title ?? "",
        costCenter: body.cost_center ?? "",
        neededBy: body.needed_by,
        priority: body.priority,
        description: body.description,
      },
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    await db.from("catalog_cart_items").delete().eq("cart_id", cart.id)
    await db
      .from("catalog_carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cart.id)

    for (const po of result.result.purchaseOrders) {
      await db.from("audit_logs").insert({
        event_type: "catalog.checkout",
        description: `Catálogo: pedido ${po.code} + requisição ${po.requisitionCode}`,
        company_id: ctx.companyId,
        user_id: ctx.userId,
        user_name: ctx.fullName,
        entity: "purchase_orders",
        entity_id: po.id,
        metadata: {
          code: po.code,
          requisition_id: po.requisitionId,
          requisition_code: po.requisitionCode,
          origin: "catalog",
          supplier_id: po.supplierId,
          status: "draft",
        },
      })

      await db.from("audit_logs").insert({
        event_type: "requisition.created",
        description: `Requisição ${po.requisitionCode} criada via catálogo (vinculada a ${po.code})`,
        company_id: ctx.companyId,
        user_id: ctx.userId,
        user_name: ctx.fullName,
        entity: "requisitions",
        entity_id: po.requisitionId,
        metadata: {
          code: po.requisitionCode,
          purchase_order_id: po.id,
          purchase_order_code: po.code,
          origin: "catalog",
          status: "awaiting_buyer",
        },
      })

      triggerRequisitionOutbound(ctx.companyId, po.requisitionId, "requisition.created")
    }

    void notifyCatalogCheckout({
      db,
      companyId: ctx.companyId,
      actorUserId: ctx.userId,
      actorName: ctx.fullName,
      actorProfileType: ctx.profileType,
      title: (body.title ?? "").trim() || "Pedido do catálogo",
      purchaseOrders: result.result.purchaseOrders,
    })

    return NextResponse.json({
      success: true,
      purchase_orders: result.result.purchaseOrders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
