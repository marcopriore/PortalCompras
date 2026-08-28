import { format } from "date-fns"
import type { AxisDeskCategoria, AxisDeskChamado } from "@/lib/axisdesk/types"

export type SupportListFilters = {
  q: string
  status: string[]
  tipo: string[]
  prioridade: string[]
  categoria: string[]
  responsavel: string[]
  slaDe: string
  slaAte: string
  criadoDe: string
  criadoAte: string
  page: number
}

export const SUPPORT_LIST_DEFAULT_FILTERS: SupportListFilters = {
  q: "",
  status: [],
  tipo: [],
  prioridade: [],
  categoria: [],
  responsavel: [],
  slaDe: "",
  slaAte: "",
  criadoDe: "",
  criadoAte: "",
  page: 1,
}

function parseCsv(param: string | null): string[] {
  if (!param) return []
  return param
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function parsePage(param: string | null): number {
  const n = Number(param ?? "1")
  if (!Number.isInteger(n) || n < 1) return 1
  return n
}

export function parseSupportListFilters(
  searchParams: URLSearchParams,
): SupportListFilters {
  return {
    q: searchParams.get("q")?.trim() ?? "",
    status: parseCsv(searchParams.get("status")),
    tipo: parseCsv(searchParams.get("tipo")),
    prioridade: parseCsv(searchParams.get("prioridade")),
    categoria: parseCsv(searchParams.get("categoria")),
    responsavel: parseCsv(searchParams.get("responsavel")),
    slaDe: searchParams.get("slaDe")?.trim() ?? "",
    slaAte: searchParams.get("slaAte")?.trim() ?? "",
    criadoDe: searchParams.get("criadoDe")?.trim() ?? "",
    criadoAte: searchParams.get("criadoAte")?.trim() ?? "",
    page: parsePage(searchParams.get("page")),
  }
}

export function buildSupportListSearchParams(
  filters: SupportListFilters,
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.status.length > 0) params.set("status", filters.status.join(","))
  if (filters.tipo.length > 0) params.set("tipo", filters.tipo.join(","))
  if (filters.prioridade.length > 0) {
    params.set("prioridade", filters.prioridade.join(","))
  }
  if (filters.categoria.length > 0) {
    params.set("categoria", filters.categoria.join(","))
  }
  if (filters.responsavel.length > 0) {
    params.set("responsavel", filters.responsavel.join(","))
  }
  if (filters.slaDe) params.set("slaDe", filters.slaDe)
  if (filters.slaAte) params.set("slaAte", filters.slaAte)
  if (filters.criadoDe) params.set("criadoDe", filters.criadoDe)
  if (filters.criadoAte) params.set("criadoAte", filters.criadoAte)
  if (filters.page > 1) params.set("page", String(filters.page))
  return params
}

function localDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return format(d, "yyyy-MM-dd")
}

function matchesDateRange(
  iso: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true
  const key = localDateKey(iso)
  if (!key) return false
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

export function getCategoriaFilterOptions(
  categorias: AxisDeskCategoria[],
  tipoFilter: string[],
): { value: string; label: string }[] {
  const list =
    tipoFilter.length > 0
      ? categorias.filter((c) => tipoFilter.includes(c.tipo))
      : categorias
  return list
    .map((c) => ({ value: c.id, label: c.nome }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
}

export function sanitizeCategoriaFilter(
  categoria: string[],
  categorias: AxisDeskCategoria[],
  tipoFilter: string[],
): string[] {
  const allowed = new Set(
    getCategoriaFilterOptions(categorias, tipoFilter).map((o) => o.value),
  )
  return categoria.filter((id) => allowed.has(id))
}

export function applySupportListFilters(
  tickets: AxisDeskChamado[],
  filters: SupportListFilters,
): AxisDeskChamado[] {
  const q = filters.q.trim().toLowerCase()

  return tickets.filter((ticket) => {
    if (q && !ticket.titulo.toLowerCase().includes(q)) return false
    if (filters.status.length > 0 && !filters.status.includes(ticket.status)) {
      return false
    }
    if (filters.tipo.length > 0 && !filters.tipo.includes(ticket.tipo)) {
      return false
    }
    if (
      filters.prioridade.length > 0 &&
      !filters.prioridade.includes(ticket.prioridade)
    ) {
      return false
    }
    if (filters.categoria.length > 0) {
      const catId = ticket.categoria?.id
      if (!catId || !filters.categoria.includes(catId)) return false
    }
    if (filters.responsavel.length > 0) {
      const nome = ticket.solicitante?.nome?.trim()
      if (!nome || !filters.responsavel.includes(nome)) return false
    }
    if (!matchesDateRange(ticket.sla_prazo, filters.slaDe, filters.slaAte)) {
      return false
    }
    if (
      !matchesDateRange(ticket.created_at, filters.criadoDe, filters.criadoAte)
    ) {
      return false
    }
    return true
  })
}

export function getResponsavelFilterOptions(
  tickets: AxisDeskChamado[],
): { value: string; label: string }[] {
  const names = new Set<string>()
  for (const ticket of tickets) {
    const nome = ticket.solicitante?.nome?.trim()
    if (nome) names.add(nome)
  }
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome) => ({ value: nome, label: nome }))
}

export function hasActiveSupportListFilters(
  filters: SupportListFilters,
): boolean {
  return (
    filters.q.length > 0 ||
    filters.status.length > 0 ||
    filters.tipo.length > 0 ||
    filters.prioridade.length > 0 ||
    filters.categoria.length > 0 ||
    filters.responsavel.length > 0 ||
    filters.slaDe.length > 0 ||
    filters.slaAte.length > 0 ||
    filters.criadoDe.length > 0 ||
    filters.criadoAte.length > 0
  )
}
