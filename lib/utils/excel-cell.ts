import type ExcelJS from "exceljs"

/** Extrai valor escalar de célula Excel (hyperlink, rich text, fórmula, etc.). */
export function getExcelCellScalar(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value
  if (v == null || v === "") return null
  if (typeof v === "number") return v
  if (typeof v === "string") return v
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result?: unknown }).result
    if (typeof r === "number") return r
    if (typeof r === "string") return r
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const parts = (v as { richText: { text: string }[] }).richText
    return parts.map((p) => p.text).join("")
  }
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text: string }).text)
  }
  if (typeof v === "object" && v !== null && "hyperlink" in v) {
    const link = v as { text?: string; hyperlink?: string }
    if (link.text?.trim()) return link.text.trim()
    const href = link.hyperlink?.trim() ?? ""
    if (href.toLowerCase().startsWith("mailto:")) {
      return href.slice(7).trim()
    }
    return href
  }
  return String(v)
}

/** Texto legível da célula — preferir `.text` do ExcelJS (mailto/hyperlink). */
export function excelCellToString(cell: ExcelJS.Cell): string {
  const fromText = cell.text?.trim()
  if (fromText) return fromText
  const scalar = getExcelCellScalar(cell)
  if (scalar == null) return ""
  return String(scalar).trim()
}

/** Normaliza e-mail importado; rejeita lixo tipo `[object Object]`. */
export function normalizeImportedEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s || s === "[object Object]" || s.includes("[object")) return null
  if (!s.includes("@")) return null
  return s.toLowerCase()
}

/** Exibe e-mail de contato sanitizado na UI. */
export function displayContactEmail(raw: string | null | undefined): string {
  const normalized = normalizeImportedEmail(raw)
  return normalized ?? "—"
}
