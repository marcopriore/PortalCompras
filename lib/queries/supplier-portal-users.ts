import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierPortalUser = {
  id: string
  full_name: string | null
  email: string | null
  status: string
  is_supplier_admin: boolean
  login_cnpj: string | null
  created_at: string
}

export type SupplierPortalUsersDto = {
  users: SupplierPortalUser[]
  limit: number
  canAdd: boolean
}

export async function fetchSupplierPortalUsers(): Promise<SupplierPortalUsersDto> {
  const res = await fetch("/api/supplier-portal/users")
  const data = (await res.json()) as {
    users?: SupplierPortalUser[]
    limit?: number
    canAdd?: boolean
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Erro ao carregar usuários.")
  }
  return {
    users: data.users ?? [],
    limit: data.limit ?? 5,
    canAdd: Boolean(data.canAdd),
  }
}

export function supplierPortalUsersQueryOptions(
  companyId: string,
  supplierId: string,
) {
  return queryOptions({
    queryKey: queryKeys.supplierPortalUsers(companyId, supplierId),
    queryFn: fetchSupplierPortalUsers,
    enabled: Boolean(companyId && supplierId),
  })
}