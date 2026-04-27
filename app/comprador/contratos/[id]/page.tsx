"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  differenceInDays,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { useTenant } from "@/contexts/tenant-context"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Upload,
  FileText,
  Download,
  AlertTriangle,
  ExternalLink,
  Search,
  Send,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { ContractImportExcelDialog } from "@/components/comprador/contract-import-excel-dialog"
import type {
  Contract,
  ContractAcceptance,
  ContractItem,
  ContractKind,
  ContractItemForm,
} from "@/types/contracts"
import { CONTRACT_KINDS, CONTRACT_STATUSES } from "@/types/contracts"

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return money.format(value)
}

function statusBadgeClass(status: Contract["status"]): string {
  switch (status) {
    case "draft":
      return "bg-muted text-muted-foreground"
    case "pending_acceptance":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "expired":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    case "cancelled":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

type FormState = {
  supplier_id: string
  code: string
  title: string
  contract_kind: ContractKind
  start_date: string
  end_date: string
  value: string
  notes: string
  payment_condition_id: string
  erp_code: string
}

function contractToForm(c: Contract): FormState {
  return {
    supplier_id: c.supplier_id,
    code: c.code,
    title: c.title,
    contract_kind: c.contract_kind,
    start_date: c.start_date.slice(0, 10),
    end_date: c.end_date.slice(0, 10),
    value:
      c.value != null
        ? new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(c.value)
        : "",
    notes: c.notes ?? "",
    payment_condition_id: c.payment_condition_id ?? "",
    erp_code: c.erp_code ?? "",
  }
}

function parseValueToNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const normalized = t.replace(/[^\d,]/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return Number.isNaN(n) ? null : n
}

function isExpiringSoon(c: Contract): boolean {
  if (c.status !== "active") return false
  if (!c.end_date) return false
  const end = parseISO(c.end_date)
  const today = startOfDay(new Date())
  const days = differenceInDays(end, today)
  return days >= 0 && days <= 30
}

function daysUntilEnd(c: Contract): number {
  if (!c.end_date) return 0
  return differenceInDays(parseISO(c.end_date), startOfDay(new Date()))
}

type EditContractItem = ContractItem & {
  _toEliminate?: boolean
  _eliminateReason?: string
  _isNew?: boolean
}

type CatalogItemRow = {
  id: string
  code: string
  short_description: string
  unit_of_measure: string
  target_price: number | null
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function cloneItemsForEdit(items: ContractItem[] | undefined): EditContractItem[] {
  return (items ?? []).map((i) => ({
    ...i,
    eliminated: i.eliminated ?? false,
    eliminated_at: i.eliminated_at ?? null,
    eliminated_reason: i.eliminated_reason ?? null,
  }))
}

function buildNewEditItem(
  contractId: string,
  companyId: string,
  row: CatalogItemRow,
): EditContractItem {
  const unit =
    row.target_price != null && Number.isFinite(Number(row.target_price))
      ? Number(row.target_price)
      : 0
  return {
    id: `temp-${crypto.randomUUID()}`,
    contract_id: contractId,
    company_id: companyId,
    material_code: row.code,
    material_description: row.short_description,
    unit_of_measure: row.unit_of_measure || null,
    quantity_contracted: 1,
    quantity_consumed: 0,
    unit_price: unit,
    total_price: unit,
    consumed_value: 0,
    delivery_days: null,
    notes: null,
    quotation_item_id: null,
    created_at: "",
    eliminated: false,
    eliminated_at: null,
    eliminated_reason: null,
    _isNew: true,
  }
}

function calcularStatus(
  start_date: string,
  end_date: string,
): Contract["status"] {
  if (!start_date || !end_date) return "draft"
  const hoje = startOfDay(new Date())
  const fim = parseISO(end_date)
  if (isBefore(fim, hoje)) return "expired"
  // Sempre começa como draft — só vai para active
  // após aceite do fornecedor
  return "draft"
}

export default function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading: userLoading, isSuperAdmin } = useUser()
  const { companyId } = useTenant()
  const { hasFeature, loading: permissionsLoading } = usePermissions()

  const [contract, setContract] = React.useState<Contract | null>(null)
  const [loadError, setLoadError] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [sendingForAcceptance, setSendingForAcceptance] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [acceptances, setAcceptances] = React.useState<ContractAcceptance[]>([])
  const editQueryHandled = React.useRef(false)
  const [paymentConditions, setPaymentConditions] = React.useState<
    Array<{ id: string; code: string; description: string }>
  >([])
  const [suppliers, setSuppliers] = React.useState<
    Array<{ id: string; name: string; code: string }>
  >([])
  const [editItems, setEditItems] = React.useState<EditContractItem[]>([])
  const [itemSearch, setItemSearch] = React.useState("")
  const debouncedItemSearch = useDebounce(itemSearch, 300)
  const [itemResults, setItemResults] = React.useState<CatalogItemRow[]>([])
  const [itemSearchLoading, setItemSearchLoading] = React.useState(false)
  const [importDialog, setImportDialog] = React.useState(false)

  const [confirmDialog, setConfirmDialog] = React.useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void | Promise<void>
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: async () => {},
  })

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canAccess = hasFeature("contracts") || isSuperAdmin

  function showConfirm(
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
  ) {
    setConfirmDialog({ open: true, title, description, onConfirm })
  }

  React.useEffect(() => {
    if (!userLoading && !permissionsLoading && !canAccess) {
      setLoading(false)
    }
  }, [userLoading, permissionsLoading, canAccess])

  React.useEffect(() => {
    if (userLoading || !companyId || !canAccess) return

    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("payment_conditions")
          .select("id, code, description")
          .eq("company_id", companyId)
          .eq("active", true)
          .order("code")
        if (cancelled || error) return
        setPaymentConditions(
          (data ?? []) as Array<{
            id: string
            code: string
            description: string
          }>,
        )
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, companyId, canAccess])

  React.useEffect(() => {
    if (!editing || !companyId || contract?.status !== "draft") return

    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, name, code")
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("name")
        if (cancelled || error) return
        setSuppliers((data ?? []) as Array<{ id: string; name: string; code: string }>)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editing, companyId, contract?.status])

  React.useEffect(() => {
    if (
      !editing ||
      !companyId ||
      contract?.status !== "draft" ||
      debouncedItemSearch.trim().length < 2
    ) {
      setItemResults([])
      setItemSearchLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setItemSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedItemSearch.trim()}%`
      try {
        const { data, error } = await supabase
          .from("items")
          .select("id, code, short_description, unit_of_measure, target_price")
          .eq("company_id", companyId)
          .eq("status", "active")
          .or(`code.ilike.${term},short_description.ilike.${term}`)
          .limit(10)
        if (cancelled || error) {
          setItemResults([])
          return
        }
        setItemResults(
          (data ?? []).map(
            (r: {
              id: string
              code: string
              short_description: string
              unit_of_measure: string | null
              target_price: number | null
            }) => ({
              id: r.id,
              code: r.code,
              short_description: r.short_description,
              unit_of_measure: r.unit_of_measure ?? "",
              target_price:
                r.target_price != null && !Number.isNaN(Number(r.target_price))
                  ? Number(r.target_price)
                  : null,
            }),
          ),
        )
      } finally {
        if (!cancelled) setItemSearchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editing, companyId, contract?.status, debouncedItemSearch])

  const loadContract = React.useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [contractRes, accRes] = await Promise.all([
        fetch(`/api/contracts/${id}`),
        fetch(`/api/contracts/${id}/acceptances`),
      ])
      const data = (await contractRes.json()) as {
        contract?: Contract
        error?: string
      }
      if (!contractRes.ok || !data.contract) {
        setLoadError(true)
        setContract(null)
        setForm(null)
        setAcceptances([])
        return
      }
      const c = data.contract
      setContract(c)
      setForm(contractToForm(c))
      if (accRes.ok) {
        const accData = (await accRes.json()) as {
          acceptances?: ContractAcceptance[]
        }
        setAcceptances(
          Array.isArray(accData.acceptances) ? accData.acceptances : [],
        )
      } else {
        setAcceptances([])
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    editQueryHandled.current = false
  }, [id])

  React.useEffect(() => {
    if (!contract) return
    if (searchParams.get("edit") !== "true") {
      editQueryHandled.current = false
      return
    }
    if (editQueryHandled.current) return
    editQueryHandled.current = true
    setForm(contractToForm(contract))
    setEditItems(cloneItemsForEdit(contract.items))
    setItemSearch("")
    setItemResults([])
    setEditing(true)
  }, [contract, searchParams])

  React.useEffect(() => {
    if (userLoading || permissionsLoading || !canAccess || !companyId) return
    void loadContract()
  }, [userLoading, permissionsLoading, canAccess, companyId, loadContract])

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function handleSendForAcceptance() {
    showConfirm(
      "Enviar para Aceite",
      "O contrato será enviado ao fornecedor para aceite. Deseja continuar?",
      async () => {
        setSendingForAcceptance(true)
        try {
          const res = await fetch(`/api/contracts/${id}/send-for-acceptance`, {
            method: "POST",
          })
          const data = (await res.json()) as {
            success?: boolean
            error?: string
          }
          if (!res.ok || !data.success) {
            toast.error(data.error ?? "Não foi possível enviar para aceite.")
            return
          }
          toast.success("Contrato enviado para aceite!")
          await loadContract()
        } finally {
          setSendingForAcceptance(false)
        }
      },
    )
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/contracts/${id}/upload`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as { file_url?: string; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Falha no upload.")
        return
      }
      if (data.file_url) {
        setContract((c) => (c ? { ...c, file_url: data.file_url! } : null))
        toast.success("Arquivo enviado com sucesso.")
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveEdit(mode: "save" | "send" = "save") {
    if (!form || !companyId || !contract) return
    const isRestricted = contract.status !== "draft"
    const {
      supplier_id,
      code,
      title,
      contract_kind,
      start_date,
      end_date,
      value,
      notes,
      payment_condition_id,
      erp_code,
    } = form

    if (mode === "send") {
      if (!supplier_id) {
        toast.error("Selecione o fornecedor.")
        return
      }
      if (!code.trim()) {
        toast.error("Informe o código do contrato.")
        return
      }
      if (!title.trim()) {
        toast.error("Informe o título do contrato.")
        return
      }
      if (!start_date || !end_date) {
        toast.error("Informe as datas de vigência.")
        return
      }
      if (!payment_condition_id) {
        toast.error("Selecione uma condição de pagamento")
        return
      }
    }

    let valueNum: number | null = null
    if (!isRestricted && contract_kind === "por_valor") {
      if (value.trim()) {
        valueNum = parseValueToNumber(value)
        if (valueNum === null) {
          toast.error("Valor inválido.")
          return
        }
      }
    }

    const newRows = isRestricted
      ? []
      : editItems.filter((i) => i._isNew)
    for (const row of newRows) {
      if (!row.material_code.trim() || !row.material_description.trim()) {
        toast.error("Preencha código e descrição em todos os itens novos.")
        return
      }
      if (
        !Number.isFinite(row.quantity_contracted) ||
        row.quantity_contracted <= 0
      ) {
        toast.error("Quantidade inválida em um dos itens novos.")
        return
      }
      if (!Number.isFinite(row.unit_price) || row.unit_price < 0) {
        toast.error("Preço unitário inválido em um dos itens novos.")
        return
      }
    }

    const executeSaveEdit = async () => {
    let restrictedPatchStatus: Contract["status"]
    if (!isRestricted) {
      restrictedPatchStatus = calcularStatus(start_date, end_date)
    } else if (
      contract.status === "pending_acceptance" ||
      contract.status === "active"
    ) {
      restrictedPatchStatus = "draft"
    } else {
      restrictedPatchStatus = calcularStatus(start_date, end_date)
    }

    setSaving(true)
    try {
      const patchBody = isRestricted
        ? {
            start_date,
            end_date,
            status: restrictedPatchStatus,
            notes: notes.trim() || null,
            payment_condition_id: payment_condition_id || null,
          }
        : {
            supplier_id: supplier_id || null,
            code: code.trim(),
            title: title.trim(),
            contract_kind,
            status: restrictedPatchStatus,
            start_date,
            end_date,
            value: contract_kind === "por_valor" ? valueNum : null,
            notes: notes.trim() || null,
            payment_condition_id: payment_condition_id || null,
            erp_code: erp_code.trim() || null,
          }

      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      })
      const data = (await res.json()) as { contract?: Contract; error?: string }
      if (!res.ok || !data.contract) {
        toast.error(data.error ?? "Não foi possível salvar.")
        return
      }

      for (const item of editItems) {
        if (!item._toEliminate || item._isNew || item.id.startsWith("temp-")) {
          continue
        }
        const elimRes = await fetch(
          `/api/contract-items?id=${encodeURIComponent(item.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eliminated: true,
              eliminated_reason: item._eliminateReason?.trim() ?? "",
            }),
          },
        )
        if (!elimRes.ok) {
          const err = (await elimRes.json()) as { error?: string }
          toast.error(err.error ?? "Não foi possível eliminar um dos itens.")
          return
        }
      }

      if (newRows.length > 0) {
        const itemsPayload = newRows.map((i) => ({
          material_code: i.material_code.trim(),
          material_description: i.material_description.trim(),
          unit_of_measure: i.unit_of_measure?.trim() || undefined,
          quantity_contracted: i.quantity_contracted,
          unit_price: i.unit_price,
          delivery_days:
            i.delivery_days != null && !Number.isNaN(Number(i.delivery_days))
              ? Number(i.delivery_days)
              : null,
          notes: i.notes?.trim() || undefined,
        }))
        const postRes = await fetch("/api/contract-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contract_id: id, items: itemsPayload }),
        })
        const postData = (await postRes.json()) as { error?: string }
        if (!postRes.ok) {
          toast.error(postData.error ?? "Não foi possível salvar itens novos.")
          return
        }
      }

      if (!isRestricted) {
        const supabase = createClient()
        for (const item of editItems) {
          if (
            item._isNew ||
            item._toEliminate ||
            item.eliminated ||
            item.id.startsWith("temp-")
          ) {
            continue
          }
          const orig = contract.items?.find((o) => o.id === item.id)
          if (!orig) continue
          const newQty =
            item.quantity_contracted != null &&
            !Number.isNaN(Number(item.quantity_contracted))
              ? Number(item.quantity_contracted)
              : null
          const oldQty =
            orig.quantity_contracted != null &&
            !Number.isNaN(Number(orig.quantity_contracted))
              ? Number(orig.quantity_contracted)
              : null
          const newPrice =
            item.unit_price != null && !Number.isNaN(Number(item.unit_price))
              ? Number(item.unit_price)
              : null
          const oldPrice =
            orig.unit_price != null && !Number.isNaN(Number(orig.unit_price))
              ? Number(orig.unit_price)
              : null
          const newDd =
            item.delivery_days != null &&
            !Number.isNaN(Number(item.delivery_days))
              ? Number(item.delivery_days)
              : null
          const oldDd =
            orig.delivery_days != null &&
            !Number.isNaN(Number(orig.delivery_days))
              ? Number(orig.delivery_days)
              : null
          if (newQty === oldQty && newPrice === oldPrice && newDd === oldDd) continue
          if (newQty == null || newQty <= 0) {
            toast.error("Quantidade inválida em um dos itens.")
            return
          }
          if (newPrice == null || newPrice < 0) {
            toast.error("Preço unitário inválido em um dos itens.")
            return
          }
          if (newDd != null && newDd < 0) {
            toast.error("Prazo (dias) inválido em um dos itens.")
            return
          }
          const { error: itemErr } = await supabase
            .from("contract_items")
            .update({
              quantity_contracted: newQty,
              unit_price: newPrice,
              delivery_days: newDd,
            })
            .eq("id", item.id)
            .eq("company_id", companyId)
          if (itemErr) {
            toast.error(
              itemErr.message ??
                "Não foi possível atualizar prazos dos itens.",
            )
            return
          }
        }
      }

      if (!isRestricted && mode === "save") {
        await loadContract()
        toast.success("Rascunho salvo!")
        return
      }

      if (!isRestricted && mode === "send") {
        const sendRes = await fetch(`/api/contracts/${id}/send-for-acceptance`, {
          method: "POST",
        })
        const sendData = (await sendRes.json()) as { success?: boolean; error?: string }
        if (!sendRes.ok || !sendData.success) {
          toast.error(sendData.error ?? "Não foi possível enviar para aceite.")
          return
        }
        toast.success("Contrato enviado para aceite!")
        setEditing(false)
        setEditItems([])
        setItemSearch("")
        setItemResults([])
        if (searchParams.get("edit") === "true") {
          router.replace(`/comprador/contratos/${id}`)
        }
        await loadContract()
        return
      }

      await loadContract()
      setEditing(false)
      setEditItems([])
      setItemSearch("")
      setItemResults([])
      if (searchParams.get("edit") === "true") {
        router.replace(`/comprador/contratos/${id}`)
      }
      toast.success("Contrato atualizado.")
    } finally {
      setSaving(false)
    }
    }

    if (isRestricted && contract.status === "active") {
      showConfirm(
        "Atenção",
        "Atenção: ao salvar alterações em um contrato ativo, " +
          "o status voltará a rascunho até você enviar novamente para aceite. " +
          "Deseja continuar?",
        executeSaveEdit,
      )
      return
    }
    if (isRestricted && contract.status === "pending_acceptance") {
      showConfirm(
        "Salvar alterações",
        "Ao salvar, o contrato voltará a rascunho. " +
          'Será necessário clicar em "Enviar para Aceite" novamente. ' +
          "Deseja continuar?",
        executeSaveEdit,
      )
      return
    }
    await executeSaveEdit()
  }

  function handleCancelEdit() {
    if (contract) setForm(contractToForm(contract))
    setEditItems([])
    setItemSearch("")
    setItemResults([])
    setEditing(false)
    if (searchParams.get("edit") === "true") {
      router.replace(`/comprador/contratos/${id}`)
    }
  }

  function beginEdit() {
    if (!contract) return
    setForm(contractToForm(contract))
    setEditItems(cloneItemsForEdit(contract.items))
    setItemSearch("")
    setItemResults([])
    setEditing(true)
  }

  function markForElimination(item: EditContractItem) {
    setEditItems((prev) =>
      prev.map((x) =>
        x.id === item.id
          ? {
              ...x,
              _toEliminate: true,
              _eliminateReason: x._eliminateReason ?? "",
            }
          : x,
      ),
    )
  }

  function handleCancelar() {
    if (!contract) return
    showConfirm(
      "Cancelar Contrato",
      "Esta ação não pode ser desfeita. O contrato será marcado como cancelado.",
      async () => {
        setSaving(true)
        try {
          const res = await fetch(`/api/contracts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          })
          const data = (await res.json()) as {
            contract?: Contract
            error?: string
          }
          if (!res.ok || !data.contract) {
            toast.error(data.error ?? "Não foi possível cancelar o contrato.")
            return
          }
          setContract(data.contract)
          setForm(contractToForm(data.contract))
          toast.success("Contrato cancelado")
        } finally {
          setSaving(false)
        }
      },
    )
  }

  if (!userLoading && !permissionsLoading && !canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O módulo de contratos não está habilitado para a sua empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading && !contract) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <FileText className="h-5 w-5 animate-pulse" />
        <span className="text-sm">Carregando…</span>
      </div>
    )
  }

  if (loadError || !contract || !form) {
    return (
      <div className="p-6 space-y-4 w-full">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/comprador/contratos")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const expiring = isExpiringSoon(contract)
  const daysLeft = daysUntilEnd(contract)
  const isRestricted = contract.status !== "draft"

  return (
    <div className="p-6 space-y-6 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />

      {!isRestricted && editing ? (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                router.replace(`/comprador/contratos/${id}`)
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold">Editar Contrato</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={() => void handleSaveEdit("save")} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button onClick={() => void handleSaveEdit("send")} disabled={saving}>
              {saving ? "Salvando..." : "Salvar e Enviar para Aceite"}
            </Button>
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/comprador/contratos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {!editing ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {contract.code}
                  </Badge>
                  <Badge className={statusBadgeClass(contract.status)}>
                    {CONTRACT_STATUSES.find((s) => s.value === contract.status)
                      ?.label ?? contract.status}
                  </Badge>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight mt-1">
                  {contract.title}
                </h1>
              </>
            ) : (
              <h1 className="text-2xl font-semibold tracking-tight">Editar contrato</h1>
            )}
          </div>
        </div>
        {!editing ? (
          <div className="flex items-center gap-2 flex-wrap">
            {contract.status === "draft" ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSendForAcceptance()}
                disabled={sendingForAcceptance}
                className="gap-1.5"
              >
                <Send className="h-4 w-4" />
                {sendingForAcceptance ? "Enviando..." : "Enviar para Aceite"}
              </Button>
            ) : null}
            {contract.status !== "cancelled" && contract.status !== "expired" ? (
              <Button type="button" variant="outline" size="sm" onClick={beginEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : null}
            {contract.status !== "cancelled" && contract.status !== "expired" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => void handleCancelar()}
                disabled={saving}
              >
                Cancelar Contrato
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        )}
      </div>
      )}

      {expiring && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          role="status"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>
            Atenção: este contrato vence em{" "}
            <strong>{daysLeft}</strong>{" "}
            {daysLeft === 1 ? "dia" : "dias"}.
          </p>
        </div>
      )}

      {!editing ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Fornecedor</p>
                  <p className="text-sm font-medium">
                    {contract.supplier_name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({contract.supplier_code})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de Contrato</p>
                  <p className="text-sm font-medium">
                    {CONTRACT_KINDS.find((k) => k.value === contract.contract_kind)
                      ?.label ?? contract.contract_kind}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vigência</p>
                  <p className="text-sm font-medium">
                    {contract.start_date
                      ? format(parseISO(contract.start_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}{" "}
                    –{" "}
                    {contract.end_date
                      ? format(parseISO(contract.end_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="text-sm font-medium">
                    {contract.value != null ? money.format(contract.value) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Condição de Pagamento</p>
                  <p className="text-sm font-medium">
                    {contract.payment_condition_code
                      ? `${contract.payment_condition_code} — ${contract.payment_condition_description ?? ""}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Código ERP{" "}
                    <span className="text-muted-foreground">(integração ERP)</span>
                  </p>
                  <p className="text-sm font-medium">
                    {contract.erp_code?.trim() ? contract.erp_code : "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {contract.notes?.trim() ? contract.notes : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {contract.items && contract.items.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-semibold">{formatBRL(contract.total_value)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950/30">
                  <p className="text-xs text-muted-foreground">Consumido</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-300">
                    {formatBRL(contract.consumed_value)}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-950/30">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="font-semibold text-green-700 dark:text-green-300">
                    {formatBRL(
                      (contract.total_value ?? 0) - contract.consumed_value,
                    )}
                  </p>
                </div>
              </div>

              <div className="w-full rounded-lg border border-border overflow-hidden">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="whitespace-nowrap">UN</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Qtd Cont.
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Qtd Cons.
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Preço Unit.
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Prazo
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Total
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Saldo
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contract.items.map((item: ContractItem) => {
                      const lineBalance = item.total_price - item.consumed_value
                      return (
                        <TableRow key={item.id}>
                          <TableCell
                            className={`font-mono text-xs ${
                              item.eliminated ? "line-through opacity-50" : ""
                            }`}
                          >
                            {item.material_code}
                          </TableCell>
                          <TableCell
                            className={`max-w-[200px] ${
                              item.eliminated ? "line-through opacity-50" : ""
                            }`}
                          >
                            {item.material_description}
                          </TableCell>
                          <TableCell>{item.unit_of_measure ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.quantity_contracted}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.quantity_consumed}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {money.format(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {item.delivery_days != null ? item.delivery_days : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {money.format(item.total_price)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums whitespace-nowrap font-medium ${
                              lineBalance > 0
                                ? "text-green-700 dark:text-green-400"
                                : "text-destructive"
                            }`}
                          >
                            {money.format(lineBalance)}
                          </TableCell>
                          <TableCell>
                            {item.eliminated ? (
                              <Badge
                                variant="outline"
                                className="text-destructive border-destructive text-xs"
                              >
                                Eliminado
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {contract.contract_terms?.trim() ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Termos Contratuais</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contract.contract_terms}
              </p>
              <a
                href={`/contratos/${contract.id}/termos`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver página pública dos termos
              </a>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.file_url ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={contract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Visualizar PDF
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openFilePicker}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Enviando…" : "Substituir"}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando…" : "Fazer Upload do PDF"}
                </Button>
              )}
            </CardContent>
          </Card>

          {acceptances.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Histórico de Aceites</h3>
              <div className="space-y-2">
                {acceptances.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 text-sm border rounded-md px-3 py-2"
                  >
                    {a.action === "accepted" ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">
                        {a.action === "accepted" ? "Aceito" : "Recusado"}
                      </span>
                      {a.notes ? (
                        <span className="text-muted-foreground ml-2">
                          — {a.notes}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {format(parseISO(a.created_at), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isRestricted ? (
              <div
                className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mb-4 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                role="status"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Contrato ativo — apenas condição de pagamento, vigência,
                observações e eliminação de itens podem ser alterados.
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <div className="space-y-1.5">
                <Label>Código Interno</Label>
                <Input
                  readOnly
                  className="w-44 bg-muted font-mono"
                  value={contract?.code ?? "—"}
                  placeholder="Gerado automaticamente"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Código ERP</Label>
                <Input
                  readOnly
                  className="w-44 bg-muted"
                  value={contract?.erp_code ?? "—"}
                />
                <p className="text-xs text-muted-foreground">
                  Preenchido automaticamente pela integração
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  readOnly={isRestricted}
                  maxLength={100}
                  className={
                    isRestricted
                      ? "h-10 w-[100ch] max-w-full border border-border bg-muted text-sm text-foreground"
                      : "h-10 w-[100ch] max-w-full"
                  }
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, title: e.target.value } : f))
                  }
                />
                <p className="text-xs text-muted-foreground text-right">
                  {form.title.length}/100
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                {!isRestricted ? (
                  <Select
                    value={form.supplier_id}
                    onValueChange={(v) =>
                      setForm((prev) => (prev ? { ...prev, supplier_id: v } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted text-sm text-foreground">
                    <span className="truncate">
                      {contract.supplier_name}{" "}
                      <span className="text-muted-foreground">({contract.supplier_code})</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Contrato</Label>
                {!isRestricted ? (
                  <div className="w-fit">
                    <Select
                      value={form.contract_kind}
                      onValueChange={(v) =>
                        setForm((f) =>
                          f ? { ...f, contract_kind: v as ContractKind } : f,
                        )
                      }
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted text-sm text-foreground">
                    {CONTRACT_KINDS.find((k) => k.value === form.contract_kind)
                      ?.label ?? form.contract_kind}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {form.contract_kind === "por_valor" ? (
                  <>
                    <Label>Valor Total</Label>
                    <Input
                      type="text"
                      readOnly={isRestricted}
                      placeholder="R$ 0,00"
                      className={
                        isRestricted
                          ? "w-44 h-10 border border-border bg-muted text-sm text-foreground"
                          : "w-44"
                      }
                      value={form.value}
                      onChange={(e) =>
                        setForm((f) => (f ? { ...f, value: e.target.value } : f))
                      }
                    />
                  </>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>Condição de Pagamento <span className="text-destructive">*</span></Label>
                <div className="w-fit">
                  <Select
                    value={form.payment_condition_id || undefined}
                    onValueChange={(v) =>
                      setForm((f) =>
                        f ? { ...f, payment_condition_id: v } : f,
                      )
                    }
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentConditions.map((pc) => (
                        <SelectItem key={pc.id} value={pc.id}>
                          {pc.code} — {pc.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Vigência <span className="text-destructive">*</span></Label>
                <div className="flex gap-3 items-center">
                  <Input
                    type="date"
                    className="w-40"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, start_date: e.target.value } : f))
                    }
                  />
                  <span className="text-sm text-muted-foreground">até</span>
                  <Input
                    type="date"
                    className="w-40"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, end_date: e.target.value } : f))
                    }
                  />
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  maxLength={500}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, notes: e.target.value } : f))
                  }
                />
                <p className="text-xs text-muted-foreground text-right max-w-2xl">
                  {(form.notes ?? "").length}/500
                </p>
              </div>
            </div>

            <div className="space-y-3 w-full">
              {!isRestricted ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold">Itens do contrato</h3>
                      <p className="text-xs text-muted-foreground">
                        Busque no catálogo para adicionar linhas. Itens eliminados
                        permanecem visíveis para histórico.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportDialog(true)}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Importar Excel
                    </Button>
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar item no catálogo (código ou descrição)…"
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    {itemSearch.trim().length >= 2 && (
                      <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                        {itemSearchLoading ? (
                          <li className="px-3 py-2 text-sm text-muted-foreground">
                            Buscando…
                          </li>
                        ) : itemResults.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-muted-foreground">
                            Nenhum item encontrado
                          </li>
                        ) : (
                          itemResults.map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => {
                                  setEditItems((prev) => [
                                    ...prev,
                                    buildNewEditItem(
                                      contract.id,
                                      companyId!,
                                      row,
                                    ),
                                  ])
                                  setItemSearch("")
                                  setItemResults([])
                                }}
                              >
                                <span className="font-medium">{row.code}</span>{" "}
                                <span className="text-muted-foreground">
                                  {row.short_description}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Itens eliminados permanecem visíveis para histórico. Novos itens
                  não podem ser adicionados neste status.
                </p>
              )}

              <div className="w-full rounded-md border border-border overflow-hidden">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="whitespace-nowrap">UN</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Qtd contratada
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Preço unit.
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Prazo (dias)
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Ação
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          {isRestricted
                            ? "Nenhum item."
                            : "Nenhum item. Use a busca acima para adicionar do catálogo."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      editItems.map((item) => {
                        const rowTone = item.eliminated
                          ? "opacity-50"
                          : item._toEliminate
                            ? "bg-red-50 dark:bg-red-950/25"
                            : ""
                        const strike =
                          item.eliminated && !item._toEliminate
                            ? "line-through opacity-60"
                            : ""
                        const canEditLine =
                          !isRestricted &&
                          !item.eliminated &&
                          !item._toEliminate
                        const canEditNew = canEditLine && Boolean(item._isNew)

                        return (
                          <TableRow key={item.id} className={rowTone}>
                            <TableCell className={`font-mono text-xs ${strike}`}>
                              {canEditNew ? (
                                <Input
                                  className="h-7 text-xs"
                                  value={item.material_code}
                                  onChange={(e) =>
                                    setEditItems((prev) =>
                                      prev.map((x) =>
                                        x.id === item.id
                                          ? {
                                              ...x,
                                              material_code: e.target.value,
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              ) : (
                                item.material_code
                              )}
                            </TableCell>
                            <TableCell
                              className={`max-w-[200px] text-sm ${strike}`}
                            >
                              {canEditNew ? (
                                <Input
                                  className="h-7 text-xs"
                                  value={item.material_description}
                                  onChange={(e) =>
                                    setEditItems((prev) =>
                                      prev.map((x) =>
                                        x.id === item.id
                                          ? {
                                              ...x,
                                              material_description:
                                                e.target.value,
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              ) : (
                                <span className="line-clamp-2">
                                  {item.material_description}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs px-2">
                                {item.unit_of_measure || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {canEditLine ? (
                                <Input
                                  className="h-7 w-20 text-xs text-right"
                                  type="number"
                                  min={0.0001}
                                  step="any"
                                  value={item.quantity_contracted}
                                  onChange={(e) => {
                                    const n = parseFloat(e.target.value)
                                    setEditItems((prev) =>
                                      prev.map((x) =>
                                        x.id === item.id
                                          ? {
                                              ...x,
                                              quantity_contracted:
                                                Number.isFinite(n) && n > 0
                                                  ? n
                                                  : x.quantity_contracted,
                                            }
                                          : x,
                                      ),
                                    )
                                  }}
                                />
                              ) : (
                                <span className="tabular-nums">
                                  {item.quantity_contracted}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {canEditLine ? (
                                <Input
                                  className="h-7 w-24 text-xs text-right"
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={item.unit_price}
                                  onChange={(e) => {
                                    const n = parseFloat(e.target.value)
                                    setEditItems((prev) =>
                                      prev.map((x) =>
                                        x.id === item.id
                                          ? {
                                              ...x,
                                              unit_price:
                                                Number.isFinite(n) && n >= 0
                                                  ? n
                                                  : x.unit_price,
                                            }
                                          : x,
                                      ),
                                    )
                                  }}
                                />
                              ) : (
                                <span className="tabular-nums whitespace-nowrap">
                                  {money.format(item.unit_price)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {canEditLine ? (
                                <Input
                                  className="h-7 w-20 text-xs text-right"
                                  type="number"
                                  min={0}
                                  value={
                                    item.delivery_days == null
                                      ? ""
                                      : item.delivery_days
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value
                                    const n =
                                      v === ""
                                        ? null
                                        : parseInt(v, 10)
                                    setEditItems((prev) =>
                                      prev.map((x) =>
                                        x.id === item.id
                                          ? {
                                              ...x,
                                              delivery_days:
                                                v === ""
                                                  ? null
                                                  : Number.isNaN(n)
                                                    ? x.delivery_days
                                                    : n,
                                            }
                                          : x,
                                      ),
                                    )
                                  }}
                                />
                              ) : (
                                <span className="tabular-nums text-muted-foreground">
                                  {item.delivery_days ?? "—"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.eliminated && !item._toEliminate ? (
                                <Badge
                                  variant="outline"
                                  className="text-destructive border-destructive text-xs"
                                >
                                  Eliminado
                                </Badge>
                              ) : item._toEliminate ? (
                                <Badge
                                  variant="outline"
                                  className="text-amber-800 border-amber-600 text-xs dark:text-amber-200"
                                >
                                  A eliminar
                                </Badge>
                              ) : item._isNew ? (
                                <Badge variant="secondary" className="text-xs">
                                  Novo
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                {item.eliminated && !item._toEliminate ? null : item._toEliminate ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        setEditItems((prev) =>
                                          prev.map((x) =>
                                            x.id === item.id
                                              ? {
                                                  ...x,
                                                  _toEliminate: false,
                                                  _eliminateReason: undefined,
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    >
                                      Desfazer
                                    </Button>
                                    <Input
                                      className="h-7 text-xs w-40"
                                      placeholder="Motivo (opcional)"
                                      value={item._eliminateReason ?? ""}
                                      onChange={(e) =>
                                        setEditItems((prev) =>
                                          prev.map((x) =>
                                            x.id === item.id
                                              ? {
                                                  ...x,
                                                  _eliminateReason:
                                                    e.target.value,
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                  </>
                                ) : item._isNew ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive"
                                    onClick={() =>
                                      setEditItems((prev) =>
                                        prev.filter((x) => x.id !== item.id),
                                      )
                                    }
                                  >
                                    Remover
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive border-destructive hover:bg-destructive/10"
                                    onClick={() => markForElimination(item)}
                                  >
                                    Eliminar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Documento (PDF)</p>
              {contract.file_url ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={contract.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Visualizar PDF
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openFilePicker}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Substituir
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openFilePicker}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar PDF
                </Button>
              )}
            </div>

            {!isRestricted ? (
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleSaveEdit("save")} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button type="button" onClick={() => void handleSaveEdit("send")} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar e Enviar para Aceite"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <ContractImportExcelDialog
        open={importDialog}
        onClose={() => setImportDialog(false)}
        companyId={companyId ?? ""}
        onImport={(items: ContractItemForm[]) => {
          setEditItems((prev) => [
            ...prev,
            ...items.map((item) => ({
              id: `temp-${crypto.randomUUID()}`,
              contract_id: id,
              company_id: companyId ?? "",
              material_code: item.material_code,
              material_description: item.material_description,
              unit_of_measure: item.unit_of_measure || null,
              quantity_contracted: Number(item.quantity_contracted || 0),
              quantity_consumed: 0,
              unit_price: Number(item.unit_price || 0),
              total_price:
                Number(item.quantity_contracted || 0) * Number(item.unit_price || 0),
              consumed_value: 0,
              delivery_days: item.delivery_days ? Number(item.delivery_days) : null,
              notes: item.notes || null,
              quotation_item_id: null,
              created_at: "",
              eliminated: false,
              eliminated_at: null,
              eliminated_reason: null,
              _isNew: true,
            })),
          ])
        }}
      />

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(e) => {
                e.preventDefault()
                const fn = confirmDialog.onConfirm
                setConfirmDialog((prev) => ({ ...prev, open: false }))
                void Promise.resolve(fn())
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
