import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const PUBLIC_FORNECEDOR_ROUTES = ["/fornecedor/login", "/fornecedor/cadastro"] as const

function isPublicFornecedorPath(pathname: string): boolean {
  return PUBLIC_FORNECEDOR_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

function isProtectedFornecedorPath(pathname: string): boolean {
  return pathname.startsWith("/fornecedor") && !isPublicFornecedorPath(pathname)
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
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

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname === "/login"
  const isProtectedComprador = pathname.startsWith("/comprador")
  const isProtectedFornecedor = isProtectedFornecedorPath(pathname)
  const isProtectedAdmin = pathname.startsWith("/admin")
  const isProtectedRoute =
    isProtectedComprador || isProtectedFornecedor || isProtectedAdmin

  if (!user) {
    if (!isProtectedRoute) {
      return response
    }
    if (isPublicFornecedorPath(pathname)) {
      return response
    }
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const { data } = await supabase
    .from("profiles")
    .select("profile_type")
    .eq("id", user.id)
    .single()

  const profileType = data?.profile_type ?? "buyer"

  if (isAuthRoute) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname =
      profileType === "supplier" ? "/fornecedor" : "/comprador"
    return NextResponse.redirect(redirectUrl)
  }

  if (isProtectedComprador && profileType === "supplier") {
    return NextResponse.redirect(new URL("/fornecedor", request.url))
  }

  if (isProtectedFornecedor && profileType !== "supplier") {
    return NextResponse.redirect(new URL("/comprador", request.url))
  }

  return response
}

export const config = {
  matcher: ["/comprador/:path*", "/fornecedor/:path*", "/admin/:path*", "/login"],
}
