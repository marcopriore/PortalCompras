import { NextResponse } from "next/server"
import { createCatalogPurchaseOrders } from "@/lib/catalog/create-catalog-purchase-orders"
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
      cartItems as Parameters<typeof createCatalogPurchaseOrders>[3],
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
        event_type: "requisition.created",
        description: `Pedido ${po.code} criado via catálogo de compras`,
        company_id: ctx.companyId,
        user_id: ctx.userId,
        user_name: ctx.fullName,
        entity: "purchase_orders",
        entity_id: po.id,
        metadata: {
          code: po.code,
          origin: "catalog",
          supplier_id: po.supplierId,
          status: "draft",
        },
      })
    }

    return NextResponse.json({
      success: true,
      purchase_orders: result.result.purchaseOrders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
