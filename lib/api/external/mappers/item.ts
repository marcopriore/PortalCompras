export type ItemRow = {
  id: string
  company_id: string
  code: string
  short_description: string | null
  long_description: string | null
  status: string | null
  unit_of_measure: string | null
  ncm: string | null
  commodity_group: string | null
  target_price: number | null
  last_purchase_price: number | null
  average_price: number | null
  source: string | null
  sync_at: string | null
  created_at: string | null
}

export function mapItemToApi(row: ItemRow) {
  return {
    code: row.code,
    short_description: row.short_description,
    long_description: row.long_description,
    status: row.status,
    unit_of_measure: row.unit_of_measure,
    ncm: row.ncm,
    commodity_group: row.commodity_group,
    target_price: row.target_price,
    last_purchase_price: row.last_purchase_price,
    average_price: row.average_price,
    source: row.source,
    sync_at: row.sync_at,
    created_at: row.created_at,
  }
}

export const ITEM_SELECT =
  "id, company_id, code, short_description, long_description, status, unit_of_measure, ncm, commodity_group, target_price, last_purchase_price, average_price, source, sync_at, created_at"
