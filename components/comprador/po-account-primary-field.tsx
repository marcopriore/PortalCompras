"use client"

import { Input } from "@/components/ui/input"
import { CostCenterSelect } from "@/components/ui/cost-center-select"
import { cn } from "@/lib/utils"
import { getCategoryPrimaryLabel } from "@/lib/po-account-assignment"
import type { SapAccountAssignmentCategory } from "@/types/po-account-assignment"

type PoAccountPrimaryFieldProps = {
  companyId: string | null | undefined
  category: SapAccountAssignmentCategory
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  className?: string
}

/** Coletor principal por categoria SAP — mesma tipologia na grid e no modal de rateio. */
export function PoAccountPrimaryField({
  companyId,
  category,
  value,
  onChange,
  invalid = false,
  className,
}: PoAccountPrimaryFieldProps) {
  const primaryLabel = getCategoryPrimaryLabel(category)

  if (category === "K") {
    return (
      <CostCenterSelect
        companyId={companyId}
        value={value}
        onChange={onChange}
        hideLabel
        invalid={invalid}
        includeInactiveCodes={value ? [value] : []}
        triggerClassName={cn("h-8 w-full min-w-0 text-xs", className)}
        className="space-y-0"
      />
    )
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={primaryLabel}
      className={cn(
        "h-8 w-full min-w-0 px-2 text-xs",
        invalid && "border-destructive focus-visible:ring-destructive",
        className,
      )}
    />
  )
}
