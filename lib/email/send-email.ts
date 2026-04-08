import { Resend } from "resend"

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@axisstrategy.com.br"

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("sendEmail: RESEND_API_KEY is not set")
    return false
  }
  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: `Valore <${FROM}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    if (error) {
      console.error("sendEmail error:", error)
      return false
    }
    return true
  } catch (err) {
    console.error("sendEmail exception:", err)
    return false
  }
}
