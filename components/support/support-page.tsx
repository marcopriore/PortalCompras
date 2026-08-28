"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Eye, Headphones, Plus, RefreshCw } from "lucide-react"
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
import { TableRowActions } from "@/components/ui/table-row-actions"
import { AttachmentFileList } from "@/components/support/attachment-file-list"
import { CharacterCounter } from "@/components/support/character-counter"
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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR })
}

export function SupportPage({ portal }: SupportPageProps) {
  const router = useRouter()
  const detailBase =
    portal === "comprador" ? "/comprador/suporte" : "/solicitante/suporte"

  const [tickets, setTickets] = React.useState<AxisDeskChamado[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string[]>([])

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] =
    React.useState<CreateFormState>(INITIAL_CREATE_FORM)
  const [creating, setCreating] = React.useState(false)

  const [categorias, setCategorias] = React.useState<AxisDeskCategoria[]>([])
  const [categoriasLoading, setCategoriasLoading] = React.useState(false)

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

  const loadCategorias = React.useCallback(async (tipo: AxisDeskChamadoTipo) => {
    setCategoriasLoading(true)
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
        setCategorias([])
        return
      }
      setCategorias(payload.data ?? [])
    } catch {
      toast.error("Erro ao carregar categorias.")
      setCategorias([])
    } finally {
      setCategoriasLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  React.useEffect(() => {
    if (!createOpen) return
    void loadCategorias(createForm.tipo)
  }, [createOpen, createForm.tipo, loadCategorias])

  const filteredTickets = React.useMemo(() => {
    if (statusFilter.length === 0) return tickets
    return tickets.filter((t) => statusFilter.includes(t.status))
  }, [tickets, statusFilter])

  const selectedCategoria = React.useMemo(
    () => categorias.find((c) => c.id === createForm.categoriaId) ?? null,
    [categorias, createForm.categoriaId],
  )

  const subcategorias = selectedCategoria?.subcategorias ?? []

  const canSubmitCreate =
    createForm.titulo.trim().length > 0 &&
    createForm.titulo.length <= AXISDESK_MAX_TITULO &&
    createForm.descricao.trim().length > 0 &&
    createForm.descricao.length <= AXISDESK_MAX_TEXTO &&
    createForm.categoriaId.length > 0 &&
    createForm.subcategoriaId.length > 0 &&
    !creating &&
    !categoriasLoading

  const resetCreateForm = () => {
    setCreateForm(INITIAL_CREATE_FORM)
    setCategorias([])
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chamados do tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <MultiSelectFilter
              label="Status"
              width="w-48"
              options={AXISDESK_STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Carregando chamados…
                    </TableCell>
                  </TableRow>
                ) : filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Nenhum chamado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium max-w-[240px] truncate">
                        {ticket.titulo}
                      </TableCell>
                      <TableCell className="capitalize">
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
                      <TableCell>{formatDateTime(ticket.sla_prazo)}</TableCell>
                      <TableCell>{formatDateTime(ticket.created_at)}</TableCell>
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
                disabled={categoriasLoading || categorias.length === 0}
              >
                <SelectTrigger id="categoria">
                  <SelectValue
                    placeholder={
                      categoriasLoading
                        ? "Carregando categorias…"
                        : "Selecione a categoria"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
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
