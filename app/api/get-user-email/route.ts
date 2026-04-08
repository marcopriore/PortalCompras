import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string }
    const userId = body.userId
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()
    const { data: target, error: targetErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single()

    if (meErr || targetErr || !me?.company_id || me.company_id !== target?.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceClient = createServiceRoleClient()
    const { data, error } = await serviceClient.auth.admin.getUserById(userId)
    if (error) {
      console.error("get-user-email admin:", error)
      return NextResponse.json({ email: null }, { status: 200 })
    }
    return NextResponse.json({ email: data.user?.email ?? null })
  } catch (e) {
    console.error("get-user-email:", e)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
