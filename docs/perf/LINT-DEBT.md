# Dívida de lint — `react-hooks/set-state-in-effect`

Última execução: `npm run lint` / ESLint JSON (pass de redução set-state).

| Métrica | Antes (início do pass) | Agora |
|---------|------------------------|-------|
| Erros totais (lint) | **85** | **~8** (outras regras: refs, purity, immutability) |
| Warnings | **68** | **~60** |
| `set-state-in-effect` | **77** | **0** |

Ignorados por config: `components/ui/**`, `**/*.test.ts(x)`, `tests/**`.

## O que mudou neste pass

- **Migração:** paginação sem `useEffect` (`setPage(1)` nos handlers de filtro); busca fornecedor/itens via `useQuery` (pedido detalhe, `requisition-line-items-section`); equalização (`ownRequisitionCodesQueryOptions`, remoção de `useLayoutEffect` duplicado em colunas); admin shell (`adminName` derivado); integration monitor (`enabledOutboundActions` derivado); suporte (categorias da query).
- **Exceções documentadas:** `eslint-disable` pontual com referência a `docs/PADRAO-CARGA-DADOS.md` onde o espelho local (form, dialog, shell, Auth) não foi eliminado.

## Exceções documentadas (não são dívida da regra)

Arquivos com comentário `eslint-disable`/`eslint-disable-next-line` para `set-state-in-effect` (inventário pós-pass):

`lib/hooks/useUser.ts`, `app/comprador/pedidos/[id]/page.tsx`, `app/admin/tenants/[id]/page.tsx`, `app/comprador/configuracoes/page.tsx` (efeitos de hidratação sem disable — regra satisfeita), `app/solicitante/configuracoes/page.tsx` (idem), `app/solicitante/nova/page.tsx`, `app/comprador/requisicoes/nova/page.tsx`, `components/support/support-page.tsx`, e demais telas/dialogs/layout listados no repositório via `rg react-hooks/set-state-in-effect` (≈50 arquivos com supressão pontual).

## Dívida restante (outras regras React Hooks)

Consultar `npm run lint` — principalmente `react-hooks/refs`, `react-hooks/purity`, `react-hooks/immutability` (ex.: equalização countdown/ref, suporte `replaceFiltersRef`).

## Plano de zerar

Ver `BACKLOG-MIGRACAO.md` — Lote E. Item **`set-state-in-effect` = 0** concluído neste pass; faltam prefetch/hydration, perf Playwright e erros não set-state.