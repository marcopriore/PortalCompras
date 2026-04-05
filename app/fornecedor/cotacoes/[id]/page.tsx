"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Info,
  Lock,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { createNotification } from "@/lib/notify"
import { logAudit } from "@/lib/audit"
import { useUser } from "@/lib/hooks/useUser"
import { cn } from "@/lib/utils"
import { formatDateBR, isExpiredDate, isUrgentDate } from "@/lib/utils/date-helpers"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ImportProposalWizard } from "@/components/fornecedor/import-proposal-wizard"

type CompanyEmbed = { name: string; cnpj?: string | null }

type QuotationDetail = {
  id: string
  code: string
  description: string
  status: string
  company_id: string
  companies?: CompanyEmbed | CompanyEmbed[] | null
}

type RoundRow = {
  id: string
  quotation_id: string
  company_id?: string | null
  round_number: number
  status: "active" | "closed" | string
  response_deadline: string | null
  created_at?: string | null
  closed_at?: string | null
}

type QuotationItemRow = {
  id: string
  quotation_id: string
  company_id?: string | null
  material_code: string
  material_description: string
  long_description?: string | null
  unit_of_measure: string | null
  quantity: number | string
}

type ProposalItemRow = {
  id?: string
  proposal_id?: string
  quotation_item_id: string
  round_id?: string | null
  company_id?: string | null
  unit_price: number | string | null
  tax_percent: number | string | null
  delivery_days?: number | null
  item_status: string
  observations?: string | null
}

type QuotationProposalRow = {
  id: string
  quotation_id: string
  supplier_id: string | null
  round_id: string | null
  company_id?: string | null
  status: string
  delivery_days: number | null
  payment_condition: string | null
  total_price: number | null
  validity_date: string | null
  observations: string | null
  proposal_items?: ProposalItemRow[] | null
  updated_at?: string | null
}

type PaymentOptionRow = {
  id: string
  code: string
  description: string
}

type ItemFormRow = {
  quotation_item_id: string
  proposal_item_id: string | null
  previous_unit_price: number
  delivery_days: number | null
  unit_price: number
  tax_percent: number
  item_status: "accepted" | "rejected" | "not_answered"
  observations: string
}

const ITEMS_PER_PAGE = 20

const readOnlyFieldClass =
  "border-0 bg-transparent shadow-none focus-visible:ring-0 cursor-default disabled:opacity-100"

function itemRowStatusUi(row: ItemFormRow): {
  badgeLabel: string
  badgeClassName: string
  showAcceptRejectButtons: boolean
} {
  if (row.item_status === "rejected") {
    return {
      badgeLabel: "Recusado",
      badgeClassName: "bg-red-100 text-red-800",
      showAcceptRejectButtons: true,
    }
  }
  if (row.item_status === "accepted") {
    return {
      badgeLabel: "Aceito",
      badgeClassName: "bg-green-100 text-green-800",
      showAcceptRejectButtons: true,
    }
  }
  return {
    badgeLabel: "Não respondido",
    badgeClassName: "bg-gray-100 text-gray-500",
    showAcceptRejectButtons: true,
  }
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatCurrency(value: number) {
  return money.format(Number.isFinite(value) ? value : 0)
}

function pickCompany(q: QuotationDetail): { name: string; cnpj: string | null } | null {
  const c = q.companies
  if (!c) return null
  if (Array.isArray(c)) {
    const first = c[0]
    if (!first) return null
    return { name: first.name, cnpj: first.cnpj ?? null }
  }
  return { name: c.name, cnpj: c.cnpj ?? null }
}

function toNum(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function lineTotal(quantity: number, unitPrice: number, taxPercent: number): number {
  return quantity * unitPrice * (1 + taxPercent / 100)
}

function proposalItemForQuotationItem(
  proposal: QuotationProposalRow | null | undefined,
  quotationItemId: string,
): ProposalItemRow | undefined {
  if (!proposal?.proposal_items?.length) return undefined
  return proposal.proposal_items.find((pi) => pi.quotation_item_id === quotationItemId)
}

function buildItemFormRows(
  items: QuotationItemRow[],
  sourceProposal: QuotationProposalRow | null | undefined,
  previousProposal: QuotationProposalRow | null | undefined,
  prefillPreviousRound = false,
): ItemFormRow[] {
  const mapDbItemStatusToUi = (
    itemStatus: string | null | undefined,
    unitPrice: number,
  ): ItemFormRow["item_status"] => {
    if (itemStatus === "rejected") return "rejected"
    if (itemStatus === "accepted") {
      return unitPrice === 0 ? "not_answered" : "accepted"
    }
    return "not_answered"
  }

  const previousItemMap = Object.fromEntries(
    (previousProposal?.proposal_items ?? []).map((pi) => [pi.quotation_item_id, pi]),
  )

  if (prefillPreviousRound && sourceProposal) {
    const sourceItemMap = Object.fromEntries(
      (sourceProposal.proposal_items ?? []).map((pi) => [pi.quotation_item_id, pi]),
    )
    const rows: ItemFormRow[] = items.map((qi) => {
      const prevItem = sourceItemMap[qi.id]
      const prevUnit = toNum(prevItem?.unit_price)
      const prevStatus = mapDbItemStatusToUi(prevItem?.item_status, prevUnit)
      return {
        quotation_item_id: qi.id,
        proposal_item_id: null,
        previous_unit_price: prevUnit,
        delivery_days: prevItem?.delivery_days ?? null,
        unit_price: prevUnit,
        tax_percent: toNum(prevItem?.tax_percent),
        item_status: prevStatus,
        observations: (prevItem?.observations ?? "").trim(),
      }
    })
    return rows
  }

  const rows: ItemFormRow[] = items.map((qi) => {
    const pi = proposalItemForQuotationItem(sourceProposal, qi.id)
    let unitPrice = toNum(pi?.unit_price)
    const status = mapDbItemStatusToUi(pi?.item_status, unitPrice)
    let taxPercent = toNum(pi?.tax_percent)
    if (status === "rejected") {
      unitPrice = 0
      taxPercent = 0
    }
    const previousUnit = toNum(previousItemMap[qi.id]?.unit_price)
    return {
      quotation_item_id: qi.id,
      proposal_item_id: pi?.id ?? null,
      previous_unit_price: previousUnit,
      delivery_days: pi?.delivery_days ?? null,
      unit_price: unitPrice,
      tax_percent: taxPercent,
      item_status: status,
      observations: (pi?.observations ?? "").trim(),
    }
  })
  return rows
}

export default function FornecedorCotacaoPropostaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: quotationId } = React.use(params)
  const { userId, supplierId, loading: userLoading } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [quotation, setQuotation] = React.useState<QuotationDetail | null>(null)
  const [rounds, setRounds] = React.useState<RoundRow[]>([])
  const [quotationItems, setQuotationItems] = React.useState<QuotationItemRow[]>([])

  const [activeRound, setActiveRound] = React.useState<RoundRow | null>(null)
  const [previousRound, setPreviousRound] = React.useState<RoundRow | null>(null)
  const [selectedRoundId, setSelectedRoundId] = React.useState<string | null>(null)

  const [proposalsByRoundId, setProposalsByRoundId] = React.useState<
    Record<string, QuotationProposalRow>
  >({})

  const [prefillFromRoundNumber, setPrefillFromRoundNumber] = React.useState<number | null>(
    null,
  )

  const [proposalId, setProposalId] = React.useState<string | null>(null)
  const [proposalStatus, setProposalStatus] = React.useState<string>("invited")
  const [supplierInfo, setSupplierInfo] = React.useState<{
    name: string
    cnpj: string | null
  } | null>(null)

  const [paymentCondition, setPaymentCondition] = React.useState("")
  const [paymentOptions, setPaymentOptions] = React.useState<PaymentOptionRow[]>([])
  const [validityDate, setValidityDate] = React.useState("")
  const [observations, setObservations] = React.useState("")

  const [itemRows, setItemRows] = React.useState<ItemFormRow[]>([])
  const [previousActiveProposal, setPreviousActiveProposal] =
    React.useState<QuotationProposalRow | null>(null)

  const [saving, setSaving] = React.useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = React.useState(false)
  const [showSubmitWarning, setShowSubmitWarning] = React.useState(false)
  const [submitWarningCount, setSubmitWarningCount] = React.useState(0)
  const [itemPage, setItemPage] = React.useState(1)
  const [selectedItemIds, setSelectedItemIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [globalDiscount, setGlobalDiscount] = React.useState("")
  const [importWizardOpen, setImportWizardOpen] = React.useState(false)

  const refreshProposalForRound = React.useCallback(
    (roundId: string, row: QuotationProposalRow) => {
      setProposalsByRoundId((prev) => ({ ...prev, [roundId]: row }))
    },
    [],
  )

  React.useEffect(() => {
    if (userLoading) return

    if (!supplierId) {
      setLoading(false)
      setLoadError(null)
      setQuotation(null)
      setRounds([])
      setQuotationItems([])
      setActiveRound(null)
      setPreviousRound(null)
      setSelectedRoundId(null)
      setProposalsByRoundId({})
      setSupplierInfo(null)
      setPaymentOptions([])
      return
    }

    let cancelled = false
    const supabase = createClient()

    const run = async () => {
      setLoading(true)
      setLoadError(null)

      let qRow: QuotationDetail | null = null
      let roundsLocal: RoundRow[] = []
      let itemsLocal: QuotationItemRow[] = []
      let active: RoundRow | null = null
      let previous: RoundRow | null = null
      let activeProposal: QuotationProposalRow | null = null
      let previousProposal: QuotationProposalRow | null = null
      let supplierLocal: { name: string; cnpj: string | null } | null = null
      let proposalsByRoundMap: Record<string, QuotationProposalRow> = {}

      const [supplierResult, quotationResult] = await Promise.all([
        supabase.from("suppliers").select("id, name, cnpj").eq("id", supplierId).single(),
        supabase
          .from("quotations")
          .select("id, code, description, status, company_id, companies(name, cnpj)")
          .eq("id", quotationId)
          .single(),
      ])

      if (supplierResult.error) {
        console.error(supplierResult.error)
        if (!cancelled) setLoadError("Não foi possível carregar os dados do fornecedor.")
      } else {
        supplierLocal = {
          name: supplierResult.data?.name ?? "",
          cnpj: supplierResult.data?.cnpj ?? null,
        }
      }

      if (quotationResult.error) {
        console.error(quotationResult.error)
        if (!cancelled) {
          setLoadError("Não foi possível carregar a cotação.")
          setQuotation(null)
          setPaymentOptions([])
          setLoading(false)
        }
        return
      }

      qRow = quotationResult.data as QuotationDetail

      const companyId = qRow.company_id
      const [roundsResult, itemsResult, paymentResult, allProposalsResult] = await Promise.all([
        supabase
          .from("quotation_rounds")
          .select(
            "id, quotation_id, company_id, round_number, status, response_deadline, created_at, closed_at",
          )
          .eq("quotation_id", quotationId)
          .order("round_number", { ascending: true }),
        supabase
          .from("quotation_items")
          .select(
            "id, quotation_id, company_id, material_code, material_description, long_description, unit_of_measure, quantity",
          )
          .eq("quotation_id", quotationId)
          .order("material_description", { ascending: true }),
        supabase
          .from("payment_conditions")
          .select("id, code, description")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("code", { ascending: true }),
        supabase
          .from("quotation_proposals")
          .select("*, proposal_items(*)")
          .eq("quotation_id", quotationId)
          .eq("supplier_id", supplierId),
      ])

      if (!cancelled) {
        if (paymentResult.error) {
          console.error(paymentResult.error)
          setPaymentOptions([])
        } else {
          setPaymentOptions((paymentResult.data ?? []) as PaymentOptionRow[])
        }
      }

      if (roundsResult.error) {
        console.error(roundsResult.error)
        if (!cancelled) setLoadError("Não foi possível carregar as rodadas.")
      } else {
        roundsLocal = (roundsResult.data ?? []) as RoundRow[]
        active = roundsLocal.find((r) => r.status === "active") ?? null
        if (active != null) {
          const activeRoundRef = active
          previous =
            roundsLocal.find(
              (r) => r.round_number === activeRoundRef.round_number - 1,
            ) ?? null
        } else {
          previous = null
        }
      }

      if (itemsResult.error) {
        console.error(itemsResult.error)
        if (!cancelled) setLoadError("Não foi possível carregar os itens da cotação.")
      } else {
        itemsLocal = (itemsResult.data ?? []) as QuotationItemRow[]
      }

      if (allProposalsResult.error) {
        console.error(allProposalsResult.error)
      } else {
        const list = (allProposalsResult.data ?? []) as QuotationProposalRow[]
        const map: Record<string, QuotationProposalRow> = {}
        for (const p of list) {
          if (p.round_id) map[p.round_id] = p
        }
        proposalsByRoundMap = map
        activeProposal = active ? (map[active.id] ?? null) : null
        previousProposal = previous ? (map[previous.id] ?? null) : null
      }

      if (cancelled) return

      setQuotation(qRow)
      setRounds(roundsLocal)
      setQuotationItems(itemsLocal)
      setActiveRound(active)
      setPreviousRound(previous)
      setSupplierInfo(supplierLocal)
      setProposalsByRoundId(proposalsByRoundMap)

      const defaultSelected = active?.id ?? roundsLocal[roundsLocal.length - 1]?.id ?? null
      setSelectedRoundId(defaultSelected)

      if (activeProposal) {
        setPrefillFromRoundNumber(null)
        setProposalId(activeProposal.id)
        setProposalStatus(activeProposal.status ?? "invited")
        setPaymentCondition(activeProposal.payment_condition ?? "")
        setValidityDate(activeProposal.validity_date ? String(activeProposal.validity_date) : "")
        setObservations(activeProposal.observations ?? "")
        setPreviousActiveProposal(previousProposal)
        setItemRows(buildItemFormRows(itemsLocal, activeProposal, previousProposal))
      } else if (previousProposal) {
        const prevMeta =
          previous ??
          roundsLocal.find((r) => r.id === previousProposal.round_id) ??
          null
        setPrefillFromRoundNumber(prevMeta?.round_number ?? null)
        setProposalId(null)
        setProposalStatus("invited")
        setPaymentCondition(previousProposal.payment_condition ?? "")
        setValidityDate(
          previousProposal.validity_date ? String(previousProposal.validity_date) : "",
        )
        setObservations(previousProposal.observations ?? "")
        setPreviousActiveProposal(previousProposal)
        setItemRows(buildItemFormRows(itemsLocal, previousProposal, null, true))
      } else {
        setPrefillFromRoundNumber(null)
        setProposalId(null)
        setProposalStatus("invited")
        setPaymentCondition("")
        setValidityDate("")
        setObservations("")
        setPreviousActiveProposal(null)
        setItemRows(buildItemFormRows(itemsLocal, null, null))
      }

      setLoading(false)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [quotationId, supplierId, userLoading])

  React.useEffect(() => {
    setItemPage(1)
    setSelectedItemIds(new Set())
    setGlobalDiscount("")
    setShowSubmitWarning(false)
    setSubmitWarningCount(0)
  }, [selectedRoundId])

  const buyerCompanyId = quotation?.company_id ?? null

  const selectedRound = React.useMemo(
    () => rounds.find((r) => r.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId],
  )

  const roundProposalForView = selectedRoundId
    ? proposalsByRoundId[selectedRoundId] ?? null
    : null

  const viewingActiveRound =
    Boolean(activeRound && selectedRoundId && selectedRoundId === activeRound.id)

  const activeRoundProposal =
    viewingActiveRound && activeRound?.id ? proposalsByRoundId[activeRound.id] ?? null : null

  const isExpired = selectedRound?.response_deadline
    ? isExpiredDate(selectedRound.response_deadline)
    : false

  const isReadonlyForm = Boolean(
    selectedRound?.status === "closed" ||
      isExpired ||
      (activeRoundProposal?.status === "submitted"),
  )

  const canEditActiveForm = !isReadonlyForm

  const urgentDeadline = activeRound?.response_deadline
    ? isUrgentDate(activeRound.response_deadline, 2)
    : false
  const submittedAtLabel = React.useMemo(() => {
    const iso = activeRoundProposal?.updated_at
    if (!iso) return null
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) return null
    const data = dt.toLocaleDateString("pt-BR")
    const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    return { data, hora }
  }, [activeRoundProposal?.updated_at])

  const generalDisplay = React.useMemo(() => {
    const fromActiveTab = viewingActiveRound
    if (fromActiveTab) {
      return {
        paymentCondition,
        validityDate,
        observations,
        disabled: !canEditActiveForm,
      }
    }
    const rp = roundProposalForView
    return {
      paymentCondition: rp?.payment_condition ?? "",
      validityDate: rp?.validity_date ? String(rp.validity_date) : "",
      observations: rp?.observations ?? "",
      disabled: true,
    }
  }, [
    viewingActiveRound,
    canEditActiveForm,
    paymentCondition,
    validityDate,
    observations,
    roundProposalForView,
  ])

  const paymentSelectValue = React.useMemo(() => {
    const v = generalDisplay.paymentCondition?.trim() ?? ""
    if (!v) return undefined
    return paymentOptions.some((o) => o.code === v) ? v : undefined
  }, [generalDisplay.paymentCondition, paymentOptions])

  const itemRowsForDisplay = React.useMemo(() => {
    if (canEditActiveForm) {
      return { mode: "live" as const, rows: itemRows }
    }
    const rp = roundProposalForView
    const previousForView = viewingActiveRound ? previousActiveProposal : null
    return {
      mode: "readonly" as const,
      rows: buildItemFormRows(quotationItems, rp, previousForView),
    }
  }, [
    canEditActiveForm,
    itemRows,
    roundProposalForView,
    quotationItems,
    viewingActiveRound,
    previousActiveProposal,
  ])

  const totalItemPages = Math.max(
    1,
    Math.ceil(quotationItems.length / ITEMS_PER_PAGE) || 1,
  )
  const itemPageClamped = Math.min(Math.max(itemPage, 1), totalItemPages)
  const paginatedQuotationItems = React.useMemo(
    () =>
      quotationItems.slice(
        (itemPageClamped - 1) * ITEMS_PER_PAGE,
        itemPageClamped * ITEMS_PER_PAGE,
      ),
    [quotationItems, itemPageClamped],
  )

  const quotationItemMap = React.useMemo(
    () => new Map(quotationItems.map((qi) => [qi.id, qi])),
    [quotationItems],
  )

  const grandTotal = React.useMemo(() => {
    const rows = itemRowsForDisplay.rows
    let sum = 0
    for (const row of rows) {
      if (row.item_status !== "accepted") continue
      const qi = quotationItemMap.get(row.quotation_item_id)
      if (!qi) continue
      const qty = toNum(qi.quantity)
      sum += lineTotal(qty, row.unit_price, row.tax_percent)
    }
    return sum
  }, [itemRowsForDisplay.rows, quotationItemMap])

  const allSelected = React.useMemo(() => {
    if (paginatedQuotationItems.length === 0) return false
    return paginatedQuotationItems.every((qi) => selectedItemIds.has(qi.id))
  }, [paginatedQuotationItems, selectedItemIds])

  const toggleSelectAll = React.useCallback(() => {
    const pageIds = paginatedQuotationItems.map((q) => q.id)
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => next.has(id))
      if (pageAllSelected) {
        for (const id of pageIds) next.delete(id)
      } else {
        for (const id of pageIds) next.add(id)
      }
      return next
    })
  }, [paginatedQuotationItems])

  const toggleItemSelect = React.useCallback((quotationItemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(quotationItemId)) next.delete(quotationItemId)
      else next.add(quotationItemId)
      return next
    })
  }, [])

  const applyGlobalDiscount = React.useCallback(() => {
    if (!canEditActiveForm) return
    const pct = Number.parseFloat(globalDiscount)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) return
    let updatedCount = 0
    setItemRows((prev) =>
      prev.map((item) => {
        if (!selectedItemIds.has(item.quotation_item_id)) return item
        if (item.item_status === "rejected" || item.previous_unit_price <= 0) return item
        updatedCount += 1
        const discounted = item.previous_unit_price * (1 - pct / 100)
        const rounded = Math.round(discounted * 100) / 100
        return { ...item, unit_price: rounded }
      }),
    )
    if (updatedCount === 0) {
      toast.error("Nenhum item com preço anterior para aplicar desconto")
    }
  }, [canEditActiveForm, globalDiscount, selectedItemIds])

  const updateItemRow = (quotationItemId: string, patch: Partial<ItemFormRow>) => {
    setItemRows((prev) =>
      prev.map((r) => {
        if (r.quotation_item_id !== quotationItemId) return r
        let next = { ...r, ...patch }
        if (next.item_status === "rejected") {
          next = { ...next, unit_price: 0, tax_percent: 0 }
        }
        return next
      }),
    )
  }

  const validateForSubmit = (): boolean => {
    for (const row of itemRows) {
      if (row.item_status !== "accepted") continue
      if (!(row.unit_price > 0)) {
        toast.error("Preencha o preço de todos os itens aceitos.")
        return false
      }
    }
    return true
  }

  const saveProposal = async (submitAfter: boolean, forceDiscardPending = false): Promise<boolean> => {
    if (!supplierId || !activeRound || !quotation || !buyerCompanyId) {
      toast.error("Dados incompletos para salvar.")
      return false
    }
    if (!paymentCondition.trim()) {
      toast.error("Preencha a Condição de Pagamento antes de enviar.")
      return false
    }
    if (submitAfter && !validateForSubmit()) return false

    const supabase = createClient()
    setSaving(true)

    const rowsToPersist = itemRows.map((row) => {
      if (submitAfter && forceDiscardPending && row.item_status === "not_answered" && row.unit_price > 0) {
        return { ...row, item_status: "accepted" as const, unit_price: 0 }
      }
      return row
    })

    const total = rowsToPersist.reduce((acc, row) => {
      if (row.item_status !== "accepted") return acc
      const qi = quotationItems.find((q) => q.id === row.quotation_item_id)
      if (!qi) return acc
      const qty = toNum(qi.quantity)
      return acc + lineTotal(qty, row.unit_price, row.tax_percent)
    }, 0)

    const statusForUpsert =
      proposalId != null ? proposalStatus : "invited"

    const proposalPayload: Record<string, unknown> = {
      quotation_id: quotation.id,
      supplier_id: supplierId,
      supplier_name: supplierInfo?.name ?? "",
      supplier_cnpj: supplierInfo?.cnpj ?? null,
      round_id: activeRound.id,
      company_id: buyerCompanyId,
      payment_condition: paymentCondition.trim() || null,
      validity_date: validityDate || null,
      observations: observations.trim() || null,
      total_price: total,
      status: statusForUpsert,
    }

    if (proposalId) proposalPayload.id = proposalId

    try {
      const { data: proposalData, error: proposalError } = await supabase
        .from("quotation_proposals")
        .upsert(proposalPayload, { onConflict: "quotation_id,supplier_id,round_id" })
        .select("id, status, updated_at")
        .single()

      if (proposalError) {
        console.error("Erro upsert proposal:", proposalError)
        toast.error(`Erro ao salvar proposta: ${proposalError.message}`)
        return false
      }

      const newId = (proposalData as { id: string }).id
      setProposalId(newId)

      const itemPayloads = rowsToPersist
        .filter((row) => !(row.item_status === "not_answered" && row.unit_price === 0))
        .map((row) => ({
          ...(row.proposal_item_id ? { id: row.proposal_item_id } : {}),
          proposal_id: newId,
          quotation_item_id: row.quotation_item_id,
          round_id: activeRound.id,
          company_id: buyerCompanyId,
          unit_price: row.item_status === "accepted" ? row.unit_price : 0,
          tax_percent: row.item_status === "accepted" ? row.tax_percent : 0,
          delivery_days: row.delivery_days ?? null,
          item_status: row.item_status === "not_answered" ? "accepted" : row.item_status,
          observations: row.observations.trim() || null,
        }))

      if (itemPayloads.length > 0) {
        const { data: upsertedItems, error: itemsError } = await supabase
          .from("proposal_items")
          .upsert(itemPayloads, { onConflict: "proposal_id,quotation_item_id" })
          .select("id, quotation_item_id")

        if (itemsError) {
          console.error("Erro upsert items:", itemsError)
          toast.error(`Erro ao salvar itens: ${itemsError.message}`)
          return false
        }
        const idByQItem = new Map<string, string>()
        for (const row of (upsertedItems ?? []) as { id: string; quotation_item_id: string }[]) {
          idByQItem.set(row.quotation_item_id, row.id)
        }
        setItemRows((prev) =>
          prev.map((r) => {
            const newPi = idByQItem.get(r.quotation_item_id)
            if (!newPi) return r
            return { ...r, proposal_item_id: newPi }
          }),
        )
      }

      if (submitAfter) {
        const { error: statusError } = await supabase
          .from("quotation_proposals")
          .update({ status: "submitted" })
          .eq("id", newId)
        if (statusError) {
          console.error("Erro update status:", statusError)
          toast.error(`Erro ao confirmar envio: ${statusError.message}`)
          return false
        }
        setProposalStatus("submitted")
        toast.success("Proposta enviada com sucesso.")
        if (userId) {
          await logAudit({
            eventType: "proposal.submitted",
            description: `Proposta enviada — ${quotation.code} Rodada ${activeRound.round_number}`,
            userId,
            companyId: quotation.company_id,
            entity: "quotation_proposals",
            entityId: newId,
            metadata: {
              quotation_code: quotation.code,
              round_number: activeRound.round_number,
              total_price: total,
              items_count: itemRows.filter((r) => r.item_status !== "not_answered").length,
            },
          })
        }
        try {
          const { data: quotationCreator } = await supabase
            .from("quotations")
            .select("created_by")
            .eq("id", quotationId)
            .single()
          if (quotationCreator?.created_by) {
            await createNotification({
              userId: quotationCreator.created_by,
              companyId: quotation.company_id,
              type: "proposal.submitted",
              title: "Nova proposta recebida",
              body: `${supplierInfo?.name ?? "Fornecedor"} enviou proposta para ${quotation.code}`,
              entity: "quotation_proposals",
              entityId: newId,
            })
          }
        } catch (e) {
          console.error("notify proposal.submitted:", e)
        }
      } else {
        toast.success("Rascunho salvo.")
        if (userId) {
          await logAudit({
            eventType: "proposal.saved",
            description: `Proposta salva como rascunho — ${quotation.code} Rodada ${activeRound.round_number}`,
            userId,
            companyId: quotation.company_id,
            entity: "quotation_proposals",
            entityId: newId,
            metadata: {
              quotation_code: quotation.code,
              round_number: activeRound.round_number,
              total_price: total,
            },
          })
        }
      }

      const { data: refreshed, error: refErr } = await supabase
        .from("quotation_proposals")
        .select("*, proposal_items(*)")
        .eq("id", newId)
        .single()
      if (!refErr && refreshed) {
        const full = refreshed as QuotationProposalRow
        refreshProposalForRound(activeRound.id, full)
        if (!submitAfter) {
          setProposalStatus(full.status)
        }
      }
      return true
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar a proposta.")
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitClick = () => {
    const pendingCount = itemRows.filter(
      (row) => row.unit_price > 0 && row.item_status === "not_answered",
    ).length
    if (pendingCount > 0) {
      setSubmitWarningCount(pendingCount)
      setShowSubmitWarning(true)
      return
    }
    setShowSubmitWarning(false)
    setSubmitWarningCount(0)
    setSubmitDialogOpen(true)
  }

  if (!userLoading && !supplierId) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um cadastro de fornecedor. Entre em contato com o
          suporte para concluir o vínculo.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (loadError || !quotation) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="gap-2" asChild>
          <Link href="/fornecedor/cotacoes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-sm text-destructive">{loadError ?? "Cotação não encontrada."}</p>
      </div>
    )
  }

  const co = pickCompany(quotation)

  return (
    <div className="space-y-8 pb-28">
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="gap-2 -ml-2" asChild>
          <Link href="/fornecedor/cotacoes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{quotation.code}</h1>
            <p className="text-muted-foreground max-w-3xl">{quotation.description}</p>
            {activeRound ? (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge
                  className={cn(
                    activeRound.status === "active"
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200",
                  )}
                >
                  {activeRound.status === "active"
                    ? `Rodada ${activeRound.round_number} — Ativa`
                    : "Encerrada"}
                </Badge>
                {activeRound.response_deadline ? (
                  <span
                    className={cn(
                      "text-sm",
                      urgentDeadline ? "text-red-600 font-medium" : "text-muted-foreground",
                    )}
                  >
                    Prazo: {formatDateBR(activeRound.response_deadline)}
                  </span>
                ) : null}
                {urgentDeadline && activeRound.response_deadline ? (
                  <Badge variant="destructive" className="text-xs">
                    Urgente
                  </Badge>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground pt-2">Não há rodada ativa no momento.</p>
            )}
            {co ? (
              <div className="pt-2 text-sm">
                <p className="font-medium text-foreground">{co.name}</p>
                {co.cnpj ? (
                  <p className="text-muted-foreground">{co.cnpj}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {prefillFromRoundNumber != null ? (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Valores pré-preenchidos com base na Rodada {prefillFromRoundNumber} anterior. Revise e
            confirme.
          </span>
        </div>
      ) : null}

      {selectedRound?.status === "closed" ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2 text-sm text-slate-600">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Esta rodada foi encerrada pelo comprador.</span>
        </div>
      ) : null}

      {isExpired && selectedRound?.status === "active" ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-700">
          <Clock className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>
            O prazo desta rodada expirou em {formatDateBR(selectedRound.response_deadline)}.
            Aguarde nova rodada do comprador.
          </span>
        </div>
      ) : null}

      {selectedRound?.status !== "closed" &&
      viewingActiveRound &&
      activeRoundProposal?.status === "submitted" ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-blue-500" />
          <span>
            Proposta enviada em {submittedAtLabel?.data ?? "—"} às{" "}
            {submittedAtLabel?.hora ?? "—"}. Aguarde nova rodada para alterar.
          </span>
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-foreground">Informações gerais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment">Condição de Pagamento</Label>
            {paymentOptions.length > 0 ? (
              <>
                <Select
                  value={paymentSelectValue}
                  onValueChange={setPaymentCondition}
                  disabled={generalDisplay.disabled}
                >
                  <SelectTrigger
                    id="payment"
                    className={cn(generalDisplay.disabled && readOnlyFieldClass)}
                  >
                    <SelectValue placeholder="Selecione a condição de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.code}>
                        {opt.code} — {opt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paymentSelectValue == null && generalDisplay.paymentCondition?.trim() ? (
                  <p className="text-xs text-muted-foreground">
                    Valor salvo (fora da lista): {generalDisplay.paymentCondition}
                  </p>
                ) : null}
              </>
            ) : (
              <div
                className={cn(
                  "flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3",
                  generalDisplay.disabled && readOnlyFieldClass,
                )}
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {generalDisplay.paymentCondition?.trim()
                    ? generalDisplay.paymentCondition
                    : "Nenhuma condição de pagamento cadastrada pelo comprador."}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="validity">Validade da Proposta</Label>
            <Input
              id="validity"
              type="date"
              value={generalDisplay.validityDate}
              disabled={generalDisplay.disabled}
              className={cn(generalDisplay.disabled && readOnlyFieldClass)}
              onChange={(e) => setValidityDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="obs">Observações gerais</Label>
            <Textarea
              id="obs"
              value={generalDisplay.observations}
              disabled={generalDisplay.disabled}
              className={cn(generalDisplay.disabled && readOnlyFieldClass)}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-white p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-foreground">Itens</h2>

        {rounds.length > 0 && selectedRoundId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground">Rodada</label>
                <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Rodada {r.round_number}
                        {r.status === "active" ? " (atual)" : " (encerrada)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canEditActiveForm ? (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">
                    % Desconto
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(e.target.value)}
                    className="w-20 h-9 border border-border rounded-md bg-background px-2 text-sm text-foreground"
                    placeholder="0"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={applyGlobalDiscount}
                    disabled={selectedItemIds.size === 0}
                  >
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setImportWizardOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Respostas
                  </Button>
                  {selectedItemIds.size > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {selectedItemIds.size} item(s) selecionado(s)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {quotationItems.length}{" "}
              {quotationItems.length === 1 ? "item" : "itens"}
            </p>
          </div>
        ) : null}

        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-2 py-2 text-center">#</th>
              {canEditActiveForm ? (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Selecionar todos os itens desta página"
                  />
                </th>
              ) : null}
              <th className="px-2 py-2 whitespace-nowrap">Cód. material</th>
              <th className="px-2 py-2">Descrição</th>
              <th className="px-2 py-2 whitespace-nowrap">UN</th>
              <th className="px-2 py-2 whitespace-nowrap text-right">Qtd</th>
              <th className="px-2 py-2 whitespace-nowrap w-24">PRAZO (dias)</th>
              <th className="px-2 py-2 whitespace-nowrap">PREÇO ANT.</th>
              <th className="px-2 py-2 whitespace-nowrap">Preço unit.</th>
              <th className="px-2 py-2 whitespace-nowrap">Imposto %</th>
              <th className="px-2 py-2 whitespace-nowrap text-right">Total item</th>
              <th className="px-2 py-2 whitespace-nowrap">Status</th>
              <th className="px-2 py-2 whitespace-nowrap min-w-[140px]">Obs</th>
            </tr>
          </thead>
          <tbody>
            {paginatedQuotationItems.map((qi, index) => {
              const row = itemRowsForDisplay.rows.find((r) => r.quotation_item_id === qi.id)
              if (!row) return null
              const rowUi = itemRowStatusUi(row)
              const qty = toNum(qi.quantity)
              const line =
                row.item_status === "accepted"
                  ? lineTotal(qty, row.unit_price, row.tax_percent)
                  : 0
              const priceDisabled =
                !canEditActiveForm || row.item_status === "rejected"
              const showArButtons =
                canEditActiveForm && rowUi.showAcceptRejectButtons
              const hasPreviousPrice = row.previous_unit_price > 0
              const changedVsPrevious =
                hasPreviousPrice && row.unit_price !== row.previous_unit_price
              const variationPct = hasPreviousPrice
                ? ((row.unit_price - row.previous_unit_price) / row.previous_unit_price) * 100
                : 0
              const rowNumber = (itemPage - 1) * ITEMS_PER_PAGE + index + 1
              const tooltipText = qi.long_description ?? ""
              return (
                <tr key={qi.id} className="border-b border-border align-top">
                  <td className="px-2 py-3 text-center text-sm text-muted-foreground">
                    {rowNumber}
                  </td>
                  {canEditActiveForm ? (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selectedItemIds.has(row.quotation_item_id)}
                        onChange={() => toggleItemSelect(row.quotation_item_id)}
                        aria-label={`Selecionar item ${qi.material_code}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-2 py-3 font-medium text-foreground">{qi.material_code}</td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-1">
                      <span>{qi.material_description}</span>
                      {tooltipText ? (
                        <span title={tooltipText}>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help flex-shrink-0 inline ml-1" />
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-muted-foreground whitespace-nowrap">
                    {qi.unit_of_measure ?? "—"}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{qty}</td>
                  <td className="px-2 py-3">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      className={cn(
                        "w-24",
                        priceDisabled && readOnlyFieldClass,
                      )}
                      disabled={priceDisabled}
                      value={row.delivery_days ?? ""}
                      onChange={(e) =>
                        updateItemRow(qi.id, {
                          delivery_days: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-3">
                    {row.previous_unit_price > 0 ? (
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {formatCurrency(row.previous_unit_price)}
                      </span>
                    ) : (
                      <span className="block text-center text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className={cn(
                        "w-28",
                        priceDisabled && readOnlyFieldClass,
                      )}
                      disabled={priceDisabled}
                      value={row.unit_price}
                      onChange={(e) =>
                        updateItemRow(qi.id, { unit_price: Number(e.target.value) || 0 })
                      }
                    />
                    {changedVsPrevious ? (
                      <p
                        className={cn(
                          "text-xs mt-0.5 tabular-nums",
                          variationPct < 0 ? "text-green-600" : "text-red-600",
                        )}
                      >
                        {variationPct < 0 ? "↓" : "↑"} {Math.abs(variationPct).toFixed(1)}% vs
                        anterior
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      className={cn(
                        "w-24",
                        priceDisabled && readOnlyFieldClass,
                      )}
                      disabled={priceDisabled}
                      value={row.tax_percent || ""}
                      onChange={(e) =>
                        updateItemRow(qi.id, { tax_percent: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="px-2 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatCurrency(line)}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge className={cn("text-xs font-medium", rowUi.badgeClassName)}>
                        {rowUi.badgeLabel}
                      </Badge>
                      {showArButtons ? (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={row.item_status === "accepted" ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => updateItemRow(qi.id, { item_status: "accepted" })}
                          >
                            Aceito
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              row.item_status === "rejected" ? "destructive" : "outline"
                            }
                            className="h-8 text-xs"
                            onClick={() => updateItemRow(qi.id, { item_status: "rejected" })}
                          >
                            Recusado
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Input
                      value={row.observations}
                      disabled={!canEditActiveForm}
                      onChange={(e) => updateItemRow(qi.id, { observations: e.target.value })}
                      placeholder="—"
                      className={cn(
                        "min-w-[120px]",
                        !canEditActiveForm && readOnlyFieldClass,
                      )}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex justify-between items-center mt-3 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-foreground"
            disabled={itemPageClamped <= 1}
            onClick={() => setItemPage((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {itemPageClamped} de {totalItemPages} · {quotationItems.length} itens
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-foreground"
            disabled={itemPageClamped >= totalItemPages}
            onClick={() =>
              setItemPage((p) => Math.min(totalItemPages, p + 1))
            }
          >
            Próximo →
          </Button>
        </div>

        <div className="flex flex-col gap-1 pt-4 border-t border-border sm:flex-row sm:justify-between sm:items-center">
          <p className="text-base font-semibold text-foreground">
            Total geral:{" "}
            <span className="text-primary">{formatCurrency(grandTotal)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Ponderado (referência): soma dos itens aceitos (mesma base do total geral).
          </p>
        </div>
      </section>

      {!isReadonlyForm && selectedRound?.status === "active" ? (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-4 px-4",
          )}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setShowSubmitWarning(false)
                setSubmitWarningCount(0)
                void saveProposal(false)
              }}
            >
              Salvar Rascunho
            </Button>
            <Button type="button" disabled={saving} onClick={handleSubmitClick}>
              Enviar Proposta
            </Button>
          </div>
          {showSubmitWarning ? (
            <div className="mx-auto mt-3 max-w-5xl">
              <Alert variant="destructive">
                <AlertTitle>Atenção antes de enviar</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    {submitWarningCount} item(s) preenchidos sem status definido. Clique em
                    &apos;Aceito&apos; ou &apos;Recusado&apos; em cada item antes de enviar, ou clique em
                    &apos;Enviar mesmo assim&apos; para desconsiderar esses itens.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowSubmitWarning(false)
                        setSubmitWarningCount(0)
                      }}
                    >
                      Revisar itens
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        void (async () => {
                          const ok = await saveProposal(true, true)
                          if (ok) {
                            setShowSubmitWarning(false)
                            setSubmitWarningCount(0)
                          }
                        })()
                      }}
                    >
                      Enviar mesmo assim
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
        </div>
      ) : null}

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio da proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Após o envio, a proposta ficará marcada como enviada. Você poderá editá-la novamente se
              necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  const ok = await saveProposal(true)
                  if (ok) setSubmitDialogOpen(false)
                })()
              }}
            >
              Confirmar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quotation && activeRound ? (
        <ImportProposalWizard
          open={importWizardOpen}
          onClose={() => setImportWizardOpen(false)}
          quotation={{
            id: quotation.id,
            code: quotation.code,
            company_id: quotation.company_id,
          }}
          activeRound={{
            id: activeRound.id,
            round_number: activeRound.round_number,
          }}
          quotationItems={quotationItems}
          currentItemRows={itemRows}
          paymentOptions={paymentOptions}
          currentPaymentCondition={paymentCondition}
          onImportComplete={(rows, paymentCode) => {
            setItemRows(rows)
            setPaymentCondition(paymentCode)
            toast.success("Proposta importada com sucesso. Revise e envie.")
            if (userId && quotation) {
              void logAudit({
                eventType: "proposal.imported",
                description: `Proposta importada via Excel — ${quotation.code}`,
                userId,
                companyId: quotation.company_id,
                entity: "quotation_proposals",
                entityId: proposalId ?? "new",
                metadata: { quotation_code: quotation.code },
              })
            }
          }}
        />
      ) : null}
    </div>
  )
}
