"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface QuotationAIAnalysisProps {
  quotationId: string
  roundId: string | null
  companyId: string
  hasNewProposal?: boolean
  onAnalyzed?: () => void
}

interface AIRecomendacao {
  quotation_item_id: string
  material_code: string
  fornecedor_recomendado_id: string | null
  fornecedor_recomendado_nome: string | null
  preco_recomendado: number
  justificativa: string
  confianca: "alta" | "media" | "baixa"
}

interface AIContraproposta {
  quotation_item_id: string
  material_code: string
  preco_atual_melhor: number
  preco_sugerido: number
  reducao_percentual: number
  justificativa: string
}

interface AIAlerta {
  quotation_item_id: string
  material_code: string
  tipo: "acima_alvo" | "acima_media" | "sem_proposta" | "unico_fornecedor"
  mensagem: string
  severidade: "alta" | "media" | "baixa"
}

interface AIAnalysis {
  recomendacoes: AIRecomendacao[]
  contrapropostas: AIContraproposta[]
  alertas: AIAlerta[]
  resumo_executivo: string
}

type CachePayload = {
  analysis: AIAnalysis
  generatedAt: string
  quotationCode: string | null
  cachedAt: string
}

const CACHE_TTL_MS = 30 * 60 * 1000
const COOLDOWN_SECONDS = 300

const CACHE_KEY = (qId: string, rId: string | null) =>
  `valore:ai-quotation-analysis:${qId}:${rId ?? "latest"}`

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return `${minutes}min ${remaining}s`
  }
  return `${seconds}s`
}

function loadCache(quotationId: string, roundId: string | null): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(quotationId, roundId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as CachePayload
    const cachedAtMs = new Date(parsed.cachedAt).getTime()
    if (!cachedAtMs || Number.isNaN(cachedAtMs)) return null

    const isExpired = Date.now() - cachedAtMs > CACHE_TTL_MS
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY(quotationId, roundId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveCache(quotationId: string, roundId: string | null, payload: Omit<CachePayload, "cachedAt">) {
  const data: CachePayload = {
    ...payload,
    cachedAt: new Date().toISOString(),
  }
  localStorage.setItem(CACHE_KEY(quotationId, roundId), JSON.stringify(data))
}

function removeCache(quotationId: string, roundId: string | null) {
  localStorage.removeItem(CACHE_KEY(quotationId, roundId))
}

export function QuotationAIAnalysis({
  quotationId,
  roundId,
  companyId,
  hasNewProposal = false,
  onAnalyzed,
}: QuotationAIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [quotationCode, setQuotationCode] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [exporting, setExporting] = useState(false)
  const autoAnalyzeRef = useRef(false)

  useEffect(() => {
    if (!companyId) return
    const cached = loadCache(quotationId, roundId)
    if (!cached) {
      setAnalysis(null)
      setGeneratedAt(null)
      setQuotationCode(null)
      setCooldown(0)
      return
    }

    setAnalysis(cached.analysis)
    setGeneratedAt(cached.generatedAt)
    setQuotationCode(cached.quotationCode ?? null)

    const cachedAtMs = new Date(cached.cachedAt).getTime()
    const remaining = Math.max(0, COOLDOWN_SECONDS - Math.floor((Date.now() - cachedAtMs) / 1000))
    setCooldown(remaining)
  }, [quotationId, roundId, companyId])

  useEffect(() => {
    if (cooldown <= 0) return
    const interval = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [cooldown])

  async function handleAnalyze(auto = false) {
    if (!companyId || loading || cooldown > 0) return

    if (auto) {
      toast.info("Nova proposta detectada - atualizando análise por IA...")
    }
    autoAnalyzeRef.current = auto
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ quotation_id: quotationId })
      if (roundId) params.set("round_id", roundId)

      const response = await fetch(`/api/quotation-ai-analysis?${params.toString()}`)
      const data = (await response.json()) as {
        analysis?: AIAnalysis
        generatedAt?: string
        quotationCode?: string
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível gerar a análise da cotação.")
      }
      if (!data.analysis || !data.generatedAt) {
        throw new Error("Resposta inválida da API de análise.")
      }

      setAnalysis(data.analysis)
      setGeneratedAt(data.generatedAt)
      setQuotationCode(data.quotationCode ?? null)
      saveCache(quotationId, roundId, {
        analysis: data.analysis,
        generatedAt: data.generatedAt,
        quotationCode: data.quotationCode ?? null,
      })
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar análise da IA.")
    } finally {
      setLoading(false)
    }
  }

  async function handleExportExcel() {
    if (!analysis) return

    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()

    const HEADER_COLOR = "FF4F3EF5"
    const ALERT_HIGH = "FFFDE8E8"
    const ALERT_MED = "FFFFF9C4"
    const ALERT_LOW = "FFF1F5F9"
    const REC_COLOR = "FFF0FDF4"
    const CP_COLOR = "FFEFF6FF"

    wb.creator = "Valore"
    wb.created = new Date()

    const wsResumo = wb.addWorksheet("Resumo")
    wsResumo.views = [{ showGridLines: false }]
    wsResumo.columns = [{ width: 30 }, { width: 80 }]
    wsResumo.addRow(["Análise de Negociação por IA — Valore"])
    wsResumo.getRow(1).getCell(1).font = {
      bold: true,
      size: 14,
      color: { argb: "FF4F3EF5" },
    }
    wsResumo.addRow([])
    wsResumo.addRow(["Cotação", quotationCode ?? "—"])
    wsResumo.addRow(["Gerado em", generatedAt ? formatDateTime(generatedAt) : "—"])
    wsResumo.addRow([])
    wsResumo.addRow(["Resumo Executivo"])
    wsResumo.getRow(6).getCell(1).font = { bold: true }
    wsResumo.addRow([analysis.resumo_executivo])
    wsResumo.getRow(7).getCell(1).alignment = { wrapText: true }

    const wsAlertas = wb.addWorksheet("Alertas")
    wsAlertas.views = [{ showGridLines: false }]
    wsAlertas.columns = [{ width: 15 }, { width: 45 }, { width: 20 }, { width: 15 }]
    const headerAlertas = wsAlertas.addRow(["Código", "Mensagem", "Tipo", "Severidade"])
    headerAlertas.height = 22
    headerAlertas.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { vertical: "middle" }
    })
    analysis.alertas.forEach((a) => {
      const row = wsAlertas.addRow([a.material_code, a.mensagem, a.tipo, a.severidade])
      const bg = a.severidade === "alta" ? ALERT_HIGH : a.severidade === "media" ? ALERT_MED : ALERT_LOW
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      })
    })

    const wsRec = wb.addWorksheet("Recomendações")
    wsRec.views = [{ showGridLines: false }]
    wsRec.columns = [{ width: 15 }, { width: 30 }, { width: 18 }, { width: 15 }, { width: 50 }]
    const headerRec = wsRec.addRow([
      "Código",
      "Fornecedor Recomendado",
      "Preço (R$)",
      "Confiança",
      "Justificativa",
    ])
    headerRec.height = 22
    headerRec.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { vertical: "middle" }
    })
    analysis.recomendacoes.forEach((r) => {
      const row = wsRec.addRow([
        r.material_code,
        r.fornecedor_recomendado_nome ?? "—",
        r.preco_recomendado,
        r.confianca,
        r.justificativa,
      ])
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REC_COLOR } }
      })
      row.getCell(3).numFmt = '"R$"#,##0.00'
    })

    const wsCp = wb.addWorksheet("Contrapropostas")
    wsCp.views = [{ showGridLines: false }]
    wsCp.columns = [{ width: 15 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 50 }]
    const headerCp = wsCp.addRow([
      "Código",
      "Melhor Preço (R$)",
      "Sugerido (R$)",
      "Redução (%)",
      "Justificativa",
    ])
    headerCp.height = 22
    headerCp.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLOR } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.alignment = { vertical: "middle" }
    })
    analysis.contrapropostas.forEach((cp) => {
      const row = wsCp.addRow([
        cp.material_code,
        cp.preco_atual_melhor,
        cp.preco_sugerido,
        cp.reducao_percentual,
        cp.justificativa,
      ])
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CP_COLOR } }
      })
      row.getCell(2).numFmt = '"R$"#,##0.00'
      row.getCell(3).numFmt = '"R$"#,##0.00'
      row.getCell(4).numFmt = '0.0"%"'
    })

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `analise-ia-${quotationCode ?? "cotacao"}-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!hasNewProposal) return

    removeCache(quotationId, roundId)
    setCooldown(0)
    void handleAnalyze(true)
    onAnalyzed?.()
  }, [hasNewProposal, quotationId, roundId, onAnalyzed])

  const highAlerts = analysis?.alertas.filter((a) => a.severidade === "alta").length ?? 0

  return (
    <div className="border border-violet-200 dark:border-violet-800 rounded-lg bg-violet-50/30 dark:bg-violet-900/10">
      <div
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setCollapsed(!collapsed)
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">Análise por IA</span>
          {generatedAt && (
            <span className="text-xs text-muted-foreground">· {formatDateTime(generatedAt)}</span>
          )}
          {highAlerts > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
              {highAlerts} alerta(s)
            </Badge>
          )}
          {loading && collapsed && autoAnalyzeRef.current && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {analysis && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-violet-300"
              onClick={async (e) => {
                e.stopPropagation()
                setExporting(true)
                try {
                  await handleExportExcel()
                } finally {
                  setExporting(false)
                }
              }}
              disabled={exporting}
            >
              <Download className="h-3 w-3" />
              {exporting ? "Exportando..." : "Excel"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-violet-300"
            onClick={(e) => {
              e.stopPropagation()
              void handleAnalyze(false)
            }}
            disabled={loading || cooldown > 0}
          >
            {loading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" /> Analisando...
              </>
            ) : cooldown > 0 ? (
              <>
                <Clock className="h-3 w-3" /> {formatCountdown(cooldown)}
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" /> Analisar
              </>
            )}
          </Button>
          <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-violet-200/50 dark:border-violet-800/50 max-h-72 overflow-y-auto">
          {loading && !analysis && (
            <div className="space-y-2 pt-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div
                  key={`skeleton-${i}`}
                  className="h-4 bg-violet-100 dark:bg-violet-900/30 rounded"
                  style={{ width: `${85 - i * 10}%` }}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive pt-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {analysis?.resumo_executivo && (
            <div className="pt-3">
              <p className="text-sm text-foreground leading-relaxed">{analysis.resumo_executivo}</p>
            </div>
          )}

          {analysis && analysis.alertas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Alertas
              </p>
              {analysis.alertas.map((alerta, i) => (
                <div
                  key={`${alerta.quotation_item_id}-${i}`}
                  className={`flex items-start gap-2 text-xs rounded-md px-3 py-2 ${
                    alerta.severidade === "alta"
                      ? "bg-destructive/10 text-destructive"
                      : alerta.severidade === "media"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    <strong>{alerta.material_code}</strong> — {alerta.mensagem}
                  </span>
                </div>
              ))}
            </div>
          )}

          {analysis && analysis.recomendacoes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Recomendações
              </p>
              {analysis.recomendacoes.map((rec, i) => (
                <div
                  key={`${rec.quotation_item_id}-${i}`}
                  className="flex items-start gap-2 text-xs bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300 rounded-md px-3 py-2"
                >
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  <div>
                    <span className="font-medium">{rec.material_code}</span>
                    {rec.fornecedor_recomendado_nome && <span> → {rec.fornecedor_recomendado_nome}</span>}
                    <span className="text-green-700 dark:text-green-300">
                      {" "}
                      ({formatBRL(rec.preco_recomendado)})
                    </span>
                    <span className="text-green-600 dark:text-green-400 ml-1">— {rec.justificativa}</span>
                    <Badge
                      className={`ml-2 text-xs border-0 ${
                        rec.confianca === "alta"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : rec.confianca === "media"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {rec.confianca}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysis && analysis.contrapropostas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Contrapropostas Sugeridas
              </p>
              {analysis.contrapropostas.map((cp, i) => (
                <div
                  key={`${cp.quotation_item_id}-${i}`}
                  className="flex items-start gap-2 text-xs bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-md px-3 py-2"
                >
                  <TrendingDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <span className="font-medium">{cp.material_code}</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {" "}
                      {formatBRL(cp.preco_atual_melhor)} → {formatBRL(cp.preco_sugerido)}
                    </span>
                    <span className="text-blue-500 dark:text-blue-400 ml-1">
                      (-{cp.reducao_percentual.toFixed(1)}%)
                    </span>
                    <span className="ml-1">— {cp.justificativa}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && !analysis && (
            <div className="text-center py-4 text-muted-foreground">
              <Sparkles className="h-6 w-6 mx-auto mb-1 opacity-30" />
              <p className="text-xs">Clique em &quot;Analisar&quot; para obter insights sobre as propostas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
