export type SupplierRow = {
  id: string
  company_id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  category: string | null
  city: string | null
  state: string | null
  status: string | null
  created_at: string | null
}

export function mapSupplierToApi(
  row: SupplierRow,
  categories: string[] = [],
) {
  return {
    code: row.code,
    name: row.name,
    cnpj: row.cnpj,
    email: row.email,
    phone: row.phone,
    category: row.category,
    categories,
    city: row.city,
    state: row.state,
    status: row.status,
    created_at: row.created_at,
  }
}

export const SUPPLIER_SELECT =
  "id, company_id, code, name, cnpj, email, phone, category, city, state, status, created_at"
