"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Download,
  Check,
  ChevronDown,
  ChevronUp,
  Scissors,
  Trophy,
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
  const [expandedProposal, setExpandedProposal] = React.useState<string | null>(null)
  const [selecting, setSelecting] = React.useState<string | null>(null)

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

      setQuotation((qRes.data as Quotation) ?? null)
      setQuotationItems(((itemsRes.data as unknown) as QuotationItem[]) ?? [])
      setProposals(((proposalsRes.data as unknown) as Proposal[]) ?? [])
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

  const proposalSelecionada = React.useMemo(() => {
    return proposals.find((p) => p.status === "selected") ?? null
  }, [proposals])

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

  const handleSelectProposal = async (proposalId: string) => {
    if (!quotation) return
    const selected = proposals.find((p) => p.id === proposalId)
    if (!selected) return

    setSelecting(proposalId)

    // optimistic
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? { ...p, status: "selected" }
          : { ...p, status: "rejected" },
      ),
    )

    try {
      const supabase = createClient()
      await supabase
        .from("quotation_proposals")
        .update({ status: "selected", selected_at: new Date().toISOString() })
        .eq("id", proposalId)

      await supabase
        .from("quotation_proposals")
        .update({ status: "rejected" })
        .eq("quotation_id", id)
        .neq("id", proposalId)

      await logAudit({
        eventType: "quotation.updated",
        description: `Fornecedor "${selected.supplier_name}" selecionado na cotação ${quotation.code}`,
        companyId,
        userId,
        entity: "quotation",
        entityId: quotation.id,
      })
    } finally {
      setSelecting(null)
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
          <Button variant="ghost" size="icon" onClick={() => router.push(`/comprador/cotacoes/${id}`)}>
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
        <Button variant="outline" onClick={handleExportExcel} disabled={!quotation}>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
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
          <CardTitle>Comparativo de Propostas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Fornecedor</TableHead>
                  <TableHead className="text-right">Preço Total</TableHead>
                  <TableHead className="text-right">Preço Ponderado</TableHead>
                  <TableHead className="text-center">Prazo Entrega</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-center">Cobertura</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => {
                  const isSelected = proposal.status === "selected"
                  const anotherSelected = !!proposalSelecionada && !isSelected
                  const weighted = weightedPriceByProposal[proposal.id] ?? 0
                  const isBestWeighted =
                    commonItems.length > 0 &&
                    weighted > 0 &&
                    minWeightedPrice !== Infinity &&
                    weighted === minWeightedPrice
                  const expanded = expandedProposal === proposal.id

                  const buttonVariant = isSelected
                    ? "outline"
                    : proposalSelecionada
                      ? "ghost"
                      : "default"

                  const cov = coverageByProposal[proposal.id]
                  const covPercent = cov?.coveragePercent ?? 0
                  const covLabel = cov?.coberturaLabel ?? "0%"
                  const covBadgeClass =
                    covPercent >= 100
                      ? "bg-green-100 text-green-800"
                      : covPercent >= 70
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"

                  return (
                    <React.Fragment key={proposal.id}>
                      <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{proposal.supplier_name}</span>
                            {isSelected && (
                              <Badge variant="default" className="bg-success text-success-foreground">
                                Selecionado
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {proposal.supplier_cnpj ?? "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">
                        {proposal.total_price == null ? "—" : formatCurrency(proposal.total_price)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {commonItems.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span
                            className={cn(
                              "font-medium",
                              isBestWeighted && "text-green-600 font-bold",
                            )}
                          >
                            {formatCurrency(weighted)}
                          </span>
                          <span className="text-xs text-muted-foreground">itens comuns</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {proposal.delivery_days == null ? "—" : `${proposal.delivery_days} dias`}
                    </TableCell>
                    <TableCell className="text-center">
                      {proposal.payment_condition ?? "—"}
                    </TableCell>
                    <TableCell>{formatDateBR(proposal.validity_date)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("font-medium", covBadgeClass)}>{covLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedProposal((prev) => (prev === proposal.id ? null : proposal.id))
                        }
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 mr-1" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-1" />
                        )}
                        Ver Itens
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      {!hasPermission("quotation.equalize") ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                variant={buttonVariant as any}
                                disabled
                                title="Sem permissão"
                                className={cn(isSelected && "text-green-600 border-green-200")}
                                onClick={() => handleSelectProposal(proposal.id)}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Selecionado
                                  </>
                                ) : (
                                  "Selecionar"
                                )}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Você não tem permissão para esta ação
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          size="sm"
                          variant={buttonVariant as any}
                          disabled={isSelected || selecting === proposal.id}
                          className={cn(isSelected && "text-green-600 border-green-200")}
                          onClick={() => handleSelectProposal(proposal.id)}
                        >
                          {isSelected ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Selecionado
                            </>
                          ) : (
                            "Selecionar"
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                      {expanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9}>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[110px]">Código</TableHead>
                                    <TableHead className="min-w-[280px]">Descrição Curta</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead className="text-center">Unidade</TableHead>
                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                    <TableHead className="text-right">Impostos</TableHead>
                                    <TableHead className="text-right">Total Item</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {proposal.proposal_items?.length ? (
                                    proposal.proposal_items.map((pi) => {
                                      const qi = quotationItemsById.get(pi.quotation_item_id)
                                      const qty = qi?.quantity ?? 0
                                      const totalItem = (pi.unit_price ?? 0) * qty
                                      const isBestItemPrice =
                                        !!qi && bestPriceByItem[qi.id]?.proposalId === proposal.id
                                      return (
                                        <TableRow key={pi.id}>
                                          <TableCell className="font-medium">
                                            {qi?.material_code ?? "—"}
                                          </TableCell>
                                          <TableCell>{qi?.material_description ?? "—"}</TableCell>
                                          <TableCell className="text-right">{qty}</TableCell>
                                          <TableCell className="text-center">
                                            {qi?.unit_of_measure ?? "—"}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <span
                                              className={cn(
                                                isBestItemPrice && "font-bold text-green-600",
                                              )}
                                            >
                                              {formatCurrency(pi.unit_price ?? 0)}
                                            </span>
                                            {isBestItemPrice && (
                                              <Trophy className="inline ml-1 h-4 w-4 text-yellow-500" />
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {pi.tax_percent == null ? "—" : `${pi.tax_percent}%`}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {formatCurrency(totalItem)}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {pi.item_status === "accepted" ? (
                                              <Badge
                                                variant="default"
                                                className="bg-success text-success-foreground"
                                              >
                                                Aceito
                                              </Badge>
                                            ) : (
                                              <Badge variant="destructive">Recusado</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })
                                  ) : (
                                    <TableRow>
                                      <TableCell colSpan={8} className="text-sm text-muted-foreground">
                                        Nenhum item encontrado nesta proposta.
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Scissors className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-800">Sugestão de Split de Fornecedores</h3>
          <Badge className="bg-purple-100 text-purple-700 ml-auto">
            Economia máxima: {formatCurrency(splitTotalPrice)}
          </Badge>
        </div>
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

      <div className="flex justify-end gap-2">
        {proposalSelecionada && (
          !hasPermission("order.create") ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled title="Sem permissão">
                    Finalizar Cotação
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Você não tem permissão para esta ação</TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => router.push(`/comprador/cotacoes/${id}/novo-pedido`)}>
              Finalizar Cotação
            </Button>
          )
        )}
      </div>
    </div>
  )
}
