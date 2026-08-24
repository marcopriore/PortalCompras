"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react"
import { toast } from "sonner"

import { outboundActionToPurchaseOrderOperation } from "@/lib/integrations/purchase-order-operations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { TablePagination } from "@/components/ui/table-pagination"
import type {
  InboundLogRow,
  IntegrationLogDirection,
  OutboundLogRow,
} from "@/lib/integrations/integration-logs-types"

type TenantOption = { id: string; name: string }

type IntegrationMonitorProps = {
  mode: "comprador" | "admin"
  tenants?: TenantOption[]
  /** Quando definido (admin), filtra logs apenas deste tenant e oculta o seletor. */
  fixedCompanyId?: string
  hideTitle?: boolean
}

type LogsResponse = {
  direction: IntegrationLogDirection
  page: number
  page_size: number
  total: number
  total_pages: number
  logs: Array<(InboundLogRow | OutboundLogRow) & { company_name?: string | null }>
}

function statusBadgeInbound(code: number | null) {
  if (code == null) return <Badge variant="secondary">—</Badge>
  if (code >= 200 && code < 300) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{code}</Badge>
  }
  if (code >= 400) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{code}</Badge>
  }
  return <Badge variant="secondary">{code}</Badge>
}

function statusBadgeOutbound(
  success: boolean,
  code: number | null,
  errorMessage?: string | null,
) {
  if (errorMessage === "Em andamento") {
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
        Em andamento
      </Badge>
    )
  }
  if (success) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        OK {code ?? ""}
      </Badge>
    )
  }
  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
      Falha {code ?? ""}
    </Badge>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  const text = React.useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [value])

  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
      {text}
    </pre>
  )
}

export function IntegrationMonitor({
  mode,
  tenants = [],
  fixedCompanyId,
  hideTitle = false,
}: IntegrationMonitorProps) {
  const [direction, setDirection] = React.useState<IntegrationLogDirection>("inbound")
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [successFilter, setSuccessFilter] = React.useState<string>("all")
  const [tenantFilter, setTenantFilter] = React.useState<string>(
    fixedCompanyId ?? "all",
  )
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<LogsResponse | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null)
  const [retryingLogId, setRetryingLogId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (fixedCompanyId) {
      setTenantFilter(fixedCompanyId)
    }
  }, [fixedCompanyId])

  const effectiveTenantFilter = fixedCompanyId ?? tenantFilter

  const apiBase =
    mode === "admin" ? "/api/admin/integration-logs" : "/api/comprador/integration-logs"

  const fetchLogs = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("direction", direction)
      params.set("page", String(page))
      if (search.trim()) params.set("search", search.trim())
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)
      if (direction === "outbound" && successFilter !== "all") {
        params.set("success", successFilter)
      }
      if (mode === "admin" && effectiveTenantFilter !== "all") {
        params.set("company_id", effectiveTenantFilter)
      }

      const res = await fetch(`${apiBase}?${params.toString()}`)
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errJson.error ?? `fetch failed (${res.status})`)
      }
      const json = (await res.json()) as LogsResponse
      setData(json)
      setFetchError(null)
    } catch (err) {
      setData(null)
      setFetchError(err instanceof Error ? err.message : "Falha ao carregar logs")
    } finally {
      setLoading(false)
    }
  }, [apiBase, direction, page, search, dateFrom, dateTo, successFilter, effectiveTenantFilter, mode])

  React.useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  React.useEffect(() => {
    setPage(1)
  }, [direction, search, dateFrom, dateTo, successFilter, effectiveTenantFilter])

  const openDetail = async (logId: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const params = new URLSearchParams()
      params.set("direction", direction)
      params.set("id", logId)
      if (mode === "admin" && effectiveTenantFilter !== "all") {
        params.set("company_id", effectiveTenantFilter)
      }
      const res = await fetch(`${apiBase}?${params.toString()}`)
      const json = (await res.json()) as { log?: Record<string, unknown> }
      setDetail(json.log ?? null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRetryIntegration = async (log: OutboundLogRow) => {
    if (!log.entity_id) return
    setRetryingLogId(log.id)
    try {
      const isPurchaseOrder = log.action.startsWith("purchase_order.")
      const isContract = log.action.startsWith("contract.")
      const poOperation = outboundActionToPurchaseOrderOperation(log.action)
      const res = await fetch(
        isPurchaseOrder
          ? `/api/purchase-orders/${log.entity_id}/erp-integration`
          : isContract
            ? `/api/contracts/${log.entity_id}/erp-integration`
            : "/api/integrations/outbound",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isPurchaseOrder
              ? { source: "monitor", operation: poOperation ?? "create" }
              : isContract
                ? { source: "monitor" }
                : { action: log.action, entity_id: log.entity_id, source: "monitor" },
          ),
        },
      )
      const json = (await res.json()) as {
        success?: boolean
        errorMessage?: string
        error?: string
      }
      if (!res.ok || json.success === false) {
        toast.error(json.errorMessage ?? json.error ?? "Falha ao reenviar integração.")
      } else {
        toast.success(`Integração reenviada para ${log.entity_code ?? "o registro"}.`)
      }
      await fetchLogs()
    } catch {
      toast.error("Não foi possível reenviar a integração.")
    } finally {
      setRetryingLogId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {!hideTitle && (
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monitor de Integração</h1>
            <p className="text-sm text-muted-foreground">
              Logs inbound (ERP → Valore) e outbound (Valore → ERP)
            </p>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchLogs()}
          disabled={loading}
          className={hideTitle ? "ml-auto" : undefined}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </Button>
      </div>

      <Tabs
        value={direction}
        onValueChange={(v) => setDirection(v as IntegrationLogDirection)}
      >
        <TabsList>
          <TabsTrigger value="inbound" className="gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Inbound
          </TabsTrigger>
          <TabsTrigger value="outbound" className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Outbound
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        {mode === "admin" && tenants.length > 0 && !fixedCompanyId && (
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={
              direction === "inbound" ? "Buscar path ou método…" : "Buscar action ou código…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Input
          type="date"
          className="w-[150px]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          className="w-[150px]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />

        {direction === "outbound" && (
          <Select value={successFilter} onValueChange={setSuccessFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Sucesso</SelectItem>
              <SelectItem value="false">Falha</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              {mode === "admin" && <TableHead>Tenant</TableHead>}
              {direction === "inbound" ? (
                <>
                  <TableHead>Método</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Action</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Tentativas</TableHead>
                </>
              )}
              <TableHead className="w-[180px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={mode === "admin" ? (direction === "outbound" ? 8 : 7) : direction === "outbound" ? 7 : 6}
                  className="py-10 text-center text-muted-foreground"
                >
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && fetchError && (
              <TableRow>
                <TableCell
                  colSpan={mode === "admin" ? (direction === "outbound" ? 8 : 7) : direction === "outbound" ? 7 : 6}
                  className="py-10 text-center text-destructive"
                >
                  {fetchError}
                </TableCell>
              </TableRow>
            )}
            {!loading && !fetchError && (data?.logs.length ?? 0) === 0 && (
              <TableRow>
                <TableCell
                  colSpan={mode === "admin" ? (direction === "outbound" ? 8 : 7) : direction === "outbound" ? 7 : 6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nenhum log encontrado.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.logs.map((log) => {
                const created = format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                  locale: ptBR,
                })

                if (log.direction === "inbound") {
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{created}</TableCell>
                      {mode === "admin" && (
                        <TableCell className="text-sm">
                          {log.company_name ?? log.company_id.slice(0, 8)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline">{log.method}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate font-mono text-xs">
                        {log.path}
                      </TableCell>
                      <TableCell>{statusBadgeInbound(log.status_code)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.duration_ms != null ? `${log.duration_ms} ms` : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => void openDetail(log.id)}>
                          Detalhe
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                }

                const outbound = log as OutboundLogRow & { company_name?: string | null }
                return (
                  <TableRow key={outbound.id}>
                    <TableCell className="text-xs whitespace-nowrap">{created}</TableCell>
                    {mode === "admin" && (
                      <TableCell className="text-sm">
                        {outbound.company_name ?? outbound.company_id.slice(0, 8)}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">{outbound.action}</TableCell>
                    <TableCell className="text-sm">
                      {outbound.entity_code ?? outbound.entity ?? "—"}
                    </TableCell>
                    <TableCell>
                      {statusBadgeOutbound(
                        outbound.success,
                        outbound.response_status,
                        outbound.error_message,
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">
                      {outbound.attempts}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {outbound.retry_eligible &&
                          outbound.error_message !== "Em andamento" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={retryingLogId === outbound.id}
                            onClick={() => void handleRetryIntegration(outbound)}
                          >
                            {retryingLogId === outbound.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-2 h-4 w-4" />
                            )}
                            Reenviar
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => void openDetail(log.id)}>
                          Detalhe
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={data?.page ?? page}
        total={data?.total ?? 0}
        pageSize={data?.page_size ?? 25}
        onPageChange={setPage}
        disabled={loading}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do log</DialogTitle>
          </DialogHeader>
          {detailLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!detailLoading && detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(detail)
                  .filter(([key]) => !["request_payload", "response_body"].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className={cn(key.includes("message") && "col-span-2")}>
                      <span className="text-muted-foreground">{key}: </span>
                      <span className="font-medium break-all">{String(value ?? "—")}</span>
                    </div>
                  ))}
              </div>
              {detail.request_payload != null && (
                <div>
                  <p className="mb-2 font-medium">Request payload</p>
                  <JsonBlock value={detail.request_payload} />
                </div>
              )}
              {detail.response_body != null && (
                <div>
                  <p className="mb-2 font-medium">Response body</p>
                  <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {String(detail.response_body)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
