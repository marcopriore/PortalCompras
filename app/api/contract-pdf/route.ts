import { NextResponse } from "next/server"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  ContractPDF,
  type ContractPDFCompany,
  type ContractPDFContract,
  type ContractPDFItem,
} from "@/lib/pdf/contract-pdf"
import type { ContractKind, ContractStatus, ContractType } from "@/types/contracts"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get("id")
    if (!contractId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("company_id, supplier_id, profile_type, is_superadmin")
      .eq("id", user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    const { data: contractRow, error: contractError } = await service
      .from("contracts")
      .select(
        `
        *,
        suppliers(name, code, cnpj),
        payment_conditions(code, description)
      `,
      )
      .eq("id", contractId)
      .single()

    if (contractError || !contractRow) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const row = contractRow as {
      company_id: string
      supplier_id: string
      quotation_id: string | null
      suppliers:
        | { name: string; code: string; cnpj: string | null }
        | { name: string; code: string; cnpj: string | null }[]
        | null
      payment_conditions:
        | { code: string; description: string | null }
        | { code: string; description: string | null }[]
        | null
    }

    const isSupplier = profile.profile_type === "supplier"
    const isSuperAdmin = Boolean(profile.is_superadmin)
    let buyerCompanyId = profile.company_id as string

    if (!isSupplier && isSuperAdmin) {
      const cookieStore = await cookies()
      const selectedCookie = cookieStore.get("selected_company_id")
      if (selectedCookie?.value) {
        buyerCompanyId = decodeURIComponent(selectedCookie.value)
      }
    }

    const canAccess =
      (isSupplier &&
        profile.supplier_id != null &&
        profile.supplier_id === row.supplier_id) ||
      (!isSupplier && buyerCompanyId === row.company_id)

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: items } = await service
      .from("contract_items")
      .select("*")
      .eq("contract_id", contractId)
      .eq("eliminated", false)
      .order("created_at", { ascending: true })

    const { data: company } = await service
      .from("companies")
      .select("name, cnpj, logo_url")
      .eq("id", row.company_id)
      .single()

    let quotationCode: string | null = null
    if (row.quotation_id) {
      const { data: quotation } = await service
        .from("quotations")
        .select("code")
        .eq("id", row.quotation_id)
        .maybeSingle()
      quotationCode = quotation?.code != null ? String(quotation.code) : null
    }

    const supplierEmbed = Array.isArray(row.suppliers)
      ? row.suppliers[0]
      : row.suppliers
    const paymentEmbed = Array.isArray(row.payment_conditions)
      ? row.payment_conditions[0]
      : row.payment_conditions

    const paymentCondition =
      paymentEmbed?.code != null
        ? `${paymentEmbed.code}${paymentEmbed.description ? ` — ${paymentEmbed.description}` : ""}`
        : null

    const raw = contractRow as Record<string, unknown>

    const pdfContract: ContractPDFContract = {
      code: String(raw.code ?? ""),
      title: String(raw.title ?? ""),
      status: (raw.status as ContractStatus) ?? "draft",
      contract_kind: (raw.contract_kind as ContractKind) ?? "por_valor",
      type: (raw.type as ContractType | null) ?? null,
      start_date: String(raw.start_date ?? ""),
      end_date: String(raw.end_date ?? ""),
      value: raw.value != null ? Number(raw.value) : null,
      total_value: raw.total_value != null ? Number(raw.total_value) : null,
      consumed_value: Number(raw.consumed_value ?? 0),
      reserved_value: Number(raw.reserved_value ?? 0),
      payment_condition: paymentCondition,
      erp_code: raw.erp_code != null ? String(raw.erp_code) : null,
      quotation_code: quotationCode,
      contract_terms: raw.contract_terms != null ? String(raw.contract_terms) : null,
      notes: raw.notes != null ? String(raw.notes) : null,
      supplier_name: String(supplierEmbed?.name ?? ""),
      supplier_code: String(supplierEmbed?.code ?? ""),
      supplier_cnpj: supplierEmbed?.cnpj != null ? String(supplierEmbed.cnpj) : null,
      created_at: String(raw.created_at ?? ""),
      sent_for_acceptance_at:
        raw.sent_for_acceptance_at != null
          ? String(raw.sent_for_acceptance_at)
          : null,
      accepted_at: raw.accepted_at != null ? String(raw.accepted_at) : null,
    }

    const pdfItems: ContractPDFItem[] = (items ?? []).map(
      (item: Record<string, unknown>, index: number) => ({
        id: String(item.id),
        line_number: index + 1,
        material_code: String(item.material_code ?? ""),
        material_description: String(item.material_description ?? ""),
        unit_of_measure:
          item.unit_of_measure != null ? String(item.unit_of_measure) : null,
        quantity_contracted: Number(item.quantity_contracted ?? 0),
        quantity_consumed: Number(item.quantity_consumed ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        total_price: Number(item.total_price ?? 0),
        delivery_days:
          item.delivery_days != null ? Number(item.delivery_days) : null,
      }),
    )

    const pdfCompany = (company ?? null) as ContractPDFCompany

    const pdfBuffer = await renderToBuffer(
      createElement(ContractPDF, {
        contract: pdfContract,
        items: pdfItems,
        company: pdfCompany,
      }) as Parameters<typeof renderToBuffer>[0],
    )

    const safeCode = String(pdfContract.code ?? "contrato").replace(/[^\w\-./]+/g, "_")

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contrato_${safeCode}.pdf"`,
      },
    })
  } catch (e) {
    console.error("contract-pdf:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
