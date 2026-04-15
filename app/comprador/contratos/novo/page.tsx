"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { isBefore, parseISO, startOfDay } from "date-fns"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, FileText, Search, Trash2, Upload } from "lucide-react"
import {
  CONTRACT_KINDS,
  type Contract,
  type ContractKind,
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

interface ContractItemForm {
  material_code: string
  material_description: string
  unit_of_measure: string
  quantity_contracted: string
  unit_price: string
  delivery_days: string
  notes: string
  item_id?: string
  /** Itens vindos do prefill da cotação (sessionStorage). */
  _fromQuotation?: boolean
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

function parseExcelRowsToItems(ws: import("exceljs").Worksheet): {
  items: ContractItemForm[]
  errors: string[]
} {
  const items: ContractItemForm[] = []
  const errors: string[] = []
  let rowNum = 0
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    rowNum = rowNumber
    const code = String(row.getCell(1).value ?? "").trim()
    const description = String(row.getCell(2).value ?? "").trim()
    const unit = String(row.getCell(3).value ?? "").trim()
    const qty = String(row.getCell(4).value ?? "").trim()
    const price = String(row.getCell(5).value ?? "").trim()
    const delivery_days = String(row.getCell(6).value ?? "").trim()
    if (!code && !description && !qty && !price) return
    if (!code || !description) {
      errors.push(`Linha ${rowNumber}: código e descrição são obrigatórios.`)
      return
    }
    const q = parseQty(qty)
    const p = parsePrice(price)
    if (Number.isNaN(q) || q <= 0) {
      errors.push(`Linha ${rowNumber}: quantidade inválida.`)
      return
    }
    if (Number.isNaN(p) || p < 0) {
      errors.push(`Linha ${rowNumber}: preço unitário inválido.`)
      return
    }
    if (delivery_days) {
      const d = parseInt(delivery_days, 10)
      if (Number.isNaN(d) || d < 0) {
        errors.push(`Linha ${rowNumber}: prazo (dias) inválido.`)
        return
      }
    }
    items.push({
      material_code: code,
      material_description: description,
      unit_of_measure: unit,
      quantity_contracted: qty,
      unit_price: price,
      delivery_days,
      notes: "",
    })
  })
  void rowNum
  return { items, errors }
}

export default function NovoContratoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromCotacao = searchParams.get("from") === "cotacao"

  const { companyId, loading: userLoading, isSuperAdmin } = useUser()
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

  const [importDialog, setImportDialog] = React.useState(false)
  const [importStep, setImportStep] = React.useState<1 | 2 | 3>(1)
  const [importedItems, setImportedItems] = React.useState<ContractItemForm[]>(
    [],
  )
  const [importErrors, setImportErrors] = React.useState<string[]>([])
  const importFileInputRef = React.useRef<HTMLInputElement>(null)

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

  function openImportDialog() {
    setImportStep(1)
    setImportedItems([])
    setImportErrors([])
    setImportDialog(true)
  }

  function closeImportDialog() {
    setImportDialog(false)
    setImportStep(1)
    setImportedItems([])
    setImportErrors([])
    if (importFileInputRef.current) importFileInputRef.current.value = ""
  }

  async function handleDownloadTemplate() {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Itens")
    ws.addRow([
      "Código",
      "Descrição",
      "UN",
      "Quantidade",
      "Preço Unitário",
      "Prazo (dias)",
    ])
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F3EF5" },
    }
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template-itens-contrato.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleProcessExcel() {
    const file = importFileInputRef.current?.files?.[0]
    if (!file) {
      toast.error("Selecione um arquivo Excel.")
      return
    }
    try {
      const ExcelJS = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const buffer = await file.arrayBuffer()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]
      if (!ws) {
        toast.error("Planilha sem abas.")
        return
      }
      const { items, errors } = parseExcelRowsToItems(ws)
      setImportedItems(items)
      setImportErrors(errors)
      if (errors.length > 0) {
        toast.error("Corrija os erros indicados antes de continuar.")
        return
      }
      if (items.length === 0) {
        toast.error("Nenhum item encontrado na planilha.")
        return
      }
      setImportStep(3)
    } catch {
      toast.error("Não foi possível ler o arquivo Excel.")
    }
  }

  function handleConfirmImport() {
    if (importedItems.length === 0) return
    setContractItems((prev) => [...prev, ...importedItems])
    toast.success(`${importedItems.length} item(s) adicionado(s)`)
    closeImportDialog()
  }

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

    let valueNum: number | null = null
    if (contract_kind === "por_valor") {
      if (value.trim()) {
        valueNum = parseValueToNumber(value)
        if (valueNum === null) {
          toast.error("Valor inválido.")
          return
        }
      }
    }

    const { items: itemsPayload, error: itemsError } =
      buildContractItemsPayload(contractItems)
    if (itemsError) {
      toast.error(itemsError)
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id,
          title: title.trim(),
          type: "fornecimento",
          contract_kind,
          status: calcularStatus(start_date, end_date),
          start_date,
          end_date,
          value: valueNum,
          notes: notes.trim() || null,
          payment_condition_id: payment_condition_id || null,
          contract_terms: null,
          erp_code: erp_code.trim() || null,
          quotation_id: quotation_id.trim() || null,
        }),
      })
      const data = (await res.json()) as {
        contract?: Contract
        error?: string
      }
      if (!res.ok || !data.contract) {
        toast.error(data.error ?? "Não foi possível salvar o contrato.")
        return
      }

      const contract = data.contract

      if (itemsPayload.length > 0) {
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
          router.push(`/comprador/contratos/${contract.id}`)
          return
        }
      }

      if (mode === "save") {
        toast.success("Contrato salvo!")
        router.push(`/comprador/contratos/${contract.id}`)
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
      <Dialog open={importDialog} onOpenChange={(o) => !o && closeImportDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Itens via Excel</DialogTitle>
          </DialogHeader>
          {importStep === 1 && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Baixe o template, preencha e faça o upload.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleDownloadTemplate()}>
                  Baixar Template
                </Button>
                <Button type="button" onClick={() => setImportStep(2)}>
                  Próximo
                </Button>
              </div>
            </div>
          )}
          {importStep === 2 && (
            <div className="space-y-4 text-sm">
              <Input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="cursor-pointer"
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setImportStep(1)}>
                  Voltar
                </Button>
                <Button type="button" onClick={() => void handleProcessExcel()}>
                  Processar
                </Button>
              </DialogFooter>
            </div>
          )}
          {importStep === 3 && (
            <div className="space-y-4 text-sm">
              <p>{importedItems.length} itens encontrados</p>
              {importErrors.length > 0 && (
                <ul className="list-disc pl-4 space-y-1 text-destructive text-xs">
                  {importErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setImportStep(2)}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importedItems.length === 0}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Novo Contrato</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Fornecedor <span className="text-destructive">*</span>
              </Label>
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
                    <SelectValue placeholder="Selecione o fornecedor" />
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
            <div className="space-y-2">
              <Label>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Nome do contrato"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Tipo de Contrato <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.contract_kind}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    contract_kind: v as ContractKind,
                  }))
                }
              >
                <SelectTrigger>
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
            {form.contract_kind === "por_valor" ? (
              <div className="space-y-2">
                <Label>Valor Total</Label>
                <Input
                  type="text"
                  placeholder="R$ 0,00"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Condição de Pagamento <span className="text-destructive">*</span>
              </Label>
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
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Código ERP (preenchido pela integração)</Label>
              <Input
                readOnly
                className="bg-muted"
                value={form.erp_code}
                placeholder="—"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Data início <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Data fim <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notas internas sobre o contrato…"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Os termos contratuais podem ser adicionados após salvar o contrato.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens do Contrato</h3>
              <Button type="button" variant="outline" size="sm" onClick={openImportDialog}>
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

            {contractItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Busque itens no catálogo ou importe via Excel.
              </p>
            ) : (
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
                    {contractItems.map((item, index) => {
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
                    })}
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
            )}
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
