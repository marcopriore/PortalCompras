export const API_BATCH_MAX = 200

export async function parseJsonBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<T | Response> {
  try {
    const body = (await request.json()) as unknown
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonValidationError("Body JSON inválido.")
    }
    return body as T
  } catch {
    return jsonValidationError("Body JSON inválido.")
  }
}

function jsonValidationError(message: string): Response {
  return Response.json(
    { error: message, code: "VALIDATION_ERROR" },
    { status: 400 },
  )
}

export function parseBatchItems(body: Record<string, unknown>): unknown[] | string {
  return parseBatchRecords(body, "items")
}

export function parseBatchRecords(
  body: Record<string, unknown>,
  fieldName: string,
): unknown[] | string {
  const records = body[fieldName]
  if (!Array.isArray(records) || records.length === 0) {
    return `Campo ${fieldName} deve ser um array não vazio.`
  }
  if (records.length > API_BATCH_MAX) {
    return `Máximo de ${API_BATCH_MAX} registros por lote.`
  }
  return records
}

export function parseSupplierBatch(body: Record<string, unknown>): unknown[] | string {
  if (Array.isArray(body.suppliers) && body.suppliers.length > 0) {
    return parseBatchRecords(body, "suppliers")
  }
  return parseBatchItems(body)
}

export function parseRequisitionBatch(body: Record<string, unknown>): unknown[] | string {
  if (Array.isArray(body.requisitions) && body.requisitions.length > 0) {
    return parseBatchRecords(body, "requisitions")
  }
  return parseBatchItems(body)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
