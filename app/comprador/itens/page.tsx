'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import MultiSelectFilter from '@/components/ui/multi-select-filter'
import {
  AlertTriangle,
  Check,
  Download,
  Info,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react'

type Item = {
  id: string
  company_id?: string
  code: string
  short_description: string
  long_description: string | null
  status: 'active' | 'inactive'
  unit_of_measure: string | null
  ncm: string | null
  commodity_group: string | null
  created_at: string
  source?: string | null
  sync_at?: string | null
}

type ImportPreviewRow = {
  code: string
  short_description: string
  long_description: string
  unit_of_measure: string
  ncm: string
  commodity_group: string
  status: string
}

export default function ItensPage() {
  const { companyId, loading: userLoading, hasRole, isSuperAdmin } = useUser()

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLDivElement>(null)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [groupFilter, setGroupFilter] = useState<string[]>([])

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  const [erpSyncOpen, setErpSyncOpen] = useState(false)

  const canImportExcel = isSuperAdmin || hasRole('admin')

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload')

  const totalItems = items.length
  const activeItems = useMemo(
    () => items.filter((i) => i.status === 'active').length,
    [items],
  )

  const lastSync = useMemo(() => {
    const withSync = items.filter((i) => i.sync_at).map((i) => i.sync_at as string)
    return withSync.sort().at(-1) ?? null
  }, [items])

  const commodityGroups = useMemo(() => {
    const groups = new Set<string>()
    items.forEach((item) => {
      if (item.commodity_group) {
        groups.add(item.commodity_group)
      }
    })
    return Array.from(groups).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter.length > 0 && !statusFilter.includes(item.status)) {
        return false
      }
      if (groupFilter.length > 0 && (item.commodity_group == null || !groupFilter.includes(item.commodity_group))) {
        return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const long = (item.long_description ?? '').toLowerCase()
      return (
        item.code.toLowerCase().includes(q) ||
        item.short_description.toLowerCase().includes(q) ||
        long.includes(q)
      )
    })
  }, [items, statusFilter, groupFilter, search])

  const loadItems = useCallback(async () => {
    if (!companyId) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('items')
        .select(
          'id, company_id, code, short_description, long_description, status, unit_of_measure, ncm, commodity_group, source, sync_at, created_at',
        )
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar itens:', error)
        toast.error('Erro ao carregar itens.')
        return
      }

      setItems((data as Item[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function handleDownloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Itens')

    ws.columns = [
      { header: 'codigo', key: 'codigo', width: 15 },
      { header: 'descricao_curta', key: 'descricao_curta', width: 40 },
      { header: 'descricao_detalhada', key: 'descricao_detalhada', width: 60 },
      { header: 'unidade_medida', key: 'unidade_medida', width: 15 },
      { header: 'ncm', key: 'ncm', width: 15 },
      { header: 'grupo_mercadoria', key: 'grupo_mercadoria', width: 25 },
      { header: 'status', key: 'status', width: 10 },
    ]

    ws.addRow({
      codigo: 'MAT-001',
      descricao_curta: 'Parafuso M8x30',
      descricao_detalhada: 'Parafuso sextavado M8x30mm aço inox',
      unidade_medida: 'UN',
      ncm: '73181500',
      grupo_mercadoria: 'Mecânica',
      status: 'ativo',
    })

    const headerRow = ws.getRow(1)
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F3EF5' },
    }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_itens_valore.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportItems() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Itens')

    ws.columns = [
      { header: 'codigo', key: 'codigo', width: 15 },
      { header: 'descricao_curta', key: 'descricao_curta', width: 40 },
      { header: 'descricao_detalhada', key: 'descricao_detalhada', width: 60 },
      { header: 'unidade_medida', key: 'unidade_medida', width: 15 },
      { header: 'ncm', key: 'ncm', width: 15 },
      { header: 'grupo_mercadoria', key: 'grupo_mercadoria', width: 25 },
      { header: 'status', key: 'status', width: 10 },
      { header: 'origem', key: 'origem', width: 15 },
      { header: 'ultima_sincronizacao', key: 'ultima_sincronizacao', width: 25 },
    ]

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F3EF5' },
    }

    for (const item of items) {
      ws.addRow({
        codigo: item.code,
        descricao_curta: item.short_description,
        descricao_detalhada: item.long_description ?? '',
        unidade_medida: item.unit_of_measure ?? '',
        ncm: item.ncm ?? '',
        grupo_mercadoria: item.commodity_group ?? '',
        status: item.status === 'active' ? 'ativo' : 'inativo',
        origem:
          item.source === 'erp'
            ? 'Integração ERP'
            : item.source === 'excel'
              ? 'Importação Excel'
              : 'Cadastro Manual',
        ultima_sincronizacao: item.sync_at
          ? format(new Date(item.sync_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
          : '',
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `itens_valore_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
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
        short_description: String(values[2] ?? '').trim(),
        long_description: String(values[3] ?? '').trim(),
        unit_of_measure: String(values[4] ?? '').trim(),
        ncm: String(values[5] ?? '').trim(),
        commodity_group: String(values[6] ?? '').trim(),
        status: String(values[7] ?? '')
          .trim()
          .toLowerCase(),
      }

      const isEmptyRow =
        !obj.code &&
        !obj.short_description &&
        !obj.long_description &&
        !obj.unit_of_measure &&
        !obj.ncm &&
        !obj.commodity_group &&
        !obj.status
      if (isEmptyRow) return

      if (!obj.code) errors.push(`Linha ${rowNumber}: código obrigatório`)
      if (!obj.short_description) errors.push(`Linha ${rowNumber}: descrição curta obrigatória`)
      if (!obj.unit_of_measure) errors.push(`Linha ${rowNumber}: unidade de medida obrigatória`)
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Sessão inválida.')
      return
    }

    setImporting(true)
    let success = 0
    let errorCount = 0
    const errorDetails: string[] = []

    for (const row of importPreview) {
      const { error } = await supabase
        .from('items')
        .upsert(
          {
            company_id: companyId,
            code: row.code,
            short_description: row.short_description,
            long_description: row.long_description || null,
            unit_of_measure: row.unit_of_measure,
            ncm: row.ncm || null,
            commodity_group: row.commodity_group || null,
            status: row.status === 'ativo' ? 'active' : 'inactive',
            source: 'excel',
            sync_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,code' },
        )

      if (error) {
        errorCount++
        errorDetails.push(`${row.code}: ${error.message}`)
      } else {
        success++
      }
    }

    const { error: logErr } = await supabase.from('item_import_logs').insert({
      company_id: companyId,
      imported_by: user.id,
      source: 'excel',
      total_rows: importPreview.length,
      success,
      errors: errorCount,
      error_details: errorDetails,
    })

    if (logErr) {
      console.error('item_import_logs:', logErr)
    }

    setImporting(false)
    setImportStep('done')
    await loadItems()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Itens</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro de materiais
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Última atualização:{' '}
              {format(new Date(lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          )}
          {canImportExcel && (
            <Button variant="outline" size="sm" type="button" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Excel
            </Button>
          )}
          <Button variant="outline" size="sm" type="button" onClick={() => void handleExportItems()}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Base
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => setErpSyncOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sincronizar ERP
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total de Itens</p>
          <p className="mt-2 text-2xl font-semibold">{totalItems}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Itens Ativos</p>
          <p className="mt-2 text-2xl font-semibold">{activeItems}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-col w-full md:max-w-xs">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Buscar
          </p>
          <div ref={searchInputRef} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:max-w-xs pl-9 pr-8"
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
        <div className="flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-1 block">
            Grupo de mercadoria
          </p>
          <MultiSelectFilter
            label="Grupo"
            options={commodityGroups.map((g) => ({ value: g, label: g }))}
            selected={groupFilter}
            onChange={setGroupFilter}
            width="w-44"
          />
        </div>
      </div>

      {userLoading || loading ? (
        <p className="text-sm text-muted-foreground">Carregando itens...</p>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhum item cadastrado.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Descrição Curta</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Unidade</th>
                <th className="px-3 py-2 text-left">NCM</th>
                <th className="px-3 py-2 text-left">Grupo de Mercadoria</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <React.Fragment key={item.id}>
                  <tr
                    className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedItemId(expandedItemId === item.id ? null : item.id)
                    }
                  >
                    <td className="px-3 py-2 align-top font-medium">{item.code}</td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex items-start gap-1">
                        <span>{item.short_description}</span>
                        {item.long_description ? (
                          <span title={item.long_description} className="inline-flex shrink-0 mt-0.5">
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge variant={item.status === 'active' ? 'default' : 'outline'}>
                        {item.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {item.unit_of_measure ?? '-'}
                    </td>
                    <td className="px-3 py-2 align-top">{item.ncm ?? '-'}</td>
                    <td className="px-3 py-2 align-top">
                      {item.commodity_group ?? '-'}
                    </td>
                  </tr>
                  {expandedItemId === item.id && (
                    <tr className="bg-muted/30">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Descrição Detalhada:
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {item.long_description || 'Sem descrição detalhada cadastrada.'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  utilize a importação via Excel para atualizar o catálogo.
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
            <DialogTitle>Importar Itens via Excel</DialogTitle>
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
                {importPreview.length} item(s) encontrado(s) no arquivo.
                {importErrors.length > 0 && ' Corrija os erros antes de importar.'}
              </p>
              <div className="max-h-48 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Código</th>
                      <th className="px-2 py-1 text-left">Descrição</th>
                      <th className="px-2 py-1 text-left">Unidade</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{row.code}</td>
                        <td className="px-2 py-1">{row.short_description}</td>
                        <td className="px-2 py-1">{row.unit_of_measure}</td>
                        <td className="px-2 py-1">{row.status}</td>
                      </tr>
                    ))}
                    {importPreview.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={4} className="px-2 py-1 text-muted-foreground">
                          ...e mais {importPreview.length - 10} item(s)
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
                  {importing ? 'Importando...' : `Importar ${importPreview.length} item(s)`}
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
