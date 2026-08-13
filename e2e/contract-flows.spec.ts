import { test, expect } from "@playwright/test"
import { loginBuyer, loginSupplier } from "./helpers/auth"
import {
  fetchActiveContract,
  fetchOrderWithContractLink,
  findContractMatchScenario,
} from "./helpers/supabase-admin"

test.describe("Fluxo de Contrato — Comprador", () => {
  test("4.1 Comprador vê listagem de contratos com métricas", async ({ page }) => {
    await loginBuyer(page)
    await page.goto("/comprador/contratos")

    await expect(page.locator("h1:has-text('Contratos')")).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator("text=Total de Contratos").first()).toBeVisible()
    await expect(page.locator("text=Ativos").first()).toBeVisible()
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 15000,
    })
  })

  test("4.2 Comprador abre detalhe de contrato ativo", async ({ page }) => {
    const contract = await fetchActiveContract()
    test.skip(!contract, "Nenhum contrato ativo na empresa teste")

    await loginBuyer(page)
    await page.goto(`/comprador/contratos/${contract!.id}`)

    await expect(page.locator(`text=${contract!.code}`).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator(`h1:has-text("${contract!.title}")`)).toBeVisible()
    await expect(page.locator("text=Saldo").first()).toBeVisible()
    await expect(page.locator("text=Valor Total").first()).toBeVisible()
  })

  test("4.3 Comprador navega da listagem ao detalhe pelo botão visualizar", async ({
    page,
  }) => {
    const contract = await fetchActiveContract()
    test.skip(!contract, "Nenhum contrato ativo na empresa teste")

    await loginBuyer(page)
    await page.goto("/comprador/contratos")

    const row = page.locator(`tr:has-text("${contract!.code}")`).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.locator('a[title="Visualizar"]').click()

    await page.waitForURL(/\/comprador\/contratos\/.+/)
    await expect(page.locator(`text=${contract!.code}`).first()).toBeVisible()
  })
})

test.describe("Fluxo de Contrato — Fornecedor", () => {
  test("5.1 Fornecedor vê listagem de contratos com métricas", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/contratos")

    await expect(page.locator("h1:has-text('Contratos')")).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator("text=Aguardando Aceite").first()).toBeVisible()
    await expect(page.locator("text=Ativos").first()).toBeVisible()
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 15000,
    })
  })

  test("5.2 Fornecedor abre detalhe de contrato", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/contratos")

    const firstRow = page.locator("table tbody tr").first()
    await expect(firstRow).toBeVisible({ timeout: 15000 })

    const codeCell = firstRow.locator("td").first()
    const contractCode = (await codeCell.textContent())?.trim() ?? ""
    test.skip(!contractCode, "Nenhum contrato visível para o fornecedor teste")

    await firstRow.locator('button:has-text("Ver")').click()
    await page.waitForURL(/\/fornecedor\/contratos\/.+/)

    await expect(page.locator(`text=${contractCode}`).first()).toBeVisible({
      timeout: 15000,
    })
  })
})

test.describe("Fluxo Contrato + Pedido", () => {
  test("6.1 Pedido vinculado exibe coluna de contrato", async ({ page }) => {
    const fixture = await fetchOrderWithContractLink()
    test.skip(
      !fixture,
      "Nenhum pedido com vínculo de contrato na empresa teste",
    )

    await loginBuyer(page)
    await page.goto(`/comprador/pedidos/${fixture!.orderId}`)

    await expect(page.locator(`h1:has-text("${fixture!.orderCode}")`)).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator("text=Contrato").first()).toBeVisible()
    await expect(page.locator(`text=${fixture!.contractCode}`).first()).toBeVisible()
  })

  test("6.2 Equalização exibe indicador de contrato compatível", async ({ page }) => {
    const scenario = await findContractMatchScenario()
    test.skip(
      !scenario,
      "Sem cenário item+fornecedor+contrato com saldo na empresa teste",
    )

    await loginBuyer(page)
    await page.goto(`/comprador/cotacoes/${scenario!.quotationId}/equalizacao`)

    await expect(page.locator(`text=${scenario!.quotationCode}`).first()).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 })

    await page
      .waitForSelector('[class*="animate-pulse"]', { state: "hidden", timeout: 20000 })
      .catch(() => {})

    await expect(
      page.locator(`[aria-label="Contrato compatível: ${scenario!.contractCode}"]`).first(),
    ).toBeVisible({ timeout: 20000 })
  })
})
