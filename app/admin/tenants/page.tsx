'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    const supabase = createClient()
    const fetchTenants = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, cnpj, status, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar tenants:', error)
        toast.error('Erro ao carregar tenants.')
      } else {
        setTenants((data as Company[]) ?? [])
      }
      setLoading(false)
    }

    fetchTenants()
  }, [])

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const createTenant = async () => {
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as empresas (tenants) configuradas na plataforma.
          </p>
        </div>
        <Button type="button" onClick={() => setFormOpen(true)}>
          + Novo Tenant
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando tenants...</p>
      ) : tenants.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhum tenant cadastrado.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Nome</th>
              <th className="px-2 py-2 text-left">CNPJ</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Data Criação</th>
              <th className="px-2 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-border last:border-0">
                <td className="px-2 py-2 align-top">{tenant.name}</td>
                <td className="px-2 py-2 align-top">{tenant.cnpj || '-'}</td>
                <td className="px-2 py-2 align-top">
                  <Badge variant={tenant.status === 'active' ? 'default' : 'outline'}>
                    {tenant.status === 'active' ? 'Ativo' : tenant.status}
                  </Badge>
                </td>
                <td className="px-2 py-2 align-top">
                  {tenant.created_at
                    ? new Date(tenant.created_at).toLocaleDateString('pt-BR')
                    : '-'}
                </td>
                <td className="px-2 py-2 align-top text-right">
                  <Button type="button" variant="outline" size="sm">
                    Acessar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full max-w-md sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Novo Tenant</SheetTitle>
            <SheetDescription>
              Cadastre uma nova empresa e o usuário administrador responsável pelo acesso.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
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
                value={form.cnpj}
                onChange={(e) => handleChange('cnpj', e.target.value)}
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

          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={createTenant} disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar Tenant'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

