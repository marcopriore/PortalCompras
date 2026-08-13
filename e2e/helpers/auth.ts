import { expect, type Page } from "@playwright/test"
import {
  BUYER_EMAIL,
  BUYER_PASSWORD,
  SUPPLIER_EMAIL,
  SUPPLIER_PASSWORD,
} from "./test-env"

export async function loginBuyer(page: Page) {
  await page.goto("/login")
  await page.fill('input[type="email"]', BUYER_EMAIL)
  await page.fill('input[type="password"]', BUYER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.startsWith("/comprador"), {
    timeout: 15000,
  })
}

export async function loginSupplier(page: Page) {
  await page.goto("/fornecedor/login")
  await page.fill('input[type="email"]', SUPPLIER_EMAIL)
  await page.fill('input[type="password"]', SUPPLIER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/fornecedor") && !url.pathname.includes("/login"),
    { timeout: 15000 },
  )
}

export async function ensureLoggedOut(page: Page) {
  await page.goto("/")
  await page.evaluate(() => window.localStorage.clear())
  await page.context().clearCookies()
}

export function isBuyerAuthedPath(url: URL): boolean {
  const p = url.pathname
  return p === "/comprador" || (p.startsWith("/comprador/") && !p.startsWith("/comprador/login"))
}

export function isSupplierAuthedPath(url: URL): boolean {
  const p = url.pathname
  if (p === "/fornecedor") return true
  if (!p.startsWith("/fornecedor/")) return false
  if (p.startsWith("/fornecedor/login") || p.startsWith("/fornecedor/cadastro")) return false
  return true
}

export async function loginBuyerWithCheck(page: Page) {
  await page.goto("/login")
  await page.fill('input[type="email"]', BUYER_EMAIL)
  await page.fill('input[type="password"]', BUYER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => isBuyerAuthedPath(u), { timeout: 15000 })
  await expect(page.locator("aside")).toBeVisible()
}

export async function loginSupplierWithCheck(page: Page) {
  await page.goto("/fornecedor/login")
  await page.fill('input[type="email"]', SUPPLIER_EMAIL)
  await page.fill('input[type="password"]', SUPPLIER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => isSupplierAuthedPath(u), { timeout: 15000 })
  await expect(page.locator("aside")).toBeVisible()
}
