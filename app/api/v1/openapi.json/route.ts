import { buildOpenApiSpec } from "@/lib/api/openapi/v1-catalog"

export const runtime = "nodejs"

export async function GET() {
  const spec = buildOpenApiSpec()
  return Response.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  })
}
