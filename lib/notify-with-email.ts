export interface NotifyWithEmailBody {
  userId: string
  companyId: string
  type: string
  title: string
  body?: string
  entity?: string
  entityId?: string
  /** Se vazio, apenas notificação in-app (sem e-mail). */
  toEmail?: string
  subject: string
  html: string
  emailPrefKey: string
}

export async function notifyWithEmail(params: NotifyWithEmailBody): Promise<void> {
  try {
    const res = await fetch("/api/notify-with-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      console.error("notifyWithEmail:", res.status, await res.text())
    }
  } catch (e) {
    console.error("notifyWithEmail:", e)
  }
}
