import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireSuperAdminCompany } from "@/lib/api/require-superadmin-company"
import { createApiKeyRecord } from "@/lib/api/external/create-api-key"
import { API_SCOPES, isApiScope, type ApiScope } from "@/lib/api/external/scopes"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const service = createServiceRoleClient()
    const { data, error } = await service
      .from("api_keys")
      .select(
        "id, name, key_prefix, scopes, active, expires_at, last_used_at, created_at",
      )
      .eq("company_id", auth.companyId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ keys: data ?? [], availableScopes: API_SCOPES })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdminCompany(request)
    if ("error" in auth) return auth.error

    const body = (await request.json()) as {
      name?: string
      scopes?: string[]
      expires_at?: string | null
    }

    const name = String(body.name ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "name é obrigatório." }, { status: 400 })
    }

    const scopes = (body.scopes ?? []).filter(isApiScope) as ApiScope[]
    if (scopes.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos um escopo válido." },
        { status: 400 },
      )
    }

    const result = await createApiKeyRecord({
      companyId: auth.companyId,
      name,
      scopes,
      createdBy: auth.user.id,
      expiresAt: body.expires_at ?? null,
    })

    return NextResponse.json(
      {
        key: {
          id: result.id,
          name,
          key_prefix: result.keyPrefix,
          scopes,
          raw_key: result.rawKey,
        },
        message: "Copie a chave agora. Ela não será exibida novamente.",
      },
      { status: 201 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
