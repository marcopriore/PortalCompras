import { RefreshCw } from "lucide-react"
import { formatDateTimeBR } from "@/lib/utils/date-helpers"

interface LastUpdatedProps {
  timestamp: Date | null
  isRefreshing?: boolean
}

export function LastUpdated({ timestamp, isRefreshing }: LastUpdatedProps) {
  if (!timestamp) return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
      <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden />
      <span>Atualizado às {formatDateTimeBR(timestamp.toISOString(), true)}</span>
    </div>
  )
}
