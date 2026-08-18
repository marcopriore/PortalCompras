import { describe, expect, it } from "vitest"
import {
  API_PAGE_SIZE_MAX,
  buildPaginationMeta,
  parseListQuery,
} from "@/lib/api/external/pagination"

describe("parseListQuery", () => {
  it("usa defaults de paginação", () => {
    const parsed = parseListQuery(new URLSearchParams())
    if (typeof parsed === "string") throw new Error("expected object")
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(50)
    expect(parsed.from).toBe(0)
    expect(parsed.to).toBe(49)
  })

  it("limita page_size ao máximo", () => {
    const parsed = parseListQuery(new URLSearchParams("page_size=500"))
    if (typeof parsed === "string") throw new Error("expected object")
    expect(parsed.pageSize).toBe(API_PAGE_SIZE_MAX)
  })

  it("rejeita updated_since inválido", () => {
    const parsed = parseListQuery(new URLSearchParams("updated_since=invalid"))
    expect(typeof parsed).toBe("string")
  })
})

describe("buildPaginationMeta", () => {
  it("calcula total_pages", () => {
    expect(buildPaginationMeta(1, 50, 120)).toEqual({
      page: 1,
      page_size: 50,
      total: 120,
      total_pages: 3,
    })
  })
})
