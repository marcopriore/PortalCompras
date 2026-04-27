"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { isBefore, parseISO, startOfDay } from "date-fns"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { useTenant } from "@/contexts/tenant-context"
import { ContractImportExcelDialog } from "@/components/comprador/contract-import-excel-dialog"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  ArrowLeft,
  FileText,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import {
  CONTRACT_KINDS,
  type Contract,
  type ContractKind,
  type ContractItemForm,
  type ContractStatus,
} from "@/types/contracts"

type FormState = {
  supplier_id: string
  quotation_id: string
  title: string
  contract_kind: ContractKind
  start_date: string
  end_date: string
  value: string
  notes: string
  payment_condition_id: string
  erp_code: string
}

type CatalogItemRow = {
  id: string
  code: string
  short_description: string
  unit_of_measure: string
  target_price: number | null
}

const formatBRL = (v: number | null | undefined) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(v)
    : "—"

const emptyForm = (): FormState => ({
  supplier_id: "",
  quotation_id: "",
  title: "",
  contract_kind: "por_valor",
  start_date: "",
  end_date: "",
  value: "",
  notes: "",
  payment_condition_id: "",
  erp_code: "",
})

function parseValueToNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const normalized = t.replace(/[^\d,]/g, "").replace(",", ".")
  const n = parseFloat(normalized)
  return Number.isNaN(n) ? null : n
}

function parsePrice(value: string | number): number {
  if (typeof value === "number") return value
  const cleaned = value.replace(/[^\d.,]/g, "")
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0
  }
  return parseFloat(cleaned) || 0
}

function parseQty(value: string | number): number {
  if (typeof value === "number") return value
  return parseFloat(String(value).replace(",", ".")) || 0
}

function calcularStatus(
  start_date: string,
  end_date: string,
): ContractStatus {
  if (!start_date || !end_date) return "draft"
  const hoje = startOfDay(new Date())
  const fim = parseISO(end_date)
  if (isBefore(fim, hoje)) return "expired"
  // Sempre começa como draft — só vai para active
  // após aceite do fornecedor
  return "draft"
}

function normalizePrefillItems(
  items: Partial<ContractItemForm>[] | undefined,
): ContractItemForm[] {
  if (!Array.isArray(items)) return []
  return items.map((i) => ({
    material_code: i.material_code ?? "",
    material_description: i.material_description ?? "",
    unit_of_measure: i.unit_of_measure ?? "",
    quantity_contracted: i.quantity_contracted ?? "",
    unit_price: i.unit_price ?? "",
    delivery_days: i.delivery_days ?? "",
    notes: i.notes ?? "",
    item_id: i.item_id,
    _fromQuotation: true,
  }))
}

function buildContractItemsPayload(rows: ContractItemForm[]): {
  items: Array<{
    material_code: string
    material_description: string
    unit_of_measure: string | null
    quantity_contracted: number
    unit_price: number
    delivery_days: number | null
    notes: string | null
  }>
  error?: string
} {
  const items: Array<{
    material_code: string
    material_description: string
    unit_of_measure: string | null
    quantity_contracted: number
    unit_price: number
    delivery_days: number | null
    notes: string | null
  }> = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const code = r.material_code.trim()
    const desc = r.material_description.trim()
    const qtyStr =
      typeof r.quantity_contracted === "number"
        ? String(r.quantity_contracted)
        : (r.quantity_contracted ?? "").trim()
    const priceStr =
      typeof r.unit_price === "number"
        ? String(r.unit_price)
        : (r.unit_price ?? "").trim()
    const hasAny =
      code ||
      desc ||
      qtyStr ||
      priceStr ||
      r.unit_of_measure.trim() ||
      r.delivery_days.trim() ||
      r.notes.trim()
    if (!hasAny) continue

    if (!code || !desc) {
      return {
        items: [],
        error: `Item ${i + 1}: informe código e descrição do material.`,
      }
    }

    const qty = parseQty(r.quantity_contracted)
    const price = parsePrice(r.unit_price)

    if (Number.isNaN(qty) || qty <= 0) {
      return {
        items: [],
        error: `Item ${i + 1}: quantidade contratada inválida.`,
      }
    }
    if (Number.isNaN(price) || price < 0) {
      return {
        items: [],
        error: `Item ${i + 1}: preço unitário inválido.`,
      }
    }

    const ddRaw = r.delivery_days.trim()
    let delivery_days: number | null = null
    if (ddRaw) {
      const n = parseInt(ddRaw, 10)
      delivery_days = Number.isNaN(n) ? null : n
    }

    items.push({
      material_code: code,
      material_description: desc,
      unit_of_measure: r.unit_of_measure.trim() || null,
      quantity_contracted: qty,
      unit_price: price,
      delivery_days,
      notes: r.notes.trim() || null,
    })
  }

  return { items }
}

export default function NovoContratoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromCotacao = searchParams.get("from") === "cotacao"

  const { loading: userLoading, isSuperAdmin } = useUser()
  const { companyId } = useTenant()
  const { hasFeature, loading: permissionsLoading } = usePermissions()

  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [suppliers, setSuppliers] = React.useState<
    Array<{ id: string; name: string; code: string }>
  >([])
  const [paymentConditions, setPaymentConditions] = React.useState<
    Array<{ id: string; code: string; description: string }>
  >([])
  const [contractItems, setContractItems] = React.useState<ContractItemForm[]>(
    [],
  )
  const [itemSearch, setItemSearch] = React.useState("")
  const [debouncedItemSearch, setDebouncedItemSearch] = React.useState("")
  const [itemSearchResults, setItemSearchResults] = React.useState<
    CatalogItemRow[]
  >([])
  const [itemSearchLoading, setItemSearchLoading] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [savedContractId, setRascunhoId] = React.useState<string | null>(null)
  const [savedDraftMeta, setSavedDraftMeta] = React.useState<{
    code: string | null
    erp_code: string | null
  } | null>(null)

  const [importDialog, setImportDialog] = React.useState(false)
  const prefillConsumedRef = React.useRef(false)

  const canAccess = hasFeature("contracts") || isSuperAdmin

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedItemSearch(itemSearch), 300)
    return () => window.clearTimeout(id)
  }, [itemSearch])

  React.useEffect(() => {
    if (userLoading || !companyId || !canAccess) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, name, code")
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("name")
        if (error || cancelled) return
        setSuppliers(
          (data ?? []) as Array<{ id: string; name: string; code: string }>,
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, companyId, canAccess])

  const [paymentConditionsLoaded, setPaymentConditionsLoaded] =
    React.useState(false)

  React.useEffect(() => {
    if (userLoading || !companyId || !canAccess) return

    setPaymentConditionsLoaded(false)
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
      } finally {
        if (!cancelled) setPaymentConditionsLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userLoading, companyId, canAccess])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (userLoading || permissionsLoading || !companyId || !canAccess) return
    if (loading || !paymentConditionsLoaded) return
    if (prefillConsumedRef.current) return

    const prefillRaw = sessionStorage.getItem("valore:novo-contrato-prefill")
    if (!prefillRaw) return

    prefillConsumedRef.current = true
    try {
      const prefill = JSON.parse(prefillRaw) as {
        quotation_id?: string
        quotation_code?: string
        supplier_id?: string
        supplier_name?: string
        category?: string
        payment_condition_id?: string | null
        items?: Partial<ContractItemForm>[]
        multi_supplier?: boolean
      }
      sessionStorage.removeItem("valore:novo-contrato-prefill")

      setForm((prev) => ({
        ...prev,
        supplier_id: prefill.supplier_id ?? prev.supplier_id,
        quotation_id: prefill.quotation_id ?? prev.quotation_id,
        payment_condition_id:
          prefill.payment_condition_id ?? prev.payment_condition_id,
        title: prefill.quotation_code
          ? `Contrato ${prefill.quotation_code}`
          : prev.title,
      }))

      if (Array.isArray(prefill.items) && prefill.items.length > 0) {
        setContractItems(normalizePrefillItems(prefill.items))
      }

      if (prefill.multi_supplier) {
        toast.warning(
          "A cotação tinha itens de múltiplos fornecedores. " +
            "Apenas o fornecedor com mais itens foi pré-selecionado.",
        )
      }
    } catch {
      sessionStorage.removeItem("valore:novo-contrato-prefill")
      prefillConsumedRef.current = false
    }
  }, [
    userLoading,
    permissionsLoading,
    companyId,
    canAccess,
    loading,
    paymentConditionsLoaded,
  ])

  React.useEffect(() => {
    if (userLoading || !companyId || !canAccess) return

    const q = debouncedItemSearch.trim()
    if (q.length < 2) {
      setItemSearchResults([])
      setItemSearchLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setItemSearchLoading(true)
      try {
        const supabase = createClient()
        const term = `%${q}%`
        const { data, error } = await supabase
          .from("items")
          .select("id, code, short_description, unit_of_measure, target_price")
          .eq("company_id", companyId)
          .eq("status", "active")
          .or(`code.ilike.${term},short_description.ilike.${term}`)
          .limit(10)
        if (cancelled) return
        if (error) {
          setItemSearchResults([])
          return
        }
        const rows = (data ?? []) as Array<{
          id: string
          code: string
          short_description: string
          unit_of_measure: string | null
          target_price: number | null
        }>
        setItemSearchResults(
          rows.map((r) => ({
            id: r.id,
            code: r.code,
            short_description: r.short_description,
            unit_of_measure: r.unit_of_measure ?? "",
            target_price:
              r.target_price != null && !Number.isNaN(Number(r.target_price))
                ? Number(r.target_price)
                : null,
          })),
        )
      } finally {
        if (!cancelled) setItemSearchLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debouncedItemSearch, companyId, canAccess, userLoading])


  function addItemFromCatalog(item: CatalogItemRow) {
    setContractItems((prev) => [
      ...prev,
      {
        material_code: item.code,
        material_description: item.short_description,
        unit_of_measure: item.unit_of_measure ?? "",
        quantity_contracted: "1",
        unit_price: item.target_price != null ? String(item.target_price) : "",
        delivery_days: "",
        notes: "",
        item_id: item.id,
        _fromQuotation: false,
      },
    ])
    setItemSearch("")
    setDebouncedItemSearch("")
    setItemSearchResults([])
  }

  function updateItem(
    index: number,
    field: keyof ContractItemForm,
    value: string,
  ) {
    setContractItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  function removeItem(index: number) {
    setContractItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(mode: "save" | "send") {
    const {
      supplier_id,
      quotation_id,
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
      if (!title.trim()) {
        toast.error("Informe o título do contrato.")
        return
      }
      if (!start_date) {
        toast.error("Informe a data de início.")
        return
      }
      if (!end_date) {
        toast.error("Informe a data de fim.")
        return
      }
      if (!payment_condition_id) {
        toast.error("Selecione uma condição de pagamento")
        return
      }
    }

    let valueNum: number | null = null
    if (contract_kind === "por_valor" && value.trim()) {
      valueNum = parseValueToNumber(value)
      if (valueNum === null && mode === "send") {
        toast.error("Valor inválido.")
        return
      }
      if (valueNum === null) {
        valueNum = null
      }
    }

    const shouldValidateItems = mode === "send"
    let itemsPayload: Array<{
      material_code: string
      material_description: string
      unit_of_measure: string | null
      quantity_contracted: number
      unit_price: number
      delivery_days: number | null
      notes: string | null
    }> = []
    if (shouldValidateItems) {
      const { items, error: itemsError } = buildContractItemsPayload(contractItems)
      if (itemsError) {
        toast.error(itemsError)
        return
      }
      itemsPayload = items
    } else {
      const { items } = buildContractItemsPayload(contractItems)
      itemsPayload = items
    }

    const payload = {
      supplier_id: supplier_id || null,
      title: mode === "save" ? title.trim() || "Rascunho sem título" : title.trim(),
      type: "fornecimento",
      contract_kind,
      status: mode === "save" ? "draft" : calcularStatus(start_date, end_date),
      start_date: start_date || null,
      end_date: end_date || null,
      value: valueNum,
      notes: notes.trim() || null,
      payment_condition_id: payment_condition_id || null,
      contract_terms: null,
      erp_code: erp_code.trim() || null,
      quotation_id: quotation_id.trim() || null,
    }

    setSaving(true)
    try {
      let contract: Contract | null = null
      if (mode === "save" && savedContractId) {
        const patchPayload: Record<string, unknown> = {
          title: title.trim() || "Rascunho sem título",
          type: "fornecimento",
          contract_kind,
          status: "draft",
          notes: notes.trim() || null,
          payment_condition_id: payment_condition_id || null,
          erp_code: erp_code.trim() || null,
        }
        if (supplier_id) patchPayload.supplier_id = supplier_id
        if (start_date) patchPayload.start_date = start_date
        if (end_date) patchPayload.end_date = end_date
        patchPayload.value = valueNum

        const res = await fetch(`/api/contracts/${savedContractId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        })
        const data = (await res.json()) as { contract?: Contract; error?: string }
        if (!res.ok || !data.contract) {
          toast.error(data.error ?? "Não foi possível salvar o rascunho.")
          return
        }
        contract = data.contract
      } else {
        const res = await fetch("/api/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as {
          contract?: Contract
          error?: string
        }
        if (!res.ok || !data.contract) {
          toast.error(data.error ?? "Não foi possível salvar o contrato.")
          return
        }
        contract = data.contract
      }

      if (contract && itemsPayload.length > 0 && !(mode === "save" && savedContractId)) {
        const itemsRes = await fetch("/api/contract-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_id: contract.id,
            items: itemsPayload,
          }),
        })
        const itemsData = (await itemsRes.json()) as { error?: string }
        if (!itemsRes.ok) {
          toast.error(
            itemsData.error ??
              "Contrato criado, mas não foi possível salvar os itens.",
          )
          return
        }
      }

      if (mode === "save") {
        if (contract) {
          setRascunhoId(contract.id)
          setSavedDraftMeta({
            code: contract.code ?? null,
            erp_code: contract.erp_code ?? null,
          })
        }
        toast.success("Rascunho salvo!")
        return
      }
      if (!contract) {
        toast.error("Não foi possível preparar o contrato para envio.")
        return
      }

      const sendRes = await fetch(
        `/api/contracts/${contract.id}/send-for-acceptance`,
        { method: "POST" },
      )
      const sendData = (await sendRes.json()) as {
        success?: boolean
        error?: string
      }
      if (!sendRes.ok || !sendData.success) {
        toast.error(
          sendData.error ??
            "Contrato criado, mas não foi possível enviar para aceite.",
        )
        router.push(`/comprador/contratos/${contract.id}`)
        return
      }
      toast.success("Contrato criado e enviado para aceite!")
      router.push(`/comprador/contratos/${contract.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!userLoading && !permissionsLoading && !canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo contrato</CardTitle>
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

  return (
    <div className="p-6 space-y-6 w-full">
      <ContractImportExcelDialog
        open={importDialog}
        onClose={() => setImportDialog(false)}
        companyId={companyId ?? ""}
        onImport={(items) => setContractItems((prev) => [...prev, ...items])}
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push("/comprador/contratos")}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Novo Contrato</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/comprador/contratos")}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleSubmit("save")}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            onClick={() => void handleSubmit("send")}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar e Enviar para Aceite"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <div className="space-y-1.5">
              <Label>Código Interno</Label>
              <Input
                readOnly
                className="w-44 bg-muted font-mono"
                value={savedDraftMeta?.code ?? "—"}
                placeholder="Gerado automaticamente"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Código ERP</Label>
              <Input
                readOnly
                className="w-44 bg-muted"
                value={savedDraftMeta?.erp_code ?? "—"}
              />
              <p className="text-xs text-muted-foreground">
                Preenchido automaticamente pela integração
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Nome do contrato"
                maxLength={100}
                className="w-[100ch] max-w-full"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground text-right">
                {form.title.length}/100
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              {fromCotacao ? (
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted text-sm">
                  <span className="truncate">
                    {suppliers.find((s) => s.id === form.supplier_id)?.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    (originado da cotação)
                  </span>
                </div>
              ) : (
                <Select
                  value={form.supplier_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
                  disabled={loading}
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
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Contrato</Label>
              <div className="w-fit">
                <Select
                  value={form.contract_kind}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      contract_kind: v as ContractKind,
                    }))
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
            </div>
            <div className="space-y-1.5">
              {form.contract_kind === "por_valor" ? (
                <>
                  <Label>Valor Total</Label>
                  <Input
                    type="text"
                    className="w-44"
                    placeholder="R$ 0,00"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
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
                    setForm((f) => ({
                      ...f,
                      payment_condition_id: v,
                    }))
                  }
                  disabled={loading}
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
                    setForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
                <span className="text-muted-foreground text-sm">até</span>
                <Input
                  type="date"
                  className="w-40"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end_date: e.target.value }))
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
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas internas sobre o contrato…"
              />
              <p className="text-xs text-muted-foreground text-right">
                {(form.notes ?? "").length}/500
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Os termos contratuais podem ser adicionados após salvar o contrato.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens do Contrato</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportDialog(true)
                }}
              >
                <Upload className="h-3 w-3 mr-1" />
                Importar Excel
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item no catálogo por código ou descrição..."
                className={`pl-9${itemSearchLoading ? " opacity-80" : ""}`}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                aria-busy={itemSearchLoading}
              />
              {itemSearchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-background border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {itemSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => addItemFromCatalog(item)}
                    >
                      <span className="font-medium">{item.code}</span>
                      <span className="text-muted-foreground ml-2">
                        {item.short_description}
                      </span>
                      {item.target_price != null && (
                        <span className="float-right text-xs text-muted-foreground">
                          Alvo: {formatBRL(item.target_price)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-center px-3 py-2 w-16">UN</th>
                    <th className="text-center px-3 py-2 w-28">Qtd</th>
                    <th className="text-center px-3 py-2 w-32">Preço Unit.</th>
                    <th className="text-center px-3 py-2 w-24">Prazo (dias)</th>
                    <th className="text-right px-3 py-2 w-28">Total</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {contractItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-sm text-muted-foreground text-center py-4">
                        Busque itens no catálogo ou importe via Excel.
                      </td>
                    </tr>
                  ) : (
                    contractItems.map((item, index) => {
                      const qty = parseQty(item.quantity_contracted || "0")
                      const price = parsePrice(item.unit_price)
                      const lineTotal = qty * price
                      const lineDisplay =
                        Number.isFinite(lineTotal) ? lineTotal : null
                      return (
                        <tr key={`${item.item_id ?? "row"}-${index}`} className="border-t border-border">
                          <td className="px-3 py-1">
                            <span className="text-xs font-mono">{item.material_code}</span>
                          </td>
                          <td className="px-3 py-1 text-xs">{item.material_description}</td>
                          <td className="px-3 py-1 text-center">
                            <span className="text-xs px-2 inline-block">
                              {item.unit_of_measure || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-center">
                            {item._fromQuotation ? (
                              <span className="text-sm px-2 inline-block">
                                {item.quantity_contracted}
                              </span>
                            ) : (
                              <Input
                                className="h-7 text-xs text-center w-24 mx-auto"
                                type="number"
                                min={0}
                                value={item.quantity_contracted}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "quantity_contracted",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          <td className="px-3 py-1 text-center">
                            {item._fromQuotation ? (
                              <span className="text-sm px-2 inline-block">
                                {item.unit_price}
                              </span>
                            ) : (
                              <Input
                                className="h-7 text-xs text-center w-28 mx-auto"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateItem(index, "unit_price", e.target.value)
                                }
                              />
                            )}
                          </td>
                          <td className="px-3 py-1 text-center">
                            <Input
                              className="h-7 text-xs text-center w-20 mx-auto"
                              type="number"
                              min={0}
                              value={item.delivery_days}
                              onChange={(e) =>
                                updateItem(index, "delivery_days", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-3 py-1 text-right text-xs text-muted-foreground">
                            {formatBRL(lineDisplay)}
                          </td>
                          <td className="px-3 py-1">
                            <button type="button" onClick={() => removeItem(index)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="bg-muted/50 border-t border-border">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-sm font-medium text-right">
                      Total do Contrato:
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-right">
                      {formatBRL(
                        (() => {
                          const total = contractItems.reduce((sum, item) => {
                            const qty = parseQty(item.quantity_contracted || "0")
                            const price = parsePrice(item.unit_price)
                            const line = qty * price
                            return sum + (Number.isFinite(line) ? line : 0)
                          }, 0)
                          return Number.isFinite(total) ? total : null
                        })(),
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/comprador/contratos")}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSubmit("save")}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit("send")}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar e Enviar para Aceite"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
