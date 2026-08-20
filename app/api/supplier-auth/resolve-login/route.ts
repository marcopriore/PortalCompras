import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { normalizeCnpj } from "@/lib/utils/cnpj"

/** POST — resolve CNPJ do administrador para e-mail de autenticação */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cnpj?: string }
    const cnpj = normalizeCnpj(body.cnpj)
    if (cnpj.length !== 14) {
      return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 })
    }

    const supabaseAdmin = createServiceRoleClient()
    const authAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("login_cnpj", cnpj)
      .eq("status", "active")

    if (!profiles?.length) {
      return NextResponse.json(
        { error: "CNPJ não encontrado ou administrador inativo." },
        { status: 404 },
      )
    }

    if (profiles.length > 1) {
      const options = await Promise.all(
        profiles.map(async (p) => {
          const { data: authUser } = await authAdmin.auth.admin.getUserById(p.id)
          const { data: company } = await supabaseAdmin
            .from("companies")
            .select("name")
            .eq("id", p.company_id)
            .maybeSingle()
          return {
            email: authUser?.user?.email ?? "",
            companyName: company?.name ?? "Comprador",
          }
        }),
      )
      return NextResponse.json({ multiple: true, options })
    }

    const { data: authUser } = await authAdmin.auth.admin.getUserById(profiles[0]!.id)
    const email = authUser?.user?.email
    if (!email) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    }

    return NextResponse.json({ email })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
