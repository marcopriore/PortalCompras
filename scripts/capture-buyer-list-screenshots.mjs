/**
 * Recaptura apenas telas de lista do comprador (útil quando algumas ficaram em loading).
 */
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { chromium } from "@playwright/test"

const BASE_URL =
  process.env.COMMERCIAL_BASE_URL ?? "https://valore.axisstrategy.com.br"
const OUT_DIR = path.resolve("docs/apresentacao-comercial/screenshots")
const READY_TIMEOUT_MS = Number(process.env.COMMERCIAL_READY_TIMEOUT_MS ?? 240_000)
const SETTLE_MS = Number(process.env.COMMERCIAL_SETTLE_MS ?? 8_000)

const LOADING_PHRASES = [
  "Carregando permissões",
  "Verificando segurança",
  "Carregando...",
  "Carregando cotações",
  "Carregando pedidos",
  "Carregando requisições",
  "Carregando contratos",
  "Carregando itens",
  "Carregando fornecedores",
  "Carregando ofertas",
  "Carregando chamados",
]

const LIST_PAGES = [
  ["15-comprador-contratos.png", "/comprador/contratos"],
  ["16-comprador-catalogo.png", "/comprador/catalogo"],
  ["17-comprador-itens.png", "/comprador/itens"],
  ["18-comprador-fornecedores.png", "/comprador/fornecedores"],
  ["21-comprador-suporte.png", "/comprador/suporte"],
]

async function waitReady(page, route = "") {
  await page.waitForFunction(
    (phrases) => !phrases.some((p) => (document.body?.innerText ?? "").includes(p)),
    LOADING_PHRASES,
    { timeout: READY_TIMEOUT_MS },
  )

  if (route.includes("/catalogo")) {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText ?? ""
        if (text.includes("Carregando ofertas")) return false
        const cards = document.querySelectorAll("article, [data-offer-card], .grid > div")
        return cards.length > 2 || text.includes("Nenhuma oferta")
      },
      { timeout: READY_TIMEOUT_MS },
    )
  } else if (route.includes("/suporte")) {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText ?? ""
        if (text.includes("Carregando chamados")) return false
        const cells = document.querySelectorAll("table tbody tr td").length
        return cells > 0 || text.includes("Nenhum chamado")
      },
      { timeout: READY_TIMEOUT_MS },
    )
  } else {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText ?? ""
        if (text.includes("Carregando cotações")) return false
        const cells = [...document.querySelectorAll("table tbody tr td")].filter(
          (td) => (td.textContent ?? "").trim().length > 0,
        )
        if (cells.length > 0) return true
        return (
          text.includes("Nenhuma cotação") ||
          text.includes("Nenhum pedido") ||
          text.includes("Nenhum contrato") ||
          text.includes("Nenhum item") ||
          text.includes("Nenhum fornecedor") ||
          text.includes("Sem registros")
        )
      },
      { timeout: READY_TIMEOUT_MS },
    )
  }

  await page.waitForTimeout(SETTLE_MS)
}

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await mkdir(OUT_DIR, { recursive: true })

await page.goto(`${BASE_URL}/login`, { waitUntil: "load", timeout: 120_000 })
await page.locator("#email-buyer").fill(process.env.COMMERCIAL_BUYER_EMAIL ?? "")
await page.locator("#password-buyer").fill(process.env.COMMERCIAL_BUYER_PASSWORD ?? "")
await page.locator('form button[type="submit"]').first().click()
await page.waitForURL((u) => u.pathname.startsWith("/comprador"), { timeout: READY_TIMEOUT_MS })
await waitReady(page)

for (const [file, route] of LIST_PAGES) {
  try {
    console.log(`Capturando ${route}...`)
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "load", timeout: 120_000 })
    await waitReady(page, route)
    await page.screenshot({ path: path.join(OUT_DIR, file) })
  } catch (error) {
    console.warn(`Falha em ${route}:`, error.message)
  }
}

await browser.close()
console.log("Listas OK")
