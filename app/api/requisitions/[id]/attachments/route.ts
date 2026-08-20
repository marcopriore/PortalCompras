import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { randomUUID } from "crypto"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024
const BUCKET = "requisition-attachments"

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
])

const ALLOWED_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"])

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
    .select("company_id, is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.company_id) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string

  if (isSuperAdmin) {
    const selectedCookie = cookieStore.get("selected_company_id")
    if (selectedCookie?.value) {
      companyId = decodeURIComponent(selectedCookie.value)
    }
  }

  return {
    supabase,
    companyId,
    userId: user.id,
  }
}

function isAllowedFile(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "")
  return ALLOWED_EXTENSIONS.has(ext)
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id: requisitionId } = await context.params

    const { data: requisition, error: reqError } = await ctx.supabase
      .from("requisitions")
      .select("id")
      .eq("id", requisitionId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }
    if (!requisition) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { data: rows, error: listError } = await ctx.supabase
      .from("requisition_attachments")
      .select("id, file_name, file_path, file_size, content_type, created_at")
      .eq("requisition_id", requisitionId)
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: true })

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    const service = createServiceRoleClient()
    const attachments = await Promise.all(
      (rows ?? []).map(async (row) => {
        const { data: signed } = await service.storage
          .from(BUCKET)
          .createSignedUrl(row.file_path as string, 3600)

        return {
          id: row.id,
          file_name: row.file_name,
          file_size: row.file_size,
          content_type: row.content_type,
          created_at: row.created_at,
          download_url: signed?.signedUrl ?? null,
        }
      }),
    )

    return NextResponse.json({ attachments })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteCtx) {
  try {
    const ctx = await getAuthedContext()
    if ("error" in ctx) return ctx.error

    const { id: requisitionId } = await context.params

    const { data: requisition, error: reqError } = await ctx.supabase
      .from("requisitions")
      .select("id")
      .eq("id", requisitionId)
      .eq("company_id", ctx.companyId)
      .maybeSingle()

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 })
    }
    if (!requisition) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    if (!isAllowedFile(file)) {
      return NextResponse.json(
        { error: "Tipo de arquivo não permitido. Use PDF, Excel ou imagem." },
        { status: 400 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Arquivo excede o limite de 10MB" },
        { status: 400 },
      )
    }

    const safeName =
      file.name.replace(/[^\w.\-]/g, "_").slice(0, 200) || "anexo"
    const path = `${ctx.companyId}/${requisitionId}/${randomUUID()}-${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const service = createServiceRoleClient()

    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: inserted, error: insertError } = await ctx.supabase
      .from("requisition_attachments")
      .insert({
        company_id: ctx.companyId,
        requisition_id: requisitionId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        content_type: file.type || null,
        uploaded_by: ctx.userId,
      })
      .select("id, file_name, file_path, file_size, content_type, created_at")
      .single()

    if (insertError) {
      await service.storage.from(BUCKET).remove([path])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { data: signed } = await service.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)

    return NextResponse.json({
      attachment: {
        ...inserted,
        download_url: signed?.signedUrl ?? null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
