import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type PurchaseOrderPDFCompany,
  type PurchaseOrderPDFItem,
  type PurchaseOrderPDFOrder,
} from "@/lib/pdf/purchase-order-pdf"
import { loadTenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"

type ProfileAccess = {
  company_id: string | null
  supplier_id: string | null
  profile_type: string | null
  is_superadmin: boolean | null
}

type PurchaseOrderRow = {
  company_id: string
  supplier_id: string | null
  supplier_name?: string | null
  supplier_cnpj?: string | null
  external_code?: string | null
  erp_code?: string | null
  code?: string | null
  payment_condition?: string | null
  delivery_days?: number | null
  delivery_address?: string | null
  quotation_code?: string | null
  requisition_code?: string | null
  total_price?: number | null
  status?: string | null
  observations?: string | null
  created_at?: string | null
  estimated_delivery_date?: string | null
  accepted_at?: string | null
}

export async function resolveBuyerCompanyIdForPdf(
  profile: ProfileAccess,
): Promise<string | null> {
  if (profile.profile_type === "supplier") return null

  let companyId = profile.company_id
  if (!companyId) return null

  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }

  return companyId
}

export function canAccessPurchaseOrderPdf(
  profile: ProfileAccess,
  order: PurchaseOrderRow,
  buyerCompanyId: string | null,
): boolean {
  const isSupplier = profile.profile_type === "supplier"

  if (isSupplier) {
    return (
      profile.supplier_id != null &&
      order.supplier_id != null &&
      profile.supplier_id === order.supplier_id
    )
  }

  if (profile.is_superadmin) {
    return buyerCompanyId != null && order.company_id === buyerCompanyId
  }

  return (
    profile.company_id != null && profile.company_id === order.company_id
  )
}

export function mapPurchaseOrderToPdfOrder(
  row: PurchaseOrderRow,
  supplier?: { name?: string | null; cnpj?: string | null } | null,
): PurchaseOrderPDFOrder {
  return {
    code: String(row.code ?? ""),
    erp_code: row.external_code ?? row.erp_code ?? null,
    supplier_name: String(row.supplier_name ?? supplier?.name ?? "—"),
    supplier_cnpj: row.supplier_cnpj ?? supplier?.cnpj ?? null,
    payment_condition: row.payment_condition ?? null,
    delivery_days: row.delivery_days ?? null,
    delivery_address: row.delivery_address ?? null,
    quotation_code: row.quotation_code ?? null,
    requisition_code: row.requisition_code ?? null,
    total_price: row.total_price != null ? Number(row.total_price) : null,
    status: String(row.status ?? ""),
    observations: row.observations ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    estimated_delivery_date: row.estimated_delivery_date ?? null,
    accepted_at: row.accepted_at ?? null,
  }
}

export function mapPurchaseOrderItemsToPdf(
  items: Record<string, unknown>[],
): PurchaseOrderPDFItem[] {
  return items.map((raw) => ({
    id: String(raw.id),
    material_code: String(raw.material_code ?? ""),
    material_description: String(raw.material_description ?? ""),
    quantity: Number(raw.quantity ?? 0),
    unit_of_measure:
      raw.unit_of_measure != null ? String(raw.unit_of_measure) : null,
    unit_price: Number(raw.unit_price ?? 0),
    price_unit: raw.price_unit != null ? Number(raw.price_unit) : 1,
    tax_percent: raw.tax_percent != null ? Number(raw.tax_percent) : null,
    total_price: raw.total_price != null ? Number(raw.total_price) : null,
  }))
}

export async function loadPurchaseOrderPdfContext(
  service: SupabaseClient,
  orderId: string,
) {
  const { data: order, error: orderError } = await service
    .from("purchase_orders")
    .select("*, suppliers(name, cnpj)")
    .eq("id", orderId)
    .maybeSingle()

  if (orderError || !order) {
    return { error: "Order not found" as const, status: 404 as const }
  }

  const row = order as PurchaseOrderRow & {
    suppliers?: { name?: string | null; cnpj?: string | null } | { name?: string | null; cnpj?: string | null }[] | null
  }

  const supplierEmbed = Array.isArray(row.suppliers)
    ? row.suppliers[0]
    : row.suppliers

  const { data: items } = await service
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", orderId)
    .order("material_code", { ascending: true })

  const { data: company } = await service
    .from("companies")
    .select("name, cnpj, logo_url")
    .eq("id", row.company_id)
    .maybeSingle()

  const featureConfig = await loadTenantFeatureConfig(service, row.company_id)

  return {
    order: mapPurchaseOrderToPdfOrder(row, supplierEmbed),
    items: mapPurchaseOrderItemsToPdf((items ?? []) as Record<string, unknown>[]),
    company: (company ?? null) as PurchaseOrderPDFCompany,
    accessRow: row,
    porEnabled: featureConfig.porEnabled,
  }
}
