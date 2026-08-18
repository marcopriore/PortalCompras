import type { NextRequest } from "next/server"
import { resolveApiKey, type ApiKeyContext } from "@/lib/api/external/resolve-api-key"
import { apiError } from "@/lib/api/external/responses"
import { logApiRequest } from "@/lib/api/external/log-request"
import { hasApiScope, type ApiScope } from "@/lib/api/external/scopes"

export type ApiKeyHandlerContext = {
  request: NextRequest
  ctx: ApiKeyContext
}

type ApiKeyRouteHandler = (
  input: ApiKeyHandlerContext,
) => Promise<Response> | Response

type ApiKeyOptions = {
  requiredScope?: ApiScope
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

export async function runWithApiKey(
  request: NextRequest,
  handler: ApiKeyRouteHandler,
  options?: ApiKeyOptions,
): Promise<Response> {
  const started = Date.now()
  const path = new URL(request.url).pathname

  const resolved = await resolveApiKey(request)
  if (!resolved.ok) {
    return apiError(resolved.message, resolved.code, resolved.status)
  }

  const { ctx } = resolved

  if (options?.requiredScope && !hasApiScope(ctx.scopes, options.requiredScope)) {
    const response = apiError(
      `Escopo insuficiente: ${options.requiredScope}`,
      "FORBIDDEN",
      403,
    )
    void logApiRequest({
      companyId: ctx.companyId,
      apiKeyId: ctx.apiKeyId,
      method: request.method,
      path,
      statusCode: 403,
      durationMs: Date.now() - started,
      ipAddress: clientIp(request),
    })
    return response
  }

  const response = await handler({ request, ctx })

  void logApiRequest({
    companyId: ctx.companyId,
    apiKeyId: ctx.apiKeyId,
    method: request.method,
    path,
    statusCode: response.status,
    durationMs: Date.now() - started,
    ipAddress: clientIp(request),
  })

  return response
}

export function withApiKey(
  handler: ApiKeyRouteHandler,
  options?: ApiKeyOptions,
) {
  return (request: NextRequest) => runWithApiKey(request, handler, options)
}
