import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  markBackgroundTasksRun,
  shouldRunBackgroundTasks,
} from "@/lib/proxy/background-tasks"
import { getBackgroundTasksCooldownMs } from "@/lib/proxy/load-background-tasks-cooldown"
import {
  markOutboundAutoRetryRun,
  shouldRunOutboundAutoRetry,
} from "@/lib/proxy/outbound-auto-retry-tasks"

const PUBLIC_FORNECEDOR_ROUTES = [
  "/fornecedor/login",
  "/fornecedor/cadastro",
  "/fornecedor/recuperar-senha",
  "/fornecedor/alterar-senha",
] as const

/** API servidor-a-servidor — sem sessão; autenticação no próprio handler. */
const SERVER_TO_SERVER_API_ROUTES = ["/api/support/webhook"] as const

function isServerToServerApiPath(pathname: string): boolean {
  return SERVER_TO_SERVER_API_ROUTES.some((route) => pathname === route)
}

function isPublicFornecedorPath(pathname: string): boolean {
  return PUBLIC_FORNECEDOR_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

function isProtectedFornecedorPath(pathname: string): boolean {
  return pathname.startsWith("/fornecedor") && !isPublicFornecedorPath(pathname)
}

function createProxyResponse(requestHeaders: Headers): NextResponse {
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

function mergeResponseCookies(source: NextResponse, target: NextResponse): void {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })
}

function redirectWithSessionCookies(
  url: URL,
  sessionResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url)
  mergeResponseCookies(sessionResponse, redirectResponse)
  return redirectResponse
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isServerToServerApiPath(pathname)) {
    return NextResponse.next()
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-pathname", pathname)

  let response = createProxyResponse(requestHeaders)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = createProxyResponse(requestHeaders)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = pathname === "/login"
  const isRecuperarSenhaRoute = pathname === "/recuperar-senha"
  const isAuthPublicRoute =
    pathname === "/auth/confirm" ||
    pathname.startsWith("/auth/confirm/") ||
    pathname === "/auth/redefinir-senha" ||
    pathname.startsWith("/auth/redefinir-senha/")
  const isFornecedorLoginRoute = pathname === "/fornecedor/login"
  const isProtectedComprador = pathname.startsWith("/comprador")
  const isProtectedFornecedor = isProtectedFornecedorPath(pathname)
  const isProtectedAdmin = pathname.startsWith("/admin")
  const isProtectedRoute =
    isProtectedComprador || isProtectedFornecedor || isProtectedAdmin

  if (!user) {
    if (
      !isProtectedRoute ||
      isAuthRoute ||
      isRecuperarSenhaRoute ||
      isAuthPublicRoute ||
      isPublicFornecedorPath(pathname)
    ) {
      return response
    }
    const redirectUrl = request.nextUrl.clone()
    if (pathname.startsWith("/fornecedor")) {
      redirectUrl.pathname = "/fornecedor/login"
      redirectUrl.searchParams.delete("redirectTo")
    } else {
      redirectUrl.pathname = "/login"
      redirectUrl.searchParams.set("redirectTo", pathname)
    }
    return redirectWithSessionCookies(redirectUrl, response)
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[proxy] profiles select:", profileError.message)
  }

  const profileType = profileRow?.profile_type ?? "buyer"

  if (
    !isAuthRoute &&
    !isRecuperarSenhaRoute &&
    !isAuthPublicRoute &&
    !isPublicFornecedorPath(pathname)
  ) {
    let companyIdForTasks = profileRow?.company_id as string | undefined
    if (profileRow?.is_superadmin) {
      const selected = request.cookies.get("selected_company_id")?.value
      if (selected) {
        companyIdForTasks = decodeURIComponent(selected)
      }
    }

    const cooldownMs = companyIdForTasks
      ? await getBackgroundTasksCooldownMs(companyIdForTasks)
      : 15 * 60 * 1000

    if (shouldRunBackgroundTasks(request, cooldownMs)) {
      try {
        await supabase.rpc("close_expired_rounds")
        await supabase.rpc("expire_overdue_contracts")
      } catch {
        // falha silenciosa — não bloquear o usuário
      }

      const maintenanceSecret = process.env.CONTRACT_MAINTENANCE_SECRET ?? ""
      const maintenanceUrl = new URL(
        "/api/contracts/scheduled-maintenance",
        request.nextUrl.origin,
      )
      void fetch(maintenanceUrl.toString(), {
        method: "POST",
        headers: maintenanceSecret
          ? { "x-maintenance-key": maintenanceSecret }
          : undefined,
      }).catch(() => {
        // notificações agendadas não devem bloquear o usuário
      })

      markBackgroundTasksRun(response, cooldownMs)
    }

    if (shouldRunOutboundAutoRetry(request)) {
      const maintenanceSecret = process.env.CONTRACT_MAINTENANCE_SECRET ?? ""
      const autoRetryUrl = new URL(
        "/api/integrations/auto-retry",
        request.nextUrl.origin,
      )
      void fetch(autoRetryUrl.toString(), {
        method: "POST",
        headers: maintenanceSecret
          ? { "x-maintenance-key": maintenanceSecret }
          : undefined,
      }).catch(() => {
        // auto-retry não deve bloquear o usuário
      })
      markOutboundAutoRetryRun(response)
    }
  }

  if (isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname =
      profileType === "supplier" ? "/fornecedor" : "/comprador"
    return redirectWithSessionCookies(redirectUrl, response)
  }

  if (
    pathname.startsWith("/fornecedor/cadastro") ||
    pathname.startsWith("/fornecedor/recuperar-senha")
  ) {
    return response
  }

  if (isFornecedorLoginRoute) {
    if (request.nextUrl.searchParams.get("cadastro") === "ok") {
      return response
    }
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname =
      profileType === "supplier" ? "/fornecedor" : "/comprador"
    return redirectWithSessionCookies(redirectUrl, response)
  }

  if (isProtectedComprador && profileType === "supplier") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/fornecedor"
    redirectUrl.searchParams.set("error", "unauthorized_portal")
    return redirectWithSessionCookies(redirectUrl, response)
  }

  if (isProtectedFornecedor && profileType !== "supplier") {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/comprador"
    redirectUrl.searchParams.set("error", "unauthorized_portal")
    return redirectWithSessionCookies(redirectUrl, response)
  }

  return response
}

export const config = {
  // Rotas de página autenticadas; /api/* fica fora do proxy (auth por rota).
  // Se incluir /api no matcher, manter SERVER_TO_SERVER_API_ROUTES excluídas.
  matcher: ["/comprador/:path*", "/fornecedor/:path*", "/admin/:path*", "/login"],
}
