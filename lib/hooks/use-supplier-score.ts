import { useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { supplierScoresQueryOptions } from "@/lib/queries/supplier-scores"
import { queryKeys } from "@/lib/queries/keys"

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

export function useSupplierScores(
  companyId: string | null,
  supplierIds: string[],
  priceWeight = 40,
) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const supplierIdsKey = useMemo(
    () => [...supplierIds].sort().join(","),
    [supplierIds],
  )

  const query = useQuery({
    ...supplierScoresQueryOptions(
      companyId ?? "",
      supplierIds,
      priceWeight,
      () => supabase,
    ),
    enabled: Boolean(companyId) && supplierIds.length > 0,
  })

  const scores = query.data ?? {}
  const loading = query.isLoading

  const refetch = useCallback(async () => {
    if (!companyId || supplierIds.length === 0) return
    await queryClient.invalidateQueries({
      queryKey: queryKeys.supplierScores(companyId, supplierIdsKey, priceWeight),
    })
  }, [companyId, priceWeight, queryClient, supplierIds.length, supplierIdsKey])

  return { scores, loading, refetch }
}