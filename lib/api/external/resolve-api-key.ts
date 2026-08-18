import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isApiKeyFormat, verifyApiKey } from "@/lib/api/external/api-key"
import { parseApiScopes, type ApiScope } from "@/lib/api/external/scopes"

export type ApiKeyContext = {
  companyId: string
  apiKeyId: string
  apiKeyName: string
  scopes: ApiScope[]
}

export type ApiKeyFailure = {
  ok: false
  status: number
  code: "UNAUTHORIZED" | "FORBIDDEN"
  message: string
}

function extractApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }

  const headerKey = request.headers.get("x-api-key")?.trim()
  if (headerKey) return headerKey

  return null
}

export async function resolveApiKey(
  request: Request,
): Promise<{ ok: true; ctx: ApiKeyContext } | ApiKeyFailure> {
  const rawKey = extractApiKeyFromRequest(request)
  if (!rawKey) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "API key ausente. Use Authorization: Bearer ou X-Api-Key.",
    }
  }

  if (!isApiKeyFormat(rawKey)) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Formato de API key inválido.",
    }
  }

  const keyPrefix = rawKey.slice(0, 12)
  const service = createServiceRoleClient()

  const { data: rows, error } = await service
    .from("api_keys")
    .select("id, company_id, name, key_hash, scopes, active, expires_at")
    .eq("key_prefix", keyPrefix)
    .eq("active", true)

  if (error || !rows?.length) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "API key inválida ou revogada.",
    }
  }

  type KeyRow = {
    id: string
    company_id: string
    name: string
    key_hash: string
    scopes: string[] | null
    active: boolean
    expires_at: string | null
  }

  const match = (rows as KeyRow[]).find((row) => verifyApiKey(rawKey, row.key_hash))
  if (!match) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "API key inválida ou revogada.",
    }
  }

  if (match.expires_at && new Date(match.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "API key expirada.",
    }
  }

  const { data: featureRow } = await service
    .from("tenant_features")
    .select("enabled")
    .eq("company_id", match.company_id)
    .eq("feature_key", "api_integrations")
    .maybeSingle()

  if (!featureRow?.enabled) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Integrações via API não estão habilitadas para este tenant.",
    }
  }

  void service
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", match.id)

  return {
    ok: true,
    ctx: {
      companyId: match.company_id,
      apiKeyId: match.id,
      apiKeyName: match.name,
      scopes: parseApiScopes(match.scopes),
    },
  }
}
