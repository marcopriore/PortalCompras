"use client"

import * as React from "react"
import { AlertCircle, Clock, RefreshCw, Sparkles } from "lucide-react"
import { useUser } from "@/lib/hooks/useUser"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AIInsightCache {
  insights: string
  generatedAt: string
  period: number
  dataSnapshot: {
    totalPago: number
    totalAlvo: number | null
    desvioPercent: number | null
    topCategoria: string | null
    totalOrders: number
  }
}

const CACHE_TTL_MS = 60 * 60 * 1000
const COOLDOWN_MS = 60 * 60 * 1000

function cacheKey(companyId: string) {
  return `valore:ai-spend-insights:${companyId}`
}

function loadCache(companyId: string): AIInsightCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(companyId))
    if (!raw) return null
    const parsed: AIInsightCache & { cachedAt: string } = JSON.parse(raw)
    const age = Date.now() - new Date(parsed.cachedAt).getTime()
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(companyId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCache(companyId: string, data: AIInsightCache) {
  localStorage.setItem(
    cacheKey(companyId),
    JSON.stringify({
      ...data,
      cachedAt: new Date().toISOString(),
    }),
  )
}

function formatCountdown(seconds: number): string {
  if (seconds >= 3600) return "1h 00min"
  if (seconds >= 60) return `${Math.floor(seconds / 60)}min ${seconds % 60}s`
  return `${seconds}s`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function renderInsights(text: string): React.ReactElement {
  const lines = text.split("\n").filter((l) => l.trim() !== "")
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Título ##
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="text-sm font-semibold text-foreground mb-1">
              {line.replace(/^## /, "")}
            </p>
          )
        }
        // Linha normal — converter **texto** em <strong>
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <p key={i} className="text-sm text-foreground leading-relaxed">
            {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
          </p>
        )
      })}
    </div>
  )
}

export function SpendAIInsights() {
  const { companyId } = useUser()
  const [cache, setCache] = React.useState<AIInsightCache | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState<"30" | "90" | "180">("30")
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0)

  React.useEffect(() => {
    if (!companyId) return

    const cached = loadCache(companyId)
    if (!cached) {
      setCache(null)
      setCooldownRemaining(0)
      return
    }

    setCache(cached)

    try {
      const raw = localStorage.getItem(cacheKey(companyId))
      if (!raw) {
        setCooldownRemaining(0)
        return
      }
      const parsed: AIInsightCache & { cachedAt: string } = JSON.parse(raw)
      const remainingSeconds = Math.max(
        0,
        Math.ceil((COOLDOWN_MS - (Date.now() - new Date(parsed.cachedAt).getTime())) / 1000),
      )
      setCooldownRemaining(remainingSeconds)
    } catch {
      setCooldownRemaining(0)
    }
  }, [companyId])

  React.useEffect(() => {
    if (cooldownRemaining <= 0) return

    const interval = window.setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [cooldownRemaining])

  async function handleGenerate() {
    if (!companyId || loading || cooldownRemaining > 0) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/ai-spend-analysis?period=${period}`)
      const data = (await response.json()) as AIInsightCache & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível gerar a análise de IA.")
      }

      saveCache(companyId, data)
      setCache(data)
      setCooldownRemaining(COOLDOWN_MS / 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar análise.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Análise de Spend por IA
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-8">
              IA
            </Badge>
            <Select value={period} onValueChange={(v) => setPeriod(v as "30" | "90" | "180")}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="180">Últimos 180 dias</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={loading || cooldownRemaining > 0}
              className="h-8 text-xs gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> Analisando...
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <Clock className="h-3 w-3" /> {formatCountdown(cooldownRemaining)}
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" /> Gerar análise
                </>
              )}
            </Button>
          </div>
        </div>

        {cache && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Gerado em {formatDateTime(cache.generatedAt)} · Período: {cache.period} dias
          </p>
        )}
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !cache && (
          <div className="space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-4 bg-muted rounded w-full"
                style={{ width: `${85 - i * 8}%` }}
              />
            ))}
          </div>
        )}

        {cache && !loading && renderInsights(cache.insights)}

        {!cache && !loading && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              Clique em &quot;Gerar análise&quot; para obter insights sobre o seu spend.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
