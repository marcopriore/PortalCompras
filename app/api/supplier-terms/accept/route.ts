import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      termId?: string
      purchaseOrderId?: string
      supplierId?: string
      termVersion?: string
      termVersionDate?: string
    }

    if (
      !body.termId ||
      !body.purchaseOrderId ||
      !body.supplierId ||
      !body.termVersion ||
      !body.termVersionDate
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("supplier_id, profile_type")
      .eq("id", user.id)
      .single()

    if (profile?.profile_type !== "supplier" || profile.supplier_id !== body.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const service = createServiceRoleClient()

    const { data: order, error: orderErr } = await service
      .from("purchase_orders")
      .select("id, company_id, supplier_id")
      .eq("id", body.purchaseOrderId)
      .single()

    if (orderErr || !order || order.supplier_id !== body.supplierId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: term, error: termErr } = await service
      .from("supplier_terms")
      .select("id, company_id, active")
      .eq("id", body.termId)
      .single()

    if (termErr || !term || !term.active || term.company_id !== order.company_id) {
      return NextResponse.json({ error: "Invalid term" }, { status: 400 })
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0]?.trim() : "unknown"

    const { error } = await service.from("supplier_term_acceptances").insert({
      term_id: body.termId,
      purchase_order_id: body.purchaseOrderId,
      supplier_id: body.supplierId,
      user_id: user.id,
      ip_address: ip,
      term_version: body.termVersion,
      term_version_date: body.termVersionDate,
    })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("supplier-terms/accept POST:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
