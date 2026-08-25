import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const REQUISITION_ATTACHMENT_BUCKET = "requisition-attachments"
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const SIGNED_URL_TTL_SECONDS = 3600

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
])

const ALLOWED_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"])

export type RequisitionAttachmentRow = {
  id: string
  file_name: string
  file_path: string
  file_size: number | null
  content_type: string | null
  created_at: string
}

export function isAllowedAttachmentFile(
  fileName: string,
  contentType: string | null | undefined,
): boolean {
  if (contentType && ALLOWED_TYPES.has(contentType)) return true
  const ext = "." + (fileName.split(".").pop()?.toLowerCase() ?? "")
  return ALLOWED_EXTENSIONS.has(ext)
}

export function sanitizeAttachmentFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-]/g, "_").slice(0, 200) || "anexo"
}

export function buildAttachmentStoragePath(
  companyId: string,
  requisitionId: string,
  fileName: string,
): string {
  return `${companyId}/${requisitionId}/${randomUUID()}-${sanitizeAttachmentFileName(fileName)}`
}

export function mapAttachmentToApi(
  row: Pick<
    RequisitionAttachmentRow,
    "id" | "file_name" | "file_size" | "content_type" | "created_at"
  >,
  downloadUrl: string | null,
) {
  return {
    id: row.id,
    file_name: row.file_name,
    file_size: row.file_size,
    content_type: row.content_type,
    created_at: row.created_at,
    download_url: downloadUrl,
  }
}

async function signedDownloadUrl(
  service: SupabaseClient,
  filePath: string,
): Promise<string | null> {
  const { data } = await service.storage
    .from(REQUISITION_ATTACHMENT_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}

export async function listRequisitionAttachments(
  service: SupabaseClient,
  companyId: string,
  requisitionId: string,
) {
  const { data, error } = await service
    .from("requisition_attachments")
    .select("id, file_name, file_path, file_size, content_type, created_at")
    .eq("requisition_id", requisitionId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })

  if (error) {
    return { ok: false as const, message: error.message }
  }

  const rows = (data ?? []) as RequisitionAttachmentRow[]
  const attachments = await Promise.all(
    rows.map(async (row) =>
      mapAttachmentToApi(row, await signedDownloadUrl(service, row.file_path)),
    ),
  )

  return { ok: true as const, attachments }
}

export async function uploadRequisitionAttachment(
  service: SupabaseClient,
  input: {
    companyId: string
    requisitionId: string
    fileName: string
    contentType: string | null
    fileSize: number
    buffer: Buffer
  },
) {
  const path = buildAttachmentStoragePath(
    input.companyId,
    input.requisitionId,
    input.fileName,
  )
  const contentType = input.contentType || "application/octet-stream"

  const { error: uploadError } = await service.storage
    .from(REQUISITION_ATTACHMENT_BUCKET)
    .upload(path, input.buffer, {
      contentType,
      upsert: false,
    })

  if (uploadError) {
    return { ok: false as const, code: "INTERNAL_ERROR" as const, message: uploadError.message }
  }

  const { data: inserted, error: insertError } = await service
    .from("requisition_attachments")
    .insert({
      company_id: input.companyId,
      requisition_id: input.requisitionId,
      file_name: input.fileName,
      file_path: path,
      file_size: input.fileSize,
      content_type: input.contentType,
      uploaded_by: null,
    })
    .select("id, file_name, file_size, content_type, created_at")
    .single()

  if (insertError || !inserted) {
    await service.storage.from(REQUISITION_ATTACHMENT_BUCKET).remove([path])
    return {
      ok: false as const,
      code: "INTERNAL_ERROR" as const,
      message: insertError?.message ?? "Falha ao gravar anexo.",
    }
  }

  return {
    ok: true as const,
    attachment: mapAttachmentToApi(
      inserted as RequisitionAttachmentRow,
      await signedDownloadUrl(service, path),
    ),
  }
}
