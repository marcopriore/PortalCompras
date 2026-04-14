export interface Contract {
  id: string
  company_id: string
  supplier_id: string
  supplier_name: string
  supplier_code: string
  code: string
  title: string
  type: "fornecimento" | "servico" | "sla" | "nda" | "outro"
  status: "draft" | "active" | "expired" | "cancelled"
  start_date: string
  end_date: string
  value: number | null
  file_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ContractType = Contract["type"]
export type ContractStatus = Contract["status"]

type SupplierEmbed = { name: string; code: string } | null

function normalizeSupplier(
  embed: SupplierEmbed | SupplierEmbed[] | undefined,
): SupplierEmbed {
  if (!embed) return null
  return Array.isArray(embed) ? embed[0] ?? null : embed
}

export function contractFromRow(row: unknown): Contract {
  const r = row as Record<string, unknown> & {
    suppliers?: SupplierEmbed | SupplierEmbed[] | null
  }
  const sup = normalizeSupplier(r.suppliers ?? undefined)
  const valueRaw = r.value
  return {
    id: String(r.id),
    company_id: String(r.company_id),
    supplier_id: String(r.supplier_id),
    supplier_name: sup?.name ?? "",
    supplier_code: sup?.code ?? "",
    code: String(r.code),
    title: String(r.title),
    type: r.type as Contract["type"],
    status: r.status as Contract["status"],
    start_date: String(r.start_date).slice(0, 10),
    end_date: String(r.end_date).slice(0, 10),
    value:
      valueRaw === null || valueRaw === undefined
        ? null
        : typeof valueRaw === "number"
          ? valueRaw
          : Number(valueRaw),
    file_url: r.file_url != null ? String(r.file_url) : null,
    notes: r.notes != null ? String(r.notes) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

export const CONTRACT_TYPES: ContractType[] = [
  "fornecimento",
  "servico",
  "sla",
  "nda",
  "outro",
]

export const CONTRACT_STATUSES: ContractStatus[] = [
  "draft",
  "active",
  "expired",
  "cancelled",
]
