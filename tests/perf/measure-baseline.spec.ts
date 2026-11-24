import { test, expect, type Page, type Request } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { loginBuyer } from "../../e2e/helpers/auth"
import { PERF_ROUTES, type PerfRoute } from "./routes"

const RUNS = Number(process.env.PERF_RUNS ?? "3")
const LABEL = process.env.PERF_LABEL ?? "antes"
const OUT_DIR = path.join(process.cwd(), "docs", "perf")

type RunMetrics = {
  routeId: string
  mode: "cold" | "nav"
  ms: number
  requests: number
  serial: number
  ok: boolean
  error?: string
}

function isAppDataRequest(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.pathname.startsWith("/_next/")) return false
    if (u.pathname.match(/\.(js|css|map|ico|png|jpg|svg|woff2?)$/)) return false
    if (u.hostname.includes("supabase")) return true
    if (u.pathname.startsWith("/api/")) return true
    return false
  } catch {
    return false
  }
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Profundidade aproximada: cadeia A termina → B começa. */
function estimateSerialDepth(
  events: Array<{ start: number; end: number }>,
): number {
  if (events.length === 0) return 0
  const sorted = [...events].sort((a, b) => a.start - b.start)
  let maxDepth = 1
  let depth = 1
  let lastEnd = sorted[0]!.end
  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i]!
    if (e.start >= lastEnd - 5) {
      depth += 1
      lastEnd = e.end
      maxDepth = Math.max(maxDepth, depth)
    } else {
      lastEnd = Math.max(lastEnd, e.end)
    }
  }
  return maxDepth
}

async function measureRoute(
  page: Page,
  route: PerfRoute,
  mode: "cold" | "nav",
): Promise<RunMetrics> {
  const timings: Array<{ start: number; end: number }> = []
  let requestCount = 0

  const onRequest = (req: Request) => {
    if (!isAppDataRequest(req.url())) return
    requestCount += 1
    const start = Date.now()
    const mark = { start, end: start }
    timings.push(mark)
    req
      .response()
      .then(() => {
        mark.end = Date.now()
      })
      .catch(() => {
        mark.end = Date.now()
      })
  }

  page.on("request", onRequest)

  const t0 = Date.now()
  try {
    if (mode === "cold") {
      await page.goto(route.path, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
    } else if (route.menuLabel) {
      const link = page.locator("aside a, aside button", {
        hasText: new RegExp(`^\\s*${route.menuLabel}\\s*$`, "i"),
      })
      const fallback = page.getByRole("link", { name: route.menuLabel })
      const target = (await link.count()) > 0 ? link.first() : fallback.first()
      await target.click({ timeout: 15000 })
      await page.waitForURL(
        (u) =>
          u.pathname === route.path || u.pathname.startsWith(`${route.path}/`),
        { timeout: 30000 },
      )
    } else {
      await page.goto(route.path, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
    }

    await page
      .locator(route.readySelector)
      .first()
      .waitFor({ state: "visible", timeout: 45000 })

    await page.waitForTimeout(400)

    const ms = Date.now() - t0
    page.off("request", onRequest)
    return {
      routeId: route.id,
      mode,
      ms,
      requests: requestCount,
      serial: estimateSerialDepth(timings),
      ok: true,
    }
  } catch (err) {
    page.off("request", onRequest)
    return {
      routeId: route.id,
      mode,
      ms: Date.now() - t0,
      requests: requestCount,
      serial: estimateSerialDepth(timings),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

test.describe.configure({ mode: "serial" })

test(`perf baseline ${LABEL}`, async ({ page }) => {
  test.setTimeout(Math.max(600_000, RUNS * PERF_ROUTES.length * 60_000))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  await loginBuyer(page)

  const allRuns: RunMetrics[] = []

  for (let run = 0; run < RUNS; run++) {
    for (const route of PERF_ROUTES) {
      const cold = await measureRoute(page, route, "cold")
      allRuns.push(cold)

      if (route.menuLabel) {
        await page.goto("/comprador", { waitUntil: "domcontentloaded" })
        await page
          .locator("aside")
          .first()
          .waitFor({ state: "visible", timeout: 20000 })
        await page.waitForTimeout(250)
        const nav = await measureRoute(page, route, "nav")
        allRuns.push(nav)
      }
    }
  }

  type Agg = {
    routeId: string
    mode: "cold" | "nav"
    n: number
    ms_median: number
    requests_median: number
    serial_median: number
    ok_rate: number
    errors: string[]
  }

  const groups = new Map<string, RunMetrics[]>()
  for (const r of allRuns) {
    const key = `${r.routeId}::${r.mode}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  const summary: Agg[] = [...groups.entries()].map(([key, list]) => {
    const [routeId, mode] = key.split("::") as [string, "cold" | "nav"]
    const oks = list.filter((x) => x.ok)
    return {
      routeId,
      mode,
      n: list.length,
      ms_median: median(oks.map((x) => x.ms)),
      requests_median: median(oks.map((x) => x.requests)),
      serial_median: median(oks.map((x) => x.serial)),
      ok_rate: oks.length / list.length,
      errors: list.filter((x) => x.error).map((x) => x.error!),
    }
  })

  const payload = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    runsPerRoute: RUNS,
    routes: PERF_ROUTES.map((r) => ({ id: r.id, path: r.path })),
    summary,
    raw: allRuns,
  }

  const outFile = path.join(OUT_DIR, `baseline-${LABEL}.json`)
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8")

  const mdLines = [
    `# Perf baseline — ${LABEL}`,
    "",
    `Gerado: ${payload.generatedAt} · N=${RUNS}`,
    "",
    "| Rota | Modo | ms (med) | reqs (med) | serial (med) | ok |",
    "|------|------|----------|------------|--------------|----|",
    ...summary.map(
      (s) =>
        `| ${s.routeId} | ${s.mode} | ${Math.round(s.ms_median)} | ${Math.round(s.requests_median)} | ${Math.round(s.serial_median)} | ${(s.ok_rate * 100).toFixed(0)}% |`,
    ),
    "",
    `Arquivo: \`${outFile.replace(/\\/g, "/")}\``,
  ]
  fs.writeFileSync(
    path.join(OUT_DIR, `baseline-${LABEL}.md`),
    mdLines.join("\n"),
    "utf8",
  )

  console.log(mdLines.join("\n"))
  expect(summary.length).toBeGreaterThan(0)
})
