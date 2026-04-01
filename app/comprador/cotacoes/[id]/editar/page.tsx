"use client"

import * as React from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Building2,
  CalendarIcon,
  ChevronDown,
  ChevronLeft,
  FileText,
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
}
type Supplier = { id: string; name: string; cnpj: string; category: string }

const MOCK_ITEMS: QuotationItem[] = [
  { code: "MAT-0001", description: 'Parafuso sextavado 1/4"', unit_of_measure: "UN" },
  { code: "MAT-0002", description: 'Arruela lisa 1/4"', unit_of_measure: "UN" },
  { code: "MAT-0003", description: "Chapa de aço 3mm", unit_of_measure: "KG" },
  { code: "MAT-0004", description: "Tinta epóxi branca", unit_of_measure: "L" },
  { code: "MAT-0005", description: "Rolamento esférico 6204", unit_of_measure: "UN" },
  { code: "MAT-0006", description: 'Mangueira hidráulica 1/2"', unit_of_measure: "M" },
  { code: "MAT-0007", description: "Óleo lubrificante 68", unit_of_measure: "L" },
  { code: "MAT-0008", description: "Filtro de ar industrial", unit_of_measure: "UN" },
  { code: "MAT-0009", description: "Correia transportadora", unit_of_measure: "M" },
  { code: "MAT-0010", description: 'Válvula solenoide 1"', unit_of_measure: "UN" },
]

const MOCK_SUPPLIERS: Supplier[] = [
  { id: "1", name: "Fornecedor Alfa Ltda", cnpj: "12.345.678/0001-00", category: "MRO" },
  { id: "2", name: "Comercial Beta S.A.", cnpj: "23.456.789/0001-11", category: "Matéria-Prima" },
  { id: "3", name: "Serviços Gama ME", cnpj: "34.567.890/0001-22", category: "Serviços" },
  { id: "4", name: "Tecnologia Delta Ltda", cnpj: "45.678.901/0001-33", category: "TI" },
  { id: "5", name: "Fornecedor Épsilon", cnpj: "56.789.012/0001-44", category: "MRO" },
  { id: "6", name: "Indústria Zeta", cnpj: "67.890.123/0001-55", category: "Matéria-Prima" },
  { id: "7", name: "Serviços Ômega", cnpj: "78.901.234/0001-66", category: "Serviços" },
  { id: "8", name: "Fornecedor Sigma", cnpj: "89.012.345/0001-77", category: "Outros" },
]

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
  const { companyId, loading: userLoading } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [deadline, setDeadline] = React.useState<Date | undefined>()
  const [deadlineOpen, setDeadlineOpen] = React.useState(false)
  const [category, setCategory] = React.useState<string | undefined>()
  const [itemSearch, setItemSearch] = React.useState("")
  const [selectedItems, setSelectedItems] = React.useState<SelectedItem[]>([])
  const [supplierSearch, setSupplierSearch] = React.useState("")
  const [selectedSuppliers, setSelectedSuppliers] = React.useState<Supplier[]>([])
  const [errors, setErrors] = React.useState<Record<string, boolean>>({})
  const [open, setOpen] = React.useState({ general: true, items: true, suppliers: true })
  const [quotationCode, setQuotationCode] = React.useState<string | null>(null)

  const today = React.useMemo(
    () => format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    [],
  )

  React.useEffect(() => {
    if (!id || !companyId) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const supabase = createClient()

        const { data: quotationData, error: quotationError } = await supabase
          .from("quotations")
          .select("id, code, description, status, category, response_deadline")
          .eq("id", id)
          .eq("company_id", companyId)
          .single()

        if (quotationError || !quotationData) {
          toast.error("Não foi possível carregar a cotação.")
          setLoading(false)
          return
        }

        const status = quotationData.status as QuotationStatus
        if (status !== "draft" && status !== "rejected") {
          router.replace(`/comprador/cotacoes/${id}`)
          return
        }

        setQuotationCode(quotationData.code as string)
        setDescription((quotationData.description as string) ?? "")
        setCategory((quotationData.category as string) ?? undefined)
        if (quotationData.response_deadline) {
          setDeadline(new Date(quotationData.response_deadline as string))
        }

        const [{ data: itemsData }, { data: suppliersData }] = await Promise.all([
          supabase
            .from("quotation_items")
            .select(
              "material_code, material_description, long_description, unit_of_measure, quantity, complementary_spec",
            )
            .eq("quotation_id", id),
          supabase
            .from("quotation_suppliers")
            .select("supplier_id, supplier_name, supplier_cnpj, position")
            .eq("quotation_id", id)
            .order("position", { ascending: true, nullsFirst: false }),
        ])

        if (itemsData && itemsData.length > 0) {
          setSelectedItems(
            (itemsData as Array<{
              material_code: string
              material_description: string
              long_description: string | null
              unit_of_measure: string | null
              quantity: number
              complementary_spec: string | null
            }>).map((ri) => ({
              code: ri.material_code ?? "",
              description: ri.material_description ?? "",
              long_description: ri.long_description ?? null,
              unit_of_measure: ri.unit_of_measure ?? "",
              quantity: ri.quantity ?? 1,
              complementary_spec: ri.complementary_spec ?? null,
            })),
          )
        }

        if (suppliersData && suppliersData.length > 0) {
          setSelectedSuppliers(
            (suppliersData as Array<{
              supplier_id: string
              supplier_name: string
              supplier_cnpj: string | null
              position: number | null
            }>).map((s) => ({
              id: s.supplier_id,
              name: s.supplier_name,
              cnpj: s.supplier_cnpj ?? "",
              category: "",
            })),
          )
        }
      } catch {
        toast.error("Erro ao carregar a cotação.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, companyId, router])

  const filteredItems = React.useMemo(() => {
    if (!itemSearch.trim()) return []
    const q = itemSearch.toLowerCase()
    return MOCK_ITEMS.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    )
  }, [itemSearch])

  const filteredSuppliers = React.useMemo(() => {
    if (!supplierSearch.trim()) return []
    const q = supplierSearch.toLowerCase()
    return MOCK_SUPPLIERS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.cnpj.toLowerCase().includes(q),
    )
  }, [supplierSearch])

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))

  const addItem = (item: QuotationItem) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.code === item.code)
        ? prev
        : [...prev, { ...item, quantity: 1, complementary_spec: null }],
    )
    setItemSearch("")
  }

  const updateItemQuantity = (code: string, value: string) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.code !== code) return i
        const n = Number(value)
        return {
          ...i,
          quantity: Number.isFinite(n) && n > 0 ? n : 1,
        }
      }),
    )
  }

  const addSupplier = (s: Supplier) => {
    setSelectedSuppliers((prev) =>
      prev.some((x) => x.id === s.id) ? prev : [...prev, s],
    )
    setSupplierSearch("")
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

      await supabase
        .from("quotations")
        .update({
          description: description.trim(),
          category: category ?? null,
          response_deadline: deadline
            ? deadline.toISOString().split("T")[0]
            : null,
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      format(deadline, "dd/MM/yyyy")
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
            {filteredItems.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {filteredItems.map((item) => (
                  <li
                    key={item.code}
                    onClick={() => addItem(item)}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.unit_of_measure}
                    </span>
                  </li>
                ))}
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
                      {item.unit_of_measure}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemQuantity(item.code, e.target.value)
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
            {filteredSuppliers.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {filteredSuppliers.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => addSupplier(s)}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.cnpj}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.category}
                    </span>
                  </li>
                ))}
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
                    <td className="px-2 py-2">{s.cnpj}</td>
                    <td className="px-2 py-2">{s.category}</td>
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
    </div>
  )
}
