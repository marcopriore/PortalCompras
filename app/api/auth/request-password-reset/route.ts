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

function okResponse() {
  return NextResponse.json({
    success: true,
    message:
      "Se existir uma conta ativa com esses dados, enviamos um e-mail com o link de redefinição.",
  })
}

async function emailForUserId(userId: string): Promise<string | null> {
  const { data } = await authAdmin().auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

/**
 * Resolve e-mail do admin pelo CNPJ (somente dígitos na query — máscara quebra o filtro PostgREST).
 */
async function resolveEmailForSupplierCnpj(
  cnpjDigits: string,
): Promise<{ email: string } | { error: string; status: number; multiple?: boolean }> {
  const service = createServiceRoleClient()

  // 1) Mesma lógica do login: login_cnpj = só dígitos
  const { data: byLogin, error: loginErr } = await service
    .from("profiles")
    .select("id, company_id, supplier_id")
    .eq("profile_type", "supplier")
    .eq("is_supplier_admin", true)
    .eq("status", "active")
    .eq("login_cnpj", cnpjDigits)

  if (loginErr) {
    console.error("[request-password-reset] login_cnpj query:", loginErr.message)
  }

  let adminIds = (byLogin ?? []).map((p) => p.id)

  // 2) Fallback: suppliers.cnpj (normaliza em memória — valores podem ter máscara)
  if (adminIds.length === 0) {
    const { data: suppliers, error: supErr } = await service
      .from("suppliers")
      .select("id, company_id, cnpj, status")

    if (supErr) {
      console.error("[request-password-reset] suppliers query:", supErr.message)
    }

    const matched = (suppliers ?? []).filter(
      (s) =>
        (s.status == null || s.status === "active") &&
        normalizeCnpj(s.cnpj) === cnpjDigits,
    )

    if (matched.length === 0) {
      return {
        error: "CNPJ não encontrado. Confira o número ou use o e-mail cadastrado.",
        status: 404,
      }
    }

    const admins: { id: string }[] = []
    for (const s of matched) {
      const { data: admin } = await service
        .from("profiles")
        .select("id")
        .eq("company_id", s.company_id)
        .eq("supplier_id", s.id)
        .eq("profile_type", "supplier")
        .eq("is_supplier_admin", true)
        .eq("status", "active")
        .maybeSingle()
      if (admin) admins.push(admin)
    }

    if (admins.length === 0) {
      return {
        error:
          "Fornecedor encontrado, mas sem administrador ativo no portal. Use o e-mail do usuário ou conclua o convite.",
        status: 404,
      }
    }
    adminIds = [...new Set(admins.map((a) => a.id))]
  }

  if (adminIds.length > 1) {
    return {
      error: "CNPJ vinculado a vários compradores. Use o e-mail cadastrado do administrador.",
      status: 400,
      multiple: true,
    }
  }

  const email = await emailForUserId(adminIds[0]!)
  if (!email) {
    return {
      error: "Administrador sem e-mail de autenticação. Contate o suporte.",
      status: 404,
    }
  }
  return { email }
}

async function resolveEmailForSupplierLogin(
  loginRaw: string,
): Promise<{ email: string } | { error: string; status: number; multiple?: boolean }> {
  if (looksLikeCnpjInput(loginRaw)) {
    const cnpj = normalizeCnpj(loginRaw)
    if (cnpj.length !== 14) {
      return { error: "CNPJ inválido. Informe os 14 dígitos.", status: 400 }
    }
    return resolveEmailForSupplierCnpj(cnpj)
  }

  const email = normalizeImportedEmail(loginRaw)
  if (!email) return { error: "Informe um e-mail ou CNPJ válido.", status: 400 }
  return { email }
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
    if (portal === "fornecedor") {
      const resolved = await resolveEmailForSupplierLogin(loginRaw)
      if ("error" in resolved) {
        if (usedCnpj) {
          return NextResponse.json(
            { error: resolved.error, multiple: resolved.multiple },
            { status: resolved.status },
          )
        }
        return okResponse()
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
          {
            error: `E-mail encontrado (${email.replace(/(.{2}).+(@.+)/, "$1***$2")}), mas falhou ao gerar o link. Tente novamente.`,
          },
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

    return okResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    console.error("[request-password-reset]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
