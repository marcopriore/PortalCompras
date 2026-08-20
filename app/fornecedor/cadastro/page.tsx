"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Package, ArrowLeft, Check, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { maskCnpjInput } from "@/lib/utils/cnpj"

type InvitePreview = {
  email: string
  supplierName: string
  supplierCode: string
  cnpjMasked: string
  buyerCompanyName: string
}

function CadastroContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")?.trim() ?? ""

  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [sessionCleared, setSessionCleared] = useState(false)

  const [fullName, setFullName] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      setSessionCleared(true)
    })()
  }, [])

  useEffect(() => {
    if (!sessionCleared || !token) {
      if (!token) {
        setInviteError("Link de convite inválido. Solicite um novo convite ao comprador.")
        setLoadingInvite(false)
      }
      return
    }

    void (async () => {
      try {
        const res = await fetch(
          `/api/supplier-invites/validate?token=${encodeURIComponent(token)}`,
        )
        const data = await res.json()
        if (!res.ok) {
          setInviteError(data.error ?? "Convite inválido.")
          return
        }
        setInvite({
          email: data.email,
          supplierName: data.supplierName,
          supplierCode: data.supplierCode,
          cnpjMasked: data.cnpjMasked,
          buyerCompanyName: data.buyerCompanyName,
        })
      } catch {
        setInviteError("Erro ao validar convite.")
      } finally {
        setLoadingInvite(false)
      }
    })()
  }, [token, sessionCleared])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !invite) return

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/supplier-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fullName: fullName.trim(),
          cnpj,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao concluir cadastro.")
        return
      }

      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = "/fornecedor/login?cadastro=ok"
    } finally {
      setSubmitting(false)
    }
  }

  if (!sessionCleared) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Preparando cadastro...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/fornecedor/login">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Cadastro no Portal</h1>
            <p className="text-sm text-muted-foreground">Valore — convite do comprador</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Concluir cadastro</CardTitle>
            <CardDescription>
              Confirme os dados do fornecedor já cadastrado no portal do comprador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvite ? (
              <p className="text-sm text-muted-foreground">Validando convite...</p>
            ) : inviteError ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">{inviteError}</p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/fornecedor/login">Ir para login</Link>
                </Button>
              </div>
            ) : invite ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Comprador</span>
                    <span className="font-medium text-right">{invite.buyerCompanyName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Fornecedor</span>
                    <span className="font-medium text-right">{invite.supplierName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Código</span>
                    <span>{invite.supplierCode || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">CNPJ (cadastro)</span>
                    <span>{invite.cnpjMasked}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">E-mail do convite</span>
                    <span className="text-right break-all">{invite.email}</span>
                  </div>
                </div>

                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome completo</FieldLabel>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Responsável pelo acesso"
                      autoComplete="name"
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Confirme o CNPJ completo</FieldLabel>
                    <Input
                      value={cnpj}
                      onChange={(e) => setCnpj(maskCnpjInput(e.target.value))}
                      placeholder="Digite os 14 dígitos do CNPJ"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deve ser idêntico ao CNPJ cadastrado por {invite.buyerCompanyName}{" "}
                      (parcialmente oculto acima). A formatação é aplicada automaticamente.
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel>Senha</FieldLabel>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
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

                  <Field>
                    <FieldLabel>Confirmar senha</FieldLabel>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                </FieldGroup>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Concluindo..." : "Concluir cadastro"}
                </Button>

                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                  <Check className="h-3 w-3" />
                  Após o cadastro, faça login com CNPJ + senha.
                </p>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Carregando...
        </div>
      }
    >
      <CadastroContent />
    </Suspense>
  )
}
