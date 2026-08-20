"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Confirma o token de recuperação só no clique do usuário.
 * Evita otp_expired causado por scanners de e-mail que abrem o action_link do Supabase.
 */
function ConfirmRecoveryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const tokenHash = searchParams.get("token_hash") ?? ""
  const type = searchParams.get("type") ?? "recovery"
  const next = searchParams.get("next") || "/fornecedor/alterar-senha?recovery=1"

  const loginHref = next.startsWith("/comprador") ? "/login" : "/fornecedor/login"

  async function handleConfirm() {
    if (!tokenHash) {
      setError("Link incompleto. Solicite uma nova redefinição de senha.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "recovery",
      })

      if (verifyError) {
        setError(
          verifyError.message.includes("expired") || verifyError.message.includes("invalid")
            ? "Link inválido ou expirado. Solicite uma nova redefinição de senha."
            : verifyError.message,
        )
        return
      }

      toast.success("Link confirmado. Defina sua nova senha.")
      router.replace(next)
      router.refresh()
    } catch {
      setError("Não foi possível validar o link. Tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  if (!tokenHash) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link inválido</CardTitle>
          <CardDescription>
            Este link de recuperação está incompleto. Solicite um novo e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={loginHref}>Voltar ao login</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary mb-2">
          <KeyRound className="h-5 w-5 text-primary-foreground" />
        </div>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>
          Clique no botão abaixo para confirmar o link e criar uma nova senha. Esta etapa evita
          que filtros de segurança invalidem o e-mail automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Button className="w-full" disabled={busy} onClick={() => void handleConfirm()}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando…
            </>
          ) : (
            "Continuar para criar nova senha"
          )}
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href={loginHref}>Cancelar</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function AuthConfirmPage() {
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
        <ConfirmRecoveryContent />
      </React.Suspense>
    </div>
  )
}
