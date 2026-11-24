# VALORE — Plano de refatoração de carga de dados (padrão PRO-MAT)

> Fase 0 deliverable. Não executar Fases 1+ sem autorização.

## Mapa da stack

| Área | Situação no VALORE |
|------|--------------------|
| Framework | Next.js 16 App Router + React 19.2 |
| Auth | Supabase Auth (`createClient` server/client) |
| Multi-tenant | `company_id` + cookie `selected_company_id` + `TenantProvider` |
| Dados | Supabase JS direto no client (maioria) + API Routes |
| Cache de lista | **Não há** TanStack Query / SWR |
| Cache de módulo | `lib/contracts/contract-matches-cache.ts` (Map + TTL 60s) |
| Layout autenticado | `app/comprador/layout.tsx` já resolve user/profile no server e passa `initialCompanyId` |
| Cascata atual | Layout server → client `useUser` refetch → `usePermissions` → página `useEffect` fetch |
| React Compiler | **Desligado** (`next.config.mjs` sem `reactCompiler`) |
| ESLint | Script `eslint .` existe; **sem** `eslint.config` / pacote eslint versionado aparente; `set-state-in-effect` **não** configurado |
| Medição | Playwright project `perf` → `tests/perf/` → artefatos `docs/perf/` |

### Contagem (Fase 0)

- ~195 `useEffect(` em app/components/hooks/contexts (excluindo `components/ui`)
- ~89 arquivos candidatos a carga de dados (`useEffect` + supabase/fetch/api)
- Páginas de lista/detalhe críticas quase todas: `useState` + `useEffect` + `setLoading`

### Rotas de baseline (12)

Ver `tests/perf/routes.ts`: dashboard, requisicoes, cotacoes, pedidos, contratos, fornecedores, itens, aprovacoes, catalogo, relatorios, pedido-detalhe, equalizacao.

---

## Fase 1a — Sessão/usuário no servidor

**Objetivo:** menu e shell sem 4–5 round-trips client só para montar identidade.

Arquivos-alvo:

- `app/comprador/layout.tsx` (já tem getUser+profile) — expandir payload inicial (roles, profile_type, supplier_id, company name)
- Espelhar em `app/solicitante/layout.tsx` e shell fornecedor (`components/layout/fornecedor-portal-shell.tsx` / layout fornecedor)
- Novo: `lib/auth/session-user.ts` (server-only) — tipo `SessionUser` estável
- Novo: `contexts/session-user-context.tsx` — provider com `initialUser` do layout
- Adaptar: `lib/hooks/useUser.ts` — ler contexto; só escutar `onAuthStateChange` (exceção documentada para sync Auth)
- Adaptar: `lib/hooks/usePermissions.ts` — receber userId/companyId do contexto sem re-fetch de profile

**Manter:** RLS, cookie tenant, sem service role no client.

---

## Fase 1b — Query client

- Dependência: `@tanstack/react-query` (+ `@tanstack/react-query-devtools` opcional)
- `lib/query/make-query-client.ts`, `components/providers/query-provider.tsx`
- Remount key: `` `${userId}:${companyId}` `` no provider (filho do TenantProvider)
- Defaults: `staleTime: 0`, `gcTime` sensato; prefetch server com `staleTime` curto (~30s) na hidratação
- Helpers: `prefetchQuery` + `HydrationBoundary` em listas críticas
- Pasta: `lib/queries/` (keys tipadas + `queryOptions` por domínio: requisitions, quotations, orders, …)

Wire no layout comprador (e depois outros portais).

---

## Fase 2 — Telas críticas (ordem pela baseline `antes`)

Prioridade medida (cold: ms / reqs / serial):

1. `app/comprador/cotacoes/[id]/equalizacao/page.tsx` — 7229 ms · 55 req · serial 4
2. `app/comprador/page.tsx` (dashboard) — 6897 ms · 54 req · serial 2 (+ nav ainda 43 req)
3. `app/comprador/pedidos/[id]/page.tsx` — 6865 ms · 28 req
4. `app/comprador/pedidos/page.tsx` — 6552 ms · 25 req · **serial 5** (pior cascata)
5. `app/comprador/requisicoes/page.tsx` — 5992 ms · 23 req · serial 4

(Próximo lote Fase 4: fornecedores, relatorios, catalogo, aprovacoes, itens, contratos.)

Padrão por tela: extrair fetch puro → `lib/queries/*` → `useQuery` → invalidação em mutações existentes; loading/empty/error com tokens do design system.

Remedir subset com `PERF_LABEL=fase2`.

---

## Fase 3 — API / data layer

- Remover ou isolar cache de módulo: `lib/contracts/contract-matches-cache.ts` → Query (ou cache request-scoped no server)
- Hooks `use-tenant-settings`, `use-tenant-feature-config`, `use-notifications`, `use-company-logo` → queries escopadas
- Onde APIs internas buscam joins/contagens pesadas sem necessidade da tela: parâmetros opcionais (`include=`)
- Separar: funções de leitura (recebem `SupabaseClient`) vs hooks UI

---

## Fase 4 — Restante + lint

- Migrar listas restantes: contratos, fornecedores, itens, aprovações, catálogo, relatórios, portal fornecedor/solicitante, admin lists
- Estado derivado (filtros URL, drafts espelho de props) sem efeito
- Instalar/configurar ESLint flat config + `eslint-plugin-react-hooks`
- `react-hooks/set-state-in-effect`: **error**
- Exceções documentadas (ex.: sync Auth session) com comentário `eslint-disable-next-line` + nota em docs
- `npm run lint` limpo (ou lista pré-existente documentada)

---

## Fase 5 — Fechamento

- Doc: `docs/PADRAO-CARGA-DADOS.md` (padrão, pastas, exceções, como medir)
- `PERF_LABEL=fase5-final` vs `antes`
- `npm run test:pre-release` (vitest + tsc); E2E critical só pré-commit se for o gate
- Commit(s) por fase ou um final — **sem push** sem pedido

---

## Cuidados operacionais

- Banco compartilhado / PRD: no dia a dia usar check/build/unit; E2E/perf com tenant de teste (`e2e/helpers/test-env.ts`)
- Não commitar `.env`
- Diffs pequenos por fase

## Critério de parada Fase 0

Mapa + baseline (`docs/perf/baseline-antes.*`) + este plano. Aguardar autorização para Fase 1+.

---

## Status (Fase 5 fechada)

- Fases 1–4 implementadas; medição `fase5-final` salva
- Docs: `PADRAO-CARGA-DADOS.md`, `BACKLOG-MIGRACAO.md`, `LINT-DEBT.md`
- Continuação: lotes A→E em `BACKLOG-MIGRACAO.md` (nada fica para trás; commits separados)
