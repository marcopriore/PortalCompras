"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TENANT_SETTING_GROUPS,
  type TenantSettingDefinition,
  type TenantSettingGroup,
} from "@/lib/settings/tenant-settings-registry"
import type {
  TenantFeatureBooleanDefinition,
  TenantFeatureTextDefinition,
  ErpVendor,
} from "@/lib/settings/tenant-feature-settings-registry"
import type { TenantFeatureConfig } from "@/lib/settings/tenant-feature-settings"
import type {
  ApiHttpMethod,
  ApiMatrixResource,
  ApiMatrixRowDefinition,
  TenantApiCapabilities,
} from "@/lib/settings/tenant-api-capabilities-registry"
import {
  API_HTTP_METHODS,
  buildEmptyApiCapabilities,
} from "@/lib/settings/tenant-api-capabilities-registry"

type GroupedDefinition = TenantSettingDefinition & { value: number }

type SettingsResponse = {
  settings?: Record<string, number>
  grouped?: Record<TenantSettingGroup, GroupedDefinition[]>
  featureConfig?: TenantFeatureConfig
  booleanDefinitions?: TenantFeatureBooleanDefinition[]
  erpVendorDefinition?: TenantFeatureTextDefinition
  apiCapabilities?: TenantApiCapabilities
  inboundMatrixRows?: ApiMatrixRowDefinition[]
  outboundMatrixRows?: ApiMatrixRowDefinition[]
  error?: string
}

type TenantSettingsTabProps = {
  companyId: string
}

const FEATURE_BOOLEAN_KEYS = [
  "accountAssignmentEnabled",
  "porEnabled",
  "erpIntegrationEnabled",
] as const

type FeatureBooleanStateKey = (typeof FEATURE_BOOLEAN_KEYS)[number]

const FEATURE_KEY_TO_CONFIG: Record<
  TenantFeatureBooleanDefinition["key"],
  FeatureBooleanStateKey
> = {
  account_assignment_enabled: "accountAssignmentEnabled",
  por_enabled: "porEnabled",
  erp_integration_enabled: "erpIntegrationEnabled",
}

function ApiMatrixTable({
  title,
  rows,
  direction,
  caps,
  disabled,
  onToggle,
}: {
  title: string
  rows: ApiMatrixRowDefinition[]
  direction: "inbound" | "outbound"
  caps: TenantApiCapabilities
  disabled?: boolean
  onToggle: (
    direction: "inbound" | "outbound",
    resource: ApiMatrixResource,
    method: ApiHttpMethod,
    value: boolean,
  ) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Recurso</TableHead>
              {API_HTTP_METHODS.map((method) => (
                <TableHead key={method} className="w-16 text-center">
                  {method}
                </TableHead>
              ))}
              <TableHead>ENDPOINT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${direction}-${row.resource}`}>
                <TableCell className="font-medium text-sm">{row.label}</TableCell>
                {API_HTTP_METHODS.map((method) => {
                  const cell = row.cells[method]
                  if (cell.kind === "na") {
                    return (
                      <TableCell
                        key={method}
                        className="text-center text-muted-foreground"
                      >
                        -
                      </TableCell>
                    )
                  }
                  const checked = Boolean(caps[direction][row.resource]?.[method])
                  return (
                    <TableCell key={method} className="text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) =>
                            onToggle(direction, row.resource, method, v === true)
                          }
                          aria-label={`${row.label} ${method}`}
                        />
                      </div>
                    </TableCell>
                  )
                })}
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.endpoint}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function TenantSettingsTab({ companyId }: TenantSettingsTabProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [grouped, setGrouped] = React.useState<
    Record<TenantSettingGroup, GroupedDefinition[]>
  >({
    sistema: [],
    negocios: [],
    contratos: [],
    ia: [],
    fornecedores: [],
  })
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [defaults, setDefaults] = React.useState<Record<string, number>>({})
  const [booleanDefs, setBooleanDefs] = React.useState<
    TenantFeatureBooleanDefinition[]
  >([])
  const [erpVendorDef, setErpVendorDef] = React.useState<
    TenantFeatureTextDefinition | null
  >(null)
  const [featureDraft, setFeatureDraft] = React.useState<TenantFeatureConfig>({
    accountAssignmentEnabled: true,
    porEnabled: true,
    erpIntegrationEnabled: false,
    erpVendor: "none",
  })
  const [featureDefaults, setFeatureDefaults] =
    React.useState<TenantFeatureConfig>(featureDraft)
  const [apiCapabilities, setApiCapabilities] = React.useState<TenantApiCapabilities>(
    () => buildEmptyApiCapabilities(),
  )
  const [apiCapabilitiesDefaults, setApiCapabilitiesDefaults] =
    React.useState<TenantApiCapabilities>(() => buildEmptyApiCapabilities())
  const [inboundRows, setInboundRows] = React.useState<ApiMatrixRowDefinition[]>([])
  const [outboundRows, setOutboundRows] = React.useState<ApiMatrixRowDefinition[]>(
    [],
  )

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
        negocios: [],
        contratos: [],
        ia: [],
        fornecedores: [],
      }
      setGrouped(nextGrouped)
      setBooleanDefs(data.booleanDefinitions ?? [])
      setErpVendorDef(data.erpVendorDefinition ?? null)
      setInboundRows(data.inboundMatrixRows ?? [])
      setOutboundRows(data.outboundMatrixRows ?? [])

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

      const config = data.featureConfig ?? featureDraft
      setFeatureDraft(config)
      setFeatureDefaults(config)

      const caps = data.apiCapabilities ?? buildEmptyApiCapabilities()
      setApiCapabilities(caps)
      setApiCapabilitiesDefaults(caps)
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

  function setFeatureBoolean(
    storageKey: TenantFeatureBooleanDefinition["key"],
    value: boolean,
  ) {
    const mapped = FEATURE_KEY_TO_CONFIG[storageKey]
    setFeatureDraft((prev) => ({ ...prev, [mapped]: value }))
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

    if (group === "negocios") {
      const nextFeature: TenantFeatureConfig = { ...featureDraft }
      for (const def of booleanDefs) {
        const mapped = FEATURE_KEY_TO_CONFIG[def.key]
        nextFeature[mapped] = def.defaultNewTenant
      }
      if (erpVendorDef) {
        nextFeature.erpVendor = erpVendorDef.defaultNewTenant
      }
      setFeatureDraft(nextFeature)
      setApiCapabilities(buildEmptyApiCapabilities())
    }
  }

  function setMatrixCell(
    direction: "inbound" | "outbound",
    resource: ApiMatrixResource,
    method: ApiHttpMethod,
    value: boolean,
  ) {
    setApiCapabilities((prev) => ({
      ...prev,
      [direction]: {
        ...prev[direction],
        [resource]: {
          ...prev[direction][resource],
          [method]: value,
        },
      },
    }))
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

      const booleans: Record<string, boolean> = {}
      for (const def of booleanDefs) {
        const mapped = FEATURE_KEY_TO_CONFIG[def.key]
        booleans[def.key] = featureDraft[mapped]
      }

      const res = await fetch("/api/admin/tenant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          settings,
          booleans,
          erpVendor: featureDraft.erpVendor,
          apiCapabilities,
        }),
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
    const numericChanged = Object.entries(draft).some(([key, raw]) => {
      const n = Number(String(raw).trim().replace(",", "."))
      return !Number.isNaN(n) && defaults[key] !== n
    })
    const featureChanged = FEATURE_BOOLEAN_KEYS.some(
      (key) => featureDraft[key] !== featureDefaults[key],
    )
    const erpChanged = featureDraft.erpVendor !== featureDefaults.erpVendor
    const capsChanged =
      JSON.stringify(apiCapabilities) !== JSON.stringify(apiCapabilitiesDefaults)
    return numericChanged || featureChanged || erpChanged || capsChanged
  }, [
    draft,
    defaults,
    featureDraft,
    featureDefaults,
    apiCapabilities,
    apiCapabilitiesDefaults,
  ])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando configurações…
      </div>
    )
  }

  const groupOrder: TenantSettingGroup[] = [
    "negocios",
    "sistema",
    "contratos",
    "ia",
    "fornecedores",
  ]

  const visibleGroups = groupOrder.filter(
    (group) =>
      (grouped[group]?.length ?? 0) > 0 ||
      (group === "negocios" &&
        (booleanDefs.length > 0 ||
          erpVendorDef != null ||
          inboundRows.length > 0 ||
          outboundRows.length > 0)),
  )

  if (visibleGroups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhuma configuração disponível para este tenant com as funcionalidades
        atuais.
      </p>
    )
  }

  const negociosBooleans = booleanDefs.filter((d) => d.group === "negocios")

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

            {defs.length > 0 ? (
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
                        <span className="text-xs text-muted-foreground w-14 shrink-0">
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
            ) : null}

            {group === "negocios" && negociosBooleans.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {negociosBooleans.map((def) => {
                  const mapped = FEATURE_KEY_TO_CONFIG[def.key]
                  return (
                    <div
                      key={def.key}
                      className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
                    >
                      <div className="space-y-1">
                        <Label htmlFor={`feature-${def.key}`}>{def.label}</Label>
                        <p className="text-xs text-muted-foreground">
                          {def.description}
                        </p>
                      </div>
                      <Switch
                        id={`feature-${def.key}`}
                        checked={featureDraft[mapped]}
                        onCheckedChange={(checked) =>
                          setFeatureBoolean(def.key, checked)
                        }
                      />
                    </div>
                  )
                })}
              </div>
            ) : null}

            {group === "negocios" && erpVendorDef ? (
              <div className="space-y-1.5 max-w-md">
                <Label htmlFor="erp-vendor">{erpVendorDef.label}</Label>
                <Select
                  value={featureDraft.erpVendor}
                  onValueChange={(value) =>
                    setFeatureDraft((prev) => ({
                      ...prev,
                      erpVendor: value as ErpVendor,
                    }))
                  }
                >
                  <SelectTrigger id="erp-vendor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {erpVendorDef.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {erpVendorDef.description}
                </p>
              </div>
            ) : null}

            {group === "negocios" &&
            (inboundRows.length > 0 || outboundRows.length > 0) ? (
              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Matriz de APIs (Loja de API)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Marque o método liberado para o tenant. Traço (-) = não
                    aplicável. Outbound também exige Integração outbound ligada.
                    REQ outbound: POST=criada, PUT=atualizada, DELETE=cancelada,
                    GET=aprovada/rejeitada.
                  </p>
                </div>

                {inboundRows.length > 0 ? (
                  <ApiMatrixTable
                    title="Inbound"
                    rows={inboundRows}
                    direction="inbound"
                    caps={apiCapabilities}
                    onToggle={setMatrixCell}
                  />
                ) : null}

                {outboundRows.length > 0 ? (
                  <ApiMatrixTable
                    title="Outbound"
                    rows={outboundRows}
                    direction="outbound"
                    caps={apiCapabilities}
                    disabled={!featureDraft.erpIntegrationEnabled}
                    onToggle={setMatrixCell}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
