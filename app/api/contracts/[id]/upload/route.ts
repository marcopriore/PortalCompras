import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024
const BUCKET = "contract-files"

async function getAuthedContext() {
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
          } catch {}
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
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  return {
    supabase,
    companyId: profile.company_id as string,
  }
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id: contractId } = await context.params

    const { data: existing, error: fetchError } = await ctx.supabase
      .from("contracts")
      .select("id")
      .eq("id", contractId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only application/pdf is allowed" },
        { status: 400 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 400 },
      )
    }

    const safeName =
      file.name.replace(/[^\w.\-]/g, "_").slice(0, 200) || "contract.pdf"
    const path = `${ctx.companyId}/${contractId}/${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const service = createServiceRoleClient()

    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = service.storage.from(BUCKET).getPublicUrl(path)

    const { error: updateError } = await ctx.supabase
      .from("contracts")
      .update({ file_url: publicUrl })
      .eq("id", contractId)
      .eq("company_id", ctx.companyId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ file_url: publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
