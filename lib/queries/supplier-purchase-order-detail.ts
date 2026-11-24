import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

type CompanyEmbed =
  | { name: string; cnpj: string | null }
  | { name: string; cnpj: string | null }[]
  | null

export type SupplierPurchaseOrderDetail = {
  id: string
  code: string
  quotation_code: string | null
  requisition_code: string | null
  external_code: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_address: string | null
  total_price: number | null
  status: string
  observations: string | null
  created_at: string
  created_by: string | null
  quotation_id: string | null
  accepted_at: string | null
  estimated_delivery_date: string | null
  delivery_days: number | null
  accepted_by_supplier: boolean | null
  cancellation_reason: string | null
  updated_at: string | null
  company_id: string
  companies: CompanyEmbed
}

export type SupplierPurchaseOrderItem = {
  id: string
  material_code: string
  material_description: string
  site_code: string | null
  unit_of_measure: string | null
  quantity: number
  unit_price: number | null
  tax_percent: number | null
  total_price: number | null
  delivery_days: number | null
}

export type SupplierPurchaseOrderDetailDto = {
  order: SupplierPurchaseOrderDetail | null
  items: SupplierPurchaseOrderItem[]
  notFound: boolean
}

const ORDER_SELECT = `
  id, code, quotation_code, requisition_code, external_code,
  supplier_name, supplier_cnpj, payment_condition,
  delivery_address, total_price, status, observations,
  created_at, created_by, quotation_id,
  accepted_at, estimated_delivery_date, delivery_days,
  accepted_by_supplier, cancellation_reason, updated_at,
  company_id, companies(name, cnpj)
` as const

export async function fetchSupplierPurchaseOrderDetail(
  supabase: SupabaseClient,
  supplierId: string,
  orderId: string,
): Promise<SupplierPurchaseOrderDetailDto> {
  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("supplier_id", supplierId)
      .single(),
    supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderId)
      .order("material_code", { ascending: true }),
  ])

  if (orderResult.error || !orderResult.data) {
    return { order: null, items: [], notFound: true }
  }

  const items = (itemsResult.data as SupplierPurchaseOrderItem[]) ?? []
  return {
    order: orderResult.data as SupplierPurchaseOrderDetail,
    items,
    notFound: false,
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierPurchaseOrderDetailQueryOptions(
  companyId: string,
  supplierId: string,
  orderId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierPurchaseOrderDetail(
      companyId,
      supplierId,
      orderId,
    ),
    queryFn: () =>
      fetchSupplierPurchaseOrderDetail(
        supabaseFactory(),
        supplierId,
        orderId,
      ),
    enabled: Boolean(companyId && supplierId && orderId),
  })
}