/** Fuso horário padrão do Valore para exibição e exportação. */
export const VALORE_TIME_ZONE = "America/Sao_Paulo" as const
export const VALORE_LOCALE = "pt-BR" as const

type ZonedParts = {
  day: string
  month: string
  year: string
  hour: string
  minute: string
  second: string
}

function parseInstant(value: string): Date | null {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function getZonedParts(date: Date): ZonedParts | null {
  if (Number.isNaN(date.getTime())) return null

  const formatter = new Intl.DateTimeFormat(VALORE_LOCALE, {
    timeZone: VALORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const map: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      map[part.type] = part.value
    }
  }

  return {
    day: map.day ?? "",
    month: map.month ?? "",
    year: map.year ?? "",
    hour: map.hour ?? "",
    minute: map.minute ?? "",
    second: map.second ?? "",
  }
}

function getZonedPartsFromString(value: string | null | undefined): ZonedParts | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-")
    return {
      year,
      month,
      day,
      hour: "00",
      minute: "00",
      second: "00",
    }
  }

  const instant = parseInstant(trimmed)
  if (!instant) return null
  return getZonedParts(instant)
}

function formatDateFromParts(parts: ZonedParts): string {
  return `${parts.day}/${parts.month}/${parts.year}`
}

function formatDateTimeFromParts(parts: ZonedParts, includeSeconds = false): string {
  const date = formatDateFromParts(parts)
  if (includeSeconds) {
    return `${date} ${parts.hour}:${parts.minute}:${parts.second}`
  }
  return `${date} ${parts.hour}:${parts.minute}`
}

/** Data de calendário (YYYY-MM-DD) ou instante ISO → dd/mm/aaaa em Brasília. */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const trimmed = dateStr.trim()
  if (!trimmed) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-")
    return `${d}/${m}/${y}`
  }

  const parts = getZonedPartsFromString(trimmed)
  if (!parts) return trimmed
  return formatDateFromParts(parts)
}

/** Instante ISO → dd/mm/aaaa ou dd/mm/aaaa HH:mm em Brasília. */
export function formatDateTimeBR(
  dateStr: string | null | undefined,
  includeTime = false,
): string {
  if (!dateStr) return "—"
  const trimmed = dateStr.trim()
  if (!trimmed) return "—"

  const parts = getZonedPartsFromString(trimmed)
  if (!parts) return "—"

  if (!includeTime) {
    return formatDateFromParts(parts)
  }

  return formatDateTimeFromParts(parts)
}

/** Instante ISO → dd/mm/aaaa HH:mm:ss em Brasília. */
export function formatDateTimeSecondsBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const parts = getZonedPartsFromString(dateStr)
  if (!parts) return "—"
  return formatDateTimeFromParts(parts, true)
}

/** Instante ISO → dd/mm/aaaa às HH:mm em Brasília. */
export function formatDateTimeLongBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const parts = getZonedPartsFromString(dateStr)
  if (!parts) return "—"
  return `${formatDateFromParts(parts)} às ${parts.hour}:${parts.minute}`
}

/** Instante ISO → dd/mm HH:mm em Brasília. */
export function formatDateTimeCompactBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const parts = getZonedPartsFromString(dateStr)
  if (!parts) return "—"
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`
}

/** Instante ISO → dd/mm/aa HH:mm em Brasília. */
export function formatDateShortBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  const parts = getZonedPartsFromString(dateStr)
  if (!parts) return "—"
  return `${parts.day}/${parts.month}/${parts.year.slice(-2)} ${parts.hour}:${parts.minute}`
}

/** Mês abreviado (ex.: Mar) em Brasília. */
export function formatMonthShortBR(date: Date | string): string {
  const instant = typeof date === "string" ? parseInstant(date) : date
  if (!instant || Number.isNaN(instant.getTime())) return "—"

  const label = new Intl.DateTimeFormat(VALORE_LOCALE, {
    timeZone: VALORE_TIME_ZONE,
    month: "short",
  }).format(instant)

  return label.replace(".", "").charAt(0).toUpperCase() + label.replace(".", "").slice(1)
}

/** Data/hora atual em Brasília (somente data). */
export function formatNowBR(includeTime = false): string {
  return formatDateTimeBR(new Date().toISOString(), includeTime)
}

/** Carimbo para nomes de arquivo: yyyyMMdd_HHmm em Brasília. */
export function formatExportFileTimestamp(date: Date = new Date()): string {
  const parts = getZonedParts(date)
  if (!parts) return ""
  return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}`
}

/** Carimbo para nomes de arquivo: yyyyMMdd em Brasília. */
export function formatExportDateStamp(date: Date = new Date()): string {
  const parts = getZonedParts(date)
  if (!parts) return ""
  return `${parts.year}${parts.month}${parts.day}`
}

/** Carimbo para nomes de arquivo: ddMMyyyy em Brasília. */
export function formatTodayStampDDMMYYYY(date: Date = new Date()): string {
  const parts = getZonedParts(date)
  if (!parts) return ""
  return `${parts.day}${parts.month}${parts.year}`
}

/** Data para query string (yyyy-MM-dd) em Brasília. */
export function formatDateQueryBR(date: Date): string {
  const parts = getZonedParts(date)
  if (!parts) return ""
  return `${parts.year}-${parts.month}-${parts.day}`
}
