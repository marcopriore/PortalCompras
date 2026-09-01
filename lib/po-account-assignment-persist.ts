import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildAssignmentsForPersistence,
  resolveSapDistributionFlags,
  validatePurchaseOrderItemAccountAssignments,
  type ItemAccountConfigEdit,
} from "@/lib/po-account-assignment"

function persistErrorMessage(error: { message?: string } | null): string {
  return error?.message?.trim() || "Não foi possível salvar a classificação contábil."
}

export async function savePurchaseOrderItemAccountConfig(
  supabase: SupabaseClient,
  companyId: string,
  itemId: string,
  config: ItemAccountConfigEdit,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!config.category) {
    const { error: itemError } = await supabase
      .from("purchase_order_items")
      .update({
        account_assignment_category: null,
        account_assignment_distribution: "",
        partial_invoice_distribution: "",
      })
      .eq("id", itemId)
      .eq("company_id", companyId)

    if (itemError) {
      return { ok: false, message: persistErrorMessage(itemError) }
    }

    const { error: deleteError } = await supabase
      .from("purchase_order_item_account_assignments")
      .delete()
      .eq("purchase_order_item_id", itemId)
      .eq("company_id", companyId)

    if (deleteError) {
      return { ok: false, message: persistErrorMessage(deleteError) }
    }
    return { ok: true }
  }

  const assignments = buildAssignmentsForPersistence(config)
  const persistedRows = config.usesApportionment
    ? assignments
    : assignments.slice(0, 1).map((row) => ({ ...row, apportionment_percent: 100 }))

  const validation = validatePurchaseOrderItemAccountAssignments(
    config.category,
    persistedRows,
  )
  if (!validation.ok) return validation

  const flags = resolveSapDistributionFlags(persistedRows)

  const { error: itemError } = await supabase
    .from("purchase_order_items")
    .update({
      account_assignment_category: config.category,
      account_assignment_distribution: flags.account_assignment_distribution,
      partial_invoice_distribution: flags.partial_invoice_distribution,
    })
    .eq("id", itemId)
    .eq("company_id", companyId)

  if (itemError) {
    return { ok: false, message: persistErrorMessage(itemError) }
  }

  const { error: deleteError } = await supabase
    .from("purchase_order_item_account_assignments")
    .delete()
    .eq("purchase_order_item_id", itemId)
    .eq("company_id", companyId)

  if (deleteError) {
    return { ok: false, message: persistErrorMessage(deleteError) }
  }

  const { error: insertError } = await supabase
    .from("purchase_order_item_account_assignments")
    .insert(
      persistedRows.map((row) => ({
        company_id: companyId,
        purchase_order_item_id: itemId,
        sequence: row.sequence,
        apportionment_percent: row.apportionment_percent,
        currency: row.currency || "BRL",
        ledger_account_code: row.ledger_account_code,
        business_area: row.business_area,
        controlling_area: row.controlling_area,
        cost_center_code: row.cost_center_code,
        internal_order_id: row.internal_order_id,
        wbs_element: row.wbs_element,
        asset_number: row.asset_number,
        profit_center: row.profit_center,
      })),
    )

  if (insertError) {
    return { ok: false, message: persistErrorMessage(insertError) }
  }
  return { ok: true }
}

export async function savePurchaseOrderAccountConfigs(
  supabase: SupabaseClient,
  companyId: string,
  configs: Record<string, ItemAccountConfigEdit>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const [itemId, config] of Object.entries(configs)) {
    const result = await savePurchaseOrderItemAccountConfig(
      supabase,
      companyId,
      itemId,
      config,
    )
    if (!result.ok) return result
  }
  return { ok: true }
}
