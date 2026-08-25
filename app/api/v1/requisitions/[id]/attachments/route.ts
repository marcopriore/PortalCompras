import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  isAllowedAttachmentFile,
  listRequisitionAttachments,
  MAX_ATTACHMENT_BYTES,
  uploadRequisitionAttachment,
} from "@/lib/api/external/attachment-service"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import { apiError, apiSuccess } from "@/lib/api/external/responses"
import { resolveRequisitionRow } from "@/lib/api/external/resolve-entity"
import { runWithApiKey } from "@/lib/api/external/with-api-key"

export const runtime = "nodejs"

type RouteParams = {
  params: Promise<{ id: string }>
}

async function resolveRequisitionForAttachments(
  companyId: string,
  idOrCode: string,
) {
  const service = createServiceRoleClient()
  const { data, error } = await resolveRequisitionRow(service, companyId, idOrCode)
  return { service, data, error }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador da requisição é obrigatório.", "VALIDATION_ERROR", 400)
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "requisitions")
      if (!enabled) {
        return apiError(
          "Módulo de requisições não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const { service, data, error } = await resolveRequisitionForAttachments(
        ctx.companyId,
        idOrCode,
      )

      if (error) {
        return apiError("Erro ao buscar requisição.", "INTERNAL_ERROR", 500)
      }
      if (!data) {
        return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      const result = await listRequisitionAttachments(
        service,
        ctx.companyId,
        data.id as string,
      )
      if (!result.ok) {
        return apiError("Erro ao listar anexos.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({ attachments: result.attachments })
    },
    { requiredScope: "requisitions:read" },
  )
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: rawId } = await params
  const idOrCode = decodeURIComponent(rawId).trim()

  if (!idOrCode) {
    return apiError("Identificador da requisição é obrigatório.", "VALIDATION_ERROR", 400)
  }

  return runWithApiKey(
    request,
    async ({ ctx }) => {
      const enabled = await isTenantFeatureEnabled(ctx.companyId, "requisitions")
      if (!enabled) {
        return apiError(
          "Módulo de requisições não habilitado para este tenant.",
          "FORBIDDEN",
          403,
        )
      }

      const { service, data, error } = await resolveRequisitionForAttachments(
        ctx.companyId,
        idOrCode,
      )

      if (error) {
        return apiError("Erro ao buscar requisição.", "INTERNAL_ERROR", 500)
      }
      if (!data) {
        return apiError(`Requisição não encontrada: ${idOrCode}`, "NOT_FOUND", 404)
      }

      if (data.status === "cancelled") {
        return apiError(
          "Não é possível anexar arquivo em requisição cancelada.",
          "CONFLICT",
          409,
        )
      }

      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        return apiError(
          "Body inválido. Envie multipart/form-data com o campo file.",
          "VALIDATION_ERROR",
          400,
        )
      }

      const file = formData.get("file")
      if (!file || !(file instanceof File)) {
        return apiError(
          "Campo file é obrigatório (multipart/form-data).",
          "VALIDATION_ERROR",
          400,
        )
      }

      if (!isAllowedAttachmentFile(file.name, file.type || null)) {
        return apiError(
          "Tipo de arquivo não permitido. Use PDF, Excel ou imagem (png/jpg).",
          "VALIDATION_ERROR",
          400,
        )
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        return apiError("Arquivo excede o limite de 10MB.", "VALIDATION_ERROR", 400)
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await uploadRequisitionAttachment(service, {
        companyId: ctx.companyId,
        requisitionId: data.id as string,
        fileName: file.name,
        contentType: file.type || null,
        fileSize: file.size,
        buffer,
      })

      if (!result.ok) {
        return apiError("Erro ao enviar anexo.", "INTERNAL_ERROR", 500)
      }

      return apiSuccess({ attachment: result.attachment }, 201)
    },
    { requiredScope: "requisitions:write" },
  )
}
