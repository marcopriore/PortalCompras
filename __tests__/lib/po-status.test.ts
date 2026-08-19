import { describe, it, expect } from "vitest"
import { getPOStatusForSupplier, getPOStatusForBuyer } from "@/lib/po-status"

describe("getPOStatusForSupplier", () => {
  it("mapeia sent para Pendente Aceite", () => {
    expect(getPOStatusForSupplier("sent").label).toBe("Pendente Aceite")
  })
  it("mapeia processing para Pedido Aceito", () => {
    expect(getPOStatusForSupplier("processing").label).toBe("Pedido Aceito")
  })
  it("mapeia completed para Pedido Aceito (fornecedor não vê status ERP)", () => {
    expect(getPOStatusForSupplier("completed").label).toBe("Pedido Aceito")
  })
  it("mapeia cancelled para Pedido Cancelado", () => {
    expect(getPOStatusForSupplier("cancelled").label).toBe("Pedido Cancelado")
  })
  it("mapeia refused para Pedido Recusado", () => {
    expect(getPOStatusForSupplier("refused").label).toBe("Pedido Recusado")
  })
  it("retorna o status original para status desconhecido", () => {
    expect(getPOStatusForSupplier("unknown").label).toBe("unknown")
  })
})

describe("getPOStatusForBuyer", () => {
  it("mapeia draft para Rascunho", () => {
    expect(getPOStatusForBuyer("draft").label).toBe("Rascunho")
  })
  it("mapeia sent para Aguardando Aceite", () => {
    expect(getPOStatusForBuyer("sent").label).toBe("Aguardando Aceite")
  })
  it("mapeia processing para Processando Integração", () => {
    expect(getPOStatusForBuyer("processing").label).toBe("Processando Integração")
  })
  it("mapeia refused para Recusado pelo Fornecedor", () => {
    expect(getPOStatusForBuyer("refused").label).toBe("Recusado pelo Fornecedor")
  })
  it("mapeia error para Pedido Reprovado", () => {
    expect(getPOStatusForBuyer("error").label).toBe("Pedido Reprovado")
  })
  it("mapeia completed para Pedido Criado", () => {
    expect(getPOStatusForBuyer("completed").label).toBe("Pedido Criado")
    expect(getPOStatusForBuyer("completed").color).toBe("green")
  })
  it("mapeia integration_error para Erro de Integração", () => {
    expect(getPOStatusForBuyer("integration_error").label).toBe("Erro de Integração")
    expect(getPOStatusForBuyer("integration_error").color).toBe("red")
  })
  it("mapeia cancelled para Cancelado", () => {
    expect(getPOStatusForBuyer("cancelled").label).toBe("Cancelado")
  })
  it("retorna o status original para status desconhecido", () => {
    expect(getPOStatusForBuyer("xyz").label).toBe("xyz")
    expect(getPOStatusForBuyer("xyz").color).toBe("slate")
  })
})

describe("getPOStatusForSupplier - integration statuses show as Pedido Aceito", () => {
  for (const s of ["processing", "completed", "error", "integration_error"]) {
    it(`${s} → Pedido Aceito`, () => {
      expect(getPOStatusForSupplier(s).label).toBe("Pedido Aceito")
    })
  }
})
