export const queryKeys = {
  permissions: (companyId: string, userId: string) =>
    ["permissions", companyId, userId] as const,

  dashboardBuyer: (companyId: string) =>
    ["dashboard", "buyer", companyId] as const,

  requisitionsList: (companyId: string, scope: string) =>
    ["requisitions", "list", companyId, scope] as const,

  quotationsList: (companyId: string, scope: string) =>
    ["quotations", "list", companyId, scope] as const,

  purchaseOrdersList: (companyId: string, scope: string) =>
    ["purchaseOrders", "list", companyId, scope] as const,

  purchaseOrderDetail: (companyId: string, id: string) =>
    ["purchaseOrders", "detail", companyId, id] as const,

  contractsList: (companyId: string) =>
    ["contracts", "list", companyId] as const,

  suppliersList: (companyId: string) =>
    ["suppliers", "list", companyId] as const,

  itemsList: (companyId: string) => ["items", "list", companyId] as const,

  approvalsQueue: (companyId: string, userId: string) =>
    ["approvals", "queue", companyId, userId] as const,

  catalogOffers: (companyId: string) =>
    ["catalog", "offers", companyId] as const,

  reportsBundle: (companyId: string) =>
    ["reports", "bundle", companyId] as const,

  reportsSaving: (
    companyId: string,
    from: string,
    to: string,
    fornecedorKey: string,
    categoriaKey: string,
  ) =>
    [
      "reports",
      "saving",
      companyId,
      from,
      to,
      fornecedorKey,
      categoriaKey,
    ] as const,

  tenantSettings: (companyId: string, keys: string) =>
    ["tenantSettings", companyId, keys] as const,

  tenantFeatureConfig: (companyId: string) =>
    ["tenantFeatureConfig", companyId] as const,

  notifications: (companyId: string, userId: string) =>
    ["notifications", companyId, userId] as const,

  equalization: (companyId: string, quotationId: string) =>
    ["equalization", companyId, quotationId] as const,

  quotationDetail: (companyId: string, id: string) =>
    ["quotations", "detail", companyId, id] as const,

  requisitionDetail: (companyId: string, id: string) =>
    ["requisitions", "detail", companyId, id] as const,

  requisitionAttachments: (requisitionId: string) =>
    ["requisitions", "attachments", requisitionId] as const,

  contractDetail: (companyId: string, id: string) =>
    ["contracts", "detail", companyId, id] as const,

  paymentConditions: (companyId: string) =>
    ["paymentConditions", companyId] as const,

  contractPoLinkPrompt: (companyId: string) =>
    ["companySettings", companyId, "contract_po_link_prompt_enabled"] as const,

  quotationContractMatches: (
    quotationId: string,
    loadGeneration: number,
    selectionsKey: string,
  ) =>
    [
      "quotations",
      "contractMatches",
      quotationId,
      loadGeneration,
      selectionsKey,
    ] as const,

  supplierScores: (
    companyId: string,
    supplierIdsKey: string,
    priceWeight: number,
  ) => ["supplierScores", companyId, supplierIdsKey, priceWeight] as const,

  tenantFeatureFlags: (companyId: string, keysKey: string) =>
    ["tenantFeatureFlags", companyId, keysKey] as const,

  companyLogo: (companyId: string) => ["companyLogo", companyId] as const,

  catalogItemSearch: (companyId: string, term: string, variant: string) =>
    ["catalog", "itemSearch", companyId, term, variant] as const,

  catalogSupplierSearch: (companyId: string, term: string) =>
    ["catalog", "supplierSearch", companyId, term] as const,

  approvedRequisitionsImport: (companyId: string) =>
    ["requisitions", "approvedForQuotation", companyId] as const,

  quotationRequisitionPrefill: (companyId: string, requisitionId: string) =>
    ["quotations", "requisitionPrefill", companyId, requisitionId] as const,

  quotationEditForm: (companyId: string, quotationId: string) =>
    ["quotations", "editForm", companyId, quotationId] as const,

  requisitionEditForm: (companyId: string, requisitionId: string) =>
    ["requisitions", "editForm", companyId, requisitionId] as const,

  userDefaultCostCenter: (userId: string) =>
    ["profiles", "defaultCostCenter", userId] as const,

  contractFormSuppliers: (companyId: string) =>
    ["contracts", "formSuppliers", companyId] as const,
} as const
