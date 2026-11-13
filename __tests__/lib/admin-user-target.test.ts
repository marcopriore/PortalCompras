import { describe, expect, it } from "vitest"
import { assertAdminUserTarget } from "@/lib/api/admin-user-target"

const TENANT_A = "company-a"
const TENANT_B = "company-b"

describe("assertAdminUserTarget", () => {
  it("allows a tenant admin to act on a user in the same tenant", () => {
    expect(
      assertAdminUserTarget({
        actorCompanyId: TENANT_A,
        actorIsSuperAdmin: false,
        target: { company_id: TENANT_A, is_superadmin: false },
      }),
    ).toEqual({ ok: true })
  })

  it("rejects a missing target", () => {
    expect(
      assertAdminUserTarget({
        actorCompanyId: TENANT_A,
        actorIsSuperAdmin: false,
        target: null,
      }),
    ).toEqual({ ok: false, status: 404, error: "Usuário não encontrado" })
  })

  it("rejects acting on a user from another tenant", () => {
    expect(
      assertAdminUserTarget({
        actorCompanyId: TENANT_A,
        actorIsSuperAdmin: false,
        target: { company_id: TENANT_B, is_superadmin: false },
      }),
    ).toEqual({ ok: false, status: 403, error: "Forbidden" })
  })

  it("rejects a target with no company_id", () => {
    expect(
      assertAdminUserTarget({
        actorCompanyId: TENANT_A,
        actorIsSuperAdmin: true,
        target: { company_id: null, is_superadmin: false },
      }),
    ).toEqual({ ok: false, status: 403, error: "Forbidden" })
  })

  it("rejects a tenant admin resetting a superadmin in the same tenant", () => {
    expect(
      assertAdminUserTarget({
        actorCompanyId: TENANT_A,
        actorIsSuperAdmin: false,
        target: { company_id: TENANT_A, is_superadmin: true },
      }),
    ).toEqual({ ok: false, status: 403, error: "Forbidden" })
  })

  it("allows a superadmin to reset a superadmin in the selected tenant", () => {
    expect(
      assertAdminUserTarget({
        actorCompanyId: TENANT_A,
        actorIsSuperAdmin: true,
        target: { company_id: TENANT_A, is_superadmin: true },
      }),
    ).toEqual({ ok: true })
  })
})
