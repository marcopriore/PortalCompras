export const ERP_ERROR_KIND = {
  DUPLICATE_EXTERNAL_CODE: "duplicate_external_code",
  ERP_HTTP: "erp_http",
  PAYLOAD: "payload",
  PERSIST: "persist",
} as const

export type ErpErrorKind = (typeof ERP_ERROR_KIND)[keyof typeof ERP_ERROR_KIND]

export type PurchaseOrderIntegrationStatus = "error" | "integration_error"

const KIND_PREFIX = "erp_error_kind:"

export function buildErpErrorMessage(kind: ErpErrorKind, message: string): string {
  return `${KIND_PREFIX}${kind}\n${message}`
}

export function parseErpErrorMessage(raw: string | null | undefined): {
  kind: ErpErrorKind | null
  message: string | null
} {
  if (!raw?.trim()) return { kind: null, message: null }
  if (!raw.startsWith(KIND_PREFIX)) {
    return { kind: null, message: raw }
  }

  const newline = raw.indexOf("\n")
  if (newline === -1) {
    return { kind: null, message: raw }
  }

  const kind = raw.slice(KIND_PREFIX.length, newline) as ErpErrorKind
  const message = raw.slice(newline + 1).trim()
  const validKinds = new Set<string>(Object.values(ERP_ERROR_KIND))
  return {
    kind: validKinds.has(kind) ? kind : null,
    message: message || null,
  }
}

export function statusForErpErrorKind(kind: ErpErrorKind): PurchaseOrderIntegrationStatus {
  return kind === ERP_ERROR_KIND.ERP_HTTP ? "error" : "integration_error"
}

export function duplicateExternalCodeMessage(externalCode: string): string {
  return buildErpErrorMessage(
    ERP_ERROR_KIND.DUPLICATE_EXTERNAL_CODE,
    `O número de pedido ERP "${externalCode}" já está registrado nesta empresa. O Valore não pôde vincular este código a outro pedido do mesmo cliente.`,
  )
}

export function erpHttpErrorMessage(status: number): string {
  return buildErpErrorMessage(
    ERP_ERROR_KIND.ERP_HTTP,
    `O ERP respondeu com status ${status} e não confirmou a operação.`,
  )
}

const ERP_ERROR_BODY_KEYS = [
  "message",
  "error",
  "error_message",
  "detail",
  "description",
] as const

function extractPlainErpErrorDetail(responseBody: string | null): string | null {
  if (!responseBody?.trim()) return null

  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>
    for (const key of ERP_ERROR_BODY_KEYS) {
      const value = parsed[key]
      if (typeof value === "string" && value.trim()) {
        return value.trim()
      }
    }
  } catch {
    const trimmed = responseBody.trim()
    if (trimmed.length > 0 && trimmed.length <= 500) {
      return trimmed
    }
  }

  return null
}

/** Mensagem legível para falhas HTTP do ERP (4xx/5xx). Usa body quando disponível. */
export function formatErpHttpFailure(
  status: number,
  responseBody: string | null,
): string {
  const detail = extractPlainErpErrorDetail(responseBody)
  if (detail) return detail
  return `O ERP respondeu com status ${status} e não confirmou a operação.`
}

export function getBuyerOrderErrorCopy(
  status: "error" | "integration_error",
  rawMessage: string | null | undefined,
): { title: string; body: string; allowBuyerRetry: boolean } {
  const { message } = parseErpErrorMessage(rawMessage)
  const body =
    message ??
    rawMessage ??
    (status === "integration_error"
      ? "O Valore não concluiu a integração deste pedido."
      : "O ERP não aceitou o pedido.")

  if (status === "integration_error") {
    return {
      title: "Erro de Integração",
      body,
      allowBuyerRetry: false,
    }
  }

  return {
    title: "Pedido reprovado pelo ERP",
    body,
    allowBuyerRetry: true,
  }
}

/** @deprecated Use getBuyerOrderErrorCopy */
export function getBuyerIntegrationErrorCopy(
  rawMessage: string | null | undefined,
): { title: string; body: string; isValoreRejection: boolean } {
  const { kind } = parseErpErrorMessage(rawMessage)
  const status =
    kind === ERP_ERROR_KIND.ERP_HTTP ? "error" : "integration_error"
  const copy = getBuyerOrderErrorCopy(status, rawMessage)
  return {
    title: copy.title,
    body: copy.body,
    isValoreRejection: status === "integration_error",
  }
}
