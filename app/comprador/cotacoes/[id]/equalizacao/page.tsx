"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Download,
  Check,
  Eye,
  Scissors,
  Trophy,
  Columns,
  Zap,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { logAudit } from "@/lib/audit"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

type QuotationItem = {
  id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string
}

type ProposalItem = {
  id: string
  proposal_id: string
  quotation_item_id: string
  unit_price: number
  tax_percent: number | null
  item_status: "accepted" | "rejected"
  observations: string | null
}

type Proposal = {
  id: string
  supplier_name: string
  supplier_cnpj: string | null
  total_price: number | null
  delivery_days: number | null
  payment_condition: string | null
  validity_date: string | null
  observations: string | null
  status: "submitted" | "selected" | "rejected"
  proposal_items: ProposalItem[]
}

type Quotation = {
  id: string
  code: string
  description: string
  status: string
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const formatCurrency = (value: number) => money.format(value)

function formatDateBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR")
}

function getTodayDDMMYYYY() {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const yyyy = String(now.getFullYear())
  return `${dd}${mm}${yyyy}`
}

async function downloadExcel(workbook: any, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function EqualizacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { companyId, userId } = useUser()
  const { hasFeature, hasPermission } = usePermissions()
  void hasFeature

  // Next.js 16: params é Promise
  const { id } = React.use(params)

  const [quotation, setQuotation] = React.useState<Quotation | null>(null)
  const [quotationItems, setQuotationItems] = React.useState<QuotationItem[]>([])
  const [proposals, setProposals] = React.useState<Proposal[]>([])
  const [loading, setLoading] = React.useState(true)
  const [itemSelections, setItemSelections] = React.useState<Record<string, string | null>>({})
  const [finalizing, setFinalizing] = React.useState(false)
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({
    prazo: true,
    preco_unit: true,
    imposto: true,
    total_item: true,
    cond_pgto: true,
  })
  const [columnsOpen, setColumnsOpen] = React.useState(false)
  const [splitExpanded, setSplitExpanded] = React.useState(false)
  const columnsRef = React.useRef<HTMLDivElement>(null)

  const isReadOnly = quotation?.status === "completed"

  const hasSelection = Object.values(itemSelections).filter(Boolean).length > 0

  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  React.useEffect(() => {
    if (!id) return
    const supabase = createClient()
    let alive = true

    const run = async () => {
      setLoading(true)
      const [qRes, itemsRes, proposalsRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("id, code, description, status")
          .eq("id", id)
          .single(),
        supabase.from("quotation_items").select("*").eq("quotation_id", id),
        supabase
          .from("quotation_proposals")
          .select("*, proposal_items(*)")
          .eq("quotation_id", id)
          .order("total_price", { ascending: true }),
      ])

      if (!alive) return

      const q = (qRes.data as Quotation) ?? null
      const items = ((itemsRes.data as unknown) as QuotationItem[]) ?? []
      const probs = ((proposalsRes.data as unknown) as Proposal[]) ?? []

      setQuotation(q)
      setQuotationItems(items)
      setProposals(probs)

      if (q?.status === "completed") {
        const initial: Record<string, string | null> = {}
        items.forEach((qi) => {
          initial[qi.id] = null
        })
        probs.forEach((p) => {
          p.proposal_items.forEach((pi) => {
            if (pi.item_status === "accepted") {
              initial[pi.quotation_item_id] = p.id
            }
          })
        })
        setItemSelections(initial)
      } else {
        const initial: Record<string, string | null> = {}
        items.forEach((qi) => {
          initial[qi.id] = null
        })
        setItemSelections(initial)
      }

      setLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [id])

  const quotationItemsById = React.useMemo(() => {
    return new Map(quotationItems.map((i) => [i.id, i]))
  }, [quotationItems])

  const menorPreco = React.useMemo(() => {
    const values = proposals.map((p) => p.total_price ?? Infinity)
    return values.length ? Math.min(...values) : Infinity
  }, [proposals])

  const menorPrazo = React.useMemo(() => {
    const values = proposals.map((p) => p.delivery_days ?? Infinity)
    return values.length ? Math.min(...values) : Infinity
  }, [proposals])

  // =========================
  // CÁLCULOS INTELIGENTES
  // =========================

  const coverageByProposal = React.useMemo(() => {
    const map: Record<
      string,
      { totalItens: number; itensAceitos: number; coveragePercent: number; coberturaLabel: string }
    > = {}
    proposals.forEach((p) => {
      const totalItens = p.proposal_items.length
      const itensAceitos = p.proposal_items.filter((i) => i.item_status === "accepted").length
      const coveragePercent = totalItens > 0 ? (itensAceitos / totalItens) * 100 : 0
      map[p.id] = {
        totalItens,
        itensAceitos,
        coveragePercent,
        coberturaLabel: `${coveragePercent.toFixed(0)}%`,
      }
    })
    return map
  }, [proposals])

  const bestCoverage = React.useMemo<
    | { proposal: Proposal; coveragePercent: number; itensAceitos: number; totalItens: number }
    | null
  >(() => {
    let best:
      | { proposal: Proposal; coveragePercent: number; itensAceitos: number; totalItens: number }
      | null = null
    proposals.forEach((p) => {
      const c = coverageByProposal[p.id]
      if (!c) return
      if (!best || c.coveragePercent > best.coveragePercent) {
        best = { proposal: p, ...c }
      }
    })
    return best
  }, [proposals, coverageByProposal])

  const bestPriceByItem = React.useMemo(() => {
    const best: Record<string, { price: number; proposalId: string }> = {}
    quotationItems.forEach((qi) => {
      let current: { price: number; proposalId: string } | null = null
      proposals.forEach((p) => {
        const pi = p.proposal_items.find(
          (i) =>
            i.quotation_item_id === qi.id &&
            i.item_status === "accepted" &&
            i.unit_price > 0,
        )
        if (pi && (!current || pi.unit_price < current.price)) {
          current = { price: pi.unit_price, proposalId: p.id }
        }
      })
      if (current) best[qi.id] = current
    })
    return best
  }, [quotationItems, proposals])

  const commonItems = React.useMemo(() => {
    return quotationItems.filter((qi) =>
      proposals.every((p) =>
        p.proposal_items.some(
          (i) =>
            i.quotation_item_id === qi.id &&
            i.item_status === "accepted" &&
            i.unit_price > 0,
        ),
      ),
    )
  }, [quotationItems, proposals])

  const weightedPriceByProposal = React.useMemo(() => {
    const map: Record<string, number> = {}
    proposals.forEach((p) => {
      const total = commonItems.reduce((sum, qi) => {
        const pi = p.proposal_items.find((i) => i.quotation_item_id === qi.id)
        return sum + (pi ? pi.unit_price * qi.quantity : 0)
      }, 0)
      map[p.id] = total
    })
    return map
  }, [proposals, commonItems])

  const minWeightedPrice = React.useMemo(() => {
    const values = Object.values(weightedPriceByProposal).filter((v) => v > 0)
    return values.length ? Math.min(...values) : Infinity
  }, [weightedPriceByProposal])

  const proposalItemsByProposal = React.useMemo(() => {
    const map = new Map<string, Map<string, ProposalItem>>()
    proposals.forEach((p) => {
      const byItem = new Map<string, ProposalItem>()
      p.proposal_items.forEach((pi) => byItem.set(pi.quotation_item_id, pi))
      map.set(p.id, byItem)
    })
    return map
  }, [proposals])

  const splitSuggestion = React.useMemo(() => {
    const suggestion: Record<
      string,
      { proposalId: string; supplierName: string; unitPrice: number }
    > = {}
    quotationItems.forEach((qi) => {
      const best = bestPriceByItem[qi.id]
      if (!best) return
      const supplier = proposals.find((p) => p.id === best.proposalId)
      suggestion[qi.id] = {
        proposalId: best.proposalId,
        supplierName: supplier?.supplier_name ?? "",
        unitPrice: best.price,
      }
    })
    return suggestion
  }, [quotationItems, bestPriceByItem, proposals])

  const splitTotalPrice = React.useMemo(() => {
    return quotationItems.reduce((sum, qi) => {
      const suggestion = splitSuggestion[qi.id]
      if (!suggestion) return sum
      return sum + suggestion.unitPrice * qi.quantity
    }, 0)
  }, [quotationItems, splitSuggestion])

  const splitSuppliers = React.useMemo(() => {
    return new Set(Object.values(splitSuggestion).map((s) => s.proposalId)).size
  }, [splitSuggestion])

  const handleToggleItem = (quotationItemId: string, proposalId: string) => {
    setItemSelections((prev) => {
      const current = prev[quotationItemId]
      if (current === proposalId) {
        return { ...prev, [quotationItemId]: null }
      }
      return { ...prev, [quotationItemId]: proposalId }
    })
  }

  const itemsQuotedBySupplier = React.useMemo(() => {
    const map = new Map<string, Set<string>>()
    proposals.forEach((p) => {
      const itemIds = new Set<string>()
      p.proposal_items.forEach((pi) => {
        if (pi.item_status === "accepted" && pi.unit_price > 0) {
          itemIds.add(pi.quotation_item_id)
        }
      })
      map.set(p.id, itemIds)
    })
    return map
  }, [proposals])

  const handleSelectAllForSupplier = (proposalId: string) => {
    const quoted = itemsQuotedBySupplier.get(proposalId)
    if (!quoted) return

    const quotedArr = Array.from(quoted)
    const allSelected = quotedArr.every((qiId) => itemSelections[qiId] === proposalId)

    if (allSelected) {
      setItemSelections((prev) => {
        const next = { ...prev }
        quotedArr.forEach((qiId) => {
          next[qiId] = null
        })
        return next
      })
    } else {
      setItemSelections((prev) => {
        const next = { ...prev }
        quotedArr.forEach((qiId) => {
          next[qiId] = proposalId
        })
        return next
      })
    }
  }

  const handleApplyBestPrice = () => {
    const next: Record<string, string | null> = {}
    quotationItems.forEach((qi) => {
      next[qi.id] = bestPriceByItem[qi.id]?.proposalId ?? null
    })
    setItemSelections(next)
    toast.success("Seleção automática aplicada — melhores preços por item.")
  }

  const handleClearAllSelections = () => {
    setItemSelections({})
  }

  const selectionSummary = React.useMemo(() => {
    const selectedCount = quotationItems.filter((qi) => itemSelections[qi.id] != null).length
    const totalCount = quotationItems.length

    const byProposal: { proposalId: string; supplierName: string; itemCount: number; total: number }[] = []
    proposals.forEach((p) => {
      let count = 0
      let total = 0
      quotationItems.forEach((qi) => {
        if (itemSelections[qi.id] === p.id) {
          count++
          const pi = proposalItemsByProposal.get(p.id)?.get(qi.id)
          if (pi) {
            total += pi.unit_price * qi.quantity
          }
        }
      })
      if (count > 0) {
        byProposal.push({
          proposalId: p.id,
          supplierName: p.supplier_name,
          itemCount: count,
          total,
        })
      }
    })

    const grandTotal = byProposal.reduce((s, x) => s + x.total, 0)
    const allSelected = selectedCount === totalCount

    return { selectedCount, totalCount, byProposal, grandTotal, allSelected }
  }, [quotationItems, proposals, itemSelections, proposalItemsByProposal])

  const handleFinalize = async () => {
    if (!quotation || !companyId || !userId) return
    if (!selectionSummary.allSelected) return
    if (!hasPermission("order.create")) return

    setFinalizing(true)

    try {
      const supabase = createClient()

      for (const p of proposals) {
        const updates: { id: string; item_status: "accepted" | "rejected" }[] = []
        p.proposal_items.forEach((pi) => {
          const selected = itemSelections[pi.quotation_item_id] === p.id
          updates.push({ id: pi.id, item_status: selected ? "accepted" : "rejected" })
        })

        for (const u of updates) {
          await supabase
            .from("proposal_items")
            .update({ item_status: u.item_status })
            .eq("id", u.id)
        }

        const hasAnyAccepted = updates.some((u) => u.item_status === "accepted")
        await supabase
          .from("quotation_proposals")
          .update({
            status: hasAnyAccepted ? "selected" : "rejected",
            ...(hasAnyAccepted ? { selected_at: new Date().toISOString() } : {}),
          })
          .eq("id", p.id)
      }

      await supabase.from("quotations").update({ status: "completed" }).eq("id", quotation.id)

      await logAudit({
        eventType: "quotation.updated",
        description: `Cotação ${quotation.code} finalizada com seleção de itens por fornecedor`,
        companyId,
        userId,
        entity: "quotation",
        entityId: quotation.id,
      })

      setQuotation((prev) => (prev ? { ...prev, status: "completed" } : null))
      router.push(`/comprador/cotacoes/${id}/novo-pedido`)
    } catch (err) {
      console.error(err)
      toast.error("Erro ao finalizar cotação. Tente novamente.")
    } finally {
      setFinalizing(false)
    }
  }

  const handleExportExcel = async () => {
    if (!quotation) return

    const ExcelJS = (await import("exceljs")).default
    const workbook = new ExcelJS.Workbook()
    const safeCode = quotation.code.replaceAll("/", "-").replaceAll("\\", "-").replaceAll(" ", "_")
    const filename = `equalizacao_${safeCode}_${getTodayDDMMYYYY()}.xlsx`

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    } as any
    const headerFont = { color: { argb: "FFFFFFFF" }, bold: true }
    const border = {
      top: { style: "thin", color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
      left: { style: "thin", color: { argb: "FFDDDDDD" } },
      right: { style: "thin", color: { argb: "FFDDDDDD" } },
    } as any

    const sanitizeSheetName = (name: string) => {
      const clean = name.replace(/[\\\/\?\*\[\]\:]/g, " ").trim()
      return (clean || "Fornecedor").slice(0, 31)
    }

    const usedNames = new Map<string, number>()

    proposals.forEach((p) => {
      const base = sanitizeSheetName(p.supplier_name)
      const count = (usedNames.get(base) ?? 0) + 1
      usedNames.set(base, count)
      const sheetName = count === 1 ? base : sanitizeSheetName(`${base} ${count}`)

      const ws = workbook.addWorksheet(sheetName)

      ws.columns = [
        { width: 15 }, // A
        { width: 35 }, // B
        { width: 8 }, // C
        { width: 10 }, // D
        { width: 15 }, // E
        { width: 12 }, // F
        { width: 15 }, // G
        { width: 12 }, // H
        { width: 30 }, // I
      ]

      ws.mergeCells("A1:I1")
      const title = ws.getCell("A1")
      title.value = `Proposta — ${p.supplier_name}`
      title.fill = headerFill
      title.font = { ...headerFont, size: 13 }
      title.alignment = { horizontal: "center", vertical: "middle" }
      title.border = border
      ws.getRow(1).height = 22

      ws.addRow([])

      const cov = coverageByProposal[p.id]
      const totalItens = cov?.totalItens ?? p.proposal_items.length
      const itensAceitos = cov?.itensAceitos ?? p.proposal_items.filter((i) => i.item_status === "accepted").length
      const percent = cov ? cov.coveragePercent : totalItens > 0 ? (itensAceitos / totalItens) * 100 : 0

      const infoRows: Array<[string, string]> = [
        ["Preço Total Aceito:", p.total_price == null ? "—" : formatCurrency(p.total_price)],
        ["Prazo de Entrega:", p.delivery_days == null ? "—" : `${p.delivery_days} dias`],
        ["Pagamento:", p.payment_condition ?? "—"],
        ["Validade:", formatDateBR(p.validity_date)],
        ["Cobertura:", `${itensAceitos} de ${totalItens} itens (${percent.toFixed(0)}%)`],
        ["Observações:", p.observations ?? "—"],
      ]

      infoRows.forEach(([label, value]) => {
        const r = ws.addRow([label, value])
        r.getCell(1).font = { bold: true }
        r.getCell(1).alignment = { vertical: "top" }
        r.getCell(2).alignment = { vertical: "top", wrapText: true }
      })

      ws.addRow([])

      const headerRow = ws.addRow([
        "Código",
        "Descrição Curta",
        "Qtd",
        "Unidade",
        "Preço Unit.",
        "Impostos",
        "Total Item",
        "Status",
        "Observações",
      ])
      headerRow.height = 18
      headerRow.eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = { ...headerFont, size: 11 }
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })

      let acceptedSum = 0

      quotationItems.forEach((qi) => {
        const pi = p.proposal_items.find((i) => i.quotation_item_id === qi.id)
        const accepted = !!pi && pi.item_status === "accepted" && pi.unit_price > 0
        const rejected = !accepted

        const unitPrice = accepted ? pi!.unit_price : null
        const totalItem = accepted ? pi!.unit_price * qi.quantity : null
        if (accepted && totalItem != null) acceptedSum += totalItem

        const row = ws.addRow([
          qi.material_code,
          qi.material_description,
          qi.quantity,
          qi.unit_of_measure,
          accepted ? unitPrice : "—",
          accepted ? (pi!.tax_percent == null ? "—" : `${pi!.tax_percent}%`) : "—",
          accepted ? totalItem : "—",
          accepted ? "Aceito" : "Recusado",
          pi?.observations ?? "—",
        ])

        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
          cell.border = border
          cell.alignment = { vertical: "middle", wrapText: colNumber === 2 || colNumber === 9 }
        })

        if (rejected) {
          row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0F0" } }
            cell.font = { color: { argb: "FF6B7280" } }
          })
        } else {
          row.getCell(5).numFmt = '"R$" #,##0.00'
          row.getCell(7).numFmt = '"R$" #,##0.00'
        }
      })

      const totalRow = ws.addRow(["TOTAL (itens aceitos)", "", "", "", "", "", acceptedSum, "", ""])
      ws.mergeCells(`A${totalRow.number}:F${totalRow.number}`)
      totalRow.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } }
        cell.font = { bold: true }
        cell.border = border
        cell.alignment = { vertical: "middle" }
        if (colNumber === 7) cell.numFmt = '"R$" #,##0.00'
      })
    })

    await downloadExcel(workbook, filename)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/comprador/cotacoes/${id}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Equalização de Propostas</h1>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Buscando dados da cotação e propostas...
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <Eye className="h-5 w-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            Esta cotação está concluída. Visualização somente leitura do histórico de propostas.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/comprador/cotacoes/${id}`)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Equalização de Propostas</h1>
          <p className="text-muted-foreground">
            {quotation ? `${quotation.code} — ${quotation.description}` : `Cotação ${id}`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Menor Preço Total</p>
                <p className="text-2xl font-bold">
                  {menorPreco === Infinity ? "—" : formatCurrency(menorPreco)}
                </p>
                <p className="text-xs text-muted-foreground">
                  * considera apenas itens aceitos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Menor Prazo</p>
                <p className="text-2xl font-bold">
                  {menorPrazo === Infinity ? "—" : `${menorPrazo} dias`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Melhor Cobertura</p>
                <p className="text-2xl font-bold">
                  {bestCoverage ? `${bestCoverage.coveragePercent.toFixed(0)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bestCoverage
                    ? `${bestCoverage.proposal.supplier_name} (${bestCoverage.itensAceitos} itens)`
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border border-purple-100">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Scissors className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Economia no Split</p>
                <p className="text-2xl font-bold">{formatCurrency(splitTotalPrice)}</p>
                <p className="text-xs text-muted-foreground">
                  Dividindo entre {splitSuppliers} fornecedores
                </p>
                <p className="text-xs text-muted-foreground">
                  Menor custo possível combinando melhores preços por item
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de Cotação</CardTitle>
          <p className="text-sm text-muted-foreground">
            Itens nas linhas, fornecedores nas colunas. Clique em Colunas para exibir ou ocultar campos.
          </p>
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhuma proposta encontrada para esta cotação.
            </p>
          ) : (
          (() => {
            const toggleableKeys = [
              "prazo",
              "preco_unit",
              "imposto",
              "total_item",
              "cond_pgto",
            ] as const
            const visibleToggleable = toggleableKeys.filter((k) => columnVisibility[k])
            const colsPerSupplier = visibleToggleable.length + 1
            const supplierWithLowestTotal = proposals.find(
              (p) => p.total_price != null && p.total_price === menorPreco,
            )
            const colWidths: Record<string, number> = {
              prazo: 80,
              preco_unit: 100,
              imposto: 80,
              total_item: 100,
              cond_pgto: 80,
              selecao: 40,
            }
            const supplierColWidth =
              toggleableKeys.filter((k) => columnVisibility[k]).reduce((s, k) => s + colWidths[k], 0) +
              colWidths.selecao
            const FIXED_WIDTH = 466
            const minTableWidth = FIXED_WIDTH + proposals.length * supplierColWidth

            return (
              <div className="overflow-x-auto">
                <table
                  className="w-full caption-bottom text-sm"
                  style={{ minWidth: minTableWidth }}
                >
                  <TableHeader className="bg-white dark:bg-[#09090b]">
                    <TableRow>
                      <TableHead
                        colSpan={4}
                        rowSpan={1}
                        scope="col"
                        className="sticky left-0 z-50 min-w-[466px] w-[466px] align-top bg-white dark:bg-[#09090b] border-b border-r border-border px-3 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.4)]"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-row gap-2 items-center flex-nowrap">
                            {!isReadOnly && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleApplyBestPrice}
                              >
                                <Zap className="mr-2 h-4 w-4 shrink-0" />
                                Melhor Preço
                              </Button>
                            )}
                            <div ref={columnsRef} className="relative shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setColumnsOpen((o) => !o)}
                              >
                                <Columns className="mr-2 h-4 w-4 shrink-0" />
                                Colunas
                              </Button>
                              {columnsOpen && (
                                <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-lg min-w-[180px] py-2">
                                  {(
                                    [
                                      { key: "prazo", label: "Prazo (dias)" },
                                      { key: "preco_unit", label: "Preço Unit." },
                                      { key: "imposto", label: "Imposto %" },
                                      { key: "total_item", label: "Total Item" },
                                      { key: "cond_pgto", label: "Cond. Pgto" },
                                    ] as const
                                  ).map(({ key, label }) => (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() =>
                                        setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
                                      }
                                      className={cn(
                                        "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 text-left",
                                        columnVisibility[key] && "bg-primary/5",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border",
                                          columnVisibility[key] && "bg-primary",
                                        )}
                                      >
                                        {columnVisibility[key] ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
                                      </span>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleExportExcel}
                              disabled={!quotation}
                              className="shrink-0"
                            >
                              <Download className="mr-2 h-4 w-4 shrink-0" />
                              Exportar
                            </Button>
                            {hasSelection && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClearAllSelections}
                                className="shrink-0"
                              >
                                <XCircle className="mr-2 h-4 w-4 shrink-0" />
                                Desmarcar Tudo
                              </Button>
                            )}
                          </div>
                          {hasSelection && (
                            <>
                              <div className="border-t border-border pt-1.5 mt-0.5">
                                <p className="text-sm font-medium">
                                  {selectionSummary.selectedCount} de {selectionSummary.totalCount} itens selecionados
                                </p>
                                {selectionSummary.byProposal.map((b) => (
                                  <p key={b.proposalId} className="text-xs text-muted-foreground">
                                    {b.supplierName}: {b.itemCount} itens — {formatCurrency(b.total)}
                                  </p>
                                ))}
                                <p className="text-sm font-semibold text-primary mt-1">
                                  Total: {formatCurrency(selectionSummary.grandTotal)}
                                </p>
                              </div>
                              <div>
                                {!hasPermission("order.create") ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button
                                          variant="default"
                                          size="sm"
                                          disabled={!selectionSummary.allSelected}
                                          title="Sem permissão"
                                          className="w-full"
                                        >
                                          <ShoppingCart className="mr-2 h-4 w-4" />
                                          Criar Pedido
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Você não tem permissão para esta ação</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={handleFinalize}
                                    disabled={!selectionSummary.allSelected || finalizing}
                                    className="w-full"
                                  >
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    {finalizing ? "Criando..." : "Criar Pedido"}
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </TableHead>
                      {proposals.map((p) => (
                        <TableHead
                          key={p.id}
                          colSpan={colsPerSupplier}
                          className={cn(
                            "border-l relative z-10 py-4",
                            supplierWithLowestTotal?.id === p.id &&
                              "ring-2 ring-primary ring-inset bg-primary/5",
                          )}
                          style={{ minWidth: supplierColWidth, width: supplierColWidth }}
                        >
                          <div className="flex flex-col gap-1 p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{p.supplier_name}</span>
                              {supplierWithLowestTotal?.id === p.id && (
                                <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {p.supplier_cnpj ?? "—"}
                            </span>
                            <div className="border-t border-border my-1" />
                            <span className="text-xs font-medium">
                              Total: {p.total_price == null ? "—" : formatCurrency(p.total_price)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Ponderado:{" "}
                              {commonItems.length === 0
                                ? "—"
                                : formatCurrency(weightedPriceByProposal[p.id] ?? 0)}
                            </span>
                            {!isReadOnly && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit mt-2"
                                type="button"
                                onClick={() => handleSelectAllForSupplier(p.id)}
                              >
                                Selecionar Todos
                              </Button>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableHead className="sticky left-0 z-20 min-w-[90px] w-[90px] bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium">
                        Código
                      </TableHead>
                      <TableHead className="sticky left-[90px] z-20 min-w-[300px] w-[300px] bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium">
                        Descrição
                      </TableHead>
                      <TableHead className="sticky left-[390px] z-20 min-w-[38px] w-[38px] bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium text-center">
                        Qtd
                      </TableHead>
                      <TableHead className="sticky left-[428px] z-20 min-w-[38px] w-[38px] bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                        UN
                      </TableHead>
                      {proposals.map((p) => (
                        <React.Fragment key={p.id}>
                          {columnVisibility.prazo && (
                            <TableHead
                              key={`${p.id}-prazo`}
                              className="min-w-[80px] w-[80px] border-l text-center text-xs whitespace-nowrap py-2"
                            >
                              Prazo (dias)
                            </TableHead>
                          )}
                          {columnVisibility.preco_unit && (
                            <TableHead
                              key={`${p.id}-preco`}
                              className="min-w-[100px] w-[100px] border-l text-center text-xs whitespace-nowrap py-2"
                            >
                              Preço Unit.
                            </TableHead>
                          )}
                          {columnVisibility.imposto && (
                            <TableHead
                              key={`${p.id}-imposto`}
                              className="min-w-[80px] w-[80px] border-l text-center text-xs whitespace-nowrap py-2"
                            >
                              Imposto %
                            </TableHead>
                          )}
                          {columnVisibility.total_item && (
                            <TableHead
                              key={`${p.id}-total`}
                              className="min-w-[100px] w-[100px] border-l text-center text-xs whitespace-nowrap py-2"
                            >
                              Total Item
                            </TableHead>
                          )}
                          {columnVisibility.cond_pgto && (
                            <TableHead
                              key={`${p.id}-cond`}
                              className="min-w-[80px] w-[80px] border-l text-center text-xs whitespace-nowrap py-2"
                            >
                              Cond. Pgto
                            </TableHead>
                          )}
                          <TableHead
                            key={`${p.id}-sel`}
                            className="min-w-[40px] w-[40px] border-l text-center text-xs whitespace-nowrap py-2"
                          >
                            ✓
                          </TableHead>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationItems.map((qi, rowIdx) => (
                      <TableRow
                        key={qi.id}
                        className={cn(
                          rowIdx % 2 === 1 && "bg-muted/30",
                          itemSelections[qi.id] != null && "bg-primary/5",
                        )}
                      >
                        <TableCell
                          className={cn(
                            "sticky left-0 z-20 min-w-[90px] w-[90px] font-mono text-xs whitespace-nowrap",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.material_code}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "sticky left-[90px] z-20 min-w-[300px] w-[300px] whitespace-nowrap",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.material_description}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "sticky left-[390px] z-20 min-w-[38px] w-[38px] text-center whitespace-nowrap",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.quantity}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "sticky left-[428px] z-20 min-w-[38px] w-[38px] text-center whitespace-nowrap border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.unit_of_measure}
                        </TableCell>
                        {proposals.map((p) => {
                          const pi = proposalItemsByProposal.get(p.id)?.get(qi.id)
                          const quoted =
                            !!pi && pi.item_status === "accepted" && pi.unit_price > 0
                          const totalItem = quoted ? (pi!.unit_price ?? 0) * qi.quantity : 0
                          const isBestPrice =
                            !!quoted && bestPriceByItem[qi.id]?.proposalId === p.id

                          return (
                            <React.Fragment key={p.id}>
                              {columnVisibility.prazo && (
                                <TableCell
                                  key={`${p.id}-prazo`}
                                  className={cn(
                                    "min-w-[80px] w-[80px] border-l text-center text-sm whitespace-nowrap",
                                    !quoted && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {quoted && p.delivery_days != null
                                    ? `${p.delivery_days}`
                                    : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.preco_unit && (
                                <TableCell
                                  key={`${p.id}-preco`}
                                  className={cn(
                                    "min-w-[100px] w-[100px] border-l text-center text-sm whitespace-nowrap",
                                    !quoted && "text-muted-foreground",
                                    quoted && isBestPrice && "bg-green-50 text-green-700 font-semibold",
                                    itemSelections[qi.id] != null && !isBestPrice && "bg-primary/5",
                                  )}
                                >
                                  {quoted ? formatCurrency(pi!.unit_price) : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.imposto && (
                                <TableCell
                                  key={`${p.id}-imposto`}
                                  className={cn(
                                    "min-w-[80px] w-[80px] border-l text-center text-sm whitespace-nowrap",
                                    !quoted && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {quoted && pi!.tax_percent != null ? `${pi!.tax_percent}%` : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.total_item && (
                                <TableCell
                                  key={`${p.id}-total`}
                                  className={cn(
                                    "min-w-[100px] w-[100px] border-l text-center text-sm whitespace-nowrap",
                                    !quoted && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {quoted
                                    ? totalItem.toLocaleString("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      })
                                    : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.cond_pgto && (
                                <TableCell
                                  key={`${p.id}-cond`}
                                  className={cn(
                                    "min-w-[80px] w-[80px] border-l text-center text-sm whitespace-nowrap",
                                    !quoted && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {quoted ? (p.payment_condition ?? "—") : "—"}
                                </TableCell>
                              )}
                              <TableCell
                                key={`${p.id}-sel`}
                                className={cn(
                                  "min-w-[40px] w-[40px] border-l text-center whitespace-nowrap",
                                  itemSelections[qi.id] != null && "bg-primary/5",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={itemSelections[qi.id] === p.id}
                                  disabled={!quoted || isReadOnly}
                                  onChange={() => handleToggleItem(qi.id, p.id)}
                                  className={cn(
                                    "cursor-pointer",
                                    (!quoted || isReadOnly) && "opacity-40 cursor-not-allowed",
                                  )}
                                />
                              </TableCell>
                            </React.Fragment>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )
          })()
          )}
        </CardContent>
      </Card>

      <div className="bg-purple-50 border border-purple-200 rounded-xl mt-6 overflow-hidden transition-all duration-200">
        <button
          type="button"
          onClick={() => setSplitExpanded((e) => !e)}
          className="flex w-full items-center gap-2 p-5 text-left hover:bg-purple-50/80 transition-colors"
        >
          <Scissors className="w-5 h-5 text-purple-600 shrink-0" />
          <h3 className="font-semibold text-purple-800 flex-1">
            Sugestão de Split de Fornecedores
          </h3>
          <Badge className="bg-purple-100 text-purple-700">
            Economia máxima: {formatCurrency(splitTotalPrice)}
          </Badge>
          {splitExpanded ? (
            <ChevronUp className="w-5 h-5 text-purple-600 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-purple-600 shrink-0" />
          )}
        </button>
        {splitExpanded && (
          <div className="border-t border-purple-200 p-5 transition-all duration-200">
            <p className="text-sm text-purple-700 mb-3">
              Combinando os melhores preços por item entre todos os fornecedores, o custo total seria{" "}
              {formatCurrency(splitTotalPrice)} dividido entre {splitSuppliers} fornecedor(es).
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição Curta</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Fornecedor Sugerido</TableHead>
                  <TableHead>Preço Unit.</TableHead>
                  <TableHead>Total Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotationItems.map((qi) => {
                  const suggestion = splitSuggestion[qi.id]
                  if (!suggestion) return null
                  return (
                    <TableRow key={qi.id}>
                      <TableCell className="font-mono text-sm">{qi.material_code}</TableCell>
                      <TableCell>{qi.material_description}</TableCell>
                      <TableCell>
                        {qi.quantity} {qi.unit_of_measure}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-purple-700">{suggestion.supplierName}</span>
                      </TableCell>
                      <TableCell>{formatCurrency(suggestion.unitPrice)}</TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(suggestion.unitPrice * qi.quantity)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

    </div>
  )
}
