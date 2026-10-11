/** Status transitions a supplier session may apply on purchase_orders. */
export const SUPPLIER_PO_ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<string, readonly string[]>
> = {
  sent: ["processing", "refused"],
}

export function isSupplierPoStatusTransitionAllowed(
  from: string,
  to: string,
): boolean {
  if (from === to) return true
  return SUPPLIER_PO_ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/** Header fields a supplier must not change via the portal client / RLS. */
export const SUPPLIER_PO_PROTECTED_COLUMNS = [
  "company_id",
  "supplier_id",
  "supplier_name",
  "supplier_cnpj",
  "payment_condition",
  "delivery_days",
  "delivery_address",
  "quotation_code",
  "quotation_id",
  "requisition_code",
  "total_price",
  "observations",
  "created_by",
  "code",
  "external_code",
  "erp_error_message",
] as const
