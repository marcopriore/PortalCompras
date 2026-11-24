import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildAccountConfigsFromRequisitionItems,
  REQUISITION_ITEM_ACCOUNT_SELECT,
  type LoadedRequisitionItemRow,
  type RequisitionEditorLineItem,
} from "@/lib/requisitions/line-items-helpers"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"
import type { ItemAccountConfigEdit } from "@/lib/po-account-assignment"

type Priority = "normal" | "urgent" | "critical"

export type RequisitionEditFormDto = {
  id: string
  code: string
  status: "draft" | "rejected"
  rejection_reason: string | null
  form: {
    title: string
    description: string
    costCenter: string
    neededBy: string
    priority: Priority
  }
  items: RequisitionEditorLineItem[]
  accountConfigs: Record<string, ItemAccountConfigEdit>
}

type CatalogItem = {
  id: string
  code: string
  short_description: string
  long_description: string | null
  unit_of_measure: string | null
  commodity_group: string | null
}

function formatDateForInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

export async function fetchRequisitionEditForm(
  supabase: SupabaseClient,
  companyId: string,
  id: string,
): Promise<RequisitionEditFormDto | null> {
  const [rRes, iRes] = await Promise.all([
    supabase.from("requisitions").select("*").eq("id", id).eq("company_id", companyId).single(),
    supabase
      .from("requisition_items")
      .select(REQUISITION_ITEM_ACCOUNT_SELECT)
      .eq("requisition_id", id)
      .eq("company_id", companyId)
      .order("created_at"),
  ])

  const reqData = rRes.data as {
    id: string
    code: string
    title: string
    description: string | null
    cost_center: string | null
    needed_by: string | null
    priority: Priority
    status: string
    rejection_reason: string | null
  } | null

  if (!reqData) {
    return null
  }

  if (reqData.status !== "rejected" && reqData.status !== "draft") {
    return null
  }

  const reqItems = (iRes.data ?? []) as Array<
    LoadedRequisitionItemRow & {
      id: string
      material_code: string | null
      material_description: string
      quantity: number
      unit_of_measure: string | null
      commodity_group: string | null
      observations: string | null
    }
  >

  let items: RequisitionEditorLineItem[] = []
  let accountConfigs: Record<string, ItemAccountConfigEdit> = {}

  if (reqItems.length > 0) {
    const materialCodes = [
      ...new Set(reqItems.map((r) => r.material_code).filter((c): c is string => Boolean(c))),
    ]
    let itemsData: CatalogItem[] = []
    if (materialCodes.length > 0) {
      const { data } = await supabase
        .from("items")
        .select("id, code, short_description, long_description, unit_of_measure, commodity_group")
        .eq("company_id", companyId)
        .in("code", materialCodes)
      itemsData = (data ?? []) as CatalogItem[]
    }

    const itemMap = new Map<string, CatalogItem>()
    itemsData.forEach((item) => {
      itemMap.set(item.code, item)
    })

    items = reqItems.map((ri) => {
      const catalogItem = ri.material_code ? itemMap.get(ri.material_code) : null
      return {
        id: ri.id,
        itemId: catalogItem?.id ?? `legacy-${ri.id}`,
        materialCode: ri.material_code ?? "",
        materialDescription: ri.material_description ?? "",
        unitOfMeasure: catalogItem?.unit_of_measure ?? ri.unit_of_measure ?? "",
        commodityGroup: catalogItem?.commodity_group ?? ri.commodity_group ?? "",
        quantity: ri.quantity ?? 1,
        observations: ri.observations ?? "",
        siteCode: ri.site_code ?? "",
      }
    })
    accountConfigs = buildAccountConfigsFromRequisitionItems(reqItems)
  }

  return {
    id: reqData.id,
    code: reqData.code,
    status: reqData.status === "draft" ? "draft" : "rejected",
    rejection_reason: reqData.rejection_reason ?? null,
    form: {
      title: reqData.title ?? "",
      description: reqData.description ?? "",
      costCenter: reqData.cost_center ?? "",
      neededBy: formatDateForInput(reqData.needed_by),
      priority: (reqData.priority as Priority) ?? "normal",
    },
    items,
    accountConfigs,
  }
}

export function requisitionEditFormQueryOptions(
  companyId: string,
  requisitionId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.requisitionEditForm(companyId, requisitionId),
    queryFn: () => fetchRequisitionEditForm(supabaseFactory(), companyId, requisitionId),
    enabled: Boolean(companyId && requisitionId),
  })
}