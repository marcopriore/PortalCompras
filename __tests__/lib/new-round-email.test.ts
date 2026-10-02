import { describe, expect, it } from "vitest"
import {
  parseNewRoundEmailRequest,
  selectNewRoundRecipients,
} from "@/lib/email/new-round-email"

describe("parseNewRoundEmailRequest", () => {
  it("rejects the old open-relay payload (to/subject/html)", () => {
    const parsed = parseNewRoundEmailRequest({
      to: "victim@example.com",
      subject: "Reset your password",
      html: "<p>Click here</p>",
      companyId: "00000000-0000-0000-0000-000000000001",
    })
    expect(parsed.ok).toBe(false)
  })

  it("rejects empty or non-object bodies", () => {
    expect(parseNewRoundEmailRequest(null).ok).toBe(false)
    expect(parseNewRoundEmailRequest("x").ok).toBe(false)
    expect(parseNewRoundEmailRequest({}).ok).toBe(false)
  })

  it("accepts quotation-scoped new-round payload", () => {
    const parsed = parseNewRoundEmailRequest({
      quotationId: "q-1",
      roundNumber: 2,
      supplierUserIds: ["u-1", "u-1", "u-2"],
    })
    expect(parsed).toEqual({
      ok: true,
      value: {
        quotationId: "q-1",
        roundNumber: 2,
        supplierUserIds: ["u-1", "u-2"],
      },
    })
  })
})

describe("selectNewRoundRecipients", () => {
  const profiles = [
    { id: "buyer-1", supplier_id: null, profile_type: "buyer" },
    { id: "sup-a", supplier_id: "s-a", profile_type: "supplier" },
    { id: "sup-b", supplier_id: "s-b", profile_type: "supplier" },
    { id: "sup-c", supplier_id: "s-c", profile_type: "supplier" },
  ]

  it("drops non-suppliers and suppliers not invited on the quotation", () => {
    const recipients = selectNewRoundRecipients(
      ["buyer-1", "sup-a", "sup-c", "unknown"],
      ["s-a", "s-b"],
      profiles,
    )
    expect(recipients).toEqual([{ userId: "sup-a", supplierId: "s-a" }])
  })

  it("returns empty when nobody is invited", () => {
    expect(
      selectNewRoundRecipients(["sup-a"], [], profiles),
    ).toEqual([])
  })
})
