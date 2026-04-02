/** Formata string de data tipo YYYY-MM-DD para dd/mm/aaaa */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-")
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

/** Formata ISO timestamp para dd/mm/aaaa (data local). Com `includeTime`, inclui HH:mm. */
export function formatDateTimeBR(
  dateStr: string | null | undefined,
  includeTime = false,
): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  if (!includeTime) {
    return `${dd}/${mm}/${yyyy}`
  }
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/** Prazo em formato data (YYYY-MM-DD) já passou em relação ao dia civil atual */
export function isExpiredDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const todayStart = new Date(new Date().toDateString())
  return new Date(dateStr) < todayStart
}

/**
 * Data-limite (YYYY-MM-DD) cai dentro dos próximos `daysAhead` dias (inclusive hoje como referência).
 * @param daysAhead padrão 2 — mesmo critério usado nas telas de fornecedor (urgente em até 2 dias)
 */
export function isUrgentDate(dateStr: string | null | undefined, daysAhead = 2): boolean {
  if (!dateStr) return false
  const end = new Date(`${dateStr}T23:59:59`)
  const limit = new Date()
  limit.setHours(0, 0, 0, 0)
  limit.setDate(limit.getDate() + daysAhead)
  return end.getTime() <= limit.getTime()
}
