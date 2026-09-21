import type { SupabaseClient } from "@supabase/supabase-js"
import { loadDefaultSiteCode } from "@/lib/branches/branch-queries"

export const QUOTATION_ITEMS_NO_BRANCH_MESSAGE =
  "Cadastre ao menos um centro / filial (MATRIZ) em Configurações."

export type QuotationItemRowInput = {
  material_code: string
  material_description: string
  long_description?: string | null
  unit_of_measure: string | null
  quantity: number
  complementary_spec?: string | null
  source_requisition_code?: string | null
  site_code?: string | null
}

export type QuotationItemInsertRow = {
  quotation_id: string
  company_id: string
  material_code: string
  material_description: string
  long_description: string | null
  unit_of_measure: string | null
  quantity: number
  complementary_spec: string | null
  source_requisition_code: string | null
  site_code: string
}

const SNAPSHOT_COLUMNS =
  "id, quotation_id, company_id, material_code, material_description, long_description, unit_of_measure, quantity, complementary_spec, source_requisition_code, site_code, target_price, last_purchase_price, average_price"

export function resolveQuotationItemSiteCode(
  siteCode: string | null | undefined,
  defaultSiteCode: string,
): string {
  const trimmed = siteCode?.trim()
  return trimmed || defaultSiteCode
}

export function quotationItemsNeedDefaultSiteCode(
  items: Array<{ site_code?: string | null }>,
): boolean {
  return items.some((item) => !item.site_code?.trim())
}

export function buildQuotationItemInsertRows(
  companyId: string,
  quotationId: string,
  items: QuotationItemRowInput[],
  defaultSiteCode: string,
): QuotationItemInsertRow[] {
  return items.map((item) => ({
    quotation_id: quotationId,
    company_id: companyId,
    material_code: item.material_code,
    material_description: item.material_description,
    long_description: item.long_description ?? null,
    unit_of_measure: item.unit_of_measure,
    quantity: item.quantity,
    complementary_spec: item.complementary_spec ?? null,
    source_requisition_code: item.source_requisition_code ?? null,
    site_code: resolveQuotationItemSiteCode(item.site_code, defaultSiteCode),
  }))
}

async function resolveDefaultSiteCodeForItems(
  db: SupabaseClient,
  companyId: string,
  items: QuotationItemRowInput[],
): Promise<{ ok: true; defaultSiteCode: string } | { ok: false; error: string }> {
  if (items.length === 0 || !quotationItemsNeedDefaultSiteCode(items)) {
    return { ok: true, defaultSiteCode: "" }
  }

  const defaultSiteCode = await loadDefaultSiteCode(db, companyId)
  if (!defaultSiteCode) {
    return { ok: false, error: QUOTATION_ITEMS_NO_BRANCH_MESSAGE }
  }
  return { ok: true, defaultSiteCode }
}

export async function insertQuotationItems(
  db: SupabaseClient,
  params: {
    companyId: string
    quotationId: string
    items: QuotationItemRowInput[]
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { companyId, quotationId, items } = params
  if (items.length === 0) return { ok: true }

  const resolved = await resolveDefaultSiteCodeForItems(db, companyId, items)
  if (!resolved.ok) return resolved

  const rows = buildQuotationItemInsertRows(
    companyId,
    quotationId,
    items,
    resolved.defaultSiteCode,
  )
  const { error } = await db.from("quotation_items").insert(rows)
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function replaceQuotationItems(
  db: SupabaseClient,
  params: {
    companyId: string
    quotationId: string
    items: QuotationItemRowInput[]
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { companyId, quotationId, items } = params

  const resolved = await resolveDefaultSiteCodeForItems(db, companyId, items)
  if (!resolved.ok) return resolved

  const { data: snapshot, error: snapshotError } = await db
    .from("quotation_items")
    .select(SNAPSHOT_COLUMNS)
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)

  if (snapshotError) {
    return { ok: false, error: snapshotError.message }
  }

  const { error: deleteError } = await db
    .from("quotation_items")
    .delete()
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  if (items.length === 0) return { ok: true }

  const rows = buildQuotationItemInsertRows(
    companyId,
    quotationId,
    items,
    resolved.defaultSiteCode,
  )
  const { error: insertError } = await db.from("quotation_items").insert(rows)
  if (!insertError) return { ok: true }

  if (snapshot && snapshot.length > 0) {
    const { error: restoreError } = await db.from("quotation_items").insert(snapshot)
    if (restoreError) {
      return {
        ok: false,
        error: `${insertError.message} (falha ao restaurar itens: ${restoreError.message})`,
      }
    }
  }

  return { ok: false, error: insertError.message }
}
