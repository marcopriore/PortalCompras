import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { integratePurchaseOrderWithErp } from "@/lib/integrations/integrate-purchase-order"
import { requireIntegrationsAdmin, requireTenantAdmin } from "@/lib/api/require-tenant-admin"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

async function resolveSupplierOrder(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("supplier_id, profile_type")
    .eq("id", user.id)
    .single()

  if (profile?.profile_type !== "supplier" || !profile.supplier_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const { data: order, error } = await supabase
    .from("purchase_orders")
    .select("id, company_id, supplier_id, status, accepted_by_supplier")
    .eq("id", orderId)
    .eq("supplier_id", profile.supplier_id)
    .maybeSingle()

  if (error || !order) {
    return { error: NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 }) }
  }

  if (!order.accepted_by_supplier || order.status !== "processing") {
    return {
      error: NextResponse.json(
        { error: "Pedido não está aguardando integração com o ERP." },
        { status: 400 },
      ),
    }
  }

  return { companyId: order.company_id as string }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { source?: string }
    const source = body.source

    if (source !== "supplier" && source !== "monitor" && source !== "buyer") {
      return NextResponse.json({ error: "Fonte inválida." }, { status: 400 })
    }

    let companyId: string

    if (source === "supplier") {
      const supplierAuth = await resolveSupplierOrder(id)
      if ("error" in supplierAuth) return supplierAuth.error
      companyId = supplierAuth.companyId
    } else if (source === "buyer") {
      const buyerAuth = await requireTenantAdmin()
      if ("error" in buyerAuth) return buyerAuth.error
      companyId = buyerAuth.companyId

      const { data: order } = await buyerAuth.supabase
        .from("purchase_orders")
        .select("status")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle()

      if (!order) {
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
      }
      if (order.status !== "error") {
        return NextResponse.json(
          { error: "Somente pedidos reprovados pelo ERP podem ser reenviados pelo comprador." },
          { status: 400 },
        )
      }
    } else {
      const monitorAuth = await requireIntegrationsAdmin()
      if ("error" in monitorAuth) return monitorAuth.error
      companyId = monitorAuth.companyId

      const { data: order } = await monitorAuth.supabase
        .from("purchase_orders")
        .select("status")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle()

      if (!order) {
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
      }
      if (
        order.status !== "error" &&
        order.status !== "processing" &&
        order.status !== "integration_error"
      ) {
        return NextResponse.json(
          { error: "Pedido não está elegível para reenvio da integração." },
          { status: 400 },
        )
      }
    }

    const result = await integratePurchaseOrderWithErp(companyId, id)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
