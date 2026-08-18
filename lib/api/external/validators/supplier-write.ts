export type SupplierWriteInput = {
  code: string
  name: string
  cnpj?: string | null
  email?: string | null
  phone?: string | null
  category?: string | null
  city?: string | null
  state?: string | null
  status?: "active" | "inactive"
}

export function parseSupplierWriteInput(raw: unknown): SupplierWriteInput | string {
  if (!raw || typeof raw !== "object") return "Fornecedor inválido."
  const row = raw as Record<string, unknown>
  const code = String(row.code ?? "").trim()
  const name = String(row.name ?? "").trim()

  if (!code) return "code é obrigatório."
  if (!name) return "name é obrigatório."

  const statusRaw = row.status != null ? String(row.status) : "active"
  const status = statusRaw === "inactive" ? "inactive" : "active"

  return {
    code,
    name,
    cnpj: row.cnpj != null ? String(row.cnpj).trim() || null : null,
    email: row.email != null ? String(row.email).trim() || null : null,
    phone: row.phone != null ? String(row.phone).trim() || null : null,
    category: row.category != null ? String(row.category).trim() || null : null,
    city: row.city != null ? String(row.city).trim() || null : null,
    state: row.state != null ? String(row.state).trim() || null : null,
    status,
  }
}

export function supplierInputToRow(companyId: string, input: SupplierWriteInput) {
  return {
    company_id: companyId,
    code: input.code,
    name: input.name,
    cnpj: input.cnpj ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    category: input.category ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    status: input.status ?? "active",
  }
}
