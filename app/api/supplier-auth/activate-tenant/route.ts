import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { activateSupplierTenant } from "@/lib/supplier-portal/memberships"

/** POST — define tenant ativo do fornecedor após login (multi-comprador). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { companyId?: string; supplierId?: string }
    const companyId = body.companyId?.trim()
    const supplierId = body.supplierId?.trim()

    if (!companyId || !supplierId) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
    }

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
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    }

    const result = await activateSupplierTenant(user.id, companyId, supplierId)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[supplier-auth/activate-tenant]", error)
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
