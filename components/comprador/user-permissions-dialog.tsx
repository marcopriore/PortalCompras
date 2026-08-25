"use client"

import * as React from "react"
import {
  PERMISSION_CATALOG,
  groupPermissionsByCategory,
} from "@/lib/permissions/catalog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Lock, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const catalogByGroup = React.useMemo(
    () => groupPermissionsByCategory(PERMISSION_CATALOG),
    [],
  )

  const keysFromGroups = React.useMemo(() => {
    const keys = new Set<string>()
    for (const group of groups) {
      if (!selectedGroupIds.has(group.id)) continue
      for (const key of group.permission_keys ?? []) {
        keys.add(key)
      }
    }
    return keys
  }, [groups, selectedGroupIds])

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
    if (keysFromGroups.has(key)) return
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
      // Não persiste extras que já vêm dos grupos selecionados
      const extrasOnly = [...directKeys].filter((key) => !keysFromGroups.has(key))

      const res = await fetch("/api/admin/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          groupIds: [...selectedGroupIds],
          directPermissionKeys: extrasOnly,
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
            Rules dos grupos aparecem marcadas e travadas. Rules individuais são
            extras além dos grupos.
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
              <h3 className="text-sm font-semibold mb-2">Rules</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Marcadas e travadas = vindas do(s) grupo(s). As demais podem ser
                concedidas individualmente (ex.: Agir como outro usuário).
              </p>
              <div className="rounded-lg border border-border divide-y divide-border max-h-80 overflow-y-auto">
                {[...catalogByGroup.entries()].map(([category, items]) => (
                  <div key={category} className="p-3">
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      {category}
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => {
                        const fromGroup = keysFromGroups.has(item.key)
                        const checked =
                          fromGroup || directKeys.has(item.key)
                        const locked = fromGroup

                        return (
                          <label
                            key={item.key}
                            className={cn(
                              "flex items-start gap-3 text-sm",
                              locked
                                ? "cursor-default opacity-80"
                                : "cursor-pointer",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                toggleDirect(item.key, v === true)
                              }
                              disabled={saving || locked}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{item.label}</span>
                                {locked ? (
                                  <Badge
                                    variant="secondary"
                                    className="font-normal text-[10px]"
                                  >
                                    <Lock className="mr-1 h-3 w-3" />
                                    Via grupo
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="block text-xs text-muted-foreground font-mono">
                                {item.key}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
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
