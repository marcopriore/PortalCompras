import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/send-email"

/** E-mail transacional sem checagem de notification_preferences (ex.: nova rodada → fornecedor). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      to?: string
      subject?: string
      html?: string
      companyId?: string
    }
    if (
      !body.to ||
      !body.subject ||
      !body.html ||
      !body.companyId ||
      typeof body.to !== "string"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (pErr || !profile?.company_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const ok = await sendEmail({
      to: body.to,
      subject: body.subject,
      html: body.html,
    })
    return NextResponse.json({ ok })
  } catch (e) {
    console.error("send-transactional-email:", e)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
