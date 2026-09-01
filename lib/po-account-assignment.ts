import {
  SAP_ACCOUNT_ASSIGNMENT_CATEGORIES,
  type PurchaseOrderItemAccountAssignmentInput,
  type SapAccountAssignmentCategory,
  type SapDistributionFlag,
} from "@/types/po-account-assignment"

const CATEGORY_REQUIRED_FIELD: Record<
  SapAccountAssignmentCategory,
  keyof PurchaseOrderItemAccountAssignmentInput
> = {
  K: "cost_center_code",
  F: "internal_order_id",
  P: "wbs_element",
  A: "asset_number",
  X: "profit_center",
}

const CATEGORY_PRIMARY_LABELS: Record<SapAccountAssignmentCategory, string> = {
  K: "Centro de custo",
  F: "Ordem interna",
  P: "Elemento PEP",
  A: "Imobilizado",
  X: "Centro de lucro",
}

export function getCategoryPrimaryFieldKey(
  category: SapAccountAssignmentCategory,
): keyof PurchaseOrderItemAccountAssignmentInput {
  return CATEGORY_REQUIRED_FIELD[category]
}

export function getCategoryPrimaryLabel(category: SapAccountAssignmentCategory): string {
  return CATEGORY_PRIMARY_LABELS[category]
}

export function createEmptyAssignmentRow(
  sequence: number,
  apportionmentPercent = 100,
): PurchaseOrderItemAccountAssignmentInput {
  return {
    sequence,
    apportionment_percent: apportionmentPercent,
    currency: "BRL",
    ledger_account_code: null,
    business_area: null,
    controlling_area: null,
    cost_center_code: null,
    internal_order_id: null,
    wbs_element: null,
    asset_number: null,
    profit_center: null,
  }
}

export function readPrimaryValue(
  category: SapAccountAssignmentCategory,
  row: PurchaseOrderItemAccountAssignmentInput,
): string {
  const key = CATEGORY_REQUIRED_FIELD[category]
  const value = row[key]
  return value != null ? String(value) : ""
}

export function writePrimaryValue(
  category: SapAccountAssignmentCategory,
  row: PurchaseOrderItemAccountAssignmentInput,
  value: string,
): PurchaseOrderItemAccountAssignmentInput {
  const key = CATEGORY_REQUIRED_FIELD[category]
  return { ...row, [key]: value.trim() || null }
}

export type ItemAccountConfigEdit = {
  category: SapAccountAssignmentCategory | null
  assignments: PurchaseOrderItemAccountAssignmentInput[]
  usesApportionment: boolean
}

export function parseItemAccountConfigFromDb(
  category: string | null | undefined,
  distribution: string | null | undefined,
  rows: PurchaseOrderItemAccountAssignmentInput[],
): ItemAccountConfigEdit {
  const sorted = rows
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((row, index) => ({ ...row, sequence: index + 1 }))

  const normalizedCategory = isSapAccountAssignmentCategory(category) ? category : null
  const usesApportionment =
    distribution === "2" || sorted.length > 1

  if (sorted.length === 0) {
    return {
      category: normalizedCategory,
      assignments: normalizedCategory
        ? [createEmptyAssignmentRow(1, 100)]
        : [],
      usesApportionment: false,
    }
  }

  return {
    category: normalizedCategory,
    assignments: sorted,
    usesApportionment,
  }
}

export function validateApportionmentCap(
  assignments: Pick<PurchaseOrderItemAccountAssignmentInput, "apportionment_percent">[],
): AccountAssignmentValidationResult {
  const total = sumApportionmentPercent(assignments)
  if (total > 100) {
    return {
      ok: false,
      message: `O rateio não pode ultrapassar 100% (atual: ${total}%).`,
    }
  }
  return { ok: true }
}

export function buildAssignmentsForPersistence(
  config: ItemAccountConfigEdit,
): PurchaseOrderItemAccountAssignmentInput[] {
  const source = config.assignments.length
    ? config.assignments
    : [createEmptyAssignmentRow(1, 100)]

  return source.map((row, index) => ({
    ...row,
    sequence: index + 1,
    currency: row.currency?.trim() || "BRL",
  }))
}

export function isSapAccountAssignmentCategory(
  value: string | null | undefined,
): value is SapAccountAssignmentCategory {
  return (
    value != null &&
    (SAP_ACCOUNT_ASSIGNMENT_CATEGORIES as readonly string[]).includes(value)
  )
}

/** Rateio = mais de uma linha de classificação na mesma linha do pedido. */
export function hasAccountAssignmentApportionment(
  assignments: Pick<PurchaseOrderItemAccountAssignmentInput, "sequence">[],
): boolean {
  return assignments.length > 1
}

export function resolveSapDistributionFlags(
  assignments: Pick<PurchaseOrderItemAccountAssignmentInput, "sequence">[],
): {
  account_assignment_distribution: SapDistributionFlag
  partial_invoice_distribution: SapDistributionFlag
} {
  if (!hasAccountAssignmentApportionment(assignments)) {
    return {
      account_assignment_distribution: "",
      partial_invoice_distribution: "",
    }
  }
  return {
    account_assignment_distribution: "2",
    partial_invoice_distribution: "2",
  }
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100
}

export function sumApportionmentPercent(
  assignments: Pick<PurchaseOrderItemAccountAssignmentInput, "apportionment_percent">[],
): number {
  return roundPercent(
    assignments.reduce((sum, row) => sum + Number(row.apportionment_percent ?? 0), 0),
  )
}

export type AccountAssignmentValidationResult =
  | { ok: true }
  | { ok: false; message: string }

export type ItemAccountConfigFieldErrors = {
  category?: boolean
  primary?: boolean
  rateioTotal?: boolean
  rateioRows?: Record<number, { primary?: boolean; percent?: boolean }>
}

export function buildPersistedAssignments(
  config: ItemAccountConfigEdit,
): PurchaseOrderItemAccountAssignmentInput[] {
  if (!config.category) return []
  const assignments = buildAssignmentsForPersistence(config)
  return config.usesApportionment
    ? assignments
    : assignments.slice(0, 1).map((row) => ({ ...row, apportionment_percent: 100 }))
}

export function validateAccountConfigForSubmit(
  materialCode: string,
  config: ItemAccountConfigEdit,
): AccountAssignmentValidationResult & {
  fields?: ItemAccountConfigFieldErrors
} {
  const hasDraftData =
    config.category != null ||
    config.assignments.length > 0 ||
    config.usesApportionment

  if (!hasDraftData) return { ok: true }

  const fields: ItemAccountConfigFieldErrors = {}

  if (!config.category) {
    fields.category = true
    return {
      ok: false,
      message: `${materialCode}: selecione a classificação contábil.`,
      fields,
    }
  }

  const persistedRows = buildPersistedAssignments(config)
  if (persistedRows.length === 0) {
    fields.primary = true
    return {
      ok: false,
      message: `${materialCode}: informe o coletor de custo.`,
      fields,
    }
  }

  const requiredField = CATEGORY_REQUIRED_FIELD[config.category]
  fields.rateioRows = {}

  for (let index = 0; index < persistedRows.length; index++) {
    const row = persistedRows[index]
    const requiredValue = row[requiredField]
    if (requiredValue == null || String(requiredValue).trim() === "") {
      fields.rateioRows[index] = { primary: true }
      if (!config.usesApportionment) {
        fields.primary = true
      }
    }
    if (!Number.isFinite(row.apportionment_percent) || row.apportionment_percent <= 0) {
      fields.rateioRows[index] = {
        ...fields.rateioRows[index],
        percent: true,
      }
    }
  }

  if (config.usesApportionment || persistedRows.length > 1) {
    const total = sumApportionmentPercent(persistedRows)
    if (total !== 100) {
      fields.rateioTotal = true
      return {
        ok: false,
        message: `${materialCode}: o rateio deve somar 100% (atual: ${total}%).`,
        fields,
      }
    }
  } else if (persistedRows[0].apportionment_percent !== 100) {
    fields.rateioRows[0] = { ...fields.rateioRows[0], percent: true }
  }

  const missingPrimary = Object.values(fields.rateioRows).some((row) => row.primary)
  if (missingPrimary) {
    return {
      ok: false,
      message: `${materialCode}: preencha o coletor obrigatório.`,
      fields,
    }
  }

  return { ok: true }
}

export function validateAllAccountConfigsForSubmit(
  items: Array<{ id: string; material_code: string }>,
  configs: Record<string, ItemAccountConfigEdit>,
): {
  ok: true
} | {
  ok: false
  firstMessage: string
  errorsByItemId: Record<string, ItemAccountConfigFieldErrors>
} {
  const errorsByItemId: Record<string, ItemAccountConfigFieldErrors> = {}
  let firstMessage: string | null = null

  for (const item of items) {
    const config = configs[item.id] ?? {
      category: null,
      assignments: [],
      usesApportionment: false,
    }
    const result = validateAccountConfigForSubmit(item.material_code, config)
    if (!result.ok) {
      if (!firstMessage) firstMessage = result.message
      if (result.fields) errorsByItemId[item.id] = result.fields
    }
  }

  if (firstMessage) {
    return { ok: false, firstMessage, errorsByItemId }
  }
  return { ok: true }
}

export function validatePurchaseOrderItemAccountAssignments(
  category: SapAccountAssignmentCategory | null,
  assignments: PurchaseOrderItemAccountAssignmentInput[],
): AccountAssignmentValidationResult {
  if (!category) {
    if (assignments.length === 0) return { ok: true }
    return {
      ok: false,
      message: "Informe a categoria de classificação contábil (K, F, P, A ou X).",
    }
  }

  if (assignments.length === 0) {
    return {
      ok: false,
      message: "Informe ao menos uma linha de classificação contábil.",
    }
  }

  const requiredField = CATEGORY_REQUIRED_FIELD[category]

  for (const row of assignments) {
    const requiredValue = row[requiredField]
    if (requiredValue == null || String(requiredValue).trim() === "") {
      return {
        ok: false,
        message: `Preencha o campo obrigatório para categoria ${category}.`,
      }
    }
  }

  if (hasAccountAssignmentApportionment(assignments)) {
    const total = sumApportionmentPercent(assignments)
    if (total !== 100) {
      return {
        ok: false,
        message: `O rateio deve somar 100% (atual: ${total}%).`,
      }
    }
  } else if (assignments.length === 1) {
    const only = assignments[0]
    if (only.apportionment_percent !== 100) {
      return {
        ok: false,
        message: "Sem rateio, o percentual da classificação deve ser 100%.",
      }
    }
  }

  const sequences = assignments.map((row) => row.sequence)
  if (new Set(sequences).size !== sequences.length) {
    return { ok: false, message: "Sequências de rateio duplicadas." }
  }

  return { ok: true }
}

/** Mapeamento documentado Valore → WSO2/SAP (purOrdAccountAssignment). */
export function mapAccountAssignmentToWso2(
  row: PurchaseOrderItemAccountAssignmentInput,
) {
  return {
    acctAssignmentSeq: String(row.sequence),
    apportionmentPercent: row.apportionment_percent,
    currency: row.currency,
    ledgerAccountCode: row.ledger_account_code ?? undefined,
    businessArea: row.business_area ?? undefined,
    controllingArea: row.controlling_area ?? undefined,
    costCenterCode: row.cost_center_code ?? undefined,
    orderId: row.internal_order_id ?? undefined,
    wbsElement: row.wbs_element ?? undefined,
    assetNumber: row.asset_number ?? undefined,
    profitCenter: row.profit_center ?? undefined,
  }
}
