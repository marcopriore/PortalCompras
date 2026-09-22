export const DEFAULT_IMPORT_SITE_CODE = "MATRIZ"

export type ImportedRequisitionLine = {
  materialCode: string
  materialDescription: string
  quantity: number
  unitOfMeasure: string | null
  commodityGroup: string | null
  observations: string | null
  siteCode: string
}

export function indexBranchCodes(codes: string[]): {
  byUpper: Map<string, string>
  defaultSiteCode: string | null
} {
  const byUpper = new Map<string, string>()
  for (const raw of codes) {
    const code = raw.trim()
    if (!code) continue
    const upper = code.toUpperCase()
    if (!byUpper.has(upper)) byUpper.set(upper, code)
  }
  return {
    byUpper,
    defaultSiteCode: byUpper.get(DEFAULT_IMPORT_SITE_CODE) ?? null,
  }
}

export function resolveImportedSiteCode(
  raw: string | null | undefined,
  branchIndex: ReturnType<typeof indexBranchCodes>,
): { ok: true; siteCode: string } | { ok: false; error: string } {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) {
    if (!branchIndex.defaultSiteCode) {
      return {
        ok: false,
        error: `centro_filial obrigatório (cadastre a filial ${DEFAULT_IMPORT_SITE_CODE} em Configurações).`,
      }
    }
    return { ok: true, siteCode: branchIndex.defaultSiteCode }
  }

  const match = branchIndex.byUpper.get(trimmed.toUpperCase())
  if (!match) {
    return {
      ok: false,
      error: `centro_filial "${trimmed}" não encontrado (cadastre em Configurações).`,
    }
  }
  return { ok: true, siteCode: match }
}

export function buildImportedRequisitionItemRows(
  companyId: string,
  requisitionId: string,
  lines: ImportedRequisitionLine[],
) {
  return lines.map((line) => ({
    requisition_id: requisitionId,
    company_id: companyId,
    material_code: line.materialCode.trim() || null,
    material_description: line.materialDescription.trim(),
    quantity: Math.max(1, Number(line.quantity) || 1),
    unit_of_measure: line.unitOfMeasure?.trim() || null,
    commodity_group: line.commodityGroup?.trim() || null,
    observations: line.observations?.trim() || null,
    site_code: line.siteCode,
  }))
}
