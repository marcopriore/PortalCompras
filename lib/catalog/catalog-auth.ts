import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CatalogAuthContext = {
  supabase: ReturnType<typeof createServerClient>
  companyId: string
  userId: string
  isSuperAdmin: boolean
  profileType: string
  fullName: string | null
}

export async function getCatalogAuthContext(): Promise<
  CatalogAuthContext | { error: NextResponse }
> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type, full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return {
    supabase,
    companyId,
    userId: user.id,
    isSuperAdmin,
    profileType: (profile.profile_type as string) ?? "buyer",
    fullName: profile.full_name as string | null,
  }
}

export async function tenantHasPurchaseCatalog(
  supabase: ReturnType<typeof createServerClient>,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("tenant_features")
    .select("enabled")
    .eq("company_id", companyId)
    .eq("feature_key", "purchase_catalog")
    .maybeSingle()

  return Boolean((data as { enabled?: boolean } | null)?.enabled)
}

export async function isCatalogBuyerReviewRequired(
  supabase: ReturnType<typeof createServerClient>,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("company_settings")
    .select("value")
    .eq("company_id", companyId)
    .eq("key", "catalog_buyer_review_required")
    .maybeSingle()

  const value = (data as { value?: string } | null)?.value
  if (value === undefined || value === null || value === "") return true
  return value !== "false" && value !== "0"
}

/** Superadmin opera em tenant via cookie — escrita usa service role para bypass de RLS. */
export function resolveCatalogDbClient(ctx: CatalogAuthContext): SupabaseClient {
  if (ctx.isSuperAdmin) {
    return createServiceRoleClient()
  }
  return ctx.supabase as unknown as SupabaseClient
}
