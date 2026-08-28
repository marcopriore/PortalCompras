"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Download, Eye, Headphones, Plus, RefreshCw, X } from "lucide-react"
import { formatDateTimeBR } from "@/lib/formato-data"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import MultiSelectFilter from "@/components/ui/multi-select-filter"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { TABLE_PAGE_SIZE, TablePagination } from "@/components/ui/table-pagination"
import { TableRowActions } from "@/components/ui/table-row-actions"
import { AttachmentFileList } from "@/components/support/attachment-file-list"
import { CharacterCounter } from "@/components/support/character-counter"
import { exportSupportTicketsExcel } from "@/lib/axisdesk/export-support-tickets"
import {
  applySupportListFilters,
  buildSupportListSearchParams,
  getCategoriaFilterOptions,
  getResponsavelFilterOptions,
  hasActiveSupportListFilters,
  parseSupportListFilters,
  sanitizeCategoriaFilter,
  type SupportListFilters,
} from "@/lib/axisdesk/support-list-filters"
import type {
  AxisDeskAnexo,
  AxisDeskCategoria,
  AxisDeskChamado,
  AxisDeskChamadoPrioridade,
  AxisDeskChamadoTipo,
} from "@/lib/axisdesk/types"
import {
  AXISDESK_MAX_TEXTO,
  AXISDESK_MAX_TITULO,
  filesToAnexos,
  mergeSelectedFiles,
  removeSelectedFile,
} from "@/lib/axisdesk/support-form"
import {
  AXISDESK_PRIORIDADE_OPTIONS,
  AXISDESK_STATUS_OPTIONS,
  AXISDESK_TIPO_OPTIONS,
  getAxisDeskPrioridadeLabel,
  getAxisDeskStatusLabel,
  getAxisDeskStatusVariant,
} from "@/lib/axisdesk/types"

type SupportPageProps = {
  portal: "comprador" | "solicitante"
}

type CreateFormState = {
  tipo: AxisDeskChamadoTipo
  categoriaId: string
  subcategoriaId: string
  titulo: string
  descricao: string
  prioridade: AxisDeskChamadoPrioridade
  anexos: File[]
}

const INITIAL_CREATE_FORM: CreateFormState = {
  tipo: "incidente",
  categoriaId: "",
  subcategoriaId: "",
  titulo: "",
  descricao: "",
  prioridade: "media",
  anexos: [],
}

const TABLE_COL_COUNT = 9

export function SupportPage({ portal }: SupportPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const detailBase =
    portal === "comprador" ? "/comprador/suporte" : "/solicitante/suporte"

  const filters = React.useMemo(
    () => parseSupportListFilters(searchParams),
    [searchParams],
  )

  const [tickets, setTickets] = React.useState<AxisDeskChamado[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] =
    React.useState<CreateFormState>(INITIAL_CREATE_FORM)
  const [creating, setCreating] = React.useState(false)

  const [createCategorias, setCreateCategorias] = React.useState<AxisDeskCategoria[]>([])
  const [createCategoriasLoading, setCreateCategoriasLoading] =
    React.useState(false)
  const [filterCategorias, setFilterCategorias] = React.useState<AxisDeskCategoria[]>(
    [],
  )

  const [qDraft, setQDraft] = React.useState(filters.q)

  React.useEffect(() => {
    setQDraft(filters.q)
  }, [filters.q])

  const replaceFilters = React.useCallback(
    (patch: Partial<SupportListFilters>) => {
      const shouldResetPage = !("page" in patch)
      let next: SupportListFilters = {
        ...filters,
        ...patch,
        page: shouldResetPage ? 1 : (patch.page ?? filters.page),
      }

      if (patch.tipo !== undefined) {
        next.categoria = sanitizeCategoriaFilter(
          next.categoria,
          filterCategorias,
          next.tipo,
        )
      }

      const qs = buildSupportListSearchParams(next).toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [filters, filterCategorias, pathname, router],
  )

  const replaceFiltersRef = React.useRef(replaceFilters)
  replaceFiltersRef.current = replaceFilters

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (qDraft === filters.q) return
      replaceFiltersRef.current({ q: qDraft })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [qDraft, filters.q])

  const loadTickets = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch("/api/support/tickets", { cache: "no-store" })
      const payload = (await res.json()) as {
        data?: AxisDeskChamado[]
        error?: string
      }
      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao carregar chamados.")
        setTickets([])
        return
      }
      setTickets(payload.data ?? [])
    } catch {
      toast.error("Erro ao carregar chamados.")
      setTickets([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const loadFilterCategorias = React.useCallback(async () => {
    try {
      const res = await fetch("/api/support/categorias", { cache: "no-store" })
      const payload = (await res.json()) as {
        data?: AxisDeskCategoria[]
        error?: string
      }
      if (!res.ok) {
        setFilterCategorias([])
        return
      }
      setFilterCategorias(payload.data ?? [])
    } catch {
      setFilterCategorias([])
    }
  }, [])

  const loadCreateCategorias = React.useCallback(async (tipo: AxisDeskChamadoTipo) => {
    setCreateCategoriasLoading(true)
    try {
      const res = await fetch(`/api/support/categorias?tipo=${tipo}`, {
        cache: "no-store",
      })
      const payload = (await res.json()) as {
        data?: AxisDeskCategoria[]
        error?: string
      }
      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao carregar categorias.")
        setCreateCategorias([])
        return
      }
      setCreateCategorias(payload.data ?? [])
    } catch {
      toast.error("Erro ao carregar categorias.")
      setCreateCategorias([])
    } finally {
      setCreateCategoriasLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadTickets()
    void loadFilterCategorias()
  }, [loadTickets, loadFilterCategorias])

  React.useEffect(() => {
    if (!createOpen) return
    void loadCreateCategorias(createForm.tipo)
  }, [createOpen, createForm.tipo, loadCreateCategorias])

  const filteredTickets = React.useMemo(
    () => applySupportListFilters(tickets, filters),
    [tickets, filters],
  )

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTickets.length / TABLE_PAGE_SIZE),
  )
  const currentPage = Math.min(Math.max(filters.page, 1), totalPages)

  const paginatedTickets = React.useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE
    return filteredTickets.slice(start, start + TABLE_PAGE_SIZE)
  }, [filteredTickets, currentPage])

  const categoriaFilterOptions = React.useMemo(
    () => getCategoriaFilterOptions(filterCategorias, filters.tipo),
    [filterCategorias, filters.tipo],
  )

  const responsavelFilterOptions = React.useMemo(
    () => getResponsavelFilterOptions(tickets),
    [tickets],
  )

  const selectedCreateCategoria = React.useMemo(
    () => createCategorias.find((c) => c.id === createForm.categoriaId) ?? null,
    [createCategorias, createForm.categoriaId],
  )

  const subcategorias = selectedCreateCategoria?.subcategorias ?? []

  const canSubmitCreate =
    createForm.titulo.trim().length > 0 &&
    createForm.titulo.length <= AXISDESK_MAX_TITULO &&
    createForm.descricao.trim().length > 0 &&
    createForm.descricao.length <= AXISDESK_MAX_TEXTO &&
    createForm.categoriaId.length > 0 &&
    createForm.subcategoriaId.length > 0 &&
    !creating &&
    !createCategoriasLoading

  const resetCreateForm = () => {
    setCreateForm(INITIAL_CREATE_FORM)
    setCreateCategorias([])
  }

  const handleTipoChange = (tipo: AxisDeskChamadoTipo) => {
    setCreateForm((f) => ({
      ...f,
      tipo,
      categoriaId: "",
      subcategoriaId: "",
    }))
  }

  const handleCreate = async () => {
    if (!canSubmitCreate) return

    setCreating(true)
    try {
      let anexos: AxisDeskAnexo[] | undefined
      if (createForm.anexos.length > 0) {
        anexos = await filesToAnexos(createForm.anexos)
      }

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: createForm.tipo,
          categoria_id: createForm.categoriaId,
          subcategoria_id: createForm.subcategoriaId,
          titulo: createForm.titulo.trim(),
          descricao: createForm.descricao.trim(),
          prioridade: createForm.prioridade,
          contexto_origem: `Portal ${portal === "comprador" ? "Comprador" : "Solicitante"}`,
          ...(anexos ? { anexos } : {}),
        }),
      })

      const payload = (await res.json()) as {
        data?: AxisDeskChamado
        error?: string
      }

      if (!res.ok) {
        toast.error(payload.error ?? "Erro ao criar chamado.")
        return
      }

      toast.success("Chamado criado com sucesso.")
      setCreateOpen(false)
      resetCreateForm()
      await loadTickets(true)
      if (payload.data?.id) {
        router.push(`${detailBase}/${payload.data.id}`)
      }
    } catch {
      toast.error("Erro ao criar chamado.")
    } finally {
      setCreating(false)
    }
  }

  const handleExportExcel = async () => {
    if (filteredTickets.length === 0) return
    setExporting(true)
    try {
      await exportSupportTicketsExcel(filteredTickets)
      toast.success("Planilha exportada com sucesso.")
    } catch {
      toast.error("Erro ao exportar planilha.")
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setQDraft("")
    router.replace(pathname, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            Suporte
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abra e acompanhe chamados com a equipe AxisStrategy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadTickets(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo chamado
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base">Chamados do tenant</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredTickets.length} resultado(s)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting || loading || filteredTickets.length === 0}
              onClick={() => void handleExportExcel()}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportando…" : "Exportar Excel"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col w-48 shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Título
                </p>
                <div className="relative">
                  <Input
                    placeholder="Buscar por título…"
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    className="pr-8"
                  />
                  {qDraft.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQDraft("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Tipo
                </p>
                <MultiSelectFilter
                  label="Tipo"
                  width="w-40"
                  options={AXISDESK_TIPO_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  selected={filters.tipo}
                  onChange={(values) => replaceFilters({ tipo: values })}
                />
              </div>

              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Status
                </p>
                <MultiSelectFilter
                  label="Status"
                  width="w-48"
                  options={AXISDESK_STATUS_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  selected={filters.status}
                  onChange={(values) => replaceFilters({ status: values })}
                />
              </div>

              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Prioridade
                </p>
                <MultiSelectFilter
                  label="Prioridade"
                  width="w-40"
                  options={AXISDESK_PRIORIDADE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  selected={filters.prioridade}
                  onChange={(values) => replaceFilters({ prioridade: values })}
                />
              </div>

              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Categoria
                </p>
                <MultiSelectFilter
                  label="Categoria"
                  width="w-48"
                  options={categoriaFilterOptions}
                  selected={filters.categoria}
                  onChange={(values) => replaceFilters({ categoria: values })}
                />
              </div>

              <div className="flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Responsável
                </p>
                <MultiSelectFilter
                  label="Responsável"
                  width="w-48"
                  options={responsavelFilterOptions}
                  selected={filters.responsavel}
                  onChange={(values) => replaceFilters({ responsavel: values })}
                />
              </div>

              <div className="flex flex-col w-40 shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  SLA de
                </p>
                <Input
                  type="date"
                  value={filters.slaDe}
                  onChange={(e) => replaceFilters({ slaDe: e.target.value })}
                />
              </div>
              <div className="flex flex-col w-40 shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  SLA até
                </p>
                <Input
                  type="date"
                  value={filters.slaAte}
                  onChange={(e) => replaceFilters({ slaAte: e.target.value })}
                />
              </div>
              <div className="flex flex-col w-40 shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Criado de
                </p>
                <Input
                  type="date"
                  value={filters.criadoDe}
                  onChange={(e) => replaceFilters({ criadoDe: e.target.value })}
                />
              </div>
              <div className="flex flex-col w-40 shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Criado até
                </p>
                <Input
                  type="date"
                  value={filters.criadoAte}
                  onChange={(e) => replaceFilters({ criadoAte: e.target.value })}
                />
              </div>
            </div>

            {hasActiveSupportListFilters(filters) && (
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={TABLE_COL_COUNT}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Carregando chamados…
                    </TableCell>
                  </TableRow>
                ) : paginatedTickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={TABLE_COL_COUNT}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhum chamado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium max-w-[220px] truncate">
                        {ticket.titulo}
                      </TableCell>
                      <TableCell>
                        {AXISDESK_TIPO_OPTIONS.find((o) => o.value === ticket.tipo)
                          ?.label ?? ticket.tipo}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={getAxisDeskStatusVariant(ticket.status)}>
                          {getAxisDeskStatusLabel(ticket.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {getAxisDeskPrioridadeLabel(ticket.prioridade)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {ticket.categoria?.nome ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {ticket.solicitante?.nome ?? "—"}
                      </TableCell>
                      <TableCell>{formatDateTimeBR(ticket.sla_prazo, true)}</TableCell>
                      <TableCell>{formatDateTimeBR(ticket.created_at, true)}</TableCell>
                      <TableCell className="text-right">
                        <TableRowActions
                          actions={[
                            {
                              label: "Ver Detalhes",
                              icon: Eye,
                              href: `${detailBase}/${ticket.id}`,
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              page={currentPage}
              total={filteredTickets.length}
              onPageChange={(page) => replaceFilters({ page })}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={createForm.tipo}
                onValueChange={(v) => handleTipoChange(v as AxisDeskChamadoTipo)}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXISDESK_TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={createForm.categoriaId || undefined}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    categoriaId: v,
                    subcategoriaId: "",
                  }))
                }
                disabled={createCategoriasLoading || createCategorias.length === 0}
              >
                <SelectTrigger id="categoria">
                  <SelectValue
                    placeholder={
                      createCategoriasLoading
                        ? "Carregando categorias…"
                        : "Selecione a categoria"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {createCategorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategoria">Subcategoria</Label>
              <Select
                value={createForm.subcategoriaId || undefined}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, subcategoriaId: v }))
                }
                disabled={!createForm.categoriaId || subcategorias.length === 0}
              >
                <SelectTrigger id="subcategoria">
                  <SelectValue placeholder="Selecione a subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  {subcategorias.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={createForm.titulo}
                maxLength={AXISDESK_MAX_TITULO}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, titulo: e.target.value }))
                }
                placeholder="Resumo do problema ou solicitação"
              />
              <CharacterCounter
                current={createForm.titulo.length}
                max={AXISDESK_MAX_TITULO}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={createForm.descricao}
                maxLength={AXISDESK_MAX_TEXTO}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, descricao: e.target.value }))
                }
                rows={4}
                placeholder="Descreva com o máximo de detalhes possível"
              />
              <CharacterCounter
                current={createForm.descricao.length}
                max={AXISDESK_MAX_TEXTO}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={createForm.prioridade}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    prioridade: v as AxisDeskChamadoPrioridade,
                  }))
                }
              >
                <SelectTrigger id="prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXISDESK_PRIORIDADE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anexos">Anexos (opcional)</Label>
              <Input
                id="anexos"
                type="file"
                multiple
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    anexos: mergeSelectedFiles(f.anexos, e.target.files),
                  }))
                }
              />
              <AttachmentFileList
                files={createForm.anexos}
                onRemove={(index) =>
                  setCreateForm((f) => ({
                    ...f,
                    anexos: removeSelectedFile(f.anexos, index),
                  }))
                }
                disabled={creating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!canSubmitCreate}
            >
              {creating ? "Enviando…" : "Criar chamado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
