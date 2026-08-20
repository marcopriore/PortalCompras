"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Package, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { looksLikeCnpjInput } from "@/lib/utils/cnpj"

type TenantOption = { email: string; companyName: string }

export default function LoginPage() {
  const [login, setLogin] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [accessError, setAccessError] = useState("")
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("cadastro") === "ok") {
      void (async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        toast.success("Cadastro concluído! Entre com seu CNPJ e senha.")
        window.history.replaceState({}, "", "/fornecedor/login")
      })()
      return
    }

    const hash = window.location.hash.replace(/^#/, "")
    if (hash) {
      const hashParams = new URLSearchParams(hash)
      const errDesc = hashParams.get("error_description") ?? hashParams.get("error")
      if (errDesc) {
        toast.error(
          decodeURIComponent(errDesc.replace(/\+/g, " ")) ||
            "Link de recuperação inválido ou expirado. Solicite um novo.",
        )
        window.history.replaceState({}, "", "/fornecedor/login")
      }
    }
  }, [])

  async function completeLogin(email: string, userId: string, companyId: string | null) {
    await logAudit({
      eventType: "supplier.login",
      description: "Login no Portal do Fornecedor",
      userId,
      companyId,
      entity: "profiles",
      entityId: userId,
      metadata: { portal: "fornecedor", login: email },
    })
    window.location.href = "/fornecedor"
  }

  async function signInWithResolvedEmail(email: string) {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message || "Credenciais inválidas.")
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Não foi possível validar o usuário autenticado.")
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_type, company_id, supplier_id, status")
      .eq("id", user.id)
      .single()

    if (profile?.profile_type !== "supplier" || profile.status !== "active") {
      await supabase.auth.signOut()
      setAccessError("Acesso não permitido neste portal.")
      return
    }

    if (!profile.supplier_id) {
      await supabase.auth.signOut()
      setAccessError("Usuário ainda não vinculado a um fornecedor. Contate o comprador.")
      return
    }

    await completeLogin(email, user.id, profile.company_id ?? null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setAccessError("")
    setTenantOptions(null)

    try {
      const trimmedLogin = login.trim()
      if (!trimmedLogin) {
        toast.error("Informe CNPJ ou e-mail.")
        return
      }

      if (looksLikeCnpjInput(trimmedLogin)) {
        const res = await fetch("/api/supplier-auth/resolve-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpj: trimmedLogin }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? "CNPJ não encontrado.")
          return
        }
        if (data.multiple && Array.isArray(data.options)) {
          setTenantOptions(data.options as TenantOption[])
          toast.message("Selecione o comprador vinculado a este CNPJ.")
          return
        }
        if (!data.email) {
          toast.error("CNPJ não encontrado.")
          return
        }
        await signInWithResolvedEmail(data.email as string)
        return
      }

      await signInWithResolvedEmail(trimmedLogin.toLowerCase())
    } catch {
      toast.error("Erro inesperado ao entrar. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleTenantPick(email: string) {
    setIsLoading(true)
    try {
      await signInWithResolvedEmail(email)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Portal do Fornecedor</CardTitle>
          <CardDescription>
            Administrador: login com CNPJ. Demais usuários: e-mail e senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantOptions ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Este CNPJ está vinculado a mais de um comprador. Selecione a conta:
              </p>
              {tenantOptions.map((opt) => (
                <Button
                  key={opt.email}
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  disabled={isLoading}
                  onClick={() => void handleTenantPick(opt.email)}
                >
                  <div className="text-left">
                    <p className="font-medium">{opt.companyName}</p>
                    <p className="text-xs text-muted-foreground">{opt.email}</p>
                  </div>
                </Button>
              ))}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setTenantOptions(null)}
              >
                Voltar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {accessError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {accessError}
                </p>
              ) : null}
              <FieldGroup>
                <Field>
                  <FieldLabel>CNPJ ou e-mail</FieldLabel>
                  <Input
                    type="text"
                    placeholder="00.000.000/0001-00 ou seu@email.com"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </Field>

                <Field>
                  <FieldLabel>Senha</FieldLabel>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </Field>
              </FieldGroup>

              <div className="flex items-center justify-end">
                <Link
                  href="/fornecedor/recuperar-senha"
                  className="text-sm text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-2">
                Acesso somente mediante convite do comprador.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
