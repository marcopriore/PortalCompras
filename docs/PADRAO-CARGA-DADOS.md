# Padrão de carga de dados (PRO-MAT)

Documentação operacional para React Query, sessão server e lint de hooks no Valore Portal de Compras.

## Princípios

1. **Identidade no servidor** — layouts autenticados carregam `SessionUser` via `loadSessionUser()` e injetam em `SessionUserProvider`.
2. **Sem cache de módulo** — não usar `Map` global com TTL para listas; usar TanStack Query com chaves estáveis em `lib/queries/keys.ts`.
3. **Fetch puro em `lib/queries/`** — funções recebem `SupabaseClient` (ou chamam API interna); `queryOptions` / `infiniteQueryOptions` exportados ao lado.
4. **Hooks de tela** — `useQuery` / `useInfiniteQuery` com `enabled: !userLoading && !!companyId` (e permissões quando aplicável).

## QueryProvider e remount

`ScopedQueryBridge` (`components/providers/scoped-query-bridge.tsx`) lê `useTenant().companyId` e passa `` scopeKey=`${userId}:${companyId}` `` para `QueryProvider`. Troca de tenant no client remonta o `QueryClient` e descarta o cache — evita vazamento cross-tenant (sem depender só do SSR).

Layouts: `app/comprador/layout.tsx`, `app/solicitante/layout.tsx`, `app/fornecedor/layout.tsx`, `app/admin/layout.tsx`.

## Pastas

| Pasta | Uso |
|-------|-----|
| `lib/queries/keys.ts` | Chaves tipadas por domínio |
| `lib/queries/*.ts` | `fetch*` + `*QueryOptions` |
| `lib/query/make-query-client.ts` | Factory do `QueryClient` |
| `lib/auth/session-user.ts` | Tipo `SessionUser` (server) |
| `contexts/session-user-context.tsx` | Hidratação client |

## SessionUser e useUser

- Preferir dados do layout (`useSessionUserInitial()`).
- **Exceção documentada:** `useUser` escuta `onAuthStateChange` e sincroniza estado local quando login/logout ocorre no client (Supabase não empurra isso pelo SSR). Comentário `eslint-disable-next-line react-hooks/set-state-in-effect` em `lib/hooks/useUser.ts`.

## ESLint — `react-hooks/set-state-in-effect`

Regra em **error** em `eslint.config.mjs`. Objetivo: evitar cascata `useEffect` → `setState` → refetch.

Exceções permitidas (sempre com comentário na linha):

- Sync Auth em `useUser`.
- Sync intencional de formulário a partir do DTO da query no detalhe de pedido (`app/comprador/pedidos/[id]/page.tsx`), quando o espelho local é necessário para edição.

## Ignorados no lint

- `components/ui/**` (shadcn)
- `**/*.test.ts(x)`, `tests/**`

Dívida restante (telas ainda não migradas):

- Inventário lint: `docs/perf/LINT-DEBT.md`
- Backlog por lote (nada fica para trás): `docs/perf/BACKLOG-MIGRACAO.md`

## Como medir

```bash
# app em localhost:3000
PERF_LABEL=antes PERF_RUNS=3 npx playwright test --project=perf
PERF_LABEL=fase5-final PERF_RUNS=3 npx playwright test --project=perf
```

- Artefatos: `docs/perf/baseline-*.json` + `.md`
- Comparativo: `docs/perf/comparativo-antes-fase5.md`
- Qualidade: `npm run test:pre-release` (vitest + `tsc --noEmit`)
- Lint: `npm run lint`