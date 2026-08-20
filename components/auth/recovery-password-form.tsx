"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"

type RecoveryPasswordFormProps = {
  portal: "comprador" | "fornecedor"
  loginHref: string
}

export function RecoveryPasswordForm({ portal, loginHref }: RecoveryPasswordFormProps) {
  const router = useRouter()
  const [sessionReady, setSessionReady] = React.useState(false)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [loadingPolicy, setLoadingPolicy] = React.useState(true)
  const [rules, setRules] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    newPassword: "",
    confirmNewPassword: "",
  })

  React.useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function ensureSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        setSessionReady(true)
        return
      }

      // Aguarda tokens do hash/query (redirect do Supabase)
      await new Promise((r) => setTimeout(r, 800))
      const {
        data: { session: again },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (again) {
        setSessionReady(true)
        return
      }
      setSessionError(
        "Link inválido ou expirado. Solicite uma nova redefinição de senha.",
      )
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setSessionReady(true)
        setSessionError(null)
      }
    })

    void ensureSession()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void fetch("/api/tenant-password-policy")
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { rules?: string[]; policy?: PasswordPolicy }
      })
      .then((data) => {
        if (!cancelled) setRules(data?.rules ?? [])
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
      const res = await fetch("/api/auth/complete-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: form.newPassword }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível redefinir a senha.")
        return
      }
      toast.success("Senha redefinida com sucesso.")
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace(loginHref)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (sessionError) {
    return (
      <div className="space-y-4 max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Link inválido</h1>
        <p className="text-sm text-muted-foreground">{sessionError}</p>
        <Button asChild>
          <Link href={loginHref}>Voltar ao login</Link>
        </Button>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Validando link de recuperação…
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 max-w-md">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina uma nova senha para acessar o portal.
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
