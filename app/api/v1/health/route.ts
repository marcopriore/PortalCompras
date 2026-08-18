import { withApiKey } from "@/lib/api/external/with-api-key"
import { apiSuccess } from "@/lib/api/external/responses"

export const runtime = "nodejs"

export const GET = withApiKey(async ({ ctx }) => {
  return apiSuccess({
    ok: true,
    companyId: ctx.companyId,
    apiKeyName: ctx.apiKeyName,
    scopes: ctx.scopes,
    version: "v1",
  })
})
