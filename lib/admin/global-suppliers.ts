export type GlobalSupplierTenant = {
  company_id: string
  company_name: string
  supplier_id: string
  code: string
  status: string | null
}

export type GlobalSupplierRow = {
  key: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  status: string | null
  tenants: GlobalSupplierTenant[]
  supplier_ids: string[]
  quotations_count: number
  orders_count: number
  users_count: number
  last_login_at: string | null
}

export function normalizeCnpj(cnpj: string | null | undefined): string | null {
  if (cnpj == null) return null
  const digits = String(cnpj).replace(/\D/g, "")
  return digits.length > 0 ? digits : null
}

export function supplierAggregateKey(row: {
  id: string
  cnpj?: string | null
}): string {
  const cnpj = normalizeCnpj(row.cnpj ?? null)
  return cnpj ? `cnpj:${cnpj}` : `id:${row.id}`
}

type SupplierSourceRow = {
  id: string
  company_id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  status: string | null
  companies?:
    | { id?: string; name?: string }
    | { id?: string; name?: string }[]
    | null
}

function embedCompany(
  value: SupplierSourceRow["companies"],
): { id: string; name: string } | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw?.id) return null
  return {
    id: String(raw.id),
    name: raw.name != null ? String(raw.name) : "—",
  }
}

/** Agrupa cadastros de fornecedor pelo CNPJ (ou id se sem CNPJ). */
export function aggregateSuppliersByIdentity(
  rows: SupplierSourceRow[],
): GlobalSupplierRow[] {
  const map = new Map<string, GlobalSupplierRow>()

  for (const row of rows) {
    const key = supplierAggregateKey(row)
    const company = embedCompany(row.companies)
    const tenant: GlobalSupplierTenant = {
      company_id: row.company_id,
      company_name: company?.name ?? "—",
      supplier_id: row.id,
      code: row.code,
      status: row.status,
    }

    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key,
        name: row.name,
        cnpj: row.cnpj,
        email: row.email,
        phone: row.phone,
        city: row.city,
        state: row.state,
        status: row.status,
        tenants: [tenant],
        supplier_ids: [row.id],
        quotations_count: 0,
        orders_count: 0,
        users_count: 0,
        last_login_at: null,
      })
      continue
    }

    existing.tenants.push(tenant)
    existing.supplier_ids.push(row.id)
    if (!existing.email && row.email) existing.email = row.email
    if (!existing.phone && row.phone) existing.phone = row.phone
    if (!existing.city && row.city) existing.city = row.city
    if (!existing.state && row.state) existing.state = row.state
    if (row.status === "active") existing.status = "active"
    if (row.name.length > existing.name.length) existing.name = row.name
  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  )
}

export function filterAggregatedSuppliers(
  rows: GlobalSupplierRow[],
  search: string | null,
): GlobalSupplierRow[] {
  const q = search?.trim().toLowerCase()
  if (!q) return rows
  const qDigits = q.replace(/\D/g, "")

  return rows.filter((row) => {
    if (row.name.toLowerCase().includes(q)) return true
    if (row.email?.toLowerCase().includes(q)) return true
    if (row.cnpj && qDigits && normalizeCnpj(row.cnpj)?.includes(qDigits)) {
      return true
    }
    if (row.tenants.some((t) => t.company_name.toLowerCase().includes(q))) {
      return true
    }
    if (row.tenants.some((t) => t.code.toLowerCase().includes(q))) return true
    return false
  })
}

export function countByKey(
  rows: { supplier_id: string | null }[] | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows ?? []) {
    if (!row.supplier_id) continue
    map.set(row.supplier_id, (map.get(row.supplier_id) ?? 0) + 1)
  }
  return map
}

export function sumCountsForIds(
  counts: Map<string, number>,
  ids: string[],
): number {
  let total = 0
  for (const id of ids) total += counts.get(id) ?? 0
  return total
}
