"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Download,
  Check,
  Info,
  Eye,
  Scissors,
  Trophy,
  Columns,
  Zap,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  XCircle,
  LockKeyhole,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  long_description?: string | null
  quantity: number
  unit_of_measure: string
}

type OrderedItemInfo = {
  orderId: string
  orderCode: string
  proposalId: string
  roundId: string | null
  roundNumber: number | null
}

type Round = {
  id: string
  company_id?: string
  round_number: number
  status: "active" | "closed"
  created_at: string
  closed_at: string | null
  response_deadline: string | null
}

type ProposalItem = {
  id: string
  proposal_id: string
  quotation_item_id: string
  round_id?: string | null
  unit_price: number
  tax_percent: number | null
  delivery_days?: number | null
  item_status: "accepted" | "rejected"
  observations: string | null
}

type Proposal = {
  id: string
  round_id?: string | null
  supplier_id?: string | null
  supplier_name: string
  supplier_cnpj: string | null
  total_price: number | null
  delivery_days: number | null
  payment_condition: string | null
  validity_date: string | null
  observations: string | null
  status: "invited" | "submitted" | "selected" | "rejected"
  proposal_items: ProposalItem[]
}

function proposalItemsForSelectedRound(
  p: Proposal,
  selectedRoundId: string | null,
): ProposalItem[] {
  if (!selectedRoundId) return []
  return p.proposal_items.filter(
    (pi) =>
      pi.quotation_item_id &&
      (pi.round_id === selectedRoundId || pi.round_id == null),
  )
}

function sameSupplier(a: Proposal, b: Proposal): boolean {
  if (a.supplier_id != null && b.supplier_id != null) return a.supplier_id === b.supplier_id
  if (a.supplier_cnpj && b.supplier_cnpj) return a.supplier_cnpj === b.supplier_cnpj
  return a.supplier_name === b.supplier_name
}

function findProposalInRound(
  catalog: Proposal[],
  roundId: string,
  columnProposal: Proposal,
): Proposal | undefined {
  return catalog.find((p) => p.round_id === roundId && sameSupplier(p, columnProposal))
}

function getProposalItemForQuotationItem(
  columnProposal: Proposal,
  quotationItemId: string,
  itemRoundId: string | null,
  catalog: Proposal[],
): ProposalItem | undefined {
  if (!itemRoundId) return undefined
  const target =
    columnProposal.round_id === itemRoundId
      ? columnProposal
      : findProposalInRound(catalog, itemRoundId, columnProposal)
  if (!target) return undefined
  return target.proposal_items.find(
    (pi) =>
      pi.quotation_item_id === quotationItemId &&
      (pi.round_id === itemRoundId || pi.round_id == null),
  )
}

function getTargetProposalForCell(
  columnProposal: Proposal,
  itemRoundId: string | null,
  catalog: Proposal[],
): Proposal | undefined {
  if (!itemRoundId) return undefined
  if (columnProposal.round_id === itemRoundId) return columnProposal
  return findProposalInRound(catalog, itemRoundId, columnProposal)
}

type Quotation = {
  id: string
  code: string
  description: string
  status: string
  category?: string | null
  payment_condition?: string | null
  response_deadline?: string | null
  created_at?: string | null
}

/** Convites na cotação — ordem das colunas na equalização segue o array retornado pelo banco. */
type QuotationSupplier = {
  supplier_id: string
  position: number | null
  suppliers?:
    | { name: string; cnpj: string | null }
    | { name: string; cnpj: string | null }[]
    | null
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

/** Rótulo de status no export Excel (item_status + preço cotado). */
function excelExportItemStatusLabel(
  pi: ProposalItem | undefined,
  hasOrderElsewhere: boolean,
): string {
  if (hasOrderElsewhere) return "Pedido em outro fornecedor"
  if (!pi) return "—"
  const up = pi.unit_price
  if (pi.item_status === "accepted" && up > 0) return "Aceito"
  if (pi.item_status === "rejected" && up === 0) return "Recusado"
  if (pi.item_status === "rejected" && up > 0) return "Respondido"
  return "—"
}

function getQuotationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Rascunho",
    waiting: "Aguardando Resposta",
    analysis: "Em Análise",
    completed: "Concluída",
    cancelled: "Cancelada",
  }
  return labels[status] ?? status
}

function pickNestedRoundNumber(
  quotation_rounds: { round_number: number } | { round_number: number }[] | null | undefined,
): number | null {
  if (!quotation_rounds) return null
  const o = Array.isArray(quotation_rounds) ? quotation_rounds[0] : quotation_rounds
  return o?.round_number ?? null
}

/** Fim do dia local (23:59:59.999) a partir de `YYYY-MM-DD` ou ISO. */
function getRoundDeadlineEnd(deadline: string | null): Date | null {
  if (!deadline?.trim()) return null
  const s = deadline.trim().slice(0, 10)
  const parts = s.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [y, m, d] = parts
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0d 0h 0m 0s"
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${days}d ${h}h ${m}m ${sec}s`
}

function getTomorrowInputMin(): string {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  const y = t.getFullYear()
  const mo = String(t.getMonth() + 1).padStart(2, "0")
  const da = String(t.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

/** Ordena propostas da rodada na mesma ordem das colunas (quotation_suppliers já ordenado no load). */
function orderProposalsByQuotationSupplierColumnOrder(
  roundProposals: Proposal[],
  quotationSuppliersOrdered: QuotationSupplier[],
): Proposal[] {
  const supplierColumnIndex = new Map<string, number>()
  quotationSuppliersOrdered.forEach((row, index) => {
    supplierColumnIndex.set(row.supplier_id, index)
  })
  return [...roundProposals].sort((a, b) => {
    const ia =
      a.supplier_id != null ? supplierColumnIndex.get(a.supplier_id) : undefined
    const ib =
      b.supplier_id != null ? supplierColumnIndex.get(b.supplier_id) : undefined
    const va = ia === undefined ? Number.MAX_SAFE_INTEGER : ia
    const vb = ib === undefined ? Number.MAX_SAFE_INTEGER : ib
    if (va !== vb) return va - vb
    return a.supplier_name.localeCompare(b.supplier_name, "pt-BR")
  })
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
  const [allProposalsCatalog, setAllProposalsCatalog] = React.useState<Proposal[]>([])
  const [loading, setLoading] = React.useState(true)
  const [itemSelections, setItemSelections] = React.useState<Record<string, string | null>>({})
  const [finalizing, setFinalizing] = React.useState(false)
  const [finishingQuotation, setFinishingQuotation] = React.useState(false)
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({
    prazo: true,
    preco_unit: true,
    imposto: true,
    total_item: true,
  })
  const [columnsOpen, setColumnsOpen] = React.useState(false)
  const [splitExpanded, setSplitExpanded] = React.useState(false)
  const columnsRef = React.useRef<HTMLDivElement>(null)
  const leftTableRef = React.useRef<HTMLTableElement>(null)
  const rightTableRef = React.useRef<HTMLTableElement>(null)
  const [leftTheadSpacerHeight, setLeftTheadSpacerHeight] = React.useState(0)
  const [orderedItems, setOrderedItems] = React.useState<Map<string, OrderedItemInfo>>(new Map())
  const [orderSuccessDialog, setOrderSuccessDialog] = React.useState<{
    open: boolean
    orders: { code: string; supplierName: string }[]
  }>({ open: false, orders: [] })
  const [rounds, setRounds] = React.useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = React.useState<string | null>(null)
  const [selectedRound, setSelectedRound] = React.useState<Round | null>(null)
  const [finalizeRoundOpen, setFinalizeRoundOpen] = React.useState(false)
  const [novaRoundOpen, setNovaRoundOpen] = React.useState(false)
  const [closingRound, setClosingRound] = React.useState(false)
  const [creatingRound, setCreatingRound] = React.useState(false)
  const [novaRoundDeadline, setNovaRoundDeadline] = React.useState("")
  const [countdownTick, setCountdownTick] = React.useState(0)

  const countdownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineExpireFetchedRef = React.useRef(false)
  const fetchEqualizationDataRef = React.useRef(
    null as null | ((options?: { showLoading?: boolean; forceRoundId?: string | null }) => Promise<void>),
  )
  const isFirstLoadRef = React.useRef(true)

  React.useEffect(() => {
    isFirstLoadRef.current = true
  }, [id])

  const maxRoundNumber =
    rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) : null
  const isLastRound =
    selectedRound != null &&
    maxRoundNumber != null &&
    selectedRound.round_number === maxRoundNumber
  const isReadOnly = quotation?.status === "completed" || !isLastRound

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

  const syncTheadSpacer = React.useCallback(() => {
    const rightTable = rightTableRef.current
    if (!rightTable) return
    const rightHeaderRows = rightTable.querySelectorAll("thead tr")
    const firstRowHeight = (rightHeaderRows[0] as HTMLTableRowElement)?.offsetHeight ?? 0
    setLeftTheadSpacerHeight(firstRowHeight)
  }, [])

  React.useEffect(() => {
    syncTheadSpacer()
    const rightTable = rightTableRef.current
    if (!rightTable) return
    const ro = new ResizeObserver(() => syncTheadSpacer())
    ro.observe(rightTable)
    return () => ro.disconnect()
  }, [syncTheadSpacer, quotationItems, proposals, columnVisibility])

  const fetchEqualizationData = React.useCallback(
    async (options?: { showLoading?: boolean; forceRoundId?: string | null }) => {
      void options?.showLoading
      const forceRoundId = options?.forceRoundId
      if (!id) return
      const supabase = createClient()
      setLoading(true)

      try {
        const { data: roundsData, error: roundsError } = await supabase
          .from("quotation_rounds")
          .select(
            "id, quotation_id, company_id, round_number, status, created_at, closed_at, response_deadline",
          )
          .eq("quotation_id", id)
          .order("round_number", { ascending: true })

        if (roundsError) throw roundsError

        const roundsList = ((roundsData ?? []) as Round[]).map((r) => ({
          ...r,
          response_deadline: r.response_deadline ?? null,
        }))
        setRounds(roundsList)

        const resolvedRoundId =
          forceRoundId != null && roundsList.some((r) => r.id === forceRoundId)
            ? forceRoundId
            : selectedRoundId && roundsList.some((r) => r.id === selectedRoundId)
              ? selectedRoundId
              : roundsList.length > 0
                ? roundsList[roundsList.length - 1].id
                : null

        if (resolvedRoundId !== selectedRoundId) {
          setSelectedRoundId(resolvedRoundId)
        }

        setSelectedRound(
          resolvedRoundId ? (roundsList.find((r) => r.id === resolvedRoundId) ?? null) : null,
        )

        const [qRes, itemsRes, qsRes, allProposalsRawRes] = await Promise.all([
          supabase
            .from("quotations")
            .select(
              "id, code, description, status, category, payment_condition, response_deadline, created_at",
            )
            .eq("id", id)
            .single(),
          supabase
            .from("quotation_items")
            .select(
              "id, quotation_id, company_id, material_code, material_description, long_description, unit_of_measure, quantity, created_at",
            )
            .eq("quotation_id", id)
            .order("material_description", { ascending: true }),
          supabase
            .from("quotation_suppliers")
            .select("*, suppliers(name, cnpj)")
            .eq("quotation_id", id)
            .order("position", { ascending: true, nullsFirst: false }),
          supabase
            .from("quotation_proposals")
            .select("*, proposal_items(*)")
            .eq("quotation_id", id),
        ])

        if (qRes.error) throw qRes.error
        if (itemsRes.error) throw itemsRes.error
        if (qsRes.error) throw qsRes.error
        if (allProposalsRawRes.error) throw allProposalsRawRes.error

        const q = (qRes.data as Quotation) ?? null
        const items = ((itemsRes.data as unknown) as QuotationItem[]) ?? []
        const quotationSuppliersOrdered = (qsRes.data ?? []) as QuotationSupplier[]

        const allProposalsRaw = allProposalsRawRes.data

        const allCatalog = ((allProposalsRaw ?? []) as unknown as Proposal[]).map((p) => ({
          ...p,
          proposal_items: (p.proposal_items ?? []).filter(
            (pi) =>
              p.round_id != null && (pi.round_id === p.round_id || pi.round_id == null),
          ),
        }))
        setAllProposalsCatalog(allCatalog)

        let probs: Proposal[] = []
        if (resolvedRoundId) {
          const roundProposals = allCatalog.filter((p) => p.round_id === resolvedRoundId)
          probs = orderProposalsByQuotationSupplierColumnOrder(
            roundProposals,
            quotationSuppliersOrdered,
          )
        }

        const quotationItemIds = items.map((i) => i.id)
        const orderedMap = new Map<string, OrderedItemInfo>()
        if (quotationItemIds.length > 0) {
          const { data: poItemsData } = await supabase
            .from("purchase_order_items")
            .select(
              "quotation_item_id, purchase_order_id, round_id, purchase_orders(code, proposal_id), quotation_rounds(round_number)",
            )
            .in("quotation_item_id", quotationItemIds)

          ;((poItemsData ?? []) as Array<{
            quotation_item_id: string
            purchase_order_id: string
            round_id: string | null
            purchase_orders:
              | { code: string; proposal_id: string | null }
              | { code: string; proposal_id: string | null }[]
              | null
            quotation_rounds:
              | { round_number: number }
              | { round_number: number }[]
              | null
          }>).forEach((row) => {
            const po = Array.isArray(row.purchase_orders)
              ? row.purchase_orders[0]
              : row.purchase_orders
            const orderCode = po?.code ?? "—"
            const proposalId = po?.proposal_id ?? ""
            const roundNumber = pickNestedRoundNumber(row.quotation_rounds)
            if (!orderedMap.has(row.quotation_item_id)) {
              orderedMap.set(row.quotation_item_id, {
                orderId: row.purchase_order_id,
                orderCode,
                proposalId,
                roundId: row.round_id ?? null,
                roundNumber,
              })
            }
          })
        }

        setQuotation(q)
        setQuotationItems(items)
        setProposals(probs)
        setOrderedItems(orderedMap)

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
      } finally {
        setLoading(false)
      }
    },
    [id, selectedRoundId],
  )

  fetchEqualizationDataRef.current = fetchEqualizationData

  React.useEffect(() => {
    const showLoading = isFirstLoadRef.current
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false
    }
    void fetchEqualizationData({ showLoading })
  }, [fetchEqualizationData])

  const supplierRespondStats = React.useMemo(() => {
    const totalSuppliers = proposals.length
    const rid = selectedRoundId
    if (!rid) return { totalSuppliers, respondedSuppliers: 0 }
    const respondedSuppliers = proposals.filter((p) => {
      const hasItemInRound = p.proposal_items.some(
        (pi) => pi.quotation_item_id && pi.round_id === rid,
      )
      return p.status === "submitted" || hasItemInRound
    }).length
    return { totalSuppliers, respondedSuppliers }
  }, [proposals, selectedRoundId])

  const deadlineEnd = React.useMemo(
    () => getRoundDeadlineEnd(selectedRound?.response_deadline ?? null),
    [selectedRound?.response_deadline],
  )

  const remainingMs = React.useMemo(() => {
    if (selectedRound?.status !== "active") return null
    if (!deadlineEnd) return null
    void countdownTick
    return deadlineEnd.getTime() - Date.now()
  }, [deadlineEnd, countdownTick, selectedRound?.status])

  React.useEffect(() => {
    deadlineExpireFetchedRef.current = false
  }, [selectedRoundId, selectedRound?.response_deadline, selectedRound?.status])

  React.useEffect(() => {
    if (countdownIntervalRef.current != null) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (selectedRound?.status !== "active") return
    countdownIntervalRef.current = setInterval(() => {
      setCountdownTick((n) => n + 1)
    }, 1000)
    return () => {
      if (countdownIntervalRef.current != null) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [selectedRoundId, selectedRound?.status])

  React.useEffect(() => {
    if (selectedRound?.status !== "active") return
    if (remainingMs == null) return
    if (remainingMs > 0) return
    if (deadlineExpireFetchedRef.current) return
    deadlineExpireFetchedRef.current = true
    void fetchEqualizationDataRef.current?.({ showLoading: false })
  }, [remainingMs, selectedRound?.status])

  const hasActiveRoundGlobally = rounds.some((r) => r.status === "active")
  const showFinalizeRoundButton =
    selectedRound?.status === "active" && quotation?.status !== "completed"
  const showNovaRoundButton =
    quotation?.status !== "completed" &&
    quotation?.status !== "cancelled" &&
    (selectedRound?.status === "closed" ||
      (rounds.length > 0 && !hasActiveRoundGlobally))

  const handleFinalizeRound = async () => {
    if (!selectedRoundId || !companyId || !quotation) return
    setClosingRound(true)
    try {
      const supabase = createClient()
      const { error: roundErr } = await supabase
        .from("quotation_rounds")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", selectedRoundId)
        .eq("company_id", companyId)
      if (roundErr) throw roundErr
      const { error: qErr } = await supabase
        .from("quotations")
        .update({ status: "analysis" })
        .eq("id", quotation.id)
        .eq("company_id", companyId)
      if (qErr) throw qErr
      toast.success("Rodada finalizada. Cotação em análise.")
      setFinalizeRoundOpen(false)
      await fetchEqualizationData({ showLoading: false })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível finalizar a rodada.")
    } finally {
      setClosingRound(false)
    }
  }

  const handleNovaRodada = async () => {
    if (!selectedRoundId || !companyId || !quotation || !id) return
    const minD = getTomorrowInputMin()
    if (!novaRoundDeadline.trim()) {
      toast.error("Informe o prazo de resposta.")
      return
    }
    if (novaRoundDeadline < minD) {
      toast.error("O prazo deve ser a partir de amanhã.")
      return
    }
    setCreatingRound(true)
    try {
      const supabase = createClient()
      const newRoundNumber =
        rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) + 1 : 1

      const { data: newRoundRow, error: insRoundErr } = await supabase
        .from("quotation_rounds")
        .insert({
          quotation_id: id,
          company_id: companyId,
          round_number: newRoundNumber,
          status: "active",
          response_deadline: novaRoundDeadline,
        })
        .select("id")
        .single()

      if (insRoundErr) throw insRoundErr
      const newRoundId = (newRoundRow as { id: string }).id

      const { data: prevProposalsData, error: prevErr } = await supabase
        .from("quotation_proposals")
        .select("*")
        .eq("quotation_id", id)
        .eq("round_id", selectedRoundId)

      if (prevErr) throw prevErr
      const prevList = ((prevProposalsData ?? []) as unknown) as Proposal[]

      for (const p of prevList) {
        const insertPayload: Record<string, unknown> = {
          quotation_id: quotation.id,
          company_id: companyId,
          supplier_name: p.supplier_name,
          supplier_cnpj: p.supplier_cnpj,
          round_id: newRoundId,
          status: "invited",
          total_price: p.total_price,
          delivery_days: p.delivery_days,
          payment_condition: p.payment_condition,
          validity_date: p.validity_date,
          observations: p.observations,
        }
        if (p.supplier_id != null) insertPayload.supplier_id = p.supplier_id

        const { error: insPErr } = await supabase.from("quotation_proposals").insert(insertPayload)
        if (insPErr) throw insPErr
      }

      const { error: waitErr } = await supabase
        .from("quotations")
        .update({ status: "waiting" })
        .eq("id", quotation.id)
        .eq("company_id", companyId)

      if (waitErr) throw waitErr

      toast.success("Nova rodada criada. Cotação aguardando respostas.")
      setNovaRoundOpen(false)
      await fetchEqualizationData({ showLoading: false, forceRoundId: newRoundId })
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível criar a nova rodada.")
    } finally {
      setCreatingRound(false)
    }
  }

  const quotationItemsById = React.useMemo(() => {
    return new Map(quotationItems.map((i) => [i.id, i]))
  }, [quotationItems])

  const supplierTotalByProposal = React.useMemo(() => {
    const m: Record<string, number | null> = {}
    for (const p of proposals) {
      if (!selectedRoundId) {
        m[p.id] = null
        continue
      }
      const items = proposalItemsForSelectedRound(p, selectedRoundId)
      if (items.length === 0) {
        m[p.id] = null
        continue
      }
      let sum = 0
      for (const pi of items) {
        const qi = quotationItemsById.get(pi.quotation_item_id)
        if (qi) sum += pi.unit_price * qi.quantity
      }
      m[p.id] = sum
    }
    return m
  }, [proposals, selectedRoundId, quotationItemsById])

  const menorPreco = React.useMemo(() => {
    const vals = Object.values(supplierTotalByProposal).filter((v): v is number => v != null)
    return vals.length ? Math.min(...vals) : Infinity
  }, [supplierTotalByProposal])

  const hasProposalResponsesInRound = React.useMemo(() => {
    if (!selectedRoundId) return false
    return proposals.some((p) => proposalItemsForSelectedRound(p, selectedRoundId).length > 0)
  }, [proposals, selectedRoundId])

  const menorPrazo = React.useMemo(() => {
    if (!selectedRoundId) return Infinity
    const values = proposals
      .filter((p) => proposalItemsForSelectedRound(p, selectedRoundId).length > 0)
      .map((p) => p.delivery_days ?? Infinity)
    return values.length ? Math.min(...values) : Infinity
  }, [proposals, selectedRoundId])

  // =========================
  // CÁLCULOS INTELIGENTES
  // =========================

  const coverageByProposal = React.useMemo(() => {
    const map: Record<
      string,
      { totalItens: number; itensAceitos: number; coveragePercent: number; coberturaLabel: string }
    > = {}
    proposals.forEach((p) => {
      const roundItems = selectedRoundId
        ? proposalItemsForSelectedRound(p, selectedRoundId)
        : []
      const totalItens = roundItems.length
      const itensAceitos = roundItems.filter((i) => i.item_status === "accepted").length
      const coveragePercent = totalItens > 0 ? (itensAceitos / totalItens) * 100 : 0
      map[p.id] = {
        totalItens,
        itensAceitos,
        coveragePercent,
        coberturaLabel: `${coveragePercent.toFixed(0)}%`,
      }
    })
    return map
  }, [proposals, selectedRoundId])

  const bestCoverage = React.useMemo<
    | { proposal: Proposal; coveragePercent: number; itensAceitos: number; totalItens: number }
    | null
  >(() => {
    let best:
      | { proposal: Proposal; coveragePercent: number; itensAceitos: number; totalItens: number }
      | null = null
    proposals.forEach((p) => {
      const c = coverageByProposal[p.id]
      if (!c || c.totalItens === 0) return
      if (!best || c.coveragePercent > best.coveragePercent) {
        best = { proposal: p, ...c }
      }
    })
    return best
  }, [proposals, coverageByProposal])

  const bestPriceByItem = React.useMemo(() => {
    const best: Record<string, { price: number; proposalId: string }> = {}
    if (!selectedRoundId) return best
    quotationItems.forEach((qi) => {
      let current: { price: number; proposalId: string } | null = null
      proposals.forEach((p) => {
        const pi = proposalItemsForSelectedRound(p, selectedRoundId).find(
          (i) => i.quotation_item_id === qi.id && i.unit_price > 0,
        )
        if (pi && (!current || pi.unit_price < current.price)) {
          current = { price: pi.unit_price, proposalId: p.id }
        }
      })
      if (current) best[qi.id] = current
    })
    return best
  }, [quotationItems, proposals, selectedRoundId])

  const commonItems = React.useMemo(() => {
    if (!selectedRoundId) return []
    return quotationItems.filter((qi) =>
      proposals.every((p) =>
        proposalItemsForSelectedRound(p, selectedRoundId).some(
          (i) =>
            i.quotation_item_id === qi.id &&
            i.item_status === "accepted" &&
            i.unit_price > 0,
        ),
      ),
    )
  }, [quotationItems, proposals, selectedRoundId])

  const weightedPriceByProposal = React.useMemo(() => {
    const map: Record<string, number> = {}
    if (!selectedRoundId) {
      proposals.forEach((p) => {
        map[p.id] = 0
      })
      return map
    }
    proposals.forEach((p) => {
      const total = commonItems.reduce((sum, qi) => {
        const pi = proposalItemsForSelectedRound(p, selectedRoundId).find(
          (i) => i.quotation_item_id === qi.id,
        )
        return sum + (pi ? pi.unit_price * qi.quantity : 0)
      }, 0)
      map[p.id] = total
    })
    return map
  }, [proposals, commonItems, selectedRoundId])

  const proposalItemsByProposal = React.useMemo(() => {
    const map = new Map<string, Map<string, ProposalItem>>()
    for (const p of allProposalsCatalog) {
      const rid = p.round_id
      const byItem = new Map<string, ProposalItem>()
      if (rid) {
        for (const pi of p.proposal_items ?? []) {
          if (
            pi.quotation_item_id &&
            (pi.round_id === rid || pi.round_id == null)
          ) {
            byItem.set(pi.quotation_item_id, pi)
          }
        }
      }
      map.set(p.id, byItem)
    }
    return map
  }, [allProposalsCatalog])

  const getItemRoundId = React.useCallback(
    (itemId: string): string | null => {
      if (orderedItems.has(itemId)) {
        return orderedItems.get(itemId)?.roundId ?? selectedRoundId
      }
      return selectedRoundId
    },
    [orderedItems, selectedRoundId],
  )

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
    if (orderedItems.has(quotationItemId)) return
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
    if (!selectedRoundId) return map
    proposals.forEach((p) => {
      const itemIds = new Set<string>()
      proposalItemsForSelectedRound(p, selectedRoundId).forEach((pi) => {
        if (pi.unit_price > 0) {
          itemIds.add(pi.quotation_item_id)
        }
      })
      map.set(p.id, itemIds)
    })
    return map
  }, [proposals, selectedRoundId])

  const handleSelectAllForSupplier = (proposalId: string) => {
    const quoted = itemsQuotedBySupplier.get(proposalId)
    if (!quoted) return

    const quotedArr = Array.from(quoted).filter((qiId) => !orderedItems.has(qiId))
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
      if (orderedItems.has(qi.id)) {
        next[qi.id] = itemSelections[qi.id] ?? null
        return
      }
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
          const pi = getProposalItemForQuotationItem(
            p,
            qi.id,
            getItemRoundId(qi.id),
            allProposalsCatalog,
          )
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
  }, [
    quotationItems,
    proposals,
    itemSelections,
    allProposalsCatalog,
    getItemRoundId,
  ])

  const handleFinalize = async () => {
    if (!quotation || !companyId || !userId) return
    if (!selectedRoundId) return
    if (!hasSelection) return
    if (!hasPermission("order.create")) return

    setFinalizing(true)

    try {
      const supabase = createClient()

      const acceptedProposalItemIds: string[] = []
      const rejectedProposalItemIds: string[] = []
      for (const p of proposals) {
        for (const pi of p.proposal_items) {
          const selected = itemSelections[pi.quotation_item_id] === p.id
          if (selected) acceptedProposalItemIds.push(pi.id)
          else rejectedProposalItemIds.push(pi.id)
        }
      }

      if (acceptedProposalItemIds.length > 0) {
        const { error: proposalItemsAcceptedBatchError } = await supabase
          .from("proposal_items")
          .update({ item_status: "accepted" })
          .in("id", acceptedProposalItemIds)
        if (proposalItemsAcceptedBatchError) throw proposalItemsAcceptedBatchError
      }
      if (rejectedProposalItemIds.length > 0) {
        const { error: proposalItemsRejectedBatchError } = await supabase
          .from("proposal_items")
          .update({ item_status: "rejected" })
          .in("id", rejectedProposalItemIds)
        if (proposalItemsRejectedBatchError) throw proposalItemsRejectedBatchError
      }

      const selectedQuotationProposalIds: string[] = []
      const rejectedQuotationProposalIds: string[] = []
      const selectedAt = new Date().toISOString()
      for (const p of proposals) {
        const hasAnyAccepted = p.proposal_items.some(
          (pi) => itemSelections[pi.quotation_item_id] === p.id,
        )
        if (hasAnyAccepted) selectedQuotationProposalIds.push(p.id)
        else rejectedQuotationProposalIds.push(p.id)
      }

      if (selectedQuotationProposalIds.length > 0) {
        const { error: quotationProposalsSelectedBatchError } = await supabase
          .from("quotation_proposals")
          .update({ status: "selected", selected_at: selectedAt })
          .in("id", selectedQuotationProposalIds)
        if (quotationProposalsSelectedBatchError) throw quotationProposalsSelectedBatchError
      }
      if (rejectedQuotationProposalIds.length > 0) {
        const { error: quotationProposalsRejectedBatchError } = await supabase
          .from("quotation_proposals")
          .update({ status: "rejected" })
          .in("id", rejectedQuotationProposalIds)
        if (quotationProposalsRejectedBatchError) throw quotationProposalsRejectedBatchError
      }

      const createdOrdersList: { code: string; supplierName: string }[] = []

      for (const p of proposals) {
        const linesForPo = quotationItems.filter(
          (qi) => itemSelections[qi.id] === p.id && !orderedItems.has(qi.id),
        )
        if (linesForPo.length === 0) continue

        const itemsPayload: {
          quotationItemId: string
          materialCode: string
          materialDescription: string
          quantity: number
          unitOfMeasure: string
          unitPrice: number
          taxPercent: number | null
          deliveryDays: number | null
        }[] = []

        let totalPrice = 0
        let maxDeliveryDaysFromItems = 0
        for (const qi of linesForPo) {
          const pi = proposalItemsByProposal.get(p.id)?.get(qi.id)
          if (!pi || pi.unit_price <= 0) continue
          totalPrice += pi.unit_price * qi.quantity
          const lineDd = pi.delivery_days
          if (lineDd != null && lineDd > maxDeliveryDaysFromItems) {
            maxDeliveryDaysFromItems = lineDd
          }
          itemsPayload.push({
            quotationItemId: qi.id,
            materialCode: qi.material_code,
            materialDescription: qi.material_description,
            quantity: qi.quantity,
            unitOfMeasure: qi.unit_of_measure,
            unitPrice: pi.unit_price,
            taxPercent: pi.tax_percent,
            deliveryDays: pi.delivery_days ?? null,
          })
        }

        if (itemsPayload.length === 0) continue

        const headerDeliveryDays = p.delivery_days ?? 0
        const poDeliveryDays =
          maxDeliveryDaysFromItems > 0 ? maxDeliveryDaysFromItems : headerDeliveryDays

        const { data: poData, error: purchaseOrderInsertError } = await supabase
          .from("purchase_orders")
          .insert({
            company_id: companyId,
            quotation_id: quotation.id,
            proposal_id: p.id,
            supplier_id: p.supplier_id ?? null,
            supplier_name: p.supplier_name,
            supplier_cnpj: p.supplier_cnpj,
            payment_condition: p.payment_condition,
            delivery_days: poDeliveryDays > 0 ? poDeliveryDays : null,
            delivery_address: "A definir",
            quotation_code: quotation.code,
            requisition_code: null,
            total_price: totalPrice,
            observations: null,
            created_by: userId,
            status: "draft",
          })
          .select("id, code")
          .single()

        if (purchaseOrderInsertError) throw purchaseOrderInsertError
        if (!poData) {
          throw new Error("purchase_orders.insert: resposta sem dados")
        }

        const purchaseOrderId = poData.id as string
        const orderCode = (poData.code as string) ?? "—"

        const poItemsPayload = itemsPayload.map((i) => ({
          purchase_order_id: purchaseOrderId,
          company_id: companyId,
          quotation_item_id: i.quotationItemId,
          round_id: selectedRoundId,
          material_code: i.materialCode,
          material_description: i.materialDescription,
          quantity: i.quantity,
          unit_of_measure: i.unitOfMeasure,
          unit_price: i.unitPrice,
          tax_percent: i.taxPercent,
          delivery_days: i.deliveryDays,
        }))

        const { error: purchaseOrderItemsInsertError } = await supabase
          .from("purchase_order_items")
          .insert(poItemsPayload)
        if (purchaseOrderItemsInsertError) throw purchaseOrderItemsInsertError

        createdOrdersList.push({ code: orderCode, supplierName: p.supplier_name })
      }

      if (createdOrdersList.length === 0) {
        toast.error("Nenhum pedido foi gerado. Verifique preços e itens selecionados.")
        return
      }

      const allQuotationItemIds = quotationItems.map((qi) => qi.id)
      if (allQuotationItemIds.length > 0) {
        const { data: coverageRows, error: coverageQueryError } = await supabase
          .from("purchase_order_items")
          .select("quotation_item_id")
          .in("quotation_item_id", allQuotationItemIds)
        if (coverageQueryError) throw coverageQueryError
        const coveredIds = new Set(
          ((coverageRows ?? []) as { quotation_item_id: string }[])
            .map((r) => r.quotation_item_id)
            .filter(Boolean),
        )
        const allItemsHavePurchaseOrder =
          coveredIds.size === allQuotationItemIds.length &&
          allQuotationItemIds.every((id) => coveredIds.has(id))
        if (allItemsHavePurchaseOrder && quotation.status !== "completed") {
          const { error: quotationCompleteError } = await supabase
            .from("quotations")
            .update({ status: "completed" })
            .eq("id", quotation.id)
            .eq("company_id", companyId)
          if (quotationCompleteError) throw quotationCompleteError
          setQuotation((prev) => (prev ? { ...prev, status: "completed" } : null))
          toast.success("Todos os itens foram pedidos. Cotação marcada como concluída.")
        }
      }

      await logAudit({
        eventType: "quotation.updated",
        description: `Pedido(s) em rascunho: ${createdOrdersList.map((o) => `${o.code} (${o.supplierName})`).join(", ")} — cotação ${quotation.code}`,
        companyId,
        userId,
        entity: "quotation",
        entityId: quotation.id,
      })

      setItemSelections({})
      setOrderSuccessDialog({ open: true, orders: createdOrdersList })
    } catch (err) {
      console.error(err)
      const fallback = "Erro ao finalizar cotação. Tente novamente."
      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string" &&
        (err as { message: string }).message.trim().length > 0
          ? (err as { message: string }).message
          : err instanceof Error && err.message.trim().length > 0
            ? err.message
            : fallback
      toast.error(message)
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

    const dadosHeaderFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F3EF5" },
    } as any
    const dadosStripeFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF4F3FF" },
    } as any

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

    const dadosWs = workbook.addWorksheet(sanitizeSheetName("Dados da Cotação"))
    dadosWs.views = [{ showGridLines: false }]
    dadosWs.columns = [{ width: 30 }, { width: 40 }]
    const dadosHeaderRow = dadosWs.addRow(["Campo", "Valor"])
    dadosHeaderRow.height = 18
    dadosHeaderRow.eachCell((cell: any) => {
      cell.fill = dadosHeaderFill
      cell.font = headerFont
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = border
    })

    const dadosRows: Array<[string, string]> = [
      ["Cotação", quotation.code],
      ["Descrição", quotation.description],
      ["Status", getQuotationStatusLabel(quotation.status)],
      ["Categoria", quotation.category?.trim() ? quotation.category : "—"],
      ["Condição de Pagamento", quotation.payment_condition?.trim() ? quotation.payment_condition : "—"],
      ["Data Limite de Resposta", formatDateBR(quotation.response_deadline ?? null)],
      ["Data de Criação", quotation.created_at ? formatDateBR(quotation.created_at) : "—"],
      [
        "Rodada Exportada",
        (() => {
          const r =
            selectedRoundId != null ? rounds.find((x) => x.id === selectedRoundId) : null
          return r ? `Rodada ${r.round_number}` : "—"
        })(),
      ],
      [
        "Status da Rodada",
        selectedRound ? (selectedRound.status === "active" ? "Ativa" : "Fechada") : "—",
      ],
      ["Total de Fornecedores", String(proposals.length)],
      ["Total de Itens", String(quotationItems.length)],
    ]

    dadosRows.forEach(([campo, valor], idx) => {
      const r = dadosWs.addRow([campo, valor])
      r.getCell(1).font = { bold: true }
      r.getCell(1).alignment = { vertical: "middle" }
      r.getCell(2).alignment = { vertical: "middle", wrapText: true }
      r.eachCell({ includeEmpty: true }, (cell: any) => {
        cell.border = border
        if (idx % 2 === 1) {
          cell.fill = dadosStripeFill
        }
      })
    })

    proposals.forEach((p) => {
      const base = sanitizeSheetName(p.supplier_name)
      const count = (usedNames.get(base) ?? 0) + 1
      usedNames.set(base, count)
      const sheetName = count === 1 ? base : sanitizeSheetName(`${base} ${count}`)

      const ws = workbook.addWorksheet(sheetName)
      ws.views = [{ showGridLines: false }]

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
        { width: 18 }, // J Pedido
        { width: 16 }, // K Rodada do Pedido
      ]

      ws.mergeCells("A1:K1")
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
        "Pedido",
        "Rodada do Pedido",
      ])
      headerRow.height = 18
      headerRow.eachCell((cell: any) => {
        cell.fill = headerFill
        cell.font = { ...headerFont, size: 11 }
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = border
      })

      let acceptedSum = 0
      const exportRoundId = selectedRoundId

      quotationItems.forEach((qi) => {
        const rowOrderInfo = orderedItems.get(qi.id)
        const orderProposalForRow = rowOrderInfo
          ? allProposalsCatalog.find((x) => x.id === rowOrderInfo.proposalId)
          : undefined
        const orderIsForThisSupplier = Boolean(
          orderProposalForRow && sameSupplier(p, orderProposalForRow),
        )
        const hasOrderElsewhere = Boolean(rowOrderInfo) && !orderIsForThisSupplier
        const showOrderColumns = orderIsForThisSupplier

        let pi: ProposalItem | undefined
        if (orderIsForThisSupplier && rowOrderInfo) {
          const targetRoundId = rowOrderInfo.roundId ?? exportRoundId
          if (targetRoundId) {
            const targetProp =
              p.round_id === targetRoundId
                ? p
                : findProposalInRound(allProposalsCatalog, targetRoundId, p)
            pi = targetProp?.proposal_items.find(
              (i) =>
                i.quotation_item_id === qi.id &&
                (i.round_id === targetRoundId || i.round_id == null),
            )
          }
        } else if (!rowOrderInfo && exportRoundId != null) {
          pi = p.proposal_items.find(
            (i) =>
              i.quotation_item_id === qi.id &&
              (i.round_id === exportRoundId || i.round_id == null),
          )
        }

        const hasPrice = !!pi && pi.unit_price > 0
        const acceptedForSum = !!pi && pi.item_status === "accepted" && hasPrice
        const unitPrice = hasPrice ? pi!.unit_price : null
        const totalItem = hasPrice ? pi!.unit_price * qi.quantity : null
        if (acceptedForSum && totalItem != null) acceptedSum += totalItem

        const statusLabel = excelExportItemStatusLabel(pi, hasOrderElsewhere)
        const usePinkRejectRow =
          !orderIsForThisSupplier && !hasOrderElsewhere && statusLabel === "Recusado"

        const row = ws.addRow([
          qi.material_code,
          qi.material_description,
          qi.quantity,
          qi.unit_of_measure,
          hasPrice ? unitPrice : "—",
          pi ? (pi.tax_percent == null ? "—" : `${pi.tax_percent}%`) : "—",
          hasPrice ? totalItem : "—",
          statusLabel,
          pi?.observations ?? "—",
          showOrderColumns ? (rowOrderInfo?.orderCode ?? "") : "",
          showOrderColumns && rowOrderInfo?.roundNumber != null
            ? `Rodada ${rowOrderInfo.roundNumber}`
            : "",
        ])

        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
          cell.border = border
          cell.alignment = {
            vertical: "middle",
            wrapText: colNumber === 2 || colNumber === 9 || colNumber === 10,
          }
        })

        if (orderIsForThisSupplier) {
          row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } }
          })
        } else if (usePinkRejectRow) {
          row.eachCell({ includeEmpty: true }, (cell: any) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0F0" } }
            cell.font = { color: { argb: "FF6B7280" } }
          })
        }
        if (hasPrice) {
          row.getCell(5).numFmt = '"R$" #,##0.00'
          row.getCell(7).numFmt = '"R$" #,##0.00'
        }
      })

      const totalRow = ws.addRow([
        "TOTAL (itens aceitos)",
        "",
        "",
        "",
        "",
        "",
        acceptedSum,
        "",
        "",
        "",
        "",
      ])
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

  const handleFinishQuotation = async () => {
    if (!quotation || !companyId || !userId || isReadOnly) return

    setFinishingQuotation(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from("quotations")
        .update({ status: "completed" })
        .eq("id", quotation.id)
        .eq("company_id", companyId)

      if (updateError) {
        toast.error("Não foi possível finalizar a cotação.")
        return
      }

      toast.success("Cotação finalizada com sucesso.")
      router.push(`/comprador/cotacoes/${id}`)
    } catch (err) {
      console.error(err)
      toast.error("Não foi possível finalizar a cotação.")
    } finally {
      setFinishingQuotation(false)
    }
  }

  const roundSelectControl =
    rounds.length > 0 ? (
      <>
        <Select
          value={
            selectedRoundId != null && rounds.some((r) => r.id === selectedRoundId)
              ? selectedRoundId
              : (rounds[rounds.length - 1]?.id ?? "")
          }
          onValueChange={setSelectedRoundId}
        >
          <SelectTrigger
            className={cn(
              "w-48 shrink-0",
              selectedRound?.status === "active"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground",
            )}
            aria-label="Rodadas de negociação"
          >
            {loading && proposals.length > 0 ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : null}
            <SelectValue placeholder="Rodada" />
          </SelectTrigger>
          <SelectContent>
            {rounds.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                Rodada {r.round_number} — {r.status === "active" ? "Ativa" : "Fechada"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRound?.status === "closed" && selectedRound?.closed_at ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                Encerrada
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              Encerrada em {formatDateBR(selectedRound.closed_at)}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </>
    ) : null

  if (loading && proposals.length === 0) {
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
      {quotation?.status === "completed" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <Eye className="h-5 w-5 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            Esta cotação está concluída. Visualização somente leitura do histórico de propostas.
          </p>
        </div>
      )}
      {quotation?.status !== "completed" && selectedRound?.status === "closed" && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-zinc-600 shrink-0" />
          <p className="text-sm text-zinc-800">
            {isLastRound ? (
              <>
                Rodada {selectedRound.round_number} encerrada. Você ainda pode criar pedidos para os itens
                desta rodada.
              </>
            ) : (
              <>
                Rodada {selectedRound.round_number} encerrada em {formatDateBR(selectedRound.closed_at)}
                . Visualização somente leitura.
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/comprador/cotacoes/${id}`)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight shrink-0">
              Equalização de Propostas
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                supplierRespondStats.respondedSuppliers === supplierRespondStats.totalSuppliers
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-blue-200 bg-blue-50 text-blue-700",
              )}
            >
              {supplierRespondStats.respondedSuppliers === supplierRespondStats.totalSuppliers ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              ) : null}
              <span>
                Fornecedores: {supplierRespondStats.respondedSuppliers}/
                {supplierRespondStats.totalSuppliers} responderam
              </span>
            </div>
            {selectedRound?.status === "active" && deadlineEnd != null ? (
              remainingMs != null && remainingMs > 0 ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-sm text-yellow-700">
                  Prazo: {formatCountdown(remainingMs)}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  Prazo expirado
                </div>
              )
            ) : null}
          </div>
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
                  {!hasProposalResponsesInRound
                    ? "Aguardando respostas"
                    : menorPreco === Infinity
                      ? "—"
                      : formatCurrency(menorPreco)}
                </p>
                <p className="text-xs text-muted-foreground">
                  * soma dos itens cotados nesta rodada
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
                  {!hasProposalResponsesInRound
                    ? "Aguardando respostas"
                    : menorPrazo === Infinity
                      ? "—"
                      : `${menorPrazo} dias`}
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
                  {!hasProposalResponsesInRound
                    ? "Aguardando respostas"
                    : bestCoverage
                      ? `${bestCoverage.coveragePercent.toFixed(0)}%`
                      : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {!hasProposalResponsesInRound
                    ? "—"
                    : bestCoverage
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
                <p className="text-2xl font-bold">
                  {!hasProposalResponsesInRound
                    ? "Aguardando respostas"
                    : formatCurrency(splitTotalPrice)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasProposalResponsesInRound
                    ? `Dividindo entre ${splitSuppliers} fornecedores`
                    : "—"}
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
            <>
              {roundSelectControl ? (
                <div className="mb-4 flex flex-row flex-nowrap items-center gap-2">
                  {roundSelectControl}
                </div>
              ) : null}
              <p className="py-8 text-center text-muted-foreground">
                Nenhuma proposta encontrada para esta cotação.
              </p>
            </>
          ) : (
          (() => {
            const toggleableKeys = [
              "prazo",
              "preco_unit",
              "imposto",
              "total_item",
            ] as const
            const visibleToggleable = toggleableKeys.filter((k) => columnVisibility[k])
            const colsPerSupplier = visibleToggleable.length + 1
            const supplierWithLowestTotal = proposals.find(
              (p) =>
                supplierTotalByProposal[p.id] != null &&
                supplierTotalByProposal[p.id] === menorPreco,
            )
            const colWidths: Record<string, number> = {
              prazo: 80,
              preco_unit: 100,
              imposto: 80,
              total_item: 100,
              selecao: 40,
            }
            const supplierColWidth =
              toggleableKeys.filter((k) => columnVisibility[k]).reduce((s, k) => s + colWidths[k], 0) +
              colWidths.selecao
            const FIXED_WIDTH = 406
            const minSupplierTableWidth = proposals.length * supplierColWidth

            return (
              <>
                {/* Área de ações: fora das tabelas */}
                <div className="flex flex-row gap-4 items-start p-3 mb-2 border border-border rounded-lg bg-muted/30">
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex flex-row gap-2 items-center flex-nowrap">
                    {roundSelectControl}
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
                    {showFinalizeRoundButton && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setFinalizeRoundOpen(true)}
                      >
                        <LockKeyhole className="mr-2 h-4 w-4 shrink-0" />
                        Finalizar Rodada
                      </Button>
                    )}
                    {showNovaRoundButton && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setNovaRoundOpen(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4 shrink-0" />
                        Nova Rodada
                      </Button>
                    )}
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
                      <div className="border-t border-border pt-1.5 mt-0.5 flex flex-row gap-4 items-start flex-wrap">
                        <div className="min-w-0">
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
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {!hasPermission("order.create") ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    disabled={!hasSelection}
                                    title="Sem permissão"
                                    className="w-fit whitespace-nowrap shrink-0"
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
                              disabled={!hasSelection || finalizing}
                              className="w-fit whitespace-nowrap shrink-0"
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              {finalizing ? "Criando..." : "Criar Pedido"}
                            </Button>
                          )}
                          {!isReadOnly && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-fit whitespace-nowrap shrink-0"
                                  disabled={finishingQuotation}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {finishingQuotation ? "Finalizando..." : "Finalizar Cotação"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Finalizar cotação?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja finalizar esta cotação? Esta ação marcará
                                    a cotação como concluída e não poderá ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleFinishQuotation}
                                    disabled={finishingQuotation}
                                  >
                                    Confirmar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    )}
                    {!hasSelection && !isReadOnly && (
                      <div className="border-t border-border pt-1.5 mt-0.5">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit whitespace-nowrap shrink-0"
                              disabled={finishingQuotation}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {finishingQuotation ? "Finalizando..." : "Finalizar Cotação"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Finalizar cotação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja finalizar esta cotação? Esta ação marcará a
                                cotação como concluída e não poderá ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleFinishQuotation}
                                disabled={finishingQuotation}
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start w-full">
                  {/* Tabela esquerda: colunas fixas */}
                  <div
                    className="flex-shrink-0 relative z-10 bg-white dark:bg-[#09090b] shadow-[2px_0_4px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.25)]"
                  >
                    <table ref={leftTableRef} className="caption-bottom text-sm" style={{ width: FIXED_WIDTH }}>
                      <TableHeader className="bg-white dark:bg-[#09090b]">
                        <TableRow style={leftTheadSpacerHeight > 0 ? { height: leftTheadSpacerHeight } : undefined}>
                          <TableHead colSpan={4} className="min-w-[406px] w-[406px] p-0 border-b border-r border-border" />
                        </TableRow>
                        <TableRow style={{ height: 44 }}>
                          <TableHead className="min-w-[90px] w-[90px] h-11 bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium overflow-hidden">
                            Código
                          </TableHead>
                          <TableHead className="min-w-[220px] w-[220px] h-11 bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium overflow-hidden">
                            Descrição Curta
                          </TableHead>
                          <TableHead className="min-w-[48px] w-[48px] h-11 bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium text-center overflow-hidden">
                            Qtd
                          </TableHead>
                          <TableHead className="min-w-[48px] w-[48px] h-11 bg-white dark:bg-[#09090b] border-b border-r border-border py-2 text-xs font-medium text-center overflow-hidden">
                            UN
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                    {quotationItems.map((qi, rowIdx) => {
                      const orderedInfo = orderedItems.get(qi.id)
                      const isOrdered = Boolean(orderedInfo)
                      return (
                      <TableRow
                        key={qi.id}
                        style={{ height: 44 }}
                        title={
                          isOrdered && orderedInfo?.roundNumber != null
                            ? `Pedido criado na Rodada ${orderedInfo.roundNumber}`
                            : undefined
                        }
                        className={cn(
                          isOrdered && "bg-zinc-100 dark:bg-zinc-800",
                          rowIdx % 2 === 1 && "bg-muted/30",
                          itemSelections[qi.id] != null && "bg-primary/5",
                        )}
                      >
                        <TableCell
                          className={cn(
                            "min-w-[90px] w-[90px] font-mono text-xs whitespace-nowrap overflow-hidden max-h-11",
                            isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.material_code}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "min-w-[220px] w-[220px] whitespace-nowrap overflow-hidden max-h-11",
                            isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.material_description}
                          {qi.long_description ? (
                            <span title={qi.long_description} className="inline-block ml-1">
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help flex-shrink-0 inline ml-1" />
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "min-w-[48px] w-[48px] text-center whitespace-nowrap overflow-hidden max-h-11",
                            isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.quantity}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "min-w-[48px] w-[48px] text-center whitespace-nowrap border-r border-border overflow-hidden max-h-11",
                            isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                            rowIdx % 2 === 0 ? "bg-zinc-50 dark:bg-[#18181b]" : "bg-white dark:bg-[#09090b]",
                            itemSelections[qi.id] != null && "!bg-blue-50 dark:!bg-blue-950",
                          )}
                        >
                          {qi.unit_of_measure}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </table>
              </div>

              {/* Tabela direita: fornecedores com scroll */}
              <div className="flex-1 overflow-x-auto min-w-0">
                <table
                  ref={rightTableRef}
                  className="w-full caption-bottom text-sm"
                  style={{ minWidth: minSupplierTableWidth }}
                >
                  <TableHeader className="bg-white dark:bg-[#09090b]">
                    <TableRow>
                      {proposals.map((p) => (
                        <TableHead
                          key={p.id}
                          colSpan={colsPerSupplier}
                          className={cn(
                            "border-l py-4",
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
                              Total:{" "}
                              {supplierTotalByProposal[p.id] == null
                                ? "—"
                                : formatCurrency(supplierTotalByProposal[p.id]!)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Ponderado:{" "}
                              {proposalItemsForSelectedRound(p, selectedRoundId).length === 0 ||
                              commonItems.length === 0
                                ? "—"
                                : formatCurrency(weightedPriceByProposal[p.id] ?? 0)}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              Cond. Pgto: {p.payment_condition ?? "—"}
                            </p>
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
                    <TableRow style={{ height: 44 }}>
                      {proposals.map((p) => (
                        <React.Fragment key={p.id}>
                          <TableHead
                            key={`${p.id}-sel`}
                            className="min-w-[40px] w-[40px] border-l text-center text-xs whitespace-nowrap py-2"
                          >
                            ✓
                          </TableHead>
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
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationItems.map((qi, rowIdx) => {
                      const orderedInfo = orderedItems.get(qi.id)
                      const isOrdered = Boolean(orderedInfo)
                      return (
                      <TableRow
                        key={qi.id}
                        title={
                          isOrdered && orderedInfo?.roundNumber != null
                            ? `Pedido criado na Rodada ${orderedInfo.roundNumber}`
                            : undefined
                        }
                        className={cn(
                          isOrdered && "bg-zinc-100 dark:bg-zinc-800",
                          rowIdx % 2 === 1 && "bg-muted/30",
                          itemSelections[qi.id] != null && "bg-primary/5",
                        )}
                        style={{ height: 44 }}
                      >
                        {proposals.map((p) => {
                          const itemRid = getItemRoundId(qi.id)
                          const pi = getProposalItemForQuotationItem(
                            p,
                            qi.id,
                            itemRid,
                            allProposalsCatalog,
                          )
                          const targetP = getTargetProposalForCell(p, itemRid, allProposalsCatalog)
                          const hasQuotablePrice = !!pi && pi.unit_price > 0
                          const totalItem = hasQuotablePrice ? (pi!.unit_price ?? 0) * qi.quantity : 0
                          const isBestPrice =
                            !!hasQuotablePrice &&
                            bestPriceByItem[qi.id]?.proposalId === p.id
                          const orderedHistProposal =
                            orderedInfo?.proposalId &&
                            allProposalsCatalog.find((pp) => pp.id === orderedInfo.proposalId)
                          const showOrderIcon =
                            isOrdered &&
                            Boolean(orderedHistProposal && sameSupplier(p, orderedHistProposal))

                          return (
                            <React.Fragment key={p.id}>
                              <TableCell
                                key={`${p.id}-sel`}
                                className={cn(
                                  "min-w-[40px] w-[40px] border-l text-center whitespace-nowrap overflow-hidden max-h-11",
                                  isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                                  itemSelections[qi.id] != null && "bg-primary/5",
                                )}
                              >
                                {showOrderIcon ? (
                                  <button
                                    type="button"
                                    title={
                                      orderedInfo!.roundNumber != null
                                        ? `Pedido: ${orderedInfo!.orderCode} (Rodada ${orderedInfo!.roundNumber})`
                                        : `Pedido: ${orderedInfo!.orderCode}`
                                    }
                                    className="inline-flex cursor-pointer items-center justify-center text-primary hover:text-primary/80"
                                    onClick={() =>
                                      router.push(`/comprador/pedidos/${orderedInfo!.orderId}`)
                                    }
                                  >
                                    <ShoppingCart className="h-4 w-4" />
                                  </button>
                                ) : isOrdered ? null : (
                                  <input
                                    type="checkbox"
                                    checked={itemSelections[qi.id] === p.id}
                                    disabled={!hasQuotablePrice || isReadOnly}
                                    onChange={() => handleToggleItem(qi.id, p.id)}
                                    className={cn(
                                      "cursor-pointer",
                                      (!hasQuotablePrice || isReadOnly) &&
                                        "opacity-40 cursor-not-allowed",
                                    )}
                                  />
                                )}
                              </TableCell>
                              {columnVisibility.prazo && (
                                <TableCell
                                  key={`${p.id}-prazo`}
                                  className={cn(
                                    "min-w-[80px] w-[80px] border-l text-center text-sm whitespace-nowrap overflow-hidden max-h-11",
                                    isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                                    !hasQuotablePrice && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {hasQuotablePrice && pi?.delivery_days != null
                                    ? `${pi.delivery_days}`
                                    : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.preco_unit && (
                                <TableCell
                                  key={`${p.id}-preco`}
                                  className={cn(
                                    "min-w-[100px] w-[100px] border-l text-center text-sm whitespace-nowrap overflow-hidden max-h-11",
                                    isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                                    !hasQuotablePrice && "text-muted-foreground",
                                    hasQuotablePrice &&
                                      isBestPrice &&
                                      "bg-green-50 text-green-700 font-semibold",
                                    itemSelections[qi.id] != null && !isBestPrice && "bg-primary/5",
                                  )}
                                >
                                  {hasQuotablePrice ? formatCurrency(pi!.unit_price) : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.imposto && (
                                <TableCell
                                  key={`${p.id}-imposto`}
                                  className={cn(
                                    "min-w-[80px] w-[80px] border-l text-center text-sm whitespace-nowrap overflow-hidden max-h-11",
                                    isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                                    !hasQuotablePrice && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {hasQuotablePrice && pi!.tax_percent != null
                                    ? `${pi!.tax_percent}%`
                                    : "—"}
                                </TableCell>
                              )}
                              {columnVisibility.total_item && (
                                <TableCell
                                  key={`${p.id}-total`}
                                  className={cn(
                                    "min-w-[100px] w-[100px] border-l text-center text-sm whitespace-nowrap overflow-hidden max-h-11",
                                    isOrdered && "!bg-zinc-100 dark:!bg-zinc-800",
                                    !hasQuotablePrice && "text-muted-foreground",
                                    itemSelections[qi.id] != null && "bg-primary/5",
                                  )}
                                >
                                  {hasQuotablePrice
                                    ? totalItem.toLocaleString("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      })
                                    : "—"}
                                </TableCell>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </TableRow>
                    )})}
                  </TableBody>
                </table>
              </div>
            </div>
            </>
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
            Economia máxima:{" "}
            {!hasProposalResponsesInRound
              ? "Aguardando respostas"
              : formatCurrency(splitTotalPrice)}
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
              {hasProposalResponsesInRound ? (
                <>
                  Combinando os melhores preços por item entre todos os fornecedores, o custo total seria{" "}
                  {formatCurrency(splitTotalPrice)} dividido entre {splitSuppliers} fornecedor(es).
                </>
              ) : (
                <>Aguardando respostas dos fornecedores nesta rodada.</>
              )}
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

      <AlertDialog open={finalizeRoundOpen} onOpenChange={setFinalizeRoundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar rodada?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar esta rodada? Os fornecedores não poderão mais responder e a
              cotação voltará para análise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingRound}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              disabled={closingRound}
              onClick={() => void handleFinalizeRound()}
            >
              {closingRound ? "Finalizando..." : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={novaRoundOpen}
        onOpenChange={(open) => {
          setNovaRoundOpen(open)
          if (!open) setNovaRoundDeadline("")
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nova rodada de negociação</AlertDialogTitle>
            <AlertDialogDescription>
              Criar nova rodada de negociação? Os fornecedores e itens sem pedido serão copiados da rodada
              atual. A cotação voltará para Aguardando Resposta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="nova-round-deadline">Prazo de Resposta</Label>
            <input
              id="nova-round-deadline"
              type="date"
              required
              min={getTomorrowInputMin()}
              value={novaRoundDeadline}
              onChange={(e) => setNovaRoundDeadline(e.target.value)}
              className={cn(
                "flex h-9 w-full max-w-[240px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingRound}>Cancelar</AlertDialogCancel>
            <Button type="button" disabled={creatingRound} onClick={() => void handleNovaRodada()}>
              {creatingRound ? "Criando..." : "Confirmar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={orderSuccessDialog.open}
        onOpenChange={(open) => {
          if (!open) setOrderSuccessDialog((s) => ({ ...s, open: false }))
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sm:text-center">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="h-12 w-12 shrink-0 text-green-600" aria-hidden />
              <DialogTitle className="text-center">Pedido(s) criado(s) com sucesso</DialogTitle>
            </div>
          </DialogHeader>
          <ul className="max-h-[40vh] space-y-2 overflow-y-auto text-sm">
            {orderSuccessDialog.orders.map((o) => (
              <li key={`${o.code}-${o.supplierName}`} className="border-b border-border/60 pb-2 last:border-0">
                <span className="font-mono font-medium">{o.code}</span>
                <span className="text-muted-foreground"> — {o.supplierName}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Os pedidos foram criados com status Rascunho. Acesse cada pedido para revisar os dados e
            confirmar o envio.
          </p>
          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              className="min-w-24"
              onClick={() => {
                setOrderSuccessDialog((s) => ({ ...s, open: false }))
                void fetchEqualizationData({ showLoading: false })
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
