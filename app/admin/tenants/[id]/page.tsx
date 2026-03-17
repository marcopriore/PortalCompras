'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChevronLeft,
  Pencil,
  LogIn,
  FileText,
  Building2,
  Package,
  Users,
} from 'lucide-react'

type Tenant = {
  id: string
  name: string
  cnpj: string | null
  status: string
  created_at: string
}

type Profile = {
  id: string
  full_name: string
  role: string
  status: string
  created_at: string
}

type Metrics = {
  quotations: number
  suppliers: number
  items: number
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

type TenantDetailPageProps = {
  params: Promise<{ id: string }>
}

export default function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = React.use(params)
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    quotations: 0,
    suppliers: 0,
    items: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'users' | 'metrics'>(
    'details',
  )
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    cnpj: '',
    status: 'active',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const supabase = createClient()

      const [tenantRes, profilesRes, quotationsRes, suppliersRes, itemsRes] =
        await Promise.all([
          supabase.from('companies').select('*').eq('id', id).single(),
          supabase
            .from('profiles')
            .select('id, full_name, role, status, created_at')
            .eq('company_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('quotations')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', id),
          supabase
            .from('suppliers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', id),
          supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', id),
        ])

      if (tenantRes.data) {
        setTenant(tenantRes.data as Tenant)
        setEditForm({
          name: (tenantRes.data as Tenant).name,
          cnpj: (tenantRes.data as Tenant).cnpj || '',
          status: (tenantRes.data as Tenant).status,
        })
      }

      if (profilesRes.data) {
        setProfiles(profilesRes.data as Profile[])
      }

      setMetrics({
        quotations: quotationsRes.count ?? 0,
        suppliers: suppliersRes.count ?? 0,
        items: itemsRes.count ?? 0,
      })

      setLoading(false)
    }

    fetchAll()
  }, [id])

  const handleSave = async () => {
    if (!tenant) return
    setSaving(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('companies')
      .update({
        name: editForm.name,
        cnpj: editForm.cnpj || null,
        status: editForm.status,
      })
      .eq('id', tenant.id)
      .select()
      .single()

    if (data) {
      setTenant(data as Tenant)
    }
    setSaving(false)
    setEditOpen(false)
  }

  const handleImpersonate = () => {
    if (!tenant) return
    document.cookie = `selected_company_id=${tenant.id}; path=/; max-age=86400`
    router.push('/comprador')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/tenants')}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Tenant não encontrado.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/tenants')}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{tenant.name}</h1>
            <p className="text-sm text-muted-foreground">
              {tenant.cnpj || 'CNPJ não informado'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            Editar
          </Button>
          <Button size="sm" onClick={handleImpersonate}>
            <LogIn className="w-4 h-4 mr-1.5" />
            Acessar
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-border mb-4">
        {(['details', 'users', 'metrics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'details'
              ? 'Detalhes'
              : tab === 'users'
              ? 'Usuários'
              : 'Métricas'}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {activeTab === 'details' && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4">
            Informações da Empresa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nome</p>
              <p className="text-sm font-medium text-foreground">{tenant.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">CNPJ</p>
              <p className="text-sm font-medium text-foreground">
                {tenant.cnpj || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge
                variant={
                  tenant.status === 'active' ? 'outline' : 'destructive'
                }
                className={
                  tenant.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : undefined
                }
              >
                {tenant.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Data de Criação
              </p>
              <p className="text-sm font-medium text-foreground">
                {format(new Date(tenant.created_at), 'dd/MM/yyyy', {
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-sm text-muted-foreground">
              <Users className="w-8 h-8 mb-2" />
              Nenhum usuário cadastrado neste tenant.
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="px-3 py-2">Usuário</TableHead>
                    <TableHead className="px-3 py-2">Perfil</TableHead>
                    <TableHead className="px-3 py-2">Status</TableHead>
                    <TableHead className="px-3 py-2">Data de Cadastro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow
                      key={profile.id}
                      className="border-border hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="px-3 py-2 align-top">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{
                              backgroundColor: getAvatarColor(
                                profile.full_name || 'Usuário',
                              ),
                            }}
                          >
                            {getInitials(profile.full_name || 'Usuário')}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {profile.full_name || 'Usuário sem nome'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {profile.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 align-top text-sm text-foreground">
                        {profile.role}
                      </TableCell>
                      <TableCell className="px-3 py-2 align-top">
                        <Badge
                          variant={
                            profile.status === 'active'
                              ? 'outline'
                              : 'destructive'
                          }
                          className={
                            profile.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : undefined
                          }
                        >
                          {profile.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 align-top text-sm text-muted-foreground">
                        {format(new Date(profile.created_at), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl p-5 flex items-center gap-4 border border-blue-100 bg-blue-50">
            <div className="rounded-full bg-blue-100 p-3 flex items-center justify-center">
              <FileText className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">
                Total de Cotações
              </p>
              <p className="text-3xl font-bold text-blue-700">
                {metrics.quotations}
              </p>
            </div>
          </div>
          <div className="rounded-xl p-5 flex items-center gap-4 border border-green-100 bg-green-50">
            <div className="rounded-full bg-green-100 p-3 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600 font-medium">
                Fornecedores Cadastrados
              </p>
              <p className="text-3xl font-bold text-green-700">
                {metrics.suppliers}
              </p>
            </div>
          </div>
          <div className="rounded-xl p-5 flex items-center gap-4 border border-purple-100 bg-purple-50">
            <div className="rounded-full bg-purple-100 p-3 flex items-center justify-center">
              <Package className="w-7 h-7 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-600 font-medium">
                Itens Cadastrados
              </p>
              <p className="text-3xl font-bold text-purple-700">
                {metrics.items}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Editar Tenant</DialogTitle>
            <DialogDescription>
              Atualize os dados da empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome da Empresa *</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                placeholder="00.000.000/0001-00"
                value={editForm.cnpj}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    cnpj: maskCNPJ(e.target.value),
                  }))
                }
                maxLength={18}
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, status: e.target.value }))
                }
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

