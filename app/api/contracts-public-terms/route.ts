import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("contracts")
      .select(
        "id, title, code, type, status, start_date, end_date, contract_terms, suppliers(name)",
      )
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const row = data as {
      id: string
      title: string
      code: string
      type: string
      status: string
      start_date: string
      end_date: string
      contract_terms: string | null
      suppliers: { name: string } | { name: string }[] | null
    }

    const sup = row.suppliers
    const supplierName = Array.isArray(sup) ? sup[0]?.name : sup?.name

    return NextResponse.json({
      contract: {
        id: row.id,
        title: row.title,
        code: row.code,
        type: row.type,
        status: row.status,
        start_date: row.start_date,
        end_date: row.end_date,
        contract_terms: row.contract_terms,
        supplier_name: supplierName ?? "",
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
