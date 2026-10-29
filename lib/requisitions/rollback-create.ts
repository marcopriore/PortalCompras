import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * After a failed item INSERT the REQ header already exists. RLS usually
 * blocks DELETE on requisitions, so cancel the orphan instead of leaving
 * an empty draft/pending row that retries then duplicate.
 */
export async function abandonFailedRequisitionCreate(
  supabase: SupabaseClient,
  requisitionId: string,
): Promise<void> {
  await supabase.from("requisition_items").delete().eq("requisition_id", requisitionId)

  const { error: deleteError } = await supabase
    .from("requisitions")
    .delete()
    .eq("id", requisitionId)

  if (!deleteError) return

  await supabase
    .from("requisitions")
    .update({ status: "cancelled" })
    .eq("id", requisitionId)
}
