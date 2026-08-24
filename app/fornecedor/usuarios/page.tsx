"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import {
  Ban,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"
import { useUser } from "@/lib/hooks/useUser"
import { formatCnpj } from "@/lib/utils/cnpj"
import { generatePasswordForPolicy } from "@/lib/auth/generate-password"
import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TableRowActions } from "@/components/ui/table-row-actions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type PortalUser = {
  id: string
  full_name: string | null
  email: string | null
  status: string
  is_supplier_admin: boolean
  login_cnpj: string | null
  created_at: string
}

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  expiryDays: 0,
  historyCount: 0,
}

export default function FornecedorUsuariosPage() {
  const { userId, loading: userLoading } = useUser()

  const [users, setUsers] = React.useState<PortalUser[]>([])
  const [limit, setLimit] = React.useState(5)
  const [canAdd, setCanAdd] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editUser, setEditUser] = React.useState<PortalUser | null>(null)
  const [confirmCancel, setConfirmCancel] = React.useState<PortalUser | null>(null)

  const [form, setForm] = React.useState({
    fullName: "",
    email: "",
    password: "",
    newPassword: "",
  })
  const [saving, setSaving] = React.useState(false)

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/supplier-portal/users")
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao carregar usuários.")
        return
      }
      setUsers(data.users ?? [])
      setLimit(data.limit ?? 5)
      setCanAdd(Boolean(data.canAdd))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!userLoading) void loadUsers()
  }, [userLoading, loadUsers])

  function suggestPassword() {
    setForm((f) => ({ ...f, password: generatePasswordForPolicy(DEFAULT_POLICY) }))
  }

  function suggestNewPassword() {
    setForm((f) => ({ ...f, newPassword: generatePasswordForPolicy(DEFAULT_POLICY) }))
  }

  function openEdit(user: PortalUser) {
    setEditUser(user)
    setForm({
      fullName: user.full_name ?? "",
      email: user.email ?? "",
      password: "",
      newPassword: "",
    })
    setEditOpen(true)
  }

  async function handleAdd() {
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      toast.error("Preencha todos os campos.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/supplier-portal/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao criar usuário.")
        return
      }
      toast.success("Usuário adicionado.")
      setAddOpen(false)
      setForm({ fullName: "", email: "", password: "", newPassword: "" })
      await loadUsers()
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!editUser) return
    setSaving(true)
    try {
      const payload: Record<string, string> = { action: "update" }
      if (editUser.is_supplier_admin) {
        if (!form.email.trim() && !form.newPassword) {
          toast.error("Informe o e-mail e/ou a nova senha.")
          return
        }
        if (form.email.trim()) payload.email = form.email.trim()
        if (form.fullName.trim()) payload.fullName = form.fullName.trim()
        if (form.newPassword) payload.newPassword = form.newPassword
      } else {
        if (form.fullName.trim()) payload.fullName = form.fullName.trim()
        if (form.email.trim()) payload.email = form.email.trim()
        if (form.newPassword) payload.newPassword = form.newPassword
      }

      const res = await fetch(`/api/supplier-portal/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao atualizar.")
        return
      }
      toast.success("Usuário atualizado.")
      setEditOpen(false)
      setEditUser(null)
      await loadUsers()
    } finally {
      setSaving(false)
    }
  }

  async function runAction(user: PortalUser, action: "block" | "unblock" | "cancel") {
    const res = await fetch(`/api/supplier-portal/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Erro na operação.")
      return
    }
    const labels = {
      block: "Usuário bloqueado.",
      unblock: "Usuário reativado.",
      cancel: "Usuário cancelado e removido.",
    }
    toast.success(labels[action])
    setConfirmCancel(null)
    await loadUsers()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os acessos ao portal da sua empresa (máximo {limit} usuários).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {canAdd ? (
            <Button
              size="sm"
              onClick={() => {
                setForm({ fullName: "", email: "", password: "", newPassword: "" })
                setAddOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar usuário
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Usuários cadastrados</span>
        <span className="text-lg font-semibold">
          {users.length} / {limit}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {user.is_supplier_admin && user.login_cnpj
                        ? formatCnpj(user.login_cnpj)
                        : (user.email ?? "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      {user.is_supplier_admin ? (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Administrador
                        </Badge>
                      ) : (
                        <Badge variant="outline">Usuário</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "default" : "outline"}>
                        {user.status === "active" ? "Ativo" : "Bloqueado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <TableRowActions
                        actions={[
                          {
                            label: user.is_supplier_admin
                              ? "Alterar e-mail"
                              : "Atualizar",
                            icon: Pencil,
                            onClick: () => openEdit(user),
                          },
                          {
                            label: "Bloquear",
                            icon: Ban,
                            onClick: () => void runAction(user, "block"),
                            disabled: user.id === userId,
                            hidden:
                              user.is_supplier_admin || user.status !== "active",
                            separatorBefore: true,
                          },
                          {
                            label: "Reativar",
                            icon: UserCheck,
                            onClick: () => void runAction(user, "unblock"),
                            hidden:
                              user.is_supplier_admin || user.status === "active",
                            separatorBefore: true,
                          },
                          {
                            label: "Cancelar acesso",
                            icon: Trash2,
                            onClick: () => setConfirmCancel(user),
                            disabled: user.id === userId,
                            hidden: user.is_supplier_admin,
                            destructive: true,
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O novo usuário entrará com <strong>e-mail e senha</strong>.
            </p>
            <div className="grid gap-2">
              <Label>Nome completo</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>E-mail (login)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Senha inicial</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <Button type="button" variant="outline" size="icon" onClick={suggestPassword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving} onClick={() => void handleAdd()}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editUser?.is_supplier_admin ? "Alterar e-mail do administrador" : "Atualizar usuário"}
            </DialogTitle>
          </DialogHeader>
          {editUser?.is_supplier_admin ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O login do administrador é pelo CNPJ. Você pode atualizar o e-mail
                vinculado e redefinir a senha.
              </p>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nova senha (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={form.newPassword}
                    onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Deixe vazio para manter"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={suggestNewPassword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Nome completo</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nova senha (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={form.newPassword}
                    onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="Deixe vazio para manter"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={suggestNewPassword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Fechar
            </Button>
            <Button disabled={saving} onClick={() => void handleUpdate()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmCancel} onOpenChange={() => setConfirmCancel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar acesso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O usuário <strong>{confirmCancel?.full_name}</strong> será removido permanentemente e
            não poderá mais acessar o portal. Deseja continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmCancel && void runAction(confirmCancel, "cancel")}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
