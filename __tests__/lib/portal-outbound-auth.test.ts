import { describe, expect, it } from "vitest"
import { authorizePortalOutboundAction } from "@/lib/integrations/portal-outbound-auth"

const buyer = {
  userId: "buyer-1",
  profileType: "buyer" as const,
  isSuperAdmin: false,
}

const requester = {
  userId: "req-1",
  profileType: "requester" as const,
  isSuperAdmin: false,
}

describe("authorizePortalOutboundAction", () => {
  it("blocks purchase_order and contract actions from the portal", () => {
    expect(
      authorizePortalOutboundAction({
        action: "purchase_order.create",
        actor: buyer,
      }).ok,
    ).toBe(false)
    expect(
      authorizePortalOutboundAction({
        action: "purchase_order.delete",
        actor: buyer,
      }).ok,
    ).toBe(false)
    expect(
      authorizePortalOutboundAction({
        action: "contract.create",
        actor: buyer,
      }).ok,
    ).toBe(false)
  })

  it("allows buyers and superadmins to fire requisition outbound", () => {
    expect(
      authorizePortalOutboundAction({
        action: "requisition.created",
        actor: buyer,
      }).ok,
    ).toBe(true)
    expect(
      authorizePortalOutboundAction({
        action: "requisition.approved",
        actor: { userId: "sa", profileType: "buyer", isSuperAdmin: true },
      }).ok,
    ).toBe(true)
  })

  it("allows a requester only for created/cancelled on their own REQ", () => {
    expect(
      authorizePortalOutboundAction({
        action: "requisition.created",
        actor: requester,
        requisitionRequesterId: "req-1",
      }).ok,
    ).toBe(true)
    expect(
      authorizePortalOutboundAction({
        action: "requisition.cancelled",
        actor: requester,
        requisitionRequesterId: "req-1",
      }).ok,
    ).toBe(true)
    expect(
      authorizePortalOutboundAction({
        action: "requisition.approved",
        actor: requester,
        requisitionRequesterId: "req-1",
      }).ok,
    ).toBe(false)
    expect(
      authorizePortalOutboundAction({
        action: "requisition.created",
        actor: requester,
        requisitionRequesterId: "someone-else",
      }).ok,
    ).toBe(false)
    expect(
      authorizePortalOutboundAction({
        action: "requisition.cancelled",
        actor: requester,
      }).ok,
    ).toBe(false)
  })

  it("blocks suppliers and unknown profiles", () => {
    expect(
      authorizePortalOutboundAction({
        action: "requisition.created",
        actor: { userId: "s1", profileType: "supplier", isSuperAdmin: false },
        requisitionRequesterId: "s1",
      }).ok,
    ).toBe(false)
    expect(
      authorizePortalOutboundAction({
        action: "requisition.created",
        actor: { userId: "x", profileType: null, isSuperAdmin: false },
      }).ok,
    ).toBe(false)
  })
})
