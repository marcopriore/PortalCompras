import { NextResponse } from "next/server"
import {
  getCatalogAuthContext,
  resolveCatalogDbClient,
  tenantHasPurchaseCatalog,
} from "@/lib/catalog/catalog-auth"
import { validateCatalogLineQuantity } from "@/lib/catalog/validate-cart-line"
import {
  fetchCatalogCart,
  getOrCreateCartId,
  resolveCartOfferLine,
  type CartItemRow,
} from "@/lib/catalog/cart-service"
import {
  canUserWrite,
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"
import type { PermissionKey } from "@/lib/hooks/usePermissions"

async function requireCatalogAccess(
  ctx: Awaited<ReturnType<typeof getCatalogAuthContext>>,
  writePermission?: PermissionKey,
) {
  if ("error" in ctx) return ctx.error

  const enabled = await tenantHasPurchaseCatalog(ctx.supabase, ctx.companyId)
  if (!enabled && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Módulo não habilitado" }, { status: 403 })
  }

  if (ctx.isSuperAdmin) return null

  const permissions = await loadUserPermissionKeys(
    ctx.supabase,
    ctx.userId,
    ctx.companyId,
  )

  if (!hasUserPermission(permissions, "nav.catalog")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (writePermission && !canUserWrite(permissions, writePermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}

export async function GET() {
  try {
    const ctx = await getCatalogAuthContext()
    const denied = await requireCatalogAccess(ctx, "catalog.order")
    if (denied) return denied
    if ("error" in ctx) return ctx.error

    const db = resolveCatalogDbClient(ctx)
    const cart = await fetchCatalogCart(db, ctx.companyId, ctx.userId)
    return NextResponse.json({ cart })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCatalogAuthContext()
    const denied = await requireCatalogAccess(ctx, "catalog.order")
    if (denied) return denied
    if ("error" in ctx) return ctx.error

    const db = resolveCatalogDbClient(ctx)

    const body = (await request.json()) as {
      contract_item_id?: string
      quantity?: number
    }

    if (!body.contract_item_id) {
      return NextResponse.json({ error: "contract_item_id obrigatório" }, { status: 400 })
    }

    const quantity =
      typeof body.quantity === "number" && body.quantity > 0 ? body.quantity : 1

    const offerLine = await resolveCartOfferLine(db, ctx.companyId, body.contract_item_id)
    if (!offerLine) {
      return NextResponse.json({ error: "Oferta indisponível ou sem saldo" }, { status: 404 })
    }

    const cartId = await getOrCreateCartId(db, ctx.companyId, ctx.userId)
    if (!cartId) {
      return NextResponse.json({ error: "Não foi possível criar o carrinho" }, { status: 500 })
    }

    const { data: existingItem } = await db
      .from("catalog_cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("contract_item_id", offerLine.contractItemId)
      .maybeSingle()

    const targetQty = existingItem?.id
      ? Number(existingItem.quantity) + quantity
      : quantity

    const err = validateCatalogLineQuantity(
      offerLine.contractKind,
      offerLine.contractItem,
      targetQty,
    )
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 })
    }

    if (existingItem?.id) {
      await db
        .from("catalog_cart_items")
        .update({ quantity: targetQty, updated_at: new Date().toISOString() })
        .eq("id", existingItem.id)
    } else {
      const { error: insertErr } = await db.from("catalog_cart_items").insert({
        cart_id: cartId,
        company_id: ctx.companyId,
        contract_id: offerLine.contractId,
        contract_item_id: offerLine.contractItemId,
        supplier_id: offerLine.supplierId,
        material_code: offerLine.materialCode,
        material_description: offerLine.materialDescription,
        unit_of_measure: offerLine.unitOfMeasure,
        unit_price: offerLine.unitPrice,
        contract_kind: offerLine.contractKind,
        quantity,
      })
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
    }

    await db
      .from("catalog_carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cartId)

    const cart = await fetchCatalogCart(db, ctx.companyId, ctx.userId)
    return NextResponse.json({ success: true, cart })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getCatalogAuthContext()
    const denied = await requireCatalogAccess(ctx, "catalog.order")
    if (denied) return denied
    if ("error" in ctx) return ctx.error

    const db = resolveCatalogDbClient(ctx)

    const body = (await request.json()) as { item_id?: string; quantity?: number }
    if (!body.item_id) {
      return NextResponse.json({ error: "item_id obrigatório" }, { status: 400 })
    }
    if (typeof body.quantity !== "number" || body.quantity <= 0) {
      return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 })
    }

    const { data: line } = await db
      .from("catalog_cart_items")
      .select("*")
      .eq("id", body.item_id)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!line) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    }

    const row = line as CartItemRow
    const offerLine = await resolveCartOfferLine(db, ctx.companyId, row.contract_item_id)
    if (!offerLine) {
      return NextResponse.json({ error: "Item indisponível no contrato" }, { status: 400 })
    }

    const err = validateCatalogLineQuantity(
      offerLine.contractKind,
      offerLine.contractItem,
      body.quantity,
    )
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 })
    }

    await db
      .from("catalog_cart_items")
      .update({ quantity: body.quantity, updated_at: new Date().toISOString() })
      .eq("id", body.item_id)

    const cart = await fetchCatalogCart(db, ctx.companyId, ctx.userId)
    return NextResponse.json({ success: true, cart })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getCatalogAuthContext()
    const denied = await requireCatalogAccess(ctx, "catalog.order")
    if (denied) return denied
    if ("error" in ctx) return ctx.error

    const db = resolveCatalogDbClient(ctx)

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get("item_id")

    const { data: cart } = await db
      .from("catalog_carts")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("user_id", ctx.userId)
      .maybeSingle()

    if (cart?.id) {
      if (itemId) {
        await db
          .from("catalog_cart_items")
          .delete()
          .eq("id", itemId)
          .eq("cart_id", cart.id)
      } else {
        await db.from("catalog_cart_items").delete().eq("cart_id", cart.id)
      }
    }

    const nextCart = await fetchCatalogCart(db, ctx.companyId, ctx.userId)
    return NextResponse.json({ success: true, cart: nextCart })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
