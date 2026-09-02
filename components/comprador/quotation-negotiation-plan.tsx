"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pause,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import type {
  NegotiationCounterOffer,
  NegotiationDecisionLog,
  NegotiationPlan,
  NegotiationRun,
} from "@/types/negotiation"
import {
  createDefaultNegotiationFormState,
  negotiationFormToInput,
  QuotationNegotiationPlanFormFields,
  type NegotiationPlanFormState,
} from "@/components/comprador/quotation-negotiation-plan-form"
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh"
import { useTenantSetting } from "@/lib/hooks/use-tenant-settings"
import { formatDateTimeBR } from "@/lib/formato-data"

type Props = {
  quotationId: string
  companyId: string
  enabled: boolean
  quotationStatus?: string
  defaultOpen?: boolean
  onChanged?: () => void
}

const RUN_STATUS_LABEL: Record<string, string> = {
  pending: "Em execução",
  running: "Em execução",
  waiting_deadline: "Aguardando fornecedores",
  analyzing: "Analisando rodada",
  opening_round: "Abrindo rodada",
  paused: "Pausada pelo comprador",
  awaiting_approval: "Aguardando sua aprovação",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
}

const ACTIVE_STATUSES = new Set([
  "pending",
  "running",
  "waiting_deadline",
  "analyzing",
  "opening_round",
  "paused",
  "awaiting_approval",
])

export function QuotationNegotiationPlanPanel({
  quotationId,
  companyId,
  enabled,
  quotationStatus,
  defaultOpen = false,
  onChanged,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [plans, setPlans] = React.useState<NegotiationPlan[]>([])
  const [runs, setRuns] = React.useState<NegotiationRun[]>([])
  const [decisionLogs, setDecisionLogs] = React.useState<NegotiationDecisionLog[]>([])
  const [counterOffers, setCounterOffers] = React.useState<NegotiationCounterOffer[]>([])
  const [showNewPlanForm, setShowNewPlanForm] = React.useState(false)

  const { value: pollMinutes } = useTenantSetting("ai_negotiation_autonomous_poll_minutes")

  const [form, setForm] = React.useState<NegotiationPlanFormState>(() =>
    createDefaultNegotiationFormState(),
  )

  const activeRun = React.useMemo(
    () => runs.find((r) => ACTIVE_STATUSES.has(r.status)) ?? null,
    [runs],
  )

  const activePlan = React.useMemo(
    () => (activeRun ? plans.find((p) => p.id === activeRun.plan_id) ?? null : null),
    [activeRun, plans],
  )

  const latestDraftPlan = React.useMemo(
    () => plans.find((p) => p.status === "draft") ?? null,
    [plans],
  )

  const lastCompletedRun = React.useMemo(
    () => runs.find((r) => r.status === "completed") ?? null,
    [runs],
  )

  const lastCancelledRun = React.useMemo(
    () => runs.find((r) => r.status === "cancelled") ?? null,
    [runs],
  )

  const lastTerminalRun = lastCompletedRun ?? lastCancelledRun

  const lastCompletedPlan = React.useMemo(
    () =>
      lastCompletedRun
        ? plans.find((p) => p.id === lastCompletedRun.plan_id) ?? null
        : null,
    [lastCompletedRun, plans],
  )

  const runLogs = React.useMemo(() => {
    if (!activeRun) return decisionLogs.slice(0, 6)
    return decisionLogs.filter((l) => l.run_id === activeRun.id).slice(0, 6)
  }, [activeRun, decisionLogs])

  const completionLog = React.useMemo(
    () =>
      lastCompletedRun
        ? decisionLogs.find(
            (l) => l.run_id === lastCompletedRun.id && l.action === "complete",
          )
        : null,
    [decisionLogs, lastCompletedRun],
  )

  const cancelLog = React.useMemo(
    () =>
      lastCancelledRun
        ? decisionLogs.find((l) => l.run_id === lastCancelledRun.id && l.action === "cancel")
        : null,
    [decisionLogs, lastCancelledRun],
  )

  const requireApproval = activePlan?.require_buyer_approval ?? false
  const isAutonomous = activeRun != null && !requireApproval

  const canConfigure =
    quotationStatus === "waiting" ||
    quotationStatus === "analysis"

  const onChangedRef = React.useRef(onChanged)
  React.useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  const initialAdvanceRunIdRef = React.useRef<string | null>(null)

  const load = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!enabled || !quotationId) return
      if (!options?.silent) setLoading(true)
      try {
        const res = await fetch(`/api/quotations/${quotationId}/negotiation-plans`, {
          cache: "no-store",
        })
        const json = (await res.json()) as {
          error?: string
          plans?: NegotiationPlan[]
          runs?: NegotiationRun[]
          decisionLogs?: NegotiationDecisionLog[]
          counterOffers?: NegotiationCounterOffer[]
        }
        if (!res.ok) {
          if (!options?.silent) {
            toast.error(json.error ?? "Erro ao carregar negociação assistida.")
          }
          return
        }
        setPlans(json.plans ?? [])
        setRuns(json.runs ?? [])
        setDecisionLogs(json.decisionLogs ?? [])
        setCounterOffers(json.counterOffers ?? [])
      } catch {
        if (!options?.silent) {
          toast.error("Erro ao carregar negociação assistida.")
        }
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [enabled, quotationId],
  )

  const handleDownloadReport = React.useCallback(
    async (runId: string, format: "xlsx" | "pdf") => {
      try {
        const res = await fetch(`/api/negotiation-runs/${runId}/report?format=${format}`)
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          toast.error(json.error ?? "Erro ao gerar relatório.")
          return
        }
        const blob = await res.blob()
        const disposition = res.headers.get("Content-Disposition")
        const match = disposition?.match(/filename="([^"]+)"/)
        const fallback = format === "pdf" ? "negociacao.pdf" : "negociacao.xlsx"
        const filename = match?.[1] ?? fallback
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = filename
        anchor.click()
        URL.revokeObjectURL(url)
      } catch {
        toast.error("Erro ao gerar relatório.")
      }
    },
    [],
  )

  const renderReportButtons = (runId: string) => (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => void handleDownloadReport(runId, "xlsx")}
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Excel
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void handleDownloadReport(runId, "pdf")}
      >
        <FileText className="mr-2 h-4 w-4" />
        PDF
      </Button>
    </div>
  )

  const silentAdvance = React.useCallback(async () => {
    const runId = activeRun?.id
    if (!runId) return
    try {
      const res = await fetch(`/api/negotiation-runs/${runId}/tick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) return
      const changed = json.message !== "Nenhuma ação necessária."
      if (changed) {
        await load({ silent: true })
        onChangedRef.current?.()
      }
    } catch {
      // refresh silencioso
    }
  }, [activeRun?.id, load])

  const silentAdvanceRef = React.useRef(silentAdvance)
  silentAdvanceRef.current = silentAdvance

  React.useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])

  React.useEffect(() => {
    if (!enabled || !activeRun || requireApproval) return
    if (initialAdvanceRunIdRef.current === activeRun.id) return
    initialAdvanceRunIdRef.current = activeRun.id
    void silentAdvanceRef.current()
  }, [enabled, activeRun?.id, requireApproval])

  React.useEffect(() => {
    if (!activeRun) {
      initialAdvanceRunIdRef.current = null
    }
  }, [activeRun])

  const pollIntervalMs = React.useMemo(
    () => Math.max(1, Number(pollMinutes) || 30) * 60 * 1000,
    [pollMinutes],
  )

  const onPollRefresh = React.useCallback(() => {
    void silentAdvanceRef.current()
  }, [])

  useAutoRefresh({
    intervalMs: pollIntervalMs,
    onRefresh: onPollRefresh,
    enabled: Boolean(enabled && activeRun && isAutonomous),
    pauseWhenHidden: true,
    refreshOnVisible: true,
  })

  const handleCreatePlan = async (andStart = false) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/quotations/${quotationId}/negotiation-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(negotiationFormToInput(form)),
      })
      const json = (await res.json()) as { error?: string; plan?: NegotiationPlan }
      if (!res.ok) {
        toast.error(json.error ?? "Não foi possível salvar o plano.")
        return
      }
      toast.success("Plano salvo.")
      await load()
      setShowNewPlanForm(false)
      if (andStart && json.plan?.id) {
        await handleStart(json.plan.id)
      } else {
        onChanged?.()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async (planId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/negotiation-plans/${planId}/start`, { method: "POST" })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Não foi possível iniciar.")
        return
      }
      toast.success(json.message ?? "Negociação iniciada.")
      setShowNewPlanForm(false)
      await load()
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const handleTick = async (runId: string, forceApprove = false) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/negotiation-runs/${runId}/tick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceApprove }),
      })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Falha ao avançar negociação.")
        return
      }
      toast.success(json.message ?? "Atualizado.")
      await load()
      onChanged?.()
    } finally {
      setSaving(false)
    }
  }

  const handlePause = async (runId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/negotiation-runs/${runId}/pause`, { method: "POST" })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Não foi possível pausar.")
        return
      }
      toast.success("Negociação pausada.")
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (runId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/negotiation-runs/${runId}/cancel`, { method: "POST" })
      const json = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Não foi possível encerrar o evento.")
        return
      }
      toast.success(json.message ?? "Evento encerrado.")
      setShowNewPlanForm(false)
      await load()
      onChangedRef.current?.()
    } finally {
      setSaving(false)
    }
  }

  const statusHint = React.useMemo(() => {
    if (!activeRun) return null
    switch (activeRun.status) {
      case "awaiting_approval":
        return "A próxima rodada só abre após sua aprovação. Use o botão abaixo — não é necessário outro passo manual."
      case "waiting_deadline":
        return isAutonomous
          ? `O motor verifica respostas e prazos automaticamente a cada ${pollMinutes} min (configurável no Admin do tenant). Ao abrir a página, uma verificação imediata também é feita.`
          : "Quando todos os fornecedores responderem (ou o prazo vencer), clique em Avançar negociação para a IA analisar a rodada."
      case "analyzing":
        return isAutonomous
          ? "A IA está processando a rodada encerrada. O motor avançará automaticamente em instantes."
          : "A IA analisou a rodada. Clique em Avançar negociação para continuar ou aguarde a etapa de aprovação."
      case "paused":
        return "Execução pausada. Os fornecedores não são notificados até retomar com um novo evento."
      default:
        return null
    }
  }, [activeRun, isAutonomous, pollMinutes])

  const showConfigForm =
    !activeRun &&
    canConfigure &&
    (showNewPlanForm || !latestDraftPlan) &&
    !(lastTerminalRun && !showNewPlanForm)

  if (!enabled) return null
  if (!canConfigure && !activeRun && !lastTerminalRun) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-violet-600" />
              <div>
                <p className="font-semibold text-foreground">Negociação assistida por IA</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeRun ? (
                <Badge variant="secondary" className="bg-violet-100 text-violet-800">
                  {RUN_STATUS_LABEL[activeRun.status] ?? activeRun.status}
                </Badge>
              ) : lastCompletedRun ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Concluída
                </Badge>
              ) : lastCancelledRun ? (
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-800">
                  Encerrada
                </Badge>
              ) : null}
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-violet-200/80 px-4 pb-4 pt-3 dark:border-violet-900">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              {activeRun ? (
                <div className="rounded-lg border bg-background p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Execução em andamento</p>
                      <p className="text-xs text-muted-foreground">
                        Rodada atual {activeRun.current_round_number} ·{" "}
                        {readRunMetrics(activeRun).rounds_closed_in_run} rodada(s) concluída(s)
                        neste evento
                      </p>
                    </div>
                    <Badge variant="outline">
                      {RUN_STATUS_LABEL[activeRun.status] ?? activeRun.status}
                    </Badge>
                  </div>

                  {statusHint ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">{statusHint}</p>
                  ) : null}

                  {runLogs.length > 0 ? (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">Últimas decisões da IA</p>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {runLogs.map((log) => (
                          <li key={log.id} className="leading-snug">
                            <span className="text-foreground/80">
                              {formatDateTimeBR(log.created_at, true)}
                            </span>
                            {" — "}
                            {log.reason ?? log.action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {counterOffers.length > 0 ? (
                    <div className="rounded-md border bg-violet-50/50 p-3 space-y-2 dark:bg-violet-950/20">
                      <p className="text-xs font-medium text-foreground">
                        {activeRun?.status === "awaiting_approval"
                          ? "Alvos sugeridos para a próxima rodada"
                          : "Preços solicitados na rodada atual"}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-xs">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="py-1.5 pr-2 font-medium">Item</th>
                              {activePlan?.strategy === "by_category" ||
                              activePlan?.strategy === "by_cost_center" ? (
                                <th className="py-1.5 pr-2 font-medium">
                                  {activePlan.strategy === "by_category"
                                    ? "Categoria"
                                    : "Centro de custo"}
                                </th>
                              ) : null}
                              {activePlan?.strategy === "per_supplier" ? (
                                <th className="py-1.5 pr-2 font-medium">Fornecedor</th>
                              ) : null}
                              <th className="py-1.5 pr-2 font-medium text-right">Melhor</th>
                              <th className="py-1.5 pr-2 font-medium text-right">Alvo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {counterOffers.map((co) => (
                              <tr key={co.id} className="border-b border-border/50">
                                <td className="py-1.5 pr-2">
                                  <span className="font-medium text-foreground">
                                    {co.material_code ?? "—"}
                                  </span>
                                  <span className="block text-muted-foreground truncate max-w-[200px]">
                                    {co.material_description ?? ""}
                                  </span>
                                </td>
                                {activePlan?.strategy === "by_category" ||
                                activePlan?.strategy === "by_cost_center" ? (
                                  <td className="py-1.5 pr-2 text-muted-foreground max-w-[140px] truncate">
                                    {co.group_key ?? "—"}
                                  </td>
                                ) : null}
                                {activePlan?.strategy === "per_supplier" ? (
                                  <td className="py-1.5 pr-2 text-muted-foreground">
                                    {co.supplier_name ?? "—"}
                                  </td>
                                ) : null}
                                <td className="py-1.5 pr-2 text-right tabular-nums">
                                  {co.current_best_unit_price != null
                                    ? formatBrl(co.current_best_unit_price)
                                    : "—"}
                                </td>
                                <td className="py-1.5 pr-2 text-right tabular-nums font-medium text-primary">
                                  {formatBrl(co.target_unit_price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {activeRun?.status === "awaiting_approval" ? (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Revise os alvos antes de aprovar. Os fornecedores verão esses valores como
                          orientação na próxima rodada — não bloqueiam o envio de proposta.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {activeRun.status === "awaiting_approval" ? (
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleTick(activeRun.id, true)}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Aprovar e abrir próxima rodada
                      </Button>
                    ) : null}

                    {!isAutonomous &&
                    activeRun.status !== "awaiting_approval" &&
                    activeRun.status !== "paused" ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          disabled={saving}
                          onClick={() => void handleTick(activeRun.id)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Avançar negociação
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => void handlePause(activeRun.id)}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar
                        </Button>
                      </>
                    ) : null}

                    {isAutonomous && activeRun.status !== "paused" ? (
                      <p className="text-xs text-muted-foreground w-full">
                        Modo automático ativo — sem aprovação por rodada. Pausar interrompe o
                        evento até nova configuração.
                      </p>
                    ) : null}

                    {isAutonomous ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void handlePause(activeRun.id)}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pausar evento
                      </Button>
                    ) : null}

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void handleCancel(activeRun.id)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Encerrar evento
                    </Button>
                  </div>
                </div>
              ) : null}

              {!activeRun && lastCompletedRun ? (
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 space-y-3 dark:border-green-900 dark:bg-green-950/20">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Negociação concluída</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {completionLog?.reason ??
                          "O evento de negociação assistida foi encerrado. Revise as propostas na equalização e selecione o fornecedor vencedor."}
                      </p>
                      {lastCompletedPlan ? (
                        <p className="text-xs text-muted-foreground">
                          Plano: {lastCompletedPlan.min_rounds}–{lastCompletedPlan.max_rounds}{" "}
                          rodadas · saving alvo {lastCompletedPlan.target_saving_pct_below_target}%
                          · concluído em{" "}
                          {lastCompletedRun.completed_at
                            ? formatDateTimeBR(lastCompletedRun.completed_at, true)
                            : "—"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderReportButtons(lastCompletedRun.id)}
                    {canConfigure ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNewPlanForm(true)}
                      >
                        Configurar novo evento
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!activeRun && lastCancelledRun ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-950/20">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Evento encerrado</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cancelLog?.reason ??
                        "O evento de negociação assistida foi encerrado manualmente. Você pode configurar um novo evento quando quiser."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderReportButtons(lastCancelledRun.id)}
                    {canConfigure ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowNewPlanForm(true)}
                      >
                        Configurar novo evento
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {latestDraftPlan && !activeRun ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleStart(latestDraftPlan.id)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar negociação
                  </Button>
                </div>
              ) : null}

              {showConfigForm ? (
                <div className="space-y-4">
                  <QuotationNegotiationPlanFormFields
                    form={form}
                    onFormChange={setForm}
                    introText='Defina o plano para um novo evento na mesma cotação. Com "aprovação por rodada" desligada, o motor avança sozinho conforme o intervalo configurado no Admin.'
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={saving} onClick={() => void handleCreatePlan(false)}>
                      {saving ? "Salvando..." : "Salvar plano"}
                    </Button>
                    <Button
                      variant="default"
                      disabled={saving}
                      onClick={() => void handleCreatePlan(true)}
                    >
                      {saving ? "Iniciando..." : "Salvar e iniciar"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function readRunMetrics(run: NegotiationRun): {
  rounds_closed_in_run: number
} {
  const raw = run.metrics ?? {}
  return {
    rounds_closed_in_run: Number(raw.rounds_closed_in_run) || 0,
  }
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}
