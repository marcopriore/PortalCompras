export type ContractStatus =
  | "draft"
  | "pending_acceptance"
  | "active"
  | "expired"
  | "cancelled"
export type ContractType = "fornecimento" | "servico" | "sla" | "nda" | "outro"
export type ContractKind = "por_valor" | "por_quantidade"

export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "fornecimento", label: "Fornecimento" },
  { value: "servico", label: "Serviço" },
  { value: "sla", label: "SLA" },
  { value: "nda", label: "NDA" },
  { value: "outro", label: "Outro" },
]

export const CONTRACT_KINDS: { value: ContractKind; label: string }[] = [
  { value: "por_valor", label: "Contrato por Valor" },
  { value: "por_quantidade", label: "Contrato por Quantidade" },
]

export const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "pending_acceptance", label: "Aguardando Aceite" },
  { value: "active", label: "Ativo" },
  { value: "expired", label: "Expirado" },
  { value: "cancelled", label: "Cancelado" },
]

export interface ContractItem {
  id: string
  contract_id: string
  company_id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  quantity_contracted: number
  quantity_consumed: number
  unit_price: number
  total_price: number
  consumed_value: number
  delivery_days: number | null
  notes: string | null
  quotation_item_id: string | null
  created_at: string
  eliminated: boolean
  eliminated_at: string | null
  eliminated_reason: string | null
}

export interface ContractItemForm {
  material_code: string
  material_description: string
  unit_of_measure: string
  quantity_contracted: string
  unit_price: string
  delivery_days: string
  notes: string
  item_id?: string
  _fromQuotation?: boolean
}

export interface ContractAcceptance {
  id: string
  contract_id: string
  company_id: string
  supplier_id: string
  action: "accepted" | "refused"
  notes: string | null
  term_version: string | null
  term_version_date: string | null
  ip_address: string | null
  user_id: string | null
  created_at: string
}

export interface Contract {
  id: string
  company_id: string
  supplier_id: string
  supplier_name: string
  supplier_code: string
  /** Nome da empresa compradora (ex.: joins em APIs do fornecedor). */
  buyer_company_name?: string
  code: string
  title: string
  contract_kind: ContractKind
  /** Categoria de negócio (fornecimento, SLA, …); opcional na tipagem para compatibilidade. */
  type?: ContractType
  status: ContractStatus
  start_date: string
  end_date: string
  value: number | null
  total_value: number | null
  consumed_value: number
  consumed_quantity: number
  payment_condition_id: string | null
  payment_condition_code: string | null
  payment_condition_description: string | null
  contract_terms: string | null
  erp_code: string | null
  quotation_id: string | null
  file_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  sent_for_acceptance_at: string | null
  accepted_at: string | null
  accepted_by_supplier: string | null
  refusal_reason: string | null
  items?: ContractItem[]
}

export function contractItemFromRow(row: unknown): ContractItem {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id ?? ""),
    contract_id: String(r.contract_id ?? ""),
    company_id: String(r.company_id ?? ""),
    material_code: String(r.material_code ?? ""),
    material_description: String(r.material_description ?? ""),
    unit_of_measure:
      r.unit_of_measure != null ? String(r.unit_of_measure) : null,
    quantity_contracted: Number(r.quantity_contracted ?? 0),
    quantity_consumed: Number(r.quantity_consumed ?? 0),
    unit_price: Number(r.unit_price ?? 0),
    total_price: Number(r.total_price ?? 0),
    consumed_value: Number(r.consumed_value ?? 0),
    delivery_days:
      r.delivery_days != null ? Number(r.delivery_days) : null,
    notes: r.notes != null ? String(r.notes) : null,
    quotation_item_id:
      r.quotation_item_id != null ? String(r.quotation_item_id) : null,
    created_at: String(r.created_at ?? ""),
    eliminated: Boolean(r.eliminated ?? false),
    eliminated_at: r.eliminated_at ? String(r.eliminated_at) : null,
    eliminated_reason: r.eliminated_reason
      ? String(r.eliminated_reason)
      : null,
  }
}

export function contractFromRow(row: unknown): Contract {
  const r = row as Record<string, unknown>
  const supplier = Array.isArray(r.suppliers)
    ? (r.suppliers[0] as Record<string, unknown>)
    : (r.suppliers as Record<string, unknown> | null)
  const rawCompanies = r.companies
  let companyEmbed: Record<string, unknown> | null = null
  if (Array.isArray(rawCompanies) && rawCompanies[0]) {
    companyEmbed = rawCompanies[0] as Record<string, unknown>
  } else if (
    rawCompanies &&
    typeof rawCompanies === "object" &&
    !Array.isArray(rawCompanies)
  ) {
    companyEmbed = rawCompanies as Record<string, unknown>
  }
  const pc = Array.isArray(r.payment_conditions)
    ? (r.payment_conditions[0] as Record<string, unknown>)
    : (r.payment_conditions as Record<string, unknown> | null)
  const kindRaw = r.contract_kind as ContractKind | undefined
  const typeRaw = r.type as ContractType | undefined
  return {
    id: String(r.id ?? ""),
    company_id: String(r.company_id ?? ""),
    supplier_id: String(r.supplier_id ?? ""),
    supplier_name: String(supplier?.name ?? ""),
    supplier_code: String(supplier?.code ?? ""),
    buyer_company_name:
      companyEmbed?.name != null ? String(companyEmbed.name) : undefined,
    code: String(r.code ?? ""),
    title: String(r.title ?? ""),
    contract_kind: kindRaw ?? "por_valor",
    type: typeRaw,
    status: (r.status as ContractStatus) ?? "draft",
    start_date: String(r.start_date ?? ""),
    end_date: String(r.end_date ?? ""),
    value: r.value != null ? Number(r.value) : null,
    total_value: r.total_value != null ? Number(r.total_value) : null,
    consumed_value: Number(r.consumed_value ?? 0),
    consumed_quantity: Number(r.consumed_quantity ?? 0),
    payment_condition_id: r.payment_condition_id
      ? String(r.payment_condition_id)
      : null,
    payment_condition_code: pc?.code ? String(pc.code) : null,
    payment_condition_description: pc?.description
      ? String(pc.description)
      : null,
    contract_terms: r.contract_terms ? String(r.contract_terms) : null,
    erp_code: r.erp_code ? String(r.erp_code) : null,
    quotation_id: r.quotation_id ? String(r.quotation_id) : null,
    file_url: r.file_url ? String(r.file_url) : null,
    notes: r.notes ? String(r.notes) : null,
    created_by: r.created_by ? String(r.created_by) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    sent_for_acceptance_at: r.sent_for_acceptance_at
      ? String(r.sent_for_acceptance_at)
      : null,
    accepted_at: r.accepted_at ? String(r.accepted_at) : null,
    accepted_by_supplier: r.accepted_by_supplier
      ? String(r.accepted_by_supplier)
      : null,
    refusal_reason: r.refusal_reason ? String(r.refusal_reason) : null,
    items: Array.isArray(r.contract_items)
      ? (r.contract_items as unknown[]).map(contractItemFromRow)
      : undefined,
  }
}

export function isContractType(v: string): v is ContractType {
  return CONTRACT_TYPES.some((t) => t.value === v)
}

export function isContractKind(v: string): v is ContractKind {
  return CONTRACT_KINDS.some((k) => k.value === v)
}

export function isContractStatus(v: string): v is ContractStatus {
  return CONTRACT_STATUSES.some((s) => s.value === v)
}

export function contractAcceptanceFromRow(row: unknown): ContractAcceptance {
  const r = row as Record<string, unknown>
  const vd = r.term_version_date
  return {
    id: String(r.id ?? ""),
    contract_id: String(r.contract_id ?? ""),
    company_id: String(r.company_id ?? ""),
    supplier_id: String(r.supplier_id ?? ""),
    action: r.action === "refused" ? "refused" : "accepted",
    notes: r.notes != null ? String(r.notes) : null,
    term_version: r.term_version != null ? String(r.term_version) : null,
    term_version_date:
      vd != null
        ? typeof vd === "string"
          ? vd.slice(0, 10)
          : String(vd).slice(0, 10)
        : null,
    ip_address: r.ip_address != null ? String(r.ip_address) : null,
    user_id: r.user_id != null ? String(r.user_id) : null,
    created_at: String(r.created_at ?? ""),
  }
}
