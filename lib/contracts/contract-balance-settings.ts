import type { SupabaseClient } from "@supabase/supabase-js"

export const CONTRACT_BALANCE_FEATURE_KEY = "contract_balance"
export const CONTRACT_PO_LINK_PROMPT_KEY = "contract_po_link_prompt_enabled"

export function parseContractPoLinkPrompt(
  value: string | null | undefined,
): boolean {
  if (value == null || value === "") return true
  const normalized = value.trim().toLowerCase()
  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes" ||
    normalized === "sim"
  )
}

export async function tenantHasContractBalance(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("tenant_features")
    .select("enabled")
    .eq("company_id", companyId)
    .eq("feature_key", CONTRACT_BALANCE_FEATURE_KEY)
    .maybeSingle()

  return Boolean(data?.enabled)
}

export async function loadContractPoLinkPromptEnabled(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("company_settings")
    .select("value")
    .eq("company_id", companyId)
    .eq("key", CONTRACT_PO_LINK_PROMPT_KEY)
    .maybeSingle()

  return parseContractPoLinkPrompt(data?.value as string | null | undefined)
}
