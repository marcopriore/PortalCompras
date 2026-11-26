/** Agrupa linhas por site_code (1 pedido por centro/filial). */
export function groupLinesBySiteCode<T extends { siteCode: string }>(
  lines: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const line of lines) {
    const key = line.siteCode
    const bucket = groups.get(key)
    if (bucket) bucket.push(line)
    else groups.set(key, [line])
  }
  return groups
}

export function normalizeRequisitionCode(
  code: string | null | undefined,
): string | null {
  const trimmed = code?.trim()
  return trimmed ? trimmed : null
}

export type SiteRequisitionGroup<T> = {
  siteCode: string
  requisitionCode: string | null
  lines: T[]
}

/**
 * 1 pedido por (centro/filial, requisição de origem).
 * O trigger de ciclo da REQ só lê `purchase_orders.requisition_code`; misturar
 * várias REQs no mesmo PO deixa as irmãs presas em `in_quotation`.
 */
export function groupLinesBySiteAndRequisition<
  T extends { siteCode: string; sourceRequisitionCode?: string | null },
>(lines: T[]): SiteRequisitionGroup<T>[] {
  const groups = new Map<string, SiteRequisitionGroup<T>>()
  for (const line of lines) {
    const requisitionCode = normalizeRequisitionCode(line.sourceRequisitionCode)
    const key = `${line.siteCode}\0${requisitionCode ?? ""}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.lines.push(line)
    } else {
      groups.set(key, {
        siteCode: line.siteCode,
        requisitionCode,
        lines: [line],
      })
    }
  }
  return [...groups.values()]
}
