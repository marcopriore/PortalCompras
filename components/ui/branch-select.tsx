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
  const [options, setOptions] = React.useState<BranchOption[]>([])
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
        .from("company_branches")
        .select("code, name, active")
        .eq("company_id", companyId)
        .order("code", { ascending: true })

      if (!alive) return
      const rows = (data ?? []) as {
        code: string
        name: string
        active: boolean
      }[]
      const allowInactive = new Set(
        includeInactiveCodes.filter(Boolean).map((c) => c.trim().toUpperCase()),
      )
      setOptions(
        rows
          .filter(
            (r) => r.active || allowInactive.has(r.code.trim().toUpperCase()),
          )
          .map((r) => ({
            code: r.code,
            name: r.name,
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
