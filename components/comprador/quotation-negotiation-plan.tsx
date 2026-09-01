"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pause,
  Play,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  NegotiationDecisionLog,
  NegotiationPlan,
  NegotiationRun,
  NegotiationStrategy,
} from "@/types/negotiation"
import { DEFAULT_NEGOTIATION_PLAN } from "@/types/negotiation"
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
  const [showNewPlanForm, setShowNewPlanForm] = React.useState(false)

  const { value: pollMinutes } = useTenantSetting("ai_negotiation_autonomous_poll_minutes")

  const [form, setForm] = React.useState({
    min_rounds: String(DEFAULT_NEGOTIATION_PLAN.min_rounds),
    max_rounds: String(DEFAULT_NEGOTIATION_PLAN.max_rounds),
    max_price_pct_above_best: String(DEFAULT_NEGOTIATION_PLAN.max_price_pct_above_best),
    target_saving_pct_below_target: String(
      DEFAULT_NEGOTIATION_PLAN.target_saving_pct_below_target,
    ),
    stop_on_target: DEFAULT_NEGOTIATION_PLAN.stop_on_target,
    stop_on_no_improvement: DEFAULT_NEGOTIATION_PLAN.stop_on_no_improvement,
    require_buyer_approval: DEFAULT_NEGOTIATION_PLAN.require_buyer_approval,
    response_deadline_days: String(DEFAULT_NEGOTIATION_PLAN.response_deadline_days),
    strategy: DEFAULT_NEGOTIATION_PLAN.strategy as NegotiationStrategy,
  })

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

  const requireApproval = activePlan?.require_buyer_approval ?? false
  const isAutonomous = activeRun != null && !requireApproval

  const canConfigure =
    quotationStatus == null ||
    quotationStatus === "draft" ||
    quotationStatus === "rejected" ||
    quotationStatus === "waiting" ||
    quotationStatus === "analysis"

  const isDraftLike = quotationStatus === "draft" || quotationStatus === "rejected"

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
      await load({ silent: true })
      if (changed) onChangedRef.current?.()
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
        body: JSON.stringify({
          min_rounds: Number(form.min_rounds),
          max_rounds: Number(form.max_rounds),
          max_price_pct_above_best: Number(form.max_price_pct_above_best),
          target_saving_pct_below_target: Number(form.target_saving_pct_below_target),
          stop_on_target: form.stop_on_target,
          stop_on_no_improvement: form.stop_on_no_improvement,
          require_buyer_approval: form.require_buyer_approval,
          response_deadline_days: Number(form.response_deadline_days),
          strategy: form.strategy,
        }),
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
      toast.success("Negociação pausada. Retome criando um novo plano ou retomando manualmente na equalização.")
      await load()
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
    !(lastCompletedRun && !showNewPlanForm)

  if (!enabled) return null
  if (!canConfigure && !activeRun && !lastCompletedRun) return null

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
                {isDraftLike ? (
                  <p className="text-xs text-muted-foreground">
                    Ao iniciar, a cotação é publicada e a rodada 1 abre automaticamente.
                  </p>
                ) : null}
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
                <div className="grid gap-4 md:grid-cols-2">
                  <p className="md:col-span-2 text-xs text-muted-foreground">
                    Defina o plano antes de publicar (rascunho) ou para um novo evento na mesma
                    cotação. Com &quot;aprovação por rodada&quot; desligada, o motor avança sozinho
                    conforme o intervalo configurado no Admin.
                  </p>
                  <div className="space-y-2">
                    <Label>Rodadas mínimas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={form.min_rounds}
                      onChange={(e) => setForm((f) => ({ ...f, min_rounds: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rodadas máximas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={form.max_rounds}
                      onChange={(e) => setForm((f) => ({ ...f, max_rounds: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teto de preço (% acima do melhor)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={form.max_price_pct_above_best}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, max_price_pct_above_best: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Saving alvo (% abaixo do preço alvo)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={form.target_saving_pct_below_target}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          target_saving_pct_below_target: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo por rodada (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={form.response_deadline_days}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, response_deadline_days: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estratégia</Label>
                    <Select
                      value={form.strategy}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, strategy: v as NegotiationStrategy }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_item">Por item</SelectItem>
                        <SelectItem value="per_supplier">Por fornecedor</SelectItem>
                        <SelectItem value="by_category">Por categoria</SelectItem>
                        <SelectItem value="by_cost_center">Por centro de custo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                    <div>
                      <p className="text-sm font-medium">Parar ao atingir preço alvo</p>
                      <p className="text-xs text-muted-foreground">
                        Encerra o evento quando o saving configurado for atingido.
                      </p>
                    </div>
                    <Switch
                      checked={form.stop_on_target}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, stop_on_target: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                    <div>
                      <p className="text-sm font-medium">Exigir aprovação antes de cada rodada</p>
                      <p className="text-xs text-muted-foreground">
                        Ligado: você aprova cada nova rodada. Desligado: motor automático com
                        polling.
                      </p>
                    </div>
                    <Switch
                      checked={form.require_buyer_approval}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, require_buyer_approval: v }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap gap-2">
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
