/** Categorias SAP de classificação contábil (account assignment category). */
export const SAP_ACCOUNT_ASSIGNMENT_CATEGORIES = ["K", "F", "P", "A", "X"] as const

export type SapAccountAssignmentCategory = (typeof SAP_ACCOUNT_ASSIGNMENT_CATEGORIES)[number]

export const SAP_ACCOUNT_ASSIGNMENT_CATEGORY_LABELS: Record<
  SapAccountAssignmentCategory,
  string
> = {
  K: "Centro de custo",
  F: "Ordem interna",
  P: "Elemento PEP (WBS)",
  A: "Imobilizado",
  X: "Classificação X",
}

/** Valor SAP quando há rateio; vazio quando não há. */
export type SapDistributionFlag = "" | "2"

export type PurchaseOrderItemAccountAssignment = {
  id?: string
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

export type PurchaseOrderItemAccountAssignmentInput = Omit<
  PurchaseOrderItemAccountAssignment,
  "id"
>

export type PurchaseOrderItemClassification = {
  account_assignment_category: SapAccountAssignmentCategory | null
  account_assignment_distribution: SapDistributionFlag
  partial_invoice_distribution: SapDistributionFlag
  site_code: string | null
  tax_code: string | null
  goods_receipt_expected: boolean
  incoterms_code: string | null
  incoterms_local: string | null
  performance_period_start_date: string | null
  performance_period_end_date: string | null
  schedule_line_delivery_date: string | null
  sap_item_extensions: Record<string, string | number | boolean | null>
  account_assignments: PurchaseOrderItemAccountAssignment[]
}
