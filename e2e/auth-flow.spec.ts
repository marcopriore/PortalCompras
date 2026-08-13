import { test, expect } from "@playwright/test"
import {
  ensureLoggedOut,
  loginBuyerWithCheck,
  loginSupplierWithCheck,
} from "./helpers/auth"

test.describe("Fluxo de Login e Logout", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page)
  })

  test("1. Login comprador → vai para /comprador com sidebar", async ({ page }) => {
    await loginBuyerWithCheck(page)
    await expect(page).toHaveURL(/\/comprador/)
    await expect(page.locator("text=Dashboard").first()).toBeVisible()
  })

  test("2. Login fornecedor → vai para /fornecedor com sidebar", async ({ page }) => {
    await loginSupplierWithCheck(page)
    await expect(page).toHaveURL(/\/fornecedor/)
    await expect(page.getByText("Portal Fornecedor")).toBeVisible()
  })

  test("3. Logout comprador → vai para /login sem sidebar", async ({ page }) => {
    await loginBuyerWithCheck(page)
    await page.locator("header").getByRole("button").last().click()
    await expect(page.getByText("Sair", { exact: true })).toBeVisible()
    await page.getByText("Sair", { exact: true }).click()
    await page.waitForURL("**/login**", { timeout: 10000 })
    await expect(page.locator("aside")).not.toBeVisible()
  })

  test("4. Logout fornecedor → vai para /fornecedor/login sem sidebar", async ({ page }) => {
    await loginSupplierWithCheck(page)
    await page.locator("header.border-b.border-border.bg-card button").first().click()
    await expect(page.getByText("Sair", { exact: true })).toBeVisible()
    await page.getByText("Sair", { exact: true }).click()
    await page.waitForURL("**/fornecedor/login**", { timeout: 10000 })
    await expect(page.locator("aside")).not.toBeVisible()
  })

  test("5. Fornecedor logado tenta acessar /comprador → redireciona", async ({ page }) => {
    await loginSupplierWithCheck(page)
    await page.goto("/comprador")
    await page.waitForURL("**/fornecedor**", { timeout: 10000 })
    await expect(page).toHaveURL(/\/fornecedor/)
  })

  test("6. Comprador logado tenta acessar /fornecedor → redireciona", async ({ page }) => {
    await loginBuyerWithCheck(page)
    await page.goto("/fornecedor")
    await page.waitForURL("**/comprador**", { timeout: 10000 })
    await expect(page).toHaveURL(/\/comprador/)
  })

  test("7. Login de comprador em /fornecedor/login → erro de permissão", async ({ page }) => {
    await page.goto("/fornecedor/login")
    await page.fill('input[type="email"]', "teste@procuremax.com.br")
    await page.fill('input[type="password"]', "Senha@1234")
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/fornecedor\/login/)
    await expect(
      page.locator("text=/não permitido|Portal do Comprador/i"),
    ).toBeVisible({ timeout: 5000 })
  })

  test("8. Login de fornecedor em /login → erro de permissão", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[type="email"]', "fornecedor@valore.com.br")
    await page.fill('input[type="password"]', "123456")
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
