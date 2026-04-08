'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import MultiSelectFilter from '@/components/ui/multi-select-filter'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  SearchX,
  Upload,
  X,
} from 'lucide-react'

type SupplierStatus = 'active' | 'inactive'

type Supplier = {
  id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  category: string | null
  city: string | null
  state: string | null
  status: SupplierStatus
  created_at: string
}

type ImportPreviewRow = {
  code: string
  name: string
  cnpj: string
  email: string
  phone: string
  category: string
  city: string
  state: string
  status: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0284c7',
] as const

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

export default function FornecedoresPage() {
  const { companyId, loading: userLoading, hasRole, isSuperAdmin } = useUser()

  const isMasterAdmin = isSuperAdmin || hasRole('admin')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLDivElement>(null)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const [erpSyncOpen, setErpSyncOpen] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const loadSuppliers = useCallback(async () => {
    if (!companyId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('suppliers')
        .select(
          'id, code, name, cnpj, email, phone, category, city, state, status, created_at',
        )
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar fornecedores:', error)
        toast.error('Erro ao carregar fornecedores.')
        return
      }

      const list = (data as Supplier[]) ?? []
      setSuppliers(list)

      const supplierIds = list.map((s) => s.id)
      let orderCountMap: Record<string, number> = {}
      if (supplierIds.length > 0) {
        const { data: orderCountsData } = await supabase
          .from('purchase_orders')
          .select('supplier_id')
          .eq('company_id', companyId)
          .in('supplier_id', supplierIds)

        orderCountMap = (orderCountsData ?? []).reduce(
          (acc, o: { supplier_id: string | null }) => {
            if (o.supplier_id) acc[o.supplier_id] = (acc[o.supplier_id] ?? 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )
      }
      setOrderCounts(orderCountMap)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  const categories = useMemo(() => {
    const set = new Set<string>()
    suppliers.forEach((s) => {
      if (s.category) {
        set.add(s.category)
      }
    })
    return Array.from(set).sort()
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch =
        !search ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase())

      const matchCategory = categoryFilter.length === 0 || (s.category != null && categoryFilter.includes(s.category))
      const matchStatus = statusFilter.length === 0 || statusFilter.includes(s.status)

      return matchSearch && matchCategory && matchStatus
    })
  }, [suppliers, search, categoryFilter, statusFilter])

  async function handleExportSuppliers() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Fornecedores')

    ws.columns = [
      { header: 'codigo_erp', key: 'codigo_erp', width: 15 },
      { header: 'nome', key: 'nome', width: 40 },
      { header: 'cnpj', key: 'cnpj', width: 20 },
      { header: 'email', key: 'email', width: 35 },
      { header: 'telefone', key: 'telefone', width: 20 },
      { header: 'categoria', key: 'categoria', width: 25 },
      { header: 'cidade', key: 'cidade', width: 20 },
      { header: 'estado', key: 'estado', width: 10 },
      { header: 'status', key: 'status', width: 10 },
      { header: 'pedidos', key: 'pedidos', width: 10 },
    ]

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F3EF5' },
    }

    for (const s of suppliers) {
      ws.addRow({
        codigo_erp: s.code,
        nome: s.name,
        cnpj: s.cnpj ?? '',
        email: s.email ?? '',
        telefone: s.phone ?? '',
        categoria: s.category ?? '',
        cidade: s.city ?? '',
        estado: s.state ?? '',
        status: s.status === 'active' ? 'ativo' : 'inativo',
        pedidos: orderCounts[s.id] ?? 0,
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fornecedores_valore_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Fornecedores')

    ws.columns = [
      { header: 'codigo_erp', key: 'codigo_erp', width: 15 },
      { header: 'nome', key: 'nome', width: 40 },
      { header: 'cnpj', key: 'cnpj', width: 20 },
      { header: 'email', key: 'email', width: 35 },
      { header: 'telefone', key: 'telefone', width: 20 },
      { header: 'categoria', key: 'categoria', width: 25 },
      { header: 'cidade', key: 'cidade', width: 20 },
      { header: 'estado', key: 'estado', width: 10 },
      { header: 'status', key: 'status', width: 10 },
    ]

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F3EF5' },
    }

    ws.addRow({
      codigo_erp: 'FOR-001',
      nome: 'Fornecedor Exemplo Ltda',
      cnpj: '00.000.000/0001-00',
      email: 'contato@fornecedor.com.br',
      telefone: '(11) 99999-0000',
      categoria: 'Mecânica',
      cidade: 'São Paulo',
      estado: 'SP',
      status: 'ativo',
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_fornecedores_valore.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(file: File) {
    setImportFile(file)
    setImportErrors([])
    setImportPreview([])

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const buffer = await file.arrayBuffer()
    await wb.xlsx.load(buffer)
    const ws = wb.worksheets[0]

    const rows: ImportPreviewRow[] = []
    const errors: string[] = []

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const values = row.values as (string | number | undefined)[]
      const obj: ImportPreviewRow = {
        code: String(values[1] ?? '').trim(),
        name: String(values[2] ?? '').trim(),
        cnpj: String(values[3] ?? '').trim(),
        email: String(values[4] ?? '').trim(),
        phone: String(values[5] ?? '').trim(),
        category: String(values[6] ?? '').trim(),
        city: String(values[7] ?? '').trim(),
        state: String(values[8] ?? '').trim(),
        status: String(values[9] ?? '')
          .trim()
          .toLowerCase(),
      }

      const isEmptyRow =
        !obj.code &&
        !obj.name &&
        !obj.cnpj &&
        !obj.email &&
        !obj.phone &&
        !obj.category &&
        !obj.city &&
        !obj.state &&
        !obj.status
      if (isEmptyRow) return

      if (!obj.code) errors.push(`Linha ${rowNumber}: código ERP obrigatório`)
      if (!obj.name) errors.push(`Linha ${rowNumber}: nome obrigatório`)
      if (!['ativo', 'inativo'].includes(obj.status)) {
        errors.push(`Linha ${rowNumber}: status deve ser "ativo" ou "inativo"`)
      }

      rows.push(obj)
    })

    setImportPreview(rows)
    setImportErrors(errors)
    setImportStep('preview')
  }

  async function handleImport() {
    if (!companyId || importPreview.length === 0) return
    const supabase = createClient()

    setImporting(true)

    for (const row of importPreview) {
      const { error } = await supabase
        .from('suppliers')
        .upsert(
          {
            company_id: companyId,
            code: row.code,
            name: row.name,
            cnpj: row.cnpj || null,
            email: row.email || null,
            phone: row.phone || null,
            category: row.category || null,
            city: row.city || null,
            state: row.state || null,
            status: row.status === 'ativo' ? 'active' : 'inactive',
          },
          { onConflict: 'company_id,code' },
        )

      if (error) {
        console.error('import supplier:', row.code, error)
      }
    }

    setImporting(false)
    setImportStep('done')
    await loadSuppliers()
  }

  return (
    <div className="space-y-6">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-xl p-5 flex items-center gap-4 border border-blue-100 bg-blue-50">
          <div className="rounded-full bg-blue-100 p-3 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total de Fornecedores</p>
            <p className="text-3xl font-bold text-blue-700">{suppliers.length}</p>
          </div>
        </div>
        <div className="rounded-xl p-5 flex items-center gap-4 border border-green-100 bg-green-50">
          <div className="rounded-full bg-green-100 p-3 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Fornecedores Ativos</p>
            <p className="text-3xl font-bold text-green-700">
              {suppliers.filter((s) => s.status === 'active').length}
            </p>
          </div>
        </div>
      </div>

      {/* Cabeçalho da lista */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lista de Fornecedores</h2>
          <p className="text-sm text-muted-foreground">
            Base sincronizada via ERP. Somente leitura.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {filteredSuppliers.length} fornecedor
            {filteredSuppliers.length !== 1 ? 'es' : ''}
          </Badge>
          <Button variant="outline" size="sm" type="button" onClick={() => void handleExportSuppliers()}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Base
          </Button>
          {isMasterAdmin && (
            <Button variant="outline" size="sm" type="button" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Excel
            </Button>
          )}
          <Button variant="outline" size="sm" type="button" onClick={() => setErpSyncOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sincronizar ERP
          </Button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col w-full md:max-w-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Buscar
          </p>
          <div ref={searchInputRef} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome do fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  ;(searchInputRef.current?.querySelector('input') as HTMLInputElement)?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Categoria
          </p>
          <MultiSelectFilter
            label="Categoria"
            options={categories.map((c) => ({ value: c, label: c }))}
            selected={categoryFilter}
            onChange={setCategoryFilter}
            width="w-44"
          />
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Status
          </p>
          <MultiSelectFilter
            label="Status"
            options={[
              { value: "active", label: "Ativo" },
              { value: "inactive", label: "Inativo" },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
            width="w-40"
          />
        </div>
      </div>

      {/* Estados especiais e tabela */}
      {userLoading || loading ? (
        <p className="text-sm text-muted-foreground">Carregando fornecedores...</p>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Nenhum fornecedor cadastrado.</p>
            <p className="text-xs text-muted-foreground">
              Os fornecedores são sincronizados via ERP.
            </p>
          </div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Nenhum fornecedor encontrado.</p>
            <p className="text-xs text-muted-foreground">
              Ajuste os filtros ou a busca para ver outros resultados.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-3 py-2">Código ERP</TableHead>
                <TableHead className="px-3 py-2">Fornecedor</TableHead>
                <TableHead className="px-3 py-2">Categoria</TableHead>
                <TableHead className="px-3 py-2">Localização</TableHead>
                <TableHead className="px-3 py-2">Status</TableHead>
                <TableHead className="px-3 py-2 text-center">Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer border-border hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedSupplier(s)}
                >
                  <TableCell className="px-3 py-2 align-top font-mono text-sm text-muted-foreground">
                    {s.code}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(s.name) }}
                      >
                        {getInitials(s.name)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.cnpj || '-'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-muted-foreground">
                    {s.category || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-muted-foreground">
                    {s.city && s.state ? `${s.city}, ${s.state}` : s.city || s.state || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <Badge
                      variant={s.status === 'active' ? 'default' : 'destructive'}
                      className={
                        s.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : undefined
                      }
                    >
                      {s.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top text-center text-sm text-muted-foreground">
                    {orderCounts[s.id] ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!selectedSupplier}
        onOpenChange={(open) => {
          if (!open) setSelectedSupplier(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Código ERP</p>
                  <p className="text-sm font-medium">{selectedSupplier.code || '—'}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">CNPJ</p>
                  <p className="text-sm">{selectedSupplier.cnpj || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">E-mail</p>
                  <p className="text-sm">{selectedSupplier.email || '—'}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Telefone</p>
                  <p className="text-sm">{selectedSupplier.phone || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Categoria</p>
                  <p className="text-sm">{selectedSupplier.category || '—'}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Localização</p>
                  <p className="text-sm">
                    {[selectedSupplier.city, selectedSupplier.state].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                  <p className="text-sm">{selectedSupplier.status === 'active' ? 'Ativo' : 'Inativo'}</p>
                </div>
                <div className="grid gap-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Pedidos</p>
                  <p className="text-sm">{orderCounts[selectedSupplier.id] ?? 0}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedSupplier(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={erpSyncOpen} onOpenChange={setErpSyncOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sincronizar com ERP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  Integração ERP não configurada
                </p>
                <p className="text-sm text-amber-700">
                  Este tenant não possui integração com ERP ativa.
                  Configure a integração no Portal Admin ou
                  utilize a importação via Excel para atualizar a base de fornecedores.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setErpSyncOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) {
            setImportStep('upload')
            setImportFile(null)
            setImportPreview([])
            setImportErrors([])
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Fornecedores via Excel</DialogTitle>
          </DialogHeader>

          {importStep === 'upload' && (
            <div className="space-y-4">
              <Button variant="outline" size="sm" type="button" onClick={() => void handleDownloadTemplate()}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Template
              </Button>
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) void handleFileChange(file)
                }}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste o arquivo Excel ou
                </p>
                <label className="mt-2 cursor-pointer text-sm font-medium text-primary underline">
                  clique para selecionar
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleFileChange(file)
                    }}
                  />
                </label>
              </div>
              {importFile ? (
                <p className="text-xs text-muted-foreground text-center">
                  Arquivo: {importFile.name}
                </p>
              ) : null}
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4">
              {importErrors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700 mb-1">
                    {importErrors.length} erro(s) encontrado(s):
                  </p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {importErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importErrors.length > 5 && (
                      <li>...e mais {importErrors.length - 5} erro(s)</li>
                    )}
                  </ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {importPreview.length} fornecedor(es) encontrado(s) no arquivo.
                {importErrors.length > 0 && ' Corrija os erros antes de importar.'}
              </p>
              <div className="max-h-48 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Código ERP</th>
                      <th className="px-2 py-1 text-left">Nome</th>
                      <th className="px-2 py-1 text-left">Categoria</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{row.code}</td>
                        <td className="px-2 py-1">{row.name}</td>
                        <td className="px-2 py-1">{row.category}</td>
                        <td className="px-2 py-1">{row.status}</td>
                      </tr>
                    ))}
                    {importPreview.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={4} className="px-2 py-1 text-muted-foreground">
                          ...e mais {importPreview.length - 10} fornecedor(es)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setImportStep('upload')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={importing || importErrors.length > 0}
                >
                  {importing ? 'Importando...' : `Importar ${importPreview.length} fornecedor(es)`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === 'done' && (
            <div className="space-y-4 py-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm font-medium">Importação concluída!</p>
              <DialogFooter className="justify-center">
                <Button
                  type="button"
                  onClick={() => {
                    setImportOpen(false)
                    setImportStep('upload')
                  }}
                >
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
