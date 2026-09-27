import { describe, expect, it } from "vitest"
import { canManageTargetUser } from "@/lib/admin/target-user"

const companyA = "11111111-1111-1111-1111-111111111111"
const companyB = "22222222-2222-2222-2222-222222222222"

describe("canManageTargetUser", () => {
  it("permite usuário ativo do mesmo tenant", () => {
    expect(canManageTargetUser({ company_id: companyA, is_superadmin: false }, companyA)).toBe(
      true,
    )
  })

  it("bloqueia usuário de outro tenant", () => {
    expect(canManageTargetUser({ company_id: companyB, is_superadmin: false }, companyA)).toBe(
      false,
    )
  })

  it("bloqueia superadmin mesmo no tenant selecionado", () => {
    expect(canManageTargetUser({ company_id: companyA, is_superadmin: true }, companyA)).toBe(
      false,
    )
  })

  it("bloqueia alvo inexistente", () => {
    expect(canManageTargetUser(null, companyA)).toBe(false)
  })
})
