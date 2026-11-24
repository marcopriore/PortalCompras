import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"

export async function invalidateSupplierAfterPurchaseOrderMutation(
  queryClient: QueryClient,
  companyId: string,
  supplierId: string,
  orderId?: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierPurchaseOrdersList(companyId, supplierId),
  })
  if (orderId) {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.supplierPurchaseOrderDetail(
        companyId,
        supplierId,
        orderId,
      ),
    })
  }
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierDashboardActivity(companyId, supplierId),
  })
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierActivities(companyId, supplierId),
  })
}

export async function invalidateSupplierAfterProposalMutation(
  queryClient: QueryClient,
  companyId: string,
  supplierId: string,
  quotationId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierQuotationsList(companyId, supplierId),
  })
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierQuotationDetail(
      companyId,
      supplierId,
      quotationId,
    ),
  })
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierDashboardActivity(companyId, supplierId),
  })
  await queryClient.invalidateQueries({
    queryKey: ["supplier", "dashboard", "charts", companyId, supplierId],
  })
}

export async function invalidateSupplierAfterContractMutation(
  queryClient: QueryClient,
  companyId: string,
  supplierId: string,
  contractId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierContractsList(companyId, supplierId),
  })
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierContractDetail(
      companyId,
      supplierId,
      contractId,
    ),
  })
}

export async function invalidateSupplierPortalUsers(
  queryClient: QueryClient,
  companyId: string,
  supplierId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.supplierPortalUsers(companyId, supplierId),
  })
}