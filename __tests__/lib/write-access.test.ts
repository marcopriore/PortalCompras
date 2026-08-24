import { describe, it, expect } from "vitest"
import { canWrite, isViewOnly } from "@/lib/permissions/write-access"

describe("write-access", () => {
  it("isViewOnly when view_only permission is active", () => {
    expect(isViewOnly((p) => p === "view_only")).toBe(true)
    expect(isViewOnly(() => false)).toBe(false)
  })

  it("canWrite requires specific permission and blocks view_only", () => {
    const checker = (p: string) =>
      p === "contract.edit" || p === "view_only"

    expect(canWrite(checker, "contract.edit")).toBe(false)
    expect(canWrite((p) => p === "contract.edit", "contract.edit")).toBe(true)
    expect(canWrite(() => false, "contract.edit")).toBe(false)
  })
})
