import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { logAuditServer } from "@/lib/audit-server"
import {
  canUserImpersonate,
  clearImpersonationCookies,
  getImpersonationRedirectPath,
  loadImpersonationSession,
  setImpersonationCookie,
} from "@/lib/impersonation/server"

async function resolveActorContext() {
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
            /* ignore */
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
    .select("company_id, is_superadmin, profile_type, status")
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

  return { user, companyId, isSuperAdmin }
}

/** GET — estado atual da impersonação */
export async function GET() {
  try {
    const ctx = await resolveActorContext()
    if ("error" in ctx) return ctx.error

    const allowed = await canUserImpersonate(ctx.user.id, ctx.companyId, ctx.isSuperAdmin)
    const session = await loadImpersonationSession(ctx.user.id, ctx.companyId)

    return NextResponse.json({
      canImpersonate: allowed,
      active: Boolean(session),
      session,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** POST — iniciar "Agir como" */
export async function POST(request: Request) {
  try {
    const ctx = await resolveActorContext()
    if ("error" in ctx) return ctx.error

    const allowed = await canUserImpersonate(ctx.user.id, ctx.companyId, ctx.isSuperAdmin)
    if (!allowed) {
      return NextResponse.json(
        { error: "Você não tem permissão para agir em nome de outro usuário." },
        { status: 403 },
      )
    }

    const body = (await request.json()) as { targetUserId?: string }
    if (!body.targetUserId) {
      return NextResponse.json({ error: "targetUserId obrigatório." }, { status: 400 })
    }

    if (body.targetUserId === ctx.user.id) {
      return NextResponse.json(
        { error: "Você não pode agir em nome de si mesmo." },
        { status: 400 },
      )
    }

    await setImpersonationCookie(body.targetUserId)
    const session = await loadImpersonationSession(ctx.user.id, ctx.companyId)

    if (!session) {
      return NextResponse.json(
        { error: "Usuário alvo inválido ou inativo." },
        { status: 400 },
      )
    }

    await logAuditServer({
      eventType: "impersonation",
      description: `Início: agindo como "${session.impersonatedName ?? session.impersonatedUserId}"`,
      companyId: ctx.companyId,
      userId: ctx.user.id,
      entity: "profiles",
      entityId: session.impersonatedUserId,
      metadata: {
        action: "start",
        impersonatedUserId: session.impersonatedUserId,
        impersonatedUserName: session.impersonatedName,
        impersonatedRoles: session.impersonatedRoles,
        impersonatedProfileType: session.impersonatedProfileType,
      },
    })

    return NextResponse.json({
      success: true,
      session,
      redirectTo: getImpersonationRedirectPath(session.impersonatedProfileType),
    })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}

/** DELETE — encerrar "Agir como" */
export async function DELETE() {
  try {
    const ctx = await resolveActorContext()
    if ("error" in ctx) return ctx.error

    const session = await loadImpersonationSession(ctx.user.id, ctx.companyId)
    await clearImpersonationCookies()

    if (session) {
      await logAuditServer({
        eventType: "impersonation",
        description: `Fim: encerrado modo agir como "${session.impersonatedName ?? session.impersonatedUserId}"`,
        companyId: ctx.companyId,
        userId: ctx.user.id,
        entity: "profiles",
        entityId: session.impersonatedUserId,
        metadata: {
          action: "stop",
          impersonatedUserId: session.impersonatedUserId,
          impersonatedUserName: session.impersonatedName,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
