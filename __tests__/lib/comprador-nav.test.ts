import { describe, it, expect } from "vitest"
import {
  canAccessCompradorNavHref,
  canAccessCompradorPath,
  getAccessibleCompradorNavHrefs,
  getDefaultCompradorHref,
  type CompradorAccessContext,
} from "@/lib/permissions/comprador-nav"

function makeCtx(overrides: Partial<CompradorAccessContext> = {}): CompradorAccessContext {
  return {
    isSuperAdmin: false,
    hasPermission: () => false,
    hasFeature: () => false,
    hasRole: () => false,
    ...overrides,
  }
}

describe("canAccessCompradorNavHref", () => {
  it("superadmin can access everything", () => {
    const ctx = makeCtx({ isSuperAdmin: true })
    expect(canAccessCompradorNavHref("/comprador", ctx)).toBe(true)
    expect(canAccessCompradorNavHref("/comprador/cotacoes", ctx)).toBe(true)
  })

  it("requires nav.dashboard for /comprador", () => {
    expect(canAccessCompradorNavHref("/comprador", makeCtx())).toBe(false)
    expect(canAccessCompradorNavHref("/comprador", makeCtx({
      hasPermission: (p) => p === "nav.dashboard",
    }))).toBe(true)
  })

  it("requires contracts feature for /comprador/contratos", () => {
    expect(canAccessCompradorNavHref("/comprador/contratos", makeCtx())).toBe(false)
    expect(canAccessCompradorNavHref("/comprador/contratos", makeCtx({
      hasFeature: (f) => f === "contracts",
    }))).toBe(true)
  })

  it("aprovacoes needs any of approval permissions", () => {
    expect(canAccessCompradorNavHref("/comprador/aprovacoes", makeCtx())).toBe(false)
    expect(canAccessCompradorNavHref("/comprador/aprovacoes", makeCtx({
      hasPermission: (p) => p === "approval.requisition",
    }))).toBe(true)
  })

  it("returns true for unknown href (no rule)", () => {
    expect(canAccessCompradorNavHref("/comprador/unknown-page", makeCtx())).toBe(true)
  })
})

describe("canAccessCompradorPath", () => {
  it("superadmin can access any path", () => {
    const ctx = makeCtx({ isSuperAdmin: true })
    expect(canAccessCompradorPath("/comprador/pedidos/123", ctx)).toBe(true)
  })

  it("non-comprador path always accessible", () => {
    expect(canAccessCompradorPath("/fornecedor", makeCtx())).toBe(true)
  })

  it("alterar-senha always accessible", () => {
    expect(canAccessCompradorPath("/comprador/alterar-senha", makeCtx())).toBe(true)
  })

  it("equalizacao requires equalization feature + nav.quotations + equalize perm", () => {
    expect(canAccessCompradorPath("/comprador/cotacoes/123/equalizacao", makeCtx())).toBe(false)
    const ctx = makeCtx({
      hasFeature: (f) => f === "equalization",
      hasPermission: (p) => p === "nav.quotations" || p === "quotation.equalize.view",
    })
    expect(canAccessCompradorPath("/comprador/cotacoes/123/equalizacao", ctx)).toBe(true)
  })

  it("permissoes route requires admin role", () => {
    expect(canAccessCompradorPath("/comprador/configuracoes/permissoes", makeCtx())).toBe(false)
    expect(canAccessCompradorPath("/comprador/configuracoes/permissoes", makeCtx({
      hasRole: (r) => r === "admin",
    }))).toBe(true)
  })

  it("nova requisição requires requisition.create.buyer", () => {
    expect(canAccessCompradorPath("/comprador/requisicoes/nova", makeCtx())).toBe(false)
    expect(canAccessCompradorPath("/comprador/requisicoes/nova", makeCtx({
      hasPermission: (p) => p === "requisition.create.buyer",
    }))).toBe(true)
  })
})

describe("getAccessibleCompradorNavHrefs", () => {
  it("returns empty array when no permissions", () => {
    expect(getAccessibleCompradorNavHrefs(makeCtx())).toEqual([])
  })

  it("superadmin gets all hrefs", () => {
    const hrefs = getAccessibleCompradorNavHrefs(makeCtx({ isSuperAdmin: true }))
    expect(hrefs.length).toBeGreaterThan(5)
    expect(hrefs).toContain("/comprador")
  })
})

describe("getDefaultCompradorHref", () => {
  it("returns null when no accessible hrefs", () => {
    expect(getDefaultCompradorHref(makeCtx())).toBeNull()
  })

  it("returns first accessible href", () => {
    const ctx = makeCtx({ hasPermission: (p) => p === "nav.dashboard" })
    expect(getDefaultCompradorHref(ctx)).toBe("/comprador")
  })
})
