import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { generateApiKey } from "@/lib/api/external/api-key"
import { type ApiScope } from "@/lib/api/external/scopes"

export type CreateApiKeyInput = {
  companyId: string
  name: string
  scopes: ApiScope[]
  createdBy?: string | null
  expiresAt?: string | null
}

export type CreateApiKeyResult = {
  id: string
  rawKey: string
  keyPrefix: string
}

/**
 * Cria registro de API key. Retorna rawKey uma única vez — não é recuperável depois.
 */
export async function createApiKeyRecord(
  input: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
  const { rawKey, keyPrefix, keyHash } = generateApiKey()
  const service = createServiceRoleClient()

  const { data, error } = await service
    .from("api_keys")
    .insert({
      company_id: input.companyId,
      name: input.name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: input.scopes,
      created_by: input.createdBy ?? null,
      expires_at: input.expiresAt ?? null,
      active: true,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível criar API key")
  }

  return {
    id: (data as { id: string }).id,
    rawKey,
    keyPrefix,
  }
}
