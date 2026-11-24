import { queryOptions } from "@tanstack/react-query"
import type { GlobalSupplierRow } from "@/lib/admin/global-suppliers"
import { queryKeys } from "@/lib/queries/keys"

export type AdminGlobalSuppliersDto = {
  suppliers: GlobalSupplierRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function fetchAdminGlobalSuppliers(
  page: number,
  pageSize: number,
  search: string,
): Promise<AdminGlobalSuppliersDto> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (search.trim()) {
    params.set("search", search.trim())
  }

  const res = await fetch(`/api/admin/suppliers?${params}`, { cache: "no-store" })
  const payload = (await res.json()) as {
    data?: {
      suppliers: GlobalSupplierRow[]
      page: number
      page_size: number
      total: number
      total_pages: number
    }
    error?: string
  }

  if (!res.ok) {
    throw new Error(payload.error ?? "Erro ao listar fornecedores.")
  }

  return {
    suppliers: payload.data?.suppliers ?? [],
    total: payload.data?.total ?? 0,
    page: payload.data?.page ?? page,
    pageSize: payload.data?.page_size ?? pageSize,
    totalPages: payload.data?.total_pages ?? 0,
  }
}

export function adminGlobalSuppliersQueryOptions(
  page: number,
  pageSize: number,
  search: string,
) {
  return queryOptions({
    queryKey: queryKeys.adminGlobalSuppliers(search, page),
    queryFn: () => fetchAdminGlobalSuppliers(page, pageSize, search),
  })
}