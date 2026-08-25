import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notify"

const BLOCKED_QUOTATION_STATUSES = new Set(["completed", "cancelled"])

export function parseQuotationInviteInput(
  body: Record<string, unknown>,
): { supplier_code: string } | string {
  const raw = body.supplier_code
  if (typeof raw !== "string" || !raw.trim()) {
    return "Campo supplier_code é obrigatório."
  }
  return { supplier_code: raw.trim() }
}

export function mapQuotationInviteToApi(input: {
  quotationId: string
  quotationCode: string
  supplierId: string
  supplierCode: string
  supplierName: string
  position: number
  roundId: string | null
  roundNumber: number | null
  proposalCreated: boolean
}) {
  return {
    quotation_id: input.quotationId,
    quotation_code: input.quotationCode,
    supplier_id: input.supplierId,
    supplier_code: input.supplierCode,
    supplier_name: input.supplierName,
    position: input.position,
    round_id: input.roundId,
    round_number: input.roundNumber,
    proposal_status: input.proposalCreated ? ("invited" as const) : null,
  }
}

export async function inviteSupplierToQuotation(
  service: SupabaseClient,
  companyId: string,
  quotation: { id: string; code: string; status: string },
  supplierCode: string,
) {
  if (BLOCKED_QUOTATION_STATUSES.has(quotation.status)) {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Não é possível convidar fornecedor em cotação ${quotation.status}.`,
    }
  }

  const { data: supplier, error: supplierError } = await service
    .from("suppliers")
    .select("id, code, name, cnpj")
    .eq("company_id", companyId)
    .eq("code", supplierCode)
    .maybeSingle()

  if (supplierError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: supplierError.message }
  }
  if (!supplier) {
    return {
      ok: false as const,
      code: "NOT_FOUND" as const,
      message: `Fornecedor não encontrado: ${supplierCode}`,
    }
  }

  const { data: existingInvite } = await service
    .from("quotation_suppliers")
    .select("id")
    .eq("company_id", companyId)
    .eq("quotation_id", quotation.id)
    .eq("supplier_id", supplier.id)
    .maybeSingle()

  if (existingInvite) {
    return {
      ok: false as const,
      code: "CONFLICT" as const,
      message: `Fornecedor ${supplierCode} já está convidado nesta cotação.`,
    }
  }

  const { data: positionRows } = await service
    .from("quotation_suppliers")
    .select("position")
    .eq("quotation_id", quotation.id)
    .eq("company_id", companyId)

  const maxPosition = (positionRows ?? []).reduce((max, row) => {
    const value = Number(row.position ?? 0)
    return Number.isFinite(value) && value > max ? value : max
  }, 0)
  const position = maxPosition + 1

  const { error: insertInviteError } = await service.from("quotation_suppliers").insert({
    quotation_id: quotation.id,
    company_id: companyId,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    supplier_cnpj: supplier.cnpj ?? null,
    position,
  })

  if (insertInviteError) {
    return {
      ok: false as const,
      code: "INTERNAL_ERROR" as const,
      message: insertInviteError.message,
    }
  }

  const { data: activeRound } = await service
    .from("quotation_rounds")
    .select("id, round_number")
    .eq("quotation_id", quotation.id)
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  let proposalCreated = false
  if (activeRound?.id) {
    const { data: existingProposal } = await service
      .from("quotation_proposals")
      .select("id")
      .eq("quotation_id", quotation.id)
      .eq("supplier_id", supplier.id)
      .eq("round_id", activeRound.id)
      .maybeSingle()

    if (!existingProposal) {
      const { error: proposalError } = await service.from("quotation_proposals").insert({
        quotation_id: quotation.id,
        company_id: companyId,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        supplier_cnpj: supplier.cnpj ?? null,
        round_id: activeRound.id,
        status: "invited",
      })
      if (proposalError) {
        return {
          ok: false as const,
          code: "INTERNAL_ERROR" as const,
          message: proposalError.message,
        }
      }
      proposalCreated = true
    }
  }

  try {
    const { data: profiles } = await service
      .from("profiles")
      .select("id")
      .eq("supplier_id", supplier.id)
      .eq("profile_type", "supplier")

    await Promise.allSettled(
      (profiles ?? []).map((profile) =>
        createNotification(
          {
            userId: profile.id as string,
            companyId,
            type: "quotation.invited",
            title: "Nova cotação",
            body: `Você foi convidado a participar da cotação ${quotation.code}.`,
            entity: "quotations",
            entityId: quotation.id,
          },
          service,
        ),
      ),
    )
  } catch {
    // convite já persistido — notificação não bloqueia
  }

  return {
    ok: true as const,
    invitation: mapQuotationInviteToApi({
      quotationId: quotation.id,
      quotationCode: quotation.code,
      supplierId: supplier.id as string,
      supplierCode: supplier.code as string,
      supplierName: supplier.name as string,
      position,
      roundId: activeRound?.id ?? null,
      roundNumber: activeRound?.round_number ?? null,
      proposalCreated,
    }),
  }
}
