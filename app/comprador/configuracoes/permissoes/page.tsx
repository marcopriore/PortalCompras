"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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

import { Shield, ShieldCheck, Save, LayoutDashboard } from "lucide-react"

const PERMISSIONS = [
  { key: "nav.dashboard", label: "Dashboard", group: "Navegação" },
  { key: "nav.requisitions", label: "Requisições", group: "Navegação" },
  { key: "nav.quotations", label: "Cotações", group: "Navegação" },
  { key: "nav.orders", label: "Pedidos", group: "Navegação" },
  { key: "nav.items", label: "Itens", group: "Navegação" },
  { key: "nav.suppliers", label: "Fornecedores", group: "Navegação" },
  { key: "nav.reports", label: "Relatórios", group: "Navegação" },
  { key: "quotation.create", label: "Criar Cotação", group: "Cotações" },
  { key: "quotation.edit", label: "Editar Cotação", group: "Cotações" },
  { key: "quotation.cancel", label: "Cancelar Cotação", group: "Cotações" },
  { key: "quotation.equalize", label: "Equalizar Proposta", group: "Cotações" },
  { key: "order.create", label: "Criar Pedido", group: "Pedidos" },
  { key: "order.edit", label: "Editar Pedido", group: "Pedidos" },
  { key: "requisition.create", label: "Criar Requisição", group: "Requisições" },
  { key: "view_only", label: "Somente Visualização", group: "Geral" },
  { key: "approval.requisition", label: "Aprovar Requisições", group: "Aprovações" },
  { key: "approval.order", label: "Aprovar Pedidos de Compra", group: "Aprovações" },
] as const

type PermissionKey = (typeof PERMISSIONS)[number]["key"]

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "buyer", label: "Comprador" },
  { value: "manager", label: "Gestor de Compras" },
  { value: "approver", label: "Aprovador" },
] as const

type RoleValue = (typeof ROLES)[number]["value"]

type PermissionRowState = Record<RoleValue, Record<PermissionKey, boolean>>

const createInitialPermissionsState = (): PermissionRowState => {
  const state = {} as PermissionRowState
  ROLES.forEach((r) => {
    state[r.value] = {} as Record<PermissionKey, boolean>
    PERMISSIONS.forEach((p) => {
      state[r.value][p.key as PermissionKey] = r.value === "admin"
    })
  })
  return state
}

export default function PermissionsPage({
  params,
}: {
  params?: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { userId, companyId, isSuperAdmin, loading: userLoading } = useUser()

  const [profileRole, setProfileRole] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [permissionsState, setPermissionsState] = React.useState<PermissionRowState>(
    createInitialPermissionsState(),
  )
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true

    const run = async () => {
      if (userLoading) return
      if (!companyId || !userId) return

      if (!isSuperAdmin) {
        const supabase = createClient()
        const { data: profileRes } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle()

        if (!alive) return
        setProfileRole((profileRes as any)?.role ?? null)
      } else {
        setProfileRole("admin")
      }

      setLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [userLoading, companyId, userId, isSuperAdmin])

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

      const next = createInitialPermissionsState()
      ;((data ?? []) as any[]).forEach((row) => {
        const role = row.role as RoleValue
        const permissionKey = row.permission_key as PermissionKey
        const enabled = Boolean(row.enabled)
        if (next[role] && next[role][permissionKey] != null) {
          if (role === "admin") {
            next[role][permissionKey] = true
          } else {
            next[role][permissionKey] = enabled
          }
        }
      })

      // Regra de negócio: admin sempre possui todas as permissões
      PERMISSIONS.forEach((p) => {
        next.admin[p.key] = true
      })

      if (profileRole !== null && profileRole !== "admin" && !isSuperAdmin) {
        // manter admin fixo; demais permissões carregadas
      }

      setPermissionsState(next)
    }

    loadPermissions()
    return () => {
      alive = false
    }
  }, [companyId, userLoading, loading, profileRole, isSuperAdmin])

  const canManage = React.useMemo(() => {
    if (isSuperAdmin) return true
    return profileRole === "admin"
  }, [isSuperAdmin, profileRole])

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
    if (role === "admin") return

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

      ROLES.forEach((r) => {
        PERMISSIONS.forEach((p) => {
          payloads.push({
            company_id: companyId,
            role: r.value,
            permission_key: p.key,
            enabled: r.value === "admin" ? true : permissionsState[r.value][p.key],
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
                  {ROLES.map((r) => (
                    <TableHead key={r.value} className="text-center">
                      {r.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(([groupName, groupPermissions]) => (
                  <React.Fragment key={groupName}>
                    <TableRow>
                      <TableCell colSpan={1 + ROLES.length}>
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
                        {ROLES.map((role) => {
                          if (role.value === "admin") {
                            return (
                              <TableCell key={role.value} className="text-center">
                                <Shield className="mx-auto h-4 w-4 text-primary" />
                              </TableCell>
                            )
                          }

                          const checked = permissionsState[role.value][perm.key]
                          return (
                            <TableCell key={role.value} className="text-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(val) =>
                                  handleToggle(
                                    role.value,
                                    perm.key,
                                    val === true ? true : false,
                                  )
                                }
                                disabled={saving}
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

