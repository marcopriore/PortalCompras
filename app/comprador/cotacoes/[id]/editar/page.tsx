"use client"

import * as React from "react"
import { use, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { formatDateBR, formatDateQueryBR, formatNowBR } from "@/lib/formato-data"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import {
  canAccessQuotation,
  canViewAllQuotations,
  formatResponsibleName,
} from "@/lib/quotations/ownership"
import { paymentConditionsQueryOptions } from "@/lib/queries/payment-conditions"
import {
  catalogItemSearchQueryOptions,
  catalogSupplierSearchQueryOptions,
} from "@/lib/queries/catalog-search"
import {
  approvedRequisitionsImportQueryOptions,
  quotationEditFormQueryOptions,
} from "@/lib/queries/quotation-form"
import { SuggestSuppliersButton } from "@/components/comprador/suggest-suppliers-button"
import { Button } from "@/components/ui/button"
import { QuantityInput } from "@/components/ui/numeric-field-inputs"
import { useNumericLimits } from "@/lib/hooks/use-numeric-limits"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Building2,
  CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FileText,
  Loader2,
  Package,
  Save,
  Search,
  Trash2,
} from "lucide-react"

type QuotationStatus = "draft" | "rejected" | "waiting" | "analysis" | "completed" | "cancelled"

type QuotationItem = {
  code: string
  description: string
  unit_of_measure: string
  long_description?: string | null
}
type SelectedItem = QuotationItem & {
  quantity: number
  /** Preservado do banco na edição; não exibido na UI */
  complementary_spec: string | null
  requisition_code?: string | null
  site_code?: string | null
}
type Supplier = {
  id: string
  name: string
  cnpj: string | null
  category: string | null
}

type RequisitionOption = {
  id: string
  code: string
  title: string
  created_at: string
  items: {
    material_code: string | null
    material_description: string
    unit_of_measure: string | null
    quantity: number
    site_code?: string | null
  }[]
}

const PAYMENT_NONE = "__none__"

const SEARCH_DEBOUNCE_MS = 300

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function Section({
  title,
  icon,
  sectionKey,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  sectionKey: string
  open: boolean
  onToggle: (key: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="flex w-full items-center justify-between px-4 py-3 text-base font-medium hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  )
}

export default function EditarCotacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { companyId, userId, isSuperAdmin, hasRole, loading: userLoading } = useUser()
  const { hasPermission, loading: permLoading } = usePermissions()
  const viewAllQuotations = canViewAllQuotations({
    isSuperAdmin,
    hasRole,
    hasPermission,
  })
  const { maxQuantity } = useNumericLimits()

  const [formReady, setFormReady] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [deadline, setDeadline] = React.useState<Date | undefined>()
  const [deadlineOpen, setDeadlineOpen] = React.useState(false)
  const [category, setCategory] = React.useState<string | undefined>()
  const [paymentCondition, setPaymentCondition] = React.useState("")
  const [responsibleId, setResponsibleId] = React.useState<string>("")
  const [buyers, setBuyers] = React.useState<{ id: string; full_name: string | null }[]>([])
  const [itemSearch, setItemSearch] = React.useState("")
  const [selectedItems, setSelectedItems] = React.useState<SelectedItem[]>([])
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [selectedSuppliers, setSelectedSuppliers] = React.useState<Supplier[]>([])
  const [errors, setErrors] = React.useState<Record<string, boolean>>({})
  const [open, setOpen] = React.useState({ general: true, items: true, suppliers: true })
  const [quotationCode, setQuotationCode] = React.useState<string | null>(null)
  const [reqDialogOpen, setReqDialogOpen] = React.useState(false)
  const [selectedReqIds, setSelectedReqIds] = React.useState<string[]>([])
  const editFormHydratedRef = useRef(false)

  const supabase = React.useMemo(() => createClient(), [])
  const today = React.useMemo(() => formatNowBR(), [])

  const debouncedItemSearch = useDebounce(itemSearch, SEARCH_DEBOUNCE_MS)
  const debouncedSupplierSearch = useDebounce(supplierSearch, SEARCH_DEBOUNCE_MS)

  const paymentConditionsQuery = useQuery({
    ...paymentConditionsQueryOptions(companyId ?? "", () => supabase),
    enabled: Boolean(companyId),
  })
  const paymentConditions = paymentConditionsQuery.data ?? []

  const itemSearchQuery = useQuery({
    ...catalogItemSearchQueryOptions(
      companyId ?? "",
      debouncedItemSearch,
      "quotation",
      () => supabase,
    ),
  })
  const itemResults: QuotationItem[] = (itemSearchQuery.data ?? []).map((i) => ({
    code: i.code,
    description: i.description,
    unit_of_measure: i.unit_of_measure,
    long_description: i.long_description ?? null,
  }))
  const itemSearchLoading = itemSearchQuery.isFetching

  const supplierSearchQuery = useQuery({
    ...catalogSupplierSearchQueryOptions(companyId ?? "", debouncedSupplierSearch, () => supabase),
  })
  const supplierResults = (supplierSearchQuery.data ?? []) as Supplier[]
  const supplierSearchLoading = supplierSearchQuery.isFetching

  const editFormQuery = useQuery({
    ...quotationEditFormQueryOptions(companyId ?? "", id, () => supabase),
    enabled: Boolean(id && companyId && !userLoading && !permLoading),
  })

  const loading =
    userLoading || permLoading || editFormQuery.isLoading || !formReady

  React.useEffect(() => {
    if (userLoading || permLoading) return
    if (editFormQuery.isLoading) return

    if (editFormQuery.isError || !editFormQuery.data) {
      if (!editFormQuery.isLoading) {
        toast.error("Não foi possível carregar a cotação.")
// eslint-disable-next-line react-hooks/set-state-in-effect -- ver docs/PADRAO-CARGA-DADOS.md
        setFormReady(true)
      }
      return
    }

    const dto = editFormQuery.data
    const createdBy = dto.quotation.created_by

    if (
      !canAccessQuotation({
        createdBy,
        userId,
        canViewAll: viewAllQuotations,
      })
    ) {
      toast.error("Você não tem permissão para editar esta cotação.")
      router.replace("/comprador/cotacoes")
      return
    }

    const status = dto.quotation.status as QuotationStatus
    if (status !== "draft" && status !== "rejected") {
      router.replace(`/comprador/cotacoes/${id}`)
      return
    }

    if (editFormHydratedRef.current) return
    editFormHydratedRef.current = true

    setQuotationCode(dto.quotation.code)
    setDescription(dto.quotation.description)
    setCategory(dto.quotation.category ?? undefined)
    setPaymentCondition(dto.quotation.payment_condition ?? "")
    setResponsibleId(createdBy ?? userId ?? "")
    setBuyers(dto.buyers)
    if (dto.quotation.response_deadline) {
      setDeadline(new Date(dto.quotation.response_deadline))
    }

    if (dto.items.length > 0) {
      setSelectedItems(
        dto.items.map((ri) => ({
          code: ri.material_code ?? "",
          description: ri.material_description ?? "",
          long_description: ri.long_description ?? null,
          unit_of_measure: ri.unit_of_measure ?? "",
          quantity: ri.quantity ?? 1,
          complementary_spec: ri.complementary_spec ?? null,
          requisition_code: ri.source_requisition_code ?? null,
          site_code: ri.site_code ?? null,
        })),
      )
    }

    if (dto.suppliers.length > 0) {
      setSelectedSuppliers(
        dto.suppliers.map((s) => ({
          id: s.supplier_id,
          name: s.supplier_name,
          cnpj: s.supplier_cnpj ?? "",
          category: "",
        })),
      )
    }

    setFormReady(true)
  }, [
    editFormQuery.data,
    editFormQuery.isError,
    editFormQuery.isLoading,
    id,
    permLoading,
    router,
    userId,
    userLoading,
    viewAllQuotations,
  ])

  const requisitionsImportQuery = useQuery({
    ...approvedRequisitionsImportQueryOptions(companyId ?? "", reqDialogOpen, () => supabase),
  })
  const requisitions = (requisitionsImportQuery.data ?? []) as RequisitionOption[]
  const requisitionsLoading = requisitionsImportQuery.isFetching

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))

  const addItem = (item: QuotationItem) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.code === item.code)
        ? prev
        : [
            ...prev,
            { ...item, quantity: 1, complementary_spec: null, requisition_code: null },
          ],
    )
    setItemSearch("")
  }

  const updateItemQuantity = (code: string, quantity: number) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.code === code ? { ...i, quantity } : i)),
    )
  }

  const addSupplier = (s: Supplier) => {
    setSelectedSuppliers((prev) =>
      prev.some((x) => x.id === s.id) ? prev : [...prev, s],
    )
    setSupplierSearch("")
  }

  function openRequisitionsImportDialog() {
    if (!companyId) return
    setReqDialogOpen(true)
  }

  function handleImportRequisitions() {
    const selected = requisitions.filter((r) => selectedReqIds.includes(r.id))
    setSelectedItems((prev) => {
      const newItems: SelectedItem[] = []
      for (const req of selected) {
        for (const item of req.items) {
          const code = item.material_code ?? ""
          const description = item.material_description ?? ""

          const alreadyExists =
            prev.some((i) =>
              code !== "" ? i.code === code : i.description === description,
            ) ||
            newItems.some((i) =>
              code !== "" ? i.code === code : i.description === description,
            )

          if (alreadyExists) continue

          newItems.push({
            code,
            description,
            unit_of_measure: item.unit_of_measure ?? "",
            long_description: null,
            quantity: item.quantity ?? 1,
            complementary_spec: null,
            requisition_code: req.code,
            site_code: item.site_code ?? null,
          })
        }
      }

      if (newItems.length > 0) {
        const added = newItems.length
        const reqCount = selected.length
        queueMicrotask(() =>
          toast.success(
            `${added} item(s) importado(s) de ${reqCount} requisição(ões).`,
          ),
        )
      } else {
        queueMicrotask(() =>
          toast.warning("Todos os itens selecionados já estão na cotação."),
        )
      }

      return [...prev, ...newItems]
    })

    setReqDialogOpen(false)
    setSelectedReqIds([])
  }

  const handleSave = async () => {
    const newErrors = { description: !description.trim(), deadline: !deadline }
    if (newErrors.description || newErrors.deadline) {
      setErrors(newErrors)
      const missing = [
        newErrors.description && "Descrição",
        newErrors.deadline && "Data Limite",
      ].filter(Boolean)
      toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}`)
      return
    }

    setErrors({})
    setSaving(true)

    try {
      const supabase = createClient()

      const nextOwnerId = viewAllQuotations
        ? responsibleId || userId || null
        : (responsibleId || userId || null)

      await supabase
        .from("quotations")
        .update({
          description: description.trim(),
          category: category ?? null,
          response_deadline: deadline
            ? deadline.toISOString().split("T")[0]
            : null,
          payment_condition: paymentCondition.trim() || null,
          created_by: nextOwnerId,
        })
        .eq("id", id)
        .eq("company_id", companyId!)

      await supabase.from("quotation_items").delete().eq("quotation_id", id)

      if (selectedItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("quotation_items")
          .insert(
            selectedItems.map((item) => ({
              quotation_id: id,
              company_id: companyId!,
              material_code: item.code,
              material_description: item.description,
              long_description: item.long_description ?? null,
              unit_of_measure: item.unit_of_measure,
              quantity: item.quantity,
              complementary_spec: item.complementary_spec,
              source_requisition_code: item.requisition_code ?? null,
              site_code: item.site_code ?? null,
            })),
          )

        if (itemsError) {
          toast.error("Erro ao salvar itens da cotação.")
          return
        }
      }

      await supabase
        .from("quotation_suppliers")
        .delete()
        .eq("quotation_id", id)

      if (selectedSuppliers.length > 0) {
        const { error: suppliersError } = await supabase
          .from("quotation_suppliers")
          .insert(
            selectedSuppliers.map((s, index) => ({
              quotation_id: id,
              company_id: companyId!,
              supplier_id: s.id,
              supplier_name: s.name,
              supplier_cnpj: s.cnpj || null,
              position: index + 1,
            })),
          )

        if (suppliersError) {
          toast.error("Erro ao salvar fornecedores da cotação.")
          return
        }
      }

      const reqCodes = [
        ...new Set(
          selectedItems
            .map((i) => i.requisition_code)
            .filter((c): c is string => Boolean(c)),
        ),
      ]

      if (reqCodes.length > 0) {
        const { data: reqsToUpdate } = await supabase
          .from("requisitions")
          .select("id, code")
          .eq("company_id", companyId!)
          .is("quotation_id", null)
          .in("code", reqCodes)

        if (reqsToUpdate && reqsToUpdate.length > 0) {
          await supabase
            .from("requisitions")
            .update({
              status: "in_quotation",
              quotation_id: id,
            })
            .in("id", reqsToUpdate.map((r) => r.id))

          for (const req of reqsToUpdate) {
            void logAudit({
              eventType: "requisition.in_quotation",
              description: `Requisição ${req.code} vinculada à cotação ${quotationCode ?? id}`,
              companyId: companyId ?? null,
              userId: userId ?? null,
              userName: userId ?? null,
              entity: "requisitions",
              entityId: req.id,
              metadata: { quotation_id: id, quotation_code: quotationCode },
            })
          }
        }
      }

      toast.success("Alterações salvas com sucesso.")
      router.push(`/comprador/cotacoes/${id}`)
    } catch {
      toast.error("Erro ao salvar alterações. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  if (loading || userLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <p className="text-sm text-muted-foreground">Carregando cotação...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/comprador/cotacoes/${id}`)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              Editar Cotação {quotationCode ?? ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              Altere os dados da cotação e salve as alterações
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-11 sm:pl-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/comprador/cotacoes/${id}`)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !companyId}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      {/* Seção Dados Gerais */}
      <Section
        title="Dados gerais"
        icon={<FileText className="h-4 w-4 text-primary" />}
        sectionKey="general"
        open={open.general}
        onToggle={toggle}
      >
        <div className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>ID da Cotação</Label>
              <Input
                disabled
                value={quotationCode ?? ""}
                className="bg-muted/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Descrição <span className="text-primary">*</span>
              </Label>
              <Input
                placeholder="Descreva o objetivo desta cotação"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setErrors((p) => ({ ...p, description: false }))
                }}
                className={
                  errors.description
                    ? "border-destructive ring-1 ring-destructive/30"
                    : ""
                }
              />
              {errors.description && (
                <p className="text-xs text-destructive">Campo obrigatório</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Data de Criação</Label>
              <Input disabled value={today} className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label>
                Data Limite de Resposta <span className="text-primary">*</span>
              </Label>
              <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`w-full justify-between font-normal ${
                      errors.deadline
                        ? "border-destructive ring-1 ring-destructive/30"
                        : ""
                    }`}
                  >
                    {deadline ? (
                      formatDateBR(formatDateQueryBR(deadline))
                    ) : (
                      <span className="text-muted-foreground">
                        Selecione uma data
                      </span>
                    )}
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={(d) => {
                      setDeadline(d)
                      setErrors((p) => ({ ...p, deadline: false }))
                      if (d) setDeadlineOpen(false)
                    }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.deadline && (
                <p className="text-xs text-destructive">Campo obrigatório</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {["MRO", "Matéria-Prima", "Serviços", "TI", "Outros"].map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condição de Pagamento</Label>
              <Select
                value={paymentCondition ? paymentCondition : PAYMENT_NONE}
                onValueChange={(v) =>
                  setPaymentCondition(v === PAYMENT_NONE ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PAYMENT_NONE}>Selecione...</SelectItem>
                  {paymentCondition.trim() &&
                    !paymentConditions.some((p) => p.code === paymentCondition) && (
                      <SelectItem value={paymentCondition}>
                        {paymentCondition}
                      </SelectItem>
                    )}
                  {paymentConditions.map((pc) => (
                    <SelectItem key={pc.id} value={pc.code}>
                      {`${pc.code} — ${pc.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              {viewAllQuotations ? (
                <Select
                  value={responsibleId || undefined}
                  onValueChange={setResponsibleId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o comprador" />
                  </SelectTrigger>
                  <SelectContent>
                    {responsibleId &&
                      !buyers.some((b) => b.id === responsibleId) && (
                        <SelectItem value={responsibleId}>
                          Responsável atual
                        </SelectItem>
                      )}
                    {buyers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {formatResponsibleName(b.full_name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled
                  className="bg-muted/40"
                  value={formatResponsibleName(
                    buyers.find((b) => b.id === responsibleId)?.full_name,
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Seção Itens */}
      <Section
        title="Itens"
        icon={<Package className="h-4 w-4 text-primary" />}
        sectionKey="items"
        open={open.items}
        onToggle={toggle}
      >
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Busque itens do catálogo ou importe de requisições aprovadas.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedReqIds([])
                openRequisitionsImportDialog()
              }}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Importar de Requisição
            </Button>
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por código ou descrição do material..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {itemSearch.trim().length >= 2 && (
              <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                {itemSearchLoading ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground text-center">
                    Buscando...
                  </li>
                ) : itemResults.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground text-center">
                    Nenhum item encontrado
                  </li>
                ) : (
                  itemResults.map((item) => (
                    <li
                      key={item.code}
                      onClick={() => addItem(item)}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.code}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.unit_of_measure}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {selectedItems.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Nenhum item adicionado
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Código</th>
                  <th className="px-2 py-2 text-left">Descrição Curta</th>
                  <th className="px-2 py-2 text-left">Requisição</th>
                  <th className="px-2 py-2 text-left">UN</th>
                  <th className="px-2 py-2 text-left">Qtd</th>
                  <th className="px-2 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item) => (
                  <tr
                    key={item.code}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-2 py-2 align-top font-medium">
                      {item.code}
                    </td>
                    <td className="px-2 py-2 align-top">{item.description}</td>
                    <td className="px-2 py-2 align-top">
                      {item.requisition_code ? (
                        <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                          {item.requisition_code}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top">
                      {item.unit_of_measure}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <QuantityInput
                        value={item.quantity}
                        maxQuantity={maxQuantity}
                        onValueChange={(quantity) =>
                          updateItemQuantity(item.code, quantity)
                        }
                        className="w-20"
                      />
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedItems((p) =>
                            p.filter((i) => i.code !== item.code),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* Seção Fornecedores */}
      <Section
        title="Fornecedores"
        icon={<Building2 className="h-4 w-4 text-primary" />}
        sectionKey="suppliers"
        open={open.suppliers}
        onToggle={toggle}
      >
        <div className="space-y-3 pt-2">
          <div className="flex justify-end">
            <SuggestSuppliersButton
              quotationId={id}
              onAddSupplier={(supplier) => {
                addSupplier({
                  id: supplier.id,
                  name: supplier.name,
                  cnpj: null,
                  category: null,
                })
              }}
            />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ do fornecedor..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {supplierSearch.trim().length >= 2 && (
              <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                {supplierSearchLoading ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground text-center">
                    Buscando...
                  </li>
                ) : supplierResults.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground text-center">
                    Nenhum fornecedor encontrado
                  </li>
                ) : (
                  supplierResults.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => addSupplier(s)}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.cnpj ?? "—"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.category ?? "—"}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {selectedSuppliers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Nenhum fornecedor adicionado
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Nome</th>
                  <th className="px-2 py-2 text-left">CNPJ</th>
                  <th className="px-2 py-2 text-left">Categoria</th>
                  <th className="px-2 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {selectedSuppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-2 py-2">{s.name}</td>
                    <td className="px-2 py-2">{s.cnpj ?? "—"}</td>
                    <td className="px-2 py-2">{s.category ?? "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedSuppliers((p) =>
                            p.filter((x) => x.id !== s.id),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      <Dialog open={reqDialogOpen} onOpenChange={setReqDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Itens de Requisições</DialogTitle>
          </DialogHeader>

          {requisitionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requisitions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma requisição aprovada disponível para importação.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {requisitions.map((req) => (
                <div
                  key={req.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedReqIds((prev) =>
                        prev.includes(req.id)
                          ? prev.filter((x) => x !== req.id)
                          : [...prev, req.id],
                      )
                    }
                  }}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    selectedReqIds.includes(req.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                  onClick={() =>
                    setSelectedReqIds((prev) =>
                      prev.includes(req.id)
                        ? prev.filter((x) => x !== req.id)
                        : [...prev, req.id],
                    )
                  }
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedReqIds.includes(req.id)}
                      onCheckedChange={(checked) => {
                        setSelectedReqIds((prev) =>
                          checked === true
                            ? prev.includes(req.id)
                              ? prev
                              : [...prev, req.id]
                            : prev.filter((x) => x !== req.id),
                        )
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono text-primary">
                          {req.code}
                        </span>
                        <span className="text-sm text-foreground truncate">
                          {req.title}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {formatDateBR(req.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {req.items.length} item(s):{" "}
                        {req.items
                          .slice(0, 3)
                          .map((i) => i.material_description)
                          .join(", ")}
                        {req.items.length > 3 &&
                          ` +${req.items.length - 3} mais`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <div className="flex items-center gap-3 w-full flex-wrap">
              <span className="text-sm text-muted-foreground flex-1 min-w-[12rem]">
                {selectedReqIds.length > 0
                  ? `${selectedReqIds.length} requisição(ões) selecionada(s)`
                  : "Selecione as requisições para importar"}
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReqDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleImportRequisitions}
                disabled={selectedReqIds.length === 0}
              >
                Importar{" "}
                {selectedReqIds.length > 0 ? `(${selectedReqIds.length})` : ""}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
