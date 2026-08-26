import { describe, expect, it } from "vitest"
import {
  aggregateSuppliersByIdentity,
  filterAggregatedSuppliers,
  normalizeCnpj,
  supplierAggregateKey,
  sumCountsForIds,
  countByKey,
} from "@/lib/admin/global-suppliers"

describe("normalizeCnpj", () => {
  it("remove máscara", () => {
    expect(normalizeCnpj("12.345.678/0001-90")).toBe("12345678000190")
  })

  it("retorna null para vazio", () => {
    expect(normalizeCnpj(null)).toBeNull()
    expect(normalizeCnpj("")).toBeNull()
    expect(normalizeCnpj("---")).toBeNull()
  })
})

describe("aggregateSuppliersByIdentity", () => {
  it("agrupa o mesmo CNPJ em tenants diferentes", () => {
    const rows = aggregateSuppliersByIdentity([
      {
        id: "s1",
        company_id: "c1",
        code: "F001",
        name: "Acme",
        cnpj: "12.345.678/0001-90",
        email: "a@acme.com",
        phone: null,
        city: "SP",
        state: "SP",
        status: "active",
        companies: { id: "c1", name: "Tenant A" },
      },
      {
        id: "s2",
        company_id: "c2",
        code: "F099",
        name: "Acme Ltda",
        cnpj: "12345678000190",
        email: null,
        phone: "11",
        city: null,
        state: null,
        status: "inactive",
        companies: { id: "c2", name: "Tenant B" },
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe("cnpj:12345678000190")
    expect(rows[0].tenants).toHaveLength(2)
    expect(rows[0].supplier_ids).toEqual(["s1", "s2"])
    expect(rows[0].status).toBe("active")
    expect(rows[0].phone).toBe("11")
  })

  it("sem CNPJ usa id como chave", () => {
    const rows = aggregateSuppliersByIdentity([
      {
        id: "s-a",
        company_id: "c1",
        code: "X",
        name: "Sem CNPJ",
        cnpj: null,
        email: null,
        phone: null,
        city: null,
        state: null,
        status: "active",
        companies: { id: "c1", name: "T" },
      },
    ])
    expect(rows[0].key).toBe("id:s-a")
    expect(supplierAggregateKey({ id: "s-a", cnpj: null })).toBe("id:s-a")
  })
})

describe("filterAggregatedSuppliers", () => {
  const base = aggregateSuppliersByIdentity([
    {
      id: "s1",
      company_id: "c1",
      code: "F001",
      name: "Alpha Metal",
      cnpj: "11111111000111",
      email: "alpha@mail.com",
      phone: null,
      city: null,
      state: null,
      status: "active",
      companies: { id: "c1", name: "Cliente X" },
    },
  ])

  it("filtra por nome de tenant", () => {
    expect(filterAggregatedSuppliers(base, "Cliente X")).toHaveLength(1)
    expect(filterAggregatedSuppliers(base, "outro")).toHaveLength(0)
  })
})

describe("count helpers", () => {
  it("soma contagens por ids", () => {
    const map = countByKey([
      { supplier_id: "a" },
      { supplier_id: "a" },
      { supplier_id: "b" },
    ])
    expect(sumCountsForIds(map, ["a", "b"])).toBe(3)
    expect(sumCountsForIds(map, ["a"])).toBe(2)
  })
})
