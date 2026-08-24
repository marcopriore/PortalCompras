import { describe, it, expect } from "vitest"
import {
  canWrite,
  canWritePermission,
  isViewOnly,
} from "@/lib/permissions/write-access"
import type { PermissionKey } from "@/lib/hooks/usePermissions"

describe("write-access", () => {
  it("isViewOnly when view_only permission is active", () => {
    expect(isViewOnly((p) => p === "view_only")).toBe(true)
    expect(isViewOnly(() => false)).toBe(false)
  })

  it("canWrite blocks write permissions when view_only is active", () => {
    const checker = (p: string) => p === "contract.edit" || p === "view_only"

    expect(canWrite(checker, "contract.edit")).toBe(false)
    expect(canWrite((p) => p === "contract.edit", "contract.edit")).toBe(true)
    expect(canWrite(() => false, "contract.edit")).toBe(false)
  })

  it("canWritePermission mirrors canWrite with permission record", () => {
    const permissions = {
      "quotation.create": true,
      view_only: true,
    } as Record<PermissionKey, boolean>

    expect(canWritePermission(permissions, "quotation.create")).toBe(false)
    expect(canWritePermission(permissions, "nav.quotations")).toBe(false)
  })

  it("export.excel is not blocked by view_only", () => {
    const permissions = {
      "export.excel": true,
      view_only: true,
    } as Record<PermissionKey, boolean>

    expect(canWritePermission(permissions, "export.excel")).toBe(true)
  })
})
