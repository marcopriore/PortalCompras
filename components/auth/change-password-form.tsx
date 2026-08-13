"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"
import { passwordPolicyToRules } from "@/lib/settings/password-policy-registry"

type ChangePasswordFormProps = {
  portal: "comprador" | "fornecedor"
  forced?: boolean
  title?: string
  description?: string
  onSuccessRedirect?: string
}

export function ChangePasswordForm({
  portal,
  forced = false,
  title = "Alterar senha",
  description,
  onSuccessRedirect,
}: ChangePasswordFormProps) {
  const router = useRouter()
  const [loadingPolicy, setLoadingPolicy] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [rules, setRules] = React.useState<string[]>([])
  const [form, setForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  })

  React.useEffect(() => {
    let cancelled = false
    void fetch("/api/tenant-password-policy")
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { rules?: string[]; policy?: PasswordPolicy }
      })
      .then((data) => {
        if (cancelled) return
        setRules(data?.rules ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoadingPolicy(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.newPassword !== form.confirmNewPassword) {
      toast.error("A confirmação da nova senha não confere.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível alterar a senha.")
        return
      }
      toast.success("Senha alterada com sucesso.")
      const target =
        onSuccessRedirect ??
        (portal === "comprador" ? "/comprador" : "/fornecedor")
      router.replace(target)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const defaultDescription = forced
    ? "Sua senha expirou. Defina uma nova senha para continuar usando o portal."
    : "Atualize sua senha de acesso."

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 max-w-md">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {description ?? defaultDescription}
        </p>
      </div>

      {!loadingPolicy && rules.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-foreground mb-2">
            Requisitos da sua empresa
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) =>
            setForm((f) => ({ ...f, currentPassword: e.target.value }))
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
        <Input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmNewPassword}
          onChange={(e) =>
            setForm((f) => ({ ...f, confirmNewPassword: e.target.value }))
          }
          required
        />
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Salvar nova senha
      </Button>
    </form>
  )
}
