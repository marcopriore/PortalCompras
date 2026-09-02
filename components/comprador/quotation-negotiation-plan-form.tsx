"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { NegotiationPlanInput, NegotiationStrategy } from "@/types/negotiation"
import { DEFAULT_NEGOTIATION_PLAN } from "@/types/negotiation"

export type NegotiationPlanFormState = {
  min_rounds: string
  max_rounds: string
  max_price_pct_above_best: string
  target_saving_pct_below_target: string
  stop_on_target: boolean
  stop_on_no_improvement: boolean
  require_buyer_approval: boolean
  response_deadline_days: string
  strategy: NegotiationStrategy
}

export function createDefaultNegotiationFormState(
  overrides?: Partial<NegotiationPlanFormState>,
): NegotiationPlanFormState {
  return {
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
    strategy: DEFAULT_NEGOTIATION_PLAN.strategy,
    ...overrides,
  }
}

/** Defaults ao criar cotação com IA desde o início (modo automático). */
export function createNovaCotacaoNegotiationFormState(): NegotiationPlanFormState {
  return createDefaultNegotiationFormState({
    require_buyer_approval: false,
  })
}

export function negotiationFormToInput(form: NegotiationPlanFormState): NegotiationPlanInput {
  return {
    min_rounds: Number(form.min_rounds),
    max_rounds: Number(form.max_rounds),
    max_price_pct_above_best: Number(form.max_price_pct_above_best),
    target_saving_pct_below_target: Number(form.target_saving_pct_below_target),
    stop_on_target: form.stop_on_target,
    stop_on_no_improvement: form.stop_on_no_improvement,
    require_buyer_approval: form.require_buyer_approval,
    response_deadline_days: Number(form.response_deadline_days),
    strategy: form.strategy,
  }
}

type FormFieldsProps = {
  form: NegotiationPlanFormState
  onFormChange: (
    updater: (prev: NegotiationPlanFormState) => NegotiationPlanFormState,
  ) => void
  introText?: string
}

export function QuotationNegotiationPlanFormFields({
  form,
  onFormChange,
  introText,
}: FormFieldsProps) {
  return (
    <div className="space-y-4">
      {introText ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{introText}</p>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="min-w-0 space-y-1">
          <Label className="text-xs leading-tight" title="Rodadas mínimas">
            Rodadas mín.
          </Label>
          <Input
            type="number"
            min={1}
            max={20}
            className="h-9 w-full tabular-nums"
            value={form.min_rounds}
            onChange={(e) => onFormChange((f) => ({ ...f, min_rounds: e.target.value }))}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs leading-tight" title="Rodadas máximas">
            Rodadas máx.
          </Label>
          <Input
            type="number"
            min={1}
            max={30}
            className="h-9 w-full tabular-nums"
            value={form.max_rounds}
            onChange={(e) => onFormChange((f) => ({ ...f, max_rounds: e.target.value }))}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs leading-tight" title="Prazo por rodada (dias)">
            Prazo (dias)
          </Label>
          <Input
            type="number"
            min={1}
            max={60}
            className="h-9 w-full tabular-nums"
            value={form.response_deadline_days}
            onChange={(e) =>
              onFormChange((f) => ({ ...f, response_deadline_days: e.target.value }))
            }
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label
            className="text-xs leading-tight"
            title="Teto de preço (% acima do melhor)"
          >
            Teto (%)
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="h-9 w-full tabular-nums"
            value={form.max_price_pct_above_best}
            onChange={(e) =>
              onFormChange((f) => ({ ...f, max_price_pct_above_best: e.target.value }))
            }
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label
            className="text-xs leading-tight"
            title="Saving alvo (% abaixo do preço alvo)"
          >
            Saving (%)
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="h-9 w-full tabular-nums"
            value={form.target_saving_pct_below_target}
            onChange={(e) =>
              onFormChange((f) => ({
                ...f,
                target_saving_pct_below_target: e.target.value,
              }))
            }
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs leading-tight">Estratégia</Label>
          <Select
            value={form.strategy}
            onValueChange={(v) =>
              onFormChange((f) => ({ ...f, strategy: v as NegotiationStrategy }))
            }
          >
            <SelectTrigger className="h-9 w-full">
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Parar ao atingir preço alvo</p>
            <p className="text-xs text-muted-foreground leading-snug">
              Encerra quando o saving configurado for atingido.
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={form.stop_on_target}
            onCheckedChange={(v) => onFormChange((f) => ({ ...f, stop_on_target: v }))}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Parar sem melhoria</p>
            <p className="text-xs text-muted-foreground leading-snug">
              Encerra se a rodada não reduzir o total melhor vs. a anterior.
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={form.stop_on_no_improvement}
            onCheckedChange={(v) =>
              onFormChange((f) => ({ ...f, stop_on_no_improvement: v }))
            }
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5 sm:col-span-2 lg:col-span-1">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">
              Aprovação antes de cada rodada
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              Ligado: você aprova. Desligado: motor automático.
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={form.require_buyer_approval}
            onCheckedChange={(v) =>
              onFormChange((f) => ({ ...f, require_buyer_approval: v }))
            }
          />
        </div>
      </div>
    </div>
  )
}
