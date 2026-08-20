"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RecuperarSenhaCompradorPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, portal: "comprador" }),
      })
      const data = (await res.json()) as { error?: string; message?: string }

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao solicitar recuperação de senha.")
        return
      }

      setSent(true)
      toast.success(data.message ?? "Verifique seu e-mail.")
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
              <Link href="/login">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <KeyRound className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Informe o e-mail da conta de comprador ou solicitante para receber o link de
            redefinição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se existir uma conta ativa, enviamos um link para redefinição de senha.
                Verifique a caixa de entrada e o spam.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>E-mail</FieldLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
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
