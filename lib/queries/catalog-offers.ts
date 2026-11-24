import {
  infiniteQueryOptions,
  queryOptions,
} from "@tanstack/react-query"
import type { CatalogOffer } from "@/lib/catalog/types"
import { queryKeys } from "@/lib/queries/keys"

export const CATALOG_PAGE_SIZE = 18

export type CatalogOffersFilters = {
  search: string
  contractSearch: string
  commodityGroups: string[]
  supplierIds: string[]
}

export type CatalogOffersPage = {
  offers: CatalogOffer[]
  total: number
  hasMore: boolean
  can_order?: boolean
  commodityGroups?: string[]
  suppliers?: Array<{ id: string; name: string; code: string }>
  nextOffset: number
}

function buildOffersQueryParams(
  offset: number,
  includeFacets: boolean,
  filters: CatalogOffersFilters,
) {
  const params = new URLSearchParams()
  params.set("offset", String(offset))
  params.set("limit", String(CATALOG_PAGE_SIZE))
  if (includeFacets) params.set("include_facets", "1")
  if (filters.search.trim()) params.set("search", filters.search.trim())
  if (filters.contractSearch.trim()) {
    params.set("contract_search", filters.contractSearch.trim())
  }
  for (const group of filters.commodityGroups) {
    if (group.trim()) params.append("commodity_group", group)
  }
  for (const supplierId of filters.supplierIds) {
    if (supplierId.trim()) params.append("supplier_id", supplierId)
  }
  return params
}

export function catalogOffersFiltersKey(filters: CatalogOffersFilters): string {
  return JSON.stringify({
    s: filters.search,
    c: filters.contractSearch,
    g: [...filters.commodityGroups].sort(),
    u: [...filters.supplierIds].sort(),
  })
}

export async function fetchCatalogOffersPage(
  offset: number,
  includeFacets: boolean,
  filters: CatalogOffersFilters,
): Promise<CatalogOffersPage> {
  const params = buildOffersQueryParams(offset, includeFacets, filters)
  const res = await fetch(`/api/catalog/offers?${params.toString()}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? "Erro ao carregar ofertas")
  }
  const data = (await res.json()) as {
    offers: CatalogOffer[]
    total: number
    hasMore: boolean
    can_order?: boolean
    commodityGroups?: string[]
    suppliers?: Array<{ id: string; name: string; code: string }>
  }
  return {
    ...data,
    nextOffset: offset + data.offers.length,
  }
}

export function catalogOffersInfiniteQueryOptions(
  companyId: string,
  filters: CatalogOffersFilters,
) {
  const filtersKey = catalogOffersFiltersKey(filters)
  return infiniteQueryOptions({
    queryKey: [...queryKeys.catalogOffers(companyId), filtersKey] as const,
    queryFn: ({ pageParam }) =>
      fetchCatalogOffersPage(
        pageParam,
        pageParam === 0,
        filters,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled: Boolean(companyId),
  })
}

export function catalogOffersPageQueryOptions(
  companyId: string,
  offset: number,
  filters: CatalogOffersFilters,
) {
  const filtersKey = catalogOffersFiltersKey(filters)
  return queryOptions({
    queryKey: [
      ...queryKeys.catalogOffers(companyId),
      filtersKey,
      "page",
      offset,
    ] as const,
    queryFn: () => fetchCatalogOffersPage(offset, offset === 0, filters),
    enabled: Boolean(companyId),
  })
}