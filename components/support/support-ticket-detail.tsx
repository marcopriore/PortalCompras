"use client"

import * as React from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowLeft,
  ChevronRight,
  History,
  MessageSquare,
  Paperclip,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/ui/status-badge"
import { Textarea } from "@/components/ui/textarea"
import { AttachmentFileList } from "@/components/support/attachment-file-list"
import { CharacterCounter } from "@/components/support/character-counter"
import type {
  AxisDeskAnexo,
  AxisDeskChamadoAcao,
  AxisDeskChamadoDetalhe,
  AxisDeskChamadoStatus,
} from "@/lib/axisdesk/types"
import {
  AXISDESK_MAX_TEXTO,
  filesToAnexos,
  mergeSelectedFiles,
  removeSelectedFile,
} from "@/lib/axisdesk/support-form"
import {
  AXISDESK_TIPO_OPTIONS,
  buildAxisDeskActivityFeed,
  formatAxisDeskFileSize,
  formatHistoricoValue,
  getAxisDeskPrioridadeLabel,
  getAxisDeskStatusLabel,
  getAxisDeskStatusVariant,
  getHistoricoEntryDate,
} from "@/lib/axisdesk/types"

type SupportTicketDetailProps = {
  ticketId: string
  portal: "comprador" | "solicitante"
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR })
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
    case "reprovado":
      return [
        { acao: "usuario_reenviou", label: "Reenviar chamado" },
        { acao: "usuario_cancelou", label: "Cancelar chamado", destructive: true },
      ]
    default:
      return []
  }
}

export function SupportTicketDetail({ ticketId, portal }: SupportTicketDetailProps) {
  const listHref = portal === "comprador" ? "/comprador/suporte" : "/solicitante/suporte"

  const [ticket, setTicket] = React.useState<AxisDeskChamadoDetalhe | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  const [actionMessage, setActionMessage] = React.useState("")
  const [actionAnexos, setActionAnexos] = React.useState<File[]>([])
  const [actionLoading, setActionLoading] = React.useState(false)
  const [pendingAction, setPendingAction] =
    React.useState<AxisDeskChamadoAcao | null>(null)

  const loadTicket = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}`, {
          cache: "no-store",
        })
        const payload = (await res.json()) as {
          data?: AxisDeskChamadoDetalhe
          error?: string
        }
        if (!res.ok) {
          toast.error(payload.error ?? "Erro ao carregar chamado.")
          if (!silent) setTicket(null)
          return
        }
        setTicket(payload.data ?? null)
      } catch {
        toast.error("Erro ao carregar chamado.")
        if (!silent) setTicket(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [ticketId],
  )

  React.useEffect(() => {
    void loadTicket()
  }, [loadTicket])

  const handleExecuteAction = async (acao: AxisDeskChamadoAcao) => {
    if (!ticket) return

    if (acao === "usuario_reprovou" && !actionMessage.trim()) {
      toast.error("Informe o motivo da reprovação.")
      return
    }

    if (
      acao === "usuario_respondeu" &&
      !actionMessage.trim() &&
      actionAnexos.length === 0
    ) {
      toast.error("Informe uma mensagem ou anexe um arquivo.")
      return
    }

    if (actionMessage.length > AXISDESK_MAX_TEXTO) {
      toast.error(`Mensagem deve ter no máximo ${AXISDESK_MAX_TEXTO} caracteres.`)
      return
    }

    setActionLoading(true)
    setPendingAction(acao)
    try {
      let anexos: AxisDeskAnexo[] | undefined
      if (
        (acao === "usuario_respondeu" || acao === "usuario_reenviou") &&
        actionAnexos.length > 0
      ) {
        anexos = await filesToAnexos(actionAnexos)
      }

      const res = await fetch(`/api/support/tickets/${ticket.id}/acoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao,
          ...(actionMessage.trim() && acao !== "usuario_cancelou"
            ? { mensagem: actionMessage.trim() }
            : {}),
          ...(anexos ? { anexos } : {}),
        }),
      })

      const payload = (await res.json()) as {
        data?: AxisDeskChamadoDetalhe
        error?: string
      }

      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao executar ação.")
        return
      }

      toast.success("Ação registrada com sucesso.")
      setActionMessage("")
      setActionAnexos([])
      await loadTicket(true)
    } catch {
      toast.error("Erro ao executar ação.")
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  const detailActions = ticket ? getAvailableActions(ticket.status) : []
  const showMessageField =
    detailActions.some((a) => a.acao === "usuario_respondeu") ||
    detailActions.some((a) => a.acao === "usuario_reprovou") ||
    detailActions.some((a) => a.acao === "usuario_reenviou")
  const showAttachmentsField =
    detailActions.some((a) => a.acao === "usuario_respondeu") ||
    detailActions.some((a) => a.acao === "usuario_reenviou")
  const messageRequired = detailActions.some((a) => a.acao === "usuario_reprovou")
  const messagePlaceholder = ticket
    ? ticket.status === "validacao_usuario"
      ? "Descreva o motivo se for reprovar a solução"
      : ticket.status === "reprovado"
        ? "Explique o reenvio do chamado (opcional)"
        : "Informações adicionais para a equipe de suporte"
    : ""

  const activityItems = React.useMemo(
    () =>
      ticket
        ? buildAxisDeskActivityFeed(ticket.comentarios ?? [], ticket.anexos ?? [])
        : [],
    [ticket],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando chamado…
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href={listHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Suporte
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Chamado não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={listHref} className="hover:text-foreground transition-colors">
              Suporte
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground truncate max-w-[280px]">
              {ticket.titulo}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <Button type="button" variant="outline" size="icon" asChild>
              <Link href={listHref}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{ticket.titulo}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge variant={getAxisDeskStatusVariant(ticket.status)}>
                  {getAxisDeskStatusLabel(ticket.status)}
                </StatusBadge>
                <StatusBadge variant="muted">
                  {getAxisDeskPrioridadeLabel(ticket.prioridade)}
                </StatusBadge>
                <StatusBadge variant="info">
                  {AXISDESK_TIPO_OPTIONS.find((o) => o.value === ticket.tipo)?.label ??
                    ticket.tipo}
                </StatusBadge>
                {ticket.categoria && (
                  <StatusBadge variant="default">{ticket.categoria.nome}</StatusBadge>
                )}
                {ticket.subcategoria && (
                  <StatusBadge variant="default">{ticket.subcategoria.nome}</StatusBadge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadTicket(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {ticket.descricao}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Atividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade registrada ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {activityItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      {item.kind === "comment" ? (
                        <>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {item.autorNome}
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {item.autorTipo}
                              </span>
                            </span>
                            <span>{formatDateTime(item.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm whitespace-pre-wrap">
                            {item.mensagem}
                          </p>
                        </>
                      ) : (
                        <div className="flex items-start gap-3">
                          <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>
                                {item.autorNome ? (
                                  <>
                                    <span className="font-medium text-foreground">
                                      {item.autorNome}
                                    </span>
                                    {" · "}
                                  </>
                                ) : null}
                                Anexo
                              </span>
                              <span>{formatDateTime(item.createdAt)}</span>
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                            >
                              {item.nomeArquivo}
                              <span className="text-xs font-normal text-muted-foreground">
                                ({formatAxisDeskFileSize(item.tamanho)})
                              </span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(ticket.historico?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Histórico de alterações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(ticket.historico ?? []).map((entry, index) => (
                    <div
                      key={entry.id ?? `hist-${index}`}
                      className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {entry.alterado_por}
                        </span>
                        <span>{formatDateTime(getHistoricoEntryDate(entry))}</span>
                      </div>
                      <p className="mt-2">
                        <span className="text-muted-foreground">Campo: </span>
                        {entry.campo_alterado}
                      </p>
                      <p className="mt-1">
                        <span className="text-muted-foreground">De: </span>
                        {formatHistoricoValue(
                          entry.campo_alterado,
                          entry.valor_anterior,
                        )}
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className="text-muted-foreground">Para: </span>
                        {formatHistoricoValue(entry.campo_alterado, entry.valor_novo)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Criado em: </span>
                {formatDateTime(ticket.created_at)}
              </div>
              <div>
                <span className="text-muted-foreground">SLA: </span>
                {formatDateTime(ticket.sla_prazo)}
              </div>
              {ticket.solicitante && (
                <div>
                  <span className="text-muted-foreground">Solicitante: </span>
                  {ticket.solicitante.nome} ({ticket.solicitante.email})
                </div>
              )}
              {ticket.contexto_origem && (
                <div>
                  <span className="text-muted-foreground">Origem: </span>
                  {ticket.contexto_origem}
                </div>
              )}
            </CardContent>
          </Card>

          {(detailActions.length > 0 || showMessageField) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {showMessageField && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="action-message">
                        {messageRequired
                          ? "Mensagem / motivo"
                          : "Mensagem (opcional)"}
                      </Label>
                      <Textarea
                        id="action-message"
                        value={actionMessage}
                        maxLength={AXISDESK_MAX_TEXTO}
                        onChange={(e) => setActionMessage(e.target.value)}
                        rows={3}
                        placeholder={messagePlaceholder}
                      />
                      <CharacterCounter
                        current={actionMessage.length}
                        max={AXISDESK_MAX_TEXTO}
                      />
                    </div>
                    {showAttachmentsField && (
                      <div className="space-y-2">
                        <Label htmlFor="action-anexos">Anexos (opcional)</Label>
                        <Input
                          id="action-anexos"
                          type="file"
                          multiple
                          disabled={actionLoading}
                          onChange={(e) =>
                            setActionAnexos((current) =>
                              mergeSelectedFiles(current, e.target.files),
                            )
                          }
                        />
                        <AttachmentFileList
                          files={actionAnexos}
                          onRemove={(index) =>
                            setActionAnexos((current) =>
                              removeSelectedFile(current, index),
                            )
                          }
                          disabled={actionLoading}
                        />
                      </div>
                    )}
                  </div>
                )}

                {detailActions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {detailActions.map((action) => (
                      <Button
                        key={action.acao}
                        type="button"
                        variant={action.destructive ? "destructive" : "default"}
                        size="sm"
                        className="w-full"
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
