import { NextResponse } from "next/server"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  PurchaseOrderPDF,
  type PurchaseOrderPDFCompany,
  type PurchaseOrderPDFItem,
  type PurchaseOrderPDFOrder,
} from "@/lib/pdf/purchase-order-pdf"

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
      .select("company_id, supplier_id, profile_type")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    const { data: order, error: orderError } = await service
      .from("purchase_orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const row = order as {
      company_id: string
      supplier_id: string | null
    }

    const isSupplier = profile.profile_type === "supplier"
    const canAccess =
      (!isSupplier && profile.company_id === row.company_id) ||
      (isSupplier && profile.supplier_id != null && profile.supplier_id === row.supplier_id)

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: items } = await service
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderId)
      .order("material_code", { ascending: true })

    const { data: company } = await service
      .from("companies")
      .select("name, cnpj, logo_url")
      .eq("id", row.company_id)
      .single()

    const pdfItems: PurchaseOrderPDFItem[] = (items ?? []).map((raw: Record<string, unknown>) => ({
      id: String(raw.id),
      material_code: String(raw.material_code ?? ""),
      material_description: String(raw.material_description ?? ""),
      quantity: Number(raw.quantity ?? 0),
      unit_of_measure: raw.unit_of_measure != null ? String(raw.unit_of_measure) : null,
      unit_price: Number(raw.unit_price ?? 0),
      tax_percent: raw.tax_percent != null ? Number(raw.tax_percent) : null,
      total_price: raw.total_price != null ? Number(raw.total_price) : null,
    }))

    const pdfOrder = order as PurchaseOrderPDFOrder
    const pdfCompany = (company ?? null) as PurchaseOrderPDFCompany

    const pdfBuffer = await renderToBuffer(
      createElement(PurchaseOrderPDF, {
        order: pdfOrder,
        items: pdfItems,
        company: pdfCompany,
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
  } catch (e) {
    console.error("purchase-order-pdf:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
