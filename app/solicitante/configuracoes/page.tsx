"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { SolicitanteHeader } from "@/components/solicitante/solicitante-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Bell, Mail, Loader2, Upload } from "lucide-react"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    "#4F3EF5",
    "#0EA5E9",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

type TabKey = "perfil" | "notificacoes" | "seguranca"

type NotifForm = {
  new_requisition_bell: boolean
  new_requisition_email: boolean
  requisition_approval_bell: boolean
  requisition_approval_email: boolean
}

const SOLICITANTE_NOTIF_TYPES = [
  {
    key: "new_requisition",
    label: "Nova Requisição",
    description: "Quando uma nova requisição for criada (útil se você também aprova)",
    bellKey: "new_requisition_bell" as const,
    emailKey: "new_requisition_email" as const,
  },
  {
    key: "requisition_approval",
    label: "Aprovação Requisição",
    description: "Quando sua requisição for aprovada ou reprovada",
    bellKey: "requisition_approval_bell" as const,
    emailKey: "requisition_approval_email" as const,
  },
]

function SolicitanteConfigInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const activeTab: TabKey =
    tabParam === "notificacoes" || tabParam === "seguranca" || tabParam === "perfil"
      ? tabParam
      : "perfil"

  const [userId, setUserId] = React.useState<string | null>(null)
  const [companyId, setCompanyId] = React.useState<string | null>(null)
  const [userName, setUserName] = React.useState("")
  const [authEmail, setAuthEmail] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  const [profileForm, setProfileForm] = React.useState({
    full_name: "",
    job_title: "",
    department: "",
    phone: "",
    avatar_url: "" as string | null,
  })
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [avatarUploading, setAvatarUploading] = React.useState(false)

  const [notifForm, setNotifForm] = React.useState<NotifForm>({
    new_requisition_bell: true,
    new_requisition_email: false,
    requisition_approval_bell: true,
    requisition_approval_email: false,
  })
  const [notifExists, setNotifExists] = React.useState(false)
  const [notifSaving, setNotifSaving] = React.useState(false)

  const [securityForm, setSecurityForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })
  const [securitySaving, setSecuritySaving] = React.useState(false)
  const [securityError, setSecurityError] = React.useState<string | null>(null)
  const [securitySuccess, setSecuritySuccess] = React.useState<string | null>(null)

  const [mfaEnabled, setMfaEnabled] = React.useState(false)
  const [mfaLoading, setMfaLoading] = React.useState(false)
  const [mfaStep, setMfaStep] = React.useState<"idle" | "setup" | "verify" | "disable">("idle")
  const [mfaQR, setMfaQR] = React.useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = React.useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = React.useState<string | null>(null)
  const [mfaCode, setMfaCode] = React.useState("")
  const [mfaError, setMfaError] = React.useState<string | null>(null)
  const [mfaSuccess, setMfaSuccess] = React.useState<string | null>(null)

  const setTab = (tab: TabKey) => {
    router.replace(`/solicitante/configuracoes?tab=${tab}`)
  }

  React.useEffect(() => {
    let alive = true
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, full_name, company_id, profile_type, job_title, department, phone, avatar_url, is_superadmin, roles, role",
        )
        .eq("id", user.id)
        .single()

      if (!profile) {
        window.location.href = "/login"
        return
      }

      const roles = (profile.roles as string[] | null) ?? []
      const isAdmin =
        Boolean(profile.is_superadmin) ||
        profile.role === "admin" ||
        roles.includes("admin")
      if (profile.profile_type !== "requester" && !isAdmin) {
        window.location.href = "/login"
        return
      }

      if (!alive) return
      setUserId(user.id)
      setCompanyId(profile.company_id)
      setUserName(profile.full_name ?? user.email ?? "")
      setAuthEmail(user.email ?? "")
      setProfileForm({
        full_name: profile.full_name ?? "",
        job_title: profile.job_title ?? "",
        department: profile.department ?? "",
        phone: profile.phone ?? "",
        avatar_url: profile.avatar_url ?? null,
      })

      if (profile.company_id) {
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select(
            "new_requisition_bell, new_requisition_email, requisition_approval_bell, requisition_approval_email",
          )
          .eq("user_id", user.id)
          .eq("company_id", profile.company_id)
          .maybeSingle()

        if (prefs) {
          setNotifExists(true)
          setNotifForm({
            new_requisition_bell: Boolean(prefs.new_requisition_bell ?? true),
            new_requisition_email: Boolean(prefs.new_requisition_email ?? false),
            requisition_approval_bell: Boolean(
              prefs.requisition_approval_bell ?? true,
            ),
            requisition_approval_email: Boolean(
              prefs.requisition_approval_email ?? false,
            ),
          })
        }
      }

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const verified = factors?.totp?.find((f) => f.status === "verified")
      if (verified) {
        setMfaEnabled(true)
        setMfaFactorId(verified.id)
      }

      setLoading(false)
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const handleSaveProfile = async () => {
    if (!userId) return
    setProfileSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name.trim(),
          job_title: profileForm.job_title.trim() || null,
          department: profileForm.department.trim() || null,
          phone: profileForm.phone.trim() || null,
        })
        .eq("id", userId)
      if (error) {
        toast.error(error.message)
        return
      }
      setUserName(profileForm.full_name.trim())
      toast.success("Perfil atualizado.")
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!userId) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Máximo 2MB.")
      return
    }
    setAvatarUploading(true)
    try {
      const supabase = createClient()
      const path = `${userId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, { upsert: true })
      if (upErr) {
        toast.error(upErr.message)
        return
      }
      const { data: pub } = supabase.storage.from("profile-avatars").getPublicUrl(path)
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId)
      setProfileForm((f) => ({ ...f, avatar_url: publicUrl }))
      toast.success("Foto atualizada.")
    } catch {
      toast.error("Erro no upload")
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveNotifications = async () => {
    if (!userId || !companyId) return
    setNotifSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        new_requisition:
          notifForm.new_requisition_bell || notifForm.new_requisition_email,
        new_requisition_bell: notifForm.new_requisition_bell,
        new_requisition_email: notifForm.new_requisition_email,
        requisition_approval_bell: notifForm.requisition_approval_bell,
        requisition_approval_email: notifForm.requisition_approval_email,
      }
      if (notifExists) {
        const { error } = await supabase
          .from("notification_preferences")
          .update(payload)
          .eq("user_id", userId)
          .eq("company_id", companyId)
        if (error) {
          toast.error(error.message)
          return
        }
      } else {
        const { error } = await supabase.from("notification_preferences").insert({
          user_id: userId,
          company_id: companyId,
          ...payload,
        })
        if (error) {
          toast.error(error.message)
          return
        }
        setNotifExists(true)
      }
      toast.success("Preferências salvas.")
    } finally {
      setNotifSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!userId) return
    setSecurityError(null)
    setSecuritySuccess(null)
    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      setSecurityError("As senhas não coincidem.")
      return
    }
    setSecuritySaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSecurityError(data.error ?? "Falha ao alterar senha.")
        return
      }
      setSecuritySuccess("Senha alterada com sucesso.")
      setSecurityForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      })
    } catch {
      setSecurityError("Falha ao alterar senha.")
    } finally {
      setSecuritySaving(false)
    }
  }

  async function handleEnableMFA() {
    setMfaError(null)
    setMfaSuccess(null)
    setMfaLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Valore 2FA",
      })
      if (error || !data) {
        setMfaError(error?.message ?? "Não foi possível iniciar o 2FA.")
        return
      }
      setMfaQR(data.totp.qr_code)
      setMfaSecret(data.totp.secret)
      setMfaFactorId(data.id)
      setMfaStep("setup")
    } finally {
      setMfaLoading(false)
    }
  }

  async function handleVerifyMFA() {
    if (!mfaFactorId || !mfaCode.trim()) return
    setMfaError(null)
    setMfaLoading(true)
    try {
      const supabase = createClient()
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      })
      if (chErr || !challenge) {
        setMfaError(chErr?.message ?? "Falha no desafio MFA.")
        return
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      })
      if (vErr) {
        setMfaError(vErr.message)
        return
      }
      setMfaEnabled(true)
      setMfaStep("idle")
      setMfaCode("")
      setMfaQR(null)
      setMfaSecret(null)
      setMfaSuccess("2FA ativado com sucesso.")
    } finally {
      setMfaLoading(false)
    }
  }

  async function handleDisableMFA() {
    if (!mfaFactorId) return
    setMfaError(null)
    setMfaLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
      if (error) {
        setMfaError(error.message)
        return
      }
      setMfaEnabled(false)
      setMfaFactorId(null)
      setMfaStep("idle")
      setMfaSuccess("2FA desativado.")
    } finally {
      setMfaLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SolicitanteHeader userName={userName} />
        <div className="py-16 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <SolicitanteHeader userName={userName} />
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex gap-2 border-b border-border">
          {(
            [
              ["perfil", "Perfil"],
              ["notificacoes", "Notificações"],
              ["seguranca", "Segurança"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "perfil" && (
          <Card>
            <CardHeader>
              <CardTitle>Meu Perfil</CardTitle>
              <p className="text-sm text-muted-foreground">
                Informações da sua conta
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  {profileForm.avatar_url ? (
                    <AvatarImage src={profileForm.avatar_url} alt="Foto" />
                  ) : null}
                  <AvatarFallback
                    style={{
                      backgroundColor: getAvatarColor(
                        profileForm.full_name || "Usuário",
                      ),
                    }}
                    className="text-xl"
                  >
                    {getInitials(profileForm.full_name || "Usuário")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={avatarUploading}
                      asChild
                    >
                      <span>
                        {avatarUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Alterar Foto
                          </>
                        )}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleAvatarUpload(file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">PNG ou JPG. Máx. 2MB.</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>E-mail</Label>
                  <Input value={authEmail} disabled />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cargo</Label>
                  <Input
                    value={profileForm.job_title}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, job_title: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Departamento</Label>
                  <Input
                    value={profileForm.department}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, department: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Telefone</Label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void handleSaveProfile()} disabled={profileSaving}>
                  {profileSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "notificacoes" && (
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <p className="text-sm text-muted-foreground">
                Apenas eventos relevantes ao portal solicitante
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 text-left font-medium text-muted-foreground">
                        Notificação
                      </th>
                      <th className="w-24 py-3 text-center font-medium text-muted-foreground">
                        <div className="flex flex-col items-center gap-1">
                          <Bell className="h-4 w-4" />
                          <span>Sininho</span>
                        </div>
                      </th>
                      <th className="w-24 py-3 text-center font-medium text-muted-foreground">
                        <div className="flex flex-col items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>E-mail</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOLICITANTE_NOTIF_TYPES.map((nt) => (
                      <tr key={nt.key} className="border-b border-border last:border-0">
                        <td className="py-4">
                          <p className="font-medium">{nt.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {nt.description}
                          </p>
                        </td>
                        <td className="py-4 text-center">
                          <Switch
                            checked={notifForm[nt.bellKey]}
                            onCheckedChange={(v) =>
                              setNotifForm((f) => ({ ...f, [nt.bellKey]: v }))
                            }
                          />
                        </td>
                        <td className="py-4 text-center">
                          <Switch
                            checked={notifForm[nt.emailKey]}
                            onCheckedChange={(v) =>
                              setNotifForm((f) => ({ ...f, [nt.emailKey]: v }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => void handleSaveNotifications()}
                  disabled={notifSaving}
                >
                  {notifSaving ? "Salvando..." : "Salvar Preferências"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "seguranca" && (
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Senha Atual</Label>
                  <Input
                    type="password"
                    value={securityForm.currentPassword}
                    onChange={(e) =>
                      setSecurityForm((f) => ({
                        ...f,
                        currentPassword: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Nova Senha</Label>
                  <Input
                    type="password"
                    value={securityForm.newPassword}
                    onChange={(e) =>
                      setSecurityForm((f) => ({ ...f, newPassword: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Confirmar Nova Senha</Label>
                  <Input
                    type="password"
                    value={securityForm.confirmNewPassword}
                    onChange={(e) =>
                      setSecurityForm((f) => ({
                        ...f,
                        confirmNewPassword: e.target.value,
                      }))
                    }
                  />
                </div>
                {securityError ? (
                  <p className="text-sm text-destructive">{securityError}</p>
                ) : null}
                {securitySuccess ? (
                  <p className="text-sm text-primary">{securitySuccess}</p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleChangePassword()}
                    disabled={securitySaving}
                  >
                    {securitySaving ? "Alterando..." : "Alterar Senha"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Autenticação em Dois Fatores</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Proteja sua conta com Google Authenticator
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Label>2FA via Aplicativo</Label>
                      <Badge variant={mfaEnabled ? "default" : "outline"}>
                        {mfaEnabled ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={mfaEnabled}
                    disabled={mfaLoading || mfaStep !== "idle"}
                    onCheckedChange={(val) =>
                      val ? void handleEnableMFA() : setMfaStep("disable")
                    }
                  />
                </div>

                {mfaStep === "setup" && mfaQR ? (
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <p className="text-sm font-medium">
                      1. Escaneie o QR Code com o autenticador
                    </p>
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mfaQR} alt="QR Code 2FA" className="w-40 h-40" />
                    </div>
                    {mfaSecret ? (
                      <p className="text-xs text-muted-foreground text-center font-mono">
                        {mfaSecret}
                      </p>
                    ) : null}
                    <p className="text-sm font-medium">2. Digite o código de 6 dígitos</p>
                    <Input
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                    />
                    {mfaError ? (
                      <p className="text-sm text-destructive">{mfaError}</p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMfaStep("idle")
                          setMfaQR(null)
                          setMfaCode("")
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => void handleVerifyMFA()}
                        disabled={mfaLoading || mfaCode.length < 6}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {mfaStep === "disable" ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <p className="text-sm">Desativar autenticação em dois fatores?</p>
                    {mfaError ? (
                      <p className="text-sm text-destructive">{mfaError}</p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setMfaStep("idle")}>
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDisableMFA()}
                        disabled={mfaLoading}
                      >
                        Desativar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {mfaSuccess ? (
                  <p className="text-sm text-primary">{mfaSuccess}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

export default function SolicitanteConfiguracoesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <SolicitanteConfigInner />
    </React.Suspense>
  )
}
