'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, ScrollText } from 'lucide-react'

type AuditLog = {
  id: string
  company_id: string | null
  user_name: string | null
  event_type: string
  entity: string | null
  entity_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  companies?: { name: string } | null
}

type TenantOption = {
  id: string
  name: string
}

function getEventMeta(eventType: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    'user.login': {
      label: 'Login',
      className: 'bg-blue-100 text-blue-800',
    },
    'user.logout': {
      label: 'Logout',
      className: 'bg-gray-100 text-gray-700',
    },
    'user.created': {
      label: 'Usuário criado',
      className: 'bg-green-100 text-green-800',
    },
    'user.updated': {
      label: 'Usuário editado',
      className: 'bg-yellow-100 text-yellow-800',
    },
    'tenant.created': {
      label: 'Tenant criado',
      className: 'bg-purple-100 text-purple-800',
    },
    'tenant.updated': {
      label: 'Tenant editado',
      className: 'bg-purple-100 text-purple-800',
    },
    'quotation.created': {
      label: 'Cotação criada',
      className: 'bg-blue-100 text-blue-800',
    },
    'quotation.updated': {
      label: 'Cotação editada',
      className: 'bg-yellow-100 text-yellow-800',
    },
    'quotation.cancelled': {
      label: 'Cotação cancelada',
      className: 'bg-red-100 text-red-800',
    },
    impersonation: {
      label: 'Impersonation',
      className: 'bg-orange-100 text-orange-800',
    },
    'integration.items': {
      label: 'Sync Itens',
      className: 'bg-teal-100 text-teal-800',
    },
    'integration.suppliers': {
      label: 'Sync Fornecedores',
      className: 'bg-teal-100 text-teal-800',
    },
    'integration.outbound': {
      label: 'Integração saída',
      className: 'bg-indigo-100 text-indigo-800',
    },
    'supplier.login': {
      label: 'Login Fornecedor',
      className: 'bg-sky-100 text-sky-800',
    },
    'supplier.logout': {
      label: 'Logout Fornecedor',
      className: 'bg-slate-100 text-slate-700',
    },
    'proposal.saved': {
      label: 'Proposta Salva',
      className: 'bg-amber-100 text-amber-800',
    },
    'proposal.submitted': {
      label: 'Proposta Enviada',
      className: 'bg-emerald-100 text-emerald-800',
    },
    'proposal.imported': {
      label: 'Proposta Importada',
      className: 'bg-cyan-100 text-cyan-800',
    },
    'purchase_order.accepted': {
      label: 'Pedido Aceito',
      className: 'bg-green-100 text-green-800',
    },
    'purchase_order.refused': {
      label: 'Pedido Recusado',
      className: 'bg-red-100 text-red-800',
    },
    'purchase_order.delivery_updated': {
      label: 'Entrega Atualizada',
      className: 'bg-violet-100 text-violet-800',
    },
  }

  return (
    map[eventType] ?? {
      label: eventType,
      className: 'bg-gray-100 text-gray-700',
    }
  )
}

const PAGE_SIZE = 20

/** Garante opções no filtro mesmo antes de existir log desse tipo. */
const AUDIT_EVENT_TYPES_FOR_FILTER: string[] = [
  'user.login',
  'user.logout',
  'user.created',
  'user.updated',
  'tenant.created',
  'tenant.updated',
  'quotation.created',
  'quotation.updated',
  'quotation.cancelled',
  'impersonation',
  'integration.items',
  'integration.suppliers',
  'integration.outbound',
  'supplier.login',
  'supplier.logout',
  'proposal.saved',
  'proposal.submitted',
  'proposal.imported',
  'purchase_order.accepted',
  'purchase_order.refused',
  'purchase_order.delivery_updated',
]

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [tenantFilter, setTenantFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      const supabase = createClient()

      const [logsRes, tenantsRes] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*, companies(name)')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('companies').select('id, name').order('name'),
      ])

      if (logsRes.data) setLogs(logsRes.data as AuditLog[])
      if (tenantsRes.data) setTenants(tenantsRes.data as TenantOption[])
      setLoading(false)
    }
    fetchLogs()
  }, [])

  const eventTypes = Array.from(
    new Set([...AUDIT_EVENT_TYPES_FOR_FILTER, ...logs.map((l) => l.event_type)]),
  ).sort()

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      !search ||
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      (log.user_name ?? '').toLowerCase().includes(search.toLowerCase())

    const matchEvent =
      eventTypeFilter === 'all' || log.event_type === eventTypeFilter

    const matchTenant =
      tenantFilter === 'all' || log.company_id === tenantFilter

    const matchUser =
      !userFilter ||
      (log.user_name ?? '')
        .toLowerCase()
        .includes(userFilter.toLowerCase())

    const matchDateFrom =
      !dateFrom || new Date(log.created_at) >= new Date(dateFrom)

    const matchDateTo =
      !dateTo ||
      new Date(log.created_at) <= new Date(`${dateTo}T23:59:59`)

    return (
      matchSearch &&
      matchEvent &&
      matchTenant &&
      matchUser &&
      matchDateFrom &&
      matchDateTo
    )
  })

  useEffect(() => {
    setPage(1)
  }, [search, eventTypeFilter, tenantFilter, userFilter, dateFrom, dateTo])

  const paginatedLogs = useMemo(
    () => filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredLogs, page],
  )

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))

  const hasActiveFilters =
    !!search ||
    eventTypeFilter !== 'all' ||
    tenantFilter !== 'all' ||
    !!userFilter ||
    !!dateFrom ||
    !!dateTo

  const handleClearFilters = () => {
    setSearch('')
    setEventTypeFilter('all')
    setTenantFilter('all')
    setUserFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-foreground">Logs do Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Auditoria de todas as ações realizadas na plataforma.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Busca por texto */}
          <div className="flex flex-col">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Buscar
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição ou usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Filtro por tenant */}
          <div className="flex flex-col">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Tenant
            </p>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            >
              <option value="all">Todos os Tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por tipo de evento */}
          <div className="flex flex-col">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Tipo de Evento
            </p>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            >
              <option value="all">Todos os Eventos</option>
              {eventTypes.map((e) => (
                <option key={e} value={e}>
                  {getEventMeta(e).label}
                </option>
              ))}
            </select>
          </div>

          {/* Data de */}
          <div className="flex flex-col">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              De
            </p>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            />
          </div>

          {/* Data até */}
          <div className="flex flex-col">
            <p className="text-xs font-medium text-muted-foreground mb-1 block">
              Até
            </p>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Contagem + limpar filtros */}
      <div className="flex items-center justify-between mb-3">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''}
        </Badge>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela / estados */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ScrollText className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum log encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log) => {
                const meta = getEventMeta(log.event_type)
                return (
                  <TableRow
                    key={log.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.companies?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {log.user_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {log.description}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!loading && filteredLogs.length > 0 ? (
        <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-foreground hover:underline disabled:opacity-40 disabled:pointer-events-none disabled:no-underline"
          >
            ← Anterior
          </button>
          <span>
            Página {page} de {totalPages} · {filteredLogs.length} registro
            {filteredLogs.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="text-foreground hover:underline disabled:opacity-40 disabled:pointer-events-none disabled:no-underline"
          >
            Próximo →
          </button>
        </div>
      ) : null}
    </div>
  )
}

