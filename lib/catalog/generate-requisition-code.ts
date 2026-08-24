import type { SupabaseClient } from "@supabase/supabase-js"

export async function generateRequisitionCode(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string> {
  const { count } = await supabase
    .from("requisitions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  return `REQ-${String((count ?? 0) + 1).padStart(4, "0")}`
}
