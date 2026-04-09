'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { logAudit } from '@/lib/audit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Building2,
  CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FileText,
  Loader2,
  Package,
  Search,
  Trash2,
} from 'lucide-react'

type QuotationItem = {
  code: string
  description: string
  unit_of_measure: string
  long_description?: string | null
}
type SelectedItem = QuotationItem & {
  quantity: number
  requisition_code?: string | null
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
  }[]
}

const SUPPLIER_SEARCH_DEBOUNCE_MS = 300
const ITEM_SEARCH_DEBOUNCE_MS = 300

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function Section({
  title, icon, sectionKey, open, onToggle, children,
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
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NovaCotacaoContent />
    </Suspense>
  )
}

function NovaCotacaoContent() {
  const router = useRouter()

  const searchParams = useSearchParams()
  const requisitionId = searchParams.get('requisition_id')

  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState<Date | undefined>()
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [category, setCategory] = useState<string | undefined>()
  const [file, setFile] = useState<File | null>(null)
  const [itemSearch, setItemSearch] = useState('')
  const [itemResults, setItemResults] = useState<QuotationItem[]>([])
  const [itemSearchLoading, setItemSearchLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([])
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([])
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState({ general: true, items: true, suppliers: true })
  const [loading, setLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'draft' | 'submit' | null>(null)
  const [reqDialogOpen, setReqDialogOpen] = useState(false)
  const [requisitions, setRequisitions] = useState<RequisitionOption[]>([])
  const [requisitionsLoading, setRequisitionsLoading] = useState(false)
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([])

  const { userId, companyId, loading: userLoading } = useUser()

  const debouncedItemSearch = useDebounce(itemSearch, ITEM_SEARCH_DEBOUNCE_MS)
  const debouncedSupplierSearch = useDebounce(supplierSearch, SUPPLIER_SEARCH_DEBOUNCE_MS)

  const today = useMemo(() => format(new Date(), 'dd/MM/yyyy', { locale: ptBR }), [])

  useEffect(() => {
    if (!requisitionId || !companyId) return
    const fetchRequisition = async () => {
      const supabase = createClient()
      const [reqRes, itemsRes] = await Promise.all([
        supabase.from('requisitions').select('*').eq('id', requisitionId).single(),
        supabase
          .from('requisition_items')
          .select('*')
          .eq('requisition_id', requisitionId),
      ])

      if (reqRes.data) {
        const reqAny = reqRes.data as any
        setDescription(() => reqAny.title ?? '')
        setCategory(reqAny.commodity_group ?? '')
      }

      if (itemsRes.data && itemsRes.data.length > 0) {
        const reqCode = (reqRes.data as { code?: string } | null)?.code ?? null
        setSelectedItems(
          itemsRes.data.map((ri: any) => ({
            code: ri.material_code ?? '',
            description: ri.material_description ?? '',
            long_description: ri.long_description ?? null,
            quantity: ri.quantity ?? 1,
            unit_of_measure: ri.unit_of_measure ?? '',
            requisition_code: reqCode,
          })),
        )
      }
    }

    fetchRequisition()
  }, [requisitionId, companyId])

  useEffect(() => {
    if (!companyId || debouncedItemSearch.trim().length < 2) {
      setItemResults([])
      setItemSearchLoading(false)
      return
    }
    const run = async () => {
      setItemSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedItemSearch.trim()}%`
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, code, short_description, unit_of_measure, long_description')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .or(`code.ilike.${term},short_description.ilike.${term}`)
          .limit(20)
        if (error) {
          setItemResults([])
          return
        }
        setItemResults(
          (data ?? []).map(
            (i: {
              code: string
              short_description: string
              unit_of_measure: string | null
              long_description: string | null
            }) => ({
              code: i.code,
              description: i.short_description,
              unit_of_measure: i.unit_of_measure ?? '',
              long_description: i.long_description ?? null,
            }),
          ),
        )
      } finally {
        setItemSearchLoading(false)
      }
    }
    void run()
  }, [companyId, debouncedItemSearch])

  useEffect(() => {
    if (!companyId || debouncedSupplierSearch.trim().length < 2) {
      setSupplierResults([])
      setSupplierSearchLoading(false)
      return
    }
    const run = async () => {
      setSupplierSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedSupplierSearch.trim()}%`
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('id, name, cnpj, category')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .or(`name.ilike.${term},cnpj.ilike.${term}`)
          .limit(20)
        if (error) {
          setSupplierResults([])
          return
        }
        setSupplierResults((data as Supplier[]) ?? [])
      } finally {
        setSupplierSearchLoading(false)
      }
    }
    void run()
  }, [companyId, debouncedSupplierSearch])

  const toggle = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))

  const addItem = (item: QuotationItem) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.code === item.code)
        ? prev
        : [...prev, { ...item, quantity: 1, requisition_code: null }],
    )
    setItemSearch('')
  }

  const updateItemQuantity = (code: string, value: string) => {
    setSelectedItems(prev =>
      prev.map((i) => {
        if (i.code !== code) return i
        const n = Number(value)
        return { ...i, quantity: Number.isFinite(n) && n > 0 ? n : 1 }
      }),
    )
  }

  const addSupplier = (s: Supplier) => {
    setSelectedSuppliers(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s])
    setSupplierSearch('')
  }

  async function loadAvailableRequisitions() {
    if (!companyId) return
    setRequisitionsLoading(true)
    try {
      const supabase = createClient()
      const { data: reqs } = await supabase
        .from('requisitions')
        .select('id, code, title, created_at')
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .is('quotation_id', null)
        .order('created_at', { ascending: false })

      if (!reqs || reqs.length === 0) {
        setRequisitions([])
        return
      }

      const { data: allItems } = await supabase
        .from('requisition_items')
        .select('requisition_id, material_code, material_description, unit_of_measure, quantity')
        .in(
          'requisition_id',
          reqs.map((r) => r.id),
        )

      type ReqItemRow = {
        requisition_id: string
        material_code: string | null
        material_description: string
        unit_of_measure: string | null
        quantity: number
      }

      const itemsByReq: Record<string, ReqItemRow[]> = {}
      for (const row of (allItems ?? []) as ReqItemRow[]) {
        if (!itemsByReq[row.requisition_id]) itemsByReq[row.requisition_id] = []
        itemsByReq[row.requisition_id].push(row)
      }

      setRequisitions(
        reqs.map((r) => ({
          id: r.id,
          code: r.code,
          title: r.title,
          created_at: r.created_at,
          items: (itemsByReq[r.id] ?? []).map((i) => ({
            material_code: i.material_code,
            material_description: i.material_description,
            unit_of_measure: i.unit_of_measure,
            quantity: i.quantity,
          })),
        })),
      )
    } finally {
      setRequisitionsLoading(false)
    }
  }

  function handleImportRequisitions() {
    const selected = requisitions.filter((r) => selectedReqIds.includes(r.id))
    setSelectedItems((prev) => {
      const newItems: SelectedItem[] = []
      for (const req of selected) {
        for (const item of req.items) {
          const code = item.material_code ?? ''
          if (
            prev.some((i) => i.code === code) ||
            newItems.some((i) => i.code === code)
          ) {
            continue
          }
          newItems.push({
            code,
            description: item.material_description ?? '',
            unit_of_measure: item.unit_of_measure ?? '',
            long_description: null,
            quantity: item.quantity ?? 1,
            requisition_code: req.code,
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
      }
      return [...prev, ...newItems]
    })

    setReqDialogOpen(false)
    setSelectedReqIds([])
  }

  const saveQuotation = async (status: 'draft' | 'waiting') => {
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('quotations')
        .insert({
          company_id: companyId!,
          description,
          status,
          category: category ?? null,
          response_deadline: deadline ? deadline.toISOString().split('T')[0] : null,
        })
        .select('id, code, status')
        .single()

      if (error) {
        console.error('Erro quotations detalhado:', JSON.stringify(error))
        toast.error('Erro ao salvar cotação. Tente novamente.')
        setLoading(false)
        return
      }

      if (!data) {
        toast.error('Erro ao salvar cotação. Tente novamente.')
        setLoading(false)
        return
      }

      const quotationId = data.id as string

      if (selectedItems.length > 0) {
        const { error: itemsError } = await supabase.from('quotation_items').insert(
          selectedItems.map((item) => ({
            quotation_id: quotationId,
            company_id: companyId!,
            material_code: item.code,
            material_description: item.description,
            long_description: item.long_description ?? null,
            unit_of_measure: item.unit_of_measure,
            quantity: item.quantity,
            complementary_spec: null,
            source_requisition_code: item.requisition_code ?? null,
          })),
        )

        if (itemsError) {
          toast.error('Erro ao salvar itens da cotação. Tente novamente.')
          return
        }
      }

      if (selectedSuppliers.length > 0) {
        const { error: suppliersError } = await supabase.from('quotation_suppliers').insert(
          selectedSuppliers.map((s, index) => ({
            quotation_id: quotationId,
            company_id: companyId!,
            supplier_id: s.id,
            supplier_name: s.name,
            supplier_cnpj: s.cnpj,
            position: index + 1,
          })),
        )

        if (suppliersError) {
          console.error('Erro suppliers:', JSON.stringify(suppliersError))
          toast.error('Erro ao salvar fornecedores da cotação. Tente novamente.')
          return
        }
      }

      if (requisitionId) {
        const { error: reqUpdateError } = await supabase
          .from('requisitions')
          .update({
            status: 'in_quotation',
            quotation_id: quotationId,
          })
          .eq('id', requisitionId)

        if (reqUpdateError) {
          console.error(
            'Erro ao atualizar requisicao para in_quotation:',
            JSON.stringify(reqUpdateError),
          )
        }
      }

      await logAudit({
        eventType: 'quotation.created',
        description: `Cotação ${data.code} criada`,
        companyId: companyId!,
        userId: userId ?? null,
        userName: userId ?? null,
        entity: 'quotations',
        entityId: quotationId,
        metadata: { code: data.code, status: data.status },
      })

      toast.success(
        status === 'draft'
          ? 'Rascunho salvo com sucesso!'
          : 'Cotação enviada com sucesso!',
      )
      router.push('/comprador/cotacoes')
    } catch {
      toast.error('Erro ao salvar cotação. Tente novamente.')
    }
  }

  const handleSubmit = async () => {
    const newErrors = { description: !description.trim(), deadline: !deadline }
    if (newErrors.description || newErrors.deadline) {
      setErrors(newErrors)
      const missing = [newErrors.description && 'Descrição', newErrors.deadline && 'Data Limite'].filter(
        Boolean,
      )
      toast.error(`Preencha os campos obrigatórios: ${missing.join(', ')}`)
      return
    }

    setErrors({})
    setLoading(true)
    setLoadingAction('submit')
    try {
      await saveQuotation('waiting')
    } finally {
      setLoading(false)
      setLoadingAction(null)
    }
  }

  const handleDraft = async () => {
    setErrors({})
    setLoading(true)
    setLoadingAction('draft')
    try {
      await saveQuotation('draft')
    } finally {
      setLoading(false)
      setLoadingAction(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.push('/comprador/cotacoes')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Nova Cotação</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados para criar uma nova cotação</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-11 sm:pl-0">
          <Button type="button" variant="outline" onClick={() => router.push('/comprador/cotacoes')}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDraft}
            disabled={loading || userLoading || !companyId}
          >
            {loading && loadingAction === 'draft' ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || userLoading || !companyId}
          >
            {loading && loadingAction === 'submit' ? 'Salvando...' : 'Enviar Cotação'}
          </Button>
        </div>
      </div>

      {requisitionId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Cotação gerada a partir de uma requisição</p>
            <p className="text-xs text-blue-600">Os campos foram pré-preenchidos com os dados da requisição. Revise e complete antes de enviar.</p>
          </div>
        </div>
      )}

      {/* Seção Dados Gerais */}
      <Section title="Dados gerais" icon={<FileText className="h-4 w-4 text-primary" />} sectionKey="general" open={open.general} onToggle={toggle}>
        <div className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>ID da Cotação</Label>
              <Input disabled placeholder="Gerado automaticamente" className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição <span className="text-primary">*</span></Label>
              <Input
                placeholder="Descreva o objetivo desta cotação"
                value={description}
                onChange={e => { setDescription(e.target.value); setErrors(p => ({ ...p, description: false })) }}
                className={errors.description ? 'border-destructive ring-1 ring-destructive/30' : ''}
              />
              {errors.description && <p className="text-xs text-destructive">Campo obrigatório</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Data de Criação</Label>
              <Input disabled value={today} className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Data Limite de Resposta <span className="text-primary">*</span></Label>
              <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`w-full justify-between font-normal ${errors.deadline ? 'border-destructive ring-1 ring-destructive/30' : ''}`}
                  >
                    {deadline ? format(deadline, 'dd/MM/yyyy') : <span className="text-muted-foreground">Selecione uma data</span>}
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={d => { setDeadline(d); setErrors(p => ({ ...p, deadline: false })); if (d) setDeadlineOpen(false) }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.deadline && <p className="text-xs text-destructive">Campo obrigatório</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {['MRO', 'Matéria-Prima', 'Serviços', 'TI', 'Outros'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Anexo</Label>
              <Input type="file" accept=".pdf,image/*" onChange={e => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
              {file && <p className="text-xs text-muted-foreground">Selecionado: {file.name}</p>}
            </div>
          </div>
        </div>
      </Section>

      {/* Seção Itens */}
      <Section title="Itens" icon={<Package className="h-4 w-4 text-primary" />} sectionKey="items" open={open.items} onToggle={toggle}>
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
                setReqDialogOpen(true)
                void loadAvailableRequisitions()
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
                onChange={e => setItemSearch(e.target.value)}
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
                  itemResults.map(item => (
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
                {selectedItems.map(item => (
                  <tr key={item.code} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 align-top font-medium">{item.code}</td>
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
                    <td className="px-2 py-2 align-top">{item.unit_of_measure}</td>
                    <td className="px-2 py-2 align-top">
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateItemQuantity(item.code, e.target.value)} className="w-20" />
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedItems(p => p.filter(i => i.code !== item.code))}>
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
      <Section title="Fornecedores" icon={<Building2 className="h-4 w-4 text-primary" />} sectionKey="suppliers" open={open.suppliers} onToggle={toggle}>
        <div className="space-y-3 pt-2">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ do fornecedor..."
                value={supplierSearch}
                onChange={e => setSupplierSearch(e.target.value)}
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
                  supplierResults.map(s => (
                    <li
                      key={s.id}
                      onClick={() => addSupplier(s)}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.cnpj ?? '—'}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.category ?? '—'}</span>
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
                {selectedSuppliers.map(s => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">{s.name}</td>
                    <td className="px-2 py-2">{s.cnpj ?? '—'}</td>
                    <td className="px-2 py-2">{s.category ?? '—'}</td>
                    <td className="px-2 py-2 text-right">
                      <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedSuppliers(p => p.filter(x => x.id !== s.id))}>
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
                    if (e.key === 'Enter' || e.key === ' ') {
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
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30'
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
                          {format(new Date(req.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {req.items.length} item(s):{' '}
                        {req.items
                          .slice(0, 3)
                          .map((i) => i.material_description)
                          .join(', ')}
                        {req.items.length > 3 && ` +${req.items.length - 3} mais`}
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
                  : 'Selecione as requisições para importar'}
              </span>
              <Button type="button" variant="outline" onClick={() => setReqDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleImportRequisitions}
                disabled={selectedReqIds.length === 0}
              >
                Importar {selectedReqIds.length > 0 ? `(${selectedReqIds.length})` : ''}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}