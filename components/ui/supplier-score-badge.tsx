import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { SupplierScoreData } from "@/lib/hooks/use-supplier-score"

function getScoreColor(score: number): {
  bg: string
  text: string
  border: string
  label: string
} {
  if (score >= 75)
    return {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
      label: "Excelente",
    }
  if (score >= 50)
    return {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
      label: "Bom",
    }
  if (score >= 25)
    return {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
      label: "Regular",
    }
  return {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    label: "Atenção",
  }
}

type Props = {
  scoreData: SupplierScoreData | undefined
  loading?: boolean
  size?: "sm" | "md"
}

export function SupplierScoreBadge({ scoreData, loading, size = "md" }: Props) {
  if (loading) {
    return <div className="h-6 w-12 animate-pulse rounded-full bg-muted" />
  }

  if (!scoreData) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const colors = getScoreColor(scoreData.score)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-help items-center gap-1 rounded-full border px-2 font-semibold",
            size === "sm" ? "py-0.5 text-[11px]" : "py-1 text-xs",
            colors.bg,
            colors.text,
            colors.border,
          )}
        >
          {scoreData.score}
          <span className="font-normal opacity-70">/ 100</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-56 space-y-2 p-3">
        <p className="text-sm font-semibold">
          Score: {scoreData.score} — {colors.label}
        </p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Preço vs Mercado</span>
            <span className="font-medium">{scoreData.priceScore}/100</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cobertura</span>
            <span className="font-medium">{scoreData.coverageScore}/100</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lead Time</span>
            <span className="font-medium">{scoreData.leadTimeScore}/100</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confiabilidade</span>
            <span className="font-medium">{scoreData.reliabilityScore}/100</span>
          </div>
        </div>
        <div className="space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
          {scoreData.avgPriceVsMarket != null && (
            <p>
              Preço médio: {scoreData.avgPriceVsMarket > 0 ? "+" : ""}
              {scoreData.avgPriceVsMarket}% vs média
            </p>
          )}
          {scoreData.coveragePercent != null && (
            <p>Cobertura: {scoreData.coveragePercent}% dos itens</p>
          )}
          {scoreData.avgLeadTimeDays != null && (
            <p>Lead time médio: {scoreData.avgLeadTimeDays} dias</p>
          )}
          {scoreData.reliabilityPercent != null && (
            <p>Confiabilidade: {scoreData.reliabilityPercent}% de resposta</p>
          )}
          <p>Cotações participadas: {scoreData.totalQuotations}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
