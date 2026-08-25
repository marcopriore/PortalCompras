import { describe, expect, it } from "vitest"
import {
  mapQuotationInviteToApi,
  parseQuotationInviteInput,
} from "@/lib/api/external/quotation-invite-service"
import { isApiScope } from "@/lib/api/external/scopes"

describe("parseQuotationInviteInput", () => {
  it("exige supplier_code", () => {
    expect(parseQuotationInviteInput({})).toBe("Campo supplier_code é obrigatório.")
    expect(parseQuotationInviteInput({ supplier_code: "  " })).toBe(
      "Campo supplier_code é obrigatório.",
    )
  })

  it("trim do código", () => {
    expect(parseQuotationInviteInput({ supplier_code: " FORN-1 " })).toEqual({
      supplier_code: "FORN-1",
    })
  })
})

describe("mapQuotationInviteToApi", () => {
  it("expõe proposta invited quando criada", () => {
    const mapped = mapQuotationInviteToApi({
      quotationId: "q1",
      quotationCode: "COT-1",
      supplierId: "s1",
      supplierCode: "FORN-1",
      supplierName: "Fornecedor",
      position: 2,
      roundId: "r1",
      roundNumber: 1,
      proposalCreated: true,
    })
    expect(mapped.proposal_status).toBe("invited")
    expect(mapped.position).toBe(2)
    expect(mapped.round_number).toBe(1)
  })
})

describe("API scopes quotations write", () => {
  it("reconhece quotations:write", () => {
    expect(isApiScope("quotations:write")).toBe(true)
  })
})
