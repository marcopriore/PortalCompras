import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { logAudit } from "@/lib/audit"
import {
  validateAllAccountConfigsForSubmit,
  type ItemAccountConfigEdit,
} from "@/lib/po-account-assignment"
import { saveRequisitionAccountConfigs } from "@/lib/requisition-account-assignment-persist"
import { loadImplantationConfig } from "@/lib/settings/tenant-implantation-settings"
import { triggerRequisitionOutbound } from "@/lib/integrations/trigger-requisition-outbound"

export const runtime = "nodejs"

type ItemPayload = {
  id?: string
  material_code?: string | null
  material_description: string
  quantity: number
  unit_of_measure?: string | null
  commodity_group?: string | null
  observations?: string | null
  site_code?: string | null
}

type Body = {
  title: string
  description?: string | null
  cost_center: string
  priority: "normal" | "urgent" | "critical"
  needed_by?: string | null
  items: ItemPayload[]
  account_configs?: Record<string, ItemAccountConfigEdit>
}

async function resolveCompanyId(
  profile: { company_id: string | null; is_superadmin: boolean | null },
): Promise<string | null> {
  let companyId = profile.company_id
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }
  return companyId
}

/**
 * POST /api/requisitions/[id]/resubmit
 * Resubmete REQ rejeitada/rascunho → pending (ou auto-aprovada).
 * Usa service role para superadmin cross-tenant (cookie selected_company_id).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, is_superadmin, profile_type, full_name")
      .eq("id", user.id)
      .single()

    if (!profile || profile.profile_type !== "buyer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const companyId = await resolveCompanyId(profile)
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
    }

    const title = body.title?.trim()
    const costCenter = body.cost_center?.trim()
    if (!title) {
      return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 })
    }
    if (!costCenter) {
      return NextResponse.json({ error: "Centro de custo é obrigatório." }, { status: 400 })
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Adicione ao menos um item antes de enviar." },
        { status: 400 },
      )
    }

    for (const item of body.items) {
      if (!item.site_code?.trim()) {
        return NextResponse.json(
          { error: "Selecione o centro / filial em todos os itens." },
          { status: 400 },
        )
      }
    }

    const accountConfigs = body.account_configs ?? {}
    const service = createServiceRoleClient()
    const implantation = await loadImplantationConfig(service, companyId)

    if (implantation.accountAssignmentEnabled) {
      const accountValidation = validateAllAccountConfigsForSubmit(
        body.items.map((item, index) => ({
          id: item.id ?? `item-${index}`,
          material_code: (item.material_code ?? "").trim() || `item-${index}`,
        })),
        accountConfigs,
      )
      if (!accountValidation.ok) {
        return NextResponse.json({ error: accountValidation.firstMessage }, { status: 400 })
      }
    }

    const { data: req, error: reqErr } = await service
      .from("requisitions")
      .select("id, code, status, company_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle()

    if (reqErr) {
      return NextResponse.json({ error: reqErr.message }, { status: 500 })
    }
    if (!req) {
      return NextResponse.json({ error: "Requisição não encontrada." }, { status: 404 })
    }
    if (req.status !== "rejected" && req.status !== "draft") {
      return NextResponse.json(
        { error: "Só é possível resubmeter requisições rejeitadas ou em rascunho." },
        { status: 409 },
      )
    }

    const neededBy =
      body.needed_by && /^\d{4}-\d{2}-\d{2}$/.test(body.needed_by)
        ? body.needed_by
        : null

    const { error: updateErr } = await service
      .from("requisitions")
      .update({
        title,
        description: body.description?.trim() || null,
        cost_center: costCenter,
        priority: body.priority ?? "normal",
        needed_by: neededBy,
        rejection_reason: null,
        approver_id: null,
        approver_name: null,
        approved_at: null,
        status: "pending",
      })
      .eq("id", id)
      .eq("company_id", companyId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const { error: deleteItemsErr } = await service
      .from("requisition_items")
      .delete()
      .eq("requisition_id", id)

    if (deleteItemsErr) {
      return NextResponse.json({ error: deleteItemsErr.message }, { status: 500 })
    }

    const payloadItems = body.items.map((it) => ({
      id: it.id,
      requisition_id: id,
      company_id: companyId,
      material_code: (it.material_code ?? "").trim() || null,
      material_description: it.material_description.trim(),
      quantity: Math.max(1, Number(it.quantity) || 1),
      unit_of_measure: (it.unit_of_measure ?? "").trim() || null,
      commodity_group: (it.commodity_group ?? "").trim() || null,
      observations: (it.observations ?? "").trim() || null,
      site_code: it.site_code!.trim(),
    }))

    const missingIds = payloadItems.filter((row) => !row.id)
    if (missingIds.length > 0) {
      return NextResponse.json({ error: "Itens inválidos: id ausente." }, { status: 400 })
    }

    const { error: insertItemsErr } = await service
      .from("requisition_items")
      .insert(payloadItems)

    if (insertItemsErr) {
      return NextResponse.json({ error: insertItemsErr.message }, { status: 500 })
    }

    const accountResult = await saveRequisitionAccountConfigs(
      service,
      companyId,
      accountConfigs,
    )
    if (!accountResult.ok) {
      return NextResponse.json({ error: accountResult.message }, { status: 500 })
    }

    await service
      .from("approval_requests")
      .delete()
      .eq("entity_id", id)
      .eq("flow", "requisition")

    const { data: tfRow } = await service
      .from("tenant_features")
      .select("enabled")
      .eq("company_id", companyId)
      .eq("feature_key", "approval_requisition")
      .maybeSingle()

    const enabled = Boolean(tfRow?.enabled)
    const requesterName = profile.full_name ?? ""

    if (!enabled) {
      await service
        .from("requisitions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approver_name: "Aprovação automática (fluxo desabilitado)",
        })
        .eq("id", id)

      await logAudit({
        eventType: "requisition.created",
        description: `Requisição ${req.code} resubmetida e aprovada automaticamente`,
        companyId,
        userId: user.id,
        userName: requesterName,
        entity: "requisitions",
        entityId: id,
      }).catch(() => {})

      triggerRequisitionOutbound(companyId, id, "requisition.updated")
      triggerRequisitionOutbound(companyId, id, "requisition.approved")

      return NextResponse.json({
        data: { id, code: req.code, status: "approved", auto_approved: true },
      })
    }

    const { data: approverData } = await service.rpc("get_approver_for_requisition", {
      p_company_id: companyId,
      p_cost_center: costCenter,
    })

    const firstRow = Array.isArray(approverData) ? approverData[0] : approverData
    const approverId =
      (firstRow as { approver_id?: string | null } | null)?.approver_id ?? null
    const approverName =
      (firstRow as { approver_name?: string | null } | null)?.approver_name ?? null

    if (!approverId) {
      await service
        .from("requisitions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approver_name: "Aprovação automática (sem regra configurada para este CC)",
        })
        .eq("id", id)

      await logAudit({
        eventType: "requisition.created",
        description: `Requisição ${req.code} resubmetida e aprovada automaticamente`,
        companyId,
        userId: user.id,
        userName: requesterName,
        entity: "requisitions",
        entityId: id,
      }).catch(() => {})

      triggerRequisitionOutbound(companyId, id, "requisition.updated")
      triggerRequisitionOutbound(companyId, id, "requisition.approved")

      return NextResponse.json({
        data: { id, code: req.code, status: "approved", auto_approved: true },
      })
    }

    await service
      .from("requisitions")
      .update({
        approver_id: approverId,
        approver_name: approverName,
        status: "pending",
      })
      .eq("id", id)

    await service.from("approval_requests").insert({
      company_id: companyId,
      flow: "requisition",
      entity_id: id,
      approver_id: approverId,
      approver_name: approverName,
      status: "pending",
    })

    await logAudit({
      eventType: "requisition.created",
      description: `Requisição ${req.code} resubmetida para aprovação`,
      companyId,
      userId: user.id,
      userName: requesterName,
      entity: "requisitions",
      entityId: id,
    }).catch(() => {})

    triggerRequisitionOutbound(companyId, id, "requisition.updated")

    return NextResponse.json({
      data: {
        id,
        code: req.code,
        status: "pending",
        auto_approved: false,
        approver_id: approverId,
        approver_name: approverName,
      },
    })
  } catch (err) {
    console.error("[requisitions/resubmit]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
