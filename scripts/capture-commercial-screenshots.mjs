/**
 * Captura prints do sistema para apresentação comercial.
 *
 * Uso (credenciais via env — não versionar):
 *   $env:COMMERCIAL_BASE_URL="https://valore.axisstrategy.com.br"
 *   $env:COMMERCIAL_BUYER_EMAIL="..."
 *   $env:COMMERCIAL_BUYER_PASSWORD="..."
 *   $env:COMMERCIAL_SUPPLIER_EMAIL="..."
 *   $env:COMMERCIAL_SUPPLIER_PASSWORD="..."
 *   $env:COMMERCIAL_ADMIN_EMAIL="..."
 *   $env:COMMERCIAL_ADMIN_PASSWORD="..."
 *   node scripts/capture-commercial-screenshots.mjs
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "@playwright/test"

const BASE_URL =
  process.env.COMMERCIAL_BASE_URL ?? "https://valore.axisstrategy.com.br"
const OUT_DIR = path.resolve("docs/apresentacao-comercial/screenshots")
const TENANT_NAME = process.env.COMMERCIAL_TENANT_NAME ?? "Apresentação POC"
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
  "Carregando itens",
  "Carregando fornecedores",
  "Carregando ofertas",
  "Carregando chamados",
  "Carregando logs",
  "Carregando tenants",
  "Carregando integrações",
]

const BUYER_EMAIL = process.env.COMMERCIAL_BUYER_EMAIL
const BUYER_PASSWORD = process.env.COMMERCIAL_BUYER_PASSWORD
const SUPPLIER_EMAIL = process.env.COMMERCIAL_SUPPLIER_EMAIL
const SUPPLIER_PASSWORD = process.env.COMMERCIAL_SUPPLIER_PASSWORD
const ADMIN_EMAIL = process.env.COMMERCIAL_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.COMMERCIAL_ADMIN_PASSWORD

function requireEnv(name, value) {
  if (!value) throw new Error(`Defina a variável ${name}`)
}

async function waitForPortalReady(page) {
  await page.waitForFunction(
    (phrases) => {
      const text = document.body?.innerText ?? ""
      return !phrases.some((p) => text.includes(p))
    },
    LOADING_PHRASES,
    { timeout: READY_TIMEOUT_MS },
  )

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

async function waitForListReady(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? ""
      const loadingMarkers = [
        "Carregando cotações",
        "Carregando pedidos",
        "Carregando requisições",
        "Carregando contratos",
        "Carregando itens",
        "Carregando fornecedores",
        "Carregando ofertas",
        "Carregando chamados",
        "Carregando logs",
      ]
      if (loadingMarkers.some((m) => text.includes(m))) return false

      const dataCells = [...document.querySelectorAll("table tbody tr td")].filter(
        (td) => (td.textContent ?? "").trim().length > 0,
      )
      if (dataCells.length > 0) return true

      const emptyMarkers = [
        "Nenhuma cotação",
        "Nenhum pedido",
        "Nenhuma requisição",
        "Nenhum contrato",
        "Nenhum item",
        "Nenhum fornecedor",
        "Nenhum chamado",
        "Sem registros",
      ]
      return emptyMarkers.some((m) => text.includes(m))
    },
    { timeout: READY_TIMEOUT_MS },
  )
  await page.waitForTimeout(SETTLE_MS)
}

async function gotoAndSettle(page, url, options = {}) {
  const { list = false } = options
  await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS })
  await waitForPortalReady(page)
  if (list) await waitForListReady(page)
}

async function snap(page, file, waitMs = 0) {
  if (waitMs > 0) await page.waitForTimeout(waitMs)
  await waitForPortalReady(page)
  const target = path.join(OUT_DIR, file)
  await page.screenshot({ path: target, fullPage: false })
  return target
}

async function loginBuyer(page) {
  requireEnv("COMMERCIAL_BUYER_EMAIL", BUYER_EMAIL)
  requireEnv("COMMERCIAL_BUYER_PASSWORD", BUYER_PASSWORD)
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" })
  await page.locator("#email-buyer").waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS })
  await page.locator("#email-buyer").fill(BUYER_EMAIL)
  await page.locator("#password-buyer").fill(BUYER_PASSWORD)
  await page.locator('form button[type="submit"]').first().click()
  await page.waitForURL((u) => u.pathname.startsWith("/comprador"), {
    timeout: READY_TIMEOUT_MS,
  })
  await page.getByRole("link", { name: "Dashboard" }).first().waitFor({
    state: "visible",
    timeout: READY_TIMEOUT_MS,
  })
  await waitForPortalReady(page)
}

async function loginSupplier(page) {
  requireEnv("COMMERCIAL_SUPPLIER_EMAIL", SUPPLIER_EMAIL)
  requireEnv("COMMERCIAL_SUPPLIER_PASSWORD", SUPPLIER_PASSWORD)
  await page.goto(`${BASE_URL}/fornecedor/login`, { waitUntil: "domcontentloaded" })
  await page.fill('input[autocomplete="username"]', SUPPLIER_EMAIL)
  await page.fill('input[autocomplete="current-password"]', SUPPLIER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(15_000)
  await page.getByRole("link", { name: "Dashboard" }).waitFor({
    state: "visible",
    timeout: READY_TIMEOUT_MS,
  })
  await waitForPortalReady(page)
}

async function loginAdmin(page) {
  requireEnv("COMMERCIAL_ADMIN_EMAIL", ADMIN_EMAIL)
  requireEnv("COMMERCIAL_ADMIN_PASSWORD", ADMIN_PASSWORD)
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" })
  await page.locator("#email-buyer").waitFor({ state: "visible", timeout: NAV_TIMEOUT_MS })
  await page.locator("#email-buyer").fill(ADMIN_EMAIL)
  await page.locator("#password-buyer").fill(ADMIN_PASSWORD)
  await page.locator('form button[type="submit"]').first().click()
  await page.waitForURL(
    (u) =>
      u.pathname.startsWith("/comprador") || u.pathname.startsWith("/admin"),
    { timeout: READY_TIMEOUT_MS },
  )
  await waitForPortalReady(page)
  const trigger = page.locator('[role="combobox"]').first()
  if (await trigger.isVisible({ timeout: 10000 }).catch(() => false)) {
    await trigger.click()
    const option = page.getByRole("option", { name: new RegExp(TENANT_NAME, "i") })
    if (await option.count()) {
      await option.first().click()
      await waitForPortalReady(page)
    }
  }
}

async function logout(page) {
  await page.context().clearCookies()
  await page.goto(`${BASE_URL}/`)
  await page.evaluate(() => window.localStorage.clear())
}

async function capturePublicScreens(page) {
  await gotoAndSettle(page, `${BASE_URL}/`)
  await snap(page, "01-landing.png", 2000)
  await gotoAndSettle(page, `${BASE_URL}/login`)
  await snap(page, "02-login.png", 1500)
}

async function captureBuyerScreens(page) {
  const routes = [
    ["10-comprador-dashboard.png", "/comprador", { list: false }],
    ["11-comprador-requisicoes.png", "/comprador/requisicoes", { list: true }],
    ["12-comprador-aprovacoes.png", "/comprador/aprovacoes", { list: true }],
    ["13-comprador-cotacoes.png", "/comprador/cotacoes", { list: true }],
    ["14-comprador-pedidos.png", "/comprador/pedidos", { list: true }],
    ["15-comprador-contratos.png", "/comprador/contratos", { list: true }],
    ["16-comprador-catalogo.png", "/comprador/catalogo", { list: true }],
    ["17-comprador-itens.png", "/comprador/itens", { list: true }],
    ["18-comprador-fornecedores.png", "/comprador/fornecedores", { list: true }],
    ["19-comprador-relatorios.png", "/comprador/relatorios", { list: false }],
    ["20-comprador-configuracoes.png", "/comprador/configuracoes", { list: false }],
    ["21-comprador-suporte.png", "/comprador/suporte", { list: true }],
    ["22-comprador-integracoes-monitor.png", "/comprador/integracoes/monitor", { list: true }],
    ["23-solicitante-lista.png", "/solicitante", { list: true }],
  ]

  for (const [file, route, options] of routes) {
    const url = `${BASE_URL}${route}`
    await gotoAndSettle(page, url, options)
    await snap(page, file, 1500)
  }

  await gotoAndSettle(page, `${BASE_URL}/comprador/cotacoes`, { list: true })
  const cotacaoLink = page.getByRole("link", { name: /ver detalhes/i }).first()
  if (await cotacaoLink.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await cotacaoLink.click()
    await waitForPortalReady(page)
    await snap(page, "13b-comprador-cotacao-detalhe.png", 3000)
  }

  await gotoAndSettle(page, `${BASE_URL}/comprador/pedidos`, { list: true })
  const pedidoLink = page.getByRole("link", { name: /ver detalhes/i }).first()
  if (await pedidoLink.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await pedidoLink.click()
    await waitForPortalReady(page)
    await snap(page, "14b-comprador-pedido-detalhe.png", 3000)
  }

  await gotoAndSettle(page, `${BASE_URL}/comprador/contratos`, { list: true })
  const contratoLink = page.getByRole("link", { name: /ver detalhes/i }).first()
  if (await contratoLink.isVisible({ timeout: 30_000 }).catch(() => false)) {
    await contratoLink.click()
    await waitForPortalReady(page)
    await snap(page, "15b-comprador-contrato-detalhe.png", 3000)
  }
}

async function captureSupplierScreens(page) {
  const routes = [
    ["30-fornecedor-login.png", `${BASE_URL}/fornecedor/login`],
    ["31-fornecedor-dashboard.png", "/fornecedor"],
    ["32-fornecedor-cotacoes.png", "/fornecedor/cotacoes"],
    ["33-fornecedor-pedidos.png", "/fornecedor/pedidos"],
    ["34-fornecedor-atividades.png", "/fornecedor/atividades"],
    ["35-fornecedor-perfil.png", "/fornecedor/perfil"],
  ]

  for (const [file, route] of routes) {
    const url = route.startsWith("http") ? route : `${BASE_URL}${route}`
    await gotoAndSettle(page, url)
    await snap(page, file, 1000)
  }
}

async function captureAdminScreens(page) {
  const routes = [
    ["40-admin-tenants.png", "/admin/tenants"],
    ["41-admin-fornecedores.png", "/admin/fornecedores"],
    ["42-admin-integracoes.png", "/admin/integracoes"],
    ["43-admin-logs.png", "/admin/logs"],
  ]

  for (const [file, route] of routes) {
    await gotoAndSettle(page, `${BASE_URL}${route}`, { list: true })
    await snap(page, file, 1500)
  }
}

async function withFreshPage(browser, fn) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  try {
    await fn(page)
  } finally {
    await context.close()
  }
}

async function main() {
  requireEnv("COMMERCIAL_BUYER_EMAIL", BUYER_EMAIL)
  requireEnv("COMMERCIAL_BUYER_PASSWORD", BUYER_PASSWORD)
  requireEnv("COMMERCIAL_SUPPLIER_EMAIL", SUPPLIER_EMAIL)
  requireEnv("COMMERCIAL_SUPPLIER_PASSWORD", SUPPLIER_PASSWORD)
  requireEnv("COMMERCIAL_ADMIN_EMAIL", ADMIN_EMAIL)
  requireEnv("COMMERCIAL_ADMIN_PASSWORD", ADMIN_PASSWORD)

  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const manifest = []

  try {
    console.log(`Base URL: ${BASE_URL}`)
    console.log(`Saída: ${OUT_DIR}`)

    await withFreshPage(browser, async (page) => {
      await capturePublicScreens(page)
    })

    if (process.env.COMMERCIAL_SKIP_BUYER !== "1") {
      await withFreshPage(browser, async (page) => {
        await loginBuyer(page)
        await captureBuyerScreens(page)
      })
      manifest.push({ persona: "comprador", tenant: TENANT_NAME })
    }

    try {
      await withFreshPage(browser, async (page) => {
        await loginSupplier(page)
        await captureSupplierScreens(page)
      })
      manifest.push({ persona: "fornecedor" })
    } catch (error) {
      console.warn("Fornecedor: captura parcial ou falha:", error.message)
      try {
        const { execSync } = await import("node:child_process")
        execSync("node scripts/capture-supplier-screenshots.mjs", {
          stdio: "inherit",
          env: process.env,
        })
        manifest.push({ persona: "fornecedor", fallback: true })
      } catch {
        /* ignore */
      }
    }

    if (process.env.COMMERCIAL_SKIP_ADMIN !== "1") {
      try {
        await withFreshPage(browser, async (page) => {
          await loginAdmin(page)
          await captureAdminScreens(page)
        })
        manifest.push({ persona: "admin", tenant: TENANT_NAME })
      } catch (error) {
        console.warn("Admin: captura parcial ou falha:", error.message)
      }
    }

    await writeFile(
      path.join(OUT_DIR, "manifest.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          tenant: TENANT_NAME,
          personas: manifest,
        },
        null,
        2,
      ),
    )

    console.log("Captura concluída.")
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
