'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
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
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  ShoppingCart,
  ClipboardList,
  Scale,
  BarChart2,
  Settings,
  ScrollText,
  Download,
} from 'lucide-react'
import { logAudit } from '@/lib/audit'

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
  roles?: string[] | null
  profile_type?: string | null
  status: string
  created_at: string
  updated_at: string
}

type PeriodFilter = '7d' | '30d' | '6m' | 'custom'

type Metrics = {
  quotations: number
  suppliers: number
  items: number
  purchaseOrders: number
  requisitions: number
}

type FeatureKey =
  | 'quotations'
  | 'equalization'
  | 'orders'
  | 'requisitions'
  | 'suppliers'
  | 'items'
  | 'reports'
  | 'users'
  | 'settings'
  | 'logs'

const FEATURES: Array<{
  key: FeatureKey
  label: string
  description: string
  icon:
    | 'FileText'
    | 'Scale'
    | 'ShoppingCart'
    | 'ClipboardList'
    | 'Building2'
    | 'Package'
    | 'BarChart2'
    | 'Users'
    | 'Settings'
    | 'ScrollText'
}> = [
  {
    key: 'quotations',
    label: 'Cotações',
    description: 'Criação e gestão de cotações de compra',
    icon: 'FileText',
  },
  {
    key: 'equalization',
    label: 'Equalização de Propostas',
    description: 'Comparativo e seleção de propostas dos fornecedores',
    icon: 'Scale',
  },
  {
    key: 'orders',
    label: 'Pedidos de Compra',
    description: 'Geração e acompanhamento de pedidos',
    icon: 'ShoppingCart',
  },
  {
    key: 'requisitions',
    label: 'Requisições',
    description: 'Criação e aprovação de requisições de compra',
    icon: 'ClipboardList',
  },
  {
    key: 'suppliers',
    label: 'Fornecedores',
    description: 'Base de fornecedores sincronizada via ERP',
    icon: 'Building2',
  },
  {
    key: 'items',
    label: 'Itens / Materiais',
    description: 'Catálogo de materiais sincronizado via ERP',
    icon: 'Package',
  },
  {
    key: 'reports',
    label: 'Relatórios',
    description: 'Análises e exportações de dados de compras',
    icon: 'BarChart2',
  },
  {
    key: 'users',
    label: 'Gestão de Usuários',
    description: 'Cadastro e controle de acesso de usuários',
    icon: 'Users',
  },
  {
    key: 'settings',
    label: 'Configurações',
    description: 'Configurações da empresa e preferências',
    icon: 'Settings',
  },
  {
    key: 'logs',
    label: 'Logs de Auditoria',
    description: 'Histórico de ações realizadas no sistema',
    icon: 'ScrollText',
  },
]

function getFeatureIcon(iconName: (typeof FEATURES)[number]['icon']) {
  const commonProps = { className: 'h-4 w-4' }
  if (iconName === 'FileText') return <FileText {...commonProps} />
  if (iconName === 'Scale') return <Scale {...commonProps} />
  if (iconName === 'ShoppingCart') return <ShoppingCart {...commonProps} />
  if (iconName === 'ClipboardList') return <ClipboardList {...commonProps} />
  if (iconName === 'Building2') return <Building2 {...commonProps} />
  if (iconName === 'Package') return <Package {...commonProps} />
  if (iconName === 'BarChart2') return <BarChart2 {...commonProps} />
  if (iconName === 'Users') return <Users {...commonProps} />
  if (iconName === 'Settings') return <Settings {...commonProps} />
  return <ScrollText {...commonProps} />
}

function buildDefaultFeaturesState(): Record<string, boolean> {
  const s: Record<string, boolean> = {}
  for (const f of FEATURES) {
    s[f.key] = true
  }
  return s
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

function getPeriodStart(period: PeriodFilter, customFrom: string): Date | null {
  const now = new Date()
  if (period === '7d') return new Date(now.setDate(now.getDate() - 7))
  if (period === '30d') return new Date(now.setDate(now.getDate() - 30))
  if (period === '6m') return new Date(now.setMonth(now.getMonth() - 6))
  if (period === 'custom' && customFrom) return new Date(customFrom)
  return null
}

const USERS_PAGE_SIZE = 10

type TenantDetailPageProps = {
  params: Promise<{ id: string }>
}

export default function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = React.use(params)
  const router = useRouter()
  const { userId, isSuperAdmin, loading: userLoading } = useUser()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    quotations: 0,
    suppliers: 0,
    items: 0,
    purchaseOrders: 0,
    requisitions: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    cnpj: '',
    status: 'active',
  })
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [customFrom, setCustomFrom] = useState<string>('')
  const [customTo, setCustomTo] = useState<string>('')
  const [featuresState, setFeaturesState] = useState<Record<string, boolean>>(
    buildDefaultFeaturesState,
  )
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [usersPage, setUsersPage] = useState(1)

  const totalUsers = profiles.length

  const userBreakdown = useMemo(() => {
    let buyers = 0
    let suppliers = 0
    let admins = 0
    let active = 0
    let inactive = 0
    for (const p of profiles) {
      if (p.profile_type === 'supplier') suppliers += 1
      else if (p.profile_type === 'buyer') buyers += 1
      const rolesArr = Array.isArray(p.roles) && p.roles.length > 0
        ? p.roles
        : p.role
          ? [p.role]
          : []
      if (rolesArr.includes('admin')) admins += 1
      if (p.status === 'active') active += 1
      else inactive += 1
    }
    return { buyers, suppliers, admins, active, inactive }
  }, [profiles])

  function profileRolesLabel(p: Profile): string {
    if (Array.isArray(p.roles) && p.roles.length > 0) {
      return p.roles.join(', ')
    }
    return p.role || '—'
  }

  const paginatedProfiles = useMemo(
    () =>
      profiles.slice(
        (usersPage - 1) * USERS_PAGE_SIZE,
        usersPage * USERS_PAGE_SIZE,
      ),
    [profiles, usersPage],
  )
  const usersTotalPages = Math.max(
    1,
    Math.ceil(profiles.length / USERS_PAGE_SIZE),
  )

  async function handleExportUsers() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Usuários')

    ws.columns = [
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Tipo de Perfil', key: 'tipo', width: 15 },
      { header: 'Perfil / Roles', key: 'roles', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Data de Cadastro', key: 'criado_em', width: 20 },
    ]

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F3EF5' },
    }

    for (const p of profiles) {
      ws.addRow({
        nome: p.full_name || 'Sem nome',
        id: p.id,
        tipo: p.profile_type === 'supplier' ? 'Fornecedor' : 'Comprador',
        roles: profileRolesLabel(p),
        status: p.status === 'active' ? 'Ativo' : 'Inativo',
        criado_em: format(new Date(p.created_at), 'dd/MM/yyyy', {
          locale: ptBR,
        }),
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usuarios_${tenant?.name ?? 'tenant'}_${format(new Date(), 'yyyyMMdd')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    setUsersPage(1)
  }, [profiles])

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const supabase = createClient()

      const [tenantRes, profilesRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', id).single(),
        supabase
          .from('profiles')
          .select('id, full_name, role, roles, profile_type, status, created_at')
          .eq('company_id', id)
          .order('created_at', { ascending: false }),
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

      setLoading(false)
    }

    fetchAll()
  }, [id])

  useEffect(() => {
    if (!id) return
    const fetchMetrics = async () => {
      const supabase = createClient()
      const periodStart = getPeriodStart(period, customFrom)
      const periodEnd =
        period === 'custom' && customTo ? new Date(customTo) : new Date()

      let quotationsQuery = supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', id)

      let suppliersQuery = supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', id)

      let itemsQuery = supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', id)

      let purchaseOrdersQuery = supabase
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id)
        .neq('status', 'draft')

      let requisitionsQuery = supabase
        .from('requisitions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', id)

      if (periodStart) {
        const isoStart = periodStart.toISOString()
        const isoEnd = periodEnd.toISOString()
        quotationsQuery = quotationsQuery
          .gte('created_at', isoStart)
          .lte('created_at', isoEnd)
        purchaseOrdersQuery = purchaseOrdersQuery
          .gte('created_at', isoStart)
          .lte('created_at', isoEnd)
        requisitionsQuery = requisitionsQuery
          .gte('created_at', isoStart)
          .lte('created_at', isoEnd)
        suppliersQuery = suppliersQuery
          .gte('created_at', isoStart)
          .lte('created_at', isoEnd)
        itemsQuery = itemsQuery
          .gte('created_at', isoStart)
          .lte('created_at', isoEnd)
      }

      const [quotationsRes, suppliersRes, itemsRes, purchaseOrdersRes, requisitionsRes] =
        await Promise.all([
          quotationsQuery,
          suppliersQuery,
          itemsQuery,
          purchaseOrdersQuery,
          requisitionsQuery,
        ])

      setMetrics((m) => ({
        ...m,
        quotations: quotationsRes.count ?? 0,
        suppliers: suppliersRes.count ?? 0,
        items: itemsRes.count ?? 0,
        purchaseOrders: purchaseOrdersRes.count ?? 0,
        requisitions: requisitionsRes.count ?? 0,
      }))
    }
    fetchMetrics()
  }, [id, period, customFrom, customTo])

  useEffect(() => {
    if (!id || !isSuperAdmin || userLoading) return

    const run = async () => {
      setFeaturesLoading(true)
      const supabase = createClient()
      const state: Record<string, boolean> = {}
      for (const f of FEATURES) {
        state[f.key] = true
      }
      const { data: featuresRes } = await supabase
        .from('tenant_features')
        .select('*')
        .eq('company_id', id)

      for (const row of featuresRes ?? []) {
        const r = row as { feature_key?: string; enabled?: boolean }
        if (!r.feature_key) continue
        if (state[r.feature_key] == null) continue
        state[r.feature_key] = Boolean(r.enabled)
      }

      setFeaturesState(state)
      setFeaturesLoading(false)
    }

    void run()
  }, [id, isSuperAdmin, userLoading])

  const handleToggle = async (key: FeatureKey, enabled: boolean) => {
    if (!id || !tenant) return

    const feature = FEATURES.find((f) => f.key === key)
    if (!feature) return

    const prev = featuresState[key]
    setFeaturesState((s) => ({ ...s, [key]: enabled }))

    try {
      const supabase = createClient()
      await supabase.from('tenant_features').upsert(
        { company_id: id, feature_key: key, enabled },
        { onConflict: 'company_id,feature_key' },
      )

      await logAudit({
        eventType: 'tenant.updated',
        description: `Módulo "${feature.label}" ${enabled ? 'habilitado' : 'desabilitado'} para ${tenant.name}`,
        companyId: id,
        userId,
        entity: 'tenant_features',
        entityId: id,
        metadata: { feature_key: key, enabled },
      })
    } catch {
      setFeaturesState((s) => ({ ...s, [key]: prev }))
    }
  }

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
      await logAudit({
        eventType: 'tenant.updated',
        description: `Tenant "${editForm.name}" atualizado`,
        companyId: tenant.id,
        entity: 'companies',
        entityId: tenant.id,
        metadata: { name: editForm.name, status: editForm.status },
      })
    }
    setSaving(false)
    setEditOpen(false)
  }

  const handleImpersonate = async () => {
    if (!tenant) return
    await logAudit({
      eventType: 'impersonation',
      description: `Superadmin acessou tenant "${tenant.name}"`,
      companyId: tenant.id,
      entity: 'companies',
      entityId: tenant.id,
      metadata: { tenantId: tenant.id, tenantName: tenant.name },
    })
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
        {(['overview', 'users'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? 'Visão Geral' : 'Usuários'}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* BLOCO 1: Dados do Tenant */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Dados do Tenant
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nome</p>
                <p className="text-sm font-medium text-foreground">
                  {tenant.name}
                </p>
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

          {/* BLOCO 2: Métricas de Uso */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                Métricas de Uso
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Período:</span>
                {(['7d', '30d', '6m', 'custom'] as PeriodFilter[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      period === p
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p === '7d'
                      ? '7 dias'
                      : p === '30d'
                        ? '30 dias'
                        : p === '6m'
                          ? '6 meses'
                          : 'Personalizado'}
                  </button>
                ))}
              </div>
            </div>

            {period === 'custom' && (
              <div className="flex gap-3 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    De
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="border border-border rounded-md px-2 py-1.5 text-sm bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Até
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="border border-border rounded-md px-2 py-1.5 text-sm bg-background text-foreground"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg p-3 flex items-center gap-3 border border-orange-100 bg-orange-50">
                <div className="rounded-full bg-orange-100 p-2">
                  <ClipboardList className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-orange-600 font-medium">
                    Requisições
                  </p>
                  <p className="text-xl font-bold text-orange-700">
                    {metrics.requisitions}
                  </p>
                </div>
              </div>

              <div className="rounded-lg p-3 flex items-center gap-3 border border-blue-100 bg-blue-50">
                <div className="rounded-full bg-blue-100 p-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Cotações</p>
                  <p className="text-xl font-bold text-blue-700">
                    {metrics.quotations}
                  </p>
                </div>
              </div>

              <div className="rounded-lg p-3 flex items-center gap-3 border border-purple-100 bg-purple-50">
                <div className="rounded-full bg-purple-100 p-2">
                  <ShoppingCart className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-purple-600 font-medium">Pedidos</p>
                  <p className="text-xl font-bold text-purple-700">
                    {metrics.purchaseOrders}
                  </p>
                </div>
              </div>

              <div className="rounded-lg p-3 flex items-center gap-3 border border-indigo-100 bg-indigo-50">
                <div className="rounded-full bg-indigo-100 p-2">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Itens</p>
                  <p className="text-xl font-bold text-indigo-700">
                    {metrics.items}
                  </p>
                </div>
              </div>

              <div className="rounded-lg p-3 flex items-center gap-3 border border-green-100 bg-green-50">
                <div className="rounded-full bg-green-100 p-2">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium">
                    Fornecedores
                  </p>
                  <p className="text-xl font-bold text-green-700">
                    {metrics.suppliers}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 3: Funcionalidades */}
          {isSuperAdmin && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Funcionalidades
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Módulos ativos para este tenant
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Object.values(featuresState).filter(Boolean).length} de{' '}
                  {FEATURES.length} ativos
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {FEATURES.map((feature) => {
                  const enabled = featuresState[feature.key] ?? true
                  return (
                    <div
                      key={feature.key}
                      className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${
                        enabled
                          ? 'border-border bg-card'
                          : 'border-border bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`rounded-lg p-2 flex-shrink-0 ${
                            enabled
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {getFeatureIcon(feature.icon)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {feature.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(val) =>
                                void handleToggle(feature.key, val)
                              }
                              disabled={featuresLoading}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {enabled ? 'Habilitado' : 'Desabilitado'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg p-3 flex items-center gap-3 border border-blue-100 bg-blue-50">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Total</p>
                    <p className="text-xl font-bold text-blue-700">
                      {totalUsers}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg p-3 flex items-center gap-3 border border-indigo-100 bg-indigo-50">
                  <div className="rounded-full bg-indigo-100 p-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs text-indigo-600 font-medium">
                      Compradores
                    </p>
                    <p className="text-xl font-bold text-indigo-700">
                      {userBreakdown.buyers}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg p-3 flex items-center gap-3 border border-purple-100 bg-purple-50">
                  <div className="rounded-full bg-purple-100 p-2">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-600 font-medium">
                      Fornecedores
                    </p>
                    <p className="text-xl font-bold text-purple-700">
                      {userBreakdown.suppliers}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg p-3 flex items-center gap-3 border border-orange-100 bg-orange-50">
                  <div className="rounded-full bg-orange-100 p-2">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600 font-medium">Admins</p>
                    <p className="text-xl font-bold text-orange-700">
                      {userBreakdown.admins}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg p-3 flex items-center gap-3 border border-green-100 bg-green-50">
                  <div className="rounded-full bg-green-100 p-2">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">Ativos</p>
                    <p className="text-xl font-bold text-green-700">
                      {userBreakdown.active}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {profiles.length} usuário
                  {profiles.length !== 1 ? 's' : ''} cadastrado
                  {profiles.length !== 1 ? 's' : ''}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExportUsers()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Excel
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="px-3 py-2">Usuário</TableHead>
                      <TableHead className="px-3 py-2">Tipo</TableHead>
                      <TableHead className="px-3 py-2">Perfil / Roles</TableHead>
                      <TableHead className="px-3 py-2">Status</TableHead>
                      <TableHead className="px-3 py-2">
                        Data de Cadastro
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProfiles.map((profile) => (
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
                          {profile.profile_type === 'supplier'
                            ? 'Fornecedor'
                            : 'Comprador'}
                        </TableCell>
                        <TableCell className="px-3 py-2 align-top text-sm text-foreground">
                          {profileRolesLabel(profile)}
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
                            {profile.status === 'active'
                              ? 'Ativo'
                              : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 align-top text-sm text-muted-foreground">
                          {format(
                            new Date(profile.created_at),
                            'dd/MM/yyyy',
                            { locale: ptBR },
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {usersTotalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Página {usersPage} de {usersTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPage === 1}
                      onClick={() => setUsersPage((p) => p - 1)}
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPage >= usersTotalPages}
                      onClick={() => setUsersPage((p) => p + 1)}
                    >
                      Próximo →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
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

