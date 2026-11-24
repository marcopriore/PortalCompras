import { queryOptions } from "@tanstack/react-query"
import type {
  AxisDeskCategoria,
  AxisDeskChamado,
  AxisDeskChamadoDetalhe,
  AxisDeskChamadoTipo,
} from "@/lib/axisdesk/types"
import { queryKeys } from "@/lib/queries/keys"

export async function fetchSupportTicketsList(
  companyId: string,
): Promise<AxisDeskChamado[]> {
  const res = await fetch("/api/support/tickets", { cache: "no-store" })
  const payload = (await res.json()) as {
    data?: AxisDeskChamado[]
    error?: string
  }
  if (!res.ok) {
    throw new Error(payload.error ?? "Erro ao carregar chamados.")
  }
  return payload.data ?? []
}

export function supportTicketsListQueryOptions(companyId: string) {
  return queryOptions({
    queryKey: queryKeys.supportTicketsList(companyId),
    queryFn: () => fetchSupportTicketsList(companyId),
    enabled: Boolean(companyId),
  })
}

export async function fetchSupportCategorias(
  tipo?: AxisDeskChamadoTipo,
): Promise<AxisDeskCategoria[]> {
  const url = tipo
    ? `/api/support/categorias?tipo=${tipo}`
    : "/api/support/categorias"
  const res = await fetch(url, { cache: "no-store" })
  const payload = (await res.json()) as {
    data?: AxisDeskCategoria[]
    error?: string
  }
  if (!res.ok) {
    throw new Error(payload.error ?? "Erro ao carregar categorias.")
  }
  return payload.data ?? []
}

export function supportCategoriasQueryOptions(
  companyId: string,
  tipoKey: string,
  tipo?: AxisDeskChamadoTipo,
) {
  return queryOptions({
    queryKey: queryKeys.supportCategorias(companyId, tipoKey),
    queryFn: () => fetchSupportCategorias(tipo),
    enabled: Boolean(companyId),
  })
}

export async function fetchSupportTicketDetail(
  ticketId: string,
): Promise<AxisDeskChamadoDetalhe | null> {
  const res = await fetch(`/api/support/tickets/${ticketId}`, {
    cache: "no-store",
  })
  const payload = (await res.json()) as {
    data?: AxisDeskChamadoDetalhe
    error?: string
  }
  if (!res.ok) {
    throw new Error(payload.error ?? "Erro ao carregar chamado.")
  }
  return payload.data ?? null
}

export function supportTicketDetailQueryOptions(
  companyId: string,
  ticketId: string,
) {
  return queryOptions({
    queryKey: queryKeys.supportTicketDetail(companyId, ticketId),
    queryFn: () => fetchSupportTicketDetail(ticketId),
    enabled: Boolean(companyId && ticketId),
  })
}