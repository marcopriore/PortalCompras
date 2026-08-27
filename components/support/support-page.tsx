"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Headphones, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { TableRowActions } from "@/components/ui/table-row-actions"
import { Eye } from "lucide-react"
import type {
  AxisDeskAnexo,
  AxisDeskChamado,
  AxisDeskChamadoAcao,
  AxisDeskChamadoPrioridade,
  AxisDeskChamadoStatus,
  AxisDeskChamadoTipo,
} from "@/lib/axisdesk/types"
import {
  AXISDESK_PRIORIDADE_OPTIONS,
  AXISDESK_STATUS_OPTIONS,
  AXISDESK_TIPO_OPTIONS,
  getAxisDeskPrioridadeLabel,
  getAxisDeskStatusLabel,
  getAxisDeskStatusVariant,
} from "@/lib/axisdesk/types"

type SupportPageProps = {
  portal: "comprador" | "solicitante"
}

type CreateFormState = {
  tipo: AxisDeskChamadoTipo
  titulo: string
  descricao: string
  prioridade: AxisDeskChamadoPrioridade
  anexo: File | null
}

const INITIAL_CREATE_FORM: CreateFormState = {
  tipo: "incidente",
  titulo: "",
  descricao: "",
  prioridade: "media",
  anexo: null,
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR })
}

async function fileToAnexo(file: File): Promise<AxisDeskAnexo> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler arquivo."))
        return
      }
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."))
    reader.readAsDataURL(file)
  })

  return {
    nome_arquivo: file.name,
    tipo_mime: file.type || "application/octet-stream",
    conteudo_base64: base64,
  }
}

function getAvailableActions(
  status: AxisDeskChamadoStatus,
): { acao: AxisDeskChamadoAcao; label: string; destructive?: boolean }[] {
  switch (status) {
    case "pendente_usuario":
      return [
        { acao: "usuario_respondeu", label: "Responder" },
        { acao: "usuario_cancelou", label: "Cancelar chamado", destructive: true },
      ]
    case "validacao_usuario":
      return [
        { acao: "usuario_aprovou", label: "Aprovar solução" },
        { acao: "usuario_reprovou", label: "Reprovar solução", destructive: true },
      ]
    default:
      return []
  }
}

export function SupportPage({ portal }: SupportPageProps) {
  const [tickets, setTickets] = React.useState<AxisDeskChamado[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] =
    React.useState<CreateFormState>(INITIAL_CREATE_FORM)
  const [creating, setCreating] = React.useState(false)

  const [detailTicket, setDetailTicket] = React.useState<AxisDeskChamado | null>(
    null,
  )
  const [actionMessage, setActionMessage] = React.useState("")
  const [actionAnexo, setActionAnexo] = React.useState<File | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [pendingAction, setPendingAction] =
    React.useState<AxisDeskChamadoAcao | null>(null)

  const loadTickets = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch("/api/support/tickets", { cache: "no-store" })
      const payload = (await res.json()) as {
        data?: AxisDeskChamado[]
        error?: string
      }
      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao carregar chamados.")
        setTickets([])
        return
      }
      setTickets(payload.data ?? [])
    } catch {
      toast.error("Erro ao carregar chamados.")
      setTickets([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  const filteredTickets = React.useMemo(() => {
    if (statusFilter.length === 0) return tickets
    return tickets.filter((t) => statusFilter.includes(t.status))
  }, [tickets, statusFilter])

  const resetCreateForm = () => {
    setCreateForm(INITIAL_CREATE_FORM)
  }

  const handleCreate = async () => {
    if (!createForm.titulo.trim()) {
      toast.error("Informe o título do chamado.")
      return
    }
    if (!createForm.descricao.trim()) {
      toast.error("Informe a descrição do chamado.")
      return
    }

    setCreating(true)
    try {
      let anexos: AxisDeskAnexo[] | undefined
      if (createForm.anexo) {
        anexos = [await fileToAnexo(createForm.anexo)]
      }

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: createForm.tipo,
          titulo: createForm.titulo.trim(),
          descricao: createForm.descricao.trim(),
          prioridade: createForm.prioridade,
          contexto_origem: `Portal ${portal === "comprador" ? "Comprador" : "Solicitante"}`,
          ...(anexos ? { anexos } : {}),
        }),
      })

      const payload = (await res.json()) as {
        data?: AxisDeskChamado
        error?: string
      }

      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao criar chamado.")
        return
      }

      toast.success("Chamado criado com sucesso.")
      setCreateOpen(false)
      resetCreateForm()
      await loadTickets(true)
      if (payload.data) setDetailTicket(payload.data)
    } catch {
      toast.error("Erro ao criar chamado.")
    } finally {
      setCreating(false)
    }
  }

  const handleExecuteAction = async (acao: AxisDeskChamadoAcao) => {
    if (!detailTicket) return

    if (acao === "usuario_reprovou" && !actionMessage.trim()) {
      toast.error("Informe o motivo da reprovação.")
      return
    }

    if (acao === "usuario_respondeu" && !actionMessage.trim() && !actionAnexo) {
      toast.error("Informe uma mensagem ou anexe um arquivo.")
      return
    }

    setActionLoading(true)
    setPendingAction(acao)
    try {
      let anexos: AxisDeskAnexo[] | undefined
      if (actionAnexo) {
        anexos = [await fileToAnexo(actionAnexo)]
      }

      const res = await fetch(
        `/api/support/tickets/${detailTicket.id}/acoes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao,
            ...(actionMessage.trim() ? { mensagem: actionMessage.trim() } : {}),
            ...(anexos ? { anexos } : {}),
          }),
        },
      )

      const payload = (await res.json()) as {
        data?: AxisDeskChamado
        error?: string
      }

      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao executar ação.")
        return
      }

      toast.success("Ação registrada com sucesso.")
      setActionMessage("")
      setActionAnexo(null)
      if (payload.data) {
        setDetailTicket(payload.data)
      }
      await loadTickets(true)
    } catch {
      toast.error("Erro ao executar ação.")
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  const openDetail = (ticket: AxisDeskChamado) => {
    setDetailTicket(ticket)
    setActionMessage("")
    setActionAnexo(null)
    setPendingAction(null)
  }

  const closeDetail = () => {
    setDetailTicket(null)
    setActionMessage("")
    setActionAnexo(null)
    setPendingAction(null)
  }

  const detailActions = detailTicket
    ? getAvailableActions(detailTicket.status)
    : []

  const showActionForm =
    detailActions.some((a) => a.acao === "usuario_respondeu") ||
    detailActions.some((a) => a.acao === "usuario_reprovou")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            Suporte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abra e acompanhe chamados com a equipe AxisStrategy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadTickets(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo chamado
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chamados do tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <MultiSelectFilter
              label="Status"
              width="w-48"
              options={AXISDESK_STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando chamados…
                    </TableCell>
                  </TableRow>
                ) : filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum chamado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium max-w-[240px] truncate">
                        {ticket.titulo}
                      </TableCell>
                      <TableCell className="capitalize">
                        {AXISDESK_TIPO_OPTIONS.find((o) => o.value === ticket.tipo)
                          ?.label ?? ticket.tipo}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={getAxisDeskStatusVariant(ticket.status)}>
                          {getAxisDeskStatusLabel(ticket.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {getAxisDeskPrioridadeLabel(ticket.prioridade)}
                      </TableCell>
                      <TableCell>{formatDateTime(ticket.sla_prazo)}</TableCell>
                      <TableCell>{formatDateTime(ticket.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <TableRowActions
                          actions={[
                            {
                              label: "Ver Detalhes",
                              icon: Eye,
                              onClick: () => openDetail(ticket),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={createForm.tipo}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    tipo: v as AxisDeskChamadoTipo,
                  }))
                }
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXISDESK_TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={createForm.titulo}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, titulo: e.target.value }))
                }
                placeholder="Resumo do problema ou solicitação"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={createForm.descricao}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, descricao: e.target.value }))
                }
                rows={4}
                placeholder="Descreva com o máximo de detalhes possível"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={createForm.prioridade}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    prioridade: v as AxisDeskChamadoPrioridade,
                  }))
                }
              >
                <SelectTrigger id="prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXISDESK_PRIORIDADE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anexo">Anexo (opcional)</Label>
              <Input
                id="anexo"
                type="file"
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    anexo: e.target.files?.[0] ?? null,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? "Enviando…" : "Criar chamado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailTicket)} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailTicket && (
            <>
              <DialogHeader>
                <DialogTitle>{detailTicket.titulo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge variant={getAxisDeskStatusVariant(detailTicket.status)}>
                    {getAxisDeskStatusLabel(detailTicket.status)}
                  </StatusBadge>
                  <StatusBadge variant="muted">
                    {getAxisDeskPrioridadeLabel(detailTicket.prioridade)}
                  </StatusBadge>
                  <StatusBadge variant="info">
                    {AXISDESK_TIPO_OPTIONS.find((o) => o.value === detailTicket.tipo)
                      ?.label ?? detailTicket.tipo}
                  </StatusBadge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Criado em: </span>
                    {formatDateTime(detailTicket.created_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">SLA: </span>
                    {formatDateTime(detailTicket.sla_prazo)}
                  </div>
                  {detailTicket.solicitante && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Solicitante: </span>
                      {detailTicket.solicitante.nome} ({detailTicket.solicitante.email})
                    </div>
                  )}
                  {detailTicket.contexto_origem && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Origem: </span>
                      {detailTicket.contexto_origem}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3">
                    {detailTicket.descricao}
                  </p>
                </div>

                {showActionForm && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <Label htmlFor="action-message">
                      {detailActions.some((a) => a.acao === "usuario_reprovou")
                        ? "Mensagem / motivo"
                        : "Mensagem (opcional)"}
                    </Label>
                    <Textarea
                      id="action-message"
                      value={actionMessage}
                      onChange={(e) => setActionMessage(e.target.value)}
                      rows={3}
                      placeholder={
                        detailTicket.status === "validacao_usuario"
                          ? "Descreva o motivo se for reprovar a solução"
                          : "Informações adicionais para a equipe de suporte"
                      }
                    />
                    {detailActions.some((a) => a.acao === "usuario_respondeu") && (
                      <div className="space-y-2">
                        <Label htmlFor="action-anexo">Anexo (opcional)</Label>
                        <Input
                          id="action-anexo"
                          type="file"
                          onChange={(e) =>
                            setActionAnexo(e.target.files?.[0] ?? null)
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {detailActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    {detailActions.map((action) => (
                      <Button
                        key={action.acao}
                        type="button"
                        variant={action.destructive ? "destructive" : "default"}
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => void handleExecuteAction(action.acao)}
                      >
                        {actionLoading && pendingAction === action.acao
                          ? "Processando…"
                          : action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
