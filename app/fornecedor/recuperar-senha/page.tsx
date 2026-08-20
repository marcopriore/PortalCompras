"use client"

import { useState } from "react"
import Link from "next/link"
import { Package, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { looksLikeCnpjInput } from "@/lib/utils/cnpj"
import { getAppEmailBaseUrl } from "@/lib/email/templates"

export default function RecuperarSenhaPage() {
  const [login, setLogin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      let email = login.trim().toLowerCase()

      if (looksLikeCnpjInput(login)) {
        const res = await fetch("/api/supplier-auth/resolve-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpj: login }),
        })
        const data = await res.json()
        if (!res.ok || data.multiple) {
          toast.error(
            data.multiple
              ? "CNPJ vinculado a vários compradores. Use o e-mail cadastrado."
              : (data.error ?? "CNPJ não encontrado."),
          )
          return
        }
        email = data.email as string
      }

      const supabase = createClient()
      const baseUrl = getAppEmailBaseUrl()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/fornecedor/alterar-senha`,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setSent(true)
    } catch {
      toast.error("Erro ao solicitar recuperação de senha.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/fornecedor/login">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Informe CNPJ (administrador) ou e-mail para receber o link de redefinição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se existir uma conta ativa, enviamos um link para redefinição de senha.
              </p>
              <Button asChild className="w-full">
                <Link href="/fornecedor/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>CNPJ ou e-mail</FieldLabel>
                  <Input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="CNPJ ou e-mail cadastrado"
                    required
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
