import type { NextRequest, NextResponse } from "next/server"

const BACKGROUND_TASKS_COOKIE = "valore_proxy_bg_tasks"

let lastBackgroundTasksAt = 0

export function shouldRunBackgroundTasks(
  request: NextRequest,
  cooldownMs: number,
): boolean {
  const now = Date.now()

  if (now - lastBackgroundTasksAt < cooldownMs) {
    return false
  }

  const cookieValue = request.cookies.get(BACKGROUND_TASKS_COOKIE)?.value
  if (cookieValue) {
    const cookieTs = Number(cookieValue)
    if (!Number.isNaN(cookieTs) && now - cookieTs < cooldownMs) {
      return false
    }
  }

  return true
}

export function markBackgroundTasksRun(
  response: NextResponse,
  cooldownMs: number,
): void {
  const now = Date.now()
  lastBackgroundTasksAt = now
  response.cookies.set(BACKGROUND_TASKS_COOKIE, String(now), {
    path: "/",
    maxAge: Math.ceil(cooldownMs / 1000),
    sameSite: "lax",
    httpOnly: true,
  })
}
