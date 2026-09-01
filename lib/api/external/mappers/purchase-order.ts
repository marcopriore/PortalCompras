// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurchaseOrderRow = Record<string, any>

/** Rateio contábil por linha — alinhado a SAP account assignment / WSO2 purOrdAccountAssignment. */
export type PurchaseOrderAccountAssignment = {
  sequence: number
  apportionment_percent: number
  currency: string
  ledger_account_code: string | null
  business_area: string | null
  controlling_area: string | null
  cost_center_code: string | null
  internal_order_id: string | null
  wbs_element: string | null
  asset_number: string | null
  profit_center: string | null
}

export type PurchaseOrderItemAccountAssignmentRow = {
  id?: string
  sequence: number
  apportionment_percent: number
  currency: string | null
  ledger_account_code: string | null
  business_area: string | null
  controlling_area: string | null
  cost_center_code: string | null
  internal_order_id: string | null
  wbs_element: string | null
  asset_number: string | null
  profit_center: string | null
}

export type PurchaseOrderItemRow = {
  id?: string | null
  material_code: string | null
  material_description: string | null
  quantity: number | null
  unit_of_measure: string | null
  unit_price: number | null
  total_price: number | null
  tax_percent?: number | null
  delivery_days: number | null
  quotation_item_id?: string | null
  contract_id?: string | null
  contract_item_id?: string | null
  /** Embed opcional `contracts(code)` */
  contracts?: { code: string } | { code: string }[] | null
  account_assignment_category?: string | null
  account_assignment_distribution?: string | null
  partial_invoice_distribution?: string | null
  site_code?: string | null
  tax_code?: string | null
  goods_receipt_expected?: boolean | null
  incoterms_code?: string | null
  incoterms_local?: string | null
  performance_period_start_date?: string | null
  performance_period_end_date?: string | null
  schedule_line_delivery_date?: string | null
  sap_item_extensions?: Record<string, unknown> | null
  purchase_order_item_account_assignments?:
    | PurchaseOrderItemAccountAssignmentRow[]
    | null
  account_assignments?: PurchaseOrderAccountAssignment[] | null
}

function embedOne(
  value: unknown,
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null
  }
  if (value && typeof value === "object") {
    return value as Record<string, unknown>
  }
  return null
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapAccountAssignmentRow(
  row: PurchaseOrderItemAccountAssignmentRow,
): PurchaseOrderAccountAssignment {
  return {
    sequence: row.sequence,
    apportionment_percent: Number(row.apportionment_percent),
    currency: asNullableString(row.currency) ?? "BRL",
    ledger_account_code: asNullableString(row.ledger_account_code),
    business_area: asNullableString(row.business_area),
    controlling_area: asNullableString(row.controlling_area),
    cost_center_code: asNullableString(row.cost_center_code),
    internal_order_id: asNullableString(row.internal_order_id),
    wbs_element: asNullableString(row.wbs_element),
    asset_number: asNullableString(row.asset_number),
    profit_center: asNullableString(row.profit_center),
  }
}

function resolveItemAccountAssignments(
  item: PurchaseOrderItemRow,
): PurchaseOrderAccountAssignment[] {
  if (item.account_assignments?.length) {
    return item.account_assignments
  }
  const embedded = item.purchase_order_item_account_assignments ?? []
  return embedded
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map(mapAccountAssignmentRow)
}

/**
 * Modelo de pedido para Loja de API (inbound GET) e outbound ERP
 * (`purchase_order.create` / `update` / `delete`).
 *
 * Agrupa tags no espírito SAP/Ariba (cabeçalho org · fornecedor · pagamento ·
 * referências · entrega · itens · rateio), em snake_case + envelope Valore.
 * Campos organizacionais reservados (`company_code`, etc.) ficam null até
 * o tenant mapear via middleware ou company_settings.
 */
export function mapPurchaseOrderToApi(
  row: PurchaseOrderRow,
  items: PurchaseOrderItemRow[] = [],
) {
  const supplierEmbed = embedOne(row.suppliers)
  const supplierCode =
    asNullableString(supplierEmbed?.code) ??
    asNullableString(row.supplier_code)
  const supplierName =
    asNullableString(row.supplier_name) ??
    asNullableString(supplierEmbed?.name)
  const supplierCnpj =
    asNullableString(row.supplier_cnpj) ??
    asNullableString(supplierEmbed?.cnpj)

  const currency = asNullableString(row.currency) ?? "BRL"

  return {
    id: row.id,
    code: row.code,
    external_code: row.external_code ?? row.erp_code ?? null,
    status: row.status,

    organization: {
      company_code: asNullableString(row.company_code),
      purchasing_organization: asNullableString(row.purchasing_organization),
      purchasing_group: asNullableString(row.purchasing_group),
      purchase_order_type: asNullableString(row.purchase_order_type),
      currency,
    },

    supplier: {
      id: row.supplier_id ?? null,
      code: supplierCode,
      name: supplierName,
      cnpj: supplierCnpj,
    },

    payment: {
      terms_code: asNullableString(row.payment_terms_code),
      terms_description: asNullableString(row.payment_condition),
    },

    references: {
      quotation_id: row.quotation_id ?? null,
      quotation_code: asNullableString(row.quotation_code),
      proposal_id: row.proposal_id ?? null,
      requisition_code: asNullableString(row.requisition_code),
    },

    delivery: {
      days: asNullableNumber(row.delivery_days),
      estimated_date: asNullableString(row.estimated_delivery_date),
      address: asNullableString(row.delivery_address),
    },

    totals: {
      amount: asNullableNumber(row.total_price),
      currency,
    },

    notes: asNullableString(row.observations),

    acceptance: {
      accepted_at: row.accepted_at ?? null,
      accepted_by_supplier: row.accepted_by_supplier === true,
    },

    created_at: row.created_at,
    updated_at: row.updated_at ?? null,

    items: items.map((item, index) => {
      const contractEmbed = embedOne(item.contracts)
      return {
        line_number: index + 1,
        id: item.id ?? null,
        material_code: item.material_code,
        material_description: item.material_description,
        quantity: asNullableNumber(item.quantity),
        unit_of_measure: item.unit_of_measure,
        unit_price: asNullableNumber(item.unit_price),
        price_unit: asNullableNumber(
          (item as { price_unit?: number | null }).price_unit,
        ),
        tax_percent: asNullableNumber(item.tax_percent),
        total_price: asNullableNumber(item.total_price),
        currency,
        delivery_days: asNullableNumber(item.delivery_days),
        plant_code: null as string | null,
        site_code: asNullableString(item.site_code),
        tax_code: asNullableString(item.tax_code),
        quotation_item_id: item.quotation_item_id ?? null,
        contract: {
          id: item.contract_id ?? null,
          item_id: item.contract_item_id ?? null,
          code: asNullableString(contractEmbed?.code),
        },
        account_configuration: {
          category: asNullableString(item.account_assignment_category),
          distribution: asNullableString(item.account_assignment_distribution) ?? "",
          partial_invoice_distribution:
            asNullableString(item.partial_invoice_distribution) ?? "",
        },
        goods_receipt_expected: item.goods_receipt_expected !== false,
        incoterms: {
          code: asNullableString(item.incoterms_code),
          local: asNullableString(item.incoterms_local),
        },
        schedule_line: {
          delivery_date: asNullableString(item.schedule_line_delivery_date),
          performance_period_start: asNullableString(item.performance_period_start_date),
          performance_period_end: asNullableString(item.performance_period_end_date),
        },
        sap_extensions: item.sap_item_extensions ?? {},
        account_assignments: resolveItemAccountAssignments(item),
      }
    }),
  }
}

export type PurchaseOrderApi = ReturnType<typeof mapPurchaseOrderToApi>

export const PURCHASE_ORDER_LIST_SELECT =
  "id, code, external_code, erp_code, status, supplier_id, supplier_name, supplier_cnpj, quotation_id, quotation_code, proposal_id, requisition_code, total_price, delivery_days, payment_condition, estimated_delivery_date, delivery_address, observations, accepted_at, accepted_by_supplier, created_at, updated_at, suppliers(code, name, cnpj)"

export const PURCHASE_ORDER_ITEM_SELECT =
  "id, material_code, material_description, quantity, unit_of_measure, unit_price, price_unit, total_price, tax_percent, delivery_days, quotation_item_id, contract_id, contract_item_id, site_code, tax_code, account_assignment_category, account_assignment_distribution, partial_invoice_distribution, goods_receipt_expected, incoterms_code, incoterms_local, performance_period_start_date, performance_period_end_date, schedule_line_delivery_date, sap_item_extensions, contracts(code), purchase_order_item_account_assignments(id, sequence, apportionment_percent, currency, ledger_account_code, business_area, controlling_area, cost_center_code, internal_order_id, wbs_element, asset_number, profit_center)"

export const PURCHASE_ORDER_ITEM_ACCOUNT_ASSIGNMENT_SELECT =
  "id, purchase_order_item_id, sequence, apportionment_percent, currency, ledger_account_code, business_area, controlling_area, cost_center_code, internal_order_id, wbs_element, asset_number, profit_center"
