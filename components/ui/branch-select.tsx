"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { companyBranchesOptionsQueryOptions } from "@/lib/queries/company-branches-options"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type BranchOption = {
  code: string
  name: string
}

type BranchSelectProps = {
  companyId: string | null | undefined
  /** site_code — company_branches.code */
  value: string
  onChange: (siteCode: string) => void
  required?: boolean
  disabled?: boolean
  label?: string
  hideLabel?: boolean
  triggerClassName?: string
  invalid?: boolean
  /** Códigos inativos ainda exibíveis (ex.: valor já gravado). */
  includeInactiveCodes?: string[]
  clearable?: boolean
  className?: string
}

export function BranchSelect({
  companyId,
  value,
  onChange,
  required = false,
  disabled = false,
  label = "Centro / Filial",
  hideLabel = false,
  triggerClassName,
  invalid = false,
  includeInactiveCodes = [],
  clearable = false,
  className,
}: BranchSelectProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const inactiveKey = includeInactiveCodes.join("|")
  const branchesQuery = useQuery({
    ...companyBranchesOptionsQueryOptions(
      companyId ?? "",
      includeInactiveCodes,
      () => supabase,
    ),
    enabled: Boolean(companyId),
  })

  const options = branchesQuery.data ?? []
  const loading = branchesQuery.isLoading

  return (
    <div className={className ?? (hideLabel ? "space-y-0" : "space-y-2")}>
      {!hideLabel ? (
        <Label>
          {label}
          {required ? " *" : ""}
        </Label>
      ) : null}
      <Select
        value={value || (clearable ? "__none__" : undefined)}
        onValueChange={(next) => {
          if (clearable && next === "__none__") {
            onChange("")
            return
          }
          onChange(next)
        }}
        disabled={disabled || loading || options.length === 0}
      >
        <SelectTrigger
          className={cn(
            triggerClassName,
            invalid && "border-destructive focus:ring-destructive",
          )}
        >
          <SelectValue
            placeholder={
              loading
                ? "Carregando..."
                : options.length === 0
                  ? "Nenhum centro cadastrado"
                  : "Selecione o centro / filial"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {clearable ? (
            <SelectItem value="__none__">— Nenhuma —</SelectItem>
          ) : null}
          {options.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              <span className="font-mono text-xs mr-2">{opt.code}</span>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
