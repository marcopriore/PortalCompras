export type ItemWriteInput = {
  code: string
  short_description: string
  long_description?: string | null
  unit_of_measure: string
  ncm?: string | null
  commodity_group?: string | null
  status?: "active" | "inactive"
  target_price?: number | null
  last_purchase_price?: number | null
  average_price?: number | null
}

export function parseItemWriteInput(raw: unknown): ItemWriteInput | string {
  if (!raw || typeof raw !== "object") return "Item inválido."
  const row = raw as Record<string, unknown>
  const code = String(row.code ?? "").trim()
  const short_description = String(row.short_description ?? "").trim()
  const unit_of_measure = String(row.unit_of_measure ?? "").trim()

  if (!code) return "code é obrigatório."
  if (!short_description) return "short_description é obrigatório."
  if (!unit_of_measure) return "unit_of_measure é obrigatório."

  const statusRaw = row.status != null ? String(row.status) : "active"
  const status = statusRaw === "inactive" ? "inactive" : "active"

  const parsePrice = (v: unknown): number | null => {
    if (v == null || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    code,
    short_description,
    long_description:
      row.long_description != null ? String(row.long_description).trim() || null : null,
    unit_of_measure,
    ncm: row.ncm != null ? String(row.ncm).trim() || null : null,
    commodity_group:
      row.commodity_group != null ? String(row.commodity_group).trim() || null : null,
    status,
    target_price: parsePrice(row.target_price),
    last_purchase_price: parsePrice(row.last_purchase_price),
    average_price: parsePrice(row.average_price),
  }
}

export function itemInputToRow(companyId: string, input: ItemWriteInput) {
  const now = new Date().toISOString()
  return {
    company_id: companyId,
    code: input.code,
    short_description: input.short_description,
    long_description: input.long_description ?? null,
    unit_of_measure: input.unit_of_measure,
    ncm: input.ncm ?? null,
    commodity_group: input.commodity_group ?? null,
    status: input.status ?? "active",
    target_price: input.target_price,
    last_purchase_price: input.last_purchase_price,
    average_price: input.average_price,
    source: "erp",
    sync_at: now,
  }
}
