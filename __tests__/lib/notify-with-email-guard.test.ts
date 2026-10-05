import { describe, expect, it } from "vitest"
import {
  canNotifyRecipient,
  isAllowedNotifyEmailPrefKey,
  wantsNotifyEmail,
} from "@/lib/notify-with-email-guard"

const buyer = {
  company_id: "co-1",
  profile_type: "buyer",
  supplier_id: null,
  is_superadmin: false,
}

describe("isAllowedNotifyEmailPrefKey", () => {
  it("accepts known *_email preference keys", () => {
    expect(isAllowedNotifyEmailPrefKey("new_requisition_email")).toBe(true)
    expect(isAllowedNotifyEmailPrefKey("order_approved_email")).toBe(true)
    expect(isAllowedNotifyEmailPrefKey("requisition_approval_email")).toBe(true)
  })

  it("rejects bell keys and unknown keys", () => {
    expect(isAllowedNotifyEmailPrefKey("new_requisition_bell")).toBe(false)
    expect(isAllowedNotifyEmailPrefKey("order_accepted_bell")).toBe(false)
    expect(isAllowedNotifyEmailPrefKey("not_a_pref")).toBe(false)
    expect(isAllowedNotifyEmailPrefKey("")).toBe(false)
  })
})

describe("wantsNotifyEmail", () => {
  it("is false when the key is a bell channel even if that bell is on", () => {
    expect(
      wantsNotifyEmail({ new_requisition_bell: true }, "new_requisition_bell"),
    ).toBe(false)
  })

  it("is false when the email pref is missing or off", () => {
    expect(wantsNotifyEmail(null, "new_requisition_email")).toBe(false)
    expect(
      wantsNotifyEmail({ new_requisition_email: false }, "new_requisition_email"),
    ).toBe(false)
  })

  it("is true only for an allowed email key that is enabled", () => {
    expect(
      wantsNotifyEmail({ new_requisition_email: true }, "new_requisition_email"),
    ).toBe(true)
  })
})

describe("canNotifyRecipient", () => {
  it("allows the same tenant", () => {
    expect(
      canNotifyRecipient({
        caller: buyer,
        companyId: "co-1",
      }),
    ).toBe(true)
  })

  it("blocks cross-tenant callers without a linked purchase order", () => {
    expect(
      canNotifyRecipient({
        caller: buyer,
        companyId: "co-2",
        entity: "quotations",
        entityId: "q1",
      }),
    ).toBe(false)
  })

  it("allows a supplier only for their own purchase order", () => {
    const supplier = {
      company_id: "other",
      profile_type: "supplier",
      supplier_id: "sup-1",
      is_superadmin: false,
    }
    expect(
      canNotifyRecipient({
        caller: supplier,
        companyId: "co-1",
        entity: "purchase_order",
        entityId: "po-1",
        purchaseOrder: { company_id: "co-1", supplier_id: "sup-1" },
      }),
    ).toBe(true)
    expect(
      canNotifyRecipient({
        caller: supplier,
        companyId: "co-1",
        entity: "purchase_order",
        entityId: "po-1",
        purchaseOrder: { company_id: "co-1", supplier_id: "sup-other" },
      }),
    ).toBe(false)
  })
})
