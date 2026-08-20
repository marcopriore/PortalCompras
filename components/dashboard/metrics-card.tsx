import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricsCardProps {
  title: string
  value: string | number
  /** Variação vs período anterior. `null` = sem base para comparar. */
  change?: number | null
  changeLabel?: string
  /** Sufixo da variação (padrão %). Use " dias" para lead time. */
  changeUnit?: "%" | " dias"
  /** Texto auxiliar dentro do card (ex.: descrição do KPI). */
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  className?: string
}

export function MetricsCard({
  title,
  value,
  change,
  changeLabel = "vs mês anterior",
  changeUnit = "%",
  subtitle,
  icon: Icon,
  className,
}: MetricsCardProps) {
  const hasChange = typeof change === "number" && Number.isFinite(change)
  const isPositive = hasChange && change > 0
  const isNegative = hasChange && change < 0
  const isNeutral = hasChange && change === 0

  const formatChange = (n: number) => {
    const abs = Math.abs(n)
    const formatted = changeUnit === "%" ? `${abs}%` : `${abs}${changeUnit}`
    if (n > 0) return `+${formatted}`
    if (n < 0) return `-${formatted}`
    return changeUnit === "%" ? "0%" : `0${changeUnit}`
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex h-full flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {hasChange ? (
              <div className="flex flex-wrap items-center gap-1 text-sm">
                {isPositive && <TrendingUp className="h-4 w-4 shrink-0 text-success" />}
                {isNegative && <TrendingDown className="h-4 w-4 shrink-0 text-destructive" />}
                {isNeutral && <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span
                  className={cn(
                    isPositive && "text-success",
                    isNegative && "text-destructive",
                    isNeutral && "text-muted-foreground",
                  )}
                >
                  {formatChange(change)}
                </span>
                <span className="whitespace-nowrap text-muted-foreground">{changeLabel}</span>
              </div>
            ) : changeLabel ? (
              <div className="text-sm text-muted-foreground">
                <span className="whitespace-nowrap">{changeLabel}</span>
              </div>
            ) : null}
            {subtitle ? (
              <p className="text-xs text-muted-foreground whitespace-nowrap">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
