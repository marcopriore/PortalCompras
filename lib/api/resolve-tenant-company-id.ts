import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"

type ProfileRow = {
  company_id: string
  is_superadmin?: boolean | null
}

export async function resolveTenantCompanyId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ companyId: string } | { error: string; status: number }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin")
    .eq("id", userId)
    .single()

  if (error || !profile?.company_id) {
    return { error: "Company not found", status: 404 }
  }

  const row = profile as ProfileRow
  let companyId = row.company_id

  if (row.is_superadmin) {
    const cookieStore = await cookies()
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return { companyId }
}
