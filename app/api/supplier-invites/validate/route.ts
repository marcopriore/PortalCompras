import { NextResponse } from "next/server"
import { findAuthUserByEmail } from "@/lib/supplier-portal/memberships"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { formatCnpj } from "@/lib/utils/cnpj"

/** GET ?token= — valida convite (público, dados limitados) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")?.trim()
    if (!token) {
      return NextResponse.json({ error: "Token ausente." }, { status: 400 })
    }

    const supabaseAdmin = createServiceRoleClient()

    const { data: invite } = await supabaseAdmin
      .from("supplier_invites")
      .select("id, email, status, expires_at, company_id, supplier_id, invited_by")
      .eq("token", token)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ error: "Convite inválido." }, { status: 404 })
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Este convite já foi utilizado ou cancelado." },
        { status: 410 },
      )
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from("supplier_invites")
        .update({ status: "expired" })
        .eq("id", invite.id)

      return NextResponse.json({ error: "Convite expirado." }, { status: 410 })
    }

    const [{ data: supplier }, { data: company }, { data: inviter }] = await Promise.all([
      supabaseAdmin
        .from("suppliers")
        .select("name, cnpj, code")
        .eq("id", invite.supplier_id)
        .maybeSingle(),
      supabaseAdmin
        .from("companies")
        .select("name")
        .eq("id", invite.company_id)
        .maybeSingle(),
      invite.invited_by
        ? supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", invite.invited_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const authUser = await findAuthUserByEmail(invite.email)
    let mode: "register" | "link" = "register"
    let existingUser: { fullName: string; email: string } | null = null

    if (authUser) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, profile_type, status")
        .eq("id", authUser.id)
        .maybeSingle()

      if (
        profile?.profile_type === "supplier" &&
        profile.status === "active"
      ) {
        mode = "link"
        existingUser = {
          fullName: profile.full_name?.trim() || authUser.user_metadata?.full_name || "—",
          email: invite.email,
        }
      }
    }

    return NextResponse.json({
      valid: true,
      mode,
      email: invite.email,
      supplierName: supplier?.name ?? "",
      supplierCode: supplier?.code ?? "",
      cnpjMasked: supplier?.cnpj ? maskCnpj(supplier.cnpj) : "",
      cnpjFormatted: supplier?.cnpj ? formatCnpj(supplier.cnpj) : "",
      companyName: company?.name ?? "",
      invitedByName: inviter?.full_name?.trim() || "Comprador",
      existingUser,
      expiresAt: invite.expires_at,
      // legado — manter para compatibilidade temporária
      buyerCompanyName: company?.name ?? "",
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

function maskCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "")
  if (d.length < 14) return "**.***.***/****-**"
  return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-${d.slice(12, 14)}`
}
