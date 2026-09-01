"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { notifyWithEmail } from "@/lib/notify-with-email"
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

import {
  ChevronLeft,
  AlertTriangle,
  X,
} from "lucide-react"
import { RequisitionLineItemsSection } from "@/components/requisitions/requisition-line-items-section"
import {
  buildAccountConfigsFromRequisitionItems,
  REQUISITION_ITEM_ACCOUNT_SELECT,
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

export default function SolicitanteEditarRequisicaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = React.use(params)
  const { accountAssignmentEnabled } = useImplantationConfig()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [drafting, setDrafting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState<string | null>(null)
  const [requisitionCode, setRequisitionCode] = React.useState<string>("")
  const [currentStatus, setCurrentStatus] = React.useState<"draft" | "rejected" | null>(null)

  const [companyId, setCompanyId] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [userName, setUserName] = React.useState<string>("")

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

  const [attachments, setAttachments] = React.useState<AttachedFile[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let alive = true

    const run = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = "/login"
          return
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, full_name, profile_type")
          .eq("id", user.id)
          .maybeSingle()

        if (!profile || profile.profile_type !== "requester") {
          window.location.href = "/login"
          return
        }

        const cid = profile.company_id as string
        setCompanyId(cid)
        setUserId(user.id)
        setUserName(profile.full_name ?? "")

        const [rRes, iRes] = await Promise.all([
          supabase
            .from("requisitions")
            .select("*")
            .eq("id", id)
            .eq("requester_id", user.id)
            .maybeSingle(),
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
        } | null

        if (!reqData || rRes.error) {
          router.push("/solicitante")
          return
        }

        if (reqData.status !== "rejected" && reqData.status !== "draft") {
          router.push(`/solicitante/${id}`)
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
        if (reqItems.length > 0) {
          const materialCodes = [
            ...new Set(
              reqItems.map((r) => r.material_code).filter((c): c is string => Boolean(c)),
            ),
          ]
          if (materialCodes.length > 0) {
            const { data } = await supabase
              .from("items")
              .select(
                "id, code, short_description, long_description, unit_of_measure, commodity_group",
              )
              .eq("company_id", cid)
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
            }
          })
          setItems(lineItems)
          setAccountConfigs(buildAccountConfigsFromRequisitionItems(reqItems))
        } else {
          setItems([])
          setAccountConfigs({})
        }
      } catch {
        toast.error("Não foi possível carregar a requisição.")
        router.push("/solicitante")
      } finally {
        if (alive) setLoading(false)
      }
    }

    void run()
    return () => {
      alive = false
    }
  }, [id, router])

  const handleAccountConfigChange = (itemId: string) => {
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
        .eq("requester_id", userId)

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
        userName: userName || null,
        entity: "requisitions",
        entityId: id,
        metadata: { code: requisitionCode || null, status: "draft" },
      })

      toast.success("Rascunho salvo.")
      router.push(`/solicitante/${id}`)
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
    setSaving(true)

    try {
      const costCenterTrimmed = (form.costCenter ?? "").trim()
      const costCenterForInsert = costCenterTrimmed || null

      const { error: updateErr } = await supabase
        .from("requisitions")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          cost_center: costCenterForInsert,
          priority: form.priority,
          needed_by: form.neededBy || null,
          rejection_reason: null,
          approver_id: null,
          approver_name: null,
          approved_at: null,
          status: "pending",
        })
        .eq("id", id)
        .eq("requester_id", userId)

      if (updateErr) {
        toast.error(updateErr.message?.trim() || "Erro ao atualizar a requisição.")
        return
      }

      const { error: deleteItemsErr } = await supabase
        .from("requisition_items")
        .delete()
        .eq("requisition_id", id)

      if (deleteItemsErr) {
        toast.error(deleteItemsErr.message?.trim() || "Erro ao remover itens antigos.")
        return
      }

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

      await supabase
        .from("approval_requests")
        .delete()
        .eq("entity_id", id)
        .eq("flow", "requisition")

      const { data: featureData } = await supabase
        .from("tenant_features")
        .select("enabled")
        .eq("company_id", companyId)
        .eq("feature_key", "approval_requisition")
        .maybeSingle()

      const approvalEnabled = featureData?.enabled ?? false

      if (approvalEnabled) {
        const { data: approverRows } = await supabase.rpc(
          "get_approver_for_requisition",
          {
            p_company_id: companyId,
            p_cost_center: costCenterTrimmed || "",
          },
        )

        const approverRow = Array.isArray(approverRows)
          ? approverRows[0]
          : approverRows
        const approverId =
          (approverRow as { approver_id?: string | null } | null)?.approver_id ??
          null
        const approverName =
          (approverRow as { approver_name?: string | null } | null)
            ?.approver_name ?? null

        if (approverId) {
          await supabase.from("approval_requests").insert({
            company_id: companyId,
            flow: "requisition",
            entity_id: id,
            approver_id: approverId,
            approver_name: approverName,
            status: "pending",
          })
          await supabase
            .from("requisitions")
            .update({
              approver_id: approverId,
              approver_name: approverName,
              status: "pending",
            })
            .eq("id", id)
            .eq("requester_id", userId)

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
              entityId: id,
              subject: `Nova Requisição — ${requisitionCode}`,
              html: `<p>Olá, <strong>${approver.full_name ?? "Aprovador"}</strong>!</p>
           <p>A requisição <strong>${requisitionCode}</strong> foi resubmetida por <strong>${userName || "solicitante"}</strong> e aguarda sua aprovação.</p>`,
              emailPrefKey: "new_requisition_email",
            })
          }
        } else {
          await supabase
            .from("requisitions")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
              approver_name:
                "Aprovação automática (sem regra configurada para este CC)",
            })
            .eq("id", id)
            .eq("requester_id", userId)

          void notifyWithEmail({
            userId,
            companyId,
            type: "requisition.approved",
            title: "Requisição aprovada automaticamente",
            body: `Sua requisição ${requisitionCode} foi aprovada e está disponível para cotação.`,
            entity: "requisition",
            entityId: id,
            subject: `Requisição Aprovada — ${requisitionCode}`,
            html: `<p>Sua requisição <strong>${requisitionCode}</strong> foi aprovada automaticamente.</p>
         <p>Ela já está disponível para abertura de cotação.</p>`,
            emailPrefKey: "requisition_approval_email",
          })
        }
      } else {
        await supabase
          .from("requisitions")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approver_name: "Aprovação automática (fluxo desabilitado)",
          })
          .eq("id", id)
          .eq("requester_id", userId)

        void notifyWithEmail({
          userId,
          companyId,
          type: "requisition.approved",
          title: "Requisição aprovada automaticamente",
          body: `Sua requisição ${requisitionCode} foi aprovada e está disponível para cotação.`,
          entity: "requisition",
          entityId: id,
          subject: `Requisição Aprovada — ${requisitionCode}`,
          html: `<p>Sua requisição <strong>${requisitionCode}</strong> foi aprovada automaticamente.</p>
         <p>Ela já está disponível para abertura de cotação.</p>`,
          emailPrefKey: "requisition_approval_email",
        })
      }

      toast.success(
        currentStatus === "draft"
          ? "Requisição enviada com sucesso."
          : "Requisição resubmetida com sucesso.",
      )
      router.push(`/solicitante/${id}`)
    } catch {
      toast.error(
        "Requisição atualizada, mas houve erro ao configurar aprovação. Contate o administrador.",
      )
      router.push(`/solicitante/${id}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/solicitante/${id}`)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Editar Requisição</h1>
                {requisitionCode && (
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                    {requisitionCode}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {currentStatus === "draft"
                  ? "Continue o preenchimento e envie quando estiver pronto"
                  : "Corrija os dados e resubmeta para aprovação"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/solicitante/${id}`)}
              disabled={saving || drafting}
            >
              Cancelar
            </Button>
            {currentStatus === "draft" && (
              <Button
                variant="outline"
                onClick={() => void handleSaveDraft()}
                disabled={saving || drafting}
              >
                {drafting ? "Salvando..." : "Salvar"}
              </Button>
            )}
            <Button onClick={() => void handleSubmit()} disabled={saving || drafting}>
              {saving
                ? currentStatus === "draft"
                  ? "Enviando..."
                  : "Resubmetendo..."
                : currentStatus === "draft"
                  ? "Enviar Requisição"
                  : "Resubmeter Requisição"}
            </Button>
          </div>
        </div>

      <TooltipProvider>
        <div className="space-y-6">
          {rejectionReason && currentStatus === "rejected" && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">Motivo da reprovação</p>
                <p className="text-sm text-orange-700 mt-0.5">{rejectionReason}</p>
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
              <p className="text-sm text-muted-foreground">
                Edite os dados da requisição de compra.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Título</Label>
                  <span className="text-xs text-muted-foreground">{form.title.length}/100</span>
                </div>
                <Input
                  id="title"
                  value={form.title}
                  maxLength={100}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value.slice(0, 100) }))
                  }
                  placeholder="Ex: Materiais para manutenção"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <CostCenterSelect
                    companyId={companyId}
                    value={form.costCenter}
                    onChange={(code) => setForm((f) => ({ ...f, costCenter: code }))}
                    required
                    includeInactiveCodes={form.costCenter ? [form.costCenter] : []}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neededBy">Data de Necessidade</Label>
                  <Input
                    id="neededBy"
                    type="date"
                    value={form.neededBy}
                    onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
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
                  <Label htmlFor="description">Descrição</Label>
                  <span className="text-xs text-muted-foreground">
                    {form.description.length}/500
                  </span>
                </div>
                <Textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  maxLength={500}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value.slice(0, 500) }))
                  }
                  placeholder="Descrição opcional da requisição"
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
            onAccountConfigChange={handleAccountConfigChange}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anexos</CardTitle>
              <p className="text-xs text-muted-foreground">
                PDF, Excel ou imagens · Os arquivos serão enviados junto com a requisição
              </p>
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
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{a.file.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatFileSize(a.file.size)}
                      </span>
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
    </div>
  )
}
