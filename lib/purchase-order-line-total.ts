import { computeLineTotal, isPorValue } from "@/lib/validation/numeric-input"

export function resolveLinePorMultiplier(
  priceUnit: number,
  porEnabled: boolean,
): number {
  return porEnabled && isPorValue(priceUnit) ? priceUnit : 1
}

export function computePurchaseOrderLineTotal(
  quantity: number,
  unitPrice: number,
  priceUnit: number,
  porEnabled: boolean,
): number {
  return computeLineTotal(
    quantity,
    unitPrice,
    resolveLinePorMultiplier(priceUnit, porEnabled),
  )
}
