import { describe, expect, it } from "vitest"
import {
  getRequisitionStatusMeta,
  mapPoStatusToRequisitionStatus,
  pickMostAdvancedPoStatus,
  resolveRequisitionStatusFromSiblingPos,
} from "@/lib/requisitions/status"
import {
  buildCatalogRequisitionTimeline,
  buildStandardRequisitionTimeline,
} from "@/lib/requisitions/timeline"

describe("mapPoStatusToRequisitionStatus", () => {
  it("mapeia awaiting_approval do PO para awaiting_approval da REQ", () => {
    expect(mapPoStatusToRequisitionStatus("awaiting_approval")).toBe(
      "awaiting_approval",
    )
  })

  it("mapeia draft/error/refused/integration_error para awaiting_buyer", () => {
    expect(mapPoStatusToRequisitionStatus("draft")).toBe("awaiting_buyer")
    expect(mapPoStatusToRequisitionStatus("error")).toBe("awaiting_buyer")
    expect(mapPoStatusToRequisitionStatus("refused")).toBe("awaiting_buyer")
    expect(mapPoStatusToRequisitionStatus("integration_error")).toBe(
      "awaiting_buyer",
    )
  })

  it("mapeia sent/processing para awaiting_supplier", () => {
    expect(mapPoStatusToRequisitionStatus("sent")).toBe("awaiting_supplier")
    expect(mapPoStatusToRequisitionStatus("processing")).toBe(
      "awaiting_supplier",
    )
  })

  it("mapeia completed; cancelled libera para approved", () => {
    expect(mapPoStatusToRequisitionStatus("completed")).toBe("completed")
    expect(mapPoStatusToRequisitionStatus("cancelled")).toBe("approved")
  })

  it("retorna null para status desconhecido", () => {
    expect(mapPoStatusToRequisitionStatus("unknown")).toBeNull()
  })
})

describe("resolveRequisitionStatusFromSiblingPos", () => {
  it("não rebaixa REQ completed quando um irmão ainda está processing/sent", () => {
    expect(pickMostAdvancedPoStatus(["completed", "processing"])).toBe(
      "completed",
    )
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["completed", "processing"],
      }),
    ).toBe("completed")
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["completed", "sent"],
      }),
    ).toBe("completed")
  })

  it("não rebaixa awaiting_supplier quando um irmão é recusado", () => {
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["sent", "refused"],
      }),
    ).toBe("awaiting_supplier")
  })

  it("ignora cancelled e usa o irmão ativo mais avançado", () => {
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["cancelled", "sent", "draft"],
      }),
    ).toBe("awaiting_supplier")
  })

  it("sem PO ativo: approved, ou in_quotation se ainda houver cotação", () => {
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["cancelled"],
      }),
    ).toBe("approved")
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["cancelled", "cancelled"],
        quotationId: "q1",
      }),
    ).toBe("in_quotation")
  })

  it("catálogo em rascunho com alçada de CC fica awaiting_approval", () => {
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["draft", "draft"],
        origin: "catalog",
        catalogPostCheckoutMode: "cost_center_approval",
      }),
    ).toBe("awaiting_approval")
  })

  it("catálogo com um PO já sent não volta para awaiting_approval pelo irmão draft", () => {
    expect(
      resolveRequisitionStatusFromSiblingPos({
        poStatuses: ["sent", "draft"],
        origin: "catalog",
        catalogPostCheckoutMode: "cost_center_approval",
      }),
    ).toBe("awaiting_supplier")
  })
})

describe("getRequisitionStatusMeta", () => {
  it("usa Pendente Aprovação para pending", () => {
    expect(getRequisitionStatusMeta("pending").label).toBe("Pendente Aprovação")
  })

  it("rotula novos status do ciclo do pedido", () => {
    expect(getRequisitionStatusMeta("awaiting_buyer").label).toBe(
      "Pendente Comprador",
    )
    expect(getRequisitionStatusMeta("awaiting_approval").label).toBe(
      "Pendente Aprovação",
    )
    expect(getRequisitionStatusMeta("awaiting_supplier").label).toBe(
      "Pendente Aceite Fornecedor",
    )
  })
})

describe("requisition timeline", () => {
  it("catálogo: Criada → Pendente Comprador → Aceite → Concluída", () => {
    const steps = buildCatalogRequisitionTimeline(
      {
        status: "awaiting_buyer",
        created_at: "2026-01-01T10:00:00Z",
        origin: "catalog",
      },
      [{ status: "draft", created_at: "2026-01-02T10:00:00Z" }],
    )
    expect(steps.map((s) => s.label)).toEqual([
      "Criada",
      "Pendente Comprador",
      "Aceite Fornecedor",
      "Concluída",
    ])
    expect(steps.find((s) => s.key === "awaiting_buyer")?.status).toBe("active")
    expect(steps.find((s) => s.key === "awaiting_supplier")?.status).toBe(
      "pending",
    )
  })

  it("catálogo: Pendente Aprovação (gestor CC)", () => {
    const steps = buildCatalogRequisitionTimeline(
      {
        status: "awaiting_approval",
        created_at: "2026-01-01T10:00:00Z",
        origin: "catalog",
      },
      [{ status: "draft", created_at: "2026-01-02T10:00:00Z" }],
    )
    expect(steps.map((s) => s.label)).toEqual([
      "Criada",
      "Pendente Aprovação",
      "Aceite Fornecedor",
      "Concluída",
    ])
    expect(steps.find((s) => s.key === "awaiting_approval")?.status).toBe(
      "active",
    )
  })

  it("exibe data só em etapas concluídas", () => {
    const steps = buildCatalogRequisitionTimeline(
      {
        status: "awaiting_buyer",
        created_at: "2026-01-01T10:00:00Z",
        origin: "catalog",
      },
      [{ status: "draft", created_at: "2026-01-02T10:00:00Z" }],
    )
    expect(steps.find((s) => s.key === "created")?.date).toBe(
      "2026-01-01T10:00:00Z",
    )
    expect(steps.find((s) => s.key === "awaiting_buyer")?.date).toBeNull()
    expect(steps.find((s) => s.key === "awaiting_supplier")?.date).toBeNull()
    expect(steps.find((s) => s.key === "completed")?.date).toBeNull()
  })

  it("padrão inclui aprovação e cotação antes do ciclo do pedido", () => {
    const steps = buildStandardRequisitionTimeline(
      {
        status: "awaiting_supplier",
        created_at: "2026-01-01T10:00:00Z",
        approved_at: "2026-01-02T10:00:00Z",
      },
      { status: "completed", created_at: "2026-01-03T10:00:00Z" },
      [
        {
          status: "sent",
          created_at: "2026-01-04T10:00:00Z",
          accepted_at: null,
        },
      ],
    )
    expect(steps.map((s) => s.label)).toEqual([
      "Criada",
      "Aprovação",
      "Cotação",
      "Pendente Comprador",
      "Aceite Fornecedor",
      "Concluída",
    ])
    expect(steps.find((s) => s.key === "awaiting_buyer")?.status).toBe(
      "completed",
    )
    expect(steps.find((s) => s.key === "awaiting_buyer")?.date).toBeNull()
    expect(steps.find((s) => s.key === "awaiting_supplier")?.status).toBe(
      "active",
    )
    expect(steps.find((s) => s.key === "awaiting_supplier")?.date).toBeNull()
    expect(steps.find((s) => s.key === "approval")?.date).toBe(
      "2026-01-02T10:00:00Z",
    )
  })

  it("Aceite Fornecedor mostra accepted_at ao concluir", () => {
    const steps = buildCatalogRequisitionTimeline(
      {
        status: "completed",
        created_at: "2026-01-01T10:00:00Z",
        origin: "catalog",
      },
      [
        {
          status: "completed",
          created_at: "2026-01-02T10:00:00Z",
          accepted_at: "2026-01-05T12:00:00Z",
        },
      ],
    )
    expect(steps.find((s) => s.key === "awaiting_supplier")?.date).toBe(
      "2026-01-05T12:00:00Z",
    )
    expect(steps.find((s) => s.key === "completed")?.date).toBe(
      "2026-01-05T12:00:00Z",
    )
  })
})
