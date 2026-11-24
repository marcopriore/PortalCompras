import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/** Client singleton no browser; no server sempre instância nova (por request). */
export function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

/** Prefetch no servidor: staleTime curto para não refetch imediato na hidratação. */
export const PREFETCH_STALE_MS = 30_000
