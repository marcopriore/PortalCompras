import {
  dehydrate,
  type DehydratedState,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { PREFETCH_STALE_MS } from "@/lib/query/make-query-client"

export type ServerPrefetchQuery = Parameters<QueryClient["prefetchQuery"]>[0]

/** Resultado típico de `queryOptions()` — tipagem larga para evitar conflito com dataTag do TanStack v5. */
type QueryOptionsLike = {
  queryKey: QueryKey
  queryFn?: ServerPrefetchQuery["queryFn"]
  enabled?: boolean
}

/** Aceita o retorno de `queryOptions()` sem acoplar aos tipos internos do TanStack v5. */
export function toServerPrefetchQuery(options: object): ServerPrefetchQuery {
  const { queryKey, queryFn, enabled } = options as QueryOptionsLike
  if (!queryKey?.length || !queryFn) {
    throw new Error("toServerPrefetchQuery: queryKey e queryFn são obrigatórios")
  }
  return {
    queryKey,
    queryFn,
    ...(typeof enabled === "boolean" ? { enabled } : {}),
  }
}

export async function prefetchQueries(
  queryClient: QueryClient,
  queries: ServerPrefetchQuery[],
): Promise<void> {
  await Promise.all(
    queries.map((options) =>
      queryClient.prefetchQuery({
        ...options,
        staleTime: PREFETCH_STALE_MS,
      }),
    ),
  )
}

export async function prefetchAndDehydrate(
  queryClient: QueryClient,
  queries: ServerPrefetchQuery[],
): Promise<DehydratedState> {
  await prefetchQueries(queryClient, queries)
  return dehydrate(queryClient)
}