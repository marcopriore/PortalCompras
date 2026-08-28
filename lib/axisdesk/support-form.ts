import type { AxisDeskAnexo } from "@/lib/axisdesk/types"

export const AXISDESK_MAX_TITULO = 200
export const AXISDESK_MAX_TEXTO = 2000

export function formatLocalFileSize(bytes: number): string {
  if (Number.isNaN(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function fileToAnexo(file: File): Promise<AxisDeskAnexo> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler arquivo."))
        return
      }
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."))
    reader.readAsDataURL(file)
  })

  return {
    nome_arquivo: file.name,
    tipo_mime: file.type || "application/octet-stream",
    conteudo_base64: base64,
  }
}

export async function filesToAnexos(files: File[]): Promise<AxisDeskAnexo[]> {
  return Promise.all(files.map((file) => fileToAnexo(file)))
}

export function mergeSelectedFiles(
  current: File[],
  incoming: FileList | null,
): File[] {
  if (!incoming || incoming.length === 0) return current
  const merged = [...current]
  for (const file of Array.from(incoming)) {
    const exists = merged.some(
      (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
    )
    if (!exists) merged.push(file)
  }
  return merged
}

export function removeSelectedFile(current: File[], index: number): File[] {
  return current.filter((_, i) => i !== index)
}
