import { describe, expect, it } from "vitest"
import {
  buildImportedRequisitionItemRows,
  indexBranchCodes,
  resolveImportedSiteCode,
} from "@/lib/requisitions/import-excel"

describe("resolveImportedSiteCode", () => {
  const branches = indexBranchCodes(["MATRIZ", "FIL-01"])

  it("defaults empty centro_filial to MATRIZ", () => {
    expect(resolveImportedSiteCode("", branches)).toEqual({
      ok: true,
      siteCode: "MATRIZ",
    })
    expect(resolveImportedSiteCode(null, branches)).toEqual({
      ok: true,
      siteCode: "MATRIZ",
    })
  })

  it("matches provided code case-insensitively", () => {
    expect(resolveImportedSiteCode("fil-01", branches)).toEqual({
      ok: true,
      siteCode: "FIL-01",
    })
  })

  it("rejects unknown branch codes", () => {
    const result = resolveImportedSiteCode("XYZ", branches)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/não encontrado/i)
  })

  it("fails when empty and MATRIZ is missing", () => {
    const noMatriz = indexBranchCodes(["FIL-01"])
    const result = resolveImportedSiteCode("  ", noMatriz)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/MATRIZ/i)
  })
})

describe("buildImportedRequisitionItemRows", () => {
  it("includes site_code so NOT NULL / FK on requisition_items is satisfied", () => {
    const rows = buildImportedRequisitionItemRows("co-1", "req-1", [
      {
        materialCode: "MAT-001",
        materialDescription: "Parafuso",
        quantity: 10,
        unitOfMeasure: "UN",
        commodityGroup: "Mecânica",
        observations: null,
        siteCode: "MATRIZ",
      },
    ])

    expect(rows).toEqual([
      {
        requisition_id: "req-1",
        company_id: "co-1",
        material_code: "MAT-001",
        material_description: "Parafuso",
        quantity: 10,
        unit_of_measure: "UN",
        commodity_group: "Mecânica",
        observations: null,
        site_code: "MATRIZ",
      },
    ])
  })
})
