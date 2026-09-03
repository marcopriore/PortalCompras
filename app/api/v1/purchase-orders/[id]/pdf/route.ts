import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { apiError } from "@/lib/api/external/responses"
import { resolvePurchaseOrderRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"
import {
  PurchaseOrderPDF,
  type PurchaseOrderPDFCompany,
  type PurchaseOrderPDFOrder,
} from "@/lib/pdf/purchase-order-pdf"
import { mapPurchaseOrderItemsToPdf } from "@/lib/pdf/purchase-order-pdf-data"
import { loadTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador do pedido é obrigatório.", "VALIDATION_ERROR", 400)
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "orders")
      if (!enabled) {
        return apiError(
          "Módulo de pedidos não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      try {
        const service = createServiceRoleClient()
        const { data: order, error } = await resolvePurchaseOrderRow(
          service,
          ctx.companyId,
          idOrCode,
        )

        if (error) {
          return apiError("Erro ao buscar pedido.", "INTERNAL_ERROR", 500)
        }

        if (!order) {
          return apiError(`Pedido não encontrado: ${idOrCode}`, "NOT_FOUND", 404)
        }

        const orderId = order.id as string

        const [itemsRes, companyRes, featureConfig] = await Promise.all([
          service
            .from("purchase_order_items")
            .select("*")
            .eq("purchase_order_id", orderId)
            .order("material_code", { ascending: true }),
          service
            .from("companies")
            .select("name, cnpj, logo_url")
            .eq("id", ctx.companyId)
            .single(),
          loadTenantFeatureConfig(service, ctx.companyId),
        ])

        const pdfItems = mapPurchaseOrderItemsToPdf(
          (itemsRes.data ?? []) as Record<string, unknown>[],
        )

        const pdfOrder = order as PurchaseOrderPDFOrder
        const pdfCompany = (companyRes.data ?? null) as PurchaseOrderPDFCompany

        const pdfBuffer = await renderToBuffer(
          createElement(PurchaseOrderPDF, {
            order: pdfOrder,
            items: pdfItems,
            company: pdfCompany,
            porEnabled: featureConfig.porEnabled,
          }) as Parameters<typeof renderToBuffer>[0],
        )

        const safeCode = String(pdfOrder.code ?? "pedido").replace(/[^\w\-./]+/g, "_")

        return new NextResponse(new Uint8Array(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="pedido_${safeCode}.pdf"`,
          },
        })
      } catch {
        return apiError("Erro ao gerar PDF do pedido.", "INTERNAL_ERROR", 500)
      }
    },
    { requiredScope: "orders:read" },
  )
}
