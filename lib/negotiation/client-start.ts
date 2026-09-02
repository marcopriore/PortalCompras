import type { NegotiationPlanInput } from "@/types/negotiation"

export async function createAndStartNegotiationPlan(
  quotationId: string,
  input: NegotiationPlanInput,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const createRes = await fetch(`/api/quotations/${quotationId}/negotiation-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const createJson = (await createRes.json()) as {
    error?: string
    plan?: { id: string }
  }
  if (!createRes.ok || !createJson.plan?.id) {
    return {
      ok: false,
      error: createJson.error ?? "Não foi possível criar o plano de negociação.",
    }
  }

  const startRes = await fetch(`/api/negotiation-plans/${createJson.plan.id}/start`, {
    method: "POST",
  })
  const startJson = (await startRes.json()) as { error?: string; message?: string }
  if (!startRes.ok) {
    return {
      ok: false,
      error: startJson.error ?? "Plano criado, mas não foi possível iniciar a negociação.",
    }
  }

  return {
    ok: true,
    message: startJson.message ?? "Negociação assistida iniciada.",
  }
}
