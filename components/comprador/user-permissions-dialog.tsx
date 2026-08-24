"use client"

import * as React from "react"
import {
  PERMISSION_CATALOG,
  groupPermissionsByCategory,
} from "@/lib/permissions/catalog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ShieldCheck } from "lucide-react"

type GroupOption = {
  id: string
  code: string
  name: string
  is_system: boolean
  permission_keys?: string[]
}

type UserPermissionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  companyId: string | null
  onSaved?: () => void
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  companyId,
  onSaved,
}: UserPermissionsDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<GroupOption[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<Set<string>>(
    new Set(),
  )
  const [directKeys, setDirectKeys] = React.useState<Set<string>>(new Set())
  const [effectiveKeys, setEffectiveKeys] = React.useState<string[]>([])
  const [showEffective, setShowEffective] = React.useState(false)

  const catalogByGroup = React.useMemo(
    () => groupPermissionsByCategory(PERMISSION_CATALOG),
    [],
  )

  const load = React.useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [groupsRes, userRes] = await Promise.all([
        fetch("/api/admin/permission-groups?withRules=1", { cache: "no-store" }),
        fetch(`/api/admin/user-permissions?userId=${userId}`, {
          cache: "no-store",
        }),
      ])
      const groupsData = await groupsRes.json()
      const userData = await userRes.json()

      if (!groupsRes.ok) {
        setError(groupsData.error ?? "Erro ao carregar grupos.")
        return
      }
      if (!userRes.ok) {
        setError(userData.error ?? "Erro ao carregar permissões do usuário.")
        return
      }

      setGroups((groupsData.groups ?? []) as GroupOption[])
      setSelectedGroupIds(new Set((userData.groupIds ?? []) as string[]))
      setDirectKeys(new Set((userData.directPermissionKeys ?? []) as string[]))
      setEffectiveKeys((userData.effectivePermissionKeys ?? []) as string[])
    } catch {
      setError("Erro ao carregar permissões.")
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    if (open) void load()
  }, [open, load])

  const toggleGroup = (id: string, enabled: boolean) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleDirect = (key: string, enabled: boolean) => {
    setDirectKeys((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleSave = async () => {
    if (!companyId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          groupIds: [...selectedGroupIds],
          directPermissionKeys: [...directKeys],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.")
        return
      }
      onSaved?.()
      onOpenChange(false)
    } catch {
      setError("Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissões — {userName}
          </DialogTitle>
          <DialogDescription>
            Efetivo = união dos grupos selecionados + rules individuais.
            Papéis (Comprador, Admin…) continuam definindo identidade/portal.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold mb-2">Grupos de Perfis</h3>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum grupo disponível. Crie grupos na aba Grupos de Perfis.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedGroupIds.has(g.id)}
                        onCheckedChange={(v) => toggleGroup(g.id, v === true)}
                        disabled={saving}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{g.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          {g.code}
                        </span>
                        {g.is_system ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Sistema
                          </Badge>
                        ) : null}
                        <span className="block text-xs text-muted-foreground">
                          {(g.permission_keys ?? []).length} rules
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">
                Rules individuais (extras)
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                Concedidas além dos grupos — ex.: Agir como outro usuário.
              </p>
              <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
                {[...catalogByGroup.entries()].map(([category, items]) => (
                  <div key={category} className="p-3">
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      {category}
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-start gap-3 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={directKeys.has(item.key)}
                            onCheckedChange={(v) =>
                              toggleDirect(item.key, v === true)
                            }
                            disabled={saving}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-medium">{item.label}</span>
                            <span className="block text-xs text-muted-foreground font-mono">
                              {item.key}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowEffective((v) => !v)}
              >
                {showEffective
                  ? "Ocultar permissões efetivas atuais"
                  : "Ver permissões efetivas atuais"}
              </button>
              {showEffective ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {effectiveKeys.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Nenhuma (antes de salvar; lista reflete o último estado
                      salvo).
                    </span>
                  ) : (
                    effectiveKeys.map((k) => (
                      <Badge key={k} variant="secondary" className="font-mono text-[10px]">
                        {k}
                      </Badge>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
          >
            {saving ? "Salvando..." : "Salvar Permissões"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
