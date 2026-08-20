import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/send-email"
import {
  getAppEmailBaseUrl,
  templatePasswordReset,
} from "@/lib/email/templates"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { looksLikeCnpjInput } from "@/lib/utils/cnpj"
import { normalizeImportedEmail } from "@/lib/utils/excel-cell"
import { resolveSupplierAdminByCnpj } from "@/lib/supplier-portal/resolve-admin-by-cnpj"

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

function okResponse(extra?: { emailedTo?: string }) {
  return NextResponse.json({
    success: true,
    message:
      "Se existir uma conta ativa com esses dados, enviamos um e-mail com o link de redefinição.",
    ...extra,
  })
}

function maskEmail(email: string): string {
  return email.replace(/(.{1,2}).+(@.+)/, "$1***$2")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const portal: Portal = body.portal === "fornecedor" ? "fornecedor" : "comprador"
    const loginRaw = (body.login ?? body.email ?? "").trim()
    const usedCnpj = portal === "fornecedor" && looksLikeCnpjInput(loginRaw)

    if (!loginRaw) {
      return NextResponse.json({ error: "Informe e-mail ou CNPJ." }, { status: 400 })
    }

    let email: string

    if (portal === "fornecedor" && usedCnpj) {
      const resolved = await resolveSupplierAdminByCnpj(loginRaw)
      if ("error" in resolved) {
        if (resolved.multiple && resolved.options?.length) {
          return NextResponse.json(
            {
              error: resolved.error,
              multiple: true,
              options: resolved.options,
            },
            { status: 409 },
          )
        }
        return NextResponse.json(
          { error: resolved.error, multiple: resolved.multiple },
          { status: resolved.status },
        )
      }
      email = resolved.email
    } else if (portal === "fornecedor") {
      const normalized = normalizeImportedEmail(loginRaw)
      if (!normalized) {
        return NextResponse.json({ error: "Informe um e-mail ou CNPJ válido." }, { status: 400 })
      }
      email = normalized
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
    const nextPath =
      portal === "fornecedor"
        ? "/auth/redefinir-senha?portal=fornecedor"
        : "/auth/redefinir-senha?portal=comprador"

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    })

    const hashedToken = linkData?.properties?.hashed_token
    if (linkError || !hashedToken || !linkData?.user?.id) {
      if (linkError) {
        console.error("[request-password-reset] generateLink:", linkError.message)
      }
      if (usedCnpj) {
        return NextResponse.json(
          { error: "Não foi possível gerar o link de recuperação. Tente novamente." },
          { status: 500 },
        )
      }
      return okResponse()
    }

    const { data: profile } = await service
      .from("profiles")
      .select("profile_type, status")
      .eq("id", linkData.user.id)
      .maybeSingle()

    if (!profile || profile.status !== "active") {
      if (usedCnpj) {
        return NextResponse.json(
          { error: "Conta do administrador inativa ou indisponível." },
          { status: 404 },
        )
      }
      return okResponse()
    }

    const profileType = String(profile.profile_type)
    if (portal === "fornecedor" && profileType !== "supplier") {
      if (usedCnpj) {
        return NextResponse.json(
          { error: "CNPJ não corresponde a um usuário do portal fornecedor." },
          { status: 400 },
        )
      }
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

    const resetUrl =
      `${baseUrl}/auth/confirm` +
      `?token_hash=${encodeURIComponent(hashedToken)}` +
      `&type=recovery` +
      `&next=${encodeURIComponent(nextPath)}`

    const { subject, html } = templatePasswordReset({
      resetUrl,
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

    return okResponse(usedCnpj ? { emailedTo: maskEmail(email) } : undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    console.error("[request-password-reset]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
