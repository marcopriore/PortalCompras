import type { SupabaseClient } from "@supabase/supabase-js"
import { logAudit } from "@/lib/audit"

type QuotationLineSource = {
  requisition_code?: string | null
  source_requisition_code?: string | null
}

/**
 * Unique requisition codes from quotation lines.
 * Nova cotação must use this — not only `?requisition_id=` — so every imported
 * REQ is marked `in_quotation` and cannot generate a second cotação/pedido.
 */
export function collectSourceRequisitionCodes(
  items: QuotationLineSource[],
): string[] {
  return [
    ...new Set(
      items
        .map((item) => (item.source_requisition_code ?? item.requisition_code)?.trim())
        .filter((code): code is string => Boolean(code)),
    ),
  ]
}

export async function linkRequisitionsToQuotation(
  supabase: SupabaseClient,
  params: {
    companyId: string
    quotationId: string
    quotationCode?: string | null
    requisitionCodes: string[]
    userId?: string | null
  },
): Promise<{ linkedIds: string[] }> {
  const codes = collectSourceRequisitionCodes(
    params.requisitionCodes.map((code) => ({ source_requisition_code: code })),
  )
  if (codes.length === 0) return { linkedIds: [] }

  const { data: reqs } = await supabase
    .from("requisitions")
    .select("id, code")
    .eq("company_id", params.companyId)
    .is("quotation_id", null)
    .in("code", codes)

  if (!reqs || reqs.length === 0) return { linkedIds: [] }

  const ids = reqs.map((req) => req.id as string)
  await supabase
    .from("requisitions")
    .update({
      status: "in_quotation",
      quotation_id: params.quotationId,
    })
    .in("id", ids)

  const quotationLabel = params.quotationCode ?? params.quotationId
  for (const req of reqs) {
    void logAudit({
      eventType: "requisition.in_quotation",
      description: `Requisição ${req.code} vinculada à cotação ${quotationLabel}`,
      companyId: params.companyId,
      userId: params.userId ?? null,
      userName: params.userId ?? null,
      entity: "requisitions",
      entityId: req.id,
      metadata: {
        quotation_id: params.quotationId,
        quotation_code: params.quotationCode ?? null,
      },
    })
  }

  return { linkedIds: ids }
}
