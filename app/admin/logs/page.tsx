'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollText } from 'lucide-react'

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

const PAGE_SIZE = 25

const AUDIT_EVENT_TYPE_VALUES = [
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
] as const

const AUDIT_EVENT_TYPES_FOR_FILTER = AUDIT_EVENT_TYPE_VALUES.map((value) => ({
  value,
  label: getEventMeta(value).label,
}))

export default function AdminLogsPage() {
  const [search, setSearch] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])

  const prevFiltersRef = useRef({
    search: '',
    userFilter: '',
    tenantFilter: '',
    eventTypeFilter: '',
    dateFrom: '',
    dateTo: '',
  })

  const fetchLogs = useCallback(async () => {
    const snapshot = {
      search,
      userFilter,
      tenantFilter,
      eventTypeFilter,
      dateFrom,
      dateTo,
    }
    const prev = prevFiltersRef.current
    const filtersChanged =
      prev.search !== snapshot.search ||
      prev.userFilter !== snapshot.userFilter ||
      prev.tenantFilter !== snapshot.tenantFilter ||
      prev.eventTypeFilter !== snapshot.eventTypeFilter ||
      prev.dateFrom !== snapshot.dateFrom ||
      prev.dateTo !== snapshot.dateTo

    if (filtersChanged) {
      prevFiltersRef.current = snapshot
      if (page !== 1) {
        setLoading(true)
        setPage(1)
        return
      }
    }

    setLoading(true)

    const supabase = createClient()
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('audit_logs')
      .select('*, companies(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (tenantFilter) query = query.eq('company_id', tenantFilter)
    if (eventTypeFilter) query = query.eq('event_type', eventTypeFilter)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`)

    if (userFilter.trim()) {
      query = query.ilike('user_name', `%${userFilter.trim()}%`)
    }

    if (search.trim()) {
      query = query.ilike('description', `%${search.trim()}%`)
    }

    const { data, count, error } = await query

    if (!error) {
      setLogs((data ?? []) as AuditLog[])
      setTotalCount(count ?? 0)
    }

    setLoading(false)
  }, [
    page,
    search,
    userFilter,
    tenantFilter,
    eventTypeFilter,
    dateFrom,
    dateTo,
  ])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    setPage(1)
  }, [search, userFilter, tenantFilter, eventTypeFilter, dateFrom, dateTo])

  useEffect(() => {
    async function fetchTenants() {
      const supabase = createClient()
      const { data } = await supabase.from('companies').select('id, name').order('name')
      setTenants(data ?? [])
    }
    void fetchTenants()
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Descrição</label>
          <Input
            placeholder="Buscar na descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Usuário</label>
          <Input
            placeholder="Nome do usuário..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Tenant</label>
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Tipo de Evento</label>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            {AUDIT_EVENT_TYPES_FOR_FILTER.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">
          {loading ? 'Carregando...' : `${totalCount} registro(s) encontrado(s)`}
        </span>
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={() => {
            setSearch('')
            setUserFilter('')
            setTenantFilter('')
            setEventTypeFilter('')
            setDateFrom('')
            setDateTo('')
            setPage(1)
          }}
        >
          Limpar filtros
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <ScrollText className="w-8 h-8 opacity-40" />
                    Nenhum registro encontrado.
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const meta = getEventMeta(log.event_type)
                const metaObj =
                  log.metadata != null &&
                  typeof log.metadata === 'object' &&
                  (Array.isArray(log.metadata)
                    ? log.metadata.length > 0
                    : Object.keys(log.metadata as Record<string, unknown>).length > 0)
                return (
                  <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
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
                    <TableCell className="text-sm text-foreground">{log.description}</TableCell>
                    <TableCell className="px-3 py-2 max-w-xs">
                      {metaObj ? (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-primary underline">Ver detalhes</summary>
                          <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > PAGE_SIZE ? (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próximo →
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
