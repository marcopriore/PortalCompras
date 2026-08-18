export const API_PAGE_SIZE_DEFAULT = 50
export const API_PAGE_SIZE_MAX = 100

export type ParsedListQuery = {
  page: number
  pageSize: number
  from: number
  to: number
  code: string | null
  search: string | null
  updatedSince: string | null
}

export function parseListQuery(searchParams: URLSearchParams): ParsedListQuery | string {
  const pageRaw = Number(searchParams.get("page") ?? "1")
  const pageSizeRaw = Number(searchParams.get("page_size") ?? String(API_PAGE_SIZE_DEFAULT))

  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), API_PAGE_SIZE_MAX)
      : API_PAGE_SIZE_DEFAULT

  const code = searchParams.get("code")?.trim() || null
  const search = searchParams.get("search")?.trim() || null
  const updatedSince = searchParams.get("updated_since")?.trim() || null

  if (updatedSince) {
    const parsed = Date.parse(updatedSince)
    if (Number.isNaN(parsed)) {
      return "Parâmetro updated_since inválido. Use ISO 8601."
    }
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to, code, search, updatedSince }
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
  return {
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  }
}
