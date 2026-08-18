// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QuotationRow = Record<string, any>

export function mapQuotationToApi(row: QuotationRow) {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    status: row.status,
    category: row.category ?? null,
    payment_condition: row.payment_condition ?? null,
    response_deadline: row.response_deadline ?? null,
    created_at: row.created_at,
  }
}

export const QUOTATION_LIST_SELECT =
  "id, code, description, status, category, payment_condition, response_deadline, created_at"
