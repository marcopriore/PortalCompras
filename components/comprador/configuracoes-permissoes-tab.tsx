"use client"

import * as React from "react"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"
import {
  PERMISSION_CATALOG,
  groupPermissionsByCategory,
} from "@/lib/permissions/catalog"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableRowActions } from "@/components/ui/table-row-actions"
import {
  ShieldCheck,
  Save,
  Plus,
  Pencil,
  Trash2,
  LayoutDashboard,
} from "lucide-react"

type PermissionGroup = {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  source_role: string | null
  permission_keys?: string[]
}

export function ConfiguracoesPermissoesTab() {
  const { userId, companyId, isSuperAdmin, hasRole, loading: userLoading } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [groups, setGroups] = React.useState<PermissionGroup[]>([])
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PermissionGroup | null>(null)
  const [formName, setFormName] = React.useState("")
  const [formDescription, setFormDescription] = React.useState("")
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())

  const canManage = React.useMemo(() => {
    if (isSuperAdmin) return true
    return hasRole("admin")
  }, [isSuperAdmin, hasRole])

  const catalogByGroup = React.useMemo(
    () => groupPermissionsByCategory(PERMISSION_CATALOG),
    [],
  )

  const loadGroups = React.useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch("/api/admin/permission-groups?withRules=1", {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error ?? "Não foi possível carregar os grupos.")
        return
      }
      setGroups((data.groups ?? []) as PermissionGroup[])
    } catch {
      setErrorMessage("Não foi possível carregar os grupos.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (userLoading || !canManage) return
    void loadGroups()
  }, [userLoading, canManage, loadGroups])

  const openCreate = () => {
    setEditing(null)
    setFormName("")
    setFormDescription("")
    setSelectedKeys(new Set())
    setEditorOpen(true)
  }

  const openEdit = async (group: PermissionGroup) => {
    setEditing(group)
    setFormName(group.name)
    setFormDescription(group.description ?? "")
    setSelectedKeys(new Set(group.permission_keys ?? []))
    setEditorOpen(true)

    // Garante rules atualizadas do servidor
    try {
      const res = await fetch(`/api/admin/permission-groups?id=${group.id}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (res.ok && data.permissions) {
        setSelectedKeys(
          new Set(
            Object.entries(data.permissions as Record<string, boolean>)
              .filter(([, enabled]) => enabled)
              .map(([key]) => key),
          ),
        )
      }
    } catch {
      /* mantém keys da listagem */
    }
  }

  const toggleKey = (key: string, enabled: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleSaveGroup = async () => {
    if (!companyId || !formName.trim()) return
    setSaving(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const permissionKeys = [...selectedKeys]
      if (editing) {
        const res = await fetch("/api/admin/permission-groups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            name: formName.trim(),
            description: formDescription.trim() || null,
            permissionKeys,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setErrorMessage(data.error ?? "Erro ao salvar grupo.")
          return
        }
        await logAudit({
          eventType: "tenant.updated",
          description: `Grupo de permissões "${formName.trim()}" atualizado`,
          companyId,
          userId,
          entity: "permission_groups",
          entityId: editing.id,
        })
        setSuccessMessage("Grupo atualizado com sucesso.")
      } else {
        const res = await fetch("/api/admin/permission-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            permissionKeys,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setErrorMessage(data.error ?? "Erro ao criar grupo.")
          return
        }
        await logAudit({
          eventType: "tenant.updated",
          description: `Grupo de permissões "${formName.trim()}" criado`,
          companyId,
          userId,
          entity: "permission_groups",
          entityId: data.group?.id,
        })
        setSuccessMessage("Grupo criado com sucesso.")
      }

      setEditorOpen(false)
      await loadGroups()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: PermissionGroup) => {
    if (group.is_system) return
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Excluir o grupo "${group.name}"?`)) return

    setErrorMessage(null)
    const res = await fetch(`/api/admin/permission-groups?id=${group.id}`, {
      method: "DELETE",
    })
    const data = await res.json()
    if (!res.ok) {
      setErrorMessage(data.error ?? "Erro ao excluir grupo.")
      return
    }
    if (companyId) {
      await logAudit({
        eventType: "tenant.updated",
        description: `Grupo de permissões "${group.name}" excluído`,
        companyId,
        userId,
        entity: "permission_groups",
        entityId: group.id,
      })
    }
    setSuccessMessage("Grupo excluído.")
    await loadGroups()
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Carregando...
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grupos de Perfis</h1>
          <p className="text-muted-foreground">
            Pacotes de regras (rules) atribuíveis aos usuários
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Apenas administradores podem gerenciar grupos de permissões.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grupos de Perfis</h1>
          <p className="text-muted-foreground">
            Pacotes de regras reutilizáveis. Atribua grupos e/ou rules individuais
            em Usuários → Permissões.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Grupo
        </Button>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum grupo cadastrado. Crie um grupo ou execute a migration 050
              para migrar os perfis legados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <div className="font-medium">{group.name}</div>
                        {group.description ? (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {group.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {group.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {(group.permission_keys ?? []).length} rules
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {group.is_system ? (
                          <Badge variant="outline">Sistema</Badge>
                        ) : (
                          <Badge variant="secondary">Customizado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <TableRowActions
                          actions={[
                            {
                              label: "Editar Rules",
                              icon: Pencil,
                              onClick: () => void openEdit(group),
                            },
                            {
                              label: "Excluir",
                              icon: Trash2,
                              destructive: true,
                              hidden: group.is_system,
                              onClick: () => void handleDelete(group),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar: ${editing.name}` : "Novo Grupo de Perfis"}
            </DialogTitle>
            <DialogDescription>
              Selecione as rules (permissões atômicas) deste pacote.
              {editing?.is_system
                ? " Grupos de sistema podem ter as rules ajustadas."
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Comprador avançado"
                disabled={Boolean(editing?.is_system)}
              />
              {editing?.is_system ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Nome de grupos de sistema é fixo (código: {editing.code}).
                </p>
              ) : null}
            </div>
            {!editing?.is_system ? (
              <div>
                <Label>Descrição</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            ) : null}

            <div className="rounded-lg border border-border divide-y divide-border">
              {[...catalogByGroup.entries()].map(([category, items]) => (
                <div key={category} className="p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    {category === "Navegação" ? (
                      <LayoutDashboard className="h-3.5 w-3.5" />
                    ) : null}
                    {category === "Administração" ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : null}
                    {category}
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start gap-3 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedKeys.has(item.key)}
                          onCheckedChange={(v) =>
                            toggleKey(item.key, v === true)
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

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditorOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveGroup()}
              disabled={saving || !formName.trim()}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
