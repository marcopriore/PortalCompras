import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateOwnRequisitionOrderGuard,
  findOwnRequisitionCodes,
  formatOwnRequisitionBlockedMessage,
  isOwnRequisitionCreator,
  OWN_REQUISITION_ORDER_BLOCKED_MESSAGE,
} from "@/lib/requisitions/own-requisition-guard"

function mockSupabase(result: { data: unknown; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: async () => result,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe("isOwnRequisitionCreator", () => {
  it("returns true when user is the requester", () => {
    expect(isOwnRequisitionCreator("u1", "u1")).toBe(true)
  })

  it("returns false when requester differs or is missing", () => {
    expect(isOwnRequisitionCreator("u1", "u2")).toBe(false)
    expect(isOwnRequisitionCreator("u1", null)).toBe(false)
    expect(isOwnRequisitionCreator(null, "u1")).toBe(false)
  })
})

describe("findOwnRequisitionCodes", () => {
  it("returns codes owned by the user", async () => {
    const supabase = mockSupabase({
      data: [{ code: "REQ-1" }, { code: "REQ-2" }],
      error: null,
    })
    await expect(
      findOwnRequisitionCodes(supabase, "c1", "u1", ["REQ-1", "REQ-2"]),
    ).resolves.toEqual(["REQ-1", "REQ-2"])
  })

  it("throws on lookup error instead of fail-open", async () => {
    const supabase = mockSupabase({
      data: null,
      error: { message: "JWT expired" },
    })
    await expect(
      findOwnRequisitionCodes(supabase, "c1", "u1", ["REQ-1"]),
    ).rejects.toThrow("JWT expired")
  })
})

describe("evaluateOwnRequisitionOrderGuard", () => {
  it("allows when none of the codes belong to the user", async () => {
    const supabase = mockSupabase({ data: [], error: null })
    await expect(
      evaluateOwnRequisitionOrderGuard(supabase, "c1", "u1", ["REQ-9"]),
    ).resolves.toEqual({ blocked: false })
  })

  it("blocks when the user created a selected REQ", async () => {
    const supabase = mockSupabase({
      data: [{ code: "REQ-1" }],
      error: null,
    })
    await expect(
      evaluateOwnRequisitionOrderGuard(supabase, "c1", "u1", ["REQ-1", "REQ-2"]),
    ).resolves.toEqual({
      blocked: true,
      ownCodes: ["REQ-1"],
      queryFailed: false,
    })
  })

  it("fail-closes on query error so Criar Pedido cannot proceed", async () => {
    const supabase = mockSupabase({
      data: null,
      error: { message: "timeout" },
    })
    await expect(
      evaluateOwnRequisitionOrderGuard(supabase, "c1", "u1", ["REQ-1"]),
    ).resolves.toEqual({
      blocked: true,
      ownCodes: ["REQ-1"],
      queryFailed: true,
    })
  })

  it("allows when there are no requisition codes to check", async () => {
    const supabase = mockSupabase({
      data: null,
      error: { message: "should not run" },
    })
    await expect(
      evaluateOwnRequisitionOrderGuard(supabase, "c1", "u1", ["", "  "]),
    ).resolves.toEqual({ blocked: false })
  })
})

describe("formatOwnRequisitionBlockedMessage", () => {
  it("includes codes when present", () => {
    expect(formatOwnRequisitionBlockedMessage(["REQ-1", "REQ-2"])).toBe(
      `${OWN_REQUISITION_ORDER_BLOCKED_MESSAGE} (REQ-1, REQ-2)`,
    )
  })
})
