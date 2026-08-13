"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, RotateCcw, Save, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  PASSWORD_POLICY_REGISTRY,
  passwordPolicyToRules,
  type PasswordPolicy,
} from "@/lib/settings/password-policy-registry"

type DefinitionRow = (typeof PASSWORD_POLICY_REGISTRY)[number] & {
  value: number | boolean
}

type SecurityResponse = {
  policy?: PasswordPolicy
  definitions?: DefinitionRow[]
  rules?: string[]
  error?: string
}

type TenantSecurityTabProps = {
  companyId: string
}

export function TenantSecurityTab({ companyId }: TenantSecurityTabProps) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [definitions, setDefinitions] = React.useState<DefinitionRow[]>([])
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [booleans, setBooleans] = React.useState<Record<string, boolean>>({})
  const [previewRules, setPreviewRules] = React.useState<string[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/tenant-security-settings?companyId=${encodeURIComponent(companyId)}`,
      )
      const data = (await res.json()) as SecurityResponse
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível carregar a política de senhas.")
        return
      }

      const defs = data.definitions ?? []
      setDefinitions(defs)
      setPreviewRules(data.rules ?? [])

      const nextDraft: Record<string, string> = {}
      const nextBool: Record<string, boolean> = {}
      for (const def of defs) {
        if (def.type === "boolean") {
          nextBool[def.key] = Boolean(def.value)
        } else {
          nextDraft[def.key] = String(def.value)
        }
      }
      setDraft(nextDraft)
      setBooleans(nextBool)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  React.useEffect(() => {
    void load()
  }, [load])

  function buildPreviewPolicy(): PasswordPolicy {
    return {
      minLength: Number(draft.password_min_length) || 8,
      requireUppercase: booleans.password_require_uppercase ?? true,
      requireLowercase: booleans.password_require_lowercase ?? true,
      requireDigit: booleans.password_require_digit ?? true,
      requireSpecial: booleans.password_require_special ?? true,
      expiryDays: Number(draft.password_expiry_days) || 0,
      historyCount: Number(draft.password_history_count) || 0,
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const settings: Record<string, unknown> = { ...draft, ...booleans }
      const res = await fetch("/api/admin/tenant-security-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, settings }),
      })
      const data = (await res.json()) as SecurityResponse & { success?: boolean }
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar.")
        return
      }
      toast.success("Política de senhas atualizada.")
      setPreviewRules(data.rules ?? passwordPolicyToRules(buildPreviewPolicy()))
      await load()
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    void load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando política de senhas…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Política de senhas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Regras aplicadas a compradores, solicitantes e fornecedores deste
            tenant — criação de usuário, reset administrativo, alteração de senha
            e expiração programada.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          {definitions.map((def) => (
            <div key={def.key} className="space-y-2">
              {def.type === "boolean" ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor={def.key}>{def.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {def.description}
                    </p>
                  </div>
                  <Switch
                    id={def.key}
                    checked={booleans[def.key] ?? false}
                    onCheckedChange={(checked) =>
                      setBooleans((prev) => ({ ...prev, [def.key]: checked }))
                    }
                  />
                </div>
              ) : (
                <>
                  <Label htmlFor={def.key}>{def.label}</Label>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      id={def.key}
                      type="number"
                      min={def.min}
                      max={def.max}
                      value={draft[def.key] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [def.key]: e.target.value }))
                      }
                      className="max-w-[140px]"
                    />
                    {def.unit ? (
                      <span className="text-sm text-muted-foreground">{def.unit}</span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Descartar
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold">Prévia das regras</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
            {passwordPolicyToRules(buildPreviewPolicy()).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {buildPreviewPolicy().expiryDays > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Senhas expiram após {buildPreviewPolicy().expiryDays} dias. Usuários
              serão direcionados a trocar a senha ao expirar.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Expiração programada desabilitada.
            </p>
          )}
          {previewRules.length > 0 && (
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Política salva no tenant.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
