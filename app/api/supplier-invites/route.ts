import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { formatDateTimeLongBR } from "@/lib/formato-data"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { sendEmail } from "@/lib/email/send-email"
import { templateSupplierPortalInvite } from "@/lib/email/templates"
import { getAppEmailBaseUrl } from "@/lib/email/templates"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isValidCnpjLength, normalizeCnpj } from "@/lib/utils/cnpj"
import { logAuditServer } from "@/lib/audit-server"

const INVITE_TTL_DAYS = 7

function generateInviteToken(): string {
  return randomBytes(32).toString("hex")
}

/** POST — envia convite para admin do fornecedor */
export async function POST(request: Request) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const body = (await request.json()) as {
      supplierId?: string
      email?: string
    }

    if (!body.supplierId || !body.email?.trim()) {
      return NextResponse.json(
        { error: "Fornecedor e e-mail são obrigatórios." },
        { status: 400 },
      )
    }

    const email = body.email.trim().toLowerCase()
    const supabaseAdmin = createServiceRoleClient()

    const { data: supplier, error: supplierErr } = await supabaseAdmin
      .from("suppliers")
      .select("id, name, cnpj, email, status, company_id")
      .eq("id", body.supplierId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (supplierErr || !supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
    }

    if (supplier.status !== "active") {
      return NextResponse.json(
        { error: "Apenas fornecedores ativos podem receber convite." },
        { status: 400 },
      )
    }

    if (!isValidCnpjLength(supplier.cnpj)) {
      return NextResponse.json(
        {
          error:
            "Cadastre um CNPJ válido no fornecedor antes de enviar o convite (login do administrador).",
        },
        { status: 400 },
      )
    }

    const { data: existingAdmin } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("company_id", ctx.companyId)
      .eq("supplier_id", supplier.id)
      .eq("profile_type", "supplier")
      .eq("is_supplier_admin", true)
      .eq("status", "active")
      .maybeSingle()

    if (existingAdmin) {
      return NextResponse.json(
        {
          error:
            "Este fornecedor já possui administrador no portal. Adicione usuários adicionais pela gestão de usuários.",
        },
        { status: 409 },
      )
    }

    await supabaseAdmin
      .from("supplier_invites")
      .update({ status: "cancelled" })
      .eq("company_id", ctx.companyId)
      .eq("supplier_id", supplier.id)
      .eq("status", "pending")

    const token = generateInviteToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS)

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("supplier_invites")
      .insert({
        company_id: ctx.companyId,
        supplier_id: supplier.id,
        token,
        email,
        invited_by: ctx.userId,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select("id, token, expires_at")
      .single()

    if (inviteErr || !invite) {
      return NextResponse.json(
        { error: inviteErr?.message ?? "Erro ao criar convite." },
        { status: 500 },
      )
    }

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", ctx.companyId)
      .maybeSingle()

    const baseUrl = getAppEmailBaseUrl()
    const inviteUrl = `${baseUrl}/fornecedor/cadastro?token=${encodeURIComponent(token)}`
    const { subject, html } = templateSupplierPortalInvite({
      supplierName: supplier.name,
      buyerCompanyName: company?.name ?? "Comprador",
      inviteUrl,
      expiresAtLabel: formatDateTimeLongBR(invite.expires_at),
    })

    const emailSent = await sendEmail({ to: email, subject, html })

    await logAuditServer({
      eventType: "supplier.invite_sent",
      description: `Convite enviado para portal do fornecedor ${supplier.name}`,
      userId: ctx.userId,
      companyId: ctx.companyId,
      entity: "supplier",
      entityId: supplier.id,
      metadata: {
        inviteId: invite.id,
        email,
        cnpj: normalizeCnpj(supplier.cnpj),
      },
    })

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      emailSent,
      expiresAt: invite.expires_at,
      inviteUrl: process.env.NODE_ENV === "development" ? inviteUrl : undefined,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** GET ?supplierId= — convites e usuários do portal */
export async function GET(request: Request) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get("supplierId")
    if (!supplierId) {
      return NextResponse.json({ error: "supplierId obrigatório." }, { status: 400 })
    }

    const supabaseAdmin = createServiceRoleClient()

    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("id")
      .eq("id", supplierId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
    }

    const { data: invites } = await supabaseAdmin
      .from("supplier_invites")
      .select("id, email, status, expires_at, created_at, accepted_at")
      .eq("company_id", ctx.companyId)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(10)

    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, status, is_supplier_admin, login_cnpj, created_at")
      .eq("company_id", ctx.companyId)
      .eq("supplier_id", supplierId)
      .eq("profile_type", "supplier")
      .order("created_at", { ascending: true })

    return NextResponse.json({
      invites: invites ?? [],
      users: users ?? [],
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
