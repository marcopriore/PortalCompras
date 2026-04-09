'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { logAudit } from '@/lib/audit'
import { ShoppingCart, ClipboardList } from 'lucide-react'

type Side = 'buyer' | 'requester'

function LoginForm({
  side,
  onSuccess,
}: {
  side: Side
  onSuccess: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isBuyer = side === 'buyer'

  const accentColor = isBuyer
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-orange-500 hover:bg-orange-600'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('E-mail ou senha inválidos.')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Erro ao validar usuário.')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_type')
        .eq('id', user.id)
        .single()

      const profileType = profile?.profile_type ?? 'buyer'

      // Redirecionamento inteligente
      if (profileType === 'supplier') {
        await supabase.auth.signOut()
        setError('Use o Portal do Fornecedor para acessar.')
        return
      }

      if (profileType === 'requester' && side === 'buyer') {
        await supabase.auth.signOut()
        setError('Sua conta é de Solicitante. Use o lado direito para entrar.')
        return
      }

      if (profileType !== 'requester' && side === 'requester') {
        await supabase.auth.signOut()
        setError('Sua conta não é de Solicitante. Use o lado esquerdo para entrar.')
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
        /* não bloquear redirect */
      }

      onSuccess()
      window.location.href = profileType === 'requester' ? '/solicitante' : '/comprador'
    } catch {
      toast.error('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`email-${side}`} className="text-white/80 text-sm">
          E-mail
        </Label>
        <Input
          id={`email-${side}`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40
                     focus:border-white/50 focus:ring-white/20"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`password-${side}`} className="text-white/80 text-sm">
          Senha
        </Label>
        <Input
          id={`password-${side}`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40
                     focus:border-white/50 focus:ring-white/20"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className={`w-full text-white font-semibold ${accentColor}`}
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-white">
      {/* LADO ESQUERDO — Comprador */}
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <div
          className="w-full max-w-md space-y-8 rounded-2xl px-10 py-12 shadow-xl
                     bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800"
        >
          {/* Ícone + título */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15
                            flex items-center justify-center backdrop-blur-sm">
              <ShoppingCart className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Portal do Comprador</h2>
              <p className="text-sm text-blue-100 mt-1">
                Gestão de cotações, pedidos e fornecedores
              </p>
            </div>
          </div>

          <LoginForm side="buyer" onSuccess={() => {}} />

          <p className="text-center text-xs text-blue-200">
            Comprador · Gestor · Aprovador · Administrador
          </p>
        </div>
      </div>

      {/* DIVISOR */}
      <div className="hidden md:flex flex-col items-center justify-center w-px
                      bg-gradient-to-b from-transparent via-slate-300 to-transparent
                      relative">
        <div className="absolute bg-white rounded-full w-8 h-8 flex items-center
                        justify-center shadow-md z-10 border border-slate-200">
          <span className="text-xs font-bold text-gray-600">ou</span>
        </div>
      </div>

      {/* LADO DIREITO — Solicitante */}
      <div className="flex flex-1 items-center justify-center px-8 py-12">
        <div
          className="w-full max-w-md space-y-8 rounded-2xl px-10 py-12 shadow-xl
                     bg-gradient-to-br from-orange-500 via-orange-400 to-amber-500"
        >
          {/* Ícone + título */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15
                            flex items-center justify-center backdrop-blur-sm">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Portal do Solicitante</h2>
              <p className="text-sm text-orange-100 mt-1">
                Acompanhe suas requisições em tempo real
              </p>
            </div>
          </div>

          <LoginForm side="requester" onSuccess={() => {}} />

          <p className="text-center text-xs text-orange-100">
            Solicitante · Requisitante
          </p>
        </div>
      </div>
    </div>
  )
}

