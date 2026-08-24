import type { SupabaseClient } from "@supabase/supabase-js"
import type { CatalogOffer } from "@/lib/catalog/types"
import type { ContractKind } from "@/types/contracts"

type CatalogOfferRow = {
  contract_item_id: string
  contract_id: string
  contract_code: string
  contract_title: string
  contract_kind: ContractKind
  supplier_id: string
  supplier_name: string
  supplier_code: string
  material_code: string
  material_description: string
  long_description: string | null
  unit_of_measure: string | null
  commodity_group: string | null
  unit_price: number
  delivery_days: number | null
  available_quantity: number | null
  available_value: number
  contract_end_date: string | null
  payment_condition_code: string | null
  payment_condition_description: string | null
  total_count: number
}

type CatalogFacetsJson = {
  commodity_groups: string[]
  suppliers: Array<{ id: string; name: string; code: string }>
}

function mapOfferRow(row: CatalogOfferRow): CatalogOffer {
  return {
    contractItemId: row.contract_item_id,
    contractId: row.contract_id,
    contractCode: row.contract_code,
    contractTitle: row.contract_title,
    contractKind: row.contract_kind,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierCode: row.supplier_code,
    materialCode: row.material_code,
    materialDescription: row.material_description,
    longDescription: row.long_description,
    unitOfMeasure: row.unit_of_measure,
    commodityGroup: row.commodity_group,
    unitPrice: Number(row.unit_price) || 0,
    deliveryDays: row.delivery_days,
    availableQuantity:
      row.available_quantity === null ? null : Number(row.available_quantity),
    availableValue: Number(row.available_value) || 0,
    contractEndDate: row.contract_end_date,
    paymentConditionCode: row.payment_condition_code,
    paymentConditionDescription: row.payment_condition_description,
  }
}

function normalizeFilterArray(values?: string[]): string[] | null {
  const cleaned = (values ?? []).map((v) => v.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned : null
}

export type CatalogOffersBuildOptions = {
  search?: string
  commodityGroups?: string[]
  supplierIds?: string[]
  offset?: number
  limit?: number
  includeFacets?: boolean
}

export type CatalogOffersPageResult = {
  offers: CatalogOffer[]
  total: number
  hasMore: boolean
  commodityGroups: string[]
  suppliers: Array<{ id: string; name: string; code: string }>
}

export async function buildCatalogOffers(
  supabase: SupabaseClient,
  companyId: string,
  options?: CatalogOffersBuildOptions,
): Promise<CatalogOffersPageResult> {
  const offset = Math.max(0, options?.offset ?? 0)
  const limit = options?.limit ?? 18
  const search = options?.search?.trim() || null
  const commodityGroups = normalizeFilterArray(options?.commodityGroups)
  const supplierIds = normalizeFilterArray(options?.supplierIds)

  const { data: pageRows, error: pageError } = await supabase.rpc(
    "get_catalog_offers_page",
    {
      p_company_id: companyId,
      p_search: search,
      p_commodity_groups: commodityGroups,
      p_supplier_ids: supplierIds,
      p_offset: offset,
      p_limit: limit,
    },
  )

  if (pageError) {
    throw new Error(pageError.message)
  }

  const rows = (pageRows ?? []) as CatalogOfferRow[]
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  const offers = rows.map(mapOfferRow)

  let commodityGroupsResult: string[] = []
  let suppliersResult: Array<{ id: string; name: string; code: string }> = []

  if (options?.includeFacets) {
    const { data: facetsData, error: facetsError } = await supabase.rpc(
      "get_catalog_offer_facets",
      {
        p_company_id: companyId,
        p_search: search,
        p_commodity_groups: commodityGroups,
        p_supplier_ids: supplierIds,
      },
    )

    if (facetsError) {
      throw new Error(facetsError.message)
    }

    const facets = (facetsData ?? {
      commodity_groups: [],
      suppliers: [],
    }) as CatalogFacetsJson

    commodityGroupsResult = facets.commodity_groups ?? []
    suppliersResult = facets.suppliers ?? []
  }

  return {
    offers,
    total,
    hasMore: offset + offers.length < total,
    commodityGroups: commodityGroupsResult,
    suppliers: suppliersResult,
  }
}
