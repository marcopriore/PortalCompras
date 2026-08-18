import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  integratePurchaseOrderWithErp,
  type PurchaseOrderErpOperation,
} from "@/lib/integrations/integrate-purchase-order"
import { requireIntegrationsAdmin, requireTenantAdmin } from "@/lib/api/require-tenant-admin"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

function parseOperation(value: unknown): PurchaseOrderErpOperation {
  if (value === "update" || value === "delete") return value
  return "create"
}

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

function buyerOperationAllowed(
  operation: PurchaseOrderErpOperation,
  status: string,
  externalCode: string | null,
): boolean {
  if (operation === "create") {
    return status === "error"
  }
  if (operation === "update") {
    return (
      Boolean(externalCode?.trim()) &&
      (status === "processing" || status === "error" || status === "integration_error")
    )
  }
  if (operation === "delete") {
    return (
      Boolean(externalCode?.trim()) &&
      (status === "completed" || status === "integration_error")
    )
  }
  return false
}

function monitorOperationAllowed(
  operation: PurchaseOrderErpOperation,
  status: string,
): boolean {
  if (operation === "create") {
    return status === "error" || status === "processing" || status === "integration_error"
  }
  if (operation === "update") {
    return (
      status === "completed" ||
      status === "processing" ||
      status === "error" ||
      status === "integration_error"
    )
  }
  return status === "completed" || status === "integration_error"
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as {
      source?: string
      operation?: string
      cancellation_reason?: string
    }
    const source = body.source
    const operation = parseOperation(body.operation)

    if (source !== "supplier" && source !== "monitor" && source !== "buyer") {
      return NextResponse.json({ error: "Fonte inválida." }, { status: 400 })
    }

    if (source === "supplier" && operation === "delete") {
      return NextResponse.json({ error: "Operação inválida para fornecedor." }, { status: 400 })
    }

    let companyId: string
    let effectiveOperation = operation

    if (source === "supplier") {
      const supplierAuth = await resolveSupplierOrder(id)
      if ("error" in supplierAuth) return supplierAuth.error
      companyId = supplierAuth.companyId

      const supabase = await createClient()
      const { data: orderMeta } = await supabase
        .from("purchase_orders")
        .select("external_code")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle()

      effectiveOperation =
        orderMeta?.external_code != null && String(orderMeta.external_code).trim()
          ? "update"
          : "create"
    } else if (source === "buyer") {
      const buyerAuth = await requireTenantAdmin()
      if ("error" in buyerAuth) return buyerAuth.error
      companyId = buyerAuth.companyId

      const { data: order } = await buyerAuth.supabase
        .from("purchase_orders")
        .select("status, external_code")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle()

      if (!order) {
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
      }

      if (
        !buyerOperationAllowed(
          operation,
          String(order.status),
          order.external_code != null ? String(order.external_code) : null,
        )
      ) {
        return NextResponse.json(
          { error: "Pedido não está elegível para esta operação de integração." },
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

      if (!monitorOperationAllowed(operation, String(order.status))) {
        return NextResponse.json(
          { error: "Pedido não está elegível para reenvio da integração." },
          { status: 400 },
        )
      }
    }

    const result = await integratePurchaseOrderWithErp(companyId, id, effectiveOperation, {
      cancellationReason: body.cancellation_reason,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
