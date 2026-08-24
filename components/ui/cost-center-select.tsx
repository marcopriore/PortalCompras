"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  includeInactiveCodes = [],
  className,
}: CostCenterSelectProps) {
  const [options, setOptions] = React.useState<CostCenterOption[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!companyId) {
      setOptions([])
      return
    }
    let alive = true
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("cost_centers")
        .select("id, code, description, active")
        .eq("company_id", companyId)
        .order("code", { ascending: true })

      if (!alive) return
      const rows = (data ?? []) as {
        id: string
        code: string
        description: string
        active: boolean
      }[]
      const allow = new Set(
        includeInactiveCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
      )
      setOptions(
        rows
          .filter((r) => r.active || allow.has(r.code.toUpperCase()))
          .map((r) => ({
            id: r.id,
            code: r.code,
            description: r.description,
          })),
      )
      setLoading(false)
    }
    void load()
    return () => {
      alive = false
    }
  }, [companyId, includeInactiveCodes.join("|")])

  return (
    <div className={className ?? "space-y-2"}>
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled || loading || options.length === 0}
      >
        <SelectTrigger>
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
