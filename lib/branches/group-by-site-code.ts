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
