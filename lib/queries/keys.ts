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
} as const
