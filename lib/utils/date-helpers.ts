export {
  VALORE_LOCALE,
  VALORE_TIME_ZONE,
  formatDateBR,
  formatDateQueryBR,
  formatDateShortBR,
  formatDateTimeBR,
  formatDateTimeCompactBR,
  formatDateTimeLongBR,
  formatDateTimeSecondsBR,
  formatExportDateStamp,
  formatExportFileTimestamp,
  formatMonthShortBR,
  formatNowBR,
  formatTodayStampDDMMYYYY,
} from "@/lib/formato-data"

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
