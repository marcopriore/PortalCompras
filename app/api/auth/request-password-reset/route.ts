import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/send-email"
import {
  getAppEmailBaseUrl,
  templatePasswordReset,
} from "@/lib/email/templates"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { normalizeCnpj, looksLikeCnpjInput } from "@/lib/utils/cnpj"
import { normalizeImportedEmail } from "@/lib/utils/excel-cell"

type Portal = "fornecedor" | "comprador"

type Body = {
  email?: string
  login?: string
  portal?: Portal
}

function authAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Resposta genérica — não revela se a conta existe. */
function okResponse() {
  return NextResponse.json({
    success: true,
    message:
      "Se existir uma conta ativa com esses dados, enviamos um e-mail com o link de redefinição.",
  })
}

async function resolveEmailForSupplierLogin(
  loginRaw: string,
): Promise<{ email: string } | { error: string; status: number; multiple?: boolean }> {
  if (looksLikeCnpjInput(loginRaw)) {
    const cnpj = normalizeCnpj(loginRaw)
    if (cnpj.length !== 14) {
      return { error: "CNPJ inválido.", status: 400 }
    }

    const service = createServiceRoleClient()
    const admin = authAdmin()
    const { data: profiles } = await service
      .from("profiles")
      .select("id, company_id")
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("login_cnpj", cnpj)
      .eq("status", "active")

    if (!profiles?.length) {
      return { error: "CNPJ não encontrado.", status: 404 }
    }
    if (profiles.length > 1) {
      return {
        error: "CNPJ vinculado a vários compradores. Use o e-mail cadastrado.",
        status: 400,
        multiple: true,
      }
    }

    const { data: authUser } = await admin.auth.admin.getUserById(profiles[0]!.id)
    const email = authUser?.user?.email
    if (!email) return { error: "Usuário não encontrado.", status: 404 }
    return { email }
  }

  const email = normalizeImportedEmail(loginRaw)
  if (!email) return { error: "Informe um e-mail ou CNPJ válido.", status: 400 }
  return { email }
}

/**
 * Solicita recuperação de senha e envia o link via Resend (não depende do SMTP do Supabase).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const portal: Portal = body.portal === "fornecedor" ? "fornecedor" : "comprador"
    const loginRaw = (body.login ?? body.email ?? "").trim()

    if (!loginRaw) {
      return NextResponse.json({ error: "Informe e-mail ou CNPJ." }, { status: 400 })
    }

    let email: string
    if (portal === "fornecedor") {
      const resolved = await resolveEmailForSupplierLogin(loginRaw)
      if ("error" in resolved) {
        if (resolved.status === 404) return okResponse()
        return NextResponse.json(
          { error: resolved.error, multiple: resolved.multiple },
          { status: resolved.status },
        )
      }
      email = resolved.email
    } else {
      const normalized = normalizeImportedEmail(loginRaw)
      if (!normalized) {
        return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 })
      }
      email = normalized
    }

    const service = createServiceRoleClient()
    const admin = authAdmin()
    const baseUrl = getAppEmailBaseUrl().replace(/\/$/, "")
    const redirectPath =
      portal === "fornecedor"
        ? "/fornecedor/alterar-senha?recovery=1"
        : "/comprador/alterar-senha?recovery=1"
    const redirectTo = `${baseUrl}${redirectPath}`

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    })

    if (linkError || !linkData?.properties?.action_link || !linkData.user?.id) {
      // Conta inexistente ou falha — resposta genérica
      if (linkError) {
        console.error("[request-password-reset] generateLink:", linkError.message)
      }
      return okResponse()
    }

    const { data: profile } = await service
      .from("profiles")
      .select("profile_type, status")
      .eq("id", linkData.user.id)
      .maybeSingle()

    if (!profile || profile.status !== "active") {
      return okResponse()
    }

    const profileType = String(profile.profile_type)
    if (portal === "fornecedor" && profileType !== "supplier") {
      return okResponse()
    }
    if (portal === "comprador" && profileType === "supplier") {
      return okResponse()
    }

    const portalLabel =
      portal === "fornecedor"
        ? "Portal do Fornecedor"
        : profileType === "requester"
          ? "Portal do Solicitante"
          : "Portal do Comprador"

    const { subject, html } = templatePasswordReset({
      resetUrl: linkData.properties.action_link,
      portalLabel,
    })

    const sent = await sendEmail({ to: email, subject, html })
    if (!sent) {
      console.error("[request-password-reset] sendEmail failed for", email)
      return NextResponse.json(
        { error: "Não foi possível enviar o e-mail. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    return okResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    console.error("[request-password-reset]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
