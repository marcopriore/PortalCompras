import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type QuotationRequisitionImportOption = {
  id: string
  code: string
  title: string
  created_at: string
  items: {
    material_code: string | null
    material_description: string
    unit_of_measure: string | null
    quantity: number
    site_code?: string | null
  }[]
}

export type QuotationRequisitionPrefill = {
  title: string
  category: string
  items: {
    code: string
    description: string
    long_description: string | null
    quantity: number
    unit_of_measure: string
    requisition_code: string | null
    site_code: string | null
  }[]
}

export type QuotationEditFormDto = {
  quotation: {
    id: string
    code: string
    description: string
    status: string
    category: string | null
    response_deadline: string | null
    payment_condition: string | null
    created_by: string | null
  }
  buyers: { id: string; full_name: string | null }[]
  items: {
    material_code: string
    material_description: string
    long_description: string | null
    unit_of_measure: string
    quantity: number
    complementary_spec: string | null
    source_requisition_code: string | null
    site_code: string | null
  }[]
  suppliers: {
    supplier_id: string
    supplier_name: string
    supplier_cnpj: string | null
  }[]
}

export async function fetchApprovedRequisitionsForQuotation(
  supabase: SupabaseClient,
  companyId: string,
): Promise<QuotationRequisitionImportOption[]> {
  const { data: reqs, error } = await supabase
    .from("requisitions")
    .select("id, code, title, created_at")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .is("quotation_id", null)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  if (!reqs || reqs.length === 0) {
    return []
  }

  const { data: allItems, error: itemsError } = await supabase
    .from("requisition_items")
    .select(
      "requisition_id, material_code, material_description, unit_of_measure, quantity, site_code",
    )
    .eq("company_id", companyId)
    .in(
      "requisition_id",
      reqs.map((r) => r.id),
    )

  if (itemsError) {
    throw itemsError
  }

  type ReqItemRow = {
    requisition_id: string
    material_code: string | null
    material_description: string
    unit_of_measure: string | null
    quantity: number
    site_code: string | null
  }

  const itemsByReq: Record<string, ReqItemRow[]> = {}
  for (const row of (allItems ?? []) as ReqItemRow[]) {
    if (!itemsByReq[row.requisition_id]) itemsByReq[row.requisition_id] = []
    itemsByReq[row.requisition_id].push(row)
  }

  return reqs.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    created_at: r.created_at,
    items: (itemsByReq[r.id] ?? []).map((i) => ({
      material_code: i.material_code,
      material_description: i.material_description,
      unit_of_measure: i.unit_of_measure,
      quantity: i.quantity,
      site_code: i.site_code,
    })),
  }))
}

export async function fetchQuotationRequisitionPrefill(
  supabase: SupabaseClient,
  companyId: string,
  requisitionId: string,
): Promise<QuotationRequisitionPrefill | null> {
  const [reqRes, itemsRes] = await Promise.all([
    supabase
      .from("requisitions")
      .select("title, code")
      .eq("id", requisitionId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("requisition_items")
      .select(
        "material_code, material_description, long_description, quantity, unit_of_measure, site_code",
      )
      .eq("requisition_id", requisitionId)
      .eq("company_id", companyId),
  ])

  if (!reqRes.data) {
    return null
  }

  const reqAny = reqRes.data as {
    title?: string
    code?: string
  }
  const reqCode = reqAny.code ?? null

  return {
    title: reqAny.title ?? "",
    category: "",
    items: (itemsRes.data ?? []).map(
      (ri: {
        material_code?: string | null
        material_description?: string | null
        long_description?: string | null
        quantity?: number | null
        unit_of_measure?: string | null
        site_code?: string | null
      }) => ({
        code: ri.material_code ?? "",
        description: ri.material_description ?? "",
        long_description: ri.long_description ?? null,
        quantity: ri.quantity ?? 1,
        unit_of_measure: ri.unit_of_measure ?? "",
        requisition_code: reqCode,
        site_code: ri.site_code ?? null,
      }),
    ),
  }
}

export async function fetchQuotationEditForm(
  supabase: SupabaseClient,
  companyId: string,
  quotationId: string,
): Promise<QuotationEditFormDto | null> {
  const [{ data: quotationData, error: quotationError }, buyersRes] = await Promise.all([
    supabase
      .from("quotations")
      .select(
        "id, code, description, status, category, response_deadline, payment_condition, created_by",
      )
      .eq("id", quotationId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .neq("profile_type", "supplier")
      .order("full_name", { ascending: true }),
  ])

  if (quotationError || !quotationData) {
    return null
  }

  const [{ data: itemsData }, { data: suppliersData }] = await Promise.all([
    supabase
      .from("quotation_items")
      .select(
        "material_code, material_description, long_description, unit_of_measure, quantity, complementary_spec, source_requisition_code, site_code",
      )
      .eq("quotation_id", quotationId)
      .eq("company_id", companyId),
    supabase
      .from("quotation_suppliers")
      .select("supplier_id, supplier_name, supplier_cnpj, position")
      .eq("quotation_id", quotationId)
      .eq("company_id", companyId)
      .order("position", { ascending: true, nullsFirst: false }),
  ])

  return {
    quotation: {
      id: quotationData.id as string,
      code: quotationData.code as string,
      description: (quotationData.description as string) ?? "",
      status: quotationData.status as string,
      category: (quotationData.category as string | null) ?? null,
      response_deadline: (quotationData.response_deadline as string | null) ?? null,
      payment_condition: (quotationData.payment_condition as string | null) ?? null,
      created_by: (quotationData.created_by as string | null) ?? null,
    },
    buyers: ((buyersRes.data ?? []) as { id: string; full_name: string | null }[]) ?? [],
    items: (itemsData ?? []) as QuotationEditFormDto["items"],
    suppliers: (suppliersData ?? []) as QuotationEditFormDto["suppliers"],
  }
}

export function approvedRequisitionsImportQueryOptions(
  companyId: string,
  enabled: boolean,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.approvedRequisitionsImport(companyId),
    queryFn: () => fetchApprovedRequisitionsForQuotation(supabaseFactory(), companyId),
    enabled: enabled && Boolean(companyId),
  })
}

export function quotationRequisitionPrefillQueryOptions(
  companyId: string,
  requisitionId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.quotationRequisitionPrefill(companyId, requisitionId),
    queryFn: () =>
      fetchQuotationRequisitionPrefill(supabaseFactory(), companyId, requisitionId),
    enabled: Boolean(companyId && requisitionId),
  })
}

export function quotationEditFormQueryOptions(
  companyId: string,
  quotationId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.quotationEditForm(companyId, quotationId),
    queryFn: () => fetchQuotationEditForm(supabaseFactory(), companyId, quotationId),
    enabled: Boolean(companyId && quotationId),
  })
}