import { describe, expect, it, vi } from "vitest"
import { persistLineEditsThenSendRefusedOrder } from "@/lib/purchase-orders/persist-then-resend"

describe("persistLineEditsThenSendRefusedOrder", () => {
  it("grava linhas antes de mudar o status para sent", async () => {
    const steps: string[] = []
    const ok = await persistLineEditsThenSendRefusedOrder({
      persistLineEdits: async () => {
        steps.push("items")
        return true
      },
      sendToSupplier: async () => {
        steps.push("status")
      },
    })
    expect(ok).toBe(true)
    expect(steps).toEqual(["items", "status"])
  })

  it("não reenvia se a persistência das linhas falhar", async () => {
    const sendToSupplier = vi.fn(async () => {
      throw new Error("status não deveria ser atualizado")
    })
    const ok = await persistLineEditsThenSendRefusedOrder({
      persistLineEdits: async () => false,
      sendToSupplier,
    })
    expect(ok).toBe(false)
    expect(sendToSupplier).not.toHaveBeenCalled()
  })

  it("não reenvia se a persistência das linhas lançar", async () => {
    const sendToSupplier = vi.fn(async () => undefined)
    await expect(
      persistLineEditsThenSendRefusedOrder({
        persistLineEdits: async () => {
          throw new Error("falha ao gravar quantidade")
        },
        sendToSupplier,
      }),
    ).rejects.toThrow("falha ao gravar quantidade")
    expect(sendToSupplier).not.toHaveBeenCalled()
  })
})
