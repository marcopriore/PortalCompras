import { cookies } from "next/headers"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/server"
import { loadSessionUser } from "@/lib/auth/session-user"
import { getQueryClient } from "@/lib/query/make-query-client"
import {
  prefetchAndDehydrate,
  toServerPrefetchQuery,
} from "@/lib/query/prefetch-and-dehydrate"
import {
  resolveListPrefetchScope,
  resolvePrefetchCompanyId,
} from "@/lib/query/prefetch-list-scope"
import { purchaseOrdersListQueryOptions } from "@/lib/queries/purchase-orders-list"
import PedidosPageClient from "./page-client"

export default async function PedidosPage() {
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
    sessionUser && companyId
      ? await prefetchAndDehydrate(queryClient, [
          toServerPrefetchQuery(
            purchaseOrdersListQueryOptions(
              supabase,
              companyId,
              resolveListPrefetchScope(sessionUser),
            ),
          ),
        ])
      : dehydrate(queryClient)

  return (
    <HydrationBoundary state={dehydratedState}>
      <PedidosPageClient />
    </HydrationBoundary>
  )
}