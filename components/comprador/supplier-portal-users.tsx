"use client"

import * as React from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Mail, Plus, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
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
import { formatCnpj, isValidCnpjLength } from "@/lib/utils/cnpj"
import { normalizeImportedEmail } from "@/lib/utils/excel-cell"
import { generatePasswordForPolicy } from "@/lib/auth/generate-password"
import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"

type SupplierPortalUser = {
  id: string
  full_name: string | null
  email: string | null
  status: string
  is_supplier_admin: boolean
  login_cnpj: string | null
  created_at: string
}

type SupplierInvite = {
  id: string
  email: string
  status: string
  expires_at: string
  created_at: string
  accepted_at: string | null
}

type Props = {
  supplierId: string
  supplierName: string
  supplierEmail: string | null
  supplierCnpj: string | null
  canManage: boolean
}

export function SupplierPortalUsers({
  supplierId,
  supplierName,
  supplierEmail,
  supplierCnpj,
  canManage,
}: Props) {
  const [users, setUsers] = React.useState<SupplierPortalUser[]>([])
  const [invites, setInvites] = React.useState<SupplierInvite[]>([])
  const [userLimit, setUserLimit] = React.useState(5)
  const [canAddUser, setCanAddUser] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [addUserOpen, setAddUserOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [sendingInvite, setSendingInvite] = React.useState(false)
  const [newUserForm, setNewUserForm] = React.useState({
    fullName: "",
    email: "",
    password: "",
  })
  const [creatingUser, setCreatingUser] = React.useState(false)

  const hasAdmin = users.some((u) => u.is_supplier_admin && u.status === "active")
  const pendingInvite = invites.find((i) => i.status === "pending")

  const loadPortalData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier-invites?supplierId=${supplierId}`)
      const data = await res.json()
      if (res.ok) {
        setInvites(data.invites ?? [])
      }

      const usersRes = await fetch(`/api/supplier-users?supplierId=${supplierId}`)
      const usersData = await usersRes.json()
      if (usersRes.ok) {
        setUsers(usersData.users ?? [])
        setUserLimit(usersData.limit ?? 5)
        setCanAddUser(Boolean(usersData.canAdd))
      }
    } catch {
      /* portal do fornecedor opcional — não bloquear detalhe */
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  React.useEffect(() => {
    void loadPortalData()
  }, [loadPortalData])

  React.useEffect(() => {
    setInviteEmail(normalizeImportedEmail(supplierEmail) ?? "")
  }, [supplierEmail, supplierId])

  async function handleSendInvite() {
    const email = normalizeImportedEmail(inviteEmail)
    if (!email) {
      toast.error("Informe um e-mail válido para o convite.")
      return
    }
    if (!isValidCnpjLength(supplierCnpj)) {
      toast.error("Cadastre um CNPJ válido no fornecedor antes de convidar.")
      return
    }

    setSendingInvite(true)
    try {
      const res = await fetch("/api/supplier-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao enviar convite.")
        return
      }
      toast.success(
        data.emailSent
          ? "Convite enviado por e-mail."
          : "Convite criado (falha no envio de e-mail — verifique RESEND).",
      )
      if (data.inviteUrl) {
        toast.message("Link de convite (dev)", { description: data.inviteUrl })
      }
      setInviteOpen(false)
      await loadPortalData()
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleCreateUser() {
    if (!newUserForm.fullName.trim() || !newUserForm.email.trim() || !newUserForm.password) {
      toast.error("Preencha todos os campos.")
      return
    }

    setCreatingUser(true)
    try {
      const res = await fetch("/api/supplier-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          fullName: newUserForm.fullName.trim(),
          email: newUserForm.email.trim(),
          password: newUserForm.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao criar usuário.")
        return
      }
      toast.success("Usuário criado com sucesso.")
      setAddUserOpen(false)
      setNewUserForm({ fullName: "", email: "", password: "" })
      await loadPortalData()
    } finally {
      setCreatingUser(false)
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: string) {
    const next = currentStatus === "active" ? "inactive" : "active"
    const res = await fetch(`/api/supplier-users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, supplierId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao atualizar usuário.")
      return
    }
    toast.success(next === "active" ? "Usuário reativado." : "Usuário desativado.")
    await loadPortalData()
  }

  function suggestPassword() {
    const policy: PasswordPolicy = {
      minLength: 10,
      requireUppercase: true,
      requireLowercase: true,
      requireDigit: true,
      requireSpecial: true,
      expiryDays: 0,
      historyCount: 0,
    }
    setNewUserForm((f) => ({ ...f, password: generatePasswordForPolicy(policy) }))
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Portal do Fornecedor
        </p>
        {canManage && !hasAdmin && !pendingInvite ? (
          <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Convidar administrador
          </Button>
        ) : null}
        {canManage && hasAdmin && canAddUser ? (
          <Button size="sm" variant="outline" onClick={() => setAddUserOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Adicionar usuário
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando usuários...</p>
      ) : (
        <>
          {pendingInvite ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">Convite pendente</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {pendingInvite.email} — expira{" "}
                {format(new Date(pendingInvite.expires_at), "dd/MM/yyyy HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
          ) : null}

          {!hasAdmin && !pendingInvite ? (
            <p className="text-sm text-muted-foreground">
              Nenhum acesso ao portal. Envie um convite para o administrador de{" "}
              <strong>{supplierName}</strong> concluir o cadastro (login por CNPJ).
            </p>
          ) : null}

          {users.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                {users.length} / {userLimit} usuários
              </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="w-24" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm">{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {u.is_supplier_admin && u.login_cnpj
                        ? formatCnpj(u.login_cnpj)
                        : (u.email ?? "—")}
                      {u.is_supplier_admin ? (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Admin
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "default" : "outline"}>
                        {u.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        {!u.is_supplier_admin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => void toggleUserStatus(u.id, u.status)}
                          >
                            {u.status === "active" ? "Desativar" : "Reativar"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          ) : null}
        </>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar administrador do fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O convidado concluirá o cadastro confirmando o CNPJ{" "}
              {supplierCnpj ? formatCnpj(supplierCnpj) : "do fornecedor"} e definirá a
              senha. O login principal será pelo CNPJ. Confirme o e-mail abaixo.
            </p>
            {!normalizeImportedEmail(supplierEmail) ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                E-mail não encontrado no cadastro do fornecedor. Informe o endereço ou
                reimporte a planilha com a coluna de e-mail preenchida.
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="invite-email">E-mail do convite</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="contato@fornecedor.com.br"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={sendingInvite} onClick={() => void handleSendInvite()}>
              {sendingInvite ? "Enviando..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário do fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Usuários adicionais entram com <strong>e-mail e senha</strong>.
            </p>
            <div className="grid gap-2">
              <Label>Nome completo</Label>
              <Input
                value={newUserForm.fullName}
                onChange={(e) =>
                  setNewUserForm((f) => ({ ...f, fullName: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>E-mail (login)</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Senha inicial</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newUserForm.password}
                  onChange={(e) =>
                    setNewUserForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
                <Button type="button" variant="outline" onClick={suggestPassword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={creatingUser} onClick={() => void handleCreateUser()}>
              {creatingUser ? "Criando..." : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
