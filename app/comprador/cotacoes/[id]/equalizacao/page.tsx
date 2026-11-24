import { cookies } from "next/headers"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/server"
import { loadSessionUser } from "@/lib/auth/session-user"
import { getQueryClient } from "@/lib/query/make-query-client"
import {
  prefetchAndDehydrate,
  toServerPrefetchQuery,
} from "@/lib/query/prefetch-and-dehydrate"
import { resolvePrefetchCompanyId } from "@/lib/query/prefetch-list-scope"
import { equalizationQueryOptions } from "@/lib/queries/equalization"
import EqualizacaoPageClient from "./page-client"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EqualizacaoPage({ params }: PageProps) {
  const { id } = await params
  const queryClient = getQueryClient()
  const supabase = await createClient()
  const sessionUser = await loadSessionUser(supabase)

  const cookieStore = await cookies()
  const companyId = sessionUser
    ? resolvePrefetchCompanyId(
        sessionUser,
        cookieStore.get("selected_company_id")?.value,
      )
    : null

  const dehydratedState =
    sessionUser && companyId && id
      ? await prefetchAndDehydrate(queryClient, [
          toServerPrefetchQuery(
            equalizationQueryOptions(companyId, id, () => supabase),
          ),
        ])
      : dehydrate(queryClient)

  return (
    <HydrationBoundary state={dehydratedState}>
      <EqualizacaoPageClient params={params} />
    </HydrationBoundary>
  )
}