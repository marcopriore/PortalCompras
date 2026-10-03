import type { SupabaseClient } from "@supabase/supabase-js"

export type RequisitionItemWriteRow = {
  id: string
  requisition_id: string
  company_id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  commodity_group: string | null
  observations: string | null
  site_code: string
}

const SNAPSHOT_SELECT =
  "id, requisition_id, company_id, material_code, material_description, quantity, unit_of_measure, commodity_group, observations, site_code, estimated_price, contract_id, contract_item_id, account_assignment_category, account_assignment_distribution, partial_invoice_distribution"

export function validateRequisitionItemWriteRows(
  items: RequisitionItemWriteRow[],
): string | null {
  for (const item of items) {
    if (!item.id?.trim()) {
      return "Itens inválidos: id ausente."
    }
    if (!item.site_code?.trim()) {
      return "Selecione o centro / filial em todos os itens."
    }
    if (!item.material_description?.trim()) {
      return "Informe a descrição de todos os itens."
    }
  }
  return null
}

/**
 * Substitui as linhas da REQ. Valida o payload antes de apagar e
 * restaura o snapshot se o INSERT falhar — evita REQ vazia.
 */
export async function replaceRequisitionItems(
  db: SupabaseClient,
  requisitionId: string,
  items: RequisitionItemWriteRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validationError = validateRequisitionItemWriteRows(items)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const { data: snapshot, error: snapshotErr } = await db
    .from("requisition_items")
    .select(SNAPSHOT_SELECT)
    .eq("requisition_id", requisitionId)

  if (snapshotErr) {
    return {
      ok: false,
      error: snapshotErr.message || "Erro ao ler os itens da requisição.",
    }
  }

  const { error: deleteErr } = await db
    .from("requisition_items")
    .delete()
    .eq("requisition_id", requisitionId)

  if (deleteErr) {
    return {
      ok: false,
      error: deleteErr.message || "Erro ao atualizar itens.",
    }
  }

  if (items.length === 0) {
    return { ok: true }
  }

  const { error: insertErr } = await db.from("requisition_items").insert(items)
  if (!insertErr) {
    return { ok: true }
  }

  const previous = snapshot ?? []
  if (previous.length > 0) {
    const { error: restoreErr } = await db
      .from("requisition_items")
      .insert(previous)
    if (restoreErr) {
      return {
        ok: false,
        error:
          insertErr.message ||
          "Erro ao salvar os itens da requisição. Não foi possível restaurar as linhas anteriores.",
      }
    }
  }

  return {
    ok: false,
    error: insertErr.message || "Erro ao salvar os itens da requisição.",
  }
}
