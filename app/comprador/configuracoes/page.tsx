"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  Bell,
  Building2,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  User,
  Workflow,
} from "lucide-react"

type CompanyForm = {
  name: string
  trade_name: string
  cnpj: string
  state_reg: string
  address: string
  city: string
  state: string
  zip_code: string
}

type ProfileForm = {
  full_name: string
  job_title: string
  department: string
  phone: string
}

type NotificationForm = {
  new_requisition: boolean
  quotation_received: boolean
  order_approved: boolean
  delivery_done: boolean
  daily_summary: boolean
}

type SecurityPasswordForm = {
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

type ApprovalLevel = {
  id: string
  level_order: number
  min_value: number
  max_value: number | null
  approver_role: string
}

type NewLevelForm = {
  minValue: string
  maxValue: string
  approverRole: string
}

type ActiveTab = "empresa" | "perfil" | "notificacoes" | "aprovacoes" | "seguranca"

function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}

function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length < 3) return digits
  const dd = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (rest.length <= 8) {
    // Fixo: XXXX-XXXX
    const first = rest.slice(0, 4)
    const second = rest.slice(4, 8)
    return `(${dd}) ${first}${second ? `-${second}` : ""}`
  }

  // Celular: 9XXXX-XXXX
  const first = rest.slice(0, 5)
  const second = rest.slice(5, 9)
  return `(${dd}) ${first}${second ? `-${second}` : ""}`
}

const AVATAR_COLORS = [
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0284c7",
] as const

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { companyId, userId, isSuperAdmin } = useUser()
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("empresa")

  const [companyRole, setCompanyRole] = React.useState<string | null>(null)
  const canManageCompany = Boolean(isSuperAdmin || companyRole === "admin")
  const canManageApprovals = canManageCompany

  const [authEmail, setAuthEmail] = React.useState<string | null>(null)

  const [companyForm, setCompanyForm] = React.useState<CompanyForm>({
    name: "",
    trade_name: "",
    cnpj: "",
    state_reg: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  })
  const [profileForm, setProfileForm] = React.useState<ProfileForm>({
    full_name: "",
    job_title: "",
    department: "",
    phone: "",
  })
  const [notifForm, setNotifForm] = React.useState<NotificationForm>({
    new_requisition: true,
    quotation_received: true,
    order_approved: true,
    delivery_done: true,
    daily_summary: false,
  })
  const [notifExists, setNotifExists] = React.useState(false)

  const [securityForm, setSecurityForm] = React.useState<SecurityPasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [securitySaving, setSecuritySaving] = React.useState(false)
  const [securitySuccess, setSecuritySuccess] = React.useState<string | null>(null)
  const [securityError, setSecurityError] = React.useState<string | null>(null)

  const [approvalLevels, setApprovalLevels] = React.useState<ApprovalLevel[]>([])
  const [addLevelOpen, setAddLevelOpen] = React.useState(false)
  const [newLevel, setNewLevel] = React.useState<NewLevelForm>({
    minValue: "",
    maxValue: "",
    approverRole: "",
  })
  const [approvalsSaving, setApprovalsSaving] = React.useState(false)

  const [saving, setSaving] = React.useState({
    company: false,
    profile: false,
    notifications: false,
    approvals: false,
  })
  const [messages, setMessages] = React.useState<{
    company: { success: string | null; error: string | null }
    profile: { success: string | null; error: string | null }
    notifications: { success: string | null; error: string | null }
    approvals: { success: string | null; error: string | null }
  }>({
    company: { success: null, error: null },
    profile: { success: null, error: null },
    notifications: { success: null, error: null },
    approvals: { success: null, error: null },
  })

  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const run = async () => {
      if (!companyId || !userId) return
      setLoading(true)
      try {
        const supabase = createClient()

        const { data: authUser } = await supabase.auth.getUser()
        if (authUser?.user?.email) setAuthEmail(authUser.user.email)

        const [profileRes, companyRes, notifRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase.from("companies").select("*").eq("id", companyId).single(),
          supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", userId)
            .eq("company_id", companyId)
            .maybeSingle(),
        ])

        if (profileRes.data) {
          const p = profileRes.data as any
          setCompanyRole((p as any).role ?? null)
          setProfileForm({
            full_name: p.full_name ?? "",
            job_title: p.job_title ?? "",
            department: p.department ?? "",
            phone: p.phone ?? "",
          })
        }

        if (companyRes.data) {
          const c = companyRes.data as any
          setCompanyForm({
            name: c.name ?? "",
            trade_name: c.trade_name ?? "",
            cnpj: c.cnpj ? String(c.cnpj) : "",
            state_reg: c.state_reg ?? "",
            address: c.address ?? "",
            city: c.city ?? "",
            state: c.state ?? "",
            zip_code: c.zip_code ?? "",
          })
        }

        if (notifRes.data) {
          const n = notifRes.data as any
          setNotifForm({
            new_requisition: Boolean(n.new_requisition),
            quotation_received: Boolean(n.quotation_received),
            order_approved: Boolean(n.order_approved),
            delivery_done: Boolean(n.delivery_done),
            daily_summary: Boolean(n.daily_summary),
          })
          setNotifExists(true)
        } else {
          setNotifForm({
            new_requisition: true,
            quotation_received: true,
            order_approved: true,
            delivery_done: true,
            daily_summary: false,
          })
          setNotifExists(false)
        }
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [companyId, userId])

  React.useEffect(() => {
    const loadApprovals = async () => {
      if (!companyId || !canManageApprovals) return
      const supabase = createClient()
      const { data } = await supabase
        .from("approval_levels")
        .select("*")
        .eq("company_id", companyId)
        .order("level_order")
      setApprovalLevels(((data as unknown) as ApprovalLevel[]) ?? [])
    }
    if (activeTab === "aprovacoes") {
      loadApprovals()
    }
  }, [activeTab, companyId, canManageApprovals])

  const handleSaveCompany = async () => {
    if (!companyId) return
    if (!canManageCompany) return
    setSaving((s) => ({ ...s, company: true }))
    setMessages((m) => ({ ...m, company: { success: null, error: null } }))

    const supabase = createClient()
    try {
      await supabase
        .from("companies")
        .update({
          name: companyForm.name.trim(),
          trade_name: companyForm.trade_name.trim(),
          cnpj: companyForm.cnpj ? companyForm.cnpj : null,
          state_reg: companyForm.state_reg.trim() || null,
          address: companyForm.address.trim(),
          city: companyForm.city.trim(),
          state: companyForm.state.trim(),
          zip_code: companyForm.zip_code.trim(),
        })
        .eq("id", companyId)

      await logAudit({
        eventType: "tenant.updated",
        description: `Tenant "${companyForm.name}" atualizado`,
        companyId,
        entity: "companies",
        entityId: companyId,
        metadata: {
          name: companyForm.name,
          state: companyForm.state,
        },
      })

      setMessages((m) => ({ ...m, company: { success: "Alterações salvas com sucesso.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({ ...m, company: { success: null, error: e?.message ?? "Falha ao salvar." } }))
    } finally {
      setSaving((s) => ({ ...s, company: false }))
    }
  }

  const handleSaveProfile = async () => {
    if (!userId) return
    setSaving((s) => ({ ...s, profile: true }))
    setMessages((m) => ({ ...m, profile: { success: null, error: null } }))

    const supabase = createClient()
    try {
      await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim(),
          job_title: profileForm.job_title.trim() || null,
          department: profileForm.department.trim() || null,
          phone: profileForm.phone.trim() || null,
        })
        .eq("id", userId)

      await logAudit({
        eventType: "user.updated",
        description: `Usuário "${profileForm.full_name}" atualizou seu perfil`,
        companyId,
        userId,
        entity: "profiles",
        entityId: userId,
        metadata: { full_name: profileForm.full_name },
      })

      setMessages((m) => ({ ...m, profile: { success: "Perfil atualizado com sucesso.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({ ...m, profile: { success: null, error: e?.message ?? "Falha ao salvar." } }))
    } finally {
      setSaving((s) => ({ ...s, profile: false }))
    }
  }

  const handleSaveNotifications = async () => {
    if (!companyId || !userId) return
    setSaving((s) => ({ ...s, notifications: true }))
    setMessages((m) => ({ ...m, notifications: { success: null, error: null } }))

    const supabase = createClient()
    try {
      if (notifExists) {
        await supabase
          .from("notification_preferences")
          .update({
            new_requisition: notifForm.new_requisition,
            quotation_received: notifForm.quotation_received,
            order_approved: notifForm.order_approved,
            delivery_done: notifForm.delivery_done,
            daily_summary: notifForm.daily_summary,
          })
          .eq("user_id", userId)
          .eq("company_id", companyId)
      } else {
        await supabase.from("notification_preferences").insert({
          user_id: userId,
          company_id: companyId,
          new_requisition: notifForm.new_requisition,
          quotation_received: notifForm.quotation_received,
          order_approved: notifForm.order_approved,
          delivery_done: notifForm.delivery_done,
          daily_summary: notifForm.daily_summary,
        })
        setNotifExists(true)
      }

      setMessages((m) => ({ ...m, notifications: { success: "Preferências salvas.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({
        ...m,
        notifications: { success: null, error: e?.message ?? "Falha ao salvar." },
      }))
    } finally {
      setSaving((s) => ({ ...s, notifications: false }))
    }
  }

  const handleDeleteApproval = async (levelId: string) => {
    if (!companyId) return
    setApprovalsSaving(true)
    setMessages((m) => ({ ...m, approvals: { success: null, error: null } }))
    const supabase = createClient()
    try {
      await supabase.from("approval_levels").delete().eq("id", levelId)
      setApprovalLevels((prev) => prev.filter((l) => l.id !== levelId))
      setMessages((m) => ({ ...m, approvals: { success: "Nível removido.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({ ...m, approvals: { success: null, error: e?.message ?? "Falha ao remover." } }))
    } finally {
      setApprovalsSaving(false)
    }
  }

  const handleAddApproval = async () => {
    if (!companyId) return
    setApprovalsSaving(true)
    setMessages((m) => ({ ...m, approvals: { success: null, error: null } }))

    const minValueNum = Number(newLevel.minValue)
    const maxValueNum = newLevel.maxValue.trim() ? Number(newLevel.maxValue) : null
    const levelOrder = (approvalLevels.reduce((max, l) => Math.max(max, l.level_order), 0) ?? 0) + 1

    if (!Number.isFinite(minValueNum)) {
      setMessages((m) => ({ ...m, approvals: { success: null, error: "Informe um valor mínimo válido." } }))
      setApprovalsSaving(false)
      return
    }

    const supabase = createClient()
    try {
      await supabase.from("approval_levels").insert({
        company_id: companyId,
        level_order: levelOrder,
        min_value: minValueNum,
        max_value: maxValueNum,
        approver_role: newLevel.approverRole.trim(),
      })

      const { data } = await supabase
        .from("approval_levels")
        .select("*")
        .eq("company_id", companyId)
        .order("level_order")
      setApprovalLevels(((data as unknown) as ApprovalLevel[]) ?? [])

      setAddLevelOpen(false)
      setNewLevel({ minValue: "", maxValue: "", approverRole: "" })
      setMessages((m) => ({ ...m, approvals: { success: "Nível adicionado.", error: null } }))
    } catch (e: any) {
      setMessages((m) => ({ ...m, approvals: { success: null, error: e?.message ?? "Falha ao adicionar." } }))
    } finally {
      setApprovalsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!userId) return

    setSecuritySuccess(null)
    setSecurityError(null)

    if (securityForm.newPassword.length < 8) {
      setSecurityError("A nova senha deve ter no mínimo 8 caracteres.")
      return
    }

    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      setSecurityError("A confirmação da nova senha não confere.")
      return
    }

    setSecuritySaving(true)
    const supabase = createClient()
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) {
        setSecurityError("Sessão expirada. Faça login novamente.")
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: securityForm.newPassword,
      })

      if (error) {
        setSecurityError(error.message)
        return
      }

      setSecuritySuccess("Senha alterada com sucesso.")
      setSecurityForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" })
    } catch (e: any) {
      setSecurityError(e?.message ?? "Falha ao alterar senha.")
    } finally {
      setSecuritySaving(false)
    }
  }

  const formatMoneyBR = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
  }

  const approvalRangeLabel = (level: ApprovalLevel) => {
    if (level.max_value == null) return `Acima de ${formatMoneyBR(level.min_value)}`
    if (level.min_value === 0) return `Até ${formatMoneyBR(level.max_value)}`
    return `${formatMoneyBR(level.min_value)} - ${formatMoneyBR(level.max_value)}`
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema de compras
        </p>
        {canManageCompany && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/comprador/configuracoes/permissoes")}
            >
              <Shield className="mr-2 h-4 w-4" />
              Perfis de Acesso
            </Button>
          </div>
        )}
      </div>

      {/* Abas (mesmo padrão visual do detalhe do tenant) */}
      <div className="flex gap-1 border-b border-border mb-4">
        {(
          [
            ["empresa", "Empresa", Building2],
            ["perfil", "Perfil", User],
            ["notificacoes", "Notificações", Bell],
            ["aprovacoes", "Aprovações", Workflow],
            ["seguranca", "Segurança", Shield],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ABA EMPRESA */}
      {activeTab === "empresa" && (
        <div className="grid gap-6">
          {!canManageCompany ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Apenas administradores podem editar as informações da empresa.
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dados cadastrais da sua organização
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback
                      style={{ backgroundColor: getAvatarColor(companyForm.name || "Empresa") }}
                      className="text-xl"
                    >
                      {getInitials(companyForm.name || "Empresa")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button variant="outline" size="sm" disabled>
                            <Upload className="mr-2 h-4 w-4" />
                            Alterar Logo
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Em breve</TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-muted-foreground">
                      Atualização de logo em breve
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="razaoSocial">Razão Social</Label>
                    <Input
                      id="razaoSocial"
                      value={companyForm.name}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                    <Input
                      id="nomeFantasia"
                      value={companyForm.trade_name}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, trade_name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={companyForm.cnpj}
                      onChange={(e) =>
                        setCompanyForm((f) => ({
                          ...f,
                          cnpj: maskCNPJ(e.target.value),
                        }))
                      }
                      disabled={!canManageCompany}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="inscricaoEstadual">
                      Inscrição Estadual
                    </Label>
                    <Input
                      id="inscricaoEstadual"
                      value={companyForm.state_reg}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, state_reg: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={companyForm.address}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, address: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={companyForm.city}
                      onChange={(e) =>
                        setCompanyForm((f) => ({ ...f, city: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 col-span-1">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="estado">Estado</Label>
                      <Input
                        id="estado"
                        value={companyForm.state}
                        onChange={(e) =>
                          setCompanyForm((f) => ({ ...f, state: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={companyForm.zip_code}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            zip_code: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {messages.company.error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {messages.company.error}
                  </div>
                )}
                {messages.company.success && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                    {messages.company.success}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={saving.company}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving.company ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ABA PERFIL */}
      {activeTab === "perfil" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Meu Perfil</CardTitle>
              <p className="text-sm text-muted-foreground">
                Informações da sua conta de usuário
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback
                    style={{
                      backgroundColor: getAvatarColor(profileForm.full_name || "Usuário"),
                    }}
                    className="text-xl"
                  >
                    {getInitials(profileForm.full_name || "Usuário")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button variant="outline" size="sm" disabled>
                          <Upload className="mr-2 h-4 w-4" />
                          Alterar Foto
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Em breve</TooltipContent>
                  </Tooltip>
                  <p className="text-xs text-muted-foreground">
                    Upload de foto indisponível no momento
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" value={authEmail ?? ""} disabled />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input
                    id="cargo"
                    value={profileForm.job_title}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, job_title: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="departamento">Departamento</Label>
                  <Input
                    id="departamento"
                    value={profileForm.department}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, department: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        phone: formatPhoneBR(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {messages.profile.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {messages.profile.error}
                </div>
              )}
              {messages.profile.success && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {messages.profile.success}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving.profile}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving.profile ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA NOTIFICAÇÕES */}
      {activeTab === "notificacoes" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure quais notificações deseja receber
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Nova Requisição</Label>
                    <span className="text-sm text-muted-foreground">
                      Receba alertas quando uma nova requisição for criada
                    </span>
                  </div>
                  <Switch
                    checked={notifForm.new_requisition}
                    onCheckedChange={(checked) =>
                      setNotifForm((f) => ({ ...f, new_requisition: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Cotação Recebida</Label>
                    <span className="text-sm text-muted-foreground">
                      Notificação quando um fornecedor enviar uma proposta
                    </span>
                  </div>
                  <Switch
                    checked={notifForm.quotation_received}
                    onCheckedChange={(checked) =>
                      setNotifForm((f) => ({ ...f, quotation_received: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Pedido Aprovado</Label>
                    <span className="text-sm text-muted-foreground">
                      Alerta quando um pedido for aprovado
                    </span>
                  </div>
                  <Switch
                    checked={notifForm.order_approved}
                    onCheckedChange={(checked) =>
                      setNotifForm((f) => ({ ...f, order_approved: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Entrega Realizada</Label>
                    <span className="text-sm text-muted-foreground">
                      Notificação quando uma entrega for confirmada
                    </span>
                  </div>
                  <Switch
                    checked={notifForm.delivery_done}
                    onCheckedChange={(checked) =>
                      setNotifForm((f) => ({ ...f, delivery_done: checked }))
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Resumo Diário por E-mail</Label>
                    <span className="text-sm text-muted-foreground">
                      Receba um resumo diário das atividades
                    </span>
                  </div>
                  <Switch
                    checked={notifForm.daily_summary}
                    onCheckedChange={(checked) =>
                      setNotifForm((f) => ({ ...f, daily_summary: checked }))
                    }
                  />
                </div>
              </div>

              {messages.notifications.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {messages.notifications.error}
                </div>
              )}
              {messages.notifications.success && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {messages.notifications.success}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={saving.notifications}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving.notifications ? "Salvando..." : "Salvar Preferências"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA APROVAÇÕES */}
      {activeTab === "aprovacoes" && (
        <div className="grid gap-6">
          {!canManageApprovals ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Apenas administradores podem gerenciar as aprovações.
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Níveis de Aprovação</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure as alçadas de aprovação por valor de compra
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    {approvalLevels.length === 0 ? (
                      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                        Nenhum nível configurado.
                      </div>
                    ) : (
                      approvalLevels.map((nivel) => (
                        <div
                          key={nivel.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                              {nivel.level_order}
                            </div>
                            <div>
                              <p className="font-medium">{approvalRangeLabel(nivel)}</p>
                              <p className="text-sm text-muted-foreground">
                                Aprovador: {nivel.approver_role}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteApproval(nivel.id)}
                            disabled={approvalsSaving}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setNewLevel({ minValue: "", maxValue: "", approverRole: "" })
                        setAddLevelOpen(true)
                      }}
                      disabled={approvalsSaving}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Nível
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fluxo de Aprovação</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configurações gerais do processo de aprovação
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Label>Aprovação em Paralelo</Label>
                        <Badge variant="outline">Em breve</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Permite que múltiplos aprovadores atuem simultaneamente
                      </span>
                    </div>
                    <Switch checked disabled />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Label>Delegação Automática</Label>
                        <Badge variant="outline">Em breve</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Redireciona aprovações para substituto em ausência
                      </span>
                    </div>
                    <Switch checked disabled />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Label>Lembrete de Aprovação Pendente</Label>
                        <Badge variant="outline">Em breve</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Envia lembretes após 24h de pendência
                      </span>
                    </div>
                    <Switch checked disabled />
                  </div>
                </CardContent>
              </Card>

              {/* Dialog Adicionar Nível */}
              <Dialog open={addLevelOpen} onOpenChange={setAddLevelOpen}>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Nível de Aprovação</DialogTitle>
                    <DialogDescription>
                      Defina faixa de valores e o responsável pela aprovação
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minValue">Valor mínimo</Label>
                        <Input
                          id="minValue"
                          type="number"
                          inputMode="numeric"
                          value={newLevel.minValue}
                          onChange={(e) =>
                            setNewLevel((f) => ({ ...f, minValue: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxValue">
                          Valor máximo <span className="text-xs text-muted-foreground">(opcional)</span>
                        </Label>
                        <Input
                          id="maxValue"
                          type="number"
                          inputMode="numeric"
                          value={newLevel.maxValue}
                          onChange={(e) =>
                            setNewLevel((f) => ({ ...f, maxValue: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="approverRole">Aprovador</Label>
                      <Input
                        id="approverRole"
                        value={newLevel.approverRole}
                        onChange={(e) =>
                          setNewLevel((f) => ({ ...f, approverRole: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setAddLevelOpen(false)} disabled={approvalsSaving}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddApproval} disabled={approvalsSaving}>
                      {approvalsSaving ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {messages.approvals.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {messages.approvals.error}
                </div>
              )}
              {messages.approvals.success && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {messages.approvals.success}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ABA SEGURANÇA */}
      {activeTab === "seguranca" && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <p className="text-sm text-muted-foreground">
                Atualize sua senha de acesso ao sistema
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="senhaAtual">Senha Atual</Label>
                  <Input
                    id="senhaAtual"
                    type="password"
                    value={securityForm.currentPassword}
                    onChange={(e) =>
                      setSecurityForm((f) => ({ ...f, currentPassword: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="novaSenha">Nova Senha</Label>
                  <Input
                    id="novaSenha"
                    type="password"
                    value={securityForm.newPassword}
                    onChange={(e) =>
                      setSecurityForm((f) => ({ ...f, newPassword: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  value={securityForm.confirmNewPassword}
                  onChange={(e) =>
                    setSecurityForm((f) => ({ ...f, confirmNewPassword: e.target.value }))
                  }
                />
              </div>
              {securityError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {securityError}
                </div>
              )}
              {securitySuccess && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  {securitySuccess}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={securitySaving}>
                  {securitySaving ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Autenticação em Dois Fatores</CardTitle>
              <p className="text-sm text-muted-foreground">
                Adicione uma camada extra de segurança à sua conta
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Label>2FA via Aplicativo</Label>
                    <Badge variant="outline">Em breve</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Use um aplicativo autenticador como Google Authenticator
                  </span>
                </div>
                <Switch checked disabled />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Label>2FA via SMS</Label>
                    <Badge variant="outline">Em breve</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Receba códigos de verificação por SMS
                  </span>
                </div>
                <Switch checked disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessões Ativas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Dispositivos com sessão ativa na sua conta
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">Chrome - Windows</p>
                    <p className="text-sm text-muted-foreground">
                      São Paulo, Brasil - Sessão atual
                    </p>
                  </div>
                  <Badge variant="outline">Em breve</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">Safari - iPhone</p>
                    <p className="text-sm text-muted-foreground">
                      São Paulo, Brasil
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" disabled>
                    Encerrar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

