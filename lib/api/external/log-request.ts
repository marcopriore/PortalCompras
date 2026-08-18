import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function logApiRequest(input: {
  companyId: string
  apiKeyId: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  ipAddress: string | null
}): Promise<void> {
  try {
    const service = createServiceRoleClient()
    await service.from("api_request_logs").insert({
      company_id: input.companyId,
      api_key_id: input.apiKeyId,
      method: input.method,
      path: input.path,
      status_code: input.statusCode,
      duration_ms: input.durationMs,
      ip_address: input.ipAddress,
    })
  } catch {
    // não bloquear resposta da API por falha de log
  }
}
