"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"
import { toast } from "sonner"
import { CostCenterSelect } from "@/components/ui/cost-center-select"

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
  TooltipProvider,
} from "@/components/ui/tooltip"

import { ChevronLeft, Paperclip, Send, AlertTriangle, X } from "lucide-react"
import { RequisitionLineItemsSection } from "@/components/requisitions/requisition-line-items-section"
import {
  buildAccountConfigsFromRequisitionItems,
  REQUISITION_ITEM_ACCOUNT_SELECT,
  validateRequisitionLineSiteCodes,
  type RequisitionEditorLineItem,
  type LoadedRequisitionItemRow,
} from "@/lib/requisitions/line-items-helpers"
import {
  validateAllAccountConfigsForSubmit,
  type ItemAccountConfigEdit,
  type ItemAccountConfigFieldErrors,
} from "@/lib/po-account-assignment"
import { saveRequisitionAccountConfigs } from "@/lib/requisition-account-assignment-persist"
import { useImplantationConfig } from "@/lib/hooks/use-implantation-config"

type Priority = "normal" | "urgent" | "critical"

type CatalogItem = {
  id: string
  code: string
  short_description: string
  long_description: string | null
  unit_of_measure: string | null
  commodity_group: string | null
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

type RequisitionItemRow = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  commodity_group: string | null
  observations: string | null
}

const ACCEPTED_FILE_TYPES = ".pdf,.xlsx,.xls,.png,.jpg,.jpeg"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateForInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

export default function EditarRequisicaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = React.use(params)
  const { companyId, userId, loading: userLoading } = useUser()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { accountAssignmentEnabled } = useImplantationConfig()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [drafting, setDrafting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState<string | null>(null)
  const [requisitionCode, setRequisitionCode] = React.useState<string>("")
  const [currentStatus, setCurrentStatus] = React.useState<"draft" | "rejected" | null>(null)

  const [form, setForm] = React.useState<RequisitionDraftForm>({
    title: "",
    description: "",
    costCenter: "",
    neededBy: "",
    priority: "normal",
  })

  const [items, setItems] = React.useState<RequisitionEditorLineItem[]>([])
  const [accountConfigs, setAccountConfigs] = React.useState<
    Record<string, ItemAccountConfigEdit>
  >({})
  const [accountConfigErrors, setAccountConfigErrors] = React.useState<
    Record<string, ItemAccountConfigFieldErrors>
  >({})
  const [siteCodeFieldErrors, setSiteCodeFieldErrors] = React.useState<Record<string, boolean>>({})

  const [attachments, setAttachments] = React.useState<AttachedFile[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canCreate = hasPermission("requisition.create.buyer")

  React.useEffect(() => {
    if (userLoading || !companyId || !id) return
    const supabase = createClient()
    let alive = true

    const run = async () => {
      setLoading(true)
      const [rRes, iRes] = await Promise.all([
        supabase.from("requisitions").select("*").eq("id", id).single(),
        supabase
          .from("requisition_items")
          .select(REQUISITION_ITEM_ACCOUNT_SELECT)
          .eq("requisition_id", id)
          .order("created_at"),
      ])

      if (!alive) return

      const reqData = rRes.data as {
        id: string
        code: string
        title: string
        description: string | null
        cost_center: string | null
        needed_by: string | null
        priority: Priority
        status: string
        rejection_reason: string | null
        origin: string | null
      } | null

      if (!reqData) {
        router.push(`/comprador/requisicoes/${id}`)
        return
      }

      if (reqData.status !== "rejected" && reqData.status !== "draft") {
        router.push(`/comprador/requisicoes/${id}`)
        return
      }

      setCurrentStatus(reqData.status === "draft" ? "draft" : "rejected")
      setRequisitionCode(reqData.code)
      setRejectionReason(reqData.rejection_reason ?? null)
      setForm({
        title: reqData.title ?? "",
        description: reqData.description ?? "",
        costCenter: reqData.cost_center ?? "",
        neededBy: formatDateForInput(reqData.needed_by),
        priority: (reqData.priority as Priority) ?? "normal",
      })

      const reqItems = (iRes.data ?? []) as Array<
        RequisitionItemRow & LoadedRequisitionItemRow
      >
      let itemsData: CatalogItem[] = []
      if (reqItems.length > 0 && companyId) {
        const materialCodes = [...new Set(reqItems.map((r) => r.material_code).filter((c): c is string => Boolean(c)))]
        if (materialCodes.length > 0) {
          const { data } = await supabase
            .from("items")
            .select("id, code, short_description, long_description, unit_of_measure, commodity_group")
            .eq("company_id", companyId)
            .in("code", materialCodes)
          itemsData = (data ?? []) as CatalogItem[]
        }

        const itemMap = new Map<string, CatalogItem>()
        itemsData.forEach((item) => {
          itemMap.set(item.code, item)
        })

        const lineItems: RequisitionEditorLineItem[] = reqItems.map((ri) => {
          const catalogItem = ri.material_code ? itemMap.get(ri.material_code) : null
          return {
            id: ri.id,
            itemId: catalogItem?.id ?? `legacy-${ri.id}`,
            materialCode: ri.material_code ?? "",
            materialDescription: ri.material_description ?? "",
            unitOfMeasure: catalogItem?.unit_of_measure ?? ri.unit_of_measure ?? "",
            commodityGroup: catalogItem?.commodity_group ?? ri.commodity_group ?? "",
            quantity: ri.quantity ?? 1,
            observations: ri.observations ?? "",
            siteCode: ri.site_code ?? "",
          }
        })
        setItems(lineItems)
        setAccountConfigs(buildAccountConfigsFromRequisitionItems(reqItems))
      } else {
        setItems([])
        setAccountConfigs({})
      }

      setLoading(false)
    }

    run()
    return () => {
      alive = false
    }
  }, [companyId, id, router, userLoading])

  const handleAccountConfigChange = (_itemId: string, _config: ItemAccountConfigEdit) => {
    setAccountConfigErrors((prev) => {
      if (!prev[_itemId]) return prev
      const next = { ...prev }
      delete next[_itemId]
      return next
    })
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

  const handleSaveDraft = async () => {
    setError(null)
    if (!companyId || !userId || !id) return
    if (currentStatus !== "draft") return

    if (!form.title.trim()) {
      setError("Título é obrigatório.")
      return
    }
    if (!(form.costCenter ?? "").trim()) {
      setError("Centro de custo é obrigatório.")
      return
    }

    const supabase = createClient()
    setDrafting(true)
    try {
      const costCenterTrimmed = (form.costCenter ?? "").trim()
      const { error: updateErr } = await supabase
        .from("requisitions")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          cost_center: costCenterTrimmed || null,
          priority: form.priority,
          needed_by: form.neededBy || null,
          status: "draft",
        })
        .eq("id", id)

      if (updateErr) {
        toast.error(updateErr.message?.trim() || "Erro ao salvar rascunho.")
        return
      }

      const { error: deleteItemsErr } = await supabase
        .from("requisition_items")
        .delete()
        .eq("requisition_id", id)

      if (deleteItemsErr) {
        toast.error(deleteItemsErr.message?.trim() || "Erro ao atualizar itens.")
        return
      }

      if (items.length > 0) {
        const payloadItems = items.map((it) => ({
          id: it.id,
          requisition_id: id,
          company_id: companyId,
          material_code: (it.materialCode ?? "").trim() || null,
          material_description: it.materialDescription.trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit_of_measure: (it.unitOfMeasure ?? "").trim() || null,
          commodity_group: (it.commodityGroup ?? "").trim() || null,
          observations: (it.observations ?? "").trim() || null,
          site_code: it.siteCode,
        }))
        const { error: insertItemsErr } = await supabase
          .from("requisition_items")
          .insert(payloadItems)
        if (insertItemsErr) {
          toast.error(insertItemsErr.message?.trim() || "Erro ao salvar os itens da requisição.")
          return
        }

        const accountResult = await saveRequisitionAccountConfigs(
          supabase,
          companyId,
          accountConfigs,
        )
        if (!accountResult.ok) {
          toast.error(accountResult.message)
          return
        }
      }

      void logAudit({
        eventType: "requisition.draft_saved",
        description: `Rascunho ${requisitionCode || id} atualizado`,
        companyId,
        userId,
        entity: "requisitions",
        entityId: id,
        metadata: { code: requisitionCode || null, status: "draft" },
      })

      toast.success("Rascunho salvo.")
      router.push(`/comprador/requisicoes/${id}`)
    } finally {
      setDrafting(false)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!companyId || !userId || !id) return

    if (!form.title.trim()) {
      setError("Título é obrigatório.")
      return
    }

    if (!(form.costCenter ?? "").trim()) {
      setError("Centro de custo é obrigatório.")
      return
    }

    if (items.length === 0) {
      toast.error("Adicione ao menos um item antes de enviar.")
      return
    }

    const branchValidation = validateRequisitionLineSiteCodes(items)
    if (!branchValidation.ok) {
      setSiteCodeFieldErrors(branchValidation.errors)
      toast.error(branchValidation.message)
      return
    }
    setSiteCodeFieldErrors({})

    if (accountAssignmentEnabled) {
      const accountValidation = validateAllAccountConfigsForSubmit(
        items.map((item) => ({ id: item.id, material_code: item.materialCode })),
        accountConfigs,
      )
      if (!accountValidation.ok) {
        setAccountConfigErrors(accountValidation.errorsByItemId)
        toast.error(accountValidation.firstMessage)
        return
      }
    }
    setAccountConfigErrors({})

    setSaving(true)

    try {
      const res = await fetch(`/api/requisitions/${id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          cost_center: (form.costCenter ?? "").trim(),
          priority: form.priority,
          needed_by: form.neededBy || null,
          items: items.map((it) => ({
            id: it.id,
            material_code: (it.materialCode ?? "").trim() || null,
            material_description: it.materialDescription.trim(),
            quantity: Math.max(1, Number(it.quantity) || 1),
            unit_of_measure: (it.unitOfMeasure ?? "").trim() || null,
            commodity_group: (it.commodityGroup ?? "").trim() || null,
            observations: (it.observations ?? "").trim() || null,
            site_code: it.siteCode,
          })),
          account_configs: accountConfigs,
        }),
      })

      const payload = (await res.json()) as {
        error?: string
        data?: { status?: string; auto_approved?: boolean }
      }

      if (!res.ok) {
        toast.error(payload.error || "Erro ao resubmeter a requisição.")
        return
      }

      if (payload.data?.auto_approved) {
        toast.success("Requisição resubmetida e aprovada automaticamente.")
      } else {
        toast.success("Requisição resubmetida com sucesso.")
      }
      router.push("/comprador/requisicoes")
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push(`/comprador/requisicoes/${id}`)
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/comprador/requisicoes/${id}`)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Editar Requisição</h1>
            <p className="text-muted-foreground">Carregando...</p>
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
          <Button variant="ghost" size="icon" onClick={() => router.push(`/comprador/requisicoes/${id}`)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Editar Requisição</h1>
            <p className="text-muted-foreground">—</p>
          </div>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Sem permissão para editar requisições.
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Editar Requisição {requisitionCode}</h1>
              <p className="text-muted-foreground">
                {currentStatus === "draft"
                  ? "Continue o preenchimento e envie quando estiver pronto"
                  : "Edite e resubmeta para aprovação"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving || drafting}>
              Cancelar
            </Button>
            {currentStatus === "draft" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSaveDraft()}
                disabled={saving || drafting}
              >
                {drafting ? "Salvando..." : "Salvar"}
              </Button>
            )}
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving || drafting}>
              <Send className="h-4 w-4 mr-2" />
              {saving
                ? currentStatus === "draft"
                  ? "Enviando..."
                  : "Salvando..."
                : currentStatus === "draft"
                  ? "Enviar Requisição"
                  : "Salvar e Resubmeter"}
            </Button>
          </div>
        </div>

        {currentStatus === "rejected" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-yellow-800">
              Esta requisição foi rejeitada. Edite e resubmeta para aprovação.
            </p>
            {rejectionReason && (
              <p className="text-sm text-yellow-700">
                Motivo da rejeição: {rejectionReason}
              </p>
            )}
          </div>
        </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dados Gerais</CardTitle>
            <p className="text-sm text-muted-foreground">Edite os dados da requisição de compra.</p>
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
                <CostCenterSelect
                  companyId={companyId}
                  value={form.costCenter}
                  onChange={(code) => setForm((f) => ({ ...f, costCenter: code }))}
                  required
                  includeInactiveCodes={form.costCenter ? [form.costCenter] : []}
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

        <RequisitionLineItemsSection
          companyId={companyId}
          items={items}
          onItemsChange={setItems}
          accountConfigs={accountConfigs}
          onAccountConfigsChange={setAccountConfigs}
          accountConfigErrors={accountConfigErrors}
          siteCodeFieldErrors={siteCodeFieldErrors}
          onAccountConfigChange={handleAccountConfigChange}
        />

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
