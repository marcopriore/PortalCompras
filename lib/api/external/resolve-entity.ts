import type { SupabaseClient } from "@supabase/supabase-js"
import { isUuid } from "@/lib/api/external/parse-body"

export async function resolveRequisitionRow(
  service: SupabaseClient,
  companyId: string,
  idOrCode: string,
) {
  let query = service
    .from("requisitions")
    .select("*")
    .eq("company_id", companyId)

  if (isUuid(idOrCode)) {
    query = query.eq("id", idOrCode)
  } else {
    query = query.or(`code.eq.${idOrCode},external_code.eq.${idOrCode}`)
  }

  return query.maybeSingle()
}

export async function resolvePurchaseOrderRow(
  service: SupabaseClient,
  companyId: string,
  idOrCode: string,
) {
  let query = service
    .from("purchase_orders")
    .select("*")
    .eq("company_id", companyId)

  if (isUuid(idOrCode)) {
    query = query.eq("id", idOrCode)
  } else {
    query = query.or(`code.eq.${idOrCode},external_code.eq.${idOrCode}`)
  }

  return query.maybeSingle()
}

export async function resolveQuotationRow(
  service: SupabaseClient,
  companyId: string,
  idOrCode: string,
) {
  let query = service
    .from("quotations")
    .select("*")
    .eq("company_id", companyId)

  if (isUuid(idOrCode)) {
    query = query.eq("id", idOrCode)
  } else {
    query = query.eq("code", idOrCode)
  }

  return query.maybeSingle()
}

export async function resolveContractRow(
  service: SupabaseClient,
  companyId: string,
  idOrCode: string,
) {
  let query = service
    .from("contracts")
    .select(
      `
      *,
      suppliers(name, code),
      payment_conditions(code, description)
    `,
    )
    .eq("company_id", companyId)

  if (isUuid(idOrCode)) {
    query = query.eq("id", idOrCode)
  } else {
    query = query.or(`code.eq.${idOrCode},erp_code.eq.${idOrCode}`)
  }

  return query.maybeSingle()
}
