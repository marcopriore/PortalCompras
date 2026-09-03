"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { notifyWithEmail } from "@/lib/notify-with-email"
import { useUser } from "@/lib/hooks/useUser"
import { usePermissions } from "@/lib/hooks/usePermissions"
import { logAudit } from "@/lib/audit"
import { notifyRequisitionOutboundClient } from "@/lib/integrations/notify-requisition-outbound-client"
import { toast } from "sonner"
import {
  CostCenterSelect,
  loadUserDefaultCostCenterCode,
} from "@/components/ui/cost-center-select"

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
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChevronLeft, Paperclip, X } from "lucide-react"
import { RequisitionLineItemsSection } from "@/components/requisitions/requisition-line-items-section"
import type { RequisitionEditorLineItem } from "@/lib/requisitions/line-items-helpers"
import { validateRequisitionLineSiteCodes } from "@/lib/requisitions/line-items-helpers"
import {
  validateAllAccountConfigsForSubmit,
  type ItemAccountConfigEdit,
  type ItemAccountConfigFieldErrors,
} from "@/lib/po-account-assignment"
import { saveRequisitionAccountConfigs } from "@/lib/requisition-account-assignment-persist"
import { useImplantationConfig } from "@/lib/hooks/use-implantation-config"
import { invalidFieldClass } from "@/lib/validation/numeric-input"
import { cn } from "@/lib/utils"

type Priority = "normal" | "urgent" | "critical"

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function NovaRequisicaoPage() {
  const router = useRouter()
  const { companyId, userId, loading: userLoading } = useUser()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { accountAssignmentEnabled } = useImplantationConfig()

  const [loading, setLoading] = React.useState(false)
  const [drafting, setDrafting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
  const [formFieldErrors, setFormFieldErrors] = React.useState<{
    title?: boolean
    costCenter?: boolean
  }>({})

  const [attachments, setAttachments] = React.useState<AttachedFile[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canCreate = hasPermission("requisition.create.buyer")

  React.useEffect(() => {
    if (!userId) return
    void loadUserDefaultCostCenterCode(userId).then((code) => {
      if (code) {
        setForm((f) => (f.costCenter ? f : { ...f, costCenter: code }))
      }
    })
  }, [userId])

  const handleAccountConfigChange = (itemId: string, _config: ItemAccountConfigEdit) => {
    setAccountConfigErrors((prev) => {
      if (!prev[itemId]) return prev
      const next = { ...prev }
      delete next[itemId]
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

  const createRequisitionRecord = async (status: "draft" | "pending") => {
    if (!companyId || !userId) return null

    const supabase = createClient()
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
        status,
        origin: "manual",
        requester_id: userId,
        requester_name: requesterName,
        title: form.title.trim(),
        description: form.description.trim() || null,
        cost_center: costCenterForInsert,
        needed_by: form.neededBy || null,
        priority: form.priority,
      })
      .select("id, code")
      .single()

    if (requisitionErr || !requisitionRes) {
      setError(
        requisitionErr?.message?.trim() ||
          (status === "draft"
            ? "Não foi possível salvar o rascunho."
            : "Não foi possível criar a requisição."),
      )
      return null
    }

    const requisitionId = (requisitionRes as { id: string }).id
    const requisitionCode = (requisitionRes as { code: string }).code

    void logAudit({
      eventType: status === "draft" ? "requisition.draft_saved" : "requisition.created",
      description:
        status === "draft"
          ? `Rascunho ${requisitionCode} salvo por ${requesterName || "comprador"}`
          : `Requisição ${requisitionCode} criada por ${requesterName || "comprador"}`,
      companyId,
      userId,
      userName: requesterName || null,
      entity: "requisitions",
      entityId: requisitionId,
      metadata: {
        code: requisitionCode,
        priority: form.priority,
        cost_center: costCenterForInsert,
        status,
      },
    })

    if (items.length > 0) {
      const payloadItems = items.map((it) => ({
        id: it.id,
        requisition_id: requisitionId,
        company_id: companyId,
        material_code: (it.materialCode ?? "").trim() || null,
        material_description: it.materialDescription.trim(),
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_of_measure: (it.unitOfMeasure ?? "").trim() || null,
        commodity_group: (it.commodityGroup ?? "").trim() || null,
        observations: (it.observations ?? "").trim() || null,
        site_code: it.siteCode,
      }))

      const { error: itemsErr } = await supabase.from("requisition_items").insert(payloadItems)

      if (itemsErr) {
        setError(itemsErr.message?.trim() || "Não foi possível salvar os itens da requisição.")
        return null
      }

      const accountResult = await saveRequisitionAccountConfigs(
        supabase,
        companyId,
        accountConfigs,
      )
      if (!accountResult.ok) {
        setError(accountResult.message)
        return null
      }
    }

    if (attachments.length > 0) {
      for (const att of attachments) {
        const fd = new FormData()
        fd.append("file", att.file)
        const uploadRes = await fetch(`/api/requisitions/${requisitionId}/attachments`, {
          method: "POST",
          body: fd,
        })
        if (!uploadRes.ok) {
          toast.error(`Falha ao enviar anexo: ${att.file.name}`)
        }
      }
    }

    return { requisitionId, requisitionCode, requesterName, costCenterTrimmed }
  }

  const handleSaveDraft = async () => {
    setError(null)
    if (!companyId || !userId) return

    const fieldErrors: { title?: boolean; costCenter?: boolean } = {}
    if (!form.title.trim()) fieldErrors.title = true
    if (!(form.costCenter ?? "").trim()) fieldErrors.costCenter = true
    setFormFieldErrors(fieldErrors)
    if (fieldErrors.title) {
      setError("Título é obrigatório.")
      return
    }
    if (fieldErrors.costCenter) {
      setError("Centro de custo é obrigatório.")
      return
    }
    setFormFieldErrors({})

    setDrafting(true)
    try {
      const created = await createRequisitionRecord("draft")
      if (!created) return
      toast.success("Rascunho salvo.")
      router.push(`/comprador/requisicoes/${created.requisitionId}`)
    } finally {
      setDrafting(false)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!companyId || !userId) return

    const fieldErrors: { title?: boolean; costCenter?: boolean } = {}
    if (!form.title.trim()) fieldErrors.title = true
    if (!(form.costCenter ?? "").trim()) fieldErrors.costCenter = true
    setFormFieldErrors(fieldErrors)
    if (fieldErrors.title) {
      setError("Título é obrigatório.")
      return
    }
    if (fieldErrors.costCenter) {
      setError("Centro de custo é obrigatório.")
      return
    }

    if (items.length === 0) {
      toast.error("Adicione ao menos um item antes de criar a requisição.")
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

    const supabase = createClient()
    setLoading(true)
    try {
      const created = await createRequisitionRecord("pending")
      if (!created) return

      const { requisitionId, requisitionCode, requesterName, costCenterTrimmed } = created

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
            emailPrefKey: "requisition_approval_email",
          })
          router.push(`/comprador/requisicoes/${requisitionId}`)
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
            emailPrefKey: "requisition_approval_email",
          })
          router.push(`/comprador/requisicoes/${requisitionId}`)
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

        notifyRequisitionOutboundClient(requisitionId, "requisition.created")

        router.push(`/comprador/requisicoes/${requisitionId}`)
      } catch {
        toast.error(
          "Requisição criada, mas houve erro ao configurar aprovação. Contate o administrador."
        )
        router.push(`/comprador/requisicoes/${requisitionId}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/comprador/requisicoes")}
              disabled={loading || drafting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSaveDraft()}
              disabled={loading || drafting}
            >
              {drafting ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading || drafting}
            >
              {loading ? "Enviando..." : "Enviar Requisição"}
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 grid-rows-[auto_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">
                  Título<span className="text-destructive">*</span>
                </Label>
                <div className="relative pb-5">
                  <Input
                    id="title"
                    value={form.title}
                    maxLength={100}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, title: e.target.value.slice(0, 100) }))
                      setFormFieldErrors((prev) => {
                        if (!prev.title) return prev
                        const next = { ...prev }
                        delete next.title
                        return next
                      })
                    }}
                    className={invalidFieldClass(formFieldErrors.title)}
                    placeholder="Ex: Materiais para manutenção"
                  />
                  <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
                    {form.title.length}/100
                  </p>
                </div>
              </div>
              <CostCenterSelect
                companyId={companyId}
                value={form.costCenter}
                onChange={(code) => {
                  setForm((f) => ({ ...f, costCenter: code }))
                  setFormFieldErrors((prev) => {
                    if (!prev.costCenter) return prev
                    const next = { ...prev }
                    delete next.costCenter
                    return next
                  })
                }}
                required
                invalid={formFieldErrors.costCenter}
              />
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
