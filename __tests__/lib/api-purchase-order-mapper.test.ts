import { describe, expect, it } from "vitest"
import { mapPurchaseOrderToApi } from "@/lib/api/external/mappers/purchase-order"

describe("mapPurchaseOrderToApi", () => {
  it("agrupa cabeçalho no modelo ERP e numera linhas", () => {
    const mapped = mapPurchaseOrderToApi(
      {
        id: "po1",
        code: "PO-2026-0001",
        external_code: null,
        status: "processing",
        supplier_id: "s1",
        supplier_name: "Fornecedor A",
        supplier_cnpj: "12.345.678/0001-90",
        suppliers: { code: "FORN-001", name: "Fornecedor A", cnpj: "12.345.678/0001-90" },
        payment_condition: "30 DDL",
        quotation_code: "COT-1",
        requisition_code: "REQ-1",
        quotation_id: "q1",
        proposal_id: "p1",
        total_price: 100,
        delivery_days: 10,
        estimated_delivery_date: "2026-09-10",
        delivery_address: "Rua 1",
        observations: "Obs",
        accepted_at: "2026-08-25T12:00:00Z",
        accepted_by_supplier: true,
        created_at: "2026-08-20T10:00:00Z",
        updated_at: "2026-08-25T12:00:00Z",
      },
      [
        {
          id: "i1",
          material_code: "MAT-1",
          material_description: "Item 1",
          quantity: 2,
          unit_of_measure: "UN",
          unit_price: 50,
          total_price: 100,
          tax_percent: 0,
          delivery_days: 10,
          contract_id: "c1",
          contract_item_id: "ci1",
          contracts: { code: "CTR-1" },
          account_assignments: [
            {
              sequence: 1,
              cost_center: "CC-100",
              ledger_account: "4010301001",
              internal_order: null,
              business_area: null,
              controlling_area: "1000",
              apportionment_percent: 100,
              currency: "BRL",
            },
          ],
        },
      ],
    )

    expect(mapped.code).toBe("PO-2026-0001")
    expect(mapped.organization.currency).toBe("BRL")
    expect(mapped.organization.company_code).toBeNull()
    expect(mapped.supplier.code).toBe("FORN-001")
    expect(mapped.payment.terms_description).toBe("30 DDL")
    expect(mapped.references.quotation_code).toBe("COT-1")
    expect(mapped.delivery.estimated_date).toBe("2026-09-10")
    expect(mapped.totals.amount).toBe(100)
    expect(mapped.acceptance.accepted_by_supplier).toBe(true)
    expect(mapped.items).toHaveLength(1)
    expect(mapped.items[0].line_number).toBe(1)
    expect(mapped.items[0].contract.code).toBe("CTR-1")
    expect(mapped.items[0].account_assignments).toHaveLength(1)
    expect(mapped.items[0].account_assignments[0].cost_center).toBe("CC-100")
  })

  it("emite account_assignments vazio quando não há rateio", () => {
    const mapped = mapPurchaseOrderToApi(
      {
        id: "po2",
        code: "PO-2",
        status: "draft",
        created_at: "2026-01-01T00:00:00Z",
      },
      [
        {
          material_code: "M",
          material_description: "D",
          quantity: 1,
          unit_of_measure: "UN",
          unit_price: 1,
          total_price: 1,
          delivery_days: null,
        },
      ],
    )
    expect(mapped.items[0].account_assignments).toEqual([])
    expect(mapped.supplier.code).toBeNull()
  })
})
