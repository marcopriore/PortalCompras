import { cn } from "@/lib/utils"

/** Preço por unidade de medida (SAP order price unit). */
export const POR_OPTIONS = [1, 10, 100, 1000, 10000] as const
export type PorValue = (typeof POR_OPTIONS)[number]

export const DEFAULT_PRICE_DECIMAL_PLACES = 5
export const DEFAULT_PERCENT_DECIMAL_PLACES = 2

export function isPorValue(value: number): value is PorValue {
  return (POR_OPTIONS as readonly number[]).includes(value)
}

export function invalidFieldClass(invalid?: boolean): string {
  return cn(invalid && "border-destructive focus-visible:ring-destructive aria-invalid:border-destructive")
}

export function roundToDecimals(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces
  return Math.round(value * factor) / factor
}

export function countDecimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return 0
  const parts = String(value).split(".")
  return parts[1]?.length ?? 0
}

export function maxQuantityFromDigits(digits: number): number {
  const safe = Math.min(Math.max(Math.trunc(digits), 1), 9)
  return 10 ** safe - 1
}

export function digitsFromMaxQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 7
  return Math.min(9, Math.max(1, String(Math.trunc(value)).length))
}

export const DEFAULT_QUANTITY_MAX_DIGITS = 7
export const DEFAULT_MAX_QUANTITY = maxQuantityFromDigits(DEFAULT_QUANTITY_MAX_DIGITS)

export function clampQuantity(value: number, maxQuantity: number): number {
  if (!Number.isFinite(value)) return 1
  const intValue = Math.trunc(value)
  return Math.min(Math.max(intValue, 1), maxQuantity)
}

export function parseQuantityInput(
  raw: string,
  maxQuantity: number,
  maxDigits?: number,
): number | null {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  if (!/^\d+$/.test(trimmed)) return null
  const digitLimit = maxDigits ?? String(maxQuantity).length
  if (trimmed.length > digitLimit) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 1) return null
  if (value > maxQuantity) return null
  return value
}

export function validateQuantity(
  value: number,
  maxQuantity: number,
  options?: { min?: number },
): { ok: true } | { ok: false; message: string } {
  const min = options?.min ?? 1
  if (!Number.isFinite(value) || value < min) {
    return { ok: false, message: `Quantidade deve ser no mínimo ${min}.` }
  }
  if (!Number.isInteger(value)) {
    return { ok: false, message: "Quantidade deve ser um número inteiro." }
  }
  if (value > maxQuantity) {
    return {
      ok: false,
      message: `Quantidade não pode exceder ${maxQuantity.toLocaleString("pt-BR")}.`,
    }
  }
  return { ok: true }
}

export function parsePriceInput(
  raw: string,
  decimalPlaces: number,
): number | null {
  const normalized = raw.trim().replace(",", ".")
  if (normalized === "" || normalized === ".") return null
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  const [, fraction = ""] = normalized.split(".")
  if (fraction.length > decimalPlaces) return null
  return roundToDecimals(value, decimalPlaces)
}

export function validatePrice(
  value: number,
  decimalPlaces: number,
  options?: { required?: boolean; minExclusive?: number },
): { ok: true } | { ok: false; message: string } {
  const required = options?.required ?? true
  const minExclusive = options?.minExclusive ?? 0
  if (!Number.isFinite(value)) {
    return required
      ? { ok: false, message: "Informe um valor válido." }
      : { ok: true }
  }
  if (value <= minExclusive) {
    return { ok: false, message: "O valor deve ser maior que zero." }
  }
  if (countDecimalPlaces(value) > decimalPlaces) {
    return {
      ok: false,
      message: `Use no máximo ${decimalPlaces} casa(s) decimal(is).`,
    }
  }
  return { ok: true }
}

/** Normaliza texto de percentual: remove zeros à esquerda, limita casas decimais. */
export function normalizePercentText(raw: string, decimalPlaces: number): string {
  let text = raw.trim().replace(",", ".")
  if (text === "") return ""

  const negative = text.startsWith("-")
  if (negative) text = text.slice(1)

  text = text.replace(/[^\d.]/g, "")
  const dotIndex = text.indexOf(".")
  if (dotIndex >= 0) {
    const intPart = text.slice(0, dotIndex).replace(/^0+(?=\d)/, "") || "0"
    const fracPart = text.slice(dotIndex + 1).replace(/\./g, "").slice(0, decimalPlaces)
    text = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart
  } else {
    text = text.replace(/^0+(?=\d)/, "") || "0"
  }

  return negative ? `-${text}` : text
}

export function parsePercentInput(
  raw: string,
  decimalPlaces: number,
): number | null {
  const normalized = normalizePercentText(raw, decimalPlaces)
  if (normalized === "" || normalized === ".") return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return roundToDecimals(value, decimalPlaces)
}

export function formatPercentValue(value: number, decimalPlaces: number): string {
  const rounded = roundToDecimals(value, decimalPlaces)
  return String(rounded)
}

export function validatePercent(
  value: number,
  decimalPlaces: number,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, message: "Percentual deve estar entre 0 e 100." }
  }
  if (countDecimalPlaces(value) > decimalPlaces) {
    return {
      ok: false,
      message: `Percentual com no máximo ${decimalPlaces} casa(s) decimal(is).`,
    }
  }
  return { ok: true }
}

/** Total da linha: quantidade × preço unitário × POR (fator SAP para casas decimais). */
export function computeLineTotal(
  quantity: number,
  unitPrice: number,
  priceUnit: number,
): number {
  const por = priceUnit > 0 ? priceUnit : 1
  return roundToDecimals(quantity * unitPrice * por, DEFAULT_PRICE_DECIMAL_PLACES)
}
