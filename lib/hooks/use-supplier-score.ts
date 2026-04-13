import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type SupplierScoreData = {
  supplierId: string
  score: number
  priceScore: number
  coverageScore: number
  leadTimeScore: number
  reliabilityScore: number
  avgPriceVsMarket: number | null
  coveragePercent: number | null
  avgLeadTimeDays: number | null
  reliabilityPercent: number | null
  totalQuotations: number
}

type ScoreWeights = {
  price: number
  coverage: number
  leadTime: number
  reliability: number
}

/** Reparte o restante (100 - preço) na proporção 30 : 20 : 10 entre cobertura, lead time e confiabilidade. */
function normalizeWeights(priceWeight: number): ScoreWeights {
  const remaining = 100 - priceWeight
  return {
    price: priceWeight,
    coverage: (remaining * 30) / 60,
    leadTime: (remaining * 20) / 60,
    reliability: (remaining * 10) / 60,
  }
}

export function useSupplierScores(
  companyId: string | null,
  supplierIds: string[],
  priceWeight = 40,
) {
  const [scores, setScores] = useState<Record<string, SupplierScoreData>>({})
  const [loading, setLoading] = useState(false)

  const fetchScores = useCallback(async () => {
    if (!companyId || supplierIds.length === 0) return
    setLoading(true)

    try {
      const supabase = createClient()
      const weights = normalizeWeights(priceWeight)

      const { data: proposals } = await supabase
        .from("quotation_proposals")
        .select("id, supplier_id, status, round_id, quotation_id")
        .eq("company_id", companyId)
        .in("supplier_id", supplierIds)

      const proposalIds = (proposals ?? []).map((p) => p.id)
      let proposalItems: {
        proposal_id: string
        unit_price: number
        delivery_days: number | null
        quotation_item_id: string
      }[] = []

      if (proposalIds.length > 0) {
        const { data: items } = await supabase
          .from("proposal_items")
          .select("proposal_id, unit_price, delivery_days, quotation_item_id")
          .in("proposal_id", proposalIds)
          .gt("unit_price", 0)
        proposalItems = (items ?? []) as typeof proposalItems
      }

      const quotationItemIds = [...new Set(proposalItems.map((i) => i.quotation_item_id))]
      let avgPriceMap = new Map<string, number>()
      if (quotationItemIds.length > 0) {
        const { data: qtItems } = await supabase
          .from("quotation_items")
          .select("id, average_price")
          .in("id", quotationItemIds)
          .not("average_price", "is", null)
        avgPriceMap = new Map(
          ((qtItems ?? []) as { id: string; average_price: number }[]).map((i) => [
            i.id,
            Number(i.average_price),
          ]),
        )
      }

      const { data: invites } = await supabase
        .from("quotation_suppliers")
        .select("supplier_id, quotation_id")
        .eq("company_id", companyId)
        .in("supplier_id", supplierIds)

      const result: Record<string, SupplierScoreData> = {}

      for (const supplierId of supplierIds) {
        const supplierProposals = (proposals ?? []).filter((p) => p.supplier_id === supplierId)
        const supplierInvites = (invites ?? []).filter((i) => i.supplier_id === supplierId)
        const supplierProposalIds = supplierProposals.map((p) => p.id)
        const supplierItems = proposalItems.filter((i) =>
          supplierProposalIds.includes(i.proposal_id),
        )

        const totalInvites = supplierInvites.length
        const submittedProposals = supplierProposals.filter(
          (p) => p.status === "submitted" || p.status === "selected",
        ).length
        const reliabilityPercent =
          totalInvites > 0 ? (submittedProposals / totalInvites) * 100 : null
        const reliabilityScore =
          reliabilityPercent != null ? Math.min(100, reliabilityPercent) : 50

        const totalItemsInvited = supplierItems.length
        const itemsWithPrice = supplierItems.filter((i) => i.unit_price > 0).length
        const coveragePercent =
          totalItemsInvited > 0 ? (itemsWithPrice / totalItemsInvited) * 100 : null
        const coverageScore =
          coveragePercent != null ? Math.min(100, coveragePercent) : 50

        const leadTimeDays = supplierItems
          .filter((i) => i.delivery_days != null && i.delivery_days > 0)
          .map((i) => i.delivery_days!)
        const avgLeadTimeDays =
          leadTimeDays.length > 0
            ? leadTimeDays.reduce((a, b) => a + b, 0) / leadTimeDays.length
            : null
        const leadTimeScore =
          avgLeadTimeDays != null
            ? Math.max(0, Math.min(100, 100 - (avgLeadTimeDays / 90) * 100))
            : 50

        const priceDiffs: number[] = []
        supplierItems.forEach((item) => {
          const avg = avgPriceMap.get(item.quotation_item_id)
          if (avg == null || avg <= 0) return
          const diff = ((item.unit_price - avg) / avg) * 100
          priceDiffs.push(diff)
        })
        const avgPriceVsMarket =
          priceDiffs.length > 0
            ? priceDiffs.reduce((a, b) => a + b, 0) / priceDiffs.length
            : null
        const priceScore =
          avgPriceVsMarket != null
            ? Math.max(0, Math.min(100, 50 - avgPriceVsMarket * 2.5))
            : 50

        const score = Math.round(
          (priceScore * weights.price +
            coverageScore * weights.coverage +
            leadTimeScore * weights.leadTime +
            reliabilityScore * weights.reliability) /
            100,
        )

        result[supplierId] = {
          supplierId,
          score: Math.max(0, Math.min(100, score)),
          priceScore: Math.round(priceScore),
          coverageScore: Math.round(coverageScore),
          leadTimeScore: Math.round(leadTimeScore),
          reliabilityScore: Math.round(reliabilityScore),
          avgPriceVsMarket:
            avgPriceVsMarket != null ? Math.round(avgPriceVsMarket * 10) / 10 : null,
          coveragePercent: coveragePercent != null ? Math.round(coveragePercent) : null,
          avgLeadTimeDays: avgLeadTimeDays != null ? Math.round(avgLeadTimeDays) : null,
          reliabilityPercent: reliabilityPercent != null ? Math.round(reliabilityPercent) : null,
          totalQuotations: supplierInvites.length,
        }
      }

      setScores(result)
    } finally {
      setLoading(false)
    }
  }, [companyId, supplierIds, priceWeight])

  useEffect(() => {
    void fetchScores()
  }, [fetchScores])

  return { scores, loading, refetch: fetchScores }
}
