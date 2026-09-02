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
  TooltipProvider,
} from "@/components/ui/tooltip"
import { ChevronLeft, X, Paperclip } from "lucide-react"
import {
  CostCenterSelect,
  loadUserDefaultCostCenterCode,
} from "@/components/ui/cost-center-select"
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

const ACCEPTED_FILE_TYPES = ".pdf,.xlsx,.xls,.jpg,.jpeg,.png"

type AttachedFile = {
  id: string
  file: File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SolicitanteNovaPage() {
  const router = useRouter()
  const { accountAssignmentEnabled } = useImplantationConfig()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [companyId, setCompanyId] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userName, setUserName] = React.useState<string>("")
  const [saving, setSaving] = React.useState(false)
  const [drafting, setDrafting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Dados gerais
  const [title, setTitle] = React.useState("")
  const [costCenter, setCostCenter] = React.useState("")
  const [neededBy, setNeededBy] = React.useState("")
  const [priority, setPriority] = React.useState<"normal" | "urgent" | "critical">("normal")
  const [description, setDescription] = React.useState("")

  // Itens
  const [items, setItems] = React.useState<RequisitionEditorLineItem[]>([])
  const [accountConfigs, setAccountConfigs] = React.useState<
    Record<string, ItemAccountConfigEdit>
  >({})
  const [accountConfigErrors, setAccountConfigErrors] = React.useState<
    Record<string, ItemAccountConfigFieldErrors>
  >({})
  const [siteCodeFieldErrors, setSiteCodeFieldErrors] = React.useState<Record<string, boolean>>({})

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

  function handleAccountConfigChange(itemId: string) {
    setAccountConfigErrors((prev) => {
      if (!prev[itemId]) return prev
      const next = { ...prev }
      delete next[itemId]
      return next
    })
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

  async function persistNewRequisition(status: "draft" | "pending") {
    if (!companyId || !userId) return null

    const supabase = createClient()
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
        status,
        origin: "manual",
        requester_id: userId,
        requester_name: userName,
      })
      .select("id, code")
      .single()

    if (reqError || !reqData) return null

    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from("requisition_items").insert(
        items.map((item) => ({
          id: item.id,
          requisition_id: reqData.id,
          company_id: companyId,
          material_code: item.materialCode || null,
          material_description: item.materialDescription,
          quantity: item.quantity,
          unit_of_measure: item.unitOfMeasure || null,
          commodity_group: item.commodityGroup || null,
          observations: item.observations || null,
          site_code: item.siteCode,
        })),
      )
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

    void logAudit({
      eventType: status === "draft" ? "requisition.draft_saved" : "requisition.created",
      description:
        status === "draft"
          ? `Rascunho ${reqData.code} salvo por ${userName || "solicitante"}`
          : `Requisição ${reqData.code} criada por ${userName || "solicitante"}`,
      companyId,
      userId,
      userName: userName || null,
      entity: "requisitions",
      entityId: reqData.id,
      metadata: {
        code: reqData.code,
        priority,
        cost_center: costCenter || null,
        status,
      },
    })

    return reqData as { id: string; code: string }
  }

  async function handleSaveDraft() {
    setError(null)
    if (!title.trim()) {
      setError("Título é obrigatório.")
      return
    }
    if (!costCenter.trim()) {
      setError("Centro de custo é obrigatório.")
      return
    }
    if (!companyId || !userId) return

    setDrafting(true)
    try {
      const reqData = await persistNewRequisition("draft")
      if (!reqData) {
        setError((prev) => prev ?? "Erro ao salvar rascunho. Tente novamente.")
        return
      }
      toast.success("Rascunho salvo.")
      router.push(`/solicitante/${reqData.id}`)
    } finally {
      setDrafting(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!title.trim()) { setError("Título é obrigatório."); return }
    if (!costCenter.trim()) { setError("Centro de custo é obrigatório."); return }
    if (items.length === 0) { setError("Adicione ao menos um item."); return }

    const branchValidation = validateRequisitionLineSiteCodes(items)
    if (!branchValidation.ok) {
      setSiteCodeFieldErrors(branchValidation.errors)
      setError(branchValidation.message)
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

    if (!companyId || !userId) return

    setSaving(true)
    const supabase = createClient()

    const reqData = await persistNewRequisition("pending")
    if (!reqData) {
      setError("Erro ao criar requisição. Tente novamente.")
      setSaving(false)
      return
    }

    const requisitionId = reqData.id
    const requisitionCode = reqData.code

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
    } finally {
      setSaving(false)
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void handleSaveDraft()}
              disabled={saving || drafting}
            >
              {drafting ? "Salvando..." : "Salvar"}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving || drafting}>
              {saving ? "Enviando..." : "Enviar Requisição"}
            </Button>
          </div>
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
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/solicitante")}
            disabled={saving || drafting}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => void handleSaveDraft()}
            disabled={saving || drafting}
          >
            {drafting ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            className="flex-1"
            onClick={() => void handleSubmit()}
            disabled={saving || drafting}
          >
            {saving ? "Enviando..." : "Enviar Requisição"}
          </Button>
        </div>

      </div>
    </TooltipProvider>
  )
}
