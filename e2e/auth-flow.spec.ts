import { test, expect, type Page } from "@playwright/test"

const BUYER_EMAIL = "teste@procuremax.com.br"
const BUYER_PASSWORD = "Senha@1234"
const SUPPLIER_EMAIL = "fornecedor@valore.com.br"
const SUPPLIER_PASSWORD = "123456"

function isBuyerAuthedPath(url: URL): boolean {
  const p = url.pathname
  return p === "/comprador" || (p.startsWith("/comprador/") && !p.startsWith("/comprador/login"))
}

function isSupplierAuthedPath(url: URL): boolean {
  const p = url.pathname
  if (p === "/fornecedor") return true
  if (!p.startsWith("/fornecedor/")) return false
  if (p.startsWith("/fornecedor/login") || p.startsWith("/fornecedor/cadastro")) return false
  return true
}

async function loginBuyer(page: Page) {
  await page.goto("/login")
  await page.fill('input[type="email"]', BUYER_EMAIL)
  await page.fill('input[type="password"]', BUYER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => isBuyerAuthedPath(u), { timeout: 15000 })
}

async function loginSupplier(page: Page) {
  await page.goto("/fornecedor/login")
  await page.fill('input[type="email"]', SUPPLIER_EMAIL)
  await page.fill('input[type="password"]', SUPPLIER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => isSupplierAuthedPath(u), { timeout: 15000 })
}

async function ensureLoggedOut(page: Page) {
  await page.goto("/")
  await page.evaluate(() => window.localStorage.clear())
  await page.context().clearCookies()
}

test.describe("Fluxo de Login e Logout", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page)
  })

  test("1. Login comprador → vai para /comprador com sidebar", async ({ page }) => {
    await loginBuyer(page)
    await expect(page).toHaveURL(/\/comprador/)
    await expect(page.locator("aside")).toBeVisible()
    await expect(page.locator("text=Dashboard").first()).toBeVisible()
  })

  test("2. Login fornecedor → vai para /fornecedor com sidebar", async ({ page }) => {
    await loginSupplier(page)
    await expect(page).toHaveURL(/\/fornecedor/)
    await expect(page.locator("aside")).toBeVisible()
    await expect(page.getByText("Portal Fornecedor")).toBeVisible()
  })

  test("3. Logout comprador → vai para /login sem sidebar", async ({ page }) => {
    await loginBuyer(page)
    await page.locator("header").getByRole("button").last().click()
    await expect(page.getByText("Sair", { exact: true })).toBeVisible()
    await page.getByText("Sair", { exact: true }).click()
    await page.waitForURL("**/login**", { timeout: 10000 })
    await expect(page.locator("aside")).not.toBeVisible()
  })

  test("4. Logout fornecedor → vai para /fornecedor/login sem sidebar", async ({ page }) => {
    await loginSupplier(page)
    await page.locator("header.border-b.border-border.bg-card button").first().click()
    await expect(page.getByText("Sair", { exact: true })).toBeVisible()
    await page.getByText("Sair", { exact: true }).click()
    await page.waitForURL("**/fornecedor/login**", { timeout: 10000 })
    await expect(page.locator("aside")).not.toBeVisible()
  })

  test("5. Fornecedor logado tenta acessar /comprador → redireciona", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/comprador")
    await page.waitForURL("**/fornecedor**", { timeout: 10000 })
    await expect(page).toHaveURL(/\/fornecedor/)
  })

  test("6. Comprador logado tenta acessar /fornecedor → redireciona", async ({ page }) => {
    await loginBuyer(page)
    await page.goto("/fornecedor")
    await page.waitForURL("**/comprador**", { timeout: 10000 })
    await expect(page).toHaveURL(/\/comprador/)
  })

  test("7. Login de comprador em /fornecedor/login → erro de permissão", async ({ page }) => {
    await page.goto("/fornecedor/login")
    await page.fill('input[type="email"]', BUYER_EMAIL)
    await page.fill('input[type="password"]', BUYER_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/fornecedor\/login/)
    await expect(
      page.locator("text=/não permitido|Portal do Comprador/i"),
    ).toBeVisible({ timeout: 5000 })
  })

  test("8. Login de fornecedor em /login → erro de permissão", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[type="email"]', SUPPLIER_EMAIL)
    await page.fill('input[type="password"]', SUPPLIER_PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/login/)
    await expect(
      page.locator("text=/não permitido|Portal do Fornecedor/i"),
    ).toBeVisible({ timeout: 5000 })
  })

  test("9. Sem sessão → acesso a /comprador redireciona para /login", async ({ page }) => {
    await page.goto("/comprador")
    await page.waitForURL("**/login**", { timeout: 10000 })
    await expect(page.locator("aside")).not.toBeVisible()
  })

  test("10. Sem sessão → acesso a /fornecedor redireciona para /fornecedor/login", async ({
    page,
  }) => {
    await page.goto("/fornecedor")
    await page.waitForURL("**/fornecedor/login**", { timeout: 10000 })
    await expect(page.locator("aside")).not.toBeVisible()
  })
})
