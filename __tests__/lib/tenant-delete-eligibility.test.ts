import { describe, expect, it } from "vitest"
import { formatTenantDeleteBlockers } from "@/lib/admin/tenant-delete-eligibility"

describe("formatTenantDeleteBlockers", () => {
  it("retorna vazio sem blockers", () => {
    expect(formatTenantDeleteBlockers({})).toBe("")
  })

  it("lista tabelas com contagem", () => {
    const msg = formatTenantDeleteBlockers({
      requisitions: 2,
      quotations: 1,
    })
    expect(msg).toContain("Requisições: 2")
    expect(msg).toContain("Cotações: 1")
    expect(msg).toContain("inativação")
  })
})
