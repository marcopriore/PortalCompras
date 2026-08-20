import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export type SupplierContext = {
  supabase: ReturnType<typeof createServerClient>
  userId: string
  companyId: string
  supplierId: string
  isSupplierAdmin: boolean
  fullName: string | null
}

export type SupplierContextResult = SupplierContext | { error: NextResponse }

export async function getSupplierContext(): Promise<SupplierContextResult> {
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
          } catch {
            /* ignore */
          }
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
    .select("company_id, supplier_id, profile_type, status, is_supplier_admin, full_name")
    .eq("id", user.id)
    .single()

  if (
    !profile?.company_id ||
    !profile.supplier_id ||
    profile.profile_type !== "supplier" ||
    profile.status !== "active"
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    supabase,
    userId: user.id,
    companyId: profile.company_id as string,
    supplierId: profile.supplier_id as string,
    isSupplierAdmin: Boolean(profile.is_supplier_admin),
    fullName: profile.full_name ?? null,
  }
}
