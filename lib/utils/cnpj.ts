/** Remove máscara e retorna somente dígitos (14 chars) ou string vazia. */
export function normalizeCnpj(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw.replace(/\D/g, "").slice(0, 14)
}

/** Formata 14 dígitos como CNPJ (00.000.000/0001-00). */
export function formatCnpj(digits: string): string {
  const d = normalizeCnpj(digits)
  if (d.length !== 14) return digits
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

/** Aplica máscara de CNPJ conforme o usuário digita (somente dígitos). */
export function maskCnpjInput(raw: string): string {
  const d = normalizeCnpj(raw)
  if (d.length === 0) return ""
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

export function isValidCnpjLength(raw: string | null | undefined): boolean {
  return normalizeCnpj(raw).length === 14
}

export function looksLikeCnpjInput(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  const digits = normalizeCnpj(trimmed)
  if (digits.length >= 11 && !trimmed.includes("@")) return true
  return false
}
