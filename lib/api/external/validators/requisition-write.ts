export type RequisitionItemWriteInput = {
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  estimated_price: number | null
  commodity_group: string | null
  observations: string | null
}

export type RequisitionWriteInput = {
  external_code: string
  title: string
  description: string | null
  cost_center: string | null
  needed_by: string | null
  priority: "normal" | "urgent" | "critical"
  requester_name: string | null
  items: RequisitionItemWriteInput[]
}

const PRIORITIES = new Set(["normal", "urgent", "critical"])

function parseDateOnly(value: unknown): string | null {
  if (value == null || value === "") return null
  const raw = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

function parseItem(raw: unknown, index: number): RequisitionItemWriteInput | string {
  if (!raw || typeof raw !== "object") return `Item ${index}: inválido.`
  const row = raw as Record<string, unknown>
  const material_description = String(row.material_description ?? "").trim()
  const quantity = Number(row.quantity)

  if (!material_description) return `Item ${index}: material_description é obrigatório.`
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return `Item ${index}: quantity deve ser maior que zero.`
  }

  const parsePrice = (v: unknown): number | null => {
    if (v == null || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    material_code: row.material_code != null ? String(row.material_code).trim() || null : null,
    material_description,
    quantity,
    unit_of_measure:
      row.unit_of_measure != null ? String(row.unit_of_measure).trim() || null : null,
    estimated_price: parsePrice(row.estimated_price),
    commodity_group:
      row.commodity_group != null ? String(row.commodity_group).trim() || null : null,
    observations: row.observations != null ? String(row.observations).trim() || null : null,
  }
}

export function parseRequisitionWriteInput(raw: unknown): RequisitionWriteInput | string {
  if (!raw || typeof raw !== "object") return "Requisição inválida."
  const row = raw as Record<string, unknown>

  const external_code = String(row.external_code ?? "").trim()
  const title = String(row.title ?? "").trim()

  if (!external_code) return "external_code é obrigatório."
  if (!title) return "title é obrigatório."

  if (!Array.isArray(row.items) || row.items.length === 0) {
    return "items deve ser um array com pelo menos um item."
  }

  const items: RequisitionItemWriteInput[] = []
  for (let i = 0; i < row.items.length; i++) {
    const parsed = parseItem(row.items[i], i)
    if (typeof parsed === "string") return parsed
    items.push(parsed)
  }

  const priorityRaw = row.priority != null ? String(row.priority) : "normal"
  const priority = PRIORITIES.has(priorityRaw)
    ? (priorityRaw as RequisitionWriteInput["priority"])
    : "normal"

  const needed_by = parseDateOnly(row.needed_by)
  if (row.needed_by != null && row.needed_by !== "" && !needed_by) {
    return "needed_by inválido. Use YYYY-MM-DD."
  }

  const description =
    row.description != null ? String(row.description).trim().slice(0, 500) || null : null

  return {
    external_code,
    title,
    description,
    cost_center: row.cost_center != null ? String(row.cost_center).trim() || null : null,
    needed_by,
    priority,
    requester_name:
      row.requester_name != null ? String(row.requester_name).trim() || null : null,
    items,
  }
}

export function requisitionHeaderToRow(
  companyId: string,
  input: RequisitionWriteInput,
  code: string,
  status: string,
) {
  return {
    company_id: companyId,
    code,
    external_code: input.external_code,
    title: input.title,
    description: input.description,
    cost_center: input.cost_center,
    needed_by: input.needed_by,
    priority: input.priority,
    requester_name: input.requester_name,
    origin: "erp",
    status,
  }
}

export function requisitionItemsToRows(
  companyId: string,
  requisitionId: string,
  items: RequisitionItemWriteInput[],
) {
  return items.map((item) => ({
    requisition_id: requisitionId,
    company_id: companyId,
    material_code: item.material_code,
    material_description: item.material_description,
    quantity: item.quantity,
    unit_of_measure: item.unit_of_measure,
    estimated_price: item.estimated_price,
    commodity_group: item.commodity_group,
    observations: item.observations,
  }))
}

export const REQUISITION_EDITABLE_STATUSES = new Set(["pending", "rejected"])

export const REQUISITION_CANCELLABLE_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
])
