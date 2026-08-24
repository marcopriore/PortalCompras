import { NextResponse } from "next/server"
import { buildCatalogOffers } from "@/lib/catalog/build-offers"
import {
  getCatalogAuthContext,
  resolveCatalogDbClient,
  tenantHasPurchaseCatalog,
} from "@/lib/catalog/catalog-auth"
import {
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"

const DEFAULT_LIMIT = 18
const MAX_LIMIT = 50

export async function GET(request: Request) {
  try {
    const ctx = await getCatalogAuthContext()
    if ("error" in ctx) return ctx.error

    const db = resolveCatalogDbClient(ctx)

    const enabled = await tenantHasPurchaseCatalog(db, ctx.companyId)
    if (!enabled && !ctx.isSuperAdmin) {
      return NextResponse.json({ error: "Módulo não habilitado" }, { status: 403 })
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
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? undefined
    const commodityGroups = searchParams.getAll("commodity_group").filter(Boolean)
    const supplierIds = searchParams.getAll("supplier_id").filter(Boolean)

    const offsetRaw = Number(searchParams.get("offset") ?? "0")
    const limitRaw = Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT))
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT

    const includeFacets = searchParams.get("include_facets") === "1"

    const result = await buildCatalogOffers(db, ctx.companyId, {
      search,
      commodityGroups,
      supplierIds,
      offset,
      limit,
      includeFacets,
    })

    return NextResponse.json({
      offers: result.offers,
      total: result.total,
      hasMore: result.hasMore,
      offset,
      limit,
      ...(includeFacets
        ? {
            commodityGroups: result.commodityGroups,
            suppliers: result.suppliers,
          }
        : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
