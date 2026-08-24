"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { notifyWithEmail } from "@/lib/notify-with-email"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ChevronLeft, Plus, Trash2, X, Paperclip, PackageSearch } from "lucide-react"
import {
  CostCenterSelect,
  loadUserDefaultCostCenterCode,
} from "@/components/ui/cost-center-select"

const DEBOUNCE_MS = 400
const ACCEPTED_FILE_TYPES = ".pdf,.xlsx,.xls,.jpg,.jpeg,.png"

type CatalogItem = {
  id: string
  code: string
  short_description: string
  long_description: string | null
  unit_of_measure: string | null
  commodity_group: string | null
}

type LineItem = {
  id: string
  itemId: string
  materialCode: string
  materialDescription: string
  unitOfMeasure: string
  commodityGroup: string
  quantity: number
  observations: string
}

type AttachedFile = {
  id: string
  file: File
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SolicitanteNovaPage() {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [companyId, setCompanyId] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userName, setUserName] = React.useState<string>("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Dados gerais
  const [title, setTitle] = React.useState("")
  const [costCenter, setCostCenter] = React.useState("")
  const [neededBy, setNeededBy] = React.useState("")
  const [priority, setPriority] = React.useState<"normal" | "urgent" | "critical">("normal")
  const [description, setDescription] = React.useState("")

  // Itens
  const [items, setItems] = React.useState<LineItem[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<CatalogItem[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_MS)
  const searchContainerRef = React.useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Anexos
  const [attachments, setAttachments] = React.useState<AttachedFile[]>([])

  // Carregar usuário
  React.useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, full_name, profile_type")
        .eq("id", user.id)
        .single()
      if (!profile || profile.profile_type !== "requester") {
        window.location.href = "/login"
        return
      }
      setUserId(user.id)
      setCompanyId(profile.company_id)
      setUserName(profile.full_name ?? "")
      const defaultCc = await loadUserDefaultCostCenterCode(user.id)
      if (defaultCc) setCostCenter(defaultCc)
    }
    void run()
  }, [])

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  // Busca no catálogo
  React.useEffect(() => {
    if (!companyId || debouncedSearch.length < 2) {
      setSearchResults([])
      return
    }
    const run = async () => {
      setSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedSearch.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
      const { data, error: searchError } = await supabase
        .from("items")
        .select("id, code, short_description, long_description, unit_of_measure, commodity_group")
        .eq("company_id", companyId)
        .or(`code.ilike.${term},short_description.ilike.${term}`)
        .limit(20)
      setSearchLoading(false)
      if (searchError) {
        setSearchResults([])
        return
      }
      setSearchResults((data as CatalogItem[]) ?? [])
    }
    void run()
  }, [companyId, debouncedSearch])

  function addItem(item: CatalogItem) {
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
    setSearchOpen(false)
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setAttachments(prev => [
      ...prev,
      ...files.map(file => ({ id: crypto.randomUUID(), file }))
    ])
    e.target.value = ""
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  async function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError("Título é obrigatório."); return }
    if (!costCenter.trim()) { setError("Centro de custo é obrigatório."); return }
    if (items.length === 0) { setError("Adicione ao menos um item."); return }
    if (!companyId || !userId) return

    setSaving(true)
    const supabase = createClient()

    // Gerar código
    const { count } = await supabase
      .from("requisitions")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
    const code = `REQ-${String((count ?? 0) + 1).padStart(4, "0")}`

    const { data: reqData, error: reqError } = await supabase
      .from("requisitions")
      .insert({
        company_id: companyId,
        code,
        title: title.trim(),
        description: description.trim() || null,
        cost_center: costCenter.trim() || null,
        needed_by: neededBy || null,
        priority,
        status: "pending",
        origin: "manual",
        requester_id: userId,
        requester_name: userName,
      })
      .select("id, code")
      .single()

    if (reqError || !reqData) {
      setError("Erro ao criar requisição. Tente novamente.")
      setSaving(false)
      return
    }

    const requisitionId = reqData.id
    const requisitionCode = reqData.code

    void logAudit({
      eventType: "requisition.created",
      description: `Requisição ${reqData.code} criada por ${userName || "solicitante"}`,
      companyId,
      userId,
      userName: userName || null,
      entity: "requisitions",
      entityId: reqData.id,
      metadata: {
        code: reqData.code,
        priority,
        cost_center: costCenter || null,
      },
    })

    // Inserir itens
    const { error: itemsErr } = await supabase.from("requisition_items").insert(
      items.map(item => ({
        requisition_id: requisitionId,
        company_id: companyId,
        material_code: item.materialCode || null,
        material_description: item.materialDescription,
        quantity: item.quantity,
        unit_of_measure: item.unitOfMeasure || null,
        commodity_group: item.commodityGroup || null,
        observations: item.observations || null,
      }))
    )

    if (itemsErr) {
      setError("Não foi possível salvar os itens da requisição.")
      setSaving(false)
      return
    }

    try {
      const costCenterForRpc = costCenter.trim() || ""

      const { data: tfRow } = await supabase
        .from("tenant_features")
        .select("enabled")
        .eq("company_id", companyId)
        .eq("feature_key", "approval_requisition")
        .maybeSingle()

      const approvalEnabled =
        (tfRow as { enabled?: boolean } | null)?.enabled ?? false

      if (!approvalEnabled) {
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
          emailPrefKey: "requisition_approval_email",
        })
        router.push(`/solicitante/${requisitionId}`)
        return
      }

      const { data: approverData } = await supabase.rpc(
        "get_approver_for_requisition",
        {
          p_company_id: companyId,
          p_cost_center: costCenterForRpc,
        }
      )

      const firstRow = Array.isArray(approverData)
        ? approverData[0]
        : approverData
      const approverId =
        (firstRow as { approver_id?: string | null } | null)?.approver_id ?? null
      const approverName =
        (firstRow as { approver_name?: string | null } | null)?.approver_name ?? null

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
          emailPrefKey: "requisition_approval_email",
        })
        router.push(`/solicitante/${requisitionId}`)
        return
      }

      const { data: approvers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", companyId)
        .eq("status", "active")
        .or("role.eq.approver_requisition,roles.cs.{approver_requisition}")

      for (const approver of approvers ?? []) {
        void notifyWithEmail({
          userId: approver.id,
          companyId,
          type: "requisition.created",
          title: "Nova requisição aguardando aprovação",
          body: `A requisição ${requisitionCode} foi criada por ${userName || "solicitante"} e aguarda sua aprovação.`,
          entity: "requisition",
          entityId: requisitionId,
          subject: `Nova Requisição — ${requisitionCode}`,
          html: `<p>Olá, <strong>${approver.full_name ?? "Aprovador"}</strong>!</p>
           <p>A requisição <strong>${requisitionCode}</strong> foi criada por <strong>${userName || "solicitante"}</strong> e aguarda sua aprovação.</p>`,
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

      router.push(`/solicitante/${requisitionId}`)
    } catch {
      toast.error(
        "Requisição criada, mas houve erro ao configurar aprovação. Contate o administrador."
      )
      router.push(`/solicitante/${requisitionId}`)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/solicitante")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nova Requisição</h1>
              <p className="text-sm text-muted-foreground">
                Preencha os dados da solicitação
              </p>
            </div>
          </div>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Enviando..." : "Enviar Requisição"}
          </Button>
        </div>

        {/* Dados Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Título *</Label>
                <span className="text-xs text-muted-foreground">{title.length}/100</span>
              </div>
              <Input
                placeholder="Descreva brevemente a solicitação"
                value={title}
                maxLength={100}
                onChange={e => setTitle(e.target.value.slice(0, 100))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CostCenterSelect
                companyId={companyId}
                value={costCenter}
                onChange={setCostCenter}
                required
              />
              <div className="space-y-2">
                <Label>Data de Necessidade</Label>
                <Input
                  type="date"
                  value={neededBy}
                  onChange={e => setNeededBy(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={priority}
                  onValueChange={v => setPriority(v as "normal" | "urgent" | "critical")}
                >
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descrição</Label>
                <span className="text-xs text-muted-foreground">{description.length}/500</span>
              </div>
              <Textarea
                placeholder="Informações adicionais sobre a solicitação..."
                value={description}
                maxLength={500}
                onChange={e => setDescription(e.target.value.slice(0, 500))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens Solicitados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative" ref={searchContainerRef}>
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                className={searchTerm ? "pr-20" : "pr-10"}
              />
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => {
                    setSearchTerm("")
                    setSearchResults([])
                    setSearchOpen(false)
                  }}
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {searchOpen && searchTerm.length >= 2 && (
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
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled
                                    className="shrink-0"
                                  >
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
                              <span className="font-mono text-xs text-muted-foreground">
                                {item.code}
                              </span>
                              <span className="ml-2 text-sm text-foreground">
                                {item.short_description}
                              </span>
                              {item.unit_of_measure && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({item.unit_of_measure})
                                </span>
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
                        <TableCell className="text-center text-sm">
                          {it.unitOfMeasure || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{it.commodityGroup || "—"}</TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.id, {
                                quantity: Math.max(1, Number(e.target.value) || 0),
                              })
                            }
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

        {/* Anexos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="h-4 w-4" />
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
              className="w-full border-2 border-dashed border-border rounded-xl p-8
                         text-center hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm text-muted-foreground">
                Clique ou arraste arquivos aqui (PDF, Excel, imagens)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Os arquivos serão enviados junto com a requisição
              </p>
            </button>
            {attachments.length > 0 && (
              <ul className="space-y-2">
                {attachments.map(a => (
                  <li key={a.id}
                    className="flex items-center justify-between gap-2 text-sm
                               rounded-lg border border-border px-3 py-2">
                    <span className="truncate">{a.file.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatFileSize(a.file.size)}
                    </span>
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => removeAttachment(a.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10
                          p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <Button variant="outline" className="flex-1"
            onClick={() => router.push("/solicitante")}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Enviando..." : "Enviar Requisição"}
          </Button>
        </div>

      </div>
    </TooltipProvider>
  )
}
