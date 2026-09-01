import { useTenantSettings } from "@/lib/hooks/use-tenant-settings"
import {
  DEFAULT_PERCENT_DECIMAL_PLACES,
  DEFAULT_PRICE_DECIMAL_PLACES,
  DEFAULT_QUANTITY_MAX_DIGITS,
  maxQuantityFromDigits,
} from "@/lib/validation/numeric-input"

export function useNumericLimits() {
  const { get, loading } = useTenantSettings([
    "numeric_quantity_max_digits",
    "numeric_price_decimal_places",
  ])

  const quantityMaxDigits =
    get("numeric_quantity_max_digits") || DEFAULT_QUANTITY_MAX_DIGITS
  const maxQuantity = maxQuantityFromDigits(quantityMaxDigits)

  return {
    loading,
    quantityMaxDigits,
    maxQuantity,
    priceDecimalPlaces:
      get("numeric_price_decimal_places") || DEFAULT_PRICE_DECIMAL_PLACES,
    percentDecimalPlaces: DEFAULT_PERCENT_DECIMAL_PLACES,
  }
}
