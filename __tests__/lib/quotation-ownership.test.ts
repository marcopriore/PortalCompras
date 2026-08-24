import { describe, expect, it } from "vitest"
import {
  canAccessQuotation,
  canViewAllQuotations,
  formatResponsibleName,
} from "@/lib/quotations/ownership"

describe("quotation ownership", () => {
  it("allows superadmin and admin to view all", () => {
    expect(
      canViewAllQuotations({
        isSuperAdmin: true,
        hasPermission: () => false,
      }),
    ).toBe(true)
    expect(
      canViewAllQuotations({
        isSuperAdmin: false,
        hasRole: (r) => r === "admin",
        hasPermission: () => false,
      }),
    ).toBe(true)
  })

  it("uses quotation.view_all for other roles", () => {
    expect(
      canViewAllQuotations({
        isSuperAdmin: false,
        hasRole: () => false,
        hasPermission: (p) => p === "quotation.view_all",
      }),
    ).toBe(true)
    expect(
      canViewAllQuotations({
        isSuperAdmin: false,
        hasRole: () => false,
        hasPermission: () => false,
      }),
    ).toBe(false)
  })

  it("restricts access to the owner when view_all is off", () => {
    expect(
      canAccessQuotation({ createdBy: "u1", userId: "u1", canViewAll: false }),
    ).toBe(true)
    expect(
      canAccessQuotation({ createdBy: "u1", userId: "u2", canViewAll: false }),
    ).toBe(false)
    expect(
      canAccessQuotation({ createdBy: "u1", userId: "u2", canViewAll: true }),
    ).toBe(true)
    expect(
      canAccessQuotation({ createdBy: null, userId: "u1", canViewAll: false }),
    ).toBe(false)
  })

  it("formats empty names", () => {
    expect(formatResponsibleName(null)).toBe("—")
    expect(formatResponsibleName("  ")).toBe("—")
    expect(formatResponsibleName("Ana")).toBe("Ana")
  })
})
