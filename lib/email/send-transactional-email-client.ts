export async function sendTransactionalEmailClient(params: {
  to: string
  subject: string
  html: string
  companyId: string
}): Promise<void> {
  try {
    const res = await fetch("/api/send-transactional-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      console.error("sendTransactionalEmailClient:", res.status, await res.text())
    }
  } catch (e) {
    console.error("sendTransactionalEmailClient:", e)
  }
}
