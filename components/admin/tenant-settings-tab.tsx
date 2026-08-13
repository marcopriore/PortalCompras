"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  TENANT_SETTING_GROUPS,
  type TenantSettingDefinition,
  type TenantSettingGroup,
} from "@/lib/settings/tenant-settings-registry"

type GroupedDefinition = TenantSettingDefinition & { value: number }

type SettingsResponse = {
  settings?: Record<string, number>
  grouped?: Record<TenantSettingGroup, GroupedDefinition[]>
  error?: string
}

type TenantSettingsTabProps = {
  companyId: string
}

export function TenantSettingsTab({ companyId }: TenantSettingsTabProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [grouped, setGrouped] = React.useState<
    Record<TenantSettingGroup, GroupedDefinition[]>
  >({
    sistema: [],
    contratos: [],
    ia: [],
    fornecedores: [],
  })
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [defaults, setDefaults] = React.useState<Record<string, number>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/tenant-settings?companyId=${encodeURIComponent(companyId)}`,
      )
      const data = (await res.json()) as SettingsResponse
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível carregar as configurações.")
        return
      }

      const nextGrouped = data.grouped ?? {
        sistema: [],
        contratos: [],
        ia: [],
        fornecedores: [],
      }
      setGrouped(nextGrouped)

      const nextDraft: Record<string, string> = {}
      const nextDefaults: Record<string, number> = {}
      for (const defs of Object.values(nextGrouped)) {
        for (const def of defs) {
          nextDraft[def.key] = String(def.value)
          nextDefaults[def.key] = def.value
        }
      }
      setDraft(nextDraft)
      setDefaults(nextDefaults)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  React.useEffect(() => {
    void load()
  }, [load])

  function handleChange(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleRestoreGroup(group: TenantSettingGroup) {
    const defs = grouped[group] ?? []
    setDraft((prev) => {
      const next = { ...prev }
      for (const def of defs) {
        next[def.key] = String(def.defaultValue)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const settings: Record<string, number> = {}
      for (const [key, raw] of Object.entries(draft)) {
        const n = Number(String(raw).trim().replace(",", "."))
        if (Number.isNaN(n)) {
          toast.error(`Valor inválido em ${key}`)
          return
        }
        settings[key] = n
      }

      const res = await fetch("/api/admin/tenant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, settings }),
      })
      const data = (await res.json()) as { error?: string; success?: boolean }
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Não foi possível salvar as configurações.")
        return
      }
      toast.success("Configurações salvas.")
      await load()
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = React.useMemo(() => {
    return Object.entries(draft).some(([key, raw]) => {
      const n = Number(String(raw).trim().replace(",", "."))
      return !Number.isNaN(n) && defaults[key] !== n
    })
  }, [draft, defaults])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando configurações…
      </div>
    )
  }

  const groupOrder: TenantSettingGroup[] = [
    "sistema",
    "contratos",
    "ia",
    "fornecedores",
  ]

  const visibleGroups = groupOrder.filter(
    (group) => (grouped[group]?.length ?? 0) > 0,
  )

  if (visibleGroups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhuma configuração disponível para este tenant com as funcionalidades
        atuais.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Configurações do tenant
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Parâmetros técnicos por cliente. Valores em branco usam o padrão do
            sistema até serem salvos.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || !hasChanges}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>

      {visibleGroups.map((group) => {
        const meta = TENANT_SETTING_GROUPS[group]
        const defs = grouped[group] ?? []
        return (
          <div
            key={group}
            className="bg-card border border-border rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  {meta.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {meta.description}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRestoreGroup(group)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Restaurar padrões
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {defs.map((def) => (
                <div key={def.key} className="space-y-1.5">
                  <Label htmlFor={`setting-${def.key}`}>{def.label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`setting-${def.key}`}
                      type="number"
                      min={def.min}
                      max={def.max}
                      step={1}
                      value={draft[def.key] ?? String(def.value)}
                      onChange={(e) => handleChange(def.key, e.target.value)}
                    />
                    {def.unit ? (
                      <span className="text-xs text-muted-foreground w-10 shrink-0">
                        {def.unit}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {def.description} (padrão: {def.defaultValue}
                    {def.unit ? ` ${def.unit}` : ""}, min {def.min}, máx{" "}
                    {def.max})
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
