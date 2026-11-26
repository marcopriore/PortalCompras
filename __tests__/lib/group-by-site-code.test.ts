import { describe, expect, it } from "vitest"
import {
  groupLinesBySiteAndRequisition,
  groupLinesBySiteCode,
  normalizeRequisitionCode,
} from "@/lib/branches/group-by-site-code"

describe("normalizeRequisitionCode", () => {
  it("trim e trata vazio como null", () => {
    expect(normalizeRequisitionCode(" REQ-1 ")).toBe("REQ-1")
    expect(normalizeRequisitionCode("")).toBeNull()
    expect(normalizeRequisitionCode("   ")).toBeNull()
    expect(normalizeRequisitionCode(null)).toBeNull()
    expect(normalizeRequisitionCode(undefined)).toBeNull()
  })
})

describe("groupLinesBySiteCode", () => {
  it("agrupa só por centro/filial", () => {
    const groups = groupLinesBySiteCode([
      { siteCode: "MATRIZ", id: "a" },
      { siteCode: "FILIAL", id: "b" },
      { siteCode: "MATRIZ", id: "c" },
    ])
    expect([...groups.keys()]).toEqual(["MATRIZ", "FILIAL"])
    expect(groups.get("MATRIZ")?.map((l) => l.id)).toEqual(["a", "c"])
  })
})

describe("groupLinesBySiteAndRequisition", () => {
  it("mesmo site e mesma REQ continua um único pedido", () => {
    const groups = groupLinesBySiteAndRequisition([
      { siteCode: "MATRIZ", sourceRequisitionCode: "REQ-A", id: "1" },
      { siteCode: "MATRIZ", sourceRequisitionCode: "REQ-A", id: "2" },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      siteCode: "MATRIZ",
      requisitionCode: "REQ-A",
    })
    expect(groups[0].lines.map((l) => l.id)).toEqual(["1", "2"])
  })

  it("split por site_code com a REQ de cada grupo, não a primeira da cotação", () => {
    const groups = groupLinesBySiteAndRequisition([
      { siteCode: "MATRIZ", sourceRequisitionCode: "REQ-A", id: "a" },
      { siteCode: "FILIAL", sourceRequisitionCode: "REQ-B", id: "b" },
    ])
    expect(groups).toEqual([
      {
        siteCode: "MATRIZ",
        requisitionCode: "REQ-A",
        lines: [
          { siteCode: "MATRIZ", sourceRequisitionCode: "REQ-A", id: "a" },
        ],
      },
      {
        siteCode: "FILIAL",
        requisitionCode: "REQ-B",
        lines: [
          { siteCode: "FILIAL", sourceRequisitionCode: "REQ-B", id: "b" },
        ],
      },
    ])
  })

  it("mesmo site com REQs distintas gera um pedido por requisição", () => {
    const groups = groupLinesBySiteAndRequisition([
      { siteCode: "MATRIZ", sourceRequisitionCode: "REQ-A", id: "a" },
      { siteCode: "MATRIZ", sourceRequisitionCode: "REQ-B", id: "b" },
      { siteCode: "MATRIZ", sourceRequisitionCode: " REQ-A ", id: "c" },
    ])
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.requisitionCode)).toEqual(["REQ-A", "REQ-B"])
    expect(groups[0].lines.map((l) => l.id)).toEqual(["a", "c"])
    expect(groups[1].lines.map((l) => l.id)).toEqual(["b"])
  })

  it("linhas sem REQ ficam juntas com requisitionCode null", () => {
    const groups = groupLinesBySiteAndRequisition([
      { siteCode: "MATRIZ", sourceRequisitionCode: null, id: "a" },
      { siteCode: "MATRIZ", sourceRequisitionCode: "  ", id: "b" },
    ])
    expect(groups).toEqual([
      {
        siteCode: "MATRIZ",
        requisitionCode: null,
        lines: [
          { siteCode: "MATRIZ", sourceRequisitionCode: null, id: "a" },
          { siteCode: "MATRIZ", sourceRequisitionCode: "  ", id: "b" },
        ],
      },
    ])
  })
})
