import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveRequisitionStatusWhenLastPoCancelled } from "@/lib/requisitions/status"

/**
 * After a PO is cancelled, if it was the last active PO of a catalog REQ,
 * force the REQ to `cancelled`. Compensates the 084 trigger (which promoted
 * catalog REQs to `approved`) even before migration 085 is applied.
 */
export async function cancelOrphanCatalogRequisitionAfterPoCancel(
  supabase: SupabaseClient,
  params: {
    companyId: string
    requisitionCode: string | null | undefined
    cancelledPurchaseOrderId: string
  },
): Promise<void> {
  const code = params.requisitionCode?.trim()
  if (!code) return

  const { data: req } = await supabase
    .from("requisitions")
    .select("id, origin, status, quotation_id")
    .eq("company_id", params.companyId)
    .eq("code", code)
    .maybeSingle()

  if (!req) return
  if (req.status === "rejected" || req.status === "cancelled") return

  const nextStatus = resolveRequisitionStatusWhenLastPoCancelled({
    origin: req.origin as string | null,
    quotationId: (req.quotation_id as string | null) ?? null,
  })
  if (nextStatus !== "cancelled") return

  const { data: siblings } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("requisition_code", code)
    .neq("id", params.cancelledPurchaseOrderId)
    .neq("status", "cancelled")
    .limit(1)

  if ((siblings ?? []).length > 0) return

  await supabase
    .from("requisitions")
    .update({ status: "cancelled" })
    .eq("id", req.id as string)
    .eq("company_id", params.companyId)
}
