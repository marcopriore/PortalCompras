"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  clampQuantity,
  invalidFieldClass,
  normalizePercentText,
  parsePercentInput,
  parsePriceInput,
  parseQuantityInput,
  roundToDecimals,
} from "@/lib/validation/numeric-input"

type BaseNumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  invalid?: boolean
}

type QuantityInputProps = BaseNumericInputProps & {
  value: number
  maxQuantity: number
  onValueChange: (value: number) => void
}

export function QuantityInput({
  value,
  maxQuantity,
  onValueChange,
  invalid,
  className,
  onBlur,
  ...props
}: QuantityInputProps) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={text}
      aria-invalid={invalid || undefined}
      className={cn(invalidFieldClass(invalid), className)}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 7)
        setText(raw)
        const parsed = parseQuantityInput(raw, maxQuantity)
        if (parsed != null) onValueChange(parsed)
      }}
      onBlur={(e) => {
        const parsed = parseQuantityInput(text, maxQuantity)
        const next = parsed != null ? parsed : clampQuantity(value, maxQuantity)
        onValueChange(next)
        setText(String(next))
        onBlur?.(e)
      }}
    />
  )
}

type PriceInputProps = BaseNumericInputProps & {
  value: number
  decimalPlaces: number
  onValueChange: (value: number) => void
}

export function PriceInput({
  value,
  decimalPlaces,
  onValueChange,
  invalid,
  className,
  onBlur,
  ...props
}: PriceInputProps) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      aria-invalid={invalid || undefined}
      className={cn(invalidFieldClass(invalid), className)}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".")
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return
        const [, fraction = ""] = raw.split(".")
        if (fraction.length > decimalPlaces) return
        setText(raw)
        const parsed = parsePriceInput(raw, decimalPlaces)
        if (parsed != null) onValueChange(parsed)
      }}
      onBlur={(e) => {
        const parsed = parsePriceInput(text, decimalPlaces)
        const next =
          parsed != null ? parsed : roundToDecimals(Math.max(0, value), decimalPlaces)
        onValueChange(next)
        setText(String(next))
        onBlur?.(e)
      }}
    />
  )
}

type PercentInputProps = BaseNumericInputProps & {
  value: number
  decimalPlaces: number
  onValueChange: (value: number) => void
}

export function PercentInput({
  value,
  decimalPlaces,
  onValueChange,
  invalid,
  className,
  onBlur,
  ...props
}: PercentInputProps) {
  const [text, setText] = React.useState(String(value))

  React.useEffect(() => {
    setText(String(roundToDecimals(value, decimalPlaces)))
  }, [value, decimalPlaces])

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      aria-invalid={invalid || undefined}
      className={cn(invalidFieldClass(invalid), className)}
      onChange={(e) => {
        const normalized = normalizePercentText(e.target.value, decimalPlaces)
        setText(normalized)
        const parsed = parsePercentInput(normalized, decimalPlaces)
        if (parsed != null) onValueChange(parsed)
      }}
      onBlur={(e) => {
        const parsed = parsePercentInput(text, decimalPlaces)
        const next =
          parsed != null ? parsed : roundToDecimals(Math.max(0, value), decimalPlaces)
        onValueChange(next)
        setText(String(next))
        onBlur?.(e)
      }}
    />
  )
}
