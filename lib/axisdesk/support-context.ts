import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { loadImpersonationSession } from "@/lib/impersonation/server"

export type SupportContext = {
  tenantIdExterno: string
  nomeEmpresa: string
  solicitante: {
    idExterno: string
    nome: string
    email: string
  }
  actorUserId: string
}

export type SupportContextResult =
  | SupportContext
  | { error: NextResponse }

async function resolveUserEmail(userId: string): Promise<string | null> {
  try {
    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient.auth.admin.getUserById(userId)
    if (error) return null
    return data.user?.email ?? null
  } catch {
    return null
  }
}

export async function getSupportContext(): Promise<SupportContextResult> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            /* ignore in Server Components */
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, is_superadmin, profile_type, status")
    .eq("id", user.id)
    .single()

  if (
    !profile?.company_id ||
    profile.profile_type === "supplier" ||
    profile.status !== "active"
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  const impersonation = await loadImpersonationSession(user.id, companyId)
  const effectiveUserId =
    impersonation?.impersonatedUserId ?? user.id

  let solicitanteNome =
    impersonation?.impersonatedName?.trim() ||
    profile.full_name?.trim() ||
    user.email ||
    "Usuário"

  let solicitanteEmail = user.email ?? ""

  if (impersonation) {
    const impersonatedEmail = await resolveUserEmail(effectiveUserId)
    if (impersonatedEmail) {
      solicitanteEmail = impersonatedEmail
    }
    if (!impersonation.impersonatedName?.trim()) {
      const serviceClient = createServiceRoleClient()
      const { data: targetProfile } = await serviceClient
        .from("profiles")
        .select("full_name")
        .eq("id", effectiveUserId)
        .maybeSingle()
      if (targetProfile?.full_name) {
        solicitanteNome = String(targetProfile.full_name).trim()
      }
    }
  }

  if (!solicitanteEmail) {
    return {
      error: NextResponse.json(
        { error: "E-mail do solicitante não encontrado." },
        { status: 400 },
      ),
    }
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single()

  if (companyError || !company?.name) {
    return {
      error: NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 }),
    }
  }

  return {
    tenantIdExterno: companyId,
    nomeEmpresa: String(company.name),
    solicitante: {
      idExterno: effectiveUserId,
      nome: solicitanteNome,
      email: solicitanteEmail,
    },
    actorUserId: user.id,
  }
}
