import { mkdir } from "node:fs/promises"
import path from "node:path"
import { chromium } from "@playwright/test"

const BASE_URL =
  process.env.COMMERCIAL_BASE_URL ?? "https://valore.axisstrategy.com.br"
const OUT_DIR = path.resolve("docs/apresentacao-comercial/screenshots")
const EMAIL = process.env.COMMERCIAL_SUPPLIER_EMAIL
const PASSWORD = process.env.COMMERCIAL_SUPPLIER_PASSWORD
const READY_TIMEOUT_MS = Number(process.env.COMMERCIAL_READY_TIMEOUT_MS ?? 180_000)
const SETTLE_MS = Number(process.env.COMMERCIAL_SETTLE_MS ?? 5_000)
const NAV_TIMEOUT_MS = Number(process.env.COMMERCIAL_NAV_TIMEOUT_MS ?? 120_000)

const LOADING_PHRASES = [
  "Carregando permissões",
  "Verificando segurança",
  "Carregando...",
  "Carregando cotações",
  "Carregando pedidos",
  "Carregando requisições",
  "Carregando contratos",
]

async function waitReady(page) {
  await page
    .waitForFunction(
      (phrases) => {
        const text = document.body?.innerText ?? ""
        return !phrases.some((p) => text.includes(p))
      },
      LOADING_PHRASES,
      { timeout: READY_TIMEOUT_MS },
    )
    .catch(() => undefined)

  await page
    .waitForFunction(
      () => {
        const skeletons = document.querySelectorAll(".animate-pulse, .animate-spin")
        const visibleSkeletons = [...skeletons].filter((el) => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        return visibleSkeletons.length === 0
      },
      { timeout: READY_TIMEOUT_MS },
    )
    .catch(() => undefined)

  await page.waitForTimeout(SETTLE_MS)
}

async function gotoAndSettle(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS })
  await waitReady(page)
}

async function snap(page, file) {
  await waitReady(page)
  await page.screenshot({ path: path.join(OUT_DIR, file) })
}

const routes = [
  ["30-fornecedor-login.png", "/fornecedor/login"],
  ["31-fornecedor-dashboard.png", "/fornecedor"],
  ["32-fornecedor-cotacoes.png", "/fornecedor/cotacoes"],
  ["33-fornecedor-pedidos.png", "/fornecedor/pedidos"],
  ["34-fornecedor-atividades.png", "/fornecedor/atividades"],
  ["35-fornecedor-perfil.png", "/fornecedor/perfil"],
]

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await mkdir(OUT_DIR, { recursive: true })

await gotoAndSettle(page, `${BASE_URL}/fornecedor/login`)
await page.fill('input[autocomplete="username"]', EMAIL ?? "")
await page.fill('input[autocomplete="current-password"]', PASSWORD ?? "")
await page.click('button[type="submit"]')
await page.waitForTimeout(15_000)
await page.getByRole("link", { name: "Dashboard" }).waitFor({
  state: "visible",
  timeout: READY_TIMEOUT_MS,
})
await waitReady(page)

for (const [file, route] of routes) {
  await gotoAndSettle(page, `${BASE_URL}${route}`)
  await snap(page, file)
}

await browser.close()
console.log("Fornecedor OK")
