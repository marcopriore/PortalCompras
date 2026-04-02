'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logAudit } from '@/lib/audit'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [accessError, setAccessError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAccessError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error(error.message || 'Erro ao entrar. Verifique suas credenciais.')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      const userId = user?.id
      if (!userId) {
        toast.error('Não foi possível validar o usuário autenticado.')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_type')
        .eq('id', userId)
        .single()
      const profileType = profile?.profile_type ?? 'buyer'

      if (profileType === 'supplier') {
        await supabase.auth.signOut()
        setAccessError('Acesso não permitido neste portal. Utilize o Portal do Fornecedor.')
        return
      }

      try {
        await logAudit({
          eventType: 'user.login',
          description: `Login realizado por ${email}`,
          userName: email,
          metadata: { email },
        })
      } catch {
        // não bloquear redirect se auditoria falhar
      }

      window.location.href = '/comprador'
    } catch {
      toast.error('Erro inesperado ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">PM</span>
          </div>
          <CardTitle className="text-xl">Valore</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Acesse sua conta para gerenciar cotações e fornecedores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {accessError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {accessError}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

