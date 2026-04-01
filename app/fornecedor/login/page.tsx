"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [cnpj, setCnpj] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [accessError, setAccessError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAccessError("")

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message || "Erro ao entrar. Verifique suas credenciais.")
        return
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) {
        toast.error("Não foi possível validar o usuário autenticado.")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_type")
        .eq("id", userId)
        .single()
      const profileType = profile?.profile_type ?? "buyer"

      if (profileType !== "supplier") {
        await supabase.auth.signOut()
        setAccessError("Acesso não permitido neste portal. Utilize o Portal do Comprador.")
        return
      }

      router.push("/fornecedor")
    } catch {
      toast.error("Erro inesperado ao entrar. Tente novamente.")
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
            Entre com suas credenciais para acessar o portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {accessError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {accessError}
              </p>
            ) : null}
            <FieldGroup>
              <Field>
                <FieldLabel>E-mail</FieldLabel>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel>CNPJ (opcional)</FieldLabel>
                <Input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Novo por aqui?
                </span>
              </div>
            </div>

            <Button variant="outline" className="w-full" asChild>
              <Link href="/fornecedor/cadastro">
                Cadastrar minha empresa
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
