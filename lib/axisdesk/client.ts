import type {
  AxisDeskCategoria,
  AxisDeskChamado,
  AxisDeskChamadoDetalhe,
  AxisDeskChamadoStatus,
  AxisDeskChamadoTipo,
  AxisDeskClientResult,
  AxisDeskCreateTicketPayload,
  AxisDeskAnexo,
  AxisDeskChamadoAcao,
} from "@/lib/axisdesk/types"
import {
  AXISDESK_OUTBOUND_ACTIONS,
  logAxisDeskOutbound,
} from "@/lib/axisdesk/integration-logs"

const DEFAULT_BASE_URL = "https://suporte.axisstrategy.com.br"

function getBaseUrl(): string {
  const raw = process.env.AXISDESK_BASE_URL?.trim()
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : DEFAULT_BASE_URL
}

function getApiKey(): string | null {
  const key = process.env.AXISDESK_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

function mapHttpError(status: number, body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error
    if (typeof err === "string" && err.trim().length > 0) return err
  }
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message?: unknown }).message
    if (typeof msg === "string" && msg.trim().length > 0) return msg
  }

  switch (status) {
    case 400:
      return "Dados inválidos. Verifique os campos e tente novamente."
    case 401:
      return "Integração com suporte não autorizada. Contate o administrador."
    case 404:
      return "Chamado não encontrado."
    case 409:
      return "Esta ação não é permitida no status atual do chamado."
    case 500:
      return "Erro interno no sistema de suporte. Tente novamente mais tarde."
    default:
      return `Erro ao comunicar com o suporte (${status}).`
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

type AxisDeskFetchMeta = {
  companyId: string
  action: string
  entityId?: string
  entityCode?: string
  requestPayload?: unknown
}

async function axisDeskFetch<T>(
  path: string,
  init?: RequestInit,
  meta?: AxisDeskFetchMeta,
): Promise<AxisDeskClientResult<T>> {
  const apiKey = getApiKey()
  const method = init?.method ?? "GET"
  const startedAt = Date.now()

  if (!apiKey) {
    const message =
      "Integração com suporte não configurada (AXISDESK_API_KEY ausente)."
    if (meta) {
      await logAxisDeskOutbound({
        companyId: meta.companyId,
        action: meta.action,
        method,
        path,
        durationMs: Date.now() - startedAt,
        responseStatus: 500,
        success: false,
        errorMessage: message,
        entityId: meta.entityId,
        entityCode: meta.entityCode,
        requestPayload: meta.requestPayload,
      })
    }
    return {
      ok: false,
      status: 500,
      message,
    }
  }

  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
        ...(init?.headers ?? {}),
      },
    })

    const body = await parseJsonSafe(res)
    const durationMs = Date.now() - startedAt

    if (!res.ok) {
      const message = mapHttpError(res.status, body)
      if (meta) {
        await logAxisDeskOutbound({
          companyId: meta.companyId,
          action: meta.action,
          method,
          path,
          durationMs,
          responseStatus: res.status,
          success: false,
          errorMessage: message,
          entityId: meta.entityId,
          entityCode: meta.entityCode,
          requestPayload: meta.requestPayload,
          responseBody: body,
        })
      }
      return {
        ok: false,
        status: res.status,
        message,
      }
    }

    if (meta) {
      await logAxisDeskOutbound({
        companyId: meta.companyId,
        action: meta.action,
        method,
        path,
        durationMs,
        responseStatus: res.status,
        success: true,
        entityId: meta.entityId,
        entityCode: meta.entityCode,
        requestPayload: meta.requestPayload,
        responseBody: body,
      })
    }

    return { ok: true, data: body as T }
  } catch {
    const message = "Não foi possível conectar ao sistema de suporte."
    if (meta) {
      await logAxisDeskOutbound({
        companyId: meta.companyId,
        action: meta.action,
        method,
        path,
        durationMs: Date.now() - startedAt,
        responseStatus: null,
        success: false,
        errorMessage: message,
        entityId: meta.entityId,
        entityCode: meta.entityCode,
        requestPayload: meta.requestPayload,
      })
    }
    return {
      ok: false,
      status: 500,
      message,
    }
  }
}

export async function createTicket(
  payload: AxisDeskCreateTicketPayload,
): Promise<AxisDeskClientResult<AxisDeskChamado>> {
  return axisDeskFetch<AxisDeskChamado>(
    "/api/chamados",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      companyId: payload.tenant_id_externo,
      action: AXISDESK_OUTBOUND_ACTIONS.TICKET_CREATE,
      requestPayload: payload,
    },
  )
}

export async function listTickets(
  tenantIdExterno: string,
  status?: AxisDeskChamadoStatus,
): Promise<AxisDeskClientResult<AxisDeskChamado[]>> {
  const params = new URLSearchParams({ tenant_id_externo: tenantIdExterno })
  if (status) params.set("status", status)

  const result = await axisDeskFetch<AxisDeskChamado[]>(
    `/api/chamados?${params.toString()}`,
    { method: "GET" },
    {
      companyId: tenantIdExterno,
      action: AXISDESK_OUTBOUND_ACTIONS.TICKET_LIST,
      requestPayload: { tenant_id_externo: tenantIdExterno, status: status ?? null },
    },
  )

  if (!result.ok) return result
  return { ok: true, data: Array.isArray(result.data) ? result.data : [] }
}

export async function getCategorias(
  tenantIdExterno: string,
  tipo?: AxisDeskChamadoTipo,
): Promise<AxisDeskClientResult<AxisDeskCategoria[]>> {
  const params = new URLSearchParams()
  if (tipo) params.set("tipo", tipo)

  const query = params.toString()
  const result = await axisDeskFetch<AxisDeskCategoria[]>(
    `/api/categorias${query ? `?${query}` : ""}`,
    { method: "GET" },
    {
      companyId: tenantIdExterno,
      action: AXISDESK_OUTBOUND_ACTIONS.CATEGORIES_LIST,
      requestPayload: { tipo: tipo ?? null },
    },
  )

  if (!result.ok) return result
  return { ok: true, data: Array.isArray(result.data) ? result.data : [] }
}

export async function getTicketDetail(
  chamadoId: string,
  tenantIdExterno: string,
): Promise<AxisDeskClientResult<AxisDeskChamadoDetalhe>> {
  const params = new URLSearchParams({ tenant_id_externo: tenantIdExterno })
  return axisDeskFetch<AxisDeskChamadoDetalhe>(
    `/api/chamados/${chamadoId}?${params.toString()}`,
    { method: "GET" },
    {
      companyId: tenantIdExterno,
      action: AXISDESK_OUTBOUND_ACTIONS.TICKET_DETAIL,
      entityId: chamadoId,
      requestPayload: {
        chamado_id: chamadoId,
        tenant_id_externo: tenantIdExterno,
      },
    },
  )
}

export async function executeAction(
  chamadoId: string,
  tenantIdExterno: string,
  acao: AxisDeskChamadoAcao,
  mensagem?: string,
  anexos?: AxisDeskAnexo[],
): Promise<AxisDeskClientResult<AxisDeskChamado>> {
  const body: Record<string, unknown> = { acao }
  if (mensagem !== undefined && mensagem.trim().length > 0) {
    body.mensagem = mensagem.trim()
  }
  if (anexos && anexos.length > 0) {
    body.anexos = anexos
  }

  return axisDeskFetch<AxisDeskChamado>(
    `/api/chamados/${chamadoId}/acoes`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    {
      companyId: tenantIdExterno,
      action: AXISDESK_OUTBOUND_ACTIONS.TICKET_ACTION,
      entityId: chamadoId,
      requestPayload: body,
    },
  )
}
