"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { notifyWithEmail } from "@/lib/notify-with-email"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { Trash2, Plus, ChevronLeft, Paperclip, PackageSearch, X } from "lucide-react"

type Priority = "normal" | "urgent" | "critical"

type CatalogItem = {
  id: string
  code: string
  short_description: string
  long_description: string | null
  unit_of_measure: string | null
  commodity_group: string | null
}

type RequisitionLineItem = {
  id: string
  itemId: string
  materialCode: string
  materialDescription: string
  unitOfMeasure: string
  commodityGroup: string
  quantity: number
  observations: string
}

type RequisitionDraftForm = {
  title: string
  description: string
  costCenter: string
  neededBy: string
  priority: Priority
}

type AttachedFile = {
  id: string
  file: File
}

const ACCEPTED_FILE_TYPES = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
const DEBOUNCE_MS = 400

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

export default function NovaRequisicaoPage() {
  const router = useRouter()
  const { companyId, userId } = useUser()
  const { hasPermission, loading: permissionsLoading } = usePermissions()

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [form, setForm] = React.useState<RequisitionDraftForm>({
    title: "",
    description: "",
    costCenter: "",
    neededBy: "",
    priority: "normal",
  })

  const [items, setItems] = React.useState<RequisitionLineItem[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<CatalogItem[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_MS)

  const [attachments, setAttachments] = React.useState<AttachedFile[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canCreate = hasPermission("requisition.create")

  React.useEffect(() => {
    if (!companyId || debouncedSearch.length < 2) {
      setSearchResults([])
      return
    }
    const run = async () => {
      setSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedSearch.replace(/"/g, '\\"')}%`
      const quoted = `"${term}"`
      const { data, error } = await supabase
        .from("items")
        .select("id, code, short_description, long_description, unit_of_measure, commodity_group")
        .eq("company_id", companyId)
        .or(`code.ilike.${quoted},short_description.ilike.${quoted}`)
        .limit(20)

      setSearchLoading(false)
      if (error) {
        setSearchResults([])
        return
      }
      setSearchResults((data as CatalogItem[]) ?? [])
    }
    run()
  }, [companyId, debouncedSearch])

  const addItem = (item: CatalogItem) => {
    if (items.some((i) => i.itemId === item.id)) return
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemId: item.id,
        materialCode: item.code,
        materialDescription: item.short_description,
        unitOfMeasure: item.unit_of_measure ?? "",
        commodityGroup: item.commodity_group ?? "",
        quantity: 1,
        observations: "",
      },
    ])
  }

  const updateItem = (itemId: string, patch: Partial<RequisitionLineItem>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
  }

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const accepted = Array.from(files).filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase()
      return [".pdf", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"].includes(ext)
    })
    setAttachments((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: crypto.randomUUID(), file })),
    ])
    e.target.value = ""
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSubmit = async () => {
    setError(null)
    if (!companyId || !userId) return

    if (!form.title.trim()) {
      setError("Título é obrigatório.")
      return
    }

    if (items.length === 0) {
      toast.error("Adicione ao menos um item antes de criar a requisição.")
      return
    }

    if (attachments.length > 0) {
      console.log("Anexos (upload futuro):", attachments.map((a) => a.file.name))
    }
    // TODO: upload para Supabase Storage

    const supabase = createClient()
    setLoading(true)
    try {
      const { data: profileRes } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single()

      const requesterName = (profileRes as { full_name?: string } | null)?.full_name ?? ""
      const costCenterTrimmed = (form.costCenter ?? "").trim()
      const costCenterForInsert = costCenterTrimmed || null

      const { data: requisitionRes, error: requisitionErr } = await supabase
        .from("requisitions")
        .insert({
          company_id: companyId,
          status: "pending",
          origin: "manual",
          requester_id: userId,
          requester_name: requesterName,
          title: form.title.trim(),
          description: form.description.trim() || null,
          cost_center: costCenterForInsert,
          needed_by: form.neededBy ? new Date(`${form.neededBy}T00:00:00`).toISOString() : null,
          priority: form.priority,
        })
        .select("id, code")
        .single()

      if (requisitionErr || !requisitionRes) {
        setError("Não foi possível criar a requisição.")
        return
      }

      const requisitionId = (requisitionRes as { id: string }).id
      const requisitionCode = (requisitionRes as { code: string }).code

      const payloadItems = items.map((it) => ({
        requisition_id: requisitionId,
        company_id: companyId,
        material_code: (it.materialCode ?? "").trim() || null,
        material_description: it.materialDescription.trim(),
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_of_measure: (it.unitOfMeasure ?? "").trim() || null,
        commodity_group: (it.commodityGroup ?? "").trim() || null,
        observations: (it.observations ?? "").trim() || null,
      }))

      const { error: itemsErr } = await supabase
        .from("requisition_items")
        .insert(payloadItems)

      if (itemsErr) {
        setError("Não foi possível salvar os itens da requisição.")
        return
      }

      logAudit({
        eventType: "quotation.created",
        description: `Requisição ${requisitionCode} criada`,
        companyId,
        userId,
        userName: requesterName,
        entity: "requisitions",
        entityId: requisitionId,
      }).catch(() => {})

      try {
        const costCenterForRpc = costCenterTrimmed || ""

        const { data: tfRow } = await supabase
          .from("tenant_features")
          .select("enabled")
          .eq("company_id", companyId)
          .eq("feature_key", "approval_requisition")
          .maybeSingle()

        const enabled = (tfRow as { enabled?: boolean } | null)?.enabled ?? false

        if (!enabled) {
          await supabase
            .from("requisitions")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
              approver_name: "Aprovação automática (fluxo desabilitado)",
            })
            .eq("id", requisitionId)
          void notifyWithEmail({
            userId,
            companyId,
            type: "requisition.approved",
            title: "Requisição aprovada automaticamente",
            body: `Sua requisição ${requisitionCode} foi aprovada e está disponível para cotação.`,
            entity: "requisition",
            entityId: requisitionId,
            subject: `Requisição Aprovada — ${requisitionCode}`,
            html: `<p>Sua requisição <strong>${requisitionCode}</strong> foi aprovada automaticamente.</p>
         <p>Ela já está disponível para abertura de cotação.</p>`,
            emailPrefKey: "order_approved_email",
          })
          router.push("/comprador/requisicoes")
          return
        }

        const { data: approverData } = await supabase.rpc(
          "get_approver_for_requisition",
          {
            p_company_id: companyId,
            p_cost_center: costCenterForRpc,
          },
        )

        const firstRow = Array.isArray(approverData) ? approverData[0] : approverData
        const approverId = (firstRow as { approver_id?: string | null } | null)?.approver_id ?? null
        const approverName = (firstRow as { approver_name?: string | null } | null)?.approver_name ?? null

        if (!approverId) {
          await supabase
            .from("requisitions")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
              approver_name: "Aprovação automática (sem regra configurada para este CC)",
            })
            .eq("id", requisitionId)
          void notifyWithEmail({
            userId,
            companyId,
            type: "requisition.approved",
            title: "Requisição aprovada automaticamente",
            body: `Sua requisição ${requisitionCode} foi aprovada e está disponível para cotação.`,
            entity: "requisition",
            entityId: requisitionId,
            subject: `Requisição Aprovada — ${requisitionCode}`,
            html: `<p>Sua requisição <strong>${requisitionCode}</strong> foi aprovada automaticamente.</p>
         <p>Ela já está disponível para abertura de cotação.</p>`,
            emailPrefKey: "order_approved_email",
          })
          router.push("/comprador/requisicoes")
          return
        }

        const { data: approvers } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("company_id", companyId)
          .eq("status", "active")
          .contains("roles", ["approver_requisition"])

        for (const approver of approvers ?? []) {
          void notifyWithEmail({
            userId: approver.id,
            companyId,
            type: "requisition.created",
            title: "Nova requisição aguardando aprovação",
            body: `A requisição ${requisitionCode} foi criada por ${requesterName} e aguarda sua aprovação.`,
            entity: "requisition",
            entityId: requisitionId,
            subject: `Nova Requisição — ${requisitionCode}`,
            html: `<p>Olá, <strong>${approver.full_name ?? "Aprovador"}</strong>!</p>
           <p>A requisição <strong>${requisitionCode}</strong> foi criada por <strong>${requesterName}</strong> e aguarda sua aprovação.</p>`,
            emailPrefKey: "new_requisition_email",
          })
        }

        await supabase
          .from("requisitions")
          .update({
            approver_id: approverId,
            approver_name: approverName,
            status: "pending",
          })
          .eq("id", requisitionId)

        await supabase.from("approval_requests").insert({
          company_id: companyId,
          flow: "requisition",
          entity_id: requisitionId,
          approver_id: approverId,
          approver_name: approverName,
          status: "pending",
        })

        router.push("/comprador/requisicoes")
      } catch (approvalErr) {
        toast.error(
          "Requisição criada, mas houve erro ao configurar aprovação. Contate o administrador."
        )
        router.push("/comprador/requisicoes")
      }
    } finally {
      setLoading(false)
    }
  }

  if (permissionsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/requisicoes")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Nova Requisição</h1>
            <p className="text-muted-foreground">Criação manual</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!canCreate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/requisicoes")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Nova Requisição</h1>
            <p className="text-muted-foreground">—</p>
          </div>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Sem permissão para criar requisições.
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/comprador/requisicoes")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nova Requisição</h1>
              <p className="text-muted-foreground">Criação manual</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/comprador/requisicoes")}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Salvando..." : "Criar Requisição"}
            </Button>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dados Gerais</CardTitle>
            <p className="text-sm text-muted-foreground">Criação manual de requisição de compra.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 grid-rows-[auto_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Título</Label>
                <div className="relative pb-5">
                  <Input
                    id="title"
                    value={form.title}
                    maxLength={100}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value.slice(0, 100) }))
                    }
                    placeholder="Ex: Materiais para manutenção"
                  />
                  <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                    {form.title.length}/100
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="costCenter">Centro de Custo</Label>
                <Input
                  id="costCenter"
                  value={form.costCenter}
                  onChange={(e) => setForm((f) => ({ ...f, costCenter: e.target.value }))}
                  placeholder="Ex: CC-001"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Descrição</Label>
                <div className="relative pb-5">
                  <Textarea
                    id="description"
                    rows={4}
                    className="h-[100px] resize-none"
                    value={form.description}
                    maxLength={500}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value.slice(0, 500) }))
                    }
                    placeholder="Descrição opcional da requisição"
                  />
                  <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                    {form.description.length}/500
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-4 items-stretch">
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <Label htmlFor="neededBy">Data de Necessidade</Label>
                    <Input
                      id="neededBy"
                      type="date"
                      value={form.neededBy}
                      onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
                      className="w-40"
                    />
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens Solicitados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={searchTerm ? "pr-20" : "pr-10"}
              />
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchTerm("")}
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {searchTerm.length >= 2 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-10"
                  role="listbox"
                >
                  {searchLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Buscando...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum item encontrado
                    </div>
                  ) : (
                    <ul className="py-2">
                      {searchResults.map((item) => {
                        const isAdded = items.some((i) => i.itemId === item.id)
                        return (
                          <li
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50"
                          >
                            {isAdded ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button type="button" variant="ghost" size="icon" disabled className="shrink-0">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Já adicionado</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Button
                                type="button"
                                variant="default"
                                size="icon"
                                onClick={() => addItem(item)}
                                className="shrink-0"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                              <span className="ml-2 text-sm text-foreground">{item.short_description}</span>
                              {item.unit_of_measure && (
                                <span className="ml-2 text-xs text-muted-foreground">({item.unit_of_measure})</span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {items.length} item(ns) adicionado(s)
            </p>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <PackageSearch className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Nenhum item adicionado. Use a busca acima para adicionar materiais.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição Curta</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead>Grupo de Mercadoria</TableHead>
                      <TableHead className="w-28">Quantidade</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">{it.materialCode}</TableCell>
                        <TableCell className="text-sm">{it.materialDescription}</TableCell>
                        <TableCell className="text-center text-sm">{it.unitOfMeasure || "—"}</TableCell>
                        <TableCell className="text-sm">{it.commodityGroup || "—"}</TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => updateItem(it.id, { quantity: Math.max(1, Number(e.target.value) || 0) })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="align-top relative pb-5">
                          <Input
                            value={it.observations}
                            maxLength={300}
                            onChange={(e) =>
                              updateItem(it.id, {
                                observations: e.target.value.slice(0, 300),
                              })
                            }
                            placeholder="Opcional"
                            className="h-8"
                          />
                          <p className="absolute bottom-0 right-2 text-[10px] text-muted-foreground">
                            {(it.observations ?? "").length}/300
                          </p>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(it.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Anexos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm text-muted-foreground">
                Clique ou arraste arquivos aqui (PDF, Excel, imagens)
              </p>
            </button>
            {attachments.length > 0 && (
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{a.file.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatFileSize(a.file.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAttachment(a.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </TooltipProvider>
  )
}
