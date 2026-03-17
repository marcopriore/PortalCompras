'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, CheckCircle2, Users, Eye, LogIn, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Company = {
  id: string
  name: string
  cnpj: string | null
  status: string
  created_at: string
}

const initialForm = {
  name: '',
  cnpj: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
}

const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0284c7',
] as const

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function AdminTenantsPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [totalUsers, setTotalUsers] = useState<number>(0)

  useEffect(() => {
    const supabase = createClient()
    const fetchData = async () => {
      setLoading(true)
      const [{ data, error }, { count, error: usersError }] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, cnpj, status, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ])

      if (error) {
        console.error('Erro ao buscar tenants:', error)
        toast.error('Erro ao carregar tenants.')
      } else {
        setTenants((data as Company[]) ?? [])
      }

      if (usersError) {
        console.error('Erro ao contar usuários:', usersError)
      } else if (typeof count === 'number') {
        setTotalUsers(count)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const createTenant = async () => {
    if (
      !form.name.trim() ||
      !form.adminName.trim() ||
      !form.adminEmail.trim() ||
      !form.adminPassword.trim()
    ) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }

    if (form.adminPassword.length < 8) {
      toast.error('A senha do admin deve ter pelo menos 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: form.name,
          cnpj: form.cnpj || null,
          status: 'active',
        })
        .select('id, name, cnpj, status, created_at')
        .single()

      if (companyError || !company) {
        console.error('Erro ao criar company:', companyError)
        toast.error('Erro ao criar tenant.')
        setSubmitting(false)
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        toast.error('Configuração do Supabase ausente (service role).')
        setSubmitting(false)
        return
      }

      // TODO: mover o uso da service_role key para um ambiente apenas server-side em produção.
      const adminUsersUrl = `${supabaseUrl}/auth/v1/admin/users`

      const response = await fetch(adminUsersUrl, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.adminEmail,
          password: form.adminPassword,
          email_confirm: true,
          user_metadata: {
            full_name: form.adminName,
            company_id: company.id,
          },
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        console.error('Erro ao criar usuário admin:', errorBody)
        toast.error(errorBody?.message || 'Erro ao criar usuário admin.')
        setSubmitting(false)
        return
      }

      setTenants((prev) => [company as Company, ...prev])
      setForm(initialForm)
      setFormOpen(false)
      toast.success('Tenant criado com sucesso!')
    } catch (err) {
      console.error('Erro inesperado ao criar tenant:', err)
      toast.error('Erro inesperado ao criar tenant.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleImpersonate = (tenantId: string) => {
    document.cookie = `selected_company_id=${tenantId}; path=/; max-age=86400`
    router.push('/comprador')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cards de métricas */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl p-5 flex items-center gap-4 border border-blue-100 bg-blue-50">
          <div className="rounded-full bg-blue-100 p-3 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total de Tenants</p>
            <p className="text-3xl font-bold text-blue-700">{tenants.length}</p>
          </div>
        </div>
        <div className="rounded-xl p-5 flex items-center gap-4 border border-green-100 bg-green-50">
          <div className="rounded-full bg-green-100 p-3 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Tenants Ativos</p>
            <p className="text-3xl font-bold text-green-700">
              {tenants.filter((t) => t.status === 'active').length}
            </p>
          </div>
        </div>
        <div className="rounded-xl p-5 flex items-center gap-4 border border-purple-100 bg-purple-50">
          <div className="rounded-full bg-purple-100 p-3 flex items-center justify-center">
            <Users className="w-7 h-7 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-purple-600 font-medium">Total de Usuários</p>
            <p className="text-3xl font-bold text-purple-700">{totalUsers}</p>
          </div>
        </div>
      </div>

      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Lista de Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Empresas cadastradas na plataforma
          </p>
        </div>
        <Button type="button" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tenant
        </Button>
      </div>

      {/* Tabela */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando tenants...</p>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum tenant cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-3 py-2">Empresa</TableHead>
                <TableHead className="px-3 py-2">Status</TableHead>
                <TableHead className="px-3 py-2">Data de Criação</TableHead>
                <TableHead className="px-3 py-2 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="border-border hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="px-3 py-2 align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(tenant.name) }}
                      >
                        {getInitials(tenant.name)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.cnpj || '-'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <Badge
                      variant={tenant.status === 'active' ? 'outline' : 'destructive'}
                      className={
                        tenant.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : undefined
                      }
                    >
                      {tenant.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-sm text-muted-foreground">
                    {tenant.created_at
                      ? format(new Date(tenant.created_at), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })
                      : '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleImpersonate(tenant.id)}
                      >
                        <LogIn className="mr-1 h-4 w-4" />
                        Acessar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog Novo Tenant */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Novo Tenant</DialogTitle>
            <DialogDescription>
              Cadastre uma nova empresa e o usuário administrador responsável pelo acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0001-00"
                value={form.cnpj}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cnpj: maskCNPJ(e.target.value) }))
                }
                maxLength={18}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminName">Nome do Admin *</Label>
              <Input
                id="adminName"
                value={form.adminName}
                onChange={(e) => handleChange('adminName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminEmail">Email do Admin *</Label>
              <Input
                id="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={(e) => handleChange('adminEmail', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminPassword">Senha do Admin *</Label>
              <Input
                id="adminPassword"
                type="password"
                value={form.adminPassword}
                onChange={(e) => handleChange('adminPassword', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo de 8 caracteres.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              onClick={createTenant}
              disabled={submitting}
            >
              {submitting ? 'Criando...' : 'Criar Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

