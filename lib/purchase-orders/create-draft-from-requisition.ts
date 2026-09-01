import type { SupabaseClient } from "@supabase/supabase-js"
import { copyRequisitionAccountConfigToPurchaseOrderItem } from "@/lib/requisitions/account-config-bridge"

export type CreateDraftFromRequisitionResult =
  | { ok: true; purchaseOrderId: string; code: string }
  | { ok: false; error: string }

type RequisitionRow = {
  id: string
  code: string
  title: string
  status: string
}

type RequisitionItemRow = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
}

export async function createDraftFromRequisition(
  supabase: SupabaseClient,
  params: {
    companyId: string
    userId: string
    requisitionId: string
  },
): Promise<CreateDraftFromRequisitionResult> {
  const { companyId, userId, requisitionId } = params

  const [reqRes, itemsRes] = await Promise.all([
    supabase
      .from("requisitions")
      .select("id, code, title, status")
      .eq("id", requisitionId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("requisition_items")
      .select("id, material_code, material_description, quantity, unit_of_measure")
      .eq("requisition_id", requisitionId)
      .order("created_at"),
  ])

  if (reqRes.error || !reqRes.data) {
    return { ok: false, error: "Requisição não encontrada." }
  }

  const req = reqRes.data as RequisitionRow
  if (!["approved", "in_quotation"].includes(req.status)) {
    return {
      ok: false,
      error: "A requisição precisa estar aprovada para gerar pedido.",
    }
  }

  const reqItems = (itemsRes.data as RequisitionItemRow[]) ?? []
  if (reqItems.length === 0) {
    return { ok: false, error: "A requisição não possui itens para gerar pedido." }
  }

  const { data: poData, error: poError } = await supabase
    .from("purchase_orders")
    .insert({
      company_id: companyId,
      quotation_id: null,
      supplier_id: null,
      supplier_name: "—",
      supplier_cnpj: null,
      payment_condition: null,
      delivery_days: null,
      delivery_address: null,
      quotation_code: null,
      requisition_code: req.code,
      total_price: 0,
      observations: null,
      created_by: userId,
      status: "draft",
    })
    .select("id, code")
    .single()

  if (poError || !poData) {
    return { ok: false, error: poError?.message ?? "Não foi possível criar o pedido." }
  }

  const poItemsPayload = reqItems.map((item) => ({
    purchase_order_id: poData.id,
    company_id: companyId,
    material_code: item.material_code ?? "",
    material_description: item.material_description,
    quantity: item.quantity,
    unit_of_measure: item.unit_of_measure,
    unit_price: 0,
    price_unit: 1,
    tax_percent: null,
    delivery_days: null,
    requisition_item_id: item.id,
    source_requisition_code: req.code,
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(poItemsPayload)
    .select("id, requisition_item_id")

  if (itemsError || !insertedItems) {
    await supabase.from("purchase_orders").delete().eq("id", poData.id)
    return { ok: false, error: itemsError?.message ?? "Não foi possível salvar os itens do pedido." }
  }

  const copyResults = await Promise.all(
    insertedItems.map((row) => {
      const requisitionItemId = row.requisition_item_id as string | null
      if (!requisitionItemId) return Promise.resolve({ ok: true as const })
      return copyRequisitionAccountConfigToPurchaseOrderItem(
        supabase,
        companyId,
        requisitionItemId,
        String(row.id),
      )
    }),
  )
  const firstCopyError = copyResults.find(
    (result): result is { ok: false; message: string } => !result.ok,
  )
  if (firstCopyError) {
    await supabase.from("purchase_orders").delete().eq("id", poData.id)
    return { ok: false, error: firstCopyError.message }
  }

  return {
    ok: true,
    purchaseOrderId: poData.id as string,
    code: poData.code as string,
  }
}
