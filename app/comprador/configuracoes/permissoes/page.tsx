"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { ShieldCheck, Save, LayoutDashboard } from "lucide-react"

const PERMISSIONS = [
  { key: "nav.dashboard", label: "Dashboard", group: "Navegação" },
  { key: "nav.requisitions", label: "Requisições", group: "Navegação" },
  { key: "nav.quotations", label: "Cotações", group: "Navegação" },
  { key: "nav.orders", label: "Pedidos", group: "Navegação" },
  { key: "nav.items", label: "Itens", group: "Navegação" },
  { key: "nav.suppliers", label: "Fornecedores", group: "Navegação" },
  { key: "nav.reports", label: "Relatórios", group: "Navegação" },
  { key: "quotation.create", label: "Criar / Clonar Cotação", group: "Cotações" },
  { key: "quotation.edit", label: "Editar Cotação", group: "Cotações" },
  { key: "quotation.cancel", label: "Cancelar Cotação", group: "Cotações" },
  { key: "quotation.equalize.view", label: "Visualizar Equalização", group: "Cotações" },
  { key: "quotation.equalize.select", label: "Ações na Equalização", group: "Cotações" },
  { key: "quotation.view_all", label: "Ver Cotações de Todos", group: "Cotações" },
  { key: "order.create", label: "Criar Pedido", group: "Pedidos" },
  { key: "order.edit", label: "Editar Qualquer Pedido", group: "Pedidos" },
  { key: "order.edit_own", label: "Editar Próprios Pedidos", group: "Pedidos" },
  { key: "order.view_all", label: "Ver Pedidos de Todos", group: "Pedidos" },
  { key: "requisition.create.buyer", label: "Criar Requisição (Comprador)", group: "Requisições" },
  { key: "requisition.create.requester", label: "Criar Requisição (Solicitante)", group: "Requisições" },
  { key: "requisition.approve", label: "Aprovar Requisições", group: "Requisições" },
  { key: "approval.requisition", label: "Fluxo Aprovação Requisição", group: "Aprovações" },
  { key: "approval.order", label: "Fluxo Aprovação Pedido", group: "Aprovações" },
  { key: "export.excel", label: "Exportar Excel", group: "Dados" },
  { key: "import.excel", label: "Importar Excel", group: "Dados" },
  { key: "supplier.create", label: "Cadastrar Fornecedor", group: "Cadastros" },
  { key: "supplier.edit", label: "Editar Fornecedor", group: "Cadastros" },
  { key: "item.create", label: "Cadastrar Item", group: "Cadastros" },
  { key: "item.edit", label: "Editar Item", group: "Cadastros" },
  { key: "user.manage", label: "Gerenciar Usuários", group: "Administração" },
  { key: "settings.manage", label: "Acessar Configurações", group: "Administração" },
  { key: "portal.solicitante", label: "Acessar Portal Solicitante", group: "Administração" },
  { key: "view_only", label: "Somente Visualização", group: "Geral" },
] as const

type PermissionKey = (typeof PERMISSIONS)[number]["key"]

// Admin é exibido separadamente com comportamento especial
const ADMIN_ROLE = { value: "admin", label: "Administrador" } as const

const ROLES = [
  { value: "buyer", label: "Comprador" },
  { value: "manager", label: "Gestor de Compras" },
  { value: "approver_requisition", label: "Aprov. Requisição" },
  { value: "approver_order", label: "Aprov. Pedido" },
  { value: "requester", label: "Requisitante" },
] as const

const ALL_ROLES = [ADMIN_ROLE, ...ROLES] as const
type RoleValue = (typeof ALL_ROLES)[number]["value"]

type PermissionRowState = Record<RoleValue, Record<PermissionKey, boolean>>

const createInitialPermissionsState = (): PermissionRowState => {
  const state = {} as PermissionRowState
  ALL_ROLES.forEach((r) => {
    state[r.value] = {} as Record<PermissionKey, boolean>
    PERMISSIONS.forEach((p) => {
      state[r.value][p.key as PermissionKey] = false
    })
  })
  return state
}

export default function PermissionsPage() {
  const { userId, companyId, isSuperAdmin, hasRole, loading: userLoading } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [permissionsState, setPermissionsState] = React.useState<PermissionRowState>(
    createInitialPermissionsState(),
  )
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!userLoading) setLoading(false)
  }, [userLoading])

  React.useEffect(() => {
    let alive = true

    const loadPermissions = async () => {
      if (userLoading || loading) return
      if (!companyId) return

      const supabase = createClient()
      const { data } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("company_id", companyId)

      if (!alive) return

      const rows = (data ?? []) as { role: string; permission_key: string; enabled: boolean }[]
      const rolesWithData = new Set(rows.map((r) => r.role))
      const newRoles = ["approver_requisition", "approver_order", "requester"] as const

      for (const role of newRoles) {
        if (!rolesWithData.has(role)) {
          for (const p of PERMISSIONS) {
            await supabase
              .from("role_permissions")
              .upsert(
                {
                  company_id: companyId,
                  role,
                  permission_key: p.key,
                  enabled: false,
                },
                { onConflict: "company_id,role,permission_key" },
              )
          }
          if (!alive) return
        }
      }

      const { data: dataAfter } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("company_id", companyId)

      if (!alive) return

      const next = createInitialPermissionsState()
      ;((dataAfter ?? []) as any[]).forEach((row) => {
        const role = row.role as RoleValue
        const permissionKey = row.permission_key as PermissionKey
        const enabled = Boolean(row.enabled)
        if (next[role] && next[role][permissionKey] != null) {
          next[role][permissionKey] = enabled
        }
      })

      setPermissionsState(next)
    }

    loadPermissions()
    return () => {
      alive = false
    }
  }, [companyId, userLoading, loading, isSuperAdmin])

  const canManage = React.useMemo(() => {
    if (isSuperAdmin) return true
    return hasRole("admin")
  }, [isSuperAdmin, hasRole])

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof PERMISSIONS>()
    PERMISSIONS.forEach((p) => {
      const key = p.group
      if (!map.has(key)) map.set(key, [] as any)
      ;(map.get(key) as any).push(p)
    })
    return Array.from(map.entries())
  }, [])

  const handleToggle = (role: RoleValue, key: PermissionKey, enabled: boolean) => {
    setPermissionsState((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: enabled,
      },
    }))
  }

  const handleSave = async () => {
    if (!companyId) return
    setSaving(true)
    setSuccessMessage(null)

    try {
      const supabase = createClient()
      const payloads: Array<{
        company_id: string
        role: RoleValue
        permission_key: PermissionKey
        enabled: boolean
      }> = []

      ALL_ROLES.forEach((r) => {
        PERMISSIONS.forEach((p) => {
          payloads.push({
            company_id: companyId,
            role: r.value,
            permission_key: p.key,
            enabled: permissionsState[r.value][p.key],
          })
        })
      })

      await Promise.all(
        payloads.map((pl) =>
          supabase
            .from("role_permissions")
            .upsert(
              {
                company_id: pl.company_id,
                role: pl.role,
                permission_key: pl.permission_key,
                enabled: pl.enabled,
              },
              { onConflict: "company_id,role,permission_key" },
            ),
        ),
      )

      await logAudit({
        eventType: "tenant.updated",
        description: "Permissões de perfis de acesso atualizadas",
        companyId,
        userId,
        entity: "role_permissions",
        entityId: companyId,
      })

      setSuccessMessage("Permissões atualizadas com sucesso.")
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-2xl font-bold text-foreground">Perfis de Acesso</h1>
          <p className="text-muted-foreground">
            Configure as permissões de cada perfil de usuário
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Apenas administradores podem gerenciar permissões de acesso.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfis de Acesso</h1>
        <p className="text-muted-foreground">
          Configure as permissões de cada perfil de usuário
        </p>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          {successMessage}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <Badge variant="outline">Matriz de Permissões</Badge>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead> </TableHead>
                  {ALL_ROLES.map((r) => (
                    <TableHead key={r.value} className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{r.label}</span>
                        {r.value === "admin" && (
                          <span className="text-[10px] text-primary font-normal">
                            (editável pelo Master)
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(([groupName, groupPermissions]) => (
                  <React.Fragment key={groupName}>
                    <TableRow>
                      <TableCell colSpan={1 + ALL_ROLES.length}>
                        <div className="bg-muted/50 font-semibold text-xs uppercase text-muted-foreground rounded-md px-2 py-1 flex items-center gap-1.5">
                          {groupName === "Navegação" && <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />}
                          {groupName === "Aprovações" && <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
                          {groupName}
                        </div>
                      </TableCell>
                    </TableRow>

                    {(groupPermissions as typeof PERMISSIONS).map((perm) => (
                      <TableRow key={perm.key}>
                        <TableCell className="font-medium">{perm.label}</TableCell>
                        {ALL_ROLES.map((role) => {
                          const checked = permissionsState[role.value][perm.key]
                          const isAdmin = role.value === "admin"
                          // Admin só pode ser editado pelo SuperAdmin/Master
                          const isDisabled = saving || (isAdmin && !isSuperAdmin)
                          return (
                            <TableCell key={role.value} className="text-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(val) =>
                                  handleToggle(role.value, perm.key, val === true)
                                }
                                disabled={isDisabled}
                                className={isAdmin ? "border-primary" : ""}
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

