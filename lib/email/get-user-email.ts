export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/get-user-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { email?: string | null }
    return data.email ?? null
  } catch {
    return null
  }
}
