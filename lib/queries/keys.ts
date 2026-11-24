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

  ownRequisitionCodes: (
    companyId: string,
    userId: string,
    codesKey: string,
  ) => ["requisitions", "ownCodes", companyId, userId, codesKey] as const,

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

  supplierDashboardActivity: (companyId: string, supplierId: string) =>
    ["supplier", "dashboard", "activity", companyId, supplierId] as const,

  supplierDashboardCharts: (
    companyId: string,
    supplierId: string,
    period: string,
  ) => ["supplier", "dashboard", "charts", companyId, supplierId, period] as const,

  supplierActivities: (companyId: string, supplierId: string) =>
    ["supplier", "activities", companyId, supplierId] as const,

  supplierQuotationsList: (companyId: string, supplierId: string) =>
    ["supplier", "quotations", "list", companyId, supplierId] as const,

  supplierQuotationDetail: (
    companyId: string,
    supplierId: string,
    quotationId: string,
  ) =>
    ["supplier", "quotations", "detail", companyId, supplierId, quotationId] as const,

  supplierNegotiationCounterOffers: (
    companyId: string,
    supplierId: string,
    roundId: string,
  ) =>
    [
      "supplier",
      "negotiationCounterOffers",
      companyId,
      supplierId,
      roundId,
    ] as const,

  supplierPurchaseOrdersList: (companyId: string, supplierId: string) =>
    ["supplier", "purchaseOrders", "list", companyId, supplierId] as const,

  supplierPurchaseOrderDetail: (
    companyId: string,
    supplierId: string,
    orderId: string,
  ) =>
    ["supplier", "purchaseOrders", "detail", companyId, supplierId, orderId] as const,

  supplierContractsList: (companyId: string, supplierId: string) =>
    ["supplier", "contracts", "list", companyId, supplierId] as const,

  supplierContractDetail: (
    companyId: string,
    supplierId: string,
    contractId: string,
  ) =>
    ["supplier", "contracts", "detail", companyId, supplierId, contractId] as const,

  supplierProfile: (companyId: string, supplierId: string) =>
    ["supplier", "profile", companyId, supplierId] as const,

  supplierPortalUsers: (companyId: string, supplierId: string) =>
    ["supplier", "portalUsers", companyId, supplierId] as const,

  solicitanteRequisitionsList: (companyId: string, scope: string) =>
    ["solicitante", "requisitions", "list", companyId, scope] as const,

  solicitanteSettings: (companyId: string, userId: string) =>
    ["solicitante", "settings", companyId, userId] as const,

  requisitionEditFormRequester: (
    companyId: string,
    requisitionId: string,
    requesterId: string,
  ) =>
    [
      "requisitions",
      "editForm",
      companyId,
      requisitionId,
      "requester",
      requesterId,
    ] as const,

  adminCompaniesList: () => ["admin", "companies", "list"] as const,

  adminProfilesCount: () => ["admin", "profiles", "count"] as const,

  adminAuditLogs: (filtersKey: string, page: number) =>
    ["admin", "auditLogs", filtersKey, page] as const,

  adminGlobalSuppliers: (search: string, page: number) =>
    ["admin", "globalSuppliers", search, page] as const,

  adminTenantDetail: (tenantId: string) =>
    ["admin", "tenant", tenantId, "detail"] as const,

  adminTenantDeleteEligible: (tenantId: string) =>
    ["admin", "tenant", tenantId, "deleteEligible"] as const,

  adminTenantMetrics: (tenantId: string, periodKey: string) =>
    ["admin", "tenant", tenantId, "metrics", periodKey] as const,

  adminTenantFeatures: (tenantId: string) =>
    ["admin", "tenant", tenantId, "features"] as const,

  supportTicketsList: (companyId: string) =>
    ["support", "tickets", companyId] as const,

  supportCategorias: (companyId: string, tipoKey: string) =>
    ["support", "categorias", companyId, tipoKey] as const,

  supportTicketDetail: (companyId: string, ticketId: string) =>
    ["support", "ticket", companyId, ticketId] as const,

  integrationLogs: (mode: string, filtersKey: string, page: number) =>
    ["integrationLogs", mode, filtersKey, page] as const,

  companyBranchesOptions: (companyId: string, inactiveKey: string) =>
    ["companyBranches", "options", companyId, inactiveKey] as const,

  costCentersOptions: (companyId: string, inactiveKey: string) =>
    ["costCenters", "options", companyId, inactiveKey] as const,

  buyerSettingsInitial: (companyId: string, userId: string) =>
    ["buyer", "settings", "initial", companyId, userId] as const,

  buyerApprovalsConfig: (companyId: string) =>
    ["buyer", "settings", "approvals", companyId] as const,

  buyerApprovers: (companyId: string) =>
    ["buyer", "settings", "approvers", companyId] as const,

  buyerPaymentConditionsAll: (companyId: string) =>
    ["paymentConditions", "all", companyId] as const,

  supplierTermsActive: (companyId: string) =>
    ["supplierTerms", "active", companyId] as const,

  costCentersSettingsList: (companyId: string) =>
    ["costCenters", "settingsList", companyId] as const,

  companyBranchesSettingsList: (companyId: string) =>
    ["companyBranches", "settingsList", companyId] as const,

  categoriesSettingsList: (companyId: string) =>
    ["categories", "settingsList", companyId] as const,

  permissionGroupsList: () => ["permissionGroups", "list"] as const,

  novoPedidoQuotation: (companyId: string, quotationId: string) =>
    ["quotations", "novoPedido", companyId, quotationId] as const,

  equalizacaoContractMatchesDialog: (
    quotationId: string,
    selectionsKey: string,
  ) =>
    [
      "quotations",
      "equalizacaoContractMatchesDialog",
      quotationId,
      selectionsKey,
    ] as const,
} as const
