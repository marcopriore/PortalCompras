import type { SupabaseClient } from "@supabase/supabase-js"
import { generateRequisitionCode } from "@/lib/catalog/generate-requisition-code"
import { validateCatalogLineQuantity } from "@/lib/catalog/validate-cart-line"
import type { CatalogCartItem } from "@/lib/catalog/types"
import type { ContractKind } from "@/types/contracts"

export type CatalogCheckoutInput = {
  title: string
  costCenter: string
  neededBy?: string | null
  priority?: "normal" | "urgent" | "critical"
  description?: string | null
}

export type CatalogCheckoutResult = {
  requisitions: Array<{ id: string; code: string; supplierId: string }>
}

type CartItemRow = {
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

async function loadContractItem(
  supabase: SupabaseClient,
  contractItemId: string,
) {
  const { data } = await supabase
    .from("contract_items")
    .select(
      "quantity_contracted, quantity_consumed, reserved_quantity, eliminated, total_price, consumed_value, reserved_value, unit_price",
    )
    .eq("id", contractItemId)
    .maybeSingle()

  return data
}

async function validateCartItems(
  supabase: SupabaseClient,
  items: CartItemRow[],
): Promise<string | null> {
  for (const item of items) {
    const ciRow = await loadContractItem(supabase, item.contract_item_id)
    if (!ciRow || (ciRow as { eliminated?: boolean }).eliminated) {
      return `Item ${item.material_code} não está mais disponível no contrato`
    }

    const err = validateCatalogLineQuantity(
      item.contract_kind,
      ciRow as Parameters<typeof validateCatalogLineQuantity>[1],
      Number(item.quantity),
    )
    if (err) return `${item.material_description}: ${err}`
  }
  return null
}

function groupBySupplier(items: CartItemRow[]): Map<string, CartItemRow[]> {
  const groups = new Map<string, CartItemRow[]>()
  for (const item of items) {
    const list = groups.get(item.supplier_id) ?? []
    list.push(item)
    groups.set(item.supplier_id, list)
  }
  return groups
}

export async function checkoutCatalogCart(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  userName: string | null,
  cartItems: CartItemRow[],
  input: CatalogCheckoutInput,
  initialStatus: "buyer_review" | "pending",
): Promise<{ ok: true; result: CatalogCheckoutResult } | { ok: false; error: string }> {
  if (cartItems.length === 0) {
    return { ok: false, error: "Carrinho vazio" }
  }

  if (!input.title.trim()) {
    return { ok: false, error: "Título é obrigatório" }
  }

  if (!input.costCenter.trim()) {
    return { ok: false, error: "Centro de custo é obrigatório" }
  }

  const validationError = await validateCartItems(supabase, cartItems)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const groups = groupBySupplier(cartItems)
  const created: CatalogCheckoutResult["requisitions"] = []

  for (const [supplierId, lines] of groups) {
    const code = await generateRequisitionCode(supabase, companyId)

    const { data: reqRow, error: reqErr } = await supabase
      .from("requisitions")
      .insert({
        company_id: companyId,
        code,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        cost_center: input.costCenter.trim(),
        needed_by: input.neededBy?.trim() || null,
        priority: input.priority ?? "normal",
        status: initialStatus,
        origin: "catalog",
        requester_id: userId,
        requester_name: userName,
        supplier_id: supplierId,
      })
      .select("id, code")
      .single()

    if (reqErr || !reqRow) {
      return {
        ok: false,
        error: reqErr?.message ?? "Erro ao criar requisição",
      }
    }

    const requisitionId = reqRow.id as string

    const { error: itemsErr } = await supabase.from("requisition_items").insert(
      lines.map((line) => ({
        requisition_id: requisitionId,
        company_id: companyId,
        material_code: line.material_code,
        material_description: line.material_description,
        quantity: line.quantity,
        unit_of_measure: line.unit_of_measure,
        unit_price: line.unit_price,
        contract_id: line.contract_id,
        contract_item_id: line.contract_item_id,
        estimated_price: line.unit_price,
      })),
    )

    if (itemsErr) {
      await supabase.from("requisitions").delete().eq("id", requisitionId)
      return { ok: false, error: itemsErr.message }
    }

    created.push({
      id: requisitionId,
      code: reqRow.code as string,
      supplierId,
    })
  }

  return { ok: true, result: { requisitions: created } }
}

export function mapCartRowsToItems(rows: CartItemRow[]): CatalogCartItem[] {
  return rows.map((row) => ({
    id: row.id,
    contractId: row.contract_id,
    contractItemId: row.contract_item_id,
    supplierId: row.supplier_id,
    materialCode: row.material_code,
    materialDescription: row.material_description,
    unitOfMeasure: row.unit_of_measure,
    unitPrice: Number(row.unit_price),
    contractKind: row.contract_kind,
    quantity: Number(row.quantity),
    lineTotal: Number(row.quantity) * Number(row.unit_price),
  }))
}
