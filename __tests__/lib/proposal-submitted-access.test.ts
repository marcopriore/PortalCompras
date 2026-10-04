import { describe, expect, it } from "vitest"
import {
  isAuthorizedProposalSubmittedNotifier,
  proposalSubmittedNotifyFields,
} from "@/lib/notifications/proposal-submitted-access"

describe("isAuthorizedProposalSubmittedNotifier", () => {
  const submitted = { supplier_id: "sup-1", status: "submitted" }

  it("allows the supplier that submitted the proposal", () => {
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "supplier", supplierIds: ["sup-1"] },
        submitted,
      ),
    ).toBe(true)
  })

  it("allows a membership supplier_id of the same user", () => {
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "supplier", supplierIds: ["sup-other", "sup-1"] },
        submitted,
      ),
    ).toBe(true)
  })

  it("rejects buyers, requesters and users without supplier_id", () => {
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "buyer", supplierIds: ["sup-1"] },
        submitted,
      ),
    ).toBe(false)
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "requester", supplierIds: ["sup-1"] },
        submitted,
      ),
    ).toBe(false)
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "supplier", supplierIds: [] },
        submitted,
      ),
    ).toBe(false)
  })

  it("rejects another supplier or a proposal that is not submitted", () => {
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "supplier", supplierIds: ["sup-2"] },
        submitted,
      ),
    ).toBe(false)
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "supplier", supplierIds: ["sup-1"] },
        { supplier_id: "sup-1", status: "invited" },
      ),
    ).toBe(false)
    expect(
      isAuthorizedProposalSubmittedNotifier(
        { profileType: "supplier", supplierIds: ["sup-1"] },
        null,
      ),
    ).toBe(false)
  })
})

describe("proposalSubmittedNotifyFields", () => {
  it("uses persisted quotation and supplier data, not client spoofing", () => {
    expect(
      proposalSubmittedNotifyFields({
        quotationCode: "COT-2026-0036",
        supplierName: "Fornecedor Real",
        roundNumber: 2,
        totalPrice: 1500.5,
      }),
    ).toEqual({
      quotationCode: "COT-2026-0036",
      supplierName: "Fornecedor Real",
      roundNumber: 2,
      totalPrice: 1500.5,
    })
  })

  it("falls back safely when persisted fields are missing", () => {
    expect(
      proposalSubmittedNotifyFields({
        quotationCode: "  ",
        supplierName: null,
        roundNumber: 0,
        totalPrice: Number.NaN,
      }),
    ).toEqual({
      quotationCode: "Cotação",
      supplierName: "Fornecedor",
      roundNumber: 1,
      totalPrice: 0,
    })
  })
})
