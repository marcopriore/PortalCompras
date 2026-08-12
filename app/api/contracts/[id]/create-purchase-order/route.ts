import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isContractEligibleForPurchaseOrder } from "@/lib/contracts/contract-balance-helpers"
import { tenantHasContractBalance } from "@/lib/contracts/contract-balance-settings"

async function getBuyerContext() {
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
          } catch {}
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return { supabase, companyId, userId: user.id, isSuperAdmin }
}

type RouteCtx = { params: Promise<{ id: string }> }

type CreatePoItemInput = {
  contract_item_id: string
  quantity: number
}

export async function POST(request: Request, context: RouteCtx) {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const contractBalanceEnabled = await tenantHasContractBalance(
      ctx.supabase,
      ctx.companyId,
    )
    if (!contractBalanceEnabled) {
      return NextResponse.json(
        { error: "Funcionalidade Consumo de Contrato não habilitada" },
        { status: 403 },
      )
    }

    const { id: contractId } = await context.params
    const body = (await request.json()) as {
      items?: CreatePoItemInput[]
      observations?: string
    }

    const items = body.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um item" }, { status: 400 })
    }

    for (const item of items) {
      if (typeof item.contract_item_id !== "string" || !item.contract_item_id) {
        return NextResponse.json({ error: "Item inválido" }, { status: 400 })
      }
      if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 })
      }
    }

    const { data: contract, error: contractErr } = await ctx.supabase
      .from("contracts")
      .select(
        `
        id,
        company_id,
        supplier_id,
        code,
        title,
        status,
        contract_kind,
        start_date,
        end_date,
        suppliers(name, cnpj),
        payment_conditions(code, description),
        contract_items(
          id,
          material_code,
          material_description,
          unit_of_measure,
          unit_price,
          delivery_days,
          quantity_contracted,
          quantity_consumed,
          reserved_quantity,
          eliminated
        )
      `,
      )
      .eq("id", contractId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (contractErr) {
      return NextResponse.json({ error: contractErr.message }, { status: 500 })
    }
    if (!contract) {
      return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 })
    }

    if (!isContractEligibleForPurchaseOrder(contract)) {
      return NextResponse.json(
        { error: "Contrato não está ativo ou está fora da vigência" },
        { status: 400 },
      )
    }

    const contractItems = (contract.contract_items ?? []) as Array<{
      id: string
      material_code: string
      material_description: string
      unit_of_measure: string | null
      unit_price: number
      delivery_days: number | null
      quantity_contracted: number
      quantity_consumed: number
      reserved_quantity: number
      eliminated: boolean
    }>

    const itemMap = new Map(contractItems.map((i) => [i.id, i]))
    const poLines: {
      contract_id: string
      contract_item_id: string
      material_code: string
      material_description: string
      unit_of_measure: string | null
      quantity: number
      unit_price: number
      delivery_days: number | null
    }[] = []

    let totalPrice = 0
    let maxDeliveryDays = 0

    for (const input of items) {
      const ci = itemMap.get(input.contract_item_id)
      if (!ci || ci.eliminated) {
        return NextResponse.json({ error: "Item do contrato inválido" }, { status: 400 })
      }

      poLines.push({
        contract_id: contractId,
        contract_item_id: ci.id,
        material_code: ci.material_code,
        material_description: ci.material_description,
        unit_of_measure: ci.unit_of_measure,
        quantity: input.quantity,
        unit_price: Number(ci.unit_price),
        delivery_days: ci.delivery_days,
      })

      totalPrice += input.quantity * Number(ci.unit_price)
      if (ci.delivery_days != null && ci.delivery_days > maxDeliveryDays) {
        maxDeliveryDays = ci.delivery_days
      }
    }

    const supplier = Array.isArray(contract.suppliers)
      ? contract.suppliers[0]
      : contract.suppliers
    const paymentCond = Array.isArray(contract.payment_conditions)
      ? contract.payment_conditions[0]
      : contract.payment_conditions

    const paymentLabel = paymentCond
      ? [paymentCond.code, paymentCond.description].filter(Boolean).join(" — ")
      : null

    const observations =
      typeof body.observations === "string" && body.observations.trim()
        ? body.observations.trim()
        : `Pedido vinculado ao contrato ${contract.code}`

    const admin = createServiceRoleClient()

    const { data: poData, error: poErr } = await admin
      .from("purchase_orders")
      .insert({
        company_id: ctx.companyId,
        supplier_id: contract.supplier_id,
        supplier_name: supplier?.name ?? "—",
        supplier_cnpj: supplier?.cnpj ?? null,
        payment_condition: paymentLabel,
        delivery_days: maxDeliveryDays > 0 ? maxDeliveryDays : null,
        delivery_address: "A definir",
        quotation_code: null,
        requisition_code: null,
        total_price: Math.round(totalPrice * 100) / 100,
        observations,
        created_by: ctx.userId,
        status: "draft",
      })
      .select("id, code")
      .single()

    if (poErr || !poData) {
      return NextResponse.json(
        { error: poErr?.message ?? "Falha ao criar pedido" },
        { status: 500 },
      )
    }

    const poItemsPayload = poLines.map((line) => ({
      purchase_order_id: poData.id,
      company_id: ctx.companyId,
      contract_id: line.contract_id,
      contract_item_id: line.contract_item_id,
      material_code: line.material_code,
      material_description: line.material_description,
      quantity: line.quantity,
      unit_of_measure: line.unit_of_measure,
      unit_price: line.unit_price,
      tax_percent: null,
      delivery_days: line.delivery_days,
    }))

    const { error: itemsErr } = await admin
      .from("purchase_order_items")
      .insert(poItemsPayload)

    if (itemsErr) {
      await admin.from("purchase_orders").delete().eq("id", poData.id)
      return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }

    const { error: reserveErr } = await admin.rpc("reserve_contract_balance", {
      p_order_id: poData.id,
    })

    if (reserveErr) {
      await admin.from("purchase_orders").delete().eq("id", poData.id)
      return NextResponse.json(
        { error: reserveErr.message ?? "Saldo do contrato insuficiente" },
        { status: 400 },
      )
    }

    const { error: flagErr } = await admin
      .from("purchase_orders")
      .update({ contract_balance_applied: "reserved" })
      .eq("id", poData.id)

    if (flagErr) {
      await admin.rpc("release_contract_balance", { p_order_id: poData.id })
      await admin.from("purchase_orders").delete().eq("id", poData.id)
      return NextResponse.json({ error: flagErr.message }, { status: 500 })
    }

    return NextResponse.json({
      purchase_order: {
        id: poData.id,
        code: poData.code,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
