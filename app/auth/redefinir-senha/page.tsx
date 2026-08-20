"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"

function RedefinirSenhaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const portal = searchParams.get("portal") === "comprador" ? "comprador" : "fornecedor"
  const loginHref = portal === "comprador" ? "/login" : "/fornecedor/login"

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
      await new Promise((r) => setTimeout(r, 500))
      const {
        data: { session: again },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (again) {
        setSessionReady(true)
        return
      }
      setSessionError(
        "Sessão de recuperação inválida ou expirada. Solicite um novo link.",
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

      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success("Senha redefinida. Faça login com a nova senha.")
      router.replace(loginHref)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary mb-2">
          <KeyRound className="h-5 w-5 text-primary-foreground" />
        </div>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>
          Defina uma nova senha para acessar o{" "}
          {portal === "fornecedor" ? "Portal do Fornecedor" : "portal"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessionError ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{sessionError}</p>
            <Button asChild className="w-full">
              <Link href={loginHref}>Voltar ao login</Link>
            </Button>
          </div>
        ) : !sessionReady ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando sessão…
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar nova senha
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href={loginHref}>Cancelar</Link>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function AuthRedefinirSenhaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <React.Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        }
      >
        <RedefinirSenhaContent />
      </React.Suspense>
    </div>
  )
}
