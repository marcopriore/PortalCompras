"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { costCentersOptionsQueryOptions } from "@/lib/queries/cost-centers-options"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type CostCenterOption = {
  id: string
  code: string
  description: string
}

type CostCenterSelectProps = {
  companyId: string | null | undefined
  value: string
  onChange: (code: string) => void
  required?: boolean
  disabled?: boolean
  label?: string
  hideLabel?: boolean
  triggerClassName?: string
  invalid?: boolean
  /** Carrega também inativos (útil na edição se o CC atual estiver inativo). */
  includeInactiveCodes?: string[]
  className?: string
}

export function CostCenterSelect({
  companyId,
  value,
  onChange,
  required = false,
  disabled = false,
  label = "Centro de Custo",
  hideLabel = false,
  triggerClassName,
  invalid = false,
  includeInactiveCodes = [],
  className,
}: CostCenterSelectProps) {
  const supabase = React.useMemo(() => createClient(), [])
  const costCentersQuery = useQuery({
    ...costCentersOptionsQueryOptions(
      companyId ?? "",
      includeInactiveCodes,
      () => supabase,
    ),
    enabled: Boolean(companyId),
  })

  const options = costCentersQuery.data ?? []
  const loading = costCentersQuery.isLoading

  return (
    <div className={className ?? (hideLabel ? "space-y-0" : "space-y-2")}>
      {!hideLabel ? (
        <Label>
          {label}
          {required ? " *" : ""}
        </Label>
      ) : null}
      <Select
        value={value || undefined}
        onValueChange={onChange}
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
                  : "Selecione o centro de custo"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.code}>
              <span className="font-mono text-xs mr-2">{opt.code}</span>
              {opt.description}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Resolve o código do centro padrão do usuário (profiles.cost_center_id → code). */
export async function loadUserDefaultCostCenterCode(
  userId: string,
): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase
    .from("profiles")
    .select("cost_center_id, cost_centers(code)")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return ""
  const rel = data.cost_centers as
    | { code?: string }
    | { code?: string }[]
    | null
  if (Array.isArray(rel)) return rel[0]?.code ?? ""
  return rel?.code ?? ""
}
