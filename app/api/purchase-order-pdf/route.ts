import { NextResponse } from "next/server"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { PurchaseOrderPDF } from "@/lib/pdf/purchase-order-pdf"
import {
  canAccessPurchaseOrderPdf,
  loadPurchaseOrderPdfContext,
  resolveBuyerCompanyIdForPdf,
} from "@/lib/pdf/purchase-order-pdf-data"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("id")
    if (!orderId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("company_id, supplier_id, profile_type, is_superadmin")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()
    const ctx = await loadPurchaseOrderPdfContext(service, orderId)

    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const buyerCompanyId = await resolveBuyerCompanyIdForPdf(profile)
    const allowed = canAccessPurchaseOrderPdf(
      profile,
      ctx.accessRow,
      buyerCompanyId,
    )

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const pdfBuffer = await renderToBuffer(
      createElement(PurchaseOrderPDF, {
        order: ctx.order,
        items: ctx.items,
        company: ctx.company,
        porEnabled: ctx.porEnabled,
      }) as Parameters<typeof renderToBuffer>[0],
    )

    const safeCode = String(ctx.order.code ?? "pedido").replace(/[^\w\-./]+/g, "_")

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pedido_${safeCode}.pdf"`,
      },
    })
  } catch (e) {
    console.error("purchase-order-pdf:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
