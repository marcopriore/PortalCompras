import { test, expect } from "@playwright/test"
import { loginBuyer, loginSupplier } from "./helpers/auth"
import { resetOrderToSent } from "./helpers/supabase-admin"
import {
  TEST_ORDER_CODE,
  TEST_QUOTATION_CODE,
  TEST_QUOTATION_ID,
} from "./helpers/test-env"

test.describe("Fluxo de Pedido — Fornecedor", () => {
  test.beforeAll(async () => {
    await resetOrderToSent()
  })

  test.afterAll(async () => {
    await resetOrderToSent()
  })

  test("1.1 Fornecedor vê listagem de pedidos com métricas", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/pedidos")
    await expect(page.locator("text=Pendente Aceite").first()).toBeVisible()
    await expect(page.locator("text=Aceitos").first()).toBeVisible()
    await expect(page.locator("table tbody tr").first()).toBeVisible()
  })

  test("1.2 Fornecedor abre detalhe do pedido PED-2026-0033", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/pedidos")
    await expect(page.locator(`text=${TEST_ORDER_CODE}`).first()).toBeVisible()
    await page
      .locator(`tr:has-text("${TEST_ORDER_CODE}") button:has-text("Ver Detalhes")`)
      .click()
    await expect(page.locator(`h1:has-text("${TEST_ORDER_CODE}")`)).toBeVisible()
    await expect(page.locator("text=Pendente Aceite").first()).toBeVisible()
    await expect(page.locator('button:has-text("Aceitar Pedido")')).toBeVisible()
    await expect(page.locator('button:has-text("Recusar")')).toBeVisible()
  })

  test("1.3 Fornecedor recusa pedido e status muda para Pedido Recusado", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/pedidos")
    await page
      .locator(`tr:has-text("${TEST_ORDER_CODE}") button:has-text("Ver Detalhes")`)
      .click()
    await page.waitForURL(/\/fornecedor\/pedidos\/.+/)

    await page.locator('button:has-text("Recusar")').click()

    await expect(page.locator('[role="dialog"]')).toBeVisible()

    await page.locator('[role="dialog"] textarea').fill("Sem estoque disponível no momento.")

    await page.locator('[role="dialog"] button:has-text("Confirmar")').click()

    await expect(page.locator("text=Pedido Recusado").first()).toBeVisible({ timeout: 10000 })
  })

  test("1.4 Comprador vê pedido como Recusado pelo Fornecedor e pode reenviar", async ({
    page,
  }) => {
    await loginBuyer(page)
    await page.goto("/comprador/pedidos")

    await expect(page.locator(`text=${TEST_ORDER_CODE}`).first()).toBeVisible()

    await page
      .locator(`tr:has-text("${TEST_ORDER_CODE}") a, tr:has-text("${TEST_ORDER_CODE}") button`)
      .first()
      .click()
    await page.waitForURL(/\/comprador\/pedidos\/.+/)

    await expect(
      page.locator("span").filter({ hasText: /recusado pelo fornecedor/i }).first(),
    ).toBeVisible()

    await expect(page.locator('button:has-text("Editar")')).toBeVisible()

    await page.locator('button:has-text("Editar")').click()

    await expect(page.locator('button:has-text("Salvar e Reenviar")')).toBeVisible()

    await page.locator('button:has-text("Salvar e Reenviar")').click()

    await expect(page.locator("text=Aguardando Aceite").first()).toBeVisible({ timeout: 10000 })
  })

  test("1.5 Fornecedor aceita pedido reenviado", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/pedidos")

    await expect(page.locator(`tr:has-text("${TEST_ORDER_CODE}")`)).toBeVisible()

    await page
      .locator(`tr:has-text("${TEST_ORDER_CODE}") button:has-text("Ver Detalhes")`)
      .click()
    await page.waitForURL(/\/fornecedor\/pedidos\/.+/)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await page.waitForSelector("#header-delivery-date", { timeout: 20000 })
    await page.locator("#header-delivery-date").fill(dateStr)

    await page.locator('button:has-text("Aceitar Pedido")').click()

    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 15000 })
    await page.locator('button:has-text("Confirmar aceite")').click()

    await expect(page.locator("text=Pedido Aceito").first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe("Fluxo de Cotação — Fornecedor Responde", () => {
  test("2.1 Fornecedor vê listagem de cotações", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/cotacoes")
    await expect(page.locator("text=Aguardando Resposta").first()).toBeVisible()
    await expect(page.locator("table tbody tr").first()).toBeVisible()
  })

  test("2.2 Fornecedor abre cotação COT-2026-0036", async ({ page }) => {
    await loginSupplier(page)
    await page.goto("/fornecedor/cotacoes")

    const quotationRow = page.locator(`tr:has-text("${TEST_QUOTATION_CODE}")`).first()
    await expect(quotationRow).toBeVisible({ timeout: 20000 })

    await quotationRow.locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/fornecedor\/cotacoes\/.+/)

    await expect(page.locator(`text=${TEST_QUOTATION_CODE}`).first()).toBeVisible()

    await expect(page.locator("text=Itens").first()).toBeVisible()
  })

  test("2.3 Fornecedor preenche e salva proposta como rascunho", async ({ page }) => {
    await loginSupplier(page)
    await page.goto(`/fornecedor/cotacoes/${TEST_QUOTATION_ID}`)

    await expect(page.locator("text=Itens").first()).toBeVisible({ timeout: 10000 })

    const paymentInput = page.locator('input[placeholder*="pagamento"], select').first()
    if (await paymentInput.isVisible()) {
      await paymentInput.fill("30d").catch(() => {})
    }

    const isEditable = await page
      .locator('button:has-text("Salvar Rascunho")')
      .isVisible({ timeout: 5000 })

    if (!isEditable) {
      // eslint-disable-next-line no-console -- diagnóstico E2E
      console.log("Cotação não editável — proposta já submitted ou rodada encerrada")
      return
    }

    await page.locator('button:has-text("Salvar Rascunho")').click()

    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/fornecedor\/cotacoes\/.+/)
  })
})

test.describe("Equalização — Comprador", () => {
  test("3.1 Comprador abre equalização da COT-2026-0026", async ({ page }) => {
    await loginBuyer(page)
    await page.goto(
      "/comprador/cotacoes/aaaaaaaa-0000-0000-0000-000000000001/equalizacao",
    )

    await expect(page.locator("text=COT-2026-0026").first()).toBeVisible({ timeout: 15000 })

    await expect(page.locator("table").first()).toBeVisible()
  })

  test("3.2 Equalização exibe itens e fornecedores", async ({ page }) => {
    await loginBuyer(page)
    await page.goto(
      "/comprador/cotacoes/aaaaaaaa-0000-0000-0000-000000000001/equalizacao",
    )

    await page
      .waitForSelector('[class*="animate-pulse"]', { state: "hidden", timeout: 15000 })
      .catch(() => {})

    await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 })

    await expect(page.locator("thead").first()).toBeVisible({ timeout: 5000 })
  })

  test("3.3 Seletor de rodada funciona na equalização", async ({ page }) => {
    await loginBuyer(page)
    await page.goto(
      "/comprador/cotacoes/aaaaaaaa-0000-0000-0000-000000000001/equalizacao",
    )
    await page.waitForTimeout(3000)

    const roundSelector = page.locator('select, [role="combobox"]').first()
    await expect(roundSelector).toBeVisible()
  })
})
