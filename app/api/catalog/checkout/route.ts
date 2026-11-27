import { NextResponse, after } from "next/server"
import { createCatalogPurchaseOrders } from "@/lib/catalog/create-catalog-purchase-orders"
import {
  claimCatalogCartItems,
  restoreCatalogCartItems,
  toCatalogCheckoutLines,
  type ClaimedCatalogCartItem,
} from "@/lib/catalog/claim-cart-items"
import { notifyCatalogCheckout } from "@/lib/catalog/notify-catalog-checkout"
import { enqueueCatalogOrderApprovals } from "@/lib/catalog/enqueue-catalog-order-approvals"
import {
  getCatalogAuthContext,
  loadCatalogTenantGates,
  resolveCatalogDbClient,
} from "@/lib/catalog/catalog-auth"
import {
  canUserWrite,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"
import { hasCatalogViewAccessFromKeys } from "@/lib/permissions/catalog-access"
import { triggerRequisitionOutbound } from "@/lib/integrations/trigger-requisition-outbound"
import { loadTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  let claimedItems: ClaimedCatalogCartItem[] | null = null
  let dbForRestore: SupabaseClient | null = null
  try {
    const ctx = await getCatalogAuthContext()
    if ("error" in ctx) return ctx.error

    const db = resolveCatalogDbClient(ctx)

    const bodyPromise = request.json() as Promise<{
      title?: string
      cost_center?: string
      needed_by?: string | null
      priority?: "normal" | "urgent" | "critical"
      description?: string | null
    }>

    const [gates, featureConfig, permissions, body] = await Promise.all([
      loadCatalogTenantGates(db, ctx.companyId),
      loadTenantFeatureConfig(db, ctx.companyId),
      ctx.isSuperAdmin
        ? Promise.resolve(null)
        : loadUserPermissionKeys(
            createServiceRoleClient(),
            ctx.userId,
            ctx.companyId,
          ),
      bodyPromise,
    ])

    if (!gates.purchaseCatalog && !ctx.isSuperAdmin) {
      return NextResponse.json({ error: "Módulo não habilitado" }, { status: 403 })
    }

    if (!gates.contractBalance && !ctx.isSuperAdmin) {
      return NextResponse.json(
        { error: "Consumo de contrato não habilitado para este tenant" },
        { status: 403 },
      )
    }

    if (!ctx.isSuperAdmin && permissions) {
      if (!hasCatalogViewAccessFromKeys(permissions)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (!canUserWrite(permissions, "catalog.order")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const postCheckoutMode = featureConfig.catalogPostCheckoutMode

    const { data: cart } = await db
      .from("catalog_carts")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("user_id", ctx.userId)
      .maybeSingle()

    if (!cart?.id) {
      return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 })
    }

    // Claim first so a concurrent checkout (double-click / two tabs) cannot
    // create a second REQ/PO set and double-reserve contract balance.
    const claimed = await claimCatalogCartItems(db, cart.id)
    if (!claimed.ok) {
      return NextResponse.json({ error: claimed.error }, { status: 500 })
    }
    if (claimed.items.length === 0) {
      return NextResponse.json({ error: "Carrinho vazio" }, { status: 400 })
    }
    claimedItems = claimed.items
    dbForRestore = db

    const result = await createCatalogPurchaseOrders(
      db,
      ctx.companyId,
      ctx.userId,
      ctx.fullName,
      toCatalogCheckoutLines(claimed.items),
      {
        title: body.title ?? "",
        costCenter: body.cost_center ?? "",
        neededBy: body.needed_by,
        priority: body.priority,
        description: body.description,
      },
      { postCheckoutMode },
    )

    if (!result.ok) {
      await restoreCatalogCartItems(db, claimed.items)
      claimedItems = null
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    // Pedidos criados: o catch não deve repor o carrinho (evita retry duplicado).
    claimedItems = null

    if (postCheckoutMode === "cost_center_approval") {
      const service = createServiceRoleClient()
      const enqueued = await enqueueCatalogOrderApprovals(
        service,
        ctx.companyId,
        (body.cost_center ?? "").trim(),
        result.result.purchaseOrders,
      )
      if (!enqueued.ok) {
        const requisitionIds = [
          ...new Set(result.result.purchaseOrders.map((po) => po.requisitionId)),
        ]
        await Promise.all(
          result.result.purchaseOrders.map(async (po) => {
            try {
              await db.rpc("release_contract_balance", { p_order_id: po.id })
            } catch {
              /* best-effort */
            }
            await db.from("purchase_orders").delete().eq("id", po.id)
          }),
        )
        await Promise.all(
          requisitionIds.map(async (requisitionId) => {
            await db.from("requisition_items").delete().eq("requisition_id", requisitionId)
            await db.from("requisitions").delete().eq("id", requisitionId)
          }),
        )
        await restoreCatalogCartItems(db, claimed.items)
        return NextResponse.json({ error: enqueued.error }, { status: 400 })
      }
    }

    const auditRows = result.result.purchaseOrders.flatMap((po) => [
      {
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
          status:
            postCheckoutMode === "cost_center_approval"
              ? "awaiting_approval"
              : "draft",
          catalog_post_checkout_mode: postCheckoutMode,
        },
      },
      {
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
          status:
            postCheckoutMode === "cost_center_approval"
              ? "awaiting_approval"
              : "awaiting_buyer",
        },
      },
    ])

    if (auditRows.length > 0) {
      await db.from("audit_logs").insert(auditRows)
    }

    for (const po of result.result.purchaseOrders) {
      triggerRequisitionOutbound(ctx.companyId, po.requisitionId, "requisition.created")
    }

    after(() =>
      notifyCatalogCheckout({
        db,
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        actorName: ctx.fullName,
        actorProfileType: ctx.profileType,
        title: (body.title ?? "").trim() || "Pedido do catálogo",
        purchaseOrders: result.result.purchaseOrders,
      }),
    )

    return NextResponse.json({
      success: true,
      purchase_orders: result.result.purchaseOrders,
    })
  } catch (error) {
    if (claimedItems && dbForRestore) {
      await restoreCatalogCartItems(dbForRestore, claimedItems)
    }
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
