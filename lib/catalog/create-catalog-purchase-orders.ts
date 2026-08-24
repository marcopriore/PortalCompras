import type { SupabaseClient } from "@supabase/supabase-js"
import { validateCatalogLineQuantity } from "@/lib/catalog/validate-cart-line"
import type { CatalogCheckoutInput } from "@/lib/catalog/checkout"
import type { ContractKind } from "@/types/contracts"

export type CatalogCartLineRow = {
  id: string
  contract_id: string
  contract_item_id: string
  supplier_id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  unit_price: number
  contract_kind: ContractKind
  quantity: number
}

export type CatalogPurchaseOrderResult = {
  purchaseOrders: Array<{ id: string; code: string; supplierId: string }>
}

function unwrapJoin<T>(value: T | T[] | null): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function groupBySupplier(items: CatalogCartLineRow[]): Map<string, CatalogCartLineRow[]> {
  const groups = new Map<string, CatalogCartLineRow[]>()
  for (const item of items) {
    const list = groups.get(item.supplier_id) ?? []
    list.push(item)
    groups.set(item.supplier_id, list)
  }
  return groups
}

async function loadContractItemDetails(
  db: SupabaseClient,
  contractItemIds: string[],
) {
  if (contractItemIds.length === 0) return new Map<string, Parameters<typeof validateCatalogLineQuantity>[1] & { delivery_days: number | null }>()

  const { data } = await db
    .from("contract_items")
    .select(
      "id, delivery_days, quantity_contracted, quantity_consumed, reserved_quantity, eliminated, total_price, consumed_value, reserved_value, unit_price",
    )
    .in("id", contractItemIds)

  type Row = Parameters<typeof validateCatalogLineQuantity>[1] & {
    id: string
    delivery_days: number | null
  }

  return new Map(
    ((data ?? []) as Row[]).map((row) => [
      row.id,
      row,
    ]),
  )
}

async function rollbackPurchaseOrder(db: SupabaseClient, orderId: string) {
  try {
    await db.rpc("release_contract_balance", { p_order_id: orderId })
  } catch {}
  await db.from("purchase_orders").delete().eq("id", orderId)
}

export async function createCatalogPurchaseOrders(
  db: SupabaseClient,
  companyId: string,
  userId: string,
  cartItems: CatalogCartLineRow[],
  input: CatalogCheckoutInput,
): Promise<
  { ok: true; result: CatalogPurchaseOrderResult } | { ok: false; error: string }
> {
  if (cartItems.length === 0) {
    return { ok: false, error: "Carrinho vazio" }
  }
  if (!input.title.trim()) {
    return { ok: false, error: "Título é obrigatório" }
  }
  if (!input.costCenter.trim()) {
    return { ok: false, error: "Centro de custo é obrigatório" }
  }

  const contractItemIds = cartItems.map((i) => i.contract_item_id)
  const contractItemMap = await loadContractItemDetails(db, contractItemIds)

  for (const line of cartItems) {
    const ci = contractItemMap.get(line.contract_item_id)
    if (!ci || ci.eliminated) {
      return { ok: false, error: `Item ${line.material_code} indisponível no contrato` }
    }
    const err = validateCatalogLineQuantity(line.contract_kind, ci, Number(line.quantity))
    if (err) return { ok: false, error: `${line.material_description}: ${err}` }
  }

  const supplierIds = [...new Set(cartItems.map((i) => i.supplier_id))]
  const { data: suppliersData } = await db
    .from("suppliers")
    .select("id, name, cnpj")
    .eq("company_id", companyId)
    .in("id", supplierIds)

  const supplierMap = new Map(
    ((suppliersData ?? []) as Array<{ id: string; name: string; cnpj: string | null }>).map(
      (s) => [s.id, s],
    ),
  )

  const contractIds = [...new Set(cartItems.map((i) => i.contract_id))]
  const { data: contractsData } = await db
    .from("contracts")
    .select("id, code, payment_conditions(code, description)")
    .eq("company_id", companyId)
    .in("id", contractIds)

  const contractMap = new Map(
    ((contractsData ?? []) as Array<{
      id: string
      code: string
      payment_conditions: { code: string; description: string } | { code: string; description: string }[] | null
    }>).map((c) => [c.id, c]),
  )

  const groups = groupBySupplier(cartItems)
  const created: CatalogPurchaseOrderResult["purchaseOrders"] = []

  for (const [supplierId, lines] of groups) {
    const supplier = supplierMap.get(supplierId)
    const firstContract = contractMap.get(lines[0].contract_id)
    const payment = unwrapJoin(firstContract?.payment_conditions ?? null)
    const paymentLabel = payment
      ? [payment.code, payment.description].filter(Boolean).join(" — ")
      : null

    let totalPrice = 0
    let maxDeliveryDays = 0
    const contractCodes = new Set<string>()

    const poLines = lines.map((line) => {
      const ci = contractItemMap.get(line.contract_item_id)
      const deliveryDays = ci?.delivery_days ?? null
      if (deliveryDays != null && deliveryDays > maxDeliveryDays) {
        maxDeliveryDays = deliveryDays
      }
      const contractCode = contractMap.get(line.contract_id)?.code
      if (contractCode) contractCodes.add(contractCode)

      const lineTotal = Number(line.quantity) * Number(line.unit_price)
      totalPrice += lineTotal

      return {
        contract_id: line.contract_id,
        contract_item_id: line.contract_item_id,
        material_code: line.material_code,
        material_description: line.material_description,
        unit_of_measure: line.unit_of_measure,
        quantity: line.quantity,
        unit_price: line.unit_price,
        delivery_days: deliveryDays,
      }
    })

    const observationParts = [
      `Pedido originado do Catálogo de Compras: ${input.title.trim()}`,
      `Centro de custo: ${input.costCenter.trim()}`,
      contractCodes.size > 0
        ? `Contrato(s): ${[...contractCodes].join(", ")}`
        : null,
      input.description?.trim() ? input.description.trim() : null,
      input.neededBy?.trim() ? `Necessidade: ${input.neededBy.trim()}` : null,
    ].filter(Boolean)

    const { data: poData, error: poErr } = await db
      .from("purchase_orders")
      .insert({
        company_id: companyId,
        supplier_id: supplierId,
        supplier_name: supplier?.name ?? "—",
        supplier_cnpj: supplier?.cnpj ?? null,
        payment_condition: paymentLabel,
        delivery_days: maxDeliveryDays > 0 ? maxDeliveryDays : null,
        delivery_address: "A definir",
        quotation_code: null,
        requisition_code: null,
        total_price: Math.round(totalPrice * 100) / 100,
        observations: observationParts.join("\n"),
        created_by: userId,
        status: "draft",
      })
      .select("id, code")
      .single()

    if (poErr || !poData) {
      for (const po of created) {
        await rollbackPurchaseOrder(db, po.id)
      }
      return { ok: false, error: poErr?.message ?? "Falha ao criar pedido" }
    }

    const poId = poData.id as string

    const { error: itemsErr } = await db.from("purchase_order_items").insert(
      poLines.map((line) => ({
        purchase_order_id: poId,
        company_id: companyId,
        contract_id: line.contract_id,
        contract_item_id: line.contract_item_id,
        material_code: line.material_code,
        material_description: line.material_description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        unit_price: line.unit_price,
        tax_percent: null,
        delivery_days: line.delivery_days,
      })),
    )

    if (itemsErr) {
      await rollbackPurchaseOrder(db, poId)
      for (const po of created) {
        await rollbackPurchaseOrder(db, po.id)
      }
      return { ok: false, error: itemsErr.message }
    }

    const { error: reserveErr } = await db.rpc("reserve_contract_balance", {
      p_order_id: poId,
    })

    if (reserveErr) {
      await rollbackPurchaseOrder(db, poId)
      for (const po of created) {
        await rollbackPurchaseOrder(db, po.id)
      }
      return {
        ok: false,
        error: reserveErr.message ?? "Saldo do contrato insuficiente",
      }
    }

    const { error: flagErr } = await db
      .from("purchase_orders")
      .update({ contract_balance_applied: "reserved" })
      .eq("id", poId)

    if (flagErr) {
      await rollbackPurchaseOrder(db, poId)
      for (const po of created) {
        await rollbackPurchaseOrder(db, po.id)
      }
      return { ok: false, error: flagErr.message }
    }

    created.push({
      id: poId,
      code: poData.code as string,
      supplierId,
    })
  }

  return { ok: true, result: { purchaseOrders: created } }
}
