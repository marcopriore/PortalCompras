/** Helpers puros de ação ERP de pedido — seguros para Client Components. */

export type PurchaseOrderErpOperation = "create" | "update" | "delete"

export function outboundActionToPurchaseOrderOperation(
  action: string,
): PurchaseOrderErpOperation | null {
  if (action === "purchase_order.create") return "create"
  if (action === "purchase_order.update") return "update"
  if (action === "purchase_order.delete") return "delete"
  return null
}
